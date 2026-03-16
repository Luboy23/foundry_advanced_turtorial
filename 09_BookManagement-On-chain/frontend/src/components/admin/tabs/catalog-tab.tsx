import { BookBatchPanel, type BatchConfirmItem } from "@/components/admin/book-batch-panel";
import type { DemoBook } from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shortenHex } from "@/lib/format";
import type { RegistryBook } from "@/lib/registry";

// 馆藏管理 Tab：负责“书籍生命周期”相关的全部后台交互视图。
// 馆藏新增表单（单本）输入模型。
type BookForm = {
  title: string;
  author: string;
  isbn: string;
  category: string;
  summary: string;
  policy: string;
  totalCopies: string;
};

type ActiveForm = {
  bookId: string;
  active: boolean;
};

type InventoryForm = {
  bookId: string;
  totalCopies: string;
};

type BookOption = {
  value: string;
  label: string;
  active: boolean;
};

// 馆藏 Tab 的全部回调由父级统一提供，便于将写链逻辑与展示逻辑解耦。
type CatalogTabProps = {
  // 新增单本
  bookForm: BookForm;
  onBookFormChange: (patch: Partial<BookForm>) => void;
  onRegisterBook: () => void;
  canWrite: boolean;
  isWriteBusy: boolean;
  onFillWorldClassics: () => void;
  batchDrafts: DemoBook[];
  batchStatus: string;
  onAddBatchDraft: () => void;
  onClearBatchDrafts: () => void;
  onRemoveBatchDraft: (index: number) => void;
  onUpdateBatchDraft: (index: number, patch: Partial<DemoBook>) => void;
  onRequestBatchSubmit: () => void;
  onConfirmBatchSubmit: () => void;
  onCancelBatchSubmit: () => void;
  isBatchConfirmOpen: boolean;
  batchConfirmItems: BatchConfirmItem[];
  activeForm: ActiveForm;
  onActiveFormChange: (patch: Partial<ActiveForm>) => void;
  onSetBookActive: () => void;
  inventoryForm: InventoryForm;
  onInventoryFormChange: (patch: Partial<InventoryForm>) => void;
  onInventoryBookChange: (bookId: string) => void;
  onSetInventory: () => void;
  bookOptionList: BookOption[];
  bookSearch: string;
  onBookSearchChange: (value: string) => void;
  onLoadMoreBooks: () => void;
  hasMoreBooks: boolean;
  isLoadingMoreBooks: boolean;
  booksLoading: boolean;
  booksError: string;
  filteredBooks: RegistryBook[];
  toBookLabel: (book: RegistryBook) => string;
};

