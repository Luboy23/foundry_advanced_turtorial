import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSelectorLookupCacheForTest,
  getSelectorFromInput,
  lookupPublicFunctionName,
} from "./selector-signature";

const originalFetch = globalThis.fetch;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearSelectorLookupCacheForTest();
  vi.restoreAllMocks();
});

describe("getSelectorFromInput", () => {
  it("extracts selector from valid input", () => {
    expect(getSelectorFromInput("0xa9059cbb00000000")).toBe("0xa9059cbb");
  });

  it("returns null for invalid input", () => {
    expect(getSelectorFromInput("0x1234")).toBeNull();
    expect(getSelectorFromInput("hello")).toBeNull();
    expect(getSelectorFromInput(undefined)).toBeNull();
  });
});

describe("lookupPublicFunctionName", () => {
  it("reads function name from OpenChain first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result: {
          function: {
            "0x50fd7367": [{ name: "mintWithURI(address,string)" }],
          },
        },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const functionName = await lookupPublicFunctionName("0x50fd7367");
    expect(functionName).toBe("mintWithURI");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to 4byte when OpenChain misses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            function: {},
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ text_signature: "approve(address,uint256)" }],
        })
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const functionName = await lookupPublicFunctionName("0x095ea7b3");
    expect(functionName).toBe("approve");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses cache to avoid repeated lookups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result: {
          function: {
            "0xa9059cbb": [{ name: "transfer(address,uint256)" }],
          },
        },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const first = await lookupPublicFunctionName("0xa9059cbb");
    const second = await lookupPublicFunctionName("0xa9059cbb");
    expect(first).toBe("transfer");
    expect(second).toBe("transfer");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for invalid selector without network call", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const functionName = await lookupPublicFunctionName("0x1234");
    expect(functionName).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
