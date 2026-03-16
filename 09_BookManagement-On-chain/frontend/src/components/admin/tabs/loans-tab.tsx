import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { shortenHex } from "@/lib/format";
import type { RegisteredReader, RegistryBook, RegistryBorrowRecord } from "@/lib/registry";

// 借阅台账 Tab：聚焦借还登记与台账审计。
// 借还动作枚举：与合约 borrowBook/returnBook 对应。
type LoanAction = "borrow" | "return";

type LoanForm = {
  reader: string;
  bookId: string;
  action: LoanAction;
};

type LoanOption = {
  value: string;
  label: string;
};

// 借阅台账 Tab 输入：父级负责读写链与筛选计算，本组件聚焦交互渲染。
type LoansTabProps = {
  loanForm: LoanForm;
  onLoanFormChange: (patch: Partial<LoanForm>) => void;
  onSubmitLoan: () => void;
  canWrite: boolean;
  isWriteBusy: boolean;
  readerOptionList: LoanOption[];
  bookOptionList: LoanOption[];
  readersLoading: boolean;
  booksLoading: boolean;
  loanSearchReader: string;
  onLoanSearchReaderChange: (value: string) => void;
  loanSearchBook: string;
  onLoanSearchBookChange: (value: string) => void;
  loanSearchAction: "all" | LoanAction;
  onLoanSearchActionChange: (value: "all" | LoanAction) => void;
  loanDateFrom: string;
  onLoanDateFromChange: (value: string) => void;
  loanDateTo: string;
  onLoanDateToChange: (value: string) => void;
  onRefreshRecords: () => void;
  onLoadMoreRecords: () => void;
  hasMoreRecords: boolean;
  recordsError: string;
  recordsLoading: boolean;
  filteredRecords: RegistryBorrowRecord[];
  readers: RegisteredReader[];
  books: RegistryBook[];
  toBookLabel: (book: RegistryBook) => string;
  bookLabelMap: Map<string, string>;
};

// 借阅台账 Tab：包含借还登记表单与可筛选流水表。
export function LoansTab({
  loanForm,
  onLoanFormChange,
  onSubmitLoan,
  canWrite,
  isWriteBusy,
  readerOptionList,
  bookOptionList,
  readersLoading,
  booksLoading,
  loanSearchReader,
  onLoanSearchReaderChange,
  loanSearchBook,
  onLoanSearchBookChange,
  loanSearchAction,
  onLoanSearchActionChange,
  loanDateFrom,
  onLoanDateFromChange,
  loanDateTo,
  onLoanDateToChange,
  onRefreshRecords,
  onLoadMoreRecords,
  hasMoreRecords,
  recordsError,
  recordsLoading,
  filteredRecords,
  readers,
  books,
  toBookLabel,
  bookLabelMap,
}: LoansTabProps) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        {/* 借还登记区：馆员选择读者、书籍与动作后提交链上登记 */}
        <h3 className="text-lg font-semibold text-foreground">借还登记</h3>
        <p className="mt-1 text-xs text-muted-foreground">馆员录入借阅/归还，系统会执行链上库存与状态校验。</p>
        {/* 三个下拉 + 一个提交按钮构成最小借还登记单元 */}
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Select
            value={loanForm.reader}
            onValueChange={(value) => onLoanFormChange({ reader: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={readersLoading ? "加载读者中" : "选择读者"} />
            </SelectTrigger>
            <SelectContent>
              {readerOptionList.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={loanForm.bookId}
            onValueChange={(value) => onLoanFormChange({ bookId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={booksLoading ? "加载书籍中" : "选择书籍"} />
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
            value={loanForm.action}
            onValueChange={(value) => onLoanFormChange({ action: value as LoanAction })}
          >
            <SelectTrigger>
              <SelectValue placeholder="动作" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="borrow">借阅</SelectItem>
              <SelectItem value="return">归还</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" onClick={onSubmitLoan} disabled={!canWrite || isWriteBusy}>
            提交登记
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-foreground">借阅流水</h3>
          {/* 多维筛选：读者、书籍、动作、日期区间 */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={loanSearchReader} onValueChange={onLoanSearchReaderChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="读者筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部读者</SelectItem>
                {readers.map((reader) => (
                  <SelectItem key={reader.reader} value={reader.reader}>
                    {shortenHex(reader.reader, 10, 6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={loanSearchBook} onValueChange={onLoanSearchBookChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="书籍筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部书籍</SelectItem>
                {books.map((book) => (
                  <SelectItem key={book.id.toString()} value={book.id.toString()}>
                    #{book.id.toString()} {toBookLabel(book)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={loanSearchAction}
              onValueChange={(value) => onLoanSearchActionChange(value as "all" | LoanAction)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="动作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部动作</SelectItem>
                <SelectItem value="borrow">借阅</SelectItem>
                <SelectItem value="return">归还</SelectItem>
              </SelectContent>
            </Select>

            <Input type="date" value={loanDateFrom} onChange={(event) => onLoanDateFromChange(event.target.value)} />
            <Input type="date" value={loanDateTo} onChange={(event) => onLoanDateToChange(event.target.value)} />
            {/* 手动刷新与分页加载并存，适配不同网络与教学演示节奏 */}
            <Button type="button" variant="outline" onClick={onRefreshRecords}>
              刷新
            </Button>
            <Button type="button" variant="outline" onClick={onLoadMoreRecords} disabled={!hasMoreRecords}>
              {hasMoreRecords ? "加载更多" : "已加载全部"}
            </Button>
          </div>
        </div>

        {recordsError && <p className="mt-2 text-xs text-destructive">读取失败：{recordsError}</p>}

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {/* 流水展示遵循“最新优先”顺序，便于核对最近一次登记动作 */}
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">读者</th>
                <th className="px-3 py-2">书籍</th>
                <th className="px-3 py-2">动作</th>
                <th className="px-3 py-2">操作人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {/* 当筛选条件过严导致结果为空时，给出“暂无匹配流水”反馈 */}
              {filteredRecords.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground" colSpan={6}>
                    {recordsLoading ? "加载中..." : "暂无匹配流水"}
                  </td>
                </tr>
              )}
              {filteredRecords.map((record) => (
                // 书籍列优先显示名称，缺失映射时回退显示图书编号。
                <tr key={record.id.toString()}>
                  <td className="px-3 py-2 font-semibold text-foreground">#{record.id.toString()}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(Number(record.timestamp) * 1000).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {shortenHex(record.reader, 10, 6)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {bookLabelMap.get(record.bookId.toString()) ?? `图书 #${record.bookId.toString()}`}
                  </td>
                  <td className="px-3 py-2 text-foreground">{record.isBorrow ? "借阅" : "归还"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {shortenHex(record.operator, 10, 6)}
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
