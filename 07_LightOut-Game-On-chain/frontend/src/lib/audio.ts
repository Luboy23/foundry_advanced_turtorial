import type { AudioSettings } from "@/store/gameStore";

const MUSIC_SRC = "/audio/music/electronic-loop.ogg";

const SFX_SOURCES = {
  click: "/audio/sfx/click.ogg",
  toggle: "/audio/sfx/toggle.ogg",
  hint: "/audio/sfx/hint.ogg",
  win: "/audio/sfx/win.ogg",
  countdown: "/audio/sfx/countdown-tick.ogg",
  ready: "/audio/sfx/countdown-ready.ogg",
} as const;

export type SfxKey = keyof typeof SFX_SOURCES;

const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.55;

let musicAudio: HTMLAudioElement | null = null;
let musicEnabled = true;
let sfxEnabled = true;
let unlocked = false;
let musicActive = false;
let fadeTimer: number | null = null;

const isBrowser = () => typeof window !== "undefined";

const ensureMusicAudio = () => {
  if (!isBrowser()) return null;
  if (!musicAudio) {
    musicAudio = new Audio(MUSIC_SRC);
    musicAudio.loop = true;
    musicAudio.preload = "auto";
    musicAudio.volume = MUSIC_VOLUME;
  }
  return musicAudio;
};

const clearFadeTimer = () => {
  if (!isBrowser()) return;
  if (fadeTimer !== null) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
  }
};

const playMusic = (volume?: number) => {
  if (!musicEnabled || !unlocked || !musicActive) return;
  const audio = ensureMusicAudio();
  if (!audio) return;
  if (typeof volume === "number") {
    audio.volume = volume;
  }
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }
};

const stopMusic = () => {
  const audio = ensureMusicAudio();
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
};

const fadeMusicTo = (
  targetVolume: number,
  durationMs: number,
  stopAfter = false,
) => {
  if (!isBrowser()) return;
  const audio = ensureMusicAudio();
  if (!audio) return;
  clearFadeTimer();
  const startVolume = audio.volume;
  if (durationMs <= 0) {
    audio.volume = targetVolume;
    if (stopAfter && targetVolume === 0) {
      stopMusic();
    }
    return;
  }
  const startTime = Date.now();
  fadeTimer = window.setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    audio.volume = startVolume + (targetVolume - startVolume) * progress;
    if (progress >= 1) {
      clearFadeTimer();
      if (stopAfter && targetVolume === 0) {
        stopMusic();
      }
    }
  }, 40);
};

const unlockAudio = () => {
  if (!isBrowser()) return;
  if (unlocked) return;
  unlocked = true;
  playMusic();
};

const syncAudio = (settings: AudioSettings) => {
  musicEnabled = settings.musicEnabled;
  sfxEnabled = settings.sfxEnabled;

  if (!musicEnabled) {
    clearFadeTimer();
    stopMusic();
  } else if (musicActive) {
    playMusic(MUSIC_VOLUME);
  } else {
    stopMusic();
  }
};

const setMusicActive = (
  active: boolean,
  options?: { fadeMs?: number; startVolume?: number },
) => {
  if (musicActive === active && !options) return;
  clearFadeTimer();
  musicActive = active;
  if (!musicEnabled) {
    stopMusic();
    return;
  }
  if (!musicActive) {
    if (options?.fadeMs) {
      fadeMusicTo(0, options.fadeMs, true);
    } else {
      stopMusic();
    }
    return;
  }

  const startVolume = options?.startVolume;
  playMusic(
    typeof startVolume === "number" ? startVolume : MUSIC_VOLUME,
  );
  if (options?.fadeMs) {
    fadeMusicTo(MUSIC_VOLUME, options.fadeMs);
  }
};

const playSfx = (key: SfxKey) => {
  if (!isBrowser()) return;
  if (!sfxEnabled) return;
  unlockAudio();
  const src = SFX_SOURCES[key];
  if (!src) return;
  const audio = new Audio(src);
  audio.volume = SFX_VOLUME;
  audio.preload = "auto";
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }
};

export const audioManager = {
  unlockAudio,
  syncAudio,
  setMusicActive,
  playSfx,
};
