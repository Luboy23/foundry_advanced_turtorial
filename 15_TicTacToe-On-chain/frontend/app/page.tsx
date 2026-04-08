'use client'
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import GameCore from "@/components/GameCore";

// 首页入口：固定钱包连接按钮，并渲染核心游戏容器。
export default function Home() {
  return (
    <>
      <div className="fixed left-0 right-0 top-3 z-50 flex justify-end px-3 sm:px-4 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl transition-all duration-200">
          <ConnectButton />
        </div>
      </div>
      <GameCore />
    </>
  );
}
