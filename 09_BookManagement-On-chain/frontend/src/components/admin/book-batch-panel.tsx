import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DemoBook } from "@/components/admin/types";

// 批量上链确认弹窗展示项：仅保留管理员确认时真正关心的信息。
export type BatchConfirmItem = {
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  totalCopies: number;
};

// 批量上架面板参数
type BookBatchPanelProps = {
  drafts: DemoBook[];
  status: string;
  onAdd: () => void;
  onClear: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<DemoBook>) => void;
  onSubmitRequest: () => void;
  onConfirmSubmit: () => void;
  onCancelConfirm: () => void;
  confirmItems: BatchConfirmItem[];
  isConfirmOpen: boolean;
  isBusy: boolean;
};

// 批量上架 UI：维护清单并一次性上链
export function BookBatchPanel({
  drafts,
  status,
  onAdd,
  onClear,
  onRemove,
  onUpdate,
  onSubmitRequest,
  onConfirmSubmit,
  onCancelConfirm,
  confirmItems,
  isConfirmOpen,
  isBusy,
}: BookBatchPanelProps) {
  return (
    <>
      <Card className="px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">批量上架清单</h3>
            <p className="text-xs text-muted-foreground">先整理清单，再一次性提交上链。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onAdd} disabled={isBusy}>
              新增书目
            </Button>
            <Button type="button" variant="destructive" onClick={onClear} disabled={isBusy || drafts.length === 0}>
              清空清单
            </Button>
            <Button type="button" onClick={onSubmitRequest} disabled={isBusy}>
              一键批量上链
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>当前清单：{drafts.length} 本</span>
          <span>批量上链仅需一次签名</span>
        </div>
        {status && <p className="mt-2 text-xs text-primary">当前状态：{status}</p>}

        {drafts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            尚未添加书目。点击“新增书目”或上方“一键填入20条世界名著”开始编辑。
          </div>
        ) : (
          // 清单编辑区：支持逐条维护并展开编辑简介/借阅规则。
          <div className="mt-4 space-y-3">
            {drafts.map((book, index) => (
              <div key={`${book.title}-${index}`} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">书目 {index + 1}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="text-destructive"
                    onClick={() => onRemove(index)}
                  >
                    移除
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.7fr]">
                  <Input
                    placeholder="书名"
                    value={book.title}
                    onChange={(event) => onUpdate(index, { title: event.target.value })}
                  />
                  <Input
                    placeholder="作者"
                    value={book.author}
                    onChange={(event) => onUpdate(index, { author: event.target.value })}
                  />
                  <Input
                    placeholder="ISBN（可选）"
                    value={book.isbn ?? ""}
                    onChange={(event) => onUpdate(index, { isbn: event.target.value })}
                  />
                  <Input
                    placeholder="分类（可选）"
                    value={book.category ?? ""}
                    onChange={(event) => onUpdate(index, { category: event.target.value })}
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="库存"
                    value={book.totalCopies}
                    onChange={(event) => onUpdate(index, { totalCopies: event.target.value })}
                  />
                </div>
                <details className="mt-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">
                    填写简介（必填）与借阅规则（可选）
                  </summary>
                  <div className="mt-3 space-y-3">
                    <Textarea
                      className="min-h-[96px]"
                      placeholder="书籍简介（用于检索与展示）"
                      value={book.summary}
                      onChange={(event) => onUpdate(index, { summary: event.target.value })}
                    />
                    <Textarea
                      className="min-h-[80px]"
                      placeholder="借阅规则说明（可选）"
                      value={book.policy ?? ""}
                      onChange={(event) => onUpdate(index, { policy: event.target.value })}
                    />
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isConfirmOpen && (
        // 提交前二次确认：避免批量误操作直接上链。
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-foreground">确认批量上链</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                本次将上链 {confirmItems.length} 本书。提交后书籍信息不可编辑，仅可执行上/下架与库存调整。
              </p>
            <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-[11px] font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">书名</th>
                    <th className="px-3 py-3">作者</th>
                    <th className="px-3 py-3">ISBN</th>
                    <th className="px-3 py-3">分类</th>
                    <th className="px-3 py-3">库存</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {confirmItems.map((item, index) => (
                    <tr key={`${item.title}-${item.author}-${index}`}>
                      <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-3 font-medium text-foreground">{item.title}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.author}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.isbn || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.category || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.totalCopies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancelConfirm} disabled={isBusy}>
                返回检查
              </Button>
              <Button type="button" onClick={onConfirmSubmit} disabled={isBusy}>
                确认并提交上链
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
