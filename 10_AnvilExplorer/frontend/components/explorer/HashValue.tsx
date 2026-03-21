import Link from "next/link";
import { shortenHash } from "@/lib/format";
import CopyButton from "@/components/explorer/CopyButton";

/**
 * 哈希/地址展示组件：
 * - 支持短格式与完整格式；
 * - 可选跳转链接；
 * - 内置复制按钮。
 */
export default function HashValue({
  value,
  href,
  short = true,
  className,
}: {
  value: string;
  href?: string;
  short?: boolean;
  className?: string;
}) {
  // `text` 控制展示值，复制仍使用原始 `value`。
  const text = short ? shortenHash(value, 10, 8) : value;

  return (
    <div className={className ?? "flex min-w-0 items-start gap-1.5"}>
      {href ? (
        <Link
          href={href}
          className="value-wrap min-w-0 flex-1 font-mono text-xs text-slate-800 underline-offset-4 hover:text-slate-950 hover:underline"
        >
          {text}
        </Link>
      ) : (
        <span className="value-wrap min-w-0 flex-1 font-mono text-xs text-slate-800">
          {text}
        </span>
      )}
      <CopyButton value={value} className="h-6 w-6 shrink-0" />
    </div>
  );
}
