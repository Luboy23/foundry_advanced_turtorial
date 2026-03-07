"use client";

import { useContext } from "react";
import { GameContext } from "@/context/game-context";
import { formatDuration } from "@/lib/format";

export default function Score() {
  const { score, durationSeconds } = useContext(GameContext);

  return (
    <div className="flex h-20 w-[148px] flex-col items-center justify-center gap-1 rounded-md border border-[var(--secondary-background)] bg-[var(--secondary-background)] text-center text-xs font-bold text-[var(--tile-background)]">
      <div className="text-[11px] font-semibold tracking-wide text-white">
        本局得分
      </div>
      <div className="text-2xl leading-none text-[var(--secondary-text-color)]">
        {score}
      </div>
      <div className="text-[11px] font-semibold leading-none text-white">
        用时 {formatDuration(durationSeconds)}
      </div>
    </div>
  );
}
