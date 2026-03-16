import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// 通用状态面板：统一承载交易进行中、成功与各类错误的可视化反馈。
type StatusCategory =
  | "pending"
  | "success"
  | "parameter"
  | "permission"
  | "network"
  | "signature"
  | "contract"
  | "info";

// 交易状态统一映射：signing/pending/success/error 会最终折叠到以下分类，
// 用于统一提示文案、颜色与按钮禁用策略。
const classifyStatus = (message: string, isLoading: boolean): StatusCategory => {
  if (isLoading) return "pending";
  const text = message.trim();
  if (!text) return "info";
  const lower = text.toLowerCase();

  if (
    lower.includes("已取消签名") ||
    lower.includes("user rejected") ||
    lower.includes("user denied")
  ) {
    return "signature";
  }

  if (
    lower.includes("没有管理员权限") ||
    lower.includes("not operator") ||
    lower.includes("not owner") ||
    lower.includes("无权限")
  ) {
    return "permission";
  }

  if (
    lower.includes("31337") ||
    lower.includes("anvil") ||
    lower.includes("rpc") ||
    lower.includes("network") ||
    lower.includes("transport") ||
    lower.includes("failed to fetch") ||
    lower.includes("确认超时")
  ) {
    return "network";
  }

  if (
    lower.includes("请填写") ||
    lower.includes("请选择") ||
    lower.includes("缺少") ||
    lower.includes("格式错误") ||
    lower.includes("必填") ||
    lower.includes("batchsize 必须")
  ) {
    return "parameter";
  }

  if (
    lower.includes("已确认") ||
    lower.includes("导入成功") ||
    lower.includes("提交成功") ||
    lower.includes("成功")
  ) {
    return "success";
  }

  if (lower.includes("revert") || lower.includes("失败")) {
    return "contract";
  }

  return "info";
};

const categoryMeta: Record<
  StatusCategory,
  { label: string; cardClass: string; labelClass: string; textClass: string }
> = {
  pending: {
    label: "处理中",
    cardClass: "border-sky-300 bg-sky-50/60",
    labelClass: "border-sky-300 text-sky-700",
    textClass: "text-sky-900",
  },
  success: {
    label: "成功",
    cardClass: "border-emerald-300 bg-emerald-50/60",
    labelClass: "border-emerald-300 text-emerald-700",
    textClass: "text-emerald-900",
  },
  parameter: {
    label: "参数错误",
    cardClass: "border-amber-300 bg-amber-50/60",
    labelClass: "border-amber-300 text-amber-700",
    textClass: "text-amber-900",
  },
  permission: {
    label: "权限错误",
    cardClass: "border-rose-300 bg-rose-50/60",
    labelClass: "border-rose-300 text-rose-700",
    textClass: "text-rose-900",
  },
  network: {
    label: "网络错误",
    cardClass: "border-indigo-300 bg-indigo-50/60",
    labelClass: "border-indigo-300 text-indigo-700",
    textClass: "text-indigo-900",
  },
  signature: {
    label: "签名取消",
    cardClass: "border-violet-300 bg-violet-50/60",
    labelClass: "border-violet-300 text-violet-700",
    textClass: "text-violet-900",
  },
  contract: {
    label: "合约错误",
    cardClass: "border-red-300 bg-red-50/60",
    labelClass: "border-red-300 text-red-700",
    textClass: "text-red-900",
  },
  info: {
    label: "提示",
    cardClass: "border-border bg-card",
    labelClass: "border-border text-muted-foreground",
    textClass: "text-foreground",
  },
};

// 通用状态提示卡片（用于显示提交/确认/错误）
type StatusPanelProps = {
  title?: string;
  message: string;
  isLoading?: boolean;
  loadingText?: string;
  emptyText?: string;
};

export function StatusPanel({
  title = "状态",
  message,
  isLoading = false,
  loadingText = "等待确认中...",
  emptyText = "可开始操作。",
}: StatusPanelProps) {
  const text = isLoading ? loadingText : message || emptyText;
  const category = classifyStatus(text, isLoading);
  const meta = categoryMeta[category];

  return (
    <Card className={`border-l-4 px-4 py-3 text-sm ${meta.cardClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <Badge variant="outline" className={meta.labelClass}>
          {meta.label}
        </Badge>
      </div>
      <p className={`mt-2 ${meta.textClass}`}>{text}</p>
    </Card>
  );
}
