import { Github } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="border-t border-brand-green/8 bg-surface/70">
      <div className="mx-auto flex w-full max-w-[760px] items-center justify-center gap-3 px-4 py-5 text-[10px] text-text-muted sm:text-xs">
        <span className="h-px w-10 bg-brand-green/14" />
        <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] text-text-muted">
          <span>© 2026 AlcoholAgeGate-zk</span>
          <span className="h-1 w-1 rounded-full bg-brand-green/18" />
          <a
            href="https://github.com/Luboy23/foundry_advanced_turtorial"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-brand-amber transition hover:text-brand-green"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
        <span className="h-px w-10 bg-brand-green/14" />
      </div>
    </footer>
  );
}
