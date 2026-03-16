"use client";

import { Button } from "@/components/ui/button";
import { useSyncExternalStore } from "react";
import { injected, useAccount, useConnect, useDisconnect } from "wagmi";

// 默认使用浏览器注入钱包（如 MetaMask）
const connector = injected();

// 缩短显示地址
const shorten = (value?: string, head = 6, tail = 4) => {
  if (!value) return "";
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
};

// 钱包连接按钮：处理 SSR/CSR 差异，避免 hydration 问题
export default function WalletButton() {
  // useSyncExternalStore 用于判断客户端渲染，避免 SSR 文本不一致
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isClient) {
    return (
      <Button variant="outline" type="button" disabled>
        连接钱包
      </Button>
    );
  }

  if (isConnected) {
    return (
      <Button
        variant="outline"
        type="button"
        onClick={() => disconnect()}
        title={address}
      >
        {shorten(address)}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => connect({ connector })}
      disabled={isPending}
    >
      {isPending ? "连接中..." : "连接钱包"}
    </Button>
  );
}
