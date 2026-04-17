import type { FriendlyErrorContext } from "@/lib/friendly-errors";

export const applicantCopy = {
  pageTitle: "补助申请服务",
  pageSubtitle: "领取资格凭证并提交资格核验",
  missingCredentialSetTitle: "当前资格名单尚未发布",
  missingCredentialSetDescription: "资格名单尚未公布，请稍后再进入申请流程。",
  credentialSectionTitle: "资格凭证",
  credentialSectionDescription: "领取后即可用于当前补助申请的资格核验，无需重复提交完整材料。",
  credentialStatus: {
    stale: "需更新资格凭证",
    ready: "资格凭证可用",
    pending: "待领取资格凭证"
  },
  credentialHint: {
    stale: "资格名单已经更新，请先更新资格凭证。",
    ready: "资格凭证已准备完成，可继续进入资格核验。",
    pending: "领取完成后，才能继续提交资格核验。"
  },
  credentialVersionLabel: (version: number) => `当前凭证版本 v${version}`,
  credentialMissingLabel: "当前还没有可用的资格凭证。",
  claimButtonLabel: (hasCredential: boolean) => (hasCredential ? "更新资格凭证" : "领取资格凭证"),
  verifyEntryButtonLabel: "进入资格核验",
  claimDialog: {
    confirmTitle: (hasCredential: boolean) => (hasCredential ? "确认更新资格凭证" : "确认领取资格凭证"),
    confirmDescription: (hasCredential: boolean) =>
      hasCredential
        ? "更新后会用当前资格名单的最新版本覆盖现有资格凭证。"
        : "系统会确认当前账户信息，并为本次补助申请准备资格凭证。",
    progressTitle: (hasCredential: boolean) => (hasCredential ? "正在更新资格凭证" : "正在领取资格凭证"),
    progressDescription: "系统正在确认你的申请账户信息并准备资格凭证，请稍候。",
    successTitle: (hasCredential: boolean) => (hasCredential ? "资格凭证更新成功" : "资格凭证领取成功"),
    successDescription: "资格凭证已准备完成，可用于本次补助申请。",
    successDetails: (version: number, address: string) => `凭证版本：v${version}\n适用账户：${address}`,
    errorTitle: (hasCredential: boolean) => (hasCredential ? "资格凭证更新失败" : "资格凭证领取失败"),
    errorDescription: "当前没有完成资格凭证准备，请稍后重试。",
    failureHistoryTitle: "资格凭证领取失败"
  },
  blockedVerify: {
    title: (hasCredential: boolean) => (hasCredential ? "请先更新资格凭证" : "请先领取资格凭证"),
    description: (hasCredential: boolean) =>
      hasCredential ? "资格名单已经更新，请先更新资格凭证后再继续提交。" : "领取完成后，才能继续提交资格核验。"
  },
  benefitInfoTitle: "补助信息",
  benefitNameLabel: "补助名称",
  benefitName: "失业补助",
  benefitAmountLabel: "补助金额",
  benefitStatusLabel: "发放状态",
  benefitStatus: {
    claimed: "已领取",
    active: "发放中",
    inactive: "暂未开启"
  },
  claimHistoryTitle: "补助到账记录",
  claimHistoryLoading: "正在同步补助到账记录",
  claimHistoryEmpty: "暂无补助到账记录",
  claimHistoryVersionLabel: (version: number) => `资格名单版本 v${version}`,
  failureHistoryTitle: "办理异常记录",
  failureHistoryEmpty: "暂无办理异常记录",
  verify: {
    blockedStates: {
      missingCredentialSetTitle: "当前资格名单尚未发布",
      missingCredentialSetDescription: "资格名单尚未公布，请稍后再进入申请流程。",
      missingCredentialTitle: "请先领取资格凭证",
      missingCredentialDescription: "领取完成后，才能继续提交资格核验。",
      staleCredentialTitle: "请先更新资格凭证",
      staleCredentialDescription: "资格名单已经更新，请先更新资格凭证后再继续提交。",
      inactiveProgramTitle: "当前发放尚未开启",
      inactiveProgramDescription: "当前补助暂未进入发放阶段，请稍后再试。",
      lowBalanceTitle: "当前可发放余额不足",
      lowBalanceDescription: "当前余额不足以完成本次补助发放，请稍后再试。",
      claimedTitle: "当前补助已领取完成",
      claimedDescription: "同一申请人对当前补助只能成功领取一次，无需重复提交。"
    },
    confirmTitle: "确认提交资格核验",
    confirmDescription: "系统会核对你的资格信息，并在通过后进入补助发放流程。",
    confirmDetails: (address: string, amount: string) => `当前账户：${address}\n补助金额：${amount}`,
    progress: {
      checkingTitle: "正在核对资格信息",
      checkingDescription: "系统正在核对当前账户与资格凭证是否一致。",
      generatingTitle: "正在生成核验材料",
      generatingDescription: "系统正在准备资格核验所需材料，请不要关闭页面。",
      submittingTitle: "正在提交资格核验",
      submittingDescription: "核验材料已经准备完成，请确认本次提交。",
      confirmingTitle: "正在确认提交结果",
      confirmingDescription: "提交已发送，系统正在确认结果并同步发放状态。",
      confirmingDetails: (hash: string) => `交易哈希：${hash}`
    },
    success: {
      dialogTitle: "补助已领取完成",
      dialogDescription: "资格核验通过，补助已发放至当前账户。",
      dialogDetails: (hash: string, amount: string) => `交易哈希：${hash}\n发放金额：${amount}`,
      pageTitle: "补助已领取完成",
      pageDescription: "资格核验通过，补助已发放至当前账户。",
      hashLabel: "交易哈希",
      amountLabel: "发放金额"
    },
    failureHistoryTitle: "资格核验失败",
    errorTitle: (context: FriendlyErrorContext) => (context === "verify-proof" ? "资格核验准备失败" : "补助领取失败"),
    steps: [
      {
        title: "核对资格信息",
        desc: "确认当前账户与资格凭证是否一致"
      },
      {
        title: "生成核验材料",
        desc: "系统准备本次资格核验所需材料"
      },
      {
        title: "补助发放",
        desc: "提交核验后进入补助发放流程"
      }
    ],
    pageTitle: "资格核验与补助发放",
    pageDescription: "系统将核对你的补助资格，核验通过后会自动进入补助发放流程。",
    buttonLabelIdle: "提交资格核验",
    mainHintGenerating: "系统正在生成核验材料，请不要关闭页面。",
    mainHintDefault: "提交后，系统会完成资格核验并同步发放结果。"
  }
} as const;
