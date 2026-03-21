import Link from "next/link";
import HashValue from "@/components/explorer/HashValue";
import PageHeader from "@/components/explorer/PageHeader";
import TablePaginationBar from "@/components/explorer/TablePaginationBar";
import TableToolbar from "@/components/explorer/TableToolbar";
import PanelSection from "@/components/explorer/PanelSection";
import DataTableShell from "@/components/explorer/DataTableShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  findContractCreatorDetailed,
  getAddressInfo,
  getContractLogs,
  getRecentTransactions,
  getScanContext,
  type CreatorLookupResult,
  type RecentTransaction,
} from "@/lib/data";
import { formatEth, formatNumber } from "@/lib/format";
import {
  applySortOrder,
  compareNumberish,
  compareText,
  parseTableQuery,
  withPagination,
} from "@/lib/table-query";
import { isAddress } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ address: string }>;
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 从 query 参数中取首值（兼容 string[]）。
 */
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type AddressActivityRow = RecentTransaction & {
  direction: "IN" | "OUT";
  counterparty: string | null;
};

const EOA_ACTIVITY_LIMIT = 5000;

/**
 * 地址详情页：
 * - 展示地址资产状态；
 * - 合约地址可查看部署者与日志列表。
 */
export default async function AddressPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: PageSearchParams;
}) {
  const { address } = await params;
  const tableParams = await searchParams;

  if (!isAddress(address)) {
    return <div className="notice">地址格式错误</div>;
  }
  const creatorMode = first(tableParams.creatorScan) === "deep" ? "deep" : "quick";

  // `info` 地址摘要；`creatorInfo` 部署者扫描结果；
  // `logs` 合约日志；`eoaActivityRows` 为 EOA 交易活动。
  let info: Awaited<ReturnType<typeof getAddressInfo>> | null = null;
  let creatorInfo: CreatorLookupResult | null = null;
  let logs: Awaited<ReturnType<typeof getContractLogs>> = [];
  let eoaActivityRows: AddressActivityRow[] = [];
  let error: string | null = null;

  try {
    info = await getAddressInfo(address);
  } catch (err) {
    error = err instanceof Error ? err.message : "无法读取地址信息";
  }

  if (info?.isContract) {
    try {
      creatorInfo = await findContractCreatorDetailed(address, { mode: creatorMode });
    } catch {
      creatorInfo = null;
    }

    try {
      logs = await getContractLogs(address);
    } catch {
      logs = [];
    }
  } else if (info) {
    try {
      const scanContext = await getScanContext();
      const txData = await getRecentTransactions(scanContext.count, scanContext);
      const target = info.address.toLowerCase();
      eoaActivityRows = txData.transactions
        .filter((tx) => {
          return (
            tx.from.toLowerCase() === target ||
            (tx.to ? tx.to.toLowerCase() === target : false)
          );
        })
        .slice(0, EOA_ACTIVITY_LIMIT)
        .map((tx) => {
          const isOutgoing = tx.from.toLowerCase() === target;
          return {
            ...tx,
            direction: isOutgoing ? "OUT" : "IN",
            counterparty: isOutgoing ? tx.to : tx.from,
          };
        });
    } catch {
      eoaActivityRows = [];
    }
  }

  const logsQuery = parseTableQuery(tableParams, {
    namespace: "addrLogs",
    defaultSort: "block",
    defaultOrder: "desc",
    defaultPageSize: 20,
  });

  const filteredLogs = logs.filter((log: any) => {
    if (!logsQuery.filter) return true;
    const keyword = logsQuery.filter.toLowerCase();
    return (
      log.transactionHash.toLowerCase().includes(keyword) ||
      log.address.toLowerCase().includes(keyword) ||
      log.data.toLowerCase().includes(keyword)
    );
  });

  const sortedLogs = [...filteredLogs].sort((a: any, b: any) => {
    if (logsQuery.sort === "index") {
      return applySortOrder(compareNumberish(a.logIndex ?? 0n, b.logIndex ?? 0n), logsQuery.order);
    }
    if (logsQuery.sort === "tx") {
      return applySortOrder(compareText(a.transactionHash, b.transactionHash), logsQuery.order);
    }
    return applySortOrder(compareNumberish(a.blockNumber ?? 0n, b.blockNumber ?? 0n), logsQuery.order);
  });

  const pagedLogs = withPagination(sortedLogs, logsQuery.page, logsQuery.pageSize);

  const txQuery = parseTableQuery(tableParams, {
    namespace: "addrTx",
    defaultSort: "block",
    defaultOrder: "desc",
    defaultPageSize: 20,
  });

  const filteredEoaActivity = eoaActivityRows.filter((tx) => {
    if (!txQuery.filter) return true;
    const keyword = txQuery.filter.toLowerCase();
    return (
      tx.hash.toLowerCase().includes(keyword) ||
      tx.from.toLowerCase().includes(keyword) ||
      (tx.to ?? "").toLowerCase().includes(keyword) ||
      (tx.counterparty ?? "").toLowerCase().includes(keyword)
    );
  });

  const sortedEoaActivity = [...filteredEoaActivity].sort((a, b) => {
    if (txQuery.sort === "value") {
      return applySortOrder(compareNumberish(a.value, b.value), txQuery.order);
    }
    if (txQuery.sort === "direction") {
      return applySortOrder(compareText(a.direction, b.direction), txQuery.order);
    }
    if (txQuery.sort === "counterparty") {
      return applySortOrder(compareText(a.counterparty ?? "", b.counterparty ?? ""), txQuery.order);
    }
    return applySortOrder(compareNumberish(a.blockNumber ?? 0n, b.blockNumber ?? 0n), txQuery.order);
  });

  const pagedEoaActivity = withPagination(
    sortedEoaActivity,
    txQuery.page,
    txQuery.pageSize
  );

  return (
    <>
      <PageHeader
        kicker="Address Inspector"
        title="地址详情"
        description="地址资产状态、合约属性与日志追踪。"
        breadcrumbs={[
          { label: "首页", href: "/" },
          { label: "地址" },
        ]}
      />

      {error ? <div className="notice">{error}</div> : null}

      {info ? (
        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <PanelSection
            kicker="Address Snapshot"
            title="地址概览"
            description="基础状态、类型识别与部署者线索。"
            className="h-fit"
          >
            <div className="min-w-0 space-y-3 text-sm">
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">地址</p>
                <HashValue value={info.address} short={false} className="min-w-0 mt-1" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">余额</p>
                  <p className="value-wrap mt-1 font-display text-base text-slate-800">
                    {formatEth(info.balance)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">Nonce</p>
                  <p className="value-wrap mt-1 font-display text-base text-slate-800">
                    {formatNumber(info.nonce)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">类型</p>
                  <p className="value-wrap mt-1 font-display text-base text-slate-800">
                    {info.isContract ? "合约" : "EOA"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                  <p className="text-xs text-slate-500">代码大小</p>
                  <p className="value-wrap mt-1 font-display text-base text-slate-800">
                    {info.isContract ? `${info.codeSize} bytes` : "-"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">部署者（best-effort）</p>
                {info.isContract ? (
                  <div className="mt-2 min-w-0 space-y-2">
                    {creatorInfo?.creator ? (
                      <HashValue
                        value={creatorInfo.creator}
                        href={`/address/${creatorInfo.creator}`}
                        short={false}
                        className="min-w-0"
                      />
                    ) : (
                      <p className="text-xs text-slate-500">未找到（可能超出扫描范围）</p>
                    )}
                    {creatorInfo ? (
                      <p className="value-wrap text-xs text-slate-500">
                        扫描模式：{creatorInfo.mode === "quick" ? "快速" : "深度"}，已扫{" "}
                        {formatNumber(creatorInfo.scannedBlocks)} 块 /{" "}
                        {formatNumber(creatorInfo.scannedReceipts)} 笔交易
                        {creatorInfo.truncated ? "（达到扫描上限）" : ""}
                      </p>
                    ) : null}
                    {creatorMode === "quick" ? (
                      <Link
                        href={`/address/${address}?creatorScan=deep`}
                        className="text-xs text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline"
                      >
                        启用深度扫描（耗时更长）
                      </Link>
                    ) : (
                      <Link
                        href={`/address/${address}`}
                        className="text-xs text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline"
                      >
                        切回快速扫描
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">EOA 无部署者</p>
                )}
              </div>
            </div>
          </PanelSection>

          <DataTableShell
            kicker={info.isContract ? "Contract Event Stream" : "EOA Activity Stream"}
            title={info.isContract ? "合约日志（最近扫描范围）" : "EOA 活动（最近扫描范围）"}
            description={
              info.isContract
                ? "仅在目标地址为合约时展示。"
                : "展示最近扫描范围内该地址作为 from/to 的交易活动。"
            }
            toolbar={
              info.isContract ? (
                <TableToolbar
                  namespace="addrLogs"
                  filterPlaceholder="筛选 tx hash / 地址 / data"
                  sortOptions={[
                    { value: "block", label: "区块号" },
                    { value: "index", label: "Log Index" },
                    { value: "tx", label: "交易哈希" },
                  ]}
                />
              ) : (
                <TableToolbar
                  namespace="addrTx"
                  filterPlaceholder="筛选 tx hash / from / to / 对手方"
                  sortOptions={[
                    { value: "block", label: "区块号" },
                    { value: "direction", label: "方向" },
                    { value: "counterparty", label: "对手方" },
                    { value: "value", label: "Value" },
                  ]}
                />
              )
            }
            pagination={
              info.isContract ? (
                <TablePaginationBar
                  namespace="addrLogs"
                  page={pagedLogs.page}
                  totalPages={pagedLogs.totalPages}
                  total={pagedLogs.total}
                />
              ) : (
                <TablePaginationBar
                  namespace="addrTx"
                  page={pagedEoaActivity.page}
                  totalPages={pagedEoaActivity.totalPages}
                  total={pagedEoaActivity.total}
                />
              )
            }
          >
            {info.isContract ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>区块</TableHead>
                    <TableHead>交易哈希</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedLogs.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                        暂无日志
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedLogs.items.map((log: any) => (
                      <TableRow key={`${log.transactionHash}-${log.logIndex?.toString() ?? "0"}`}>
                        <TableCell>
                          <Link
                            href={`/block/${log.blockNumber?.toString() ?? "0"}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {formatNumber(log.blockNumber ?? 0n)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <HashValue value={log.transactionHash} href={`/tx/${log.transactionHash}`} />
                        </TableCell>
                        <TableCell className="space-y-1">
                          {log.topics.map((topic: string) => (
                            <HashValue key={topic} value={topic} short />
                          ))}
                        </TableCell>
                        <TableCell>
                          <HashValue value={log.data} short />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>区块</TableHead>
                    <TableHead>交易哈希</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead>对手方</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedEoaActivity.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                        暂无 EOA 交易活动（可扩大扫描范围）
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedEoaActivity.items.map((tx) => (
                      <TableRow key={tx.hash}>
                        <TableCell>
                          {tx.blockNumber !== null ? (
                            <Link
                              href={`/block/${tx.blockNumber.toString()}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {formatNumber(tx.blockNumber)}
                            </Link>
                          ) : (
                            <span className="text-slate-500">Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <HashValue value={tx.hash} href={`/tx/${tx.hash}`} />
                        </TableCell>
                        <TableCell>{tx.direction}</TableCell>
                        <TableCell>
                          {tx.counterparty ? (
                            <HashValue value={tx.counterparty} href={`/address/${tx.counterparty}`} />
                          ) : (
                            <span className="text-xs text-slate-500">创建合约</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatEth(tx.value)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </DataTableShell>
        </section>
      ) : null}
    </>
  );
}
