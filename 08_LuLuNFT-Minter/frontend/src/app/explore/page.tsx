import { MarketplaceHeader } from "@/components/MarketplaceHeader";
import { NftGallery } from "@/components/NftGallery";
import { SectionHeader } from "@/components/SectionHeader";

export default function ExplorePage() {
  return (
    <main className="min-h-screen bg-white">
      <MarketplaceHeader active="gallery" />

      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl u-stack-8 px-6 py-10 lg:py-12">
          <SectionHeader
            as="h1"
            title="全站作品"
            description="所有用户的铸造作品"
          />
          <NftGallery
            mode="community"
            title="全站作品列表"
            description="按铸造时间排序"
            tone="light"
          />
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-6 py-8 text-[10px] text-slate-500 sm:text-xs">
          <span className="h-px w-8 bg-slate-200/70" />
          <div className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]">
            <span className="text-slate-500/80">
              © 2026 lllu_23 • LuLuNFT藏品工坊
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-200/70" />
            <a
              href="https://github.com/Luboy23/foundry_advanced_turtorial"
              className="inline-flex items-center gap-1 text-slate-500/80 transition hover:text-rose-500"
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
          <span className="h-px w-8 bg-slate-200/70" />
        </div>
      </footer>
    </main>
  );
}
