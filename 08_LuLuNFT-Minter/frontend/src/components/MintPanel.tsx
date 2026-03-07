"use client";

import NextImage from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConnectWalletDialog } from "@/components/ConnectWalletDialog";
import {
  MintFlowDialog,
  type MintFlowDialogMode,
  type MintFlowLoadingInfo,
  type MintFlowResult
} from "@/components/MintFlowDialog";
import {
  CONTRACTS_READY,
  NFT_ADDRESS,
  RPC_URL,
  nftAbi
} from "@/lib/contracts";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMintFlow } from "@/hooks/useMintFlow";
import { useMarketStore } from "@/store/marketStore";
import { type MintImageItem } from "@/components/mint/types";

// 用于本地 bytecode 能力探测：mintWithURI(string) 的函数选择器
const MINT_WITH_URI_SELECTOR = "0x947b59ae";
// ERC721 Transfer 事件 topic，后续用于从 receipt 中解析 tokenId
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type MintRunContext = {
  startedAt: number;
  requester?: `0x${string}`;
  requestCount: number;
  tokenUris: string[];
  functionName: "mint" | "mintWithURI";
  txHash?: `0x${string}`;
};

const createImageId = () => {
  // 优先使用浏览器原生 UUID，降级到时间戳 + 随机数
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

export const MintPanel = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const bumpRefresh = useMarketStore((state) => state.bumpRefresh);

  const [inputError, setInputError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [nftName, setNftName] = useState("");
  const [nftSymbol, setNftSymbol] = useState("");
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [storageStatus, setStorageStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [mintHash, setMintHash] = useState<`0x${string}` | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flowModalState, setFlowModalState] =
    useState<"idle" | MintFlowDialogMode>("idle");
  const [mintRunContext, setMintRunContext] = useState<MintRunContext | null>(null);
  const [mintResult, setMintResult] = useState<MintFlowResult | null>(null);
  const [imageItem, setImageItem] = useState<MintImageItem | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const lastSuccessHashRef = useRef<string | null>(null);
  const handledResultHashRef = useRef<string | null>(null);

  const imageItems = useMemo(() => (imageItem ? [imageItem] : []), [imageItem]);
  const imageItemsRef = useRef<MintImageItem[]>(imageItems);
  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  const setImageItems = useCallback(
    (
      next:
        | MintImageItem[]
        | ((prev: MintImageItem[]) => MintImageItem[])
    ) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: MintImageItem[]) => MintImageItem[])(
              imageItemsRef.current
            )
          : next;
      setImageItem(resolved[0] ?? null);
    },
    []
  );
  // 当前产品策略为“单图铸造”，这里统一把外部数组操作收敛成单项状态

  const {
    writeContractAsync,
    error: writeError
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
    isError: isConfirmingError,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash: mintHash,
    confirmations: 1,
    pollingInterval: 1000,
    timeout: 120_000
  });

  const hasCustomMetadata = useMemo(
    () => Boolean(nftName || nftSymbol || imageItem),
    [nftName, nftSymbol, imageItem]
  );

  const getEffectiveName = useCallback(
    (item: MintImageItem, index: number) => {
      const custom = item.customName?.trim();
      const fallback = nftName.trim();
      if (!fallback && index >= 0) return "";
      return custom || fallback;
    },
    [nftName]
  );

  const getEffectiveSymbol = useCallback(
    (item: MintImageItem) => {
      const custom = item.customSymbol?.trim();
      return custom || nftSymbol.trim();
    },
    [nftSymbol]
  );

  const {
    uploadCounts,
    uploadPhase,
    uploadStage,
    uploadError,
    setUploadError,
    isCancelling,
    resetUpload,
    cancelUpload,
    startUpload
  } = useMintFlow({
    imageItems,
    setImageItems,
    getEffectiveName,
    getEffectiveSymbol,
    collectionName: "LuLuNFT藏品工坊",
    description: "LuLuNFT藏品工坊 本地铸造"
  });

  const copyToClipboard = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
    } catch {
      setUploadError("复制失败，请手动复制");
    }
  };

  const getErrorMessage = useCallback((error: unknown) => {
    if (error && typeof error === "object") {
      const maybeError = error as { shortMessage?: string; message?: string };
      return maybeError.shortMessage ?? maybeError.message ?? "未知错误";
    }
    if (typeof error === "string") return error;
    return "未知错误";
  }, []);

  const formatChainLabel = (id?: number) =>
    id === 31337 ? "Anvil (31337)" : `Chain ${id ?? "-"}`;

  const parseMintedTokenIds = useCallback(
    (
      logs: Array<{
        address?: `0x${string}` | string;
        topics?: readonly `0x${string}`[] | string[];
      }>
    ) => {
      const tokenIds: string[] = [];
      const targetAddress = NFT_ADDRESS.toLowerCase();
      for (const log of logs) {
        const logAddress = String(log.address ?? "").toLowerCase();
        if (!logAddress || logAddress !== targetAddress) continue;
        const topics = Array.from(log.topics ?? []);
        if (topics.length < 4) continue;
        if (String(topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
        if (String(topics[1]).toLowerCase() !== ZERO_ADDRESS_TOPIC) continue;
        try {
          // topics[3] 是 indexed tokenId，直接转 bigint 再转字符串展示
          tokenIds.push(BigInt(String(topics[3])).toString());
        } catch {
          continue;
        }
      }
      return tokenIds;
    },
    []
  );

  const openFlowError = useCallback(
    (message: string) => {
      const completedAt = Date.now();
      setMintResult({
        txHash: mintRunContext?.txHash ?? mintHash,
        mintCount: 1,
        tokenIds: [],
        tokenUris: mintRunContext?.tokenUris ?? [],
        requester: mintRunContext?.requester ?? address,
        chainLabel: formatChainLabel(chainId),
        completedAt,
        durationMs: mintRunContext ? completedAt - mintRunContext.startedAt : 0,
        error: message
      });
      setFlowModalState("error");
    },
    [mintRunContext, mintHash, address, chainId]
  );

  const closeFlowDialog = useCallback(() => {
    setFlowModalState("idle");
    setMintResult(null);
  }, []);

  const mintLabel = hasCustomMetadata ? "上传并铸造" : "铸造";
  const isUploading = uploadPhase !== null;
  const isBusy = isSubmitting || isConfirming || isUploading;
  const chainError = writeError ?? confirmError;

  const imageStepStatus = useMemo(() => {
    if (uploadCounts.imageTotal === 0) return "idle";
    if (uploadCounts.imageDone >= uploadCounts.imageTotal) return "done";
    if (uploadPhase === "images") return "active";
    return "idle";
  }, [uploadCounts.imageDone, uploadCounts.imageTotal, uploadPhase]);

  const metaStepStatus = useMemo(() => {
    if (uploadCounts.metaTotal === 0) return "idle";
    if (uploadCounts.metaDone >= uploadCounts.metaTotal) return "done";
    if (uploadPhase === "metadata") return "active";
    return "idle";
  }, [uploadCounts.metaDone, uploadCounts.metaTotal, uploadPhase]);

  const chainStepStatus = useMemo(() => {
    if (chainError) return "error";
    if (isSuccess) return "done";
    if (isConfirming) return "active";
    if (mintHash || isSubmitting) return "pending";
    return "idle";
  }, [chainError, isSuccess, isConfirming, mintHash, isSubmitting]);

  const getStepDotClass = (status: string) =>
    cn(
      "h-2 w-2 rounded-full",
      status === "done"
        ? "bg-rose-500"
        : status === "active"
          ? "bg-rose-300"
          : status === "pending"
            ? "bg-rose-200"
            : status === "error"
              ? "bg-rose-500"
              : "bg-slate-300"
    );

  const getStepText = (status: string) => {
    switch (status) {
      case "done":
        return "完成";
      case "active":
        return "进行中";
      case "pending":
        return "待确认";
      case "error":
        return "失败";
      default:
        return "未开始";
    }
  };

  const loadingInfo = useMemo<MintFlowLoadingInfo>(
    () => ({
      stageText: uploadStage,
      imageDone: uploadCounts.imageDone,
      imageTotal: uploadCounts.imageTotal,
      metaDone: uploadCounts.metaDone,
      metaTotal: uploadCounts.metaTotal,
      chainStatusText: getStepText(chainStepStatus),
      txHash: mintHash,
      canCancelUpload: Boolean(uploadPhase),
      isCancelling
    }),
    [
      uploadStage,
      uploadCounts.imageDone,
      uploadCounts.imageTotal,
      uploadCounts.metaDone,
      uploadCounts.metaTotal,
      chainStepStatus,
      mintHash,
      uploadPhase,
      isCancelling
    ]
  );

  useEffect(() => {
    if (writeError) {
      setInputError("发送失败");
      setActionHint("请检查钱包网络与余额");
      setUploadError(getErrorMessage(writeError));
      if (flowModalState === "loading") {
        openFlowError(getErrorMessage(writeError));
      }
    }
  }, [writeError, flowModalState, setUploadError, getErrorMessage, openFlowError]);

  useEffect(() => {
    if (receipt?.status === "reverted") {
      setInputError("执行失败");
      if (flowModalState === "loading") {
        openFlowError("交易执行失败（回滚）");
      }
    } else if (isSuccess && mintHash) {
      if (lastSuccessHashRef.current !== mintHash) {
        lastSuccessHashRef.current = mintHash;
        // 铸造成功后广播全局刷新，让市场/藏品页同步看到新 NFT
        bumpRefresh();
      }
      if (handledResultHashRef.current !== mintHash) {
        handledResultHashRef.current = mintHash;
        const tokenIds = parseMintedTokenIds(
          (receipt?.logs ?? []) as Array<{
            address?: `0x${string}` | string;
            topics?: readonly `0x${string}`[] | string[];
          }>
        );
        const completedAt = Date.now();
        setMintResult({
          txHash: mintHash,
          mintCount: 1,
          tokenIds,
          tokenUris: mintRunContext?.tokenUris ?? [],
          requester: mintRunContext?.requester ?? address,
          chainLabel: formatChainLabel(chainId),
          completedAt,
          durationMs: mintRunContext ? completedAt - mintRunContext.startedAt : 0,
          tokenIdNote:
            tokenIds.length > 0 ? undefined : "未从 Transfer 日志解析到 tokenId"
        });
        setFlowModalState("success");
      }
    }
  }, [
    receipt,
    isSuccess,
    mintHash,
    bumpRefresh,
    flowModalState,
    mintRunContext,
    address,
    chainId,
    parseMintedTokenIds,
    openFlowError
  ]);

  useEffect(() => {
    if (isConfirmingError) {
      setInputError("确认超时");
      setActionHint("请确认钱包网络与 RPC 一致");
      if (confirmError?.message) {
        setUploadError(confirmError.message);
      } else {
        setUploadError(`链 ID：${chainId}，RPC：${RPC_URL}`);
      }
      if (flowModalState === "loading") {
        openFlowError(confirmError?.message ?? "确认超时");
      }
    }
  }, [isConfirmingError, confirmError, chainId, flowModalState, setUploadError, openFlowError]);

  const dataUrlToBlob = async (dataUrl: string) => {
    const response = await fetch(dataUrl);
    return response.blob();
  };

  const compressImage = async (file: File): Promise<MintImageItem> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = async () => {
          // 统一压到最长边 <= 3000，兼顾显示质量与上传体积
          const maxSize = 3000;
          const scale = Math.min(
            1,
            maxSize / Math.max(img.width, img.height)
          );
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("图片处理失败"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/webp", 0.82);
          const bytes = new TextEncoder().encode(compressed).length;
          const sizeKb = Math.max(1, Math.round(bytes / 1024));
          try {
            const blob = await dataUrlToBlob(compressed);
            resolve({
              id: createImageId(),
              name: file.name,
              preview: compressed,
              blob,
              meta: `${sizeKb}KB · webp`
            });
          } catch {
            reject(new Error("图片处理失败"));
          }
        };
        img.onerror = () => reject(new Error("图片读取失败"));
        img.src = String(reader.result);
      };
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });

  const checkStorageStatus = async () => {
    setStorageStatus("checking");
    try {
      const response = await fetch("/api/storage");
      if (!response.ok) {
        setStorageStatus("offline");
        return;
      }
      const payload = (await response.json()) as { online?: boolean };
      setStorageStatus(payload.online ? "online" : "offline");
    } catch {
      setStorageStatus("offline");
    }
  };

  useEffect(() => {
    checkStorageStatus();
  }, []);

  const ensureMintWithUriAvailable = async (): Promise<{
    ok: boolean;
    message?: string;
  }> => {
    if (!publicClient) return { ok: true };
    try {
      const bytecode = await publicClient.getBytecode({
        address: NFT_ADDRESS as `0x${string}`
      });
      if (!bytecode || bytecode === "0x") {
        setInputError("合约无代码");
        setActionHint("请确认已部署 NFT 合约");
        return { ok: false, message: "合约无代码，请确认已部署 NFT 合约" };
      }
      if (!bytecode.toLowerCase().includes(MINT_WITH_URI_SELECTOR.slice(2))) {
        setInputError("不支持 mintWithURI");
        setActionHint("请重新部署最新合约版本");
        return { ok: false, message: "当前合约不支持 mintWithURI" };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "读取合约失败";
      setInputError("合约读取失败");
      setActionHint("请检查 RPC 是否可用");
      setUploadError(message);
      return { ok: false, message: `合约读取失败：${message}` };
    }
    return { ok: true };
  };

  const handleMint = async () => {
    setInputError(null);
    setImageError(null);
    setActionHint(null);
    setMintResult(null);
    setFlowModalState("idle");
    setMintRunContext(null);
    resetUpload();

    if (!isConnected) {
      setShowConnectDialog(true);
      return;
    }
    if (chainId !== 31337) {
      setInputError("请切换到 Anvil（31337）");
      setActionHint("在钱包网络列表中选择 Anvil 本地链");
      return;
    }
    if (!CONTRACTS_READY) {
      setInputError("未配置合约地址");
      setActionHint("请检查 .env.local 中的 NEXT_PUBLIC_NFT_ADDRESS");
      return;
    }
    if (!address) {
      setInputError("请连接钱包");
      setActionHint("点击右上角连接钱包");
      return;
    }
    if (imageItems.length > 1) {
      setInputError("仅支持单张上传");
      setActionHint("请只保留 1 张图片后再铸造");
      return;
    }

    if (hasCustomMetadata) {
      if (!imageItem) {
        setInputError("请选择图片");
        setActionHint("当前仅支持单张图片上传");
        return;
      }
      const missingName = !getEffectiveName(imageItem, 0);
      if (missingName) {
        setInputError("请填写名称");
        setActionHint("请填写默认名称");
        return;
      }
      const missingSymbol = !getEffectiveSymbol(imageItem);
      if (missingSymbol) {
        setInputError("请填写符号");
        setActionHint("请填写默认符号");
        return;
      }
    }

    handledResultHashRef.current = null;
    // 初始化本次铸造会话上下文，供流程弹窗和结果面板复用
    setMintRunContext({
      startedAt: Date.now(),
      requester: address as `0x${string}`,
      requestCount: 1,
      tokenUris: [],
      functionName: hasCustomMetadata ? "mintWithURI" : "mint"
    });
    setFlowModalState("loading");

    let tokenUri: string | null = null;
    if (hasCustomMetadata && imageItem) {
      const availability = await ensureMintWithUriAvailable();
      if (!availability.ok) {
        openFlowError(availability.message ?? "合约能力检查失败");
        return;
      }
      try {
        // 先上传图片与 metadata，拿到 tokenURI 再发起链上 mintWithURI
        const tokenUris = await startUpload();
        tokenUri = tokenUris[0] ?? null;
        if (!tokenUri) {
          throw new Error("未获取 tokenURI");
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "AbortError" || error.message === "已取消")
        ) {
          setInputError("已取消上传");
          setActionHint("可重新选择图片后再尝试");
          openFlowError("已取消上传");
        } else {
          const message = getErrorMessage(error);
          setInputError("上传失败");
          setUploadError(message);
          setActionHint("请确认本地静态资源服务在线");
          openFlowError(`上传失败：${message}`);
        }
        return;
      }
    }

    const functionName: MintRunContext["functionName"] = tokenUri
      ? "mintWithURI"
      : "mint";
    const args = tokenUri ? [tokenUri] : [];
    setMintRunContext((prev) =>
      prev
        ? {
            ...prev,
            tokenUris: tokenUri ? [tokenUri] : [],
            functionName
          }
        : prev
    );

    if (publicClient && address) {
      try {
        // 交易前模拟，优先把可预见错误拦在钱包签名之前
        await publicClient.simulateContract({
          address: NFT_ADDRESS as `0x${string}`,
          abi: nftAbi,
          functionName: functionName as never,
          args: args as never,
          account: address
        });
      } catch (error) {
        const message = getErrorMessage(error);
        setInputError("交易预检失败");
        setUploadError(message);
        setActionHint("请检查网络、余额或合约状态");
        openFlowError(`交易预检失败：${message}`);
        return;
      }
    }

    setMintHash(undefined);
    setIsSubmitting(true);
    try {
      const hash = (await writeContractAsync({
        address: NFT_ADDRESS as `0x${string}`,
        abi: nftAbi,
        functionName: functionName as never,
        args: args as never
      })) as `0x${string}`;
      setMintHash(hash);
      setMintRunContext((prev) => (prev ? { ...prev, txHash: hash } : prev));
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送失败";
      setInputError("发送失败");
      setUploadError(message);
      openFlowError(`发送失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageFiles = async (files: File[]) => {
    if (files.length === 0) {
      setImageItem(null);
      return;
    }
    if (files.length > 1) {
      setImageError("当前仅支持单张上传，请选择 1 张图片");
      setImageItem(null);
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setImageError("仅支持图片文件");
      setImageItem(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError("图片较大，建议 <2MB");
    }

    try {
      const result = await compressImage(file);
      setImageItem(result);
    } catch (error) {
      setImageItem(null);
      setImageError(error instanceof Error ? error.message : "图片处理失败");
    }
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    setImageError(null);
    setInputError(null);
    setActionHint(null);
    setAdvancedOpen(false);
    setIsDragActive(false);
    resetUpload();

    const files = Array.from(input.files ?? []);
    await handleImageFiles(files);
    input.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setImageError(null);
    setInputError(null);
    setActionHint(null);
    setAdvancedOpen(false);
    setIsDragActive(false);
    resetUpload();
    const files = Array.from(event.dataTransfer.files ?? []);
    await handleImageFiles(files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const removeImage = () => {
    setImageItem(null);
    setAdvancedOpen(false);
    setCopiedKey(null);
    setIsDragActive(false);
    resetUpload();
  };

  const walletLabel = isConnected && address ? shortAddress(address) : "未连接钱包";
  const chainLabel = formatChainLabel(chainId);
  const isAnvil = chainId === 31337;
  const storageLabel =
    storageStatus === "checking"
      ? "检测中"
      : storageStatus === "online"
        ? "在线"
        : "离线";
  const readyToMint = Boolean(imageItem && nftName.trim() && nftSymbol.trim());
  const hasAdvancedInfo = Boolean(imageItem?.imageUrl || imageItem?.imagePath);

  return (
    <Card className="animate-rise overflow-hidden border border-slate-200/80 bg-white shadow-[0_24px_48px_-32px_rgba(15,23,42,0.35)]">
      <CardContent className="grid u-gap-6 px-5 pb-5 pt-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start sm:px-6 sm:pb-6 sm:pt-6">
        <div className="u-stack-1 lg:col-span-2">
          <p className="u-text-mini font-semibold uppercase tracking-[0.3em] text-slate-500">
            LuLuNFT Collection Studio
          </p>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            LuLuNFT藏品工坊
          </h2>
          <p className="u-text-meta text-slate-500">
            上传图片并填写元数据后，即可一键发起链上铸造。
          </p>
        </div>

        <section className="u-stack-4 min-w-0">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.12),_transparent_50%)]" />
            <div
              className={cn(
                "relative h-[360px] overflow-hidden rounded-2xl border transition sm:h-[430px] lg:h-[500px]",
                imageItem
                  ? "border-slate-200 bg-white"
                  : isDragActive
                    ? "border-rose-300 bg-rose-50/50"
                    : "border-dashed border-slate-300 bg-white"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {imageItem ? (
                <div className="relative h-full w-full">
                  <NextImage
                    src={imageItem.preview}
                    alt="NFT 预览图"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain p-2 sm:p-3"
                    unoptimized
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/45 to-transparent px-4 pb-3 pt-10">
                    <p className="u-text-meta truncate font-semibold text-white">
                      {imageItem.name}
                    </p>
                  </div>
                  <div className="absolute bottom-3 right-3 z-10">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setAdvancedOpen(true)}
                      className="u-text-mini h-8 rounded-full px-3 shadow-lg"
                    >
                      高级信息
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center u-gap-3 px-6 py-10 text-center">
                  <NextImage
                    src="/picture.svg"
                    alt="上传占位"
                    width={64}
                    height={64}
                    className="h-16 w-16 opacity-70"
                  />
                  <p className="u-text-body font-semibold text-slate-700">
                    拖拽图片到这里，或点击下方按钮上传
                  </p>
                  <p className="u-text-meta max-w-xs text-slate-500">
                    仅支持单张图片，建议尺寸小于 2MB，系统会自动压缩为 webp。
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between u-gap-2">
            <p className="u-text-mini text-slate-500">
              支持拖拽上传，单次仅保留 1 张图片
            </p>
            <div className="flex items-center u-gap-2">
              {imageItem ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={removeImage}
                  className="u-text-mini h-8 rounded-full px-3"
                >
                  清空图片
                </Button>
              ) : null}
              <label className="u-text-mini inline-flex cursor-pointer items-center rounded-full bg-rose-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-rose-600">
                {imageItem ? "重新选择" : "选择图片"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {imageItem ? (
            <div className="u-stack-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between u-gap-2">
                <p className="u-text-meta font-semibold text-slate-700">当前图片</p>
                <span className="u-text-mini rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600">
                  {imageItem.meta}
                </span>
              </div>
              <p className="u-text-meta truncate text-slate-600">{imageItem.name}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <p className="u-text-meta text-slate-500">
                上传后会在这里显示文件信息，并同步到右侧铸造配置。
              </p>
            </div>
          )}

          {imageError ? (
            <div className="u-text-meta rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700">
              {imageError}
            </div>
          ) : null}
        </section>

        <section className="u-stack-4 w-full">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between u-gap-2">
              <p className="u-text-body font-semibold text-slate-900">元数据设置</p>
              <span className="u-text-mini rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600">
                自动生成 tokenURI
              </span>
            </div>
            <div className="mt-4 grid u-gap-3 sm:grid-cols-2">
              <div className="u-stack-2">
                <label className="u-text-mini font-semibold uppercase tracking-[0.2em] text-slate-500">
                  名称
                </label>
                <Input
                  value={nftName}
                  onChange={(event) => setNftName(event.target.value)}
                  placeholder="如 LuLu #001"
                  className="h-10 rounded-xl"
                />
                <p className="u-text-mini text-slate-500">
                  建议包含序号，方便后续市场展示。
                </p>
              </div>
              <div className="u-stack-2">
                <label className="u-text-mini font-semibold uppercase tracking-[0.2em] text-slate-500">
                  符号
                </label>
                <Input
                  value={nftSymbol}
                  onChange={(event) => setNftSymbol(event.target.value)}
                  placeholder="如 LULU"
                  className="h-10 rounded-xl"
                />
                <p className="u-text-mini text-slate-500">
                  建议保持简短，用于链上标识。
                </p>
              </div>
            </div>
          </div>

          <div className="u-stack-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between u-gap-2">
              <p className="u-text-body font-semibold text-slate-900">铸造台速览</p>
              <span className="u-text-mini rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600">
                当前环境
              </span>
            </div>
            <div className="grid u-gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
                  模式
                </p>
                <p className="u-text-meta mt-1 font-semibold text-slate-700">单图上传</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
                  钱包
                </p>
                <p className="u-text-meta mt-1 font-semibold text-slate-700">
                  {walletLabel}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
                  网络
                </p>
                <p className="u-text-meta mt-1 font-semibold text-slate-700">
                  {isAnvil ? "Anvil 31337（就绪）" : `${chainLabel}（需切换）`}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
                  存储
                </p>
                <p className="u-text-meta mt-1 font-semibold text-slate-700">
                  本地静态资源 {storageLabel}
                </p>
              </div>
            </div>
            <p className="u-text-meta text-slate-500">
              流程：上传图片 → 填写名称/符号 → 点击“上传并铸造”。
            </p>
          </div>

          <div className="u-stack-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between u-gap-2">
              <p className="u-text-body font-semibold text-slate-900">流程状态</p>
              {uploadStage ? (
                <span className="u-text-mini text-slate-500">{uploadStage}</span>
              ) : null}
            </div>
            <div className="u-stack-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center u-gap-2">
                  <span className={getStepDotClass(imageStepStatus)} />
                  <span className="u-text-mini font-semibold text-slate-600">
                    上传图片
                  </span>
                </div>
                <span className="u-text-mini text-slate-500">
                  {uploadCounts.imageTotal > 0
                    ? `${uploadCounts.imageDone}/${uploadCounts.imageTotal}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center u-gap-2">
                  <span className={getStepDotClass(metaStepStatus)} />
                  <span className="u-text-mini font-semibold text-slate-600">
                    上传元数据
                  </span>
                </div>
                <span className="u-text-mini text-slate-500">
                  {uploadCounts.metaTotal > 0
                    ? `${uploadCounts.metaDone}/${uploadCounts.metaTotal}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center u-gap-2">
                  <span className={getStepDotClass(chainStepStatus)} />
                  <span className="u-text-mini font-semibold text-slate-600">
                    链上确认
                  </span>
                </div>
                <span className="u-text-mini text-slate-500">
                  {getStepText(chainStepStatus)}
                </span>
              </div>
            </div>
            {uploadPhase ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelUpload}
                  disabled={isCancelling}
                  className="u-text-mini h-7 rounded-full px-3"
                >
                  {isCancelling ? "正在取消" : "取消上传"}
                </Button>
              </div>
            ) : null}

            <div className="u-stack-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
                当前提示
              </p>
              <p className="u-text-meta text-slate-600">
                {readyToMint
                  ? "信息已就绪，可直接发起铸造。"
                  : "请先上传图片并填写名称与符号。"}
              </p>
              {mintHash ? (
                <p className="u-text-mini text-slate-500">
                  交易 {shortAddress(mintHash)}
                </p>
              ) : null}
            </div>
          </div>

          {inputError ? (
            <div className="u-text-meta rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700">
              {inputError}
            </div>
          ) : null}
          {uploadError ? (
            <div className="u-text-meta rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              详情 {uploadError}
            </div>
          ) : null}
          {actionHint ? (
            <p className="u-text-meta px-1 text-slate-500">{actionHint}</p>
          ) : null}

        </section>

        <div className="u-stack-2 rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <Button
            type="button"
            onClick={handleMint}
            disabled={isBusy}
            className="h-11 w-full rounded-xl text-[13px]"
          >
            {isBusy ? "铸造处理中" : mintLabel}
          </Button>
          <p className="u-text-mini text-slate-500">
            {readyToMint ? "配置完成，可发起上链铸造。" : "请先完成图片与元数据配置。"}
          </p>
        </div>
      </CardContent>

      {advancedOpen && imageItem ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 px-4"
          onClick={() => setAdvancedOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between u-gap-3">
              <div>
                <p className="u-text-mini font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Advanced
                </p>
                <h4 className="u-text-body mt-1 font-semibold text-slate-900">
                  当前图片高级信息
                </h4>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAdvancedOpen(false)}
                className="u-text-mini h-8 rounded-full px-3"
              >
                关闭
              </Button>
            </div>

            <div className="u-stack-3 mt-4">
              {imageItem.imageUrl ? (
                <div className="u-stack-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="u-text-mini font-semibold uppercase tracking-[0.18em] text-slate-500">
                    URL
                  </p>
                  <p className="u-text-meta break-all text-slate-700">{imageItem.imageUrl}</p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        copyToClipboard(imageItem.imageUrl ?? "", "url-single")
                      }
                      className="u-text-mini h-7 rounded-full px-3"
                    >
                      {copiedKey === "url-single" ? "已复制" : "复制 URL"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {imageItem.imagePath ? (
                <div className="u-stack-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="u-text-mini font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Path
                  </p>
                  <p className="u-text-meta break-all text-slate-700">{imageItem.imagePath}</p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        copyToClipboard(imageItem.imagePath ?? "", "path-single")
                      }
                      className="u-text-mini h-7 rounded-full px-3"
                    >
                      {copiedKey === "path-single" ? "已复制" : "复制 Path"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!hasAdvancedInfo ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                  <p className="u-text-meta text-slate-600">
                    当前图片暂无 URL/Path 信息。完成上传或铸造后可在此查看。
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConnectWalletDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        description="连接后可发起铸造"
      />
      <MintFlowDialog
        open={flowModalState !== "idle"}
        mode={flowModalState === "idle" ? "loading" : flowModalState}
        loadingInfo={loadingInfo}
        result={mintResult}
        onClose={closeFlowDialog}
        onCancelUpload={uploadPhase ? cancelUpload : undefined}
      />
    </Card>
  );
};
