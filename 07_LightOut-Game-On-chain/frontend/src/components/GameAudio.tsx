"use client";

import { useEffect, useRef } from "react";

import { audioManager } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";

export const GameAudio = () => {
  const audioSettings = useGameStore((state) => state.audioSettings);
  const hydrated = useGameStore((state) => state.hydrated);
  const hasWon = useGameStore((state) => state.hasWon);
  const startedAt = useGameStore((state) => state.startedAt);
  const hasManualStart = useGameStore((state) => state.hasManualStart);
  const isPaused = useGameStore((state) => state.isPaused);
  const pauseReasons = useGameStore((state) => state.pauseReasons);
  const resumeCountdown = useGameStore((state) => state.resumeCountdown);
  const modeRef = useRef<"off" | "countdown" | "playing">("off");

  useEffect(() => {
    if (!hydrated) return;
    audioManager.syncAudio(audioSettings);
  }, [audioSettings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const isCountdownOnly =
      pauseReasons.length === 1 && pauseReasons[0] === "countdown";
    const inProgress =
      hasManualStart && startedAt > 0 && !hasWon && !isPaused;
    const nextMode = isCountdownOnly
      ? "countdown"
      : inProgress
        ? "playing"
        : "off";
    if (modeRef.current === nextMode) return;
    modeRef.current = nextMode;
    if (nextMode === "countdown") {
      audioManager.setMusicActive(true, {
        fadeMs: 3000,
        startVolume: 0,
      });
      return;
    }
    if (nextMode === "playing") {
      audioManager.setMusicActive(true);
      return;
    }
    audioManager.setMusicActive(false, { fadeMs: 400 });
  }, [
    hasManualStart,
    hasWon,
    hydrated,
    isPaused,
    pauseReasons,
    resumeCountdown,
    startedAt,
  ]);

  useEffect(() => {
    const handleUnlock = () => audioManager.unlockAudio();
    window.addEventListener("pointerdown", handleUnlock, { once: true });
    window.addEventListener("keydown", handleUnlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleUnlock);
      window.removeEventListener("keydown", handleUnlock);
    };
  }, []);

  return null;
};
