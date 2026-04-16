import { formatYmdDate, isEligibleOnYmd } from "@/lib/domain/age-eligibility";
import { isCredentialCurrent } from "@/lib/domain/credentials";
import type { AgeCredentialSet, EligibilityStatus, LocalAgeCredential } from "@/types/domain";

// 买家流程状态机的目的，是让“能不能领凭证、能不能验证、能不能购买”
// 在买家中心、验证页和商品页都使用同一套业务语义。
export type BuyerFlowStatus =
  | "disconnected"
  | "wrong-chain"
  | "no-buyer-role"
  | "missing-credential"
  | "credential-mismatch"
  | "credential-stale"
  | "waiting-for-adult-date"
  | "ready-to-verify"
  | "eligible"
  | "purchase-ready";

export type BuyerFlowTone = "warning" | "danger" | "success" | "neutral";

export type BuyerFlowAction =
  | "connect-wallet"
  | "switch-chain"
  | "claim-credential"
  | "refresh-credential"
  | "verify-eligibility"
  | "wait-for-adult-date"
  | "go-purchase"
  | "none";

export type BuyerFlowState = {
  status: BuyerFlowStatus;
  tone: BuyerFlowTone;
  title: string;
  description: string;
  recommendedAction: BuyerFlowAction;
  credentialCurrent: boolean;
  waitingForAdultDate: boolean;
  eligibleFromYmd: number | null;
  canClaimCredential: boolean;
  canVerifyEligibility: boolean;
  hasCurrentEligibility: boolean;
};

export function deriveBuyerFlowState(args: {
  isConnected: boolean;
  wrongChain: boolean;
  hasBuyerRole: boolean;
  hasStoredCredential: boolean;
  credentialStatus: "missing" | "loading" | "ready" | "mismatch" | "error";
  credentialError: string | null;
  isClaiming: boolean;
  credential: LocalAgeCredential | null;
  currentSet: AgeCredentialSet | null;
  eligibility: EligibilityStatus | null;
  currentDateYmd: number | null;
  canPurchaseNow?: boolean;
}) {
  const credentialCurrent = isCredentialCurrent(args.credential, args.currentSet);
  const eligibleFromYmd = args.credential?.eligibleFromYmd ?? null;
  // waitingForAdultDate 和 credential-stale 很容易被混淆：
  // 前者是“凭证没问题，但当前日期还没到成年日”；
  // 后者是“凭证本身已经不对应当前资格集合”。
  const waitingForAdultDate = Boolean(
    credentialCurrent &&
      eligibleFromYmd &&
      args.currentDateYmd &&
      !isEligibleOnYmd(eligibleFromYmd, args.currentDateYmd)
  );

  if (!args.isConnected) {
    return {
      status: "disconnected",
      tone: "warning",
      title: "请先连接买家钱包",
      description: "连接钱包后，系统才可以判断当前账户是否具备买家权限。",
      recommendedAction: "connect-wallet",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: false,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (args.wrongChain) {
    return {
      status: "wrong-chain",
      tone: "warning",
      title: "请先切换到项目网络",
      description: "当前网络不正确，请切换到项目链后再继续领取凭证、验证年龄资格或购买商品。",
      recommendedAction: "switch-chain",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: false,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (!args.hasBuyerRole) {
    return {
      status: "no-buyer-role",
      tone: "warning",
      title: "当前账户暂无买家权限",
      description: "请联系年龄验证方把该地址纳入身份集合并发布后，再领取本地年龄凭证。",
      recommendedAction: "none",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: false,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (!args.hasStoredCredential) {
    return {
      status: "missing-credential",
      tone: "warning",
      title: "请先领取年龄凭证",
      description: "领取完成后，系统会在本地准备私有凭证信息，后续即可继续进行年龄验证。",
      recommendedAction: "claim-credential",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: !args.isClaiming,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (args.credentialStatus === "mismatch") {
    return {
      status: "credential-mismatch",
      tone: "warning",
      title: "当前本地凭证属于其他账户",
      description: "请切换到对应买家账户，或清除当前本地凭证后重新领取。",
      recommendedAction: "refresh-credential",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: !args.isClaiming,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (args.credentialError && !args.credential) {
    return {
      status: "credential-stale",
      tone: "danger",
      title: "当前本地凭证暂不可用",
      description: args.credentialError,
      recommendedAction: "refresh-credential",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: !args.isClaiming,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (!args.credential || !credentialCurrent) {
    return {
      status: "credential-stale",
      tone: "warning",
      title: "当前凭证需要刷新",
      description: "当前本地年龄凭证对应的资格集合已更新，请先刷新年龄凭证后再继续。",
      recommendedAction: "refresh-credential",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: !args.isClaiming,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (waitingForAdultDate && eligibleFromYmd) {
    return {
      status: "waiting-for-adult-date",
      tone: "warning",
      title: "当前账户尚未到达成年日",
      description: `当前账户已在身份集合中，但将在 ${formatYmdDate(eligibleFromYmd)} 达到法定购酒年龄。届时无需重新领取凭证，只需重新验证。`,
      recommendedAction: "wait-for-adult-date",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: false,
      canVerifyEligibility: false,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (!args.eligibility?.isCurrent) {
    return {
      status: "ready-to-verify",
      tone: "warning",
      title: "当前还没有有效购买资格",
      description: "本地年龄凭证已准备完成，接下来只需完成一次年龄验证，就可以继续浏览商品并购买。",
      recommendedAction: "verify-eligibility",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: false,
      canVerifyEligibility: true,
      hasCurrentEligibility: false
    } satisfies BuyerFlowState;
  }

  if (args.canPurchaseNow) {
    return {
      status: "purchase-ready",
      tone: "success",
      title: "当前可以购买商品",
      description: "当前账户已具备有效购买资格，并且商品状态允许购买。",
      recommendedAction: "go-purchase",
      credentialCurrent,
      waitingForAdultDate,
      eligibleFromYmd,
      canClaimCredential: false,
      canVerifyEligibility: false,
      hasCurrentEligibility: true
    } satisfies BuyerFlowState;
  }

  return {
    // eligible 表示“资格当前有效，但这里不额外判断商品是否可买”；
    // 真正落到具体商品页时，才会进一步推导出 purchase-ready。
    status: "eligible",
    tone: "success",
    title: "购买资格当前有效",
    description: "当前账户已经完成年龄验证，后续只要资格集合版本不变，就可以继续购买。",
    recommendedAction: "go-purchase",
    credentialCurrent,
    waitingForAdultDate,
    eligibleFromYmd,
    canClaimCredential: false,
    canVerifyEligibility: false,
    hasCurrentEligibility: true
  } satisfies BuyerFlowState;
}
