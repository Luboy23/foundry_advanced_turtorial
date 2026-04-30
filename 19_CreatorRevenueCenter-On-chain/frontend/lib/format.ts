import { formatUnits } from "viem";

const amountDisplayVariants = {
  summary: { minFractionDigits: 2, maxFractionDigits: 4 },
  detail: { minFractionDigits: 2, maxFractionDigits: 6 }
} as const;

type AmountDisplayVariant = keyof typeof amountDisplayVariants;

function addThousandsSeparators(input: string) {
  return input.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDecimalString(value: string, variant: AmountDisplayVariant) {
  const options = amountDisplayVariants[variant];
  const negative = value.startsWith("-");
  const normalized = negative ? value.slice(1) : value;
  const [rawWhole, rawFraction = ""] = normalized.split(".");
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";
  const trimmedFraction = rawFraction.slice(0, options.maxFractionDigits).replace(/0+$/, "");
  const fraction =
    trimmedFraction.length >= options.minFractionDigits
      ? trimmedFraction
      : rawFraction.slice(0, options.minFractionDigits).padEnd(options.minFractionDigits, "0");

  return `${negative ? "-" : ""}${addThousandsSeparators(whole)}.${fraction}`;
}

export function formatAssetAmount(value: bigint | string, variant: AmountDisplayVariant = "summary") {
  const bigintValue = typeof value === "bigint" ? value : BigInt(value);
  return formatDecimalString(formatUnits(bigintValue, 18), variant);
}

export function formatAssetDisplay(valueDisplay: string, assetSymbol = "ETH") {
  return `${valueDisplay} ${assetSymbol}`;
}

export function formatBatchLabel(label: string) {
  return label;
}
