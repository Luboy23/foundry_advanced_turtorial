import Link from "next/link";
import HashValue from "@/components/explorer/HashValue";
import PageHeader from "@/components/explorer/PageHeader";
import TablePaginationBar from "@/components/explorer/TablePaginationBar";
import TableToolbar from "@/components/explorer/TableToolbar";
import DataTableShell from "@/components/explorer/DataTableShell";
import PanelSection from "@/components/explorer/PanelSection";
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
import { getBlockDetail } from "@/lib/data";
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

/**
 * 校验区块号参数是否为十进制数字。
 */
const isValidNumber = (value: string) => /^\d+$/.test(value);

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ number: string }>;
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 识别交易方法标签（本地 ABI 路径）。
 * 若本地 ABI 无法解码，返回 selector 供公共签名库兜底。
 */
const resolveTxMethodLabel = (tx: { input?: string; to?: string | null }) => {
  const input =
    typeof tx.input === "string" && tx.input.startsWith("0x")
      ? (tx.input as Hex)
      : ("0x" as Hex);
  if (input === "0x") {
    return {
      label: tx.to ? "Transfer" : "创建合约",
      selector: null as string | null,
    };
  }
  const decoded = decodeFunctionDataWithRegistry(
    input,
    ABI_REGISTRY,
    FUNCTION_SELECTOR_INDEX
  );
  if (decoded?.functionName) {
    return { label: decoded.functionName, selector: null as string | null };
  }
  const selector = getSelectorFromInput(input);
  return { label: selector ?? input.slice(0, 10), selector };
};

/**
 * 区块详情页：区块元数据 + 区块内交易列表。
 */
export default async function BlockDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: PageSearchParams;
}) {
  const { number } = await params;
  const tableParams = await searchParams;

  if (!isValidNumber(number)) {
    return <div className="notice">区块号格式错误</div>;
  }

  let block: Awaited<ReturnType<typeof getBlockDetail>> | null = null;
  let error: string | null = null;

  try {
    block = await getBlockDetail(BigInt(number));
  } catch (err) {
    error = err instanceof Error ? err.message : "无法读取区块";
  }

  const txQuery = parseTableQuery(tableParams, {
    namespace: "blockTx",
    defaultSort: "index",
    defaultOrder: "asc",
    defaultPageSize: 20,
  });

  // 当前区块交易列表（用于本地筛选/排序/分页）。
  const txList = (block?.transactions ?? []) as any[];
  const filteredTransactions = txList.filter((tx) => {
    if (!txQuery.filter) return true;
    const keyword = txQuery.filter.toLowerCase();
    return (
      tx.hash?.toLowerCase().includes(keyword) ||
      tx.from?.toLowerCase().includes(keyword) ||
      tx.to?.toLowerCase().includes(keyword)
    );
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (txQuery.sort === "value") {
      return applySortOrder(compareNumberish(a.value ?? 0n, b.value ?? 0n), txQuery.order);
    }
    if (txQuery.sort === "from") {
      return applySortOrder(compareText(a.from ?? "", b.from ?? ""), txQuery.order);
    }
    if (txQuery.sort === "gas") {
      return applySortOrder(compareNumberish(a.gas ?? 0n, b.gas ?? 0n), txQuery.order);
    }
    return applySortOrder(
      compareNumberish(a.transactionIndex ?? 0, b.transactionIndex ?? 0),
      txQuery.order
    );
  });

  const pagedTransactions = withPagination(
    sortedTransactions,
    txQuery.page,
    txQuery.pageSize
  );

  // 仅为当前页交易补充公共 selector 签名匹配，避免不必要外部查询。
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
        kicker="Block Inspector"
        title={`区块 #${number}`}
        description="区块元数据与区块内交易列表。"
        breadcrumbs={[
          { label: "首页", href: "/" },
          { label: "区块", href: "/block" },
          { label: `#${number}` },
        ]}
      />

      {error ? <div className="notice">{error}</div> : null}

      {block ? (
        <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <PanelSection
            kicker="Block Snapshot"
            title="区块概览"
            description="关键元数据与时间信息。"
            className="h-fit"
          >
            <div className="min-w-0 space-y-3 text-sm">
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">区块哈希</p>
                {block.hash ? (
                  <HashValue value={block.hash} short={false} className="min-w-0 mt-1" />
                ) : (
                  "-"
                )}
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">父块哈希</p>
                <HashValue value={block.parentHash} short={false} className="min-w-0 mt-1" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">时间</p>
                  <p className="value-wrap mt-1 text-slate-800">{formatTimestamp(block.timestamp)}</p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">交易数</p>
                  <p className="value-wrap mt-1 text-slate-800">
                    {formatNumber(block.transactions.length)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">Gas Used</p>
                  <p className="value-wrap mt-1 text-slate-800">
                    {formatNumber(block.gasUsed ?? 0n)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">Gas Limit</p>
                  <p className="value-wrap mt-1 text-slate-800">
                    {formatNumber(block.gasLimit ?? 0n)}
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <DataTableShell
            kicker="Block Transactions"
            title="区块内交易"
            description="支持筛选、排序、分页，参数同步到 URL。"
            toolbar={
              <TableToolbar
                namespace="blockTx"
                filterPlaceholder="筛选 tx hash / from / to"
                sortOptions={[
                  { value: "index", label: "交易索引" },
                  { value: "value", label: "Value" },
                  { value: "from", label: "From" },
                  { value: "gas", label: "Gas" },
                ]}
              />
            }
            pagination={
              <TablePaginationBar
                namespace="blockTx"
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
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Gas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedTransactions.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                      该区块暂无交易
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTransactions.items.map((tx) => (
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
                        <HashValue value={tx.from} href={`/address/${tx.from}`} />
                      </TableCell>
                      <TableCell>
                        {tx.to ? (
                          <HashValue value={tx.to} href={`/address/${tx.to}`} />
                        ) : (
                          <span className="text-xs text-slate-500">创建合约</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatEth(tx.value ?? 0n)}</TableCell>
                      <TableCell className="text-right">{formatNumber(tx.gas ?? 0n)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTableShell>
        </section>
      ) : null}
    </>
  );
}
