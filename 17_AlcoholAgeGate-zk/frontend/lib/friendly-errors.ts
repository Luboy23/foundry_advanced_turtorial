export type FriendlyErrorContext =
  | "wallet-connect"
  | "wallet-switch"
  | "credential-claim"
  | "credential-storage"
  | "verify-submit"
  | "verify-proof"
  | "purchase-product"
  | "publish-credential-set"
  | "seller-update-product"
  | "seller-withdraw"
  | "generic";

const fallbackMessages: Record<FriendlyErrorContext, string> = {
  "wallet-connect": "当前未能完成钱包连接，请稍后重试。",
  "wallet-switch": "当前未能切换到项目网络，请稍后重试。",
  "credential-claim": "当前未能领取年龄凭证，请稍后重试。",
  "credential-storage": "当前未能读取本地年龄凭证，请稍后重试。",
  "verify-submit": "当前未能完成资格验证，请稍后重试。",
  "verify-proof": "当前未能完成资格验证准备，请稍后重试。",
  "purchase-product": "当前未能完成下单，请稍后重试。",
  "publish-credential-set": "当前未能更新资格数据，请稍后重试。",
  "seller-update-product": "当前未能保存商品设置，请稍后重试。",
  "seller-withdraw": "当前未能提取货款，请稍后重试。",
  generic: "当前操作未能完成，请稍后重试。"
};

const cancelMessages: Record<FriendlyErrorContext, string> = {
  "wallet-connect": "你已取消本次钱包连接。",
  "wallet-switch": "你已取消本次网络切换。",
  "credential-claim": "你已取消本次年龄凭证领取。",
  "credential-storage": "你已取消本次本地凭证处理。",
  "verify-submit": "你已取消本次资格验证提交。",
  "verify-proof": "你已取消本次资格验证。",
  "purchase-product": "你已取消本次下单。",
  "publish-credential-set": "你已取消本次资格数据更新。",
  "seller-update-product": "你已取消本次商品保存。",
  "seller-withdraw": "你已取消本次提现。",
  generic: "你已取消本次操作。"
};

function includesAny(target: string, keywords: string[]) {
  return keywords.some((keyword) => target.includes(keyword));
}

function extractErrorMessage(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const candidate = error as {
      shortMessage?: unknown;
      details?: unknown;
      message?: unknown;
      cause?: unknown;
    };

    if (typeof candidate.shortMessage === "string" && candidate.shortMessage.trim()) {
      return candidate.shortMessage;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.details === "string" && candidate.details.trim()) {
      return candidate.details;
    }
    if (candidate.cause) {
      return extractErrorMessage(candidate.cause);
    }
  }

  return "";
}

function isFriendlyMessage(message: string) {
  const technicalMarkers = [
    "0x",
    "abi",
    "revert",
    "execution reverted",
    "contractfunctionexecutionerror",
    "productpurchased",
    "groth16",
    "calldata",
    "merkle",
    "rpc",
    "estimategas",
    "stack"
  ];

  return /[\u4e00-\u9fff]/.test(message) && !includesAny(message.toLowerCase(), technicalMarkers) && message.length <= 90;
}

export function getFriendlyErrorMessage(error: unknown, context: FriendlyErrorContext) {
  const raw = extractErrorMessage(error).replace(/^Error:\s*/i, "").trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return fallbackMessages[context];
  }

  if (
    includesAny(normalized, [
      "user rejected",
      "user denied",
      "rejected the request",
      "rejected request",
      "rejected action",
      "denied transaction",
      "transaction was rejected",
      "用户取消",
      "交易已拒绝"
    ])
  ) {
    return cancelMessages[context];
  }

  if (
    includesAny(normalized, [
      "credential challenge",
      "credential claim",
      "领取年龄凭证",
      "本地凭证",
      "凭证格式已更新",
      "not eligible to claim",
      "claim route"
    ])
  ) {
    return context === "credential-storage"
      ? "当前本地凭证暂不可用，请重新领取后再试。"
      : "当前未能领取年龄凭证，请稍后重试。";
  }

  if (includesAny(normalized, ["insufficient funds", "余额不足"])) {
    return "当前账户余额不足，请补充余额后再试。";
  }

  if (
    includesAny(normalized, [
      "connector",
      "walletconnect",
      "wallet connector",
      "no wallet",
      "未发现可用的钱包连接器"
    ])
  ) {
    return "未检测到可用钱包，请先打开并授权钱包。";
  }

  if (includesAny(normalized, ["wrong chain", "switch chain", "chain mismatch", "network", "chain"])) {
    return "当前网络不正确，请切换到项目网络后再试。";
  }

  if (includesAny(normalized, ["当前页面尚未准备好", "客户端尚未准备好", "page is not ready"])) {
    return "页面仍在准备中，请稍后再试。";
  }

  if (includesAny(normalized, ["invalidverificationdate"])) {
    return "当前链上日期尚未到达本次验证使用的日期，请刷新页面后重新验证。";
  }

  if (includesAny(normalized, ["buyernoteligible"])) {
    return "当前账户尚未具备购买资格，请先完成年龄资格验证。";
  }

  if (includesAny(normalized, ["productinactive"])) {
    return "当前商品暂未开放购买。";
  }

  if (includesAny(normalized, ["outofstock"])) {
    return "当前商品库存不足，请稍后再试。";
  }

  if (includesAny(normalized, ["invalidquantity"])) {
    return "请输入有效的购买数量后再试。";
  }

  if (includesAny(normalized, ["incorrectpayment"])) {
    return "订单金额与当前商品价格不一致，请刷新页面后重试。";
  }

  if (includesAny(normalized, ["productnotfound"])) {
    return "当前商品不存在或暂不可购买。";
  }

  if (includesAny(normalized, ["nopendingbalance"])) {
    return "当前暂无可提取的货款。";
  }

  if (includesAny(normalized, ["sellerunavailable", "transferfailed"])) {
    return "当前暂时无法完成货款处理，请稍后再试。";
  }

  if (includesAny(normalized, ["invalidprice"])) {
    return "请输入有效的商品价格后再保存。";
  }

  if (includesAny(normalized, ["credentialsetmismatch", "credentialsetinactive", "invalidproof"])) {
    return "当前资格验证未通过，请确认当前账户已在身份集合中，并且已达到可验证的法定年龄后再试。";
  }

  if (includesAny(normalized, ["unauthorized"])) {
    if (context === "publish-credential-set") {
      return "当前账户暂无年龄验证方权限，无法更新资格数据。";
    }
    if (context === "seller-update-product" || context === "seller-withdraw") {
      return "当前账户暂无卖家权限，无法执行该操作。";
    }
    if (context === "purchase-product" || context === "verify-submit") {
      return "当前账户暂无买家权限，无法执行该操作。";
    }
  }

  if (
    includesAny(normalized, [
      "当前账户与凭证归属不一致",
      "凭证钱包绑定字段与当前账户不匹配",
      "绑定地址不匹配",
      "address mismatch"
    ])
  ) {
    return "当前账户与凭证不一致，请切换到对应买家账户。";
  }

  if (
    includesAny(normalized, [
      "challenge expired",
      "challenge not found",
      "challenge mismatch",
      "签名已过期",
      "签名校验失败"
    ])
  ) {
    return "本次凭证领取已失效，请重新发起领取后再试。";
  }

  if (includesAny(normalized, ["未找到对应的年龄凭证", "no private credential"])) {
    return "当前账户暂未准备好年龄凭证，请联系年龄验证方后再试。";
  }

  if (isFriendlyMessage(raw)) {
    return raw;
  }

  return fallbackMessages[context];
}
