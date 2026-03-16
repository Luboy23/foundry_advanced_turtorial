import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortenHex } from "@/lib/format";
import type { RegisteredReader } from "@/lib/registry";

// 读者管理 Tab：链上 ReaderState 的后台可视化与启停入口。
// 读者管理 Tab 输入：由父级传入读者列表与状态切换回调。
type ReadersTabProps = {
  readers: RegisteredReader[];
  readersLoading: boolean;
  readersError: string;
  canWrite: boolean;
  isWriteBusy: boolean;
  onRefreshReaders: () => void;
  onToggleReader: (reader: `0x${string}`, active: boolean) => void;
};

// 读者管理 Tab：用于启停注册读者，控制其后续借阅资格。
export function ReadersTab({
  readers,
  readersLoading,
  readersError,
  canWrite,
  isWriteBusy,
  onRefreshReaders,
  onToggleReader,
}: ReadersTabProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">读者状态管理</h3>
        <Button type="button" variant="outline" onClick={onRefreshReaders}>
          刷新
        </Button>
      </div>
      {readersError && <p className="mt-2 text-xs text-destructive">读取失败：{readersError}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        {/* 读者地址 + 注册时间 + 状态 + 启停按钮四列是馆员最常用的运维视图 */}
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/60 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">读者地址</th>
              <th className="px-3 py-2">注册时间</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {/* 读者为空时优先提示空数据，而不是渲染空白表格 */}
            {readers.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={4}>
                  {readersLoading ? "加载中..." : "暂无注册读者"}
                </td>
              </tr>
            )}
            {readers.map((reader) => (
              // 启停按钮实际写链动作由父级 onToggleReader 统一处理。
              <tr key={reader.reader}>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {shortenHex(reader.reader, 14, 10)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {reader.registeredAt > BigInt(0)
                    ? new Date(Number(reader.registeredAt) * 1000).toLocaleString()
                    : "--"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                      reader.active
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-zinc-500/15 text-zinc-700"
                    }`}
                  >
                    {reader.active ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Button
                    size="sm"
                    type="button"
                    variant={reader.active ? "outline" : "default"}
                    disabled={!canWrite || isWriteBusy}
                    onClick={() => onToggleReader(reader.reader, !reader.active)}
                  >
                    {reader.active ? "停用" : "启用"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
