import Link from "next/link";
import CustomAbiDecoder from "@/components/CustomAbiDecoder";
import HashValue from "@/components/explorer/HashValue";
import PageHeader from "@/components/explorer/PageHeader";
import StatusBadge from "@/components/explorer/StatusBadge";
import TablePaginationBar from "@/components/explorer/TablePaginationBar";
import TableToolbar from "@/components/explorer/TableToolbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ABI_REGISTRY,
  EVENT_TOPIC_INDEX,
  FUNCTION_SELECTOR_INDEX,
} from "@/lib/abis";
import {
  decodeFunctionDataWithRegistry,
  decodeLogWithRegistry,
  decodeTransfers,
  formatDecodedValue,
} from "@/lib/decode";
import { getTxDetailExtended, traceTransaction, type TraceResult } from "@/lib/data";
import {
  formatEth,
  formatGwei,
  formatNumber,
  formatTimestamp,
  shortenHash,
} from "@/lib/format";
import {
  applySortOrder,
  compareNumberish,
  compareText,
  parseTableQuery,
  withPagination,
} from "@/lib/table-query";
import { firstParam, normalizeTraceRows, toSearchParams } from "@/lib/tx-detail";
import {
  getSelectorFromInput,
  lookupPublicFunctionName,
} from "@/lib/selector-signature";
import { isHash, type Hex } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ hash: string }>;
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 把 number/bigint 统一转为 bigint（空值保持 null）。
 */
const asBigInt = (value: bigint | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? value : BigInt(Math.floor(value));
};

/**
 * 交易详情页：
 * - 概览（状态/费用/确认数）；
 * - Input 解码；
 * - Logs / Transfers / Internal Calls 三类分析视图。
 */
