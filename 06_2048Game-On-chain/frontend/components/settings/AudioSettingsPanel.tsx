"use client";

import { useContext } from "react";
import { AudioSettingsContext } from "@/context/audio-context";

export default function AudioSettingsPanel() {
  const { bgmEnabled, sfxEnabled, toggleBgm, toggleSfx } =
    useContext(AudioSettingsContext);

  return (
    <div className="flex flex-col gap-4 text-sm text-[var(--primary-text-color)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">背景音乐</div>
          <div className="text-xs">控制游戏的背景 BGM</div>
        </div>
        <button
          type="button"
          onClick={toggleBgm}
          className="rounded bg-[var(--secondary-background)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--secondary-text-color)]"
        >
          {bgmEnabled ? "已开启" : "已关闭"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">游戏音效</div>
          <div className="text-xs">合并、胜负等提示音</div>
        </div>
        <button
          type="button"
          onClick={toggleSfx}
          className="rounded bg-[var(--secondary-background)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--secondary-text-color)]"
        >
          {sfxEnabled ? "已开启" : "已关闭"}
        </button>
      </div>
    </div>
  );
}
