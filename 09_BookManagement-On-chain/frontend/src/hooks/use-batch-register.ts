import { useCallback } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { registryAbi } from "@/lib/registry";
import { formatErrorMessage } from "@/lib/errors";

// 批量上架 Hook：对外暴露模拟 + 提交流程，隔离页面对 viem/wagmi 细节的感知。
// 批量上链输入参数
type BatchSubmitInput = {
  address: `0x${string}`;
  walletAddress: `0x${string}`;
  contentHashes: `0x${string}`[];
  metaHashes: `0x${string}`[];
  policyHashes: `0x${string}`[];
  totalCopiesList: number[];
};

// 批量上链结果（成功返回 txHash，失败返回错误提示）
type BatchSubmitResult =
  | { ok: true; txHash: `0x${string}` }
  | { ok: false; message: string };

// 将常见错误转换为面向管理员的中文提示
const normalizeBatchError = (error: unknown) => {
  const message = formatErrorMessage(error);
  const lower = message.toLowerCase();
  if (lower.includes("function selector") || lower.includes("unknown function")) {
    return "合约不支持批量上架，请重新部署最新合约。";
  }
  if (lower.includes("not operator")) {
    return "当前钱包没有管理员权限，请切换到管理员钱包。";
  }
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "已取消签名。";
  }
  return message;
};

// 批量上架的链上提交封装（含 simulate + write）
export function useBatchRegister() {
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  // 先模拟交易，避免写入前就失败；再发起真实交易
  const submitBatch = useCallback(
    async (input: BatchSubmitInput): Promise<BatchSubmitResult> => {
      if (!publicClient) {
        return { ok: false, message: "未初始化链上连接，请刷新页面重试。" };
      }
      try {
        const { request } = await publicClient.simulateContract({
          address: input.address,
          abi: registryAbi,
          functionName: "registerBooks",
          args: [
            input.contentHashes,
            input.metaHashes,
            input.policyHashes,
            input.totalCopiesList.map((value) => BigInt(value)),
          ],
          account: input.walletAddress,
        });
        const txHash = await writeContractAsync(request);
        return { ok: true, txHash };
      } catch (error) {
        return { ok: false, message: normalizeBatchError(error) };
      }
    },
    [publicClient, writeContractAsync]
  );

  return { submitBatch, isPending };
}
