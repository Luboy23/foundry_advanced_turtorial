"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { GameContext } from "@/context/game-context";
import { ANVIL_CHAIN_ID, getExplorerTxUrl } from "@/lib/chain";
import {
  SCORE_CONTRACT_ABI,
  SCORE_CONTRACT_ADDRESS,
  isZeroAddress,
} from "@/lib/contract";
import { shortenAddress } from "@/lib/format";
import { formatTxError } from "@/lib/tx-errors";

type AutoSubmitterProps = {
  onSubmitted?: () => void;
};

type SubmitStage =
  | "idle"
  | "awaiting_signature"
  | "broadcasted"
  | "confirming"
  | "success"
  | "error";

export default function AutoSubmitter({ onSubmitted }: AutoSubmitterProps) {
  const {
    score,
    status,
    submissionRequired,
    markScoreSubmitted,
    durationSeconds,
  } = useContext(GameContext);
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { writeContractAsync } = useWriteContract();
  // 公共客户端：只读调用与等待交易回执
  const publicClient = usePublicClient({ chainId: ANVIL_CHAIN_ID });

  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<SubmitStage>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 防止同一局在重渲染时触发重复自动提交。
  const attemptedRef = useRef(false);

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === "injected"),
    [connectors]
  );

  // 合约地址是否已配置
  const hasContract = !isZeroAddress(SCORE_CONTRACT_ADDRESS);
  // 只有“对局已结束 + 有有效分数 + 需要提交”才会进入自动上链流程。
  const canAutoSubmit = submissionRequired && status !== "playing" && score > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 新开一局后重置提交状态机，避免沿用上一局的错误/哈希信息。
    if (status === "playing" && !submissionRequired) {
      attemptedRef.current = false;
      setError(null);
      setIsSubmitting(false);
      setStage("idle");
      setTxHash(null);
    }
  }, [status, submissionRequired]);

  const submitScore = useCallback(async () => {
    if (!hasContract) {
      setError("未读取到合约地址，请检查 frontend/.env.local 并重启前端。");
      return;
    }

    if (!injectedConnector) {
      setError("未检测到浏览器钱包，请安装 MetaMask 等扩展。");
      return;
    }

    // 未连接钱包时先发起连接
    if (!isConnected) {
      try {
        await connectAsync({ connector: injectedConnector });
      } catch (connectError) {
        setError(formatTxError(connectError));
        return;
      }
    }

    // 校验链 ID，确保与本地 Anvil 一致
    if (chainId !== ANVIL_CHAIN_ID) {
      setError("请将钱包切换到本地 Anvil 网络（Chain ID 31337）。");
      return;
    }

    const scoreValue = BigInt(score);
    // 前端侧做一次数值边界保护，减少无效交易。
    if (scoreValue <= BigInt(0)) {
      setError("分数为 0，无法提交。");
      return;
    }
    const maxUint64 = (BigInt(1) << BigInt(64)) - BigInt(1);
    if (scoreValue > maxUint64) {
      setError("分数超出合约范围，请缩小数值后重试。");
      return;
    }

    const durationValue = BigInt(Math.max(durationSeconds, 0));
    const maxUint32 = BigInt(0xffffffff);
    if (durationValue > maxUint32) {
      setError("用时超出合约范围，请缩短后重试。");
      return;
    }
    const durationArg = Number(durationValue);

    setError(null);
    setIsSubmitting(true);
    // 先进入“等待签名”，便于 UI 明确引导用户操作钱包。
    setStage("awaiting_signature");
    try {
      // 写交易：提交成绩到链上
      const hash = await writeContractAsync({
        address: SCORE_CONTRACT_ADDRESS as `0x${string}`,
        abi: SCORE_CONTRACT_ABI,
        functionName: "submitScore",
        args: [scoreValue, durationArg],
      });
      setTxHash(hash);
      setStage("broadcasted");
      if (publicClient) {
        setStage("confirming");
        // 等待交易上链，避免 UI 提前显示成功
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const receiptStatus = receipt.status;
        const reverted =
          (typeof receiptStatus === "string" && receiptStatus === "reverted") ||
          (typeof receiptStatus === "number" && receiptStatus === 0) ||
          (typeof receiptStatus === "bigint" &&
            receiptStatus === BigInt(0));
        if (reverted) {
          setError(
            "交易已回滚，可能是合约地址/ABI 不匹配或本地链已重启，请重新部署并重启前端。"
          );
          setStage("error");
          return;
        }
      }
      markScoreSubmitted();
      // 只有交易确认通过后才标记成功并触发排行榜/历史刷新。
      setStage("success");
      onSubmitted?.();
    } catch (submitError) {
      setError(formatTxError(submitError));
      setStage("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    chainId,
    connectAsync,
    durationSeconds,
    hasContract,
    injectedConnector,
    isConnected,
    markScoreSubmitted,
    onSubmitted,
    publicClient,
    score,
    writeContractAsync,
  ]);

  useEffect(() => {
    if (!mounted || !canAutoSubmit || attemptedRef.current) {
      return;
    }
    // 自动提交流程在每局只触发一次；失败后需用户主动重试。
    attemptedRef.current = true;
    setError(null);
    void submitScore();
  }, [mounted, canAutoSubmit, submitScore]);

  if (!mounted) {
    return null;
  }

  if (
    !canAutoSubmit &&
    !error &&
    !isSubmitting &&
    !isConnecting &&
    stage === "idle"
  ) {
    return null;
  }

  const explorerUrl = txHash
    ? getExplorerTxUrl(chainId, txHash)
    : null;

  const handleCopy = async () => {
    if (!txHash || typeof navigator === "undefined") {
      return;
    }
    await navigator.clipboard?.writeText(txHash);
  };

  const statusMessage = isConnecting
    ? "正在连接钱包..."
    : stage === "awaiting_signature"
    ? "等待钱包签名确认..."
    : stage === "broadcasted"
    ? "交易已发送，等待打包..."
    : stage === "confirming"
    ? "区块确认中..."
    : stage === "success"
    ? "交易已打包，成绩已成功上链。"
    : "请在钱包中确认交易以提交成绩。";

  return (
    <div className="mt-4 w-[296px] md:w-[480px]">
      <div className="rounded-md border border-[var(--secondary-background)] bg-white px-4 py-3 text-sm text-[var(--primary-text-color)]">
        {error ? (
          <div className="flex flex-col gap-2">
            <div className="text-red-600">提交失败：{error}</div>
            <button
              type="button"
              onClick={() => {
                attemptedRef.current = false;
                setError(null);
                void submitScore();
              }}
              className="self-start rounded bg-[var(--button-background)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--secondary-text-color)]"
            >
              重新尝试提交
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div>{statusMessage}</div>
            {txHash && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[var(--primary-text-color)]/80">
                  交易哈希：
                </span>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--button-background)]"
                    title={txHash}
                  >
                    {shortenAddress(txHash, 6)}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="font-semibold text-[var(--button-background)]"
                    title={txHash}
                  >
                    {shortenAddress(txHash, 6)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded border border-[var(--secondary-background)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary-text-color)]"
                >
                  复制
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