// 馆藏管理 Tab：覆盖新增、批量上架、状态切换、库存调整与明细检索。
export function CatalogTab({
  bookForm,
  onBookFormChange,
  onRegisterBook,
  canWrite,
  isWriteBusy,
  onFillWorldClassics,
  batchDrafts,
  batchStatus,
  onAddBatchDraft,
  onClearBatchDrafts,
  onRemoveBatchDraft,
  onUpdateBatchDraft,
  onRequestBatchSubmit,
  onConfirmBatchSubmit,
  onCancelBatchSubmit,
  isBatchConfirmOpen,
  batchConfirmItems,
  activeForm,
  onActiveFormChange,
  onSetBookActive,
  inventoryForm,
  onInventoryFormChange,
  onInventoryBookChange,
  onSetInventory,
  bookOptionList,
  bookSearch,
  onBookSearchChange,
  onLoadMoreBooks,
  hasMoreBooks,
  isLoadingMoreBooks,
  booksLoading,
  booksError,
  filteredBooks,
  toBookLabel,
}: CatalogTabProps) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        {/* 单本上架区：用于教学时演示最小上架路径 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">新增馆藏</h3>
          <Button type="button" variant="outline" onClick={onFillWorldClassics} disabled={isWriteBusy}>
            一键填入20条世界名著
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">新增书籍摘要并录入库存，写入链上后可用于借阅登记。</p>
        {/* 基础元数据输入：写链前由父级做字段完整性与长度校验 */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            placeholder="书名"
            value={bookForm.title}
            onChange={(event) => onBookFormChange({ title: event.target.value })}
          />
          <Input
            placeholder="作者"
            value={bookForm.author}
            onChange={(event) => onBookFormChange({ author: event.target.value })}
          />
          <Input
            placeholder="ISBN（可选）"
            value={bookForm.isbn}
            onChange={(event) => onBookFormChange({ isbn: event.target.value })}
          />
          <Input
            placeholder="分类（可选）"
            value={bookForm.category}
            onChange={(event) => onBookFormChange({ category: event.target.value })}
          />
          <Input
            placeholder="库存总量"
            value={bookForm.totalCopies}
            onChange={(event) => onBookFormChange({ totalCopies: event.target.value })}
          />
        </div>
        <Textarea
          className="mt-3 min-h-[100px]"
          placeholder="书籍简介（必填）"
          value={bookForm.summary}
          onChange={(event) => onBookFormChange({ summary: event.target.value })}
        />
        <Textarea
          className="mt-3 min-h-[80px]"
          placeholder="借阅规则（可选）"
          value={bookForm.policy}
          onChange={(event) => onBookFormChange({ policy: event.target.value })}
        />
        <div className="mt-3 flex justify-end">
          {/* canWrite + isWriteBusy 双条件防止越权或重复提交 */}
          <Button type="button" onClick={onRegisterBook} disabled={!canWrite || isWriteBusy}>
            上架并提交
          </Button>
        </div>
      </Card>

      <BookBatchPanel
        drafts={batchDrafts}
        status={batchStatus}
        onAdd={onAddBatchDraft}
        onClear={onClearBatchDrafts}
        onRemove={onRemoveBatchDraft}
        onUpdate={onUpdateBatchDraft}
        onSubmitRequest={onRequestBatchSubmit}
        onConfirmSubmit={onConfirmBatchSubmit}
        onCancelConfirm={onCancelBatchSubmit}
        confirmItems={batchConfirmItems}
        isConfirmOpen={isBatchConfirmOpen}
        isBusy={isWriteBusy}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          {/* 上下架状态切换：不改元数据，仅改借阅可见性 */}
          <h3 className="text-lg font-semibold text-foreground">状态管理</h3>
          <div className="mt-3 space-y-3">
            <Select
              value={activeForm.bookId}
              onValueChange={(value) => onActiveFormChange({ bookId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择书籍" />
              </SelectTrigger>
              <SelectContent>
                {bookOptionList.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={activeForm.active ? "active" : "inactive"}
              onValueChange={(value) => onActiveFormChange({ active: value === "active" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">上架</SelectItem>
                <SelectItem value="inactive">下架</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" onClick={onSetBookActive} disabled={!canWrite || isWriteBusy}>
              更新状态
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          {/* 库存调整会触发链上库存规则校验（不可低于在借数量） */}
          <h3 className="text-lg font-semibold text-foreground">库存调整</h3>
          <div className="mt-3 space-y-3">
            <Select value={inventoryForm.bookId} onValueChange={onInventoryBookChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择书籍" />
              </SelectTrigger>
              <SelectContent>
                {bookOptionList.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="新的总库存"
              value={inventoryForm.totalCopies}
              onChange={(event) => onInventoryFormChange({ totalCopies: event.target.value })}
            />
            <Button type="button" onClick={onSetInventory} disabled={!canWrite || isWriteBusy}>
              提交库存调整
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-foreground">馆藏明细</h3>
          {/* 明细区支持本地关键词过滤与分页加载，避免一次性渲染全量书籍 */}
          <div className="flex items-center gap-2">
            <Input
              className="w-64"
              placeholder="按书名/作者/图书编号搜索"
              value={bookSearch}
              onChange={(event) => onBookSearchChange(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={onLoadMoreBooks} disabled={!hasMoreBooks || isLoadingMoreBooks}>
              {isLoadingMoreBooks ? "加载中" : hasMoreBooks ? "加载更多" : "已加载全部"}
            </Button>
          </div>
        </div>

        {booksError && (
          <p className="mt-3 text-xs text-destructive">读取失败：{booksError}</p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">图书编号</th>
                <th className="px-3 py-2">书籍</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">库存</th>
                <th className="px-3 py-2">Meta Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {/* 空状态与加载态合并到首行提示，减少闪屏 */}
              {filteredBooks.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                    {booksLoading ? "加载中..." : "暂无匹配书籍"}
                  </td>
                </tr>
              )}
              {filteredBooks.map((book) => (
                // 状态色只体现上架可见性，不代表库存健康度。
                <tr key={book.id.toString()}>
                  <td className="px-3 py-2 font-semibold text-foreground">#{book.id.toString()}</td>
                  <td className="px-3 py-2 text-foreground">{toBookLabel(book)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        book.active
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-zinc-500/15 text-zinc-700"
                      }`}
                    >
                      {book.active ? "上架" : "下架"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {book.availableCopies.toString()} / {book.totalCopies.toString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {shortenHex(book.metaHash, 10, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
