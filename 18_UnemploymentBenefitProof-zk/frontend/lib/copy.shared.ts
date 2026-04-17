export const sharedCopy = {
  serviceBadge: "失业补助资格服务",
  platformSubtitle: "失业补助资格证明平台",
  serviceEntryTitle: "服务入口",
  serviceStatusTitle: "当前服务状态",
  serviceStatusUnavailableTitle: "服务状态读取失败",
  serviceStatusUnavailableBody: "当前无法读取资格名单或资金池状态，请检查本地链、RPC 与合约配置后重试。",
  connectAccount: "连接账户",
  connecting: "连接中...",
  switchServiceNetwork: "切换服务网络",
  switching: "切换中...",
  accountConnected: "账户已连接",
  backHome: "返回首页",
  backToApplicantService: "返回补助申请服务",
  connectAccountRequiredTitle: "请先连接账户",
  connectAccountRequiredBody: "连接账户后，才能查看你可使用的服务和当前办理进度。",
  switchNetworkRequiredTitle: "请先切换服务网络",
  switchNetworkRequiredBody: "当前服务仅在指定网络下可用。切换完成后，再继续当前操作。",
  checkingAccessTitle: "正在确认账户权限",
  checkingAccessBody: "系统正在确认当前账户可使用的服务，请稍候。",
  roleQueryFailedTitle: "账户权限读取失败",
  roleQueryFailedBody: "当前无法确认账户可使用的服务，请检查本地链、RPC 与合约配置后重试。"
} as const;

export const roleCopy = {
  government: {
    title: "资格审核管理",
    desc: "发布资格名单并维护更新状态",
    path: "/government",
    recommendedAccountLabel: "审核管理账户"
  },
  applicant: {
    title: "补助申请服务",
    desc: "领取资格凭证并提交资格核验",
    path: "/applicant",
    recommendedAccountLabel: "申请账户"
  },
  agency: {
    title: "补助发放管理",
    desc: "管理补助资金与发放状态",
    path: "/agency",
    recommendedAccountLabel: "发放管理账户"
  }
} as const;
