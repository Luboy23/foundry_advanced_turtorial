/**
 * 全站统一底部信息栏。
 */
export default function Footer() {
  return (
    <footer className="mt-8 border-t border-white/70 bg-white/45 px-4 py-4 text-[10px] text-zinc-500 backdrop-blur-md sm:text-xs md:px-6">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-center gap-3">
        <span className="h-px w-10 bg-zinc-300/80" />
        <div className="flex flex-wrap items-center justify-center gap-2 text-center uppercase tracking-[0.18em] text-zinc-500 sm:flex-nowrap">
          <span className="value-wrap">© 2026 lllu_23 • AnvilExplorer</span>
          <span className="h-1 w-1 rounded-full bg-zinc-300/80" />
          <a
            href="https://github.com/Luboy23/foundry_advanced_turtorial/tree/main/10_AnvilExplorer"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-slate-600 transition hover:text-slate-900"
          >
            GitHub
          </a>
        </div>
        <span className="h-px w-10 bg-zinc-300/80" />
      </div>
    </footer>
  );
}
