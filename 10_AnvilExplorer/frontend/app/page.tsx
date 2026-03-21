import Link from "next/link";
import PageHeader from "@/components/explorer/PageHeader";
import HashValue from "@/components/explorer/HashValue";
import TableToolbar from "@/components/explorer/TableToolbar";
import TablePaginationBar from "@/components/explorer/TablePaginationBar";
import MetricCard from "@/components/explorer/MetricCard";
import DataTableShell from "@/components/explorer/DataTableShell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getChainFingerprint,
  getRecentBlockSummaries,
  getRecentTransactions,
  getScanContext,
} from "@/lib/data";
import { ABI_REGISTRY, FUNCTION_SELECTOR_INDEX } from "@/lib/abis";
import { decodeFunctionDataWithRegistry } from "@/lib/decode";
import {
  applySortOrder,
  compareNumberish,
  compareText,
  parseTableQuery,
  withPagination,
} from "@/lib/table-query";
import { formatEth, formatNumber, formatTimestamp } from "@/lib/format";
import {
  getSelectorFromInput,
  resolvePublicFunctionNames,
} from "@/lib/selector-signature";
import { type Hex } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 识别交易方法标签（本地 ABI 路径）。
 * 若本地 ABI 无法解码，返回 selector 供公共签名库兜底。
 */
const resolveTxMethodLabel = (tx: { input: Hex; to: string | null }) => {
  if (!tx.input || tx.input === "0x") {
    return {
      label: tx.to ? "Transfer" : "创建合约",
      selector: null as string | null,
    };
  }
  const decoded = decodeFunctionDataWithRegistry(
    tx.input,
    ABI_REGISTRY,
    FUNCTION_SELECTOR_INDEX
  );
  if (decoded?.functionName) {
    return { label: decoded.functionName, selector: null as string | null };
  }
  const selector = getSelectorFromInput(tx.input);
  return { label: selector ?? tx.input.slice(0, 10), selector };
};

