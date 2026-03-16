import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortenHex } from "@/lib/format";
import type { RegistryBorrowRecord } from "@/lib/registry";

// 仪表盘数据输入：由管理页统一聚合后透传，组件本身只负责展示。
type DashboardTabProps = {
  // 馆藏加载量（当前前端已加载）与链上总量（全局）。
  loadedBookCount: number;
  bookCount: number;
  // 汇总指标由父级计算，避免该组件重复做业务运算。
  metrics: {
    loadedTotal: number;
    loadedAvailable: number;
    loadedBorrowing: number;
    activeReaderCount: number;
  };
  readersCount: number;
  activeBorrowCount: number;
  latestRecords: RegistryBorrowRecord[];
  bookLabelMap: Map<string, string>;
  onRefreshRecords: () => void;
};

// 仪表盘 Tab：展示核心业务指标与最近借阅流水，帮助馆员快速判断当前状态。
export function DashboardTab({
  loadedBookCount,
  bookCount,
  metrics,
  readersCount,
  activeBorrowCount,
  latestRecords,
  bookLabelMap,
  onRefreshRecords,
}: DashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* 核心指标区：同时展示链上总量与当前加载视图下的估算值 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">馆藏总数（当前已加载）</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{loadedBookCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">链上总计：{bookCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">可借副本（当前已加载）</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{metrics.loadedAvailable}</p>
          <p className="mt-1 text-xs text-muted-foreground">总副本：{metrics.loadedTotal}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">在借数量（链上）</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeBorrowCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">已加载估算：{metrics.loadedBorrowing}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">启用读者</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{metrics.activeReaderCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">注册总数：{readersCount}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">近期借阅动态</h3>
          <Button type="button" size="sm" variant="outline" onClick={onRefreshRecords}>
            刷新
          </Button>
        </div>
        {/* 最近流水固定按时间倒序展示，便于现场演示快速核验借还动作 */}
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">读者</th>
                <th className="px-3 py-2">书籍</th>
                <th className="px-3 py-2">动作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {/* 空状态单独占位，避免表格高度跳变 */}
              {latestRecords.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground" colSpan={4}>
                    暂无借阅记录
                  </td>
                </tr>
              )}
              {latestRecords.map((record) => (
                // 直接展示最近记录，便于馆员核对“刚提交”的借还动作。
                <tr key={record.id.toString()}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
