// 站点公共页脚：展示版权与仓库入口。
export default function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto flex w-full items-center justify-center gap-3 px-6 py-8 text-[10px] text-muted-foreground sm:text-xs">
        <span className="h-px w-8 bg-border/70" />
        <div className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]">
          <span className="text-muted-foreground/80">© 2026 lllu_23 • BookManagement On-chain</span>
          <span className="h-1 w-1 rounded-full bg-border/70" />
        </div>
        <a
          href="https://github.com/Luboy23/foundry_advanced_turtorial"
          className="inline-flex items-center gap-1 text-muted-foreground/80 transition hover:text-primary"
          target="_blank"
          rel="noreferrer"
        >
          {/* 直接内嵌 GitHub 图标，避免额外图标依赖与资源请求 */}
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
        <span className="h-px w-8 bg-border/70" />
      </div>
    </footer>
  );
}
