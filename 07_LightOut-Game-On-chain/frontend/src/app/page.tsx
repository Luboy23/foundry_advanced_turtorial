import { GameHintDock } from "@/components/GameHintDock";
import { GameActions } from "@/components/GameActions";
import { GameAudio } from "@/components/GameAudio";
import { GameBoard } from "@/components/GameBoard";
import { GameHeader } from "@/components/GameHeader";
import { GameInfo } from "@/components/GameInfo";
import { GameOnchainGate } from "@/components/GameOnchainGate";
import { GameStartGate } from "@/components/GameStartGate";

export default function Home() {
  return (
    // 主页面采用“游戏主体 + 侧边能力面板”布局：
    // GameHintDock（提示）与两个 Gate（钱包/上链）走 fixed 覆盖层，不占据主流布局
    <main className="flex min-h-screen flex-col px-4 py-10 lg:pr-[260px]">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[600px] rounded-3xl border border-rose-200/70 bg-white/90 p-6 shadow-2xl shadow-rose-200/60 sm:p-8 lg:max-w-[900px]">
          <GameAudio />
          <GameHeader />
          <GameInfo />
          <GameBoard />
          <GameActions />
        </div>
      </div>
      <footer className="mt-6 flex w-full items-center justify-center gap-3 px-4 text-[10px] text-rose-400 sm:text-xs">
        <span className="h-px w-10 bg-rose-200/70" />
        <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] text-rose-400">
          <span>© 2026 lllu_23 • Lights Out On-chian</span>
          <span className="h-1 w-1 rounded-full bg-rose-200/70" />
          <a
            href="https://github.com/Luboy23/foundry_advanced_turtorial"
            className="inline-flex items-center gap-1 text-rose-500 transition hover:text-rose-600"
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
        <span className="h-px w-10 bg-rose-200/70" />
      </footer>
      <GameHintDock />
      <GameOnchainGate />
      <GameStartGate />
    </main>
  );
}
