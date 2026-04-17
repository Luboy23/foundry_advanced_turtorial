export const agencyCopy = {
  pageTitle: "补助发放管理",
  pageSubtitle: "管理可发放余额和发放状态",
  funding: {
    sectionTitle: "可发放余额",
    sectionHint: "当前可用于发放的余额",
    cardLabel: "可发放余额",
    inputLabel: "补充金额",
    actionLabel: "补充资金",
    confirmTitle: "确认补充资金",
    confirmDescription: (amount: string) => `本次将补充 ${amount} ETH，用于后续补助发放。`,
    confirmDetails: (amount: string, address: string) => `补充金额：${amount} ETH\n当前操作账户：${address}`,
    progressTitle: "正在补充资金",
    progressDescription: "系统正在提交补充资金操作并同步最新余额，请稍候。",
    successTitle: "资金补充成功",
    successDescription: "最新可发放余额已同步，后续补助发放可继续进行。",
    successDetails: (hash: string) => `交易哈希：${hash}`,
    errorTitle: "补充资金失败",
    errorDescription: "本次未完成补充资金，请稍后重试。"
  },
  distribution: {
    sectionTitle: "发放状态",
    activeStatus: "发放中",
    pausedStatus: "已暂停",
    activeDescription: "申请人现在可以继续申请补助",
    pausedDescription: "已暂停新的补助申请",
    helperText: "开启后，符合条件的申请人可以继续完成资格核验并申请发放。",
    confirmTitle: (nextActive: boolean) => (nextActive ? "确认开启发放" : "确认暂停发放"),
    confirmDescription: (nextActive: boolean) =>
      nextActive ? "开启后，符合条件的申请人即可继续提交资格核验并办理补助。" : "暂停后，申请人将暂时无法继续提交资格核验和申请补助。",
    confirmDetails: (currentActive: boolean, nextActive: boolean) =>
      `当前状态：${currentActive ? "发放中" : "已暂停"}\n切换后状态：${nextActive ? "发放中" : "已暂停"}`,
    progressTitle: (nextActive: boolean) => (nextActive ? "正在开启发放" : "正在暂停发放"),
    progressDescription: "系统正在更新发放状态并同步最新结果，请稍候。",
    successTitle: (nextActive: boolean) => (nextActive ? "发放已开启" : "发放已暂停"),
    successDescription: (nextActive: boolean) =>
      nextActive ? "申请人现在可以继续提交资格核验并申请补助。" : "申请人暂时无法继续提交新的补助申请。",
    successDetails: (hash: string) => `交易哈希：${hash}`,
    errorTitle: (nextActive: boolean) => (nextActive ? "开启发放失败" : "暂停发放失败"),
    errorDescription: "本次未完成发放状态更新，请稍后重试。",
    actionLabel: (active: boolean) => (active ? "暂停发放" : "开启发放")
  },
  overview: {
    title: "发放概览",
    totalClaimsLabel: "累计发放次数",
    totalAmountLabel: "累计发放金额",
    availableBalanceLabel: "可发放余额"
  },
  history: {
    title: "发放记录",
    timeColumn: "时间",
    recipientColumn: "申请人地址",
    amountColumn: "金额",
    versionColumn: "资格版本",
    loading: "正在同步发放记录",
    empty: "暂无发放记录"
  }
} as const;
