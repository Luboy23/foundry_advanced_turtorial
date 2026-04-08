"use client";

import { useMemo } from "react";

import {
  AddressActions,
  formatAddress,
  PanelEmptyState,
  PanelNotesSection,
  PanelPagination,
  PanelStatCard,
} from "@/components/PaginatedPanelShared";
import { Badge } from "@/components/ui/badge";
import { getResolvedRuntimeConfig } from "@/constants";
import { getAddressExplorerUrl } from "@/lib/explorer";
import { PAGE_SIZE, getTotalPages } from "@/lib/pagination";
import {
  getProjectScoreClass,
} from "@/lib/projectTheme";
import { formatCancelSummary, formatScoringSummary } from "@/lib/rulesConfig";
import { useGameStore } from "@/store/useGameStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatEndedAt = (endedAt: bigint) =>
  new Date(Number(endedAt) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });

// 历史战绩面板：增加摘要区，并兼容桌面表格与移动端卡片布局。
export default function GameHistoryPanel() {
  const {
    historyRecords,
    isHistoryLoading,
    historyPage,
    historyTotal,
    fetchMyHistory,
    createGame,
    setShowGameList,
    setShowHistoryDialog,
    networkMismatch,
    rulesMeta,
  } = useGameStore();
  const runtimeChainId = getResolvedRuntimeConfig().chainId;
  const totalPages = useMemo(
    () => getTotalPages(historyTotal, PAGE_SIZE),
    [historyTotal]
  );
  const scoringSummary = formatScoringSummary(rulesMeta.scoring);
  const cancelSummary = formatCancelSummary(rulesMeta.scoring);

  const pageStats = useMemo(() => {
    const wins = historyRecords.filter((record) => record.result === "WIN").length;
    const draws = historyRecords.filter((record) => record.result === "DRAW").length;
    const losses = historyRecords.filter((record) => record.result === "LOSS").length;
    const latest = historyRecords[0];
    return { wins, draws, losses, latest };
  }, [historyRecords]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanelStatCard label="历史总局数" value={historyTotal} emphasis="strong" />
        <PanelStatCard
          label="当前页战绩"
          value={`胜 ${pageStats.wins} / 平 ${pageStats.draws} / 负 ${pageStats.losses}`}
        />
        <PanelStatCard
          label={historyPage === 1 ? "最近一局结果" : "当前页首局"}
          value={
            pageStats.latest
              ? `${pageStats.latest.result === "WIN" ? "胜" : pageStats.latest.result === "DRAW" ? "平" : "负"} · #${pageStats.latest.gameId.toString()}`
              : "--"
          }
        />
        <PanelStatCard label="计分摘要" value={scoringSummary} />
      </div>

      <PanelNotesSection
        lines={[
          scoringSummary,
          `${cancelSummary}；仅双方参与且已结束的有效对局计入历史成绩。`,
        ]}
      />

      {isHistoryLoading && historyRecords.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">正在加载战绩记录…</div>
      ) : historyTotal === 0 ? (
        <PanelEmptyState
          title="暂无战绩记录"
          primaryLabel="去创建首局"
          secondaryLabel="去加入对局"
          onPrimary={() => void createGame()}
          onSecondary={() => {
            setShowHistoryDialog(false);
            setShowGameList(true);
          }}
          primaryDisabled={networkMismatch}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">对局ID</TableHead>
                  <TableHead>对手</TableHead>
                  <TableHead>结果</TableHead>
                  <TableHead>分数变化</TableHead>
                  <TableHead>结束时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRecords.map((record) => {
                  const explorerUrl = getAddressExplorerUrl(runtimeChainId, record.opponent);
                  return (
                    <TableRow
                      key={`${record.gameId.toString()}-${record.endedAt.toString()}`}
                    >
                      <TableCell>{record.gameId.toString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="font-medium text-primary/90">
                            {formatAddress(record.opponent)}
                          </div>
                          <AddressActions
                            address={record.opponent}
                            explorerUrl={explorerUrl}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.result === "WIN" ? (
                          <Badge variant="default">胜</Badge>
                        ) : record.result === "DRAW" ? (
                          <Badge variant="secondary">平</Badge>
                        ) : (
                          <Badge variant="destructive">负</Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={getProjectScoreClass(record.scoreDelta)}
                      >
                        {record.scoreDelta > 0 ? `+${record.scoreDelta}` : record.scoreDelta}
                      </TableCell>
                      <TableCell>{formatEndedAt(record.endedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {historyRecords.map((record) => {
              const explorerUrl = getAddressExplorerUrl(runtimeChainId, record.opponent);
              return (
                <div
                  key={`${record.gameId.toString()}-${record.endedAt.toString()}`}
                  className="rounded-2xl border border-primary/15 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-primary">
                        对局 #{record.gameId.toString()}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        结束时间：{formatEndedAt(record.endedAt)}
                      </p>
                    </div>
                    {record.result === "WIN" ? (
                      <Badge variant="default">胜</Badge>
                    ) : record.result === "DRAW" ? (
                      <Badge variant="secondary">平</Badge>
                    ) : (
                      <Badge variant="destructive">负</Badge>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-primary/15 bg-white p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary/60">
                        对手
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-medium text-primary/85">
                          {formatAddress(record.opponent)}
                        </p>
                        <AddressActions
                          address={record.opponent}
                          explorerUrl={explorerUrl}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-primary/15 bg-white p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary/60">
                        分数变化
                      </p>
                      <p className={`mt-2 text-lg font-semibold ${getProjectScoreClass(record.scoreDelta)}`}>
                        {record.scoreDelta > 0 ? `+${record.scoreDelta}` : record.scoreDelta}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <PanelPagination
        currentPage={historyPage}
        totalPages={totalPages}
        totalLabel={`共 ${historyTotal} 局`}
        isLoading={isHistoryLoading}
        onPrevious={() => void fetchMyHistory(historyPage - 1)}
        onNext={() => void fetchMyHistory(historyPage + 1)}
      />
    </div>
  );
}
