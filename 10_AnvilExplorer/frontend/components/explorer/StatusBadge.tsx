import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "pending" | "failed" | "neutral";

// 状态语义到视觉样式的映射表。
const toneClassMap: Record<StatusTone, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-700",
  pending: "border-amber-300 bg-amber-50 text-amber-700",
  failed: "border-rose-300 bg-rose-50 text-rose-700",
  neutral: "border-slate-300 bg-white text-slate-700",
};

/**
 * 状态徽标：统一展示成功/进行中/失败等语义状态。
 */
export default function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", toneClassMap[tone], className)}>
      {children}
    </Badge>
  );
}
