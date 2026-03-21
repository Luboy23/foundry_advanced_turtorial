import Link from "next/link";
import HashValue from "@/components/explorer/HashValue";
import PageHeader from "@/components/explorer/PageHeader";
import TablePaginationBar from "@/components/explorer/TablePaginationBar";
import TableToolbar from "@/components/explorer/TableToolbar";
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
import { ABI_REGISTRY, FUNCTION_SELECTOR_INDEX } from "@/lib/abis";
import { getRecentTransactions, getScanContext } from "@/lib/data";
import { decodeFunctionDataWithRegistry } from "@/lib/decode";
import { formatEth, formatNumber } from "@/lib/format";
import {
  applySortOrder,
  compareNumberish,
  compareText,
  parseTableQuery,
  withPagination,
} from "@/lib/table-query";
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
 * 交易列表页：
 * - 展示扫描窗口内交易；
 * - 提供筛选、排序、分页；
 * - 支持进入交易详情。
 */
export default async function TxListPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;

  let error: string | null = null;
  let txData: Awaited<ReturnType<typeof getRecentTransactions>> | null = null;

  try {
    const scanContext = await getScanContext();
    txData = await getRecentTransactions(scanContext.count, scanContext);
  } catch (err) {
    error = err instanceof Error ? err.message : "无法读取交易列表";
  }

  const query = parseTableQuery(params, {
    namespace: "txList",
    defaultSort: "block",
    defaultOrder: "desc",
    defaultPageSize: 20,
  });

  const transactions = txData?.transactions ?? [];

  const filteredTransactions = transactions.filter((tx) => {
    if (!query.filter) return true;
    const keyword = query.filter.toLowerCase();
    return (
      tx.hash.toLowerCase().includes(keyword) ||
      tx.from.toLowerCase().includes(keyword) ||
      (tx.to ?? "").toLowerCase().includes(keyword)
    );
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (query.sort === "value") {
      return applySortOrder(compareNumberish(a.value, b.value), query.order);
    }
    if (query.sort === "from") {
      return applySortOrder(compareText(a.from, b.from), query.order);
    }
    return applySortOrder(
      compareNumberish(a.blockNumber ?? 0n, b.blockNumber ?? 0n),
      query.order
    );
  });

  const pagedTransactions = withPagination(
    sortedTransactions,
    query.page,
    query.pageSize
  );

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
        kicker="Transactions Explorer"
        title="交易列表"
        description="查看扫描窗口内交易摘要，并跳转到交易详情。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "交易" }]}
      />

      {error ? <div className="notice">{error}</div> : null}

      <DataTableShell
        id="txs-panel"
        kicker="Transactions Stream"
        title="最近交易"
        description="展示扫描范围内交易摘要，支持快速跳转与方法识别。"
        toolbar={
          <TableToolbar
            namespace="txList"
            filterPlaceholder="筛选 tx hash / from / to"
            sortOptions={[
              { value: "block", label: "区块号" },
              { value: "value", label: "Value" },
              { value: "from", label: "From" },
            ]}
          />
        }
        pagination={
          <TablePaginationBar
            namespace="txList"
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
    </>
  );
}
