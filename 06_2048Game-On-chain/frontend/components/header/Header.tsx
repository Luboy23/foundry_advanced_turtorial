import Score from "../score/Score";
import WalletStatus from "../web3/WalletStatus";

export default function Header() {
  return (
    <header className="mt-8 flex w-full flex-col items-center gap-3 lg:mt-10 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-center">
          2048
        </h1>
        <span className="rounded bg-[var(--secondary-background)] px-3 py-1.5 text-sm md:text-base font-semibold uppercase tracking-wide text-[var(--secondary-text-color)]">
          链上
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 lg:items-end">
        <Score />
        <div className="lg:hidden">
          <WalletStatus />
        </div>
      </div>
    </header>
  );
}
