import type { ReactNode } from "react";
import { AlertCircle, Info, LoaderCircle, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
      <PackageOpen className="h-8 w-8 text-slate-400" />
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-14 text-center">
      <AlertCircle className="h-8 w-8 text-rose-600" />
      <h3 className="mt-4 text-base font-semibold text-rose-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-rose-700">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function InfoNotice({
  title,
  description,
  tone = "info"
}: {
  title: string;
  description: string;
  tone?: "info" | "warning" | "success";
}) {
  const tones = {
    info: "border-blue-100 bg-blue-50 text-blue-900",
    warning: "border-amber-100 bg-amber-50 text-amber-900",
    success: "border-emerald-100 bg-emerald-50 text-emerald-900"
  };

  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <div className="flex gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm opacity-85">{description}</p>
        </div>
      </div>
    </div>
  );
}
