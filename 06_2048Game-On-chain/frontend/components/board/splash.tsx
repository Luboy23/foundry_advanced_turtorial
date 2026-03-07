"use client";

import { useContext } from "react";
import { GameContext } from "@/context/game-context";

type SplashProps = {
  heading: string;
  type?: "won" | "lost";
  subtext?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  onSecondaryAction?: () => void;
};

export default function Splash({
  heading,
  type,
  subtext,
  actionLabel,
  actionDisabled = false,
  secondaryActionLabel,
  secondaryActionDisabled = false,
  onSecondaryAction,
}: SplashProps) {
  const { startGame } = useContext(GameContext);
  const label = actionLabel ?? (type === "won" ? "再玩一次" : "再试一次");

  return (
    <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-4 rounded-lg bg-black/40 text-white">
      <div className="text-3xl font-bold">{heading}</div>
      {subtext && <div className="text-sm text-white/90">{subtext}</div>}
      <button
        type="button"
        onClick={startGame}
        disabled={actionDisabled}
        className="rounded bg-[var(--button-background)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[var(--secondary-text-color)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
      {secondaryActionLabel && onSecondaryAction && (
        <button
          type="button"
          onClick={onSecondaryAction}
          disabled={secondaryActionDisabled}
          className="rounded border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {secondaryActionLabel}
        </button>
      )}
    </div>
  );
}
