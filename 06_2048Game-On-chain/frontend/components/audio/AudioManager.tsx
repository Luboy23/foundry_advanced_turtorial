"use client";

import { useContext, useEffect, useRef } from "react";
import { AudioSettingsContext } from "@/context/audio-context";
import { GameContext } from "@/context/game-context";

const MERGE_THRESHOLDS = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

export default function AudioManager() {
  const { score, status, getTiles } = useContext(GameContext);
  const { bgmEnabled, sfxEnabled } = useContext(AudioSettingsContext);

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const mergeRef = useRef<HTMLAudioElement | null>(null);
  const winRef = useRef<HTMLAudioElement | null>(null);
  const loseRef = useRef<HTMLAudioElement | null>(null);

  const hasStartedRef = useRef(false);
  const prevScoreRef = useRef(score);
  const prevMaxRef = useRef(0);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (typeof Audio === "undefined") return;

    bgmRef.current = new Audio("/audio/bgm-calm-loop.mp3");
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.25;
    bgmRef.current.preload = "auto";

    mergeRef.current = new Audio("/audio/merge.mp3");
    mergeRef.current.volume = 0.55;
    mergeRef.current.preload = "auto";

    winRef.current = new Audio("/audio/win.mp3");
    winRef.current.volume = 0.6;
    winRef.current.preload = "auto";

    loseRef.current = new Audio("/audio/lose.mp3");
    loseRef.current.volume = 0.55;
    loseRef.current.preload = "auto";

    return () => {
      bgmRef.current?.pause();
      bgmRef.current = null;
      mergeRef.current = null;
      winRef.current = null;
      loseRef.current = null;
    };
  }, []);

  useEffect(() => {
    const startAudio = () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      const bgm = bgmRef.current;
      if (!bgm) return;

      const originalVolume = bgm.volume;
      if (!bgmEnabled) {
        bgm.volume = 0;
      }

      bgm
        .play()
        .catch(() => {})
        .finally(() => {
          if (!bgmEnabled) {
            bgm.pause();
            bgm.currentTime = 0;
            bgm.volume = originalVolume;
          }
        });
    };

    window.addEventListener("pointerdown", startAudio, { once: true });
    window.addEventListener("keydown", startAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startAudio);
      window.removeEventListener("keydown", startAudio);
    };
  }, [bgmEnabled, status]);

  useEffect(() => {
    if (!hasStartedRef.current) return;
    if (!bgmEnabled || status !== "playing") {
      bgmRef.current?.pause();
      return;
    }
    bgmRef.current?.play().catch(() => {});
  }, [bgmEnabled, status]);

  useEffect(() => {
    if (status === "playing" && score === 0) {
      prevScoreRef.current = 0;
      prevMaxRef.current = 0;
      return;
    }

    const tiles = getTiles();
    let currentMax = 0;
    tiles.forEach((tile) => {
      if (tile.value > currentMax) {
        currentMax = tile.value;
      }
    });

    const scoreIncreased = score > prevScoreRef.current;
    const maxIncreased = currentMax > prevMaxRef.current;
    const isThreshold = MERGE_THRESHOLDS.includes(currentMax);

    if (
      scoreIncreased &&
      maxIncreased &&
      isThreshold &&
      mergeRef.current &&
      sfxEnabled &&
      hasStartedRef.current
    ) {
      mergeRef.current.currentTime = 0;
      mergeRef.current.play().catch(() => {});
    }

    prevScoreRef.current = score;
    prevMaxRef.current = currentMax;
  }, [score, status, sfxEnabled, getTiles]);

  useEffect(() => {
    if (status !== prevStatusRef.current) {
      if (status === "won" && sfxEnabled && hasStartedRef.current) {
        if (winRef.current) {
          winRef.current.currentTime = 0;
          winRef.current.play().catch(() => {});
        }
      }
      if (status === "lost" && sfxEnabled && hasStartedRef.current) {
        if (loseRef.current) {
          loseRef.current.currentTime = 0;
          loseRef.current.play().catch(() => {});
        }
      }
    }
    prevStatusRef.current = status;
  }, [sfxEnabled, status]);

  return null;
}
