"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { BatchConfirmItem } from "@/components/admin/book-batch-panel";
import { CatalogTab } from "@/components/admin/tabs/catalog-tab";
import { DashboardTab } from "@/components/admin/tabs/dashboard-tab";
import { LoansTab } from "@/components/admin/tabs/loans-tab";
import { ReadersTab } from "@/components/admin/tabs/readers-tab";
import type { DemoBook } from "@/components/admin/types";
import { StatusPanel } from "@/components/status-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBookMetadata, upsertLocalMetadata } from "@/lib/demo-metadata";
import { formatErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";
import { buildHash } from "@/lib/hash";
import { TARGET_CHAIN_ID, registryAbi, registryAddress, zeroHash, type RegistryBook } from "@/lib/registry";
import { DEFAULT_CLASSIC_BORROW_POLICY, WORLD_CLASSIC_SEEDS } from "@/lib/world-classics";
import { useAdminWriteGuard } from "@/hooks/use-admin-write-guard";
import { useBatchRegister } from "@/hooks/use-batch-register";
import { useBorrowRecords } from "@/hooks/use-borrow-records";
import { useRegisteredReaders } from "@/hooks/use-registered-readers";
import { useRegistryBooks } from "@/hooks/use-registry-books";

// 管理控制台页：集中处理馆藏、借还、读者三类写链动作及其链上回显。
// 馆员工作台主页：聚合四个业务 Tab，并统一管理写链状态与刷新策略。
type ConsoleTab = "dashboard" | "catalog" | "loans" | "readers";
type LoanAction = "borrow" | "return";

// 前端输入约束：提前拦截异常数据，减少交易回退成本。
const BOOK_FIELD_LIMITS = {
  title: 120,
  author: 80,
  isbn: 32,
  category: 40,
  summary: 2000,
  policy: 1000,
};

const NAV_ITEMS: { key: ConsoleTab; label: string; desc: string }[] = [
  { key: "dashboard", label: "仪表盘", desc: "业务概览与近期动态" },
  { key: "catalog", label: "馆藏管理", desc: "上架、库存与状态管理" },
  { key: "loans", label: "借阅台账", desc: "借还登记与流水筛选" },
  { key: "readers", label: "读者管理", desc: "注册读者列表与启停" },
];

// 为哈希加入随机盐，避免相同内容生成完全相同摘要。
const ensureSalt = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `0x${Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
};

// 图书展示名称构造：优先链下 metadata，缺失时回退到图书编号。
const toBookLabel = (book: RegistryBook) => {
  const metadata = getBookMetadata(book.metaHash);
  if (!metadata) return `图书 #${book.id.toString()}`;
  return `${metadata.title} · ${metadata.author}`;
};

// 日期筛选统一转时间戳；非法输入返回 null 表示“不参与筛选”。
const parseDate = (value: string) => {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  return ts;
};

// 批量草稿默认行。
const createEmptyBatchDraft = (): DemoBook => ({
  title: "",
  author: "",
  isbn: "",
  category: "",
  summary: "",
  policy: "",
  totalCopies: "1",
});

