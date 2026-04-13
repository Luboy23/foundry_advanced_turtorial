import { useMemo, useState } from "react";
import { Button } from "@/components/shared/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AdmissionCredential } from "@/types/credential";
import type { AuthorityIssuanceRecord } from "@/types/history";

export function CredentialIssuancePanel({
  credentials,
  onIssue,
  onIssueAll
}: {
  credentials: AdmissionCredential[];
  onIssue: (credential: AdmissionCredential) => void;
  onIssueAll: () => void;
}) {
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  const selectedCredential = useMemo(
    () => credentials.find((credential) => credential.candidateLabel === selectedLabel) ?? null,
    [credentials, selectedLabel]
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">生成并导出学生成绩凭证</h2>
          <p className="mt-1 text-sm text-slate-500">根据刚导入的本届成绩，为学生导出可使用的成绩凭证文件。</p>
        </div>
        <StatusBadge label={`${credentials.length} 条可发放记录`} tone={credentials.length ? "info" : "warning"} />
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">选择学生记录</label>
          <select
            value={selectedLabel}
            onChange={(event) => setSelectedLabel(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
          >
            <option value="">请选择学生</option>
            {credentials.map((credential) => (
              <option key={credential.candidateLabel} value={credential.candidateLabel}>
                {credential.candidateLabel} · {credential.score} 分
              </option>
            ))}
          </select>
        </div>

        {selectedCredential ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
            <div>学生：{selectedCredential.candidateLabel}</div>
            <div className="mt-1">成绩：{selectedCredential.score} / {selectedCredential.maxScore}</div>
            <div className="mt-1 break-all text-xs text-slate-500">绑定学生钱包：{selectedCredential.boundStudentAddress}</div>
            <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-700">查看详细信息</summary>
              <div className="mt-3 break-all font-mono">scoreSourceIdBytes32: {selectedCredential.scoreSourceIdBytes32}</div>
              <div className="mt-2 break-all font-mono">boundStudentField: {selectedCredential.boundStudentField}</div>
            </details>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button disabled={!selectedCredential} onClick={() => selectedCredential && onIssue(selectedCredential)}>
            导出当前学生凭证
          </Button>
          <Button variant="outline" disabled={!credentials.length} onClick={onIssueAll}>
            导出全部学生凭证
          </Button>
        </div>
      </div>
    </section>
  );
}

export function AuthorityIssuanceRecordList({
  records
}: {
  records: AuthorityIssuanceRecord[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">本地发放记录</h2>
          <p className="mt-1 text-sm text-slate-500">这里只记录当前浏览器导出过哪些学生凭证，未上链。</p>
        </div>
        <StatusBadge label={`${records.length} 条`} tone="info" />
      </div>

      {records.length ? (
        <div className="mt-5 space-y-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-slate-900">{record.candidateLabel}</div>
              <div className="mt-1 text-slate-500">{record.scoreSourceIdLabel} · {record.score} 分</div>
              <div className="mt-2 text-xs text-slate-500">{record.fileName}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          暂无发放记录
        </div>
      )}
    </section>
  );
}
