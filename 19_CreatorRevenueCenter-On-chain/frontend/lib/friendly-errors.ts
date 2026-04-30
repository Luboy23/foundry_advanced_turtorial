import { BaseError } from "viem";

export type FriendlyErrorContext =
  | "wallet-connect"
  | "wallet-switch"
  | "claim"
  | "reserve-fund"
  | "batch-publish"
  | "batch-pause"
  | "batch-close"
  | "generic";

const fallbackMessages: Record<FriendlyErrorContext, string> = {
  "wallet-connect": "当前未能完成钱包连接，请稍后重试。",
  "wallet-switch": "当前未能切换到项目网络，请稍后重试。",
  claim: "当前未能完成收益领取，请稍后重试。",
  "reserve-fund": "当前未能补充结算资金，请稍后重试。",
  "batch-publish": "当前未能发布批次，请稍后重试。",
  "batch-pause": "当前未能暂停当前批次，请稍后重试。",
  "batch-close": "当前未能关闭当前批次，请稍后重试。",
  generic: "当前操作未能完成，请稍后重试。"
};

function appendToken(target: Set<string>, value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return;

  const normalized = value.trim();
  target.add(normalized.toLowerCase());

  const matches = normalized.match(/[A-Z][A-Za-z0-9]+/g) ?? [];
  for (const match of matches) {
    target.add(match.toLowerCase());
  }
}

function collectErrorTokens(error: unknown) {
  const tokens = new Set<string>();

  const visit = (value: unknown) => {
    if (!value) return;

    if (typeof value === "string") {
      appendToken(tokens, value);
      return;
    }

    if (value instanceof BaseError) {
      appendToken(tokens, value.shortMessage);
      appendToken(tokens, value.details);
      appendToken(tokens, value.message);

      const revertedError = value.walk((node) => {
        return Boolean(node && typeof node === "object" && "name" in node && node.name === "ContractFunctionRevertedError");
      });
      if (revertedError && "data" in revertedError && revertedError.data && typeof revertedError.data === "object") {
        const data = revertedError.data as Record<string, unknown>;
        appendToken(tokens, data.errorName);
        appendToken(tokens, data.errorSignature);
      }
    }

    if (value instanceof Error) {
      appendToken(tokens, value.name);
      appendToken(tokens, value.message);
      visit((value as Error & { cause?: unknown }).cause);
      return;
    }

    if (typeof value === "object") {
      for (const candidate of Object.values(value as Record<string, unknown>)) {
        if (typeof candidate === "string" || typeof candidate === "object") {
          visit(candidate);
        }
      }
    }
  };

  visit(error);
  return tokens;
}

function hasAnyToken(tokens: Set<string>, values: string[]) {
  return values.some((value) => tokens.has(value.toLowerCase()));
}

function hasAnyTokenFragment(tokens: Set<string>, values: string[]) {
  const normalizedValues = values.map((value) => value.toLowerCase());
  return [...tokens].some((token) => normalizedValues.some((value) => token.includes(value)));
}

export function getFriendlyErrorMessage(error: unknown, context: FriendlyErrorContext) {
  const tokens = collectErrorTokens(error);
  if (tokens.size === 0) return fallbackMessages[context];

  if (hasAnyToken(tokens, ["user rejected", "denied", "cancel"])) {
    return "你已取消本次操作。";
  }

  if (hasAnyToken(tokens, ["wrong chain", "switch chain", "chain mismatch"])) {
    return "当前网络不正确，请切换到项目网络后再试。";
  }

  if (hasAnyToken(tokens, ["insufficient funds"])) {
    return "当前钱包余额不足，无法继续本次操作。";
  }

  if (
    hasAnyTokenFragment(tokens, [
      "timed out",
      "timeout",
      "transaction receipt",
      "wait for transaction receipt",
      "transaction not found",
      "当前未读到链上确认",
      "暂时没有读取到链上确认"
    ])
  ) {
    return context === "claim"
      ? "交易已经提交，但暂时没有读取到链上确认，请稍后刷新账单状态确认是否已到账。"
      : "交易已经提交，但暂时没有读取到链上确认，请稍后刷新页面确认批次状态。";
  }

  if (hasAnyToken(tokens, ["invalid funding amount", "invalidfundingamount"])) {
    return "激活交易的上链资金必须与当月结算总额完全一致。";
  }

  if (hasAnyToken(tokens, ["insufficient liquidity", "insufficientliquidity"])) {
    return "当前合约预存的原生 ETH 不足，请稍后重试。";
  }

  if (hasAnyToken(tokens, ["batch already activated", "batchalreadyactivated", "batch already initialized", "batchalreadyinitialized"])) {
    return "当前月份已经激活上链，不能再次设置或补资。";
  }

  if (hasAnyToken(tokens, ["claim already used", "claimalreadyused"])) {
    return "本月收益已领取完成，无需重复提交。";
  }

  if (hasAnyToken(tokens, ["creator only", "creatoronly"])) {
    return "当前钱包不是账单归属创作者，不能发起领取。";
  }

  if (hasAnyToken(tokens, ["not owner", "notowner"])) {
    return "当前钱包不是平台结算账户，不能执行这个批次动作。";
  }

  if (hasAnyToken(tokens, ["batch not active", "batchnotactive", "batch not published", "batchnotpublished"])) {
    return "当前批次暂不可领取，请刷新状态后再试。";
  }

  if (hasAnyToken(tokens, ["batch not paused", "batchnotpaused"])) {
    return "只有已暂停批次才能恢复。";
  }

  if (hasAnyToken(tokens, ["batch closed", "batchalreadyclosed", "batchclosed"])) {
    return "当前批次已经关闭，不能继续执行这个动作。";
  }

  if (hasAnyToken(tokens, ["invalid proof", "invalidproof"])) {
    return "当前账单校验未通过，请刷新账单后再试。";
  }

  if (hasAnyToken(tokens, ["native eth only", "nativeethonly"])) {
    return "当前批次只支持 Anvil 原生 ETH 结算。";
  }

  if (hasAnyToken(tokens, ["direct funding disabled", "directfundingdisabled"])) {
    return "当前版本不支持单独补资，必须通过“保存并激活”一次完成资金上链。";
  }

  if (hasAnyToken(tokens, ["unauthorized publisher", "unauthorizedpublisher"])) {
    return "当前批次发布入口未授权，请先检查部署配置。";
  }

  if (hasAnyToken(tokens, ["transfer failed", "transferfailed"])) {
    return "当前链上转账没有完成，请稍后重试。";
  }

  if (hasAnyToken(tokens, ["reentrancy", "reentrancyguarded"])) {
    return "当前交易触发了合约保护机制，请稍后重试。";
  }

  return fallbackMessages[context];
}
