import { useSyncExternalStore } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { registryAbi, registryAddress, TARGET_CHAIN_ID } from "@/lib/registry";

// 管理员权限读取 Hook：统一处理 hydration、钱包、网络与 owner/operator 判定。
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const subscribeHydration = () => () => undefined;

// 管理端权限读取统一入口：钱包连接态 + 网络 + owner/operator 判定。
export function useAdminAccess() {
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const shouldCheckPermission =
    isHydrated &&
    Boolean(registryAddress) &&
    Boolean(isConnected) &&
    chainId === TARGET_CHAIN_ID;

  const ownerQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "owner",
    query: { enabled: shouldCheckPermission, retry: 0 },
  });

  const operatorQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "operators",
    args: [address ?? ZERO_ADDRESS],
    query: { enabled: shouldCheckPermission && Boolean(address), retry: 0 },
  });

  const owner = ownerQuery.data as `0x${string}` | undefined;
  const isOwner =
    Boolean(owner) &&
    Boolean(address) &&
    owner?.toLowerCase() === address?.toLowerCase();
  const isOperator = Boolean(operatorQuery.data);
  const isAllowed = isOwner || isOperator;
  const queryError = ownerQuery.error ?? operatorQuery.error;
  const isLoading =
    shouldCheckPermission &&
    (ownerQuery.isLoading || (Boolean(address) && operatorQuery.isLoading));

  return {
    isHydrated,
    address,
    isConnected,
    chainId,
    isOwner,
    isOperator,
    isAllowed,
    isLoading,
    queryError,
    shouldCheckPermission,
  };
}
