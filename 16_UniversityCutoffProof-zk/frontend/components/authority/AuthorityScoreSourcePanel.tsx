import { CalendarDays, Database, FileOutput } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import type { ScoreSourceDraft } from "@/types/admission";

type CurrentSourceView = {
  sourceTitle: string;
  scoreSourceIdLabel: string;
  maxScore?: number;
  issuedAt?: number;
  isPublished: boolean;
};

export function AuthorityScoreSourcePanel({
  currentSource,
  draft,
  onPublish,
  publishing,
  canPublish,
  publishDisabledReason
}: {
  currentSource: CurrentSourceView | null;
  draft: ScoreSourceDraft | null;
  onPublish: () => void;
  publishing: boolean;
  canPublish: boolean;
  publishDisabledReason: string | null;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">本届成绩源</h2>
          <p className="mt-1 text-sm text-slate-500">先导入本届成绩，再将本届成绩正式发布给大学和学生使用。</p>
        </div>
        {currentSource?.isPublished ? <StatusBadge label="已发布" tone="success" /> : <StatusBadge label="尚未发布" tone="warning" />}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InfoTile icon={Database} label="成绩批次" value={draft?.sourceTitle ?? currentSource?.sourceTitle ?? "未准备"} />
        <InfoTile icon={FileOutput} label="成绩源编号" value={draft?.scoreSourceIdLabel ?? currentSource?.scoreSourceIdLabel ?? "未准备"} />
        <InfoTile
          icon={CalendarDays}
          label="发布时间"
          value={currentSource?.isPublished && currentSource.issuedAt ? formatDateTime(currentSource.issuedAt) : "等待发布"}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 text-sm text-slate-500">
          <div>已导入记录数：{draft?.records.length ?? 0}</div>
          <div>总分上限：{draft?.maxScore ?? currentSource?.maxScore ?? "-"}</div>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <Button onClick={onPublish} disabled={!canPublish || publishing}>
            {publishing ? "正在发布成绩源..." : "发布成绩源"}
          </Button>
          {publishDisabledReason ? <p className="text-xs text-slate-500">{publishDisabledReason}</p> : null}
        </div>
      </div>
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Database;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 break-all text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
