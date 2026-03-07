"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Board from "@/components/board/Board";
import AudioManager from "@/components/audio/AudioManager";
import Header from "@/components/header/Header";
import GameHistory from "@/components/history/GameHistory";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import AutoSubmitter from "@/components/onchain/AutoSubmitter";
import ScoreEventWatcher from "@/components/onchain/ScoreEventWatcher";
import Modal from "@/components/ui/Modal";
import AudioSettingsPanel from "@/components/settings/AudioSettingsPanel";
import WalletStatus from "@/components/web3/WalletStatus";
import { AudioSettingsProvider } from "@/context/audio-context";
import { GameProvider } from "@/context/game-context";
import { Web3Provider } from "@/context/web3-context";
import { SCORE_CONTRACT_ADDRESS } from "@/lib/contract";
import {
  historyBaseKey,
  historyCountBaseKey,
  leaderboardKey,
} from "@/lib/query-keys";

function HomeContent() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();

  const refreshOnchainData = useCallback(() => {
    // 成绩提交后同时失效排行榜、历史列表与历史总数缓存，保证弹窗读取到最新链上状态。
    queryClient.invalidateQueries({
      queryKey: leaderboardKey(SCORE_CONTRACT_ADDRESS),
    });
    queryClient.invalidateQueries({
      queryKey: historyBaseKey(SCORE_CONTRACT_ADDRESS),
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: historyCountBaseKey(SCORE_CONTRACT_ADDRESS),
      exact: false,
    });
  }, [queryClient]);

  return (
    <GameProvider>
      <AudioSettingsProvider>
        <AudioManager />
        {/* 监听链上 ScoreSubmitted 事件，其他地址提交后也能实时刷新本地视图。 */}
        <ScoreEventWatcher onScoreSubmitted={refreshOnchainData} />
        <div className="min-h-screen w-full flex flex-col items-center pb-12">
          <div className="w-[296px] md:w-[480px] relative flex flex-col items-center">
            <div className="absolute -right-[360px] top-1/2 hidden -translate-y-1/2 lg:block">
              <WalletStatus />
            </div>
            <Header />
          </div>
          <div className="mt-6 w-[296px] md:w-[480px] flex justify-center">
            <Board />
          </div>
          {/* 游戏结束后自动触发成绩提交流程，成功后刷新链上数据缓存。 */}
          <AutoSubmitter onSubmitted={refreshOnchainData} />
          <div className="mt-6 w-[296px] md:w-[480px] flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="flex-1 rounded border border-[var(--secondary-background)] bg-white px-4 py-3 text-sm font-semibold text-[var(--primary-text-color)] shadow-sm"
            >
              查看链上排行榜
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex-1 rounded border border-[var(--secondary-background)] bg-white px-4 py-3 text-sm font-semibold text-[var(--primary-text-color)] shadow-sm"
            >
              链上记录
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex-1 rounded border border-[var(--secondary-background)] bg-white px-4 py-3 text-sm font-semibold text-[var(--primary-text-color)] shadow-sm"
            >
              设置
            </button>
          </div>
          <footer className="mt-8 flex w-[296px] md:w-[480px] items-center justify-center gap-3 px-2 text-[10px] text-[var(--primary-text-color)] sm:text-xs">
            <span className="h-px w-8 bg-[var(--secondary-background)]" />
            <div className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span className="text-[var(--primary-text-color)] opacity-70">
                © 2026 lllu_23 • 2048 On-chain
              </span>
              <span className="h-1 w-1 rounded-full bg-[var(--secondary-background)]" />
              <a
                href="https://github.com/Luboy23/foundry_advanced_turtorial"
                className="inline-flex items-center gap-1 text-[var(--primary-text-color)]/80 transition hover:text-[var(--primary-text-color)]"
                target="_blank"
                rel="noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                >
                  <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.7-1.4-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.6 11.6 0 0 1 6 0C17.6 5.9 18.6 6.2 18.6 6.2c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.7 5.6-5.3 5.9.4.4.8 1 .8 2.1v3.1c0 .4.2.7.8.6A12 12 0 0 0 12 .5Z" />
                </svg>
                GitHub
              </a>
            </div>
            <span className="h-px w-8 bg-[var(--secondary-background)]" />
          </footer>
        </div>

        <Modal
          open={showLeaderboard}
          title="链上排行榜"
          onClose={() => setShowLeaderboard(false)}
          hideHeader
        >
          <Leaderboard
            variant="plain"
            onClose={() => setShowLeaderboard(false)}
          />
        </Modal>

        <Modal
          open={showSettings}
          title="声音设置"
          onClose={() => setShowSettings(false)}
        >
          <AudioSettingsPanel />
        </Modal>

        <Modal
          open={showHistory}
          title="链上记录"
          onClose={() => setShowHistory(false)}
          hideHeader
        >
          <GameHistory onClose={() => setShowHistory(false)} />
        </Modal>
      </AudioSettingsProvider>
    </GameProvider>
  );
}

export default function Home() {
  return (
    <Web3Provider>
      <HomeContent />
    </Web3Provider>
  );
}
