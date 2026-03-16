import { registryAddress, TARGET_CHAIN_ID } from "@/lib/registry";
import { useAdminAccess } from "@/hooks/use-admin-access";

// 管理端写链守卫 Hook：把“可写条件”收敛成 ensureReady，供页面统一调用。
// 管理端统一写入前置校验：地址配置 + 钱包 + 网络 + 权限
export function useAdminWriteGuard() {
  const { address, isConnected, chainId, isAllowed, isLoading, queryError } = useAdminAccess();
  const hasPermission = isAllowed;
  const isCheckingPermission = isLoading;

  // 写链前统一闸门：配置 -> 钱包 -> 网络 -> 权限，避免把错误延后到交易阶段。
  const ensureReady = () => {
    if (!registryAddress) {
      return { ok: false as const, message: "系统未完成部署，请联系管理员完成配置。" };
    }
    if (!isConnected || !address) {
      return { ok: false as const, message: "请先连接管理员钱包" };
    }
    if (chainId !== TARGET_CHAIN_ID) {
      return {
        ok: false as const,
        message: `请切换到目标网络（${TARGET_CHAIN_ID}）`,
      };
    }
    if (isCheckingPermission) {
      return { ok: false as const, message: "正在校验管理员权限，请稍后重试" };
    }
    if (queryError) {
      return { ok: false as const, message: "网络或权限校验失败，请检查钱包网络后重试。" };
    }
    if (!hasPermission) {
      return { ok: false as const, message: "当前钱包没有管理员权限" };
    }
    return { ok: true as const };
  };

  return {
    address,
    chainId,
    hasPermission,
    isCheckingPermission,
    permissionError: queryError,
    ensureReady,
  };
}
