import { GameActions } from "@/components/GameActions";
import { GameAudio } from "@/components/GameAudio";
import { GameBoard } from "@/components/GameBoard";
import { GameHeader } from "@/components/GameHeader";
import { GameInfo } from "@/components/GameInfo";
import { GameOnchainGate } from "@/components/GameOnchainGate";
import { GameStartGate } from "@/components/GameStartGate";

export default function Home() {
  return (
    // 仅移动端允许页面纵向滚动；桌面端固定视口并居中展示完整主卡片
    <main
      className="mx-auto flex h-[100dvh] w-full max-w-[1120px] flex-col items-center justify-center overflow-y-auto px-4 pb-3 lg:overflow-hidden lg:py-2"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.6rem)",
      }}
    >
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="flex w-full max-w-[960px] flex-col rounded-3xl border border-rose-200/70 bg-white/90 p-4 shadow-2xl shadow-rose-200/60 sm:p-6 lg:max-h-[calc(100dvh-1rem)] lg:min-h-0 lg:px-7 lg:py-5">
          <GameAudio />
          <GameHeader />
          <GameInfo />
          <GameBoard />
          <GameActions />
          <footer className="mt-4 flex w-full items-center justify-center gap-3 border-t border-rose-200/70 pt-3 text-[10px] text-rose-400 sm:text-xs">
            <span className="h-px w-8 bg-rose-200/70 sm:w-10" />
            <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] text-rose-400">
              <span>© 2026 lllu_23 • Lights Out On-chain</span>
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
            <span className="h-px w-8 bg-rose-200/70 sm:w-10" />
          </footer>
        </div>
      </div>
      <GameOnchainGate />
      <GameStartGate />
    </main>
  );
}
