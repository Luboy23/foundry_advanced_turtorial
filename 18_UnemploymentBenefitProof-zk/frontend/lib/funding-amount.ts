/**
 * 发放机构补充资金输入校验工具。
 *
 * 这里把“输入过程中允许什么字符”和“最终可提交的金额是否合法”拆成两层，避免输入框体验
 * 被最终校验规则绑死。
 */
export const MIN_PROGRAM_FUND_AMOUNT_ETH = 100;
export const MAX_PROGRAM_FUND_AMOUNT_ETH = 10000;

const FUND_AMOUNT_INPUT_PATTERN = /^\d*(?:\.\d{0,18})?$/;
const FUND_AMOUNT_FINAL_PATTERN = /^\d+(?:\.\d{1,18})?$/;

/** 判断输入框当前值是否允许继续保留。 */
export function isFundAmountInputAllowed(value: string) {
  return FUND_AMOUNT_INPUT_PATTERN.test(value.trim());
}

/** 把输入值规整成最终提交前的标准数字字符串。 */
export function normalizeFundAmountInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const [rawIntegerPart = "", rawFractionPart = ""] = trimmed.split(".");
  const integerPart = rawIntegerPart.replace(/^0+(?=\d)/, "") || "0";
  const fractionPart = rawFractionPart.replace(/0+$/, "");

  return fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
}

/** 返回当前输入对应的用户可读错误文案；合法时返回 `null`。 */
export function getFundAmountInputError(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return `请输入 ${MIN_PROGRAM_FUND_AMOUNT_ETH} - ${MAX_PROGRAM_FUND_AMOUNT_ETH} ETH 之间的金额。`;
  }

  if (!FUND_AMOUNT_FINAL_PATTERN.test(trimmed)) {
    return "请输入有效的数字金额。";
  }

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    return "请输入有效的数字金额。";
  }

  if (numericValue < MIN_PROGRAM_FUND_AMOUNT_ETH || numericValue > MAX_PROGRAM_FUND_AMOUNT_ETH) {
    return `请输入 ${MIN_PROGRAM_FUND_AMOUNT_ETH} - ${MAX_PROGRAM_FUND_AMOUNT_ETH} ETH 之间的金额。`;
  }

  return null;
}

/** 返回标准化后的金额和最终是否合法，便于按钮点击逻辑直接消费。 */
export function getValidatedFundAmount(value: string) {
  const normalized = normalizeFundAmountInput(value);
  const error = getFundAmountInputError(normalized);

  if (error) {
    return {
      ok: false as const,
      normalized,
      error
    };
  }

  return {
    ok: true as const,
    normalized
  };
}
