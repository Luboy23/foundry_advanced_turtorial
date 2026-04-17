import { Github } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-10 w-full px-4 pb-8">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 text-[10px] text-text-muted sm:text-xs">
        <span className="h-px w-10 bg-line-soft/80 sm:w-14" />
        <div className="flex flex-wrap items-center justify-center gap-2 text-center uppercase tracking-[0.18em] text-text-muted">
          <span>© 2026 失业补助资格证明平台</span>
          <span className="h-1 w-1 rounded-full bg-line-soft" />
          <span>UnemploymentBenefitProof-zk</span>
          <span className="h-1 w-1 rounded-full bg-line-soft" />
          <a
            href="https://github.com/Luboy23/foundry_advanced_turtorial"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-brand-ink/80 transition hover:text-brand-seal"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
        <span className="h-px w-10 bg-line-soft/80 sm:w-14" />
      </div>
    </footer>
  );
}
