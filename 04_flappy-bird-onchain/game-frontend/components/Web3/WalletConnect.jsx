// 钱包连接逻辑（无可视化 UI）：用于向 Phaser 暴露连接/断开能力。
"use client";

// wagmi hooks：读取账户、连接、断开
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useEffect } from "react";

export default function WalletConnect() {
  // 注入式连接器（MetaMask / OKX / 浏览器钱包）
  const injectedConnector = injected();
  // 当前账户状态
  const { address, isConnected, connector } = useAccount();
  // 连接方法与错误信息
  const { connect, error } = useConnect();
  // 断开方法
  const { disconnect } = useDisconnect();

  // 连接状态日志与错误输出（便于调试）
  useEffect(() => {
    console.log("钱包连接状态:", { isConnected, address, connector });
    if (error) {
      console.error("钱包连接错误:", error);
    }
  }, [isConnected, error, address, connector]);

  // 将断开函数挂载到 window，供 Phaser 场景调用
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__walletDisconnect = disconnect;
    return () => {
      if (window.__walletDisconnect === disconnect) {
        delete window.__walletDisconnect;
      }
    };
  }, [disconnect]);

  // 将连接函数挂载到 window，供 Phaser 场景调用
  useEffect(() => {
    if (typeof window === "undefined") return;
    const connectFn = () => connect({ connector: injectedConnector });
    window.__walletConnect = connectFn;
    return () => {
      if (window.__walletConnect === connectFn) {
        delete window.__walletConnect;
      }
    };
  }, [connect, injectedConnector]);

  // 把账户状态同步到全局并广播事件，便于 Phaser 监听
  useEffect(() => {
    if (typeof window === "undefined") return;
    const detail = { address: address || null, isConnected: Boolean(isConnected) };
    window.__walletStatus = detail;
    window.dispatchEvent(new CustomEvent("wallet:status", { detail }));
  }, [address, isConnected]);

  // 不渲染 UI（实际按钮已迁移到 Phaser 内）
  return null;
}