/**
 * 首页总览：
 * - 读取扫描窗口内区块与交易；
 * - 提供筛选/排序/分页；
 * - 展示节点与链状态摘要。
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;

  // 三类错误独立记录，便于页面分区提示。
  let blocksError: string | null = null;
  let txError: string | null = null;
  let fingerprintError: string | null = null;
  // `scanContext` 决定当前页面读取窗口（latest/from/count）。
  let fingerprint: Awaited<ReturnType<typeof getChainFingerprint>> | null = null;
  let scanContext: Awaited<ReturnType<typeof getScanContext>> | null = null;
  let blocksData: Awaited<ReturnType<typeof getRecentBlockSummaries>> | null = null;
  let txData: Awaited<ReturnType<typeof getRecentTransactions>> | null = null;

  try {
    scanContext = await getScanContext();
  } catch (err) {
    const message = err instanceof Error ? err.message : "无法读取扫描范围";
    blocksError = message;
    txError = message;
  }

  if (scanContext) {
    const [blocksResult, txResult] = await Promise.allSettled([
      getRecentBlockSummaries(scanContext.count, scanContext),
      getRecentTransactions(scanContext.count, scanContext),
    ]);

    if (blocksResult.status === "fulfilled") {
      blocksData = blocksResult.value;
    } else {
      blocksError =
        blocksResult.reason instanceof Error
          ? blocksResult.reason.message
          : "无法读取区块列表";
    }

    if (txResult.status === "fulfilled") {
      txData = txResult.value;
    } else {
      txError =
        txResult.reason instanceof Error
          ? txResult.reason.message
          : "无法读取交易列表";
    }
  }

  try {
    fingerprint = await getChainFingerprint();
  } catch (err) {
    fingerprintError = err instanceof Error ? err.message : "无法读取链状态";
  }

  const blocksQuery = parseTableQuery(params, {
    namespace: "blocks",
    defaultSort: "number",
    defaultOrder: "desc",
    defaultPageSize: 10,
  });

  const txQuery = parseTableQuery(params, {
    namespace: "txs",
    defaultSort: "block",
    defaultOrder: "desc",
    defaultPageSize: 10,
  });

  const blocks = blocksData?.blocks ?? [];
  const transactions = txData?.transactions ?? [];

  // 区块筛选：按 hash/number 模糊匹配。
  const filteredBlocks = blocks.filter((block) => {
    if (!blocksQuery.filter) return true;
    const keyword = blocksQuery.filter.toLowerCase();
    return (
      block.hash?.toLowerCase().includes(keyword) ||
      block.number?.toString().includes(keyword)
    );
  });

  const sortedBlocks = [...filteredBlocks].sort((a, b) => {
    if (blocksQuery.sort === "txCount") {
      return applySortOrder(
        compareNumberish(a.transactions.length, b.transactions.length),
        blocksQuery.order
      );
    }
    if (blocksQuery.sort === "gasUsed") {
      return applySortOrder(
        compareNumberish(a.gasUsed ?? 0n, b.gasUsed ?? 0n),
        blocksQuery.order
      );
    }
    if (blocksQuery.sort === "timestamp") {
      return applySortOrder(
        compareNumberish(a.timestamp ?? 0n, b.timestamp ?? 0n),
        blocksQuery.order
      );
    }
    return applySortOrder(
      compareNumberish(a.number ?? 0n, b.number ?? 0n),
      blocksQuery.order
    );
  });

  const pagedBlocks = withPagination(sortedBlocks, blocksQuery.page, blocksQuery.pageSize);

  // 交易筛选：按 hash/from/to 模糊匹配。
  const filteredTransactions = transactions.filter((tx) => {
    if (!txQuery.filter) return true;
    const keyword = txQuery.filter.toLowerCase();
    return (
      tx.hash.toLowerCase().includes(keyword) ||
      tx.from.toLowerCase().includes(keyword) ||
      (tx.to ?? "").toLowerCase().includes(keyword)
    );
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (txQuery.sort === "value") {
      return applySortOrder(compareNumberish(a.value, b.value), txQuery.order);
    }
    if (txQuery.sort === "from") {
      return applySortOrder(compareText(a.from, b.from), txQuery.order);
    }
    if (txQuery.sort === "timestamp") {
      return applySortOrder(compareNumberish(a.timestamp ?? 0n, b.timestamp ?? 0n), txQuery.order);
    }
    return applySortOrder(
      compareNumberish(a.blockNumber ?? 0n, b.blockNumber ?? 0n),
      txQuery.order
    );
  });

  const pagedTransactions = withPagination(
    sortedTransactions,
    txQuery.page,
    txQuery.pageSize
  );

  // 对当前页交易做一次方法名预解析：
  // 1) 先用本地 ABI；
  // 2) 未命中时再查公共 selector 签名库并使用缓存。
  const txMethodBase = pagedTransactions.items.map((tx) => {
    const resolved = resolveTxMethodLabel(tx);
    return { hash: tx.hash, ...resolved };
  });
  const selectorLookup = await resolvePublicFunctionNames(
    txMethodBase
      .map((item) => item.selector)
      .filter((selector): selector is string => Boolean(selector))
  );
  const txMethodLabelByHash = new Map(
    txMethodBase.map((item) => [
      item.hash,
      item.selector ? selectorLookup.get(item.selector) ?? item.label : item.label,
    ])
  );

  return (
    <>
      <PageHeader
        kicker="Realtime Dashboard"
        title="链上总览"
        description="本地 Anvil 网络的总览面板，聚合节点状态、最近区块与最近交易。"
        breadcrumbs={[{ label: "首页" }]}
      />

      {blocksError ? (
        <div className="notice">区块读取失败：{blocksError}</div>
      ) : null}
      {txError ? <div className="notice">交易读取失败：{txError}</div> : null}
      {fingerprintError ? <div className="notice">{fingerprintError}</div> : null}

      <section className="tech-grid">
        <MetricCard
          label="Chain ID"
          value={fingerprint?.chainId ?? "-"}
          hint={fingerprint?.clientVersion ?? "等待节点响应"}
        />
        <MetricCard
          label="最新区块"
          value={formatNumber(fingerprint?.latestBlockNumber ?? null)}
          hint={formatTimestamp(fingerprint?.latestBlockTimestamp ?? null)}
        />
        <MetricCard
          label="扫描窗口"
          value={
            blocksData
              ? `${formatNumber(blocksData.from)} - ${formatNumber(blocksData.latest)}`
              : txData
                ? `${formatNumber(txData.from)} - ${formatNumber(txData.latest)}`
                : "-"
          }
          valueClassName="text-xl"
          hint={
            scanContext
              ? `扫描块数: ${formatNumber(scanContext.count)}`
              : "当前扫描参数未就绪"
          }
        />
        <MetricCard
          label="近端交易数"
          value={formatNumber(transactions.length)}
          hint="扫描窗口内已解析交易数量"
        />
      </section>

      <section className="grid grid-cols-1 gap-5">
        <DataTableShell
          id="blocks-panel"
          kicker="Blocks Stream"
          title="最近区块"
          description="支持筛选、排序与分页，表格状态写入 URL。"
          toolbar={
            <TableToolbar
              namespace="blocks"
              defaultPageSize={10}
              filterPlaceholder="筛选区块号或区块哈希"
              sortOptions={[
                { value: "number", label: "区块号" },
                { value: "timestamp", label: "时间" },
                { value: "txCount", label: "交易数" },
                { value: "gasUsed", label: "Gas Used" },
              ]}
            />
          }
          pagination={
            <TablePaginationBar
              namespace="blocks"
              page={pagedBlocks.page}
              totalPages={pagedBlocks.totalPages}
              total={pagedBlocks.total}
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>区块号</TableHead>
                <TableHead>区块哈希</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="text-right">交易数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedBlocks.items.map((block) => (
                <TableRow key={block.hash}>
                  <TableCell>
                    <Link
                      href={`/block/${block.number?.toString() ?? "0"}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {formatNumber(block.number ?? 0n)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {block.hash ? (
                      <HashValue value={block.hash} href={`/block/${block.number?.toString() ?? "0"}`} />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatTimestamp(block.timestamp)}</TableCell>
                  <TableCell className="text-right">{formatNumber(block.transactions.length)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>

        <DataTableShell
          id="txs-panel"
          kicker="Transactions Stream"
          title="最近交易"
          description="展示扫描范围内交易摘要，支持快速跳转与方法识别。"
          toolbar={
            <TableToolbar
              namespace="txs"
              defaultPageSize={10}
              filterPlaceholder="筛选 tx hash / from / to"
              sortOptions={[
                { value: "block", label: "区块号" },
                { value: "timestamp", label: "时间" },
                { value: "value", label: "Value" },
                { value: "from", label: "From" },
              ]}
            />
          }
          pagination={
            <TablePaginationBar
              namespace="txs"
              page={pagedTransactions.page}
              totalPages={pagedTransactions.totalPages}
              total={pagedTransactions.total}
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>交易哈希</TableHead>
                <TableHead>方法</TableHead>
                <TableHead>区块</TableHead>
                <TableHead>From / To</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTransactions.items.map((tx) => (
                <TableRow key={tx.hash}>
                  <TableCell>
                    <HashValue value={tx.hash} href={`/tx/${tx.hash}`} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
                      {txMethodLabelByHash.get(tx.hash) ?? resolveTxMethodLabel(tx).label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {tx.blockNumber !== null ? (
                      <Link href={`/block/${tx.blockNumber.toString()}`} className="underline-offset-4 hover:underline">
                        {formatNumber(tx.blockNumber)}
                      </Link>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-y-1">
                    <HashValue value={tx.from} href={`/address/${tx.from}`} />
                    {tx.to ? (
                      <HashValue value={tx.to} href={`/address/${tx.to}`} />
                    ) : (
                      <span className="text-xs text-slate-500">创建合约</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatEth(tx.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>
      </section>
    </>
  );
}
