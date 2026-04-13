import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonClassName } from "@/components/shared/Button";

export function RoleEntryCard({
  title,
  description,
  href,
  actionLabel,
  icon: Icon,
  iconTone,
  disabled = false,
  disabledReason
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: LucideIcon;
  iconTone: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      <div className={`mb-5 inline-flex rounded-2xl p-3 ${iconTone}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{description}</p>
      <Link
        href={disabled ? "#" : href}
        aria-disabled={disabled}
        className={`${buttonClassName("secondary", "lg")} mt-8 w-full ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        {actionLabel}
      </Link>
      {disabledReason ? <p className="mt-3 text-xs text-slate-500">{disabledReason}</p> : null}
    </div>
  );
}
