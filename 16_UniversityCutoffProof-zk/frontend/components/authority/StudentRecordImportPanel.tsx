import { ChangeEvent, useRef } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { buttonClassName } from "@/components/shared/Button";
import type { ScoreSourceDraft } from "@/types/admission";

export function StudentRecordImportPanel({
  draft,
  importing,
  onSelectFile,
  onLoadDemo
}: {
  draft: ScoreSourceDraft | null;
  importing: boolean;
  onSelectFile: (file: File) => void;
  onLoadDemo: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onSelectFile(file);
    event.target.value = "";
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">导入本届成绩</h2>
          <p className="mt-1 text-sm text-slate-500">请先上传考试院整理好的本届成绩文件，再继续后面的发放与发布流程。</p>
        </div>
        <div className="flex gap-2">
          {draft ? (
            <button
              type="button"
              className={buttonClassName("outline", "md")}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "上传中..." : "重新上传成绩"}
            </button>
          ) : null}
          <button
            type="button"
            className={buttonClassName("outline", "md")}
            onClick={onLoadDemo}
            disabled={importing}
          >
            {importing ? "导入中..." : "导入演示数据"}
          </button>
          <Link href="/templates/score-import-template.json" className={buttonClassName("outline", "md")}>
            下载导入模板
          </Link>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleChange}
      />

      {!draft ? (
        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-blue-300 hover:bg-blue-50">
          <Upload className="h-8 w-8 text-slate-400" />
          <div className="mt-4 text-base font-medium text-slate-900">
            {importing ? "正在读取成绩文件..." : "上传成绩文件"}
          </div>
          <div className="mt-2 text-sm text-slate-500">文件中需包含本届成绩信息和学生记录。</div>
        </label>
      ) : null}

      {draft ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            当前已经载入一份本届成绩。如需替换，请点击右上角“重新上传成绩”。
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="成绩批次" value={draft.sourceTitle} />
            <Stat label="记录数" value={draft.records.length} />
            <Stat label="总分" value={draft.maxScore} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
