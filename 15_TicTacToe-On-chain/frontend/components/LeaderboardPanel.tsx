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
import { Button } from "@/components/ui/button";
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
const ZERO = BigInt(0);

// 排行榜面板：保留桌面表格，同时在移动端切换为更易读的卡片。
export default function LeaderboardPanel() {
  const {
    leaderboardRecords,
    leaderboardTotal,
    leaderboardPage,
    isLeaderboardLoading,
    leaderboardLastUpdatedAt,
    fetchLeaderboard,
    createGame,
    setShowGameList,
    setShowLeaderboardDialog,
    networkMismatch,
    rulesMeta,
  } = useGameStore();
  const runtimeChainId = getResolvedRuntimeConfig().chainId;
  const totalPages = useMemo(
    () => getTotalPages(leaderboardTotal, PAGE_SIZE),
    [leaderboardTotal]
  );
  const baseRank = (leaderboardPage - 1) * PAGE_SIZE;
  const scoringSummary = formatScoringSummary(rulesMeta.scoring);
  const cancelSummary = formatCancelSummary(rulesMeta.scoring);
  const currentPageTopScore =
    leaderboardRecords.length > 0 ? leaderboardRecords[0].totalScore.toString() : "--";
  const rankRange =
    leaderboardRecords.length > 0
      ? `${baseRank + 1}-${baseRank + leaderboardRecords.length}`
      : "--";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanelStatCard label="玩家总数" value={leaderboardTotal} emphasis="strong" />
        <PanelStatCard label="当前页范围" value={rankRange} />
        <PanelStatCard label="当前页最高分" value={currentPageTopScore} />
        <PanelStatCard
          label="最近更新时间"
          value={
            leaderboardLastUpdatedAt
              ? new Date(leaderboardLastUpdatedAt).toLocaleString("zh-CN", {
                  hour12: false,
                })
              : "--"
          }
        />
      </div>

      <PanelNotesSection
        lines={[
          scoringSummary,
          `${cancelSummary}；仅双方参与且已结束的有效对局计入统计。`,
          "排序规则：总分降序 > 对局数降序 > 地址升序。",
          "分页规则：先全局排序后分页，确保跨页排名一致。",
        ]}
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={isLeaderboardLoading}
            onClick={() => void fetchLeaderboard(leaderboardPage, true)}
          >
            {isLeaderboardLoading ? "刷新中…" : "刷新排行榜"}
          </Button>
        }
      />

      {isLeaderboardLoading && leaderboardRecords.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">正在加载排行榜...</div>
      ) : leaderboardTotal === 0 ? (
        <PanelEmptyState
          title="暂无排行榜数据"
          primaryLabel="去开始首局"
          secondaryLabel="前往对局大厅"
          onPrimary={() => void createGame()}
          onSecondary={() => {
            setShowLeaderboardDialog(false);
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
                  <TableHead className="w-[80px]">排名</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead className="w-[120px]">对局数</TableHead>
                  <TableHead className="w-[120px]">总分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboardRecords.map((record, index) => {
                  const explorerUrl = getAddressExplorerUrl(
                    runtimeChainId,
                    record.displayAddress
                  );
                  return (
                    <TableRow key={record.player}>
                      <TableCell>{baseRank + index + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="font-medium text-primary/90">
                            {formatAddress(record.displayAddress)}
                          </div>
                          <AddressActions
                            address={record.displayAddress}
                            explorerUrl={explorerUrl}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{record.gamesPlayed.toString()}</TableCell>
                      <TableCell
                        className={getProjectScoreClass(record.totalScore)}
                      >
                        {record.totalScore > ZERO
                          ? `+${record.totalScore.toString()}`
                          : record.totalScore.toString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {leaderboardRecords.map((record, index) => {
              const explorerUrl = getAddressExplorerUrl(
                runtimeChainId,
                record.displayAddress
              );
              const rank = baseRank + index + 1;
              return (
                <div
                  key={record.player}
                  className="rounded-2xl border border-primary/15 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-primary">排名 #{rank}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm text-muted-foreground">
                          {formatAddress(record.displayAddress)}
                        </p>
                        <AddressActions
                          address={record.displayAddress}
                          explorerUrl={explorerUrl}
                        />
                      </div>
                    </div>
                    <p
                      className={`text-lg font-semibold ${getProjectScoreClass(
                        record.totalScore
                      )}`}
                    >
                      {record.totalScore > ZERO
                        ? `+${record.totalScore.toString()}`
                        : record.totalScore.toString()}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-primary/15 bg-white p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary/60">
                        对局数
                      </p>
                      <p className="text-lg font-semibold text-primary">
                        {record.gamesPlayed.toString()}
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
        currentPage={leaderboardPage}
        totalPages={totalPages}
        totalLabel={`共 ${leaderboardTotal} 位玩家`}
        isLoading={isLeaderboardLoading}
        onPrevious={() => void fetchLeaderboard(leaderboardPage - 1)}
        onNext={() => void fetchLeaderboard(leaderboardPage + 1)}
      />
    </div>
  );
}
