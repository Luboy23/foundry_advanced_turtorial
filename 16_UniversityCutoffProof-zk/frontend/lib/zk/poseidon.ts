import { getCurveFromName } from "@/lib/vendor/ffjavascript-browser";
import poseidonConstants from "@/lib/vendor/poseidon-constants-opt";

type PoseidonField = {
  add(left: unknown, right: unknown): unknown;
  e(value: unknown): unknown;
  mul(left: unknown, right: unknown): unknown;
  square(value: unknown): unknown;
  toString(value: unknown): string;
  zero: unknown;
};

type PoseidonFn = {
  (inputs: readonly unknown[], initState?: unknown, nOut?: number): unknown;
  F: PoseidonField;
};

let poseidonPromise: Promise<PoseidonFn> | null = null;

function unstringifyConstants(field: PoseidonField, value: unknown): unknown {
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return field.e(value);
  }
  if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) {
    return field.e(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => unstringifyConstants(field, entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, unstringifyConstants(field, entry)])
    );
  }
  return value;
}

export async function buildPoseidon(): Promise<PoseidonFn> {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const bn128 = await getCurveFromName("bn128", true);
      const field = bn128.Fr as PoseidonField;
      const opt = unstringifyConstants(field, poseidonConstants) as {
        C: unknown[][];
        S: unknown[][];
        M: unknown[][][];
        P: unknown[][][];
      };

      const N_ROUNDS_F = 8;
      const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];
      const pow5 = (value: unknown) => field.mul(value, field.square(field.square(value)));

      const poseidon = ((inputs: readonly unknown[], initState?: unknown, nOut = 1) => {
        if (inputs.length === 0 || inputs.length > N_ROUNDS_P.length) {
          throw new Error("Invalid poseidon input size");
        }

        const t = inputs.length + 1;
        const nRoundsP = N_ROUNDS_P[t - 2];
        const constants = opt.C[t - 2] as unknown[];
        const sparse = opt.S[t - 2] as unknown[];
        const matrix = opt.M[t - 2] as unknown[][];
        const preMatrix = opt.P[t - 2] as unknown[][];

        let state = [initState ? field.e(initState) : field.zero, ...inputs.map((input) => field.e(input))];

        state = state.map((entry, index) => field.add(entry, constants[index]));

        for (let round = 0; round < N_ROUNDS_F / 2 - 1; round += 1) {
          state = state.map((entry) => pow5(entry));
          state = state.map((entry, index) => field.add(entry, constants[(round + 1) * t + index]));
          state = state.map((_, index) =>
            state.reduce(
              (acc, entry, innerIndex) => field.add(acc, field.mul((matrix[innerIndex] as unknown[])[index], entry)),
              field.zero
            )
          );
        }

        state = state.map((entry) => pow5(entry));
        state = state.map((entry, index) => field.add(entry, constants[(N_ROUNDS_F / 2) * t + index]));
        state = state.map((_, index) =>
          state.reduce(
            (acc, entry, innerIndex) => field.add(acc, field.mul((preMatrix[innerIndex] as unknown[])[index], entry)),
            field.zero
          )
        );

        for (let round = 0; round < nRoundsP; round += 1) {
          state[0] = pow5(state[0]);
          state[0] = field.add(state[0], constants[(N_ROUNDS_F / 2 + 1) * t + round]);

          const state0 = state.reduce(
            (acc, entry, index) => field.add(acc, field.mul(sparse[(t * 2 - 1) * round + index], entry)),
            field.zero
          );

          for (let index = 1; index < t; index += 1) {
            state[index] = field.add(
              state[index],
              field.mul(state[0], sparse[(t * 2 - 1) * round + t + index - 1])
            );
          }

          state[0] = state0;
        }

        for (let round = 0; round < N_ROUNDS_F / 2 - 1; round += 1) {
          state = state.map((entry) => pow5(entry));
          state = state.map((entry, index) =>
            field.add(entry, constants[(N_ROUNDS_F / 2 + 1) * t + nRoundsP + round * t + index])
          );
          state = state.map((_, index) =>
            state.reduce(
              (acc, entry, innerIndex) => field.add(acc, field.mul((matrix[innerIndex] as unknown[])[index], entry)),
              field.zero
            )
          );
        }

        state = state.map((entry) => pow5(entry));
        state = state.map((_, index) =>
          state.reduce(
            (acc, entry, innerIndex) => field.add(acc, field.mul((matrix[innerIndex] as unknown[])[index], entry)),
            field.zero
          )
        );

        return nOut === 1 ? state[0] : state.slice(0, nOut);
      }) as PoseidonFn;

      poseidon.F = field;
      return poseidon;
    })();
  }

  return poseidonPromise;
}
