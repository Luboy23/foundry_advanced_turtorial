import { Github } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-8 flex w-full items-center justify-center gap-3 px-4 pb-8 text-[10px] text-slate-400 sm:text-xs">
      <span className="h-px w-10 bg-slate-200" />
      <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] text-slate-400">
        <span>© 2026 高考录取资格证明系统 • UniversityCutoffProof-zk</span>
        <span className="h-1 w-1 rounded-full bg-slate-200" />
        <a
          href="https://github.com/Luboy23/foundry_advanced_turtorial"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-slate-500 transition hover:text-slate-700"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>
      <span className="h-px w-10 bg-slate-200" />
    </footer>
  );
}
