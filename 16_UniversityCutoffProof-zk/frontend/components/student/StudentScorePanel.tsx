import { Badge } from "@/components/shared/Badge";
import type { AdmissionCredential } from "@/types/credential";

export function StudentScorePanel({
  credential,
  publishedSourceTitle,
  fileName
}: {
  credential: AdmissionCredential | null;
  publishedSourceTitle: string | null;
  fileName: string | null;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">当前成绩</h2>
          <p className="mt-1 text-sm text-slate-500">查看当前成绩、成绩来源和凭证状态。</p>
        </div>
        <Badge variant={credential ? "success" : "warning"}>{credential ? "成绩凭证已载入" : "尚未载入成绩凭证"}</Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Tile label="成绩" value={credential ? `${credential.score} / ${credential.maxScore}` : "未载入"} />
        <Tile label="本届成绩批次" value={publishedSourceTitle ?? credential?.scoreSourceTitle ?? "尚未发布"} />
        <Tile label="成绩凭证文件" value={fileName ?? "未载入"} mono={Boolean(fileName)} />
      </div>
    </section>
  );
}

function Tile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-2 break-all text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