export default async function TxDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: PageSearchParams;
}) {
  const { hash } = await params;
  const queryParams = await searchParams;

  if (!isHash(hash)) {
    return <div className="notice">交易哈希格式错误</div>;
  }

  let txDetail: Awaited<ReturnType<typeof getTxDetailExtended>> | null = null;
  let traceResult: TraceResult | null = null;
  let error: string | null = null;

  try {
    txDetail = await getTxDetailExtended(hash);
  } catch (err) {
    error = err instanceof Error ? err.message : "无法读取交易";
  }

  const tx = txDetail?.tx;
  const receipt = txDetail?.receipt;
  const block = txDetail?.block ?? null;
  const latestBlockNumber = txDetail?.latestBlockNumber ?? null;

  if (tx) {
    traceResult = await traceTransaction(hash);
  }

  const confirmations =
    receipt?.blockNumber !== null &&
    receipt?.blockNumber !== undefined &&
    latestBlockNumber !== null &&
    latestBlockNumber !== undefined &&
    latestBlockNumber >= receipt.blockNumber
      ? latestBlockNumber - receipt.blockNumber + 1n
      : null;

  // 交易费用 = `gasUsed * effectiveGasPrice`（两者都存在时）。
  const gasUsed = asBigInt((receipt as any)?.gasUsed ?? null);
  const effectiveGasPrice = asBigInt((receipt as any)?.effectiveGasPrice ?? null);
  const txFee =
    gasUsed !== null &&
    gasUsed !== undefined &&
    effectiveGasPrice !== null &&
    effectiveGasPrice !== undefined
      ? gasUsed * effectiveGasPrice
      : null;

  const input = tx?.input ?? "0x";
  const methodId = input && input.length >= 10 ? input.slice(0, 10) : "-";
  const decodedInput = decodeFunctionDataWithRegistry(
    input as Hex,
    ABI_REGISTRY,
    FUNCTION_SELECTOR_INDEX
  );
  const selector = getSelectorFromInput(input);
  const publicMethodName =
    decodedInput || !selector ? null : await lookupPublicFunctionName(selector);
  const methodName =
    decodedInput?.functionName ??
    publicMethodName ??
    (input === "0x" ? (tx?.to ? "Transfer" : "创建合约") : methodId);

  // `transfers` 来自标准 Transfer 事件解析。
  const transfers = receipt ? decodeTransfers(receipt.logs) : [];
  // `traceRows` 统一了 callTracer / trace_transaction 两种格式。
  const traceRows = normalizeTraceRows(traceResult);

  const clientLogs = receipt
    ? receipt.logs.map((log: any) => ({
        address: log.address,
        data: log.data,
        topics: log.topics,
      }))
    : [];

  // `rawLogs` 保留原始日志对象，便于分页与原值展示。
  const rawLogs = (receipt?.logs ?? []) as any[];
  const decodedLogsByIndex = rawLogs.map((log: any) =>
    decodeLogWithRegistry(
      { data: log.data as Hex, topics: log.topics as Hex[] },
      ABI_REGISTRY,
      EVENT_TOPIC_INDEX
    )
  );
  const logObjectIndexMap = new Map<any, number>(
    rawLogs.map((log: any, index: number) => [log, index])
  );

  // 当前激活 tab，默认 `input`。
  const activeTab = (() => {
    const tab = firstParam(queryParams.tab);
    if (tab === "logs" || tab === "transfers" || tab === "calls") return tab;
    return "input";
  })();

  // `tabHref` 用于保持其它查询参数不变，仅切换 tab。
  const current = toSearchParams(queryParams);
  const tabHref = (tab: string) => {
    const next = new URLSearchParams(current.toString());
    next.set("tab", tab);
    return `?${next.toString()}`;
  };

  const transferQuery = parseTableQuery(queryParams, {
    namespace: "txTransfers",
    defaultSort: "value",
    defaultOrder: "desc",
    defaultPageSize: 20,
  });

  const logQuery = parseTableQuery(queryParams, {
    namespace: "txLogs",
    defaultSort: "index",
    defaultOrder: "asc",
    defaultPageSize: 20,
  });

  const callQuery = parseTableQuery(queryParams, {
    namespace: "txCalls",
    defaultSort: "depth",
    defaultOrder: "asc",
    defaultPageSize: 20,
  });

  const filteredTransfers = transfers.filter((transfer) => {
    if (!transferQuery.filter) return true;
    const keyword = transferQuery.filter.toLowerCase();
    return (
      transfer.token.toLowerCase().includes(keyword) ||
      transfer.from.toLowerCase().includes(keyword) ||
      transfer.to.toLowerCase().includes(keyword)
    );
  });

  const sortedTransfers = [...filteredTransfers].sort((a, b) => {
    if (transferQuery.sort === "token") {
      return applySortOrder(compareText(a.token, b.token), transferQuery.order);
    }
    if (transferQuery.sort === "from") {
      return applySortOrder(compareText(a.from, b.from), transferQuery.order);
    }
    return applySortOrder(compareNumberish(a.value, b.value), transferQuery.order);
  });
  const pagedTransfers = withPagination(sortedTransfers, transferQuery.page, transferQuery.pageSize);

  const filteredLogs = rawLogs.filter((log: any, index: number) => {
    if (!logQuery.filter) return true;
    const keyword = logQuery.filter.toLowerCase();
    const eventName = decodedLogsByIndex[index]?.eventName?.toLowerCase() ?? "";
    return (
      log.address.toLowerCase().includes(keyword) ||
      log.data.toLowerCase().includes(keyword) ||
      eventName.includes(keyword)
    );
  });

  const sortedLogs = [...filteredLogs].sort((a: any, b: any) => {
    if (logQuery.sort === "address") {
      return applySortOrder(compareText(a.address, b.address), logQuery.order);
    }
    return applySortOrder(
      compareNumberish(BigInt(a.logIndex ?? 0), BigInt(b.logIndex ?? 0)),
      logQuery.order
    );
  });

  const pagedLogs = withPagination(sortedLogs, logQuery.page, logQuery.pageSize);

  const filteredCalls = traceRows.filter((row) => {
    if (!callQuery.filter) return true;
    const keyword = callQuery.filter.toLowerCase();
    return (
      (row.type ?? "").toLowerCase().includes(keyword) ||
      (row.from ?? "").toLowerCase().includes(keyword) ||
      (row.to ?? "").toLowerCase().includes(keyword)
    );
  });

  const sortedCalls = [...filteredCalls].sort((a, b) => {
    if (callQuery.sort === "type") {
      return applySortOrder(compareText(a.type ?? "", b.type ?? ""), callQuery.order);
    }
    if (callQuery.sort === "gas") {
      return applySortOrder(
        compareText(a.gasUsed ?? a.gas ?? "", b.gasUsed ?? b.gas ?? ""),
        callQuery.order
      );
    }
    return applySortOrder(compareNumberish(a.depth, b.depth), callQuery.order);
  });

  const pagedCalls = withPagination(sortedCalls, callQuery.page, callQuery.pageSize);

  return (
    <>
      <PageHeader
        kicker="Transaction Inspector"
        title="交易详情"
        description="交易概览、输入解码、日志、Token Transfer 与内部调用。"
        breadcrumbs={[
          { label: "首页", href: "/" },
          { label: "交易", href: "/tx" },
          { label: "详情" },
        ]}
      />

      {error ? <div className="notice">{error}</div> : null}

      {tx ? (
        <section className="space-y-5">
          <Card className="glass-panel soft-glow gap-4 py-4">
            <CardHeader className="px-4 md:px-5">
              <p className="section-kicker">Transaction Snapshot</p>
              <CardTitle className="font-display flex items-center gap-2 text-lg text-slate-900">
                交易概览
                {receipt ? (
                  receipt.status === "success" ? (
                    <StatusBadge tone="success">成功</StatusBadge>
                  ) : (
                    <StatusBadge tone="failed">失败</StatusBadge>
                  )
                ) : (
                  <StatusBadge tone="pending">待确认</StatusBadge>
                )}
              </CardTitle>
              <CardDescription className="text-slate-600">{shortenHash(hash, 12, 8)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-4 md:grid-cols-2 md:px-5 xl:grid-cols-3 [&>div]:min-w-0">
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">交易哈希</p>
                <HashValue value={hash} short={false} className="min-w-0" />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">区块号</p>
                <p className="mt-1 text-sm font-medium">
                  {receipt?.blockNumber !== undefined ? (
                    <Link href={`/block/${receipt.blockNumber}`} className="underline-offset-4 hover:underline">
                      {formatNumber(receipt.blockNumber)}
                    </Link>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">确认数</p>
                <p className="mt-1 text-sm font-medium">{confirmations !== null ? formatNumber(confirmations) : "-"}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">From</p>
                <HashValue value={tx.from} href={`/address/${tx.from}`} short={false} className="min-w-0" />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">To</p>
                {tx.to ? (
                  <HashValue value={tx.to} href={`/address/${tx.to}`} short={false} className="min-w-0" />
                ) : receipt?.contractAddress ? (
                  <HashValue
                    value={receipt.contractAddress}
                    href={`/address/${receipt.contractAddress}`}
                    short={false}
                    className="min-w-0"
                  />
                ) : (
                  <p className="text-sm">创建合约</p>
                )}
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">调用方法</p>
                <p className="value-wrap mt-1 text-sm font-medium">{methodName}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">交易费用</p>
                <p className="value-wrap mt-1 text-sm font-medium">{txFee !== null ? formatEth(txFee) : "-"}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">Gas Used / Limit</p>
                <p className="value-wrap mt-1 text-sm font-medium">
                  {gasUsed !== null ? formatNumber(gasUsed) : "-"} / {formatNumber(tx.gas)}
                </p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">Gas Price</p>
                <p className="value-wrap mt-1 text-sm font-medium">
                  {tx.gasPrice !== null && tx.gasPrice !== undefined
                    ? formatGwei(tx.gasPrice)
                    : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">区块时间</p>
                <p className="mt-1 text-sm font-medium">{block?.timestamp ? formatTimestamp(block.timestamp) : "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="data-shell soft-glow gap-4 py-4">
            <CardHeader className="px-4 md:px-5">
              <p className="section-kicker">Transaction Analysis</p>
              <CardTitle className="font-display text-lg text-slate-900">分析视图</CardTitle>
              <CardDescription className="text-slate-600">
                Tab 状态同步到 URL，便于分享与回放。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-5">
              <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-white/75 bg-white/72 p-1.5">
                {[
                  { key: "input", label: "Input / 解码" },
                  { key: "logs", label: "Logs" },
                  { key: "transfers", label: "Token Transfers" },
                  { key: "calls", label: "Internal Calls" },
                ].map((tab) => (
                  <Link
                    key={tab.key}
                    href={tabHref(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? "border border-zinc-300 bg-white text-zinc-900 shadow-[0_8px_16px_-14px_rgba(0,0,0,0.4)]"
                        : "text-slate-600 hover:bg-white/85 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>

              {activeTab === "input" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                      <p className="text-xs text-slate-500">方法 ID</p>
                      <p className="value-wrap mt-1 font-mono text-xs text-slate-700">{methodId}</p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                      <p className="text-xs text-slate-500">内置 ABI 解码</p>
                      {decodedInput ? (
                        <div className="mt-1 space-y-1">
                          <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
                            {decodedInput.functionName}
                          </Badge>
                          <p className="text-xs text-slate-500">{decodedInput.abiName}</p>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm">未匹配内置 ABI</p>
                      )}
                    </div>
                  </div>
                  {decodedInput ? (
                    <pre className="code-block">
                      {formatDecodedValue(decodedInput.args)}
                    </pre>
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs text-slate-500">原始 Input</p>
                    <pre className="code-block">{input}</pre>
                  </div>
                  <CustomAbiDecoder input={input} logs={clientLogs} />
                </div>
              ) : null}

              {activeTab === "logs" ? (
                <div className="space-y-3">
                  <TableToolbar
                    namespace="txLogs"
                    filterPlaceholder="筛选 address / data / event"
                    sortOptions={[
                      { value: "index", label: "Log Index" },
                      { value: "address", label: "Address" },
                    ]}
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Index</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Args</TableHead>
                        <TableHead>Topics</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedLogs.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                            暂无日志
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedLogs.items.map((log: any) => {
                          const rawIndex = logObjectIndexMap.get(log) ?? 0;
                          const decoded = decodedLogsByIndex[rawIndex] ?? null;
                          return (
                            <TableRow key={`${log.transactionHash}-${log.logIndex?.toString() ?? "0"}`}>
                              <TableCell>{formatNumber(log.logIndex ?? 0n)}</TableCell>
                              <TableCell>
                                <HashValue value={log.address} href={`/address/${log.address}`} />
                              </TableCell>
                              <TableCell>
                                {decoded ? (
                                  <div className="space-y-1">
                                    <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
                                      {decoded.eventName}
                                    </Badge>
                                    <p className="text-xs text-slate-500">{decoded.abiName}</p>
                                  </div>
                                ) : (
                                  "未匹配"
                                )}
                              </TableCell>
                              <TableCell>
                                {decoded ? (
                                  <pre className="max-w-[280px] overflow-x-auto rounded-md border border-white/75 bg-white/80 p-2 text-xs">
                                    {formatDecodedValue(decoded.args)}
                                  </pre>
                                ) : (
                                  "-"
                                )}
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
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  <TablePaginationBar
                    namespace="txLogs"
                    page={pagedLogs.page}
                    totalPages={pagedLogs.totalPages}
                    total={pagedLogs.total}
                  />
                </div>
              ) : null}

              {activeTab === "transfers" ? (
                <div className="space-y-3">
                  <TableToolbar
                    namespace="txTransfers"
                    filterPlaceholder="筛选 token / from / to"
                    sortOptions={[
                      { value: "value", label: "Value" },
                      { value: "token", label: "Token" },
                      { value: "from", label: "From" },
                    ]}
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedTransfers.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                            暂无 Token Transfer
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedTransfers.items.map((transfer, index) => (
                          <TableRow key={`${transfer.txHash ?? hash}-${index}`}>
                            <TableCell>
                              <HashValue value={transfer.token} href={`/address/${transfer.token}`} />
                            </TableCell>
                            <TableCell>
                              <HashValue value={transfer.from} href={`/address/${transfer.from}`} />
                            </TableCell>
                            <TableCell>
                              <HashValue value={transfer.to} href={`/address/${transfer.to}`} />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{transfer.value.toString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <TablePaginationBar
                    namespace="txTransfers"
                    page={pagedTransfers.page}
                    totalPages={pagedTransfers.totalPages}
                    total={pagedTransfers.total}
                  />
                </div>
              ) : null}

              {activeTab === "calls" ? (
                <div className="space-y-3">
                  {traceResult?.type === "unsupported" ? (
                    <div className="notice">{traceResult.error}</div>
                  ) : (
                    <>
                      <TableToolbar
                        namespace="txCalls"
                        filterPlaceholder="筛选 type / from / to"
                        sortOptions={[
                          { value: "depth", label: "Depth" },
                          { value: "type", label: "Type" },
                          { value: "gas", label: "Gas" },
                        ]}
                      />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Depth</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>From</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Gas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedCalls.items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                暂无内部调用
                              </TableCell>
                            </TableRow>
                          ) : (
                            pagedCalls.items.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>{row.depth}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{row.type ?? "CALL"}</Badge>
                                </TableCell>
                                <TableCell>
                                  {row.from ? <HashValue value={row.from} href={`/address/${row.from}`} /> : "-"}
                                </TableCell>
                                <TableCell>
                                  {row.to ? <HashValue value={row.to} href={`/address/${row.to}`} /> : "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{row.value ?? "-"}</TableCell>
                                <TableCell className="font-mono text-xs">{row.gasUsed ?? row.gas ?? "-"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      <TablePaginationBar
                        namespace="txCalls"
                        page={pagedCalls.page}
                        totalPages={pagedCalls.totalPages}
                        total={pagedCalls.total}
                      />
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}
