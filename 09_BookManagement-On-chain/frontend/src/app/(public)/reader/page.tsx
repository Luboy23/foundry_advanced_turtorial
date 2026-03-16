"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBookMetadata } from "@/lib/demo-metadata";
import { formatErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";
import { decodeReaderStatus, registryAbi, registryAddress } from "@/lib/registry";
import { useBorrowRecords } from "@/hooks/use-borrow-records";
import { useRegistryBooks } from "@/hooks/use-registry-books";

// 读者中心页：围绕“注册 + 可借书目 + 个人借阅历史”三个核心读者动作展开。
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export default function ReaderPage() {
  const { address, isConnected } = useAccount();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const connected = isClient && isConnected;
  const walletAddress = isClient ? address : undefined;

  // 页面内筛选条件与交易状态提示。
  const [bookKeyword, setBookKeyword] = useState("");
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyAction, setHistoryAction] = useState<"all" | "borrow" | "return">("all");
  const [registerStatus, setRegisterStatus] = useState("");
  const [registerTxHash, setRegisterTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending: isRegisterPending } = useWriteContract();
  const registerReceiptQuery = useWaitForTransactionReceipt({ hash: registerTxHash });

  // 仅拉取“上架书籍”，避免在读者端出现不可借阅条目。
  const {
    books,
    bookCount,
    loadedBookCount,
    hasMore,
    loadMore,
    isLoading: booksLoading,
    error: booksError,
  } = useRegistryBooks({ onlyActive: true, pageSize: 20 });

  const {
    records,
    hasMore: hasMoreRecords,
    loadMore: loadMoreRecords,
    isLoading: recordsLoading,
    error: recordsError,
    refresh: refreshRecords,
  } = useBorrowRecords();

  // 全局在借数量指标（链上总量）。
  const activeBorrowCountQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "activeBorrowCount",
    query: { enabled: Boolean(registryAddress) },
  });

  const readerStatusQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getReader",
    args: [(walletAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: Boolean(connected && walletAddress && registryAddress) },
  });

  const readerStatus = decodeReaderStatus(readerStatusQuery.data);

  // 建立图书索引，后续搜索与历史记录展示都复用该映射。
  const bookLookup = useMemo(() => {
    const map = new Map<
      string,
      { metadata: ReturnType<typeof getBookMetadata> }
    >();
    books.forEach((book) => {
      map.set(book.id.toString(), { metadata: getBookMetadata(book.metaHash) });
    });
    return map;
  }, [books]);

  const filteredBooks = useMemo(() => {
    const keyword = bookKeyword.trim().toLowerCase();
    if (!keyword) return books;

    // 可借书目搜索支持：书名、作者、图书编号。
    return books.filter((book) => {
      const metadata = bookLookup.get(book.id.toString())?.metadata ?? null;
      const title = metadata?.title?.toLowerCase() ?? "";
      const author = metadata?.author?.toLowerCase() ?? "";
      return (
        title.includes(keyword) ||
        author.includes(keyword) ||
        book.id.toString().includes(keyword)
      );
    });
  }, [bookKeyword, bookLookup, books]);

  // 个人借阅历史：先按当前钱包地址过滤，再叠加动作与关键词筛选。
  const personalRecords = useMemo(() => {
    if (!walletAddress) return [];
    const keyword = historyKeyword.trim().toLowerCase();

    return records.filter((record) => {
      if (record.reader.toLowerCase() !== walletAddress.toLowerCase()) return false;
      if (historyAction === "borrow" && !record.isBorrow) return false;
      if (historyAction === "return" && record.isBorrow) return false;

      if (!keyword) return true;

      // 历史检索同样复用图书名称映射，保证读者端搜索体验一致。
      const metadata = bookLookup.get(record.bookId.toString())?.metadata ?? null;
      const title = metadata?.title?.toLowerCase() ?? "";
      const author = metadata?.author?.toLowerCase() ?? "";

      return (
        title.includes(keyword) ||
        author.includes(keyword) ||
        record.bookId.toString().includes(keyword) ||
        (record.isBorrow ? "borrow" : "return").includes(keyword)
      );
    });
  }, [bookLookup, historyAction, historyKeyword, records, walletAddress]);

  const metrics = useMemo(() => {
    // 指标以“当前已加载书籍”为统计口径，避免给出全链路误导数字。
    const totalCopies = books.reduce((sum, book) => sum + Number(book.totalCopies), 0);
    const availableCopies = books.reduce((sum, book) => sum + Number(book.availableCopies), 0);
    return {
      totalCopies,
      availableCopies,
      activeBorrowCount: Number(activeBorrowCountQuery.data ?? BigInt(0)),
    };
  }, [activeBorrowCountQuery.data, books]);

  // 读者注册交易：提交后通过 receipt 回写状态，避免只看乐观 UI。
  const handleRegisterReader = async () => {
    if (!connected || !walletAddress) {
      setRegisterStatus("请先连接钱包。");
      return;
    }

    if (!registryAddress) {
      setRegisterStatus("系统未完成部署，请联系管理员完成配置。");
      return;
    }

    if (readerStatus?.registered) {
      setRegisterStatus(readerStatus.active ? "当前钱包已注册。" : "当前钱包已停用，请联系馆员。");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: registryAbi,
        functionName: "registerReader",
      });
      setRegisterTxHash(hash);
      setRegisterStatus("已提交注册交易，等待确认。");
    } catch (error) {
      setRegisterStatus(formatErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!registerTxHash || !registerReceiptQuery.isSuccess) return;
    void readerStatusQuery.refetch();
    setRegisterStatus(`注册交易已确认：${registerTxHash}`);
    setRegisterTxHash(undefined);
  }, [readerStatusQuery, registerReceiptQuery.isSuccess, registerTxHash]);

  return (
    <main className="container mx-auto flex w-full flex-col gap-8 px-6 pb-24 pt-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="outline">读者中心</Badge>
          <h1 className="text-3xl font-semibold text-foreground">图书借阅查询</h1>
          <p className="text-sm text-muted-foreground">
            查询馆藏可借情况、完成注册、查看你的链上借阅历史。
          </p>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          {/* 顶部指标卡用于快速感知馆藏规模、可借库存和加载进度 */}
          <div className="grid gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground md:grid-cols-4">
            <div>
              <p className="font-semibold text-foreground">馆藏副本（当前已加载）</p>
              <p className="mt-1">{metrics.totalCopies}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">可借副本（当前已加载）</p>
              <p className="mt-1">{metrics.availableCopies}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">在借数量（全局）</p>
              <p className="mt-1">{metrics.activeBorrowCount}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">书籍加载进度</p>
              <p className="mt-1">
                {loadedBookCount} / {bookCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>读者注册</CardTitle>
          <CardDescription>注册后馆员可在借阅台账中为你登记借还记录。</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 注册区按连接态、加载态、已注册态、可注册态四种状态渲染 */}
          {!connected ? (
            <p className="text-sm text-muted-foreground">请使用右上角钱包按钮连接钱包后完成注册。</p>
          ) : readerStatusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">正在读取注册状态...</p>
          ) : readerStatus?.registered ? (
            <div className="space-y-1 text-sm">
              <p className={readerStatus.active ? "text-emerald-700" : "text-amber-700"}>
                {readerStatus.active
                  ? "当前钱包已注册并处于启用状态。"
                  : "当前钱包已注册，但已被馆员停用。"}
              </p>
              <p className="text-xs text-muted-foreground">
                地址：{walletAddress ? shortenHex(walletAddress, 14, 10) : "--"}
              </p>
            </div>
          ) : (
            <Button type="button" onClick={handleRegisterReader} disabled={isRegisterPending}>
              {isRegisterPending ? "注册中..." : "注册为读者"}
            </Button>
          )}

          {registerStatus && <p className="mt-2 text-xs text-primary">{registerStatus}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>可借阅书目</CardTitle>
          <CardDescription>仅展示当前上架书籍，库存实时来自链上。</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 书目支持关键词搜索与分页加载，避免一次性渲染全量列表 */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              className="md:max-w-sm"
              placeholder="按书名/作者/图书编号搜索"
              value={bookKeyword}
              onChange={(event) => setBookKeyword(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={loadMore} disabled={!hasMore}>
              {hasMore ? "加载更多" : "已加载全部"}
            </Button>
          </div>

          {booksError && <p className="mt-2 text-xs text-destructive">读取失败：{booksError}</p>}

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">图书编号</th>
                  <th className="px-3 py-2">书名</th>
                  <th className="px-3 py-2">作者</th>
                  <th className="px-3 py-2">库存</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {/* 首屏没有数据时同时承载加载态与空结果态 */}
                {filteredBooks.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={4}>
                      {booksLoading ? "加载中..." : "暂无匹配书籍"}
                    </td>
                  </tr>
                )}
                {filteredBooks.map((book) => {
                  const metadata = bookLookup.get(book.id.toString())?.metadata ?? null;
                  return (
                    // 书目展示优先名称，映射缺失时回退默认文案。
                    <tr key={book.id.toString()}>
                      <td className="px-3 py-2 font-semibold text-foreground">#{book.id.toString()}</td>
                      <td className="px-3 py-2 text-foreground">{metadata?.title ?? "未命名书籍"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{metadata?.author ?? "未知作者"}</td>
                      <td className="px-3 py-2 text-foreground">
                        {book.availableCopies.toString()} / {book.totalCopies.toString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>我的借阅历史</CardTitle>
          <CardDescription>记录来自链上借阅流水。</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 历史区支持关键词、动作和分页筛选，便于读者快速定位记录 */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <Input
                className="md:w-60"
                placeholder="按书名/动作/图书编号搜索"
                value={historyKeyword}
                onChange={(event) => setHistoryKeyword(event.target.value)}
              />
              <Select value={historyAction} onValueChange={(value) => setHistoryAction(value as typeof historyAction)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="动作筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部动作</SelectItem>
                  <SelectItem value="borrow">借阅</SelectItem>
                  <SelectItem value="return">归还</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={refreshRecords}>
              刷新历史
            </Button>
            <Button type="button" variant="outline" onClick={loadMoreRecords} disabled={!hasMoreRecords}>
              {hasMoreRecords ? "加载更多" : "已加载全部"}
            </Button>
          </div>

          {recordsError && <p className="mt-2 text-xs text-destructive">读取失败：{recordsError}</p>}

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">图书编号</th>
                  <th className="px-3 py-2">书名</th>
                  <th className="px-3 py-2">动作</th>
                  <th className="px-3 py-2">登记馆员</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {/* 历史空态在首次接入钱包时很常见，需显式提示用户 */}
                {personalRecords.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                      {recordsLoading ? "加载中..." : "暂无借阅记录"}
                    </td>
                  </tr>
                )}
                {personalRecords.map((record) => {
                  const metadata = bookLookup.get(record.bookId.toString())?.metadata ?? null;
                  return (
                    // 时间字段从秒级时间戳转本地时区字符串，便于课堂演示阅读。
                    <tr key={record.id.toString()}>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(Number(record.timestamp) * 1000).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground">#{record.bookId.toString()}</td>
                      <td className="px-3 py-2 text-foreground">{metadata?.title ?? "未命名书籍"}</td>
                      <td className="px-3 py-2 text-foreground">{record.isBorrow ? "借阅" : "归还"}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {shortenHex(record.operator, 10, 6)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
