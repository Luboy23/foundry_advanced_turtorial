"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

type AudioSettingsContextValue = {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  toggleBgm: () => void;
  toggleSfx: () => void;
  setBgmEnabled: (value: boolean) => void;
  setSfxEnabled: (value: boolean) => void;
};

const defaultValue: AudioSettingsContextValue = {
  bgmEnabled: true,
  sfxEnabled: true,
  toggleBgm: () => {},
  toggleSfx: () => {},
  setBgmEnabled: () => {},
  setSfxEnabled: () => {},
};

export const AudioSettingsContext =
  createContext<AudioSettingsContextValue>(defaultValue);

const STORAGE_KEYS = {
  bgm: "audio_bgm_enabled",
  sfx: "audio_sfx_enabled",
};

export function AudioSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedBgm = window.localStorage.getItem(STORAGE_KEYS.bgm);
    const storedSfx = window.localStorage.getItem(STORAGE_KEYS.sfx);
    if (storedBgm !== null) {
      setBgmEnabled(storedBgm === "1");
    }
    if (storedSfx !== null) {
      setSfxEnabled(storedSfx === "1");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.bgm, bgmEnabled ? "1" : "0");
  }, [bgmEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.sfx, sfxEnabled ? "1" : "0");
  }, [sfxEnabled]);

  const toggleBgm = useCallback(() => {
    setBgmEnabled((current) => !current);
  }, []);

  const toggleSfx = useCallback(() => {
    setSfxEnabled((current) => !current);
  }, []);

  const value = useMemo(
    () => ({
      bgmEnabled,
      sfxEnabled,
      toggleBgm,
      toggleSfx,
      setBgmEnabled,
      setSfxEnabled,
    }),
    [bgmEnabled, sfxEnabled, toggleBgm, toggleSfx]
  );

  return (
    <AudioSettingsContext.Provider value={value}>
      {children}
    </AudioSettingsContext.Provider>
  );
}