export default function AdminPage() {
  const { address: walletAddress, isConnected } = useAccount();
  const { ensureReady, hasPermission, chainId, isCheckingPermission } = useAdminWriteGuard();

  const [activeTab, setActiveTab] = useState<ConsoleTab>("dashboard");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [batchDrafts, setBatchDrafts] = useState<DemoBook[]>([]);
  const [batchStatus, setBatchStatus] = useState("");
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);

  const [bookSearch, setBookSearch] = useState("");
  const [loanSearchReader, setLoanSearchReader] = useState("all");
  const [loanSearchBook, setLoanSearchBook] = useState("all");
  const [loanSearchAction, setLoanSearchAction] = useState<"all" | LoanAction>("all");
  const [loanDateFrom, setLoanDateFrom] = useState("");
  const [loanDateTo, setLoanDateTo] = useState("");

  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    summary: "",
    policy: "",
    totalCopies: "1",
  });

  const [inventoryForm, setInventoryForm] = useState({
    bookId: "",
    totalCopies: "",
  });

  const [activeForm, setActiveForm] = useState({
    bookId: "",
    active: true,
  });

  const [loanForm, setLoanForm] = useState({
    reader: "",
    bookId: "",
    action: "borrow" as LoanAction,
  });

  // 三类核心读数据：馆藏、读者、借阅流水。
  const {
    books,
    bookCount,
    loadedBookCount,
    hasMore,
    isLoading: booksLoading,
    isLoadingMore,
    error: booksError,
    loadMore,
    refresh: refreshBooks,
  } = useRegistryBooks({ pageSize: 20 });

  const {
    readers,
    activeReaders,
    isLoading: readersLoading,
    error: readersError,
    refresh: refreshReaders,
  } = useRegisteredReaders();

  const {
    records,
    latestRecords,
    hasMore: hasMoreBorrowRecords,
    loadMore: loadMoreBorrowRecords,
    isLoading: recordsLoading,
    error: recordsError,
    refresh: refreshRecords,
  } = useBorrowRecords();

  const activeBorrowCountQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "activeBorrowCount",
    query: { enabled: Boolean(registryAddress) },
  });

  const activeBorrowCount = Number(activeBorrowCountQuery.data ?? BigInt(0));

  // 交易四态：
  // signing -> isPending
  // pending(链上确认中) -> isConfirming
  // success -> receiptQuery.isSuccess 且写入状态文案
  // error -> submitWithGuard 捕获并统一回显
  const { writeContractAsync, isPending } = useWriteContract();
  const { submitBatch, isPending: isBatchSubmitting } = useBatchRegister();
  const receiptQuery = useWaitForTransactionReceipt({ hash: txHash });
  const isConfirming = receiptQuery.isLoading;
  const isWriteBusy = isPending || isBatchSubmitting;

  useEffect(() => {
    if (!txHash || !receiptQuery.isSuccess) return;
    refreshBooks();
    refreshReaders();
    refreshRecords();
    void activeBorrowCountQuery.refetch();
    setStatus(`交易已确认：${txHash}`);
    setTxHash(undefined);
  }, [
    activeBorrowCountQuery,
    receiptQuery.isSuccess,
    refreshBooks,
    refreshReaders,
    refreshRecords,
    txHash,
  ]);

  const readerOptionList = useMemo(
    () =>
      activeReaders.map((row) => ({
        value: row.reader,
        label: shortenHex(row.reader, 10, 6),
      })),
    [activeReaders]
  );

  // 当读者列表变化时，自动修正借阅表单中的 reader 选项，避免悬空值。
  useEffect(() => {
    if (!readerOptionList.length) {
      if (loanForm.reader) {
        setLoanForm((prev) => ({ ...prev, reader: "" }));
      }
      return;
    }

    if (!loanForm.reader || !readerOptionList.find((item) => item.value === loanForm.reader)) {
      setLoanForm((prev) => ({ ...prev, reader: readerOptionList[0].value }));
    }
  }, [loanForm.reader, readerOptionList]);

  const bookOptionList = useMemo(
    () =>
      books.map((book) => ({
        value: book.id.toString(),
        label: toBookLabel(book),
        active: book.active,
      })),
    [books]
  );

  // 书籍列表变化时，同步修正状态管理、库存调整、借还登记三个表单默认值。
  useEffect(() => {
    if (!bookOptionList.length) {
      setActiveForm((prev) => ({ ...prev, bookId: "" }));
      setInventoryForm((prev) => ({ ...prev, bookId: "", totalCopies: "" }));
      setLoanForm((prev) => ({ ...prev, bookId: "" }));
      return;
    }

    if (!activeForm.bookId || !bookOptionList.find((row) => row.value === activeForm.bookId)) {
      setActiveForm((prev) => ({ ...prev, bookId: bookOptionList[0].value }));
    }

    if (!inventoryForm.bookId || !bookOptionList.find((row) => row.value === inventoryForm.bookId)) {
      const nextBookId = bookOptionList[0].value;
      const selected = books.find((book) => book.id.toString() === nextBookId);
      setInventoryForm({
        bookId: nextBookId,
        totalCopies: selected ? selected.totalCopies.toString() : "",
      });
    }

    if (!loanForm.bookId || !bookOptionList.find((row) => row.value === loanForm.bookId)) {
      setLoanForm((prev) => ({ ...prev, bookId: bookOptionList[0].value }));
    }
  }, [activeForm.bookId, bookOptionList, books, inventoryForm.bookId, loanForm.bookId]);

  const filteredBooks = useMemo(() => {
    const keyword = bookSearch.trim().toLowerCase();
    if (!keyword) return books;
    return books.filter((book) => {
      const metadata = getBookMetadata(book.metaHash);
      const title = metadata?.title?.toLowerCase() ?? "";
      const author = metadata?.author?.toLowerCase() ?? "";
      return (
        title.includes(keyword) ||
        author.includes(keyword) ||
        book.id.toString().includes(keyword)
      );
    });
  }, [bookSearch, books]);

  // 仪表盘统计值：当前加载书籍范围下的总量、可借量、在借估算等。
  const metrics = useMemo(() => {
    const loadedTotal = books.reduce((sum, book) => sum + Number(book.totalCopies), 0);
    const loadedAvailable = books.reduce((sum, book) => sum + Number(book.availableCopies), 0);
    const loadedBorrowing = loadedTotal - loadedAvailable;
    return {
      loadedTotal,
      loadedAvailable,
      loadedBorrowing,
      activeReaderCount: activeReaders.length,
    };
  }, [activeReaders.length, books]);

  const bookLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    books.forEach((book) => {
      map.set(book.id.toString(), toBookLabel(book));
    });
    return map;
  }, [books]);

  const filteredRecords = useMemo(() => {
    const fromTs = parseDate(loanDateFrom);
    const toTs = parseDate(loanDateTo);

    return records.filter((record) => {
      if (loanSearchReader !== "all" && record.reader.toLowerCase() !== loanSearchReader.toLowerCase()) {
        return false;
      }
      if (loanSearchBook !== "all" && record.bookId.toString() !== loanSearchBook) {
        return false;
      }
      if (loanSearchAction !== "all") {
        if (loanSearchAction === "borrow" && !record.isBorrow) return false;
        if (loanSearchAction === "return" && record.isBorrow) return false;
      }

      const ts = Number(record.timestamp) * 1000;
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs + 24 * 60 * 60 * 1000 - 1) return false;

      return true;
    });
  }, [loanDateFrom, loanDateTo, loanSearchAction, loanSearchBook, loanSearchReader, records]);

  const batchConfirmItems = useMemo<BatchConfirmItem[]>(
    () =>
      batchDrafts.map((book) => ({
        title: book.title.trim(),
        author: book.author.trim(),
        isbn: book.isbn?.trim(),
        category: book.category?.trim(),
        totalCopies: Number(book.totalCopies),
      })),
    [batchDrafts]
  );

  const validateBatchDrafts = () => {
    if (batchDrafts.length === 0) {
      return "批量清单为空，请先添加书目。";
    }

    for (let index = 0; index < batchDrafts.length; index++) {
      const row = batchDrafts[index];
      const title = row.title.trim();
      const author = row.author.trim();
      const summary = row.summary.trim();
      const isbn = row.isbn?.trim() ?? "";
      const category = row.category?.trim() ?? "";
      const policy = row.policy?.trim() ?? "";
      const totalCopies = Number(row.totalCopies);
      const rowIndex = index + 1;

      if (!title || !author || !summary) {
        return `第 ${rowIndex} 条缺少必填信息（书名/作者/简介）。`;
      }
      if (!Number.isInteger(totalCopies) || totalCopies <= 0) {
        return `第 ${rowIndex} 条库存必须是大于 0 的整数。`;
      }
      if (title.length > BOOK_FIELD_LIMITS.title || author.length > BOOK_FIELD_LIMITS.author) {
        return `第 ${rowIndex} 条书名或作者长度超限。`;
      }
      if (isbn.length > BOOK_FIELD_LIMITS.isbn || category.length > BOOK_FIELD_LIMITS.category) {
        return `第 ${rowIndex} 条 ISBN 或分类长度超限。`;
      }
      if (summary.length > BOOK_FIELD_LIMITS.summary || policy.length > BOOK_FIELD_LIMITS.policy) {
        return `第 ${rowIndex} 条简介或借阅规则长度超限。`;
      }
    }

    return "";
  };

  const canWrite = hasPermission && !isCheckingPermission;

  // 所有写链动作统一走权限闸门 + 异常格式化，保持交互一致性。
  const submitWithGuard = async (runner: () => Promise<void>) => {
    const ready = ensureReady();
    if (!ready.ok) {
      setStatus(ready.message);
      return;
    }

    try {
      await runner();
    } catch (error) {
      setStatus(formatErrorMessage(error));
    }
  };

  const handleFillWorldClassics = () => {
    setBatchDrafts(
      WORLD_CLASSIC_SEEDS.map((book) => ({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        category: book.category,
        summary: book.summary,
        policy: DEFAULT_CLASSIC_BORROW_POLICY,
        totalCopies: book.totalCopies.toString(),
      }))
    );
    setBatchStatus("已填入20条世界名著草稿，请检查后提交。");
    setIsBatchConfirmOpen(false);
  };

  const handleAddBatchDraft = () => {
    setBatchDrafts((prev) => [...prev, createEmptyBatchDraft()]);
  };

  const handleClearBatchDrafts = () => {
    setBatchDrafts([]);
    setBatchStatus("已清空批量草稿。");
    setIsBatchConfirmOpen(false);
  };

  const handleRemoveBatchDraft = (index: number) => {
    setBatchDrafts((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleUpdateBatchDraft = (index: number, patch: Partial<DemoBook>) => {
    setBatchDrafts((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  };

  const handleRequestBatchSubmit = () => {
    const ready = ensureReady();
    if (!ready.ok) {
      setStatus(ready.message);
      return;
    }

    const validationError = validateBatchDrafts();
    if (validationError) {
      setBatchStatus(validationError);
      return;
    }

    setBatchStatus(`已通过校验，共 ${batchDrafts.length} 本，确认后将一次签名上链。`);
    setIsBatchConfirmOpen(true);
  };

  const handleConfirmBatchSubmit = async () => {
    await submitWithGuard(async () => {
      if (!walletAddress) {
        setBatchStatus("请先连接管理员钱包。");
        return;
      }
      if (!registryAddress) {
        setBatchStatus("系统未完成部署，请联系管理员完成配置。");
        return;
      }

      const validationError = validateBatchDrafts();
      if (validationError) {
        setBatchStatus(validationError);
        return;
      }

      const contentHashes: `0x${string}`[] = [];
      const metaHashes: `0x${string}`[] = [];
      const policyHashes: `0x${string}`[] = [];
      const totalCopiesList: number[] = [];
      const localMetadataRows: { metaHash: `0x${string}`; title: string; author: string }[] = [];

      for (const row of batchDrafts) {
        const title = row.title.trim();
        const author = row.author.trim();
        const summary = row.summary.trim();
        const isbn = row.isbn?.trim() ?? "";
        const category = row.category?.trim() ?? "";
        const policy = row.policy?.trim() ?? "";
        const totalCopies = Number(row.totalCopies);

        const salt = ensureSalt();
        const contentHash = buildHash(summary, salt) as `0x${string}`;
        const metaPayload = JSON.stringify({ title, author, isbn, category });
        const metaHash = buildHash(metaPayload, salt) as `0x${string}`;
        const policyHash = policy ? (buildHash(policy, salt) as `0x${string}`) : zeroHash;

        contentHashes.push(contentHash);
        metaHashes.push(metaHash);
        policyHashes.push(policyHash);
        totalCopiesList.push(totalCopies);
        localMetadataRows.push({ metaHash, title, author });
      }

      setBatchStatus(`正在提交批量交易（${batchDrafts.length} 本）...`);
      const result = await submitBatch({
        address: registryAddress as `0x${string}`,
        walletAddress: walletAddress as `0x${string}`,
        contentHashes,
        metaHashes,
        policyHashes,
        totalCopiesList,
      });

      if (!result.ok) {
        setBatchStatus(result.message);
        return;
      }

      localMetadataRows.forEach((row) => {
        upsertLocalMetadata(row.metaHash, { title: row.title, author: row.author });
      });

      setIsBatchConfirmOpen(false);
      setTxHash(result.txHash);
      setBatchStatus(`批量上架已提交：${batchDrafts.length} 本，等待链上确认。`);
      setStatus(`已提交批量上架交易（${batchDrafts.length} 本），等待确认。`);
    });
  };

  const handleRegisterBook = async () => {
    await submitWithGuard(async () => {
      const title = bookForm.title.trim();
      const author = bookForm.author.trim();
      const summary = bookForm.summary.trim();
      const isbn = bookForm.isbn.trim();
      const category = bookForm.category.trim();
      const policy = bookForm.policy.trim();
      const totalCopies = Number(bookForm.totalCopies);

      if (!title || !author || !summary) {
        setStatus("请填写书名、作者、简介。");
        return;
      }
      if (!Number.isInteger(totalCopies) || totalCopies <= 0) {
        setStatus("库存必须是大于 0 的整数。");
        return;
      }
      if (title.length > BOOK_FIELD_LIMITS.title || author.length > BOOK_FIELD_LIMITS.author) {
        setStatus("书名或作者长度超限。");
        return;
      }
      if (isbn.length > BOOK_FIELD_LIMITS.isbn || category.length > BOOK_FIELD_LIMITS.category) {
        setStatus("ISBN 或分类长度超限。");
        return;
      }
      if (summary.length > BOOK_FIELD_LIMITS.summary || policy.length > BOOK_FIELD_LIMITS.policy) {
        setStatus("简介或借阅规则长度超限。");
        return;
      }

      const salt = ensureSalt();
      const contentHash = buildHash(summary, salt);
      const metaPayload = JSON.stringify({ title, author, isbn, category });
      const metaHash = buildHash(metaPayload, salt);
      const policyHash = policy ? buildHash(policy, salt) : zeroHash;

      const hash = await writeContractAsync({
        address: registryAddress as `0x${string}`,
        abi: registryAbi,
        functionName: "registerBook",
        args: [
          contentHash as `0x${string}`,
          metaHash as `0x${string}`,
          policyHash as `0x${string}`,
          BigInt(totalCopies),
        ],
      });

      upsertLocalMetadata(metaHash, { title, author });
      setTxHash(hash);
      setStatus("已提交上架交易，等待确认。");
      setBookForm({
        title: "",
        author: "",
        isbn: "",
        category: "",
        summary: "",
        policy: "",
        totalCopies: "1",
      });
    });
  };

  const handleSetBookActive = async () => {
    await submitWithGuard(async () => {
      if (!activeForm.bookId) {
        setStatus("请选择要修改状态的书籍。");
        return;
      }

      const hash = await writeContractAsync({
        address: registryAddress as `0x${string}`,
        abi: registryAbi,
        functionName: "setBookActive",
        args: [BigInt(activeForm.bookId), activeForm.active],
      });

      setTxHash(hash);
      setStatus("已提交书籍状态更新，等待确认。");
    });
  };

  const handleSetInventory = async () => {
    await submitWithGuard(async () => {
      if (!inventoryForm.bookId) {
        setStatus("请选择书籍。");
        return;
      }
      const totalCopies = Number(inventoryForm.totalCopies);
      if (!Number.isInteger(totalCopies) || totalCopies < 0) {
        setStatus("库存必须是大于等于 0 的整数。");
        return;
      }

      const hash = await writeContractAsync({
        address: registryAddress as `0x${string}`,
        abi: registryAbi,
        functionName: "setBookTotalCopies",
        args: [BigInt(inventoryForm.bookId), BigInt(totalCopies)],
      });

      setTxHash(hash);
      setStatus("已提交库存调整，等待确认。");
    });
  };

  const handleSubmitLoan = async () => {
    await submitWithGuard(async () => {
      if (!loanForm.reader || !loanForm.bookId) {
        setStatus("请选择读者和书籍。");
        return;
      }

      const hash = await writeContractAsync({
        address: registryAddress as `0x${string}`,
        abi: registryAbi,
        functionName: loanForm.action === "borrow" ? "borrowBook" : "returnBook",
        args: [loanForm.reader as `0x${string}`, BigInt(loanForm.bookId)],
      });

      setTxHash(hash);
      setStatus(loanForm.action === "borrow" ? "已提交借阅登记，等待确认。" : "已提交归还登记，等待确认。");
    });
  };

  const handleToggleReader = async (reader: `0x${string}`, active: boolean) => {
    await submitWithGuard(async () => {
      const hash = await writeContractAsync({
        address: registryAddress as `0x${string}`,
        abi: registryAbi,
        functionName: "setReaderActive",
        args: [reader, active],
      });

      setTxHash(hash);
      setStatus(`已提交读者状态更新：${shortenHex(reader, 10, 6)}。`);
    });
  };

  const sectionTitle = NAV_ITEMS.find((item) => item.key === activeTab)?.label ?? "管理控制台";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">馆员工作台</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">图书借阅管理平台</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              面向馆员的链上业务后台：馆藏、库存、借阅台账与读者状态统一管理。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">网络</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {chainId === TARGET_CHAIN_ID ? `Anvil ${TARGET_CHAIN_ID}` : chainId ? `Chain ${chainId}` : "未连接"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">合约</p>
            <p className="mt-2 font-mono text-sm text-foreground">
              {registryAddress ? shortenHex(registryAddress, 12, 8) : "未配置"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">钱包</p>
            <p className="mt-2 font-mono text-sm text-foreground">
              {isConnected && walletAddress ? shortenHex(walletAddress, 12, 8) : "未连接"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">权限</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {isCheckingPermission ? "校验中" : hasPermission ? "馆员权限" : "只读访问"}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-3">
        {/* Tab 导航只做视图切换，真正业务数据保持在父级统一维护 */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`min-w-[220px] flex-1 rounded-lg px-3 py-2 text-left transition ${
                activeTab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/40 text-foreground hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className={`mt-1 text-xs ${activeTab === item.key ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {item.desc}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">{sectionTitle}</h2>
          <Badge variant="outline">业务模式</Badge>
        </div>

        {activeTab === "dashboard" && (
          <DashboardTab
            loadedBookCount={loadedBookCount}
            bookCount={bookCount}
            metrics={metrics}
            readersCount={readers.length}
            activeBorrowCount={activeBorrowCount}
            latestRecords={latestRecords}
            bookLabelMap={bookLabelMap}
            onRefreshRecords={refreshRecords}
          />
        )}

        {activeTab === "catalog" && (
          <CatalogTab
            bookForm={bookForm}
            onBookFormChange={(patch) => setBookForm((prev) => ({ ...prev, ...patch }))}
            onRegisterBook={handleRegisterBook}
            canWrite={canWrite}
            isWriteBusy={isWriteBusy}
            onFillWorldClassics={handleFillWorldClassics}
            batchDrafts={batchDrafts}
            batchStatus={batchStatus}
            onAddBatchDraft={handleAddBatchDraft}
            onClearBatchDrafts={handleClearBatchDrafts}
            onRemoveBatchDraft={handleRemoveBatchDraft}
            onUpdateBatchDraft={handleUpdateBatchDraft}
            onRequestBatchSubmit={handleRequestBatchSubmit}
            onConfirmBatchSubmit={handleConfirmBatchSubmit}
            onCancelBatchSubmit={() => setIsBatchConfirmOpen(false)}
            isBatchConfirmOpen={isBatchConfirmOpen}
            batchConfirmItems={batchConfirmItems}
            activeForm={activeForm}
            onActiveFormChange={(patch) => setActiveForm((prev) => ({ ...prev, ...patch }))}
            onSetBookActive={handleSetBookActive}
            inventoryForm={inventoryForm}
            onInventoryFormChange={(patch) => setInventoryForm((prev) => ({ ...prev, ...patch }))}
            onInventoryBookChange={(value) => {
              const selected = books.find((book) => book.id.toString() === value);
              setInventoryForm({
                bookId: value,
                totalCopies: selected ? selected.totalCopies.toString() : "",
              });
            }}
            onSetInventory={handleSetInventory}
            bookOptionList={bookOptionList}
            bookSearch={bookSearch}
            onBookSearchChange={setBookSearch}
            onLoadMoreBooks={loadMore}
            hasMoreBooks={hasMore}
            isLoadingMoreBooks={isLoadingMore}
            booksLoading={booksLoading}
            booksError={booksError}
            filteredBooks={filteredBooks}
            toBookLabel={toBookLabel}
          />
        )}

        {activeTab === "loans" && (
          <LoansTab
            loanForm={loanForm}
            onLoanFormChange={(patch) => setLoanForm((prev) => ({ ...prev, ...patch }))}
            onSubmitLoan={handleSubmitLoan}
            canWrite={canWrite}
            isWriteBusy={isWriteBusy}
            readerOptionList={readerOptionList}
            bookOptionList={bookOptionList}
            readersLoading={readersLoading}
            booksLoading={booksLoading}
            loanSearchReader={loanSearchReader}
            onLoanSearchReaderChange={setLoanSearchReader}
            loanSearchBook={loanSearchBook}
            onLoanSearchBookChange={setLoanSearchBook}
            loanSearchAction={loanSearchAction}
            onLoanSearchActionChange={setLoanSearchAction}
            loanDateFrom={loanDateFrom}
            onLoanDateFromChange={setLoanDateFrom}
            loanDateTo={loanDateTo}
            onLoanDateToChange={setLoanDateTo}
            onRefreshRecords={refreshRecords}
            onLoadMoreRecords={loadMoreBorrowRecords}
            hasMoreRecords={hasMoreBorrowRecords}
            recordsError={recordsError}
            recordsLoading={recordsLoading}
            filteredRecords={filteredRecords}
            readers={readers}
            books={books}
            toBookLabel={toBookLabel}
            bookLabelMap={bookLabelMap}
          />
        )}

        {activeTab === "readers" && (
          <ReadersTab
            readers={readers}
            readersLoading={readersLoading}
            readersError={readersError}
            canWrite={canWrite}
            isWriteBusy={isWriteBusy}
            onRefreshReaders={refreshReaders}
            onToggleReader={handleToggleReader}
          />
        )}
      </div>

      <StatusPanel message={status} isLoading={isConfirming} />
    </div>
  );
}
