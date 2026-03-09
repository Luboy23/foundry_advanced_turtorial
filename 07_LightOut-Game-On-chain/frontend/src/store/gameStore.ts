"use client";

import { create } from "zustand";

import {
  cloneGrid,
  createEmptyGrid,
  initializeGrid,
  toggleGridCell,
  type Grid,
  type Move,
} from "@/lib/game";
import { solve } from "@/lib/solver";

// 本地持久化键：分别保存历史记录、游戏设置、音频设置
const RECORDS_KEY = "lights-out-records";
const SETTINGS_KEY = "lights-out-settings";
const AUDIO_SETTINGS_KEY = "lights-out-audio";
const MAX_RECORDS = 200;

export const GRID_OPTIONS = [
  { size: 4, label: "简单" },
  { size: 5, label: "标准" },
  { size: 6, label: "困难" },
] as const;

export type GridSize = (typeof GRID_OPTIONS)[number]["size"];

export const DENSITY_OPTIONS = [
  { value: "low", label: "低", probability: 0.35 },
  { value: "medium", label: "中", probability: 0.5 },
  { value: "high", label: "高", probability: 0.65 },
] as const;

export type DensityLevel = (typeof DENSITY_OPTIONS)[number]["value"];

export interface GameSettings {
  gridSize: GridSize;
  density: DensityLevel;
}

export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

export interface GameRecord {
  id: string;
  gridSize: GridSize;
  density: DensityLevel;
  moves: number;
  durationMs: number;
  finishedAt: number;
  usedHint?: boolean;
}

type SolverStatus = "idle" | "computing" | "unavailable";

interface GameState {
  grid: {
    initial: Grid;
    current: Grid;
  };
  solution: Move[];
  solverStatus: SolverStatus;
  movesCount: number;
  hasWon: boolean;
  startedAt: number;
  hasManualStart: boolean;
  isPaused: boolean;
  pausedAt: number;
  pausedTotalMs: number;
  pauseReasons: string[];
  resumeCountdown: number;
  usedHint: boolean;
  lastResult: GameRecord | null;
}

export interface GameStore extends GameState {
  settings: GameSettings;
  audioSettings: AudioSettings;
  records: GameRecord[];
  hydrated: boolean;
  showHint: boolean;
  chainRefreshNonce: number;
  hydrateFromStorage: () => void;
  newGame: () => void;
  resetGame: () => void;
  returnHome: () => void;
  pauseGame: (reason?: string) => void;
  resumeGame: (reason?: string) => void;
  setResumeCountdown: (value: number) => void;
  bumpChainRefresh: () => void;
  toggleCell: (row: number, column: number) => void;
  updateSettings: (next: Partial<GameSettings>) => void;
  updateAudioSettings: (next: Partial<AudioSettings>) => void;
  toggleHint: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  gridSize: 4,
  density: "medium",
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicEnabled: true,
  sfxEnabled: true,
};

const densityValue = (density: DensityLevel) =>
  DENSITY_OPTIONS.find((option) => option.value === density)?.probability ??
  DENSITY_OPTIONS[1].probability;

// 目前求解器仅覆盖到 6x6，超过时可按需扩展算法
const canSolve = (size: number) => size <= 6;

const safeParse = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const loadSettings = (): GameSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  const stored = safeParse<Partial<GameSettings>>(
    window.localStorage.getItem(SETTINGS_KEY),
  );
  const gridSize =
    stored?.gridSize &&
    GRID_OPTIONS.some((option) => option.size === stored.gridSize)
      ? stored.gridSize
      : DEFAULT_SETTINGS.gridSize;
  const density =
    stored?.density &&
    DENSITY_OPTIONS.some((option) => option.value === stored.density)
      ? stored.density
      : DEFAULT_SETTINGS.density;
  return { gridSize, density };
};

const saveSettings = (settings: GameSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const loadAudioSettings = (): AudioSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_AUDIO_SETTINGS;
  }
  const stored = safeParse<Partial<AudioSettings>>(
    window.localStorage.getItem(AUDIO_SETTINGS_KEY),
  );
  return {
    musicEnabled:
      typeof stored?.musicEnabled === "boolean"
        ? stored.musicEnabled
        : DEFAULT_AUDIO_SETTINGS.musicEnabled,
    sfxEnabled:
      typeof stored?.sfxEnabled === "boolean"
        ? stored.sfxEnabled
        : DEFAULT_AUDIO_SETTINGS.sfxEnabled,
  };
};

const saveAudioSettings = (settings: AudioSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
};

const loadRecords = (): GameRecord[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const stored = safeParse<GameRecord[]>(
    window.localStorage.getItem(RECORDS_KEY),
  );
  if (!Array.isArray(stored)) return [];
  return stored.map((record) => ({
    ...record,
    usedHint: Boolean(record.usedHint),
  }));
};

const saveRecords = (records: GameRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

const createInitialState = (
  settings: GameSettings,
  useRandom: boolean,
  hasManualStart = false,
): GameState => {
  // useRandom=false 用于首页初始展示；true 表示正式开始对局
  const grid = useRandom
    ? initializeGrid(settings.gridSize, densityValue(settings.density))
    : createEmptyGrid(settings.gridSize);

  return {
    grid: {
      initial: cloneGrid(grid),
      current: grid,
    },
    solution: [],
    solverStatus:
      useRandom && canSolve(settings.gridSize) ? "computing" : "idle",
    movesCount: 0,
    hasWon: false,
    startedAt: useRandom ? Date.now() : 0,
    hasManualStart,
    isPaused: false,
    pausedAt: 0,
    pausedTotalMs: 0,
    pauseReasons: [],
    resumeCountdown: 0,
    usedHint: false,
    lastResult: null,
  };
};

const createRecordId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

let solverRequestId = 0;
let solveTimeout: ReturnType<typeof setTimeout> | null = null;
let solveIdle: number | null = null;

export const useGameStore = create<GameStore>((set, get) => {
  const initialSettings = DEFAULT_SETTINGS;
  const initialState = createInitialState(initialSettings, false, false);

  const scheduleSolve = (grid: Grid, size: number) => {
    // 无法求解时直接标记状态，避免 UI 一直等待
    if (!canSolve(size)) {
      set({ solution: [], solverStatus: "unavailable" });
      return;
    }

    // 递增请求号：旧请求晚返回时可被丢弃，避免解题结果“回滚”
    const requestId = (solverRequestId += 1);
    set({ solverStatus: "computing" });
    if (solveTimeout) {
      clearTimeout(solveTimeout);
      solveTimeout = null;
    }
    if (solveIdle !== null && typeof window !== "undefined") {
      const cancelIdleCallback = (window as typeof window & {
        cancelIdleCallback?: (id: number) => void;
      }).cancelIdleCallback;
      if (cancelIdleCallback) {
        cancelIdleCallback(solveIdle);
      }
      solveIdle = null;
    }

    const runSolve = () => {
      const moves = solve(grid);
      set(() =>
        requestId === solverRequestId
          ? { solution: moves, solverStatus: "idle" }
          : {},
      );
    };

    if (typeof window !== "undefined") {
      // 优先使用 requestIdleCallback，减少主线程抢占导致的掉帧
      const requestIdleCallback = (window as typeof window & {
        requestIdleCallback?: (
          cb: () => void,
          options?: { timeout: number },
        ) => number;
      }).requestIdleCallback;
      if (requestIdleCallback) {
        solveIdle = requestIdleCallback(runSolve, { timeout: 300 });
        return;
      }
    } else {
      // SSR 环境降级为 setTimeout（虽然本文件主要在客户端运行）
      solveTimeout = setTimeout(runSolve, 0);
      return;
    }
    solveTimeout = setTimeout(runSolve, 0);
  };

  const hydrateFromStorage = () => {
    if (get().hydrated) return;
    const storedSettings = loadSettings();
    const storedRecords = loadRecords();
    const storedAudioSettings = loadAudioSettings();
    const nextSettings = storedSettings ?? DEFAULT_SETTINGS;
    const nextState = createInitialState(nextSettings, false, false);
    set({
      ...nextState,
      settings: nextSettings,
      records: storedRecords,
      audioSettings: storedAudioSettings,
      hydrated: true,
    });
    scheduleSolve(nextState.grid.current, nextSettings.gridSize);
  };

  return {
    ...initialState,
    settings: initialSettings,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    records: [],
    hydrated: false,
    showHint: false,
    chainRefreshNonce: 0,
    hydrateFromStorage,
    newGame: () => {
      // 新开局进入 3 秒倒计时，避免误触开局立即计时
      const nextSettings = get().settings;
      const nextState = createInitialState(nextSettings, true, true);
      set({
        ...nextState,
        hydrated: true,
        showHint: false,
        isPaused: true,
        pausedAt: nextState.startedAt || Date.now(),
        pausedTotalMs: 0,
        pauseReasons: ["countdown"],
        resumeCountdown: 3,
      });
      scheduleSolve(nextState.grid.current, nextSettings.gridSize);
    },
    resetGame: () => {
      // 重开当前局：回到 initial 棋盘，但保留当前难度配置
      const { grid, settings: currentSettings } = get();
      const nextGrid = cloneGrid(grid.initial);
      const startedAt = Date.now();
      set({
        grid: {
          initial: grid.initial,
          current: nextGrid,
        },
        solution: [],
        solverStatus: canSolve(currentSettings.gridSize)
          ? "computing"
          : "unavailable",
        movesCount: 0,
        hasWon: false,
        startedAt,
        hasManualStart: true,
        isPaused: true,
        pausedAt: startedAt,
        pausedTotalMs: 0,
        pauseReasons: ["countdown"],
        resumeCountdown: 3,
        usedHint: false,
        showHint: false,
        lastResult: null,
        hydrated: true,
      });
      scheduleSolve(nextGrid, currentSettings.gridSize);
    },
    returnHome: () => {
      // 返回主页后保留用户配置与历史数据，重置对局状态
      const currentSettings = get().settings;
      const currentAudioSettings = get().audioSettings;
      const currentRecords = get().records;
      const nextState = createInitialState(currentSettings, false, false);
      set({
        ...nextState,
        settings: currentSettings,
        audioSettings: currentAudioSettings,
        records: currentRecords,
        hydrated: true,
        showHint: false,
        resumeCountdown: 0,
      });
      scheduleSolve(nextState.grid.current, currentSettings.gridSize);
    },
    pauseGame: (reason = "generic") => {
      const state = get();
      if (!state.hasManualStart || state.hasWon) {
        return;
      }
      if (state.pauseReasons.includes(reason)) return;
      // 多来源暂停：例如钱包弹窗、榜单弹窗、倒计时等可叠加
      const nextReasons = [...state.pauseReasons, reason];
      set({
        pauseReasons: nextReasons,
        isPaused: true,
        pausedAt: state.isPaused ? state.pausedAt : Date.now(),
      });
    },
    resumeGame: (reason = "generic") => {
      const state = get();
      if (!state.isPaused) return;
      if (!state.pauseReasons.includes(reason)) return;
      if (reason === "countdown") {
        // 倒计时结束：真正恢复计时，并累计暂停时长
        const now = Date.now();
        set({
          pauseReasons: [],
          isPaused: false,
          pausedAt: 0,
          pausedTotalMs:
            state.pausedTotalMs + Math.max(0, now - state.pausedAt),
          resumeCountdown: 0,
        });
        return;
      }

      const nextReasons = state.pauseReasons.filter(
        (item) => item !== reason,
      );
      if (nextReasons.length > 0) {
        // 仍有其他暂停源时，不可恢复
        set({ pauseReasons: nextReasons });
        return;
      }
      if (state.hasManualStart && !state.hasWon) {
        // 非倒计时来源关闭后，重新进入倒计时再恢复
        set({
          pauseReasons: ["countdown"],
          isPaused: true,
          resumeCountdown: 3,
          pausedAt: state.pausedAt || Date.now(),
        });
        return;
      }
      const now = Date.now();
      set({
        pauseReasons: [],
        isPaused: false,
        pausedAt: 0,
        pausedTotalMs:
          state.pausedTotalMs + Math.max(0, now - state.pausedAt),
        resumeCountdown: 0,
      });
    },
    setResumeCountdown: (value) =>
      set({ resumeCountdown: Math.max(0, value) }),
    bumpChainRefresh: () =>
      set((state) => ({ chainRefreshNonce: state.chainRefreshNonce + 1 })),
    toggleCell: (row, column) => {
      const state = get();
      if (state.hasWon || !state.hasManualStart || state.isPaused) {
        return;
      }

      const newGrid = toggleGridCell(state.grid.current, row, column);
      const hasWon = newGrid.every((gridRow) =>
        gridRow.every((cell) => cell),
      );
      const movesCount = state.movesCount + 1;

      let nextRecords = state.records;
      let lastResult = state.lastResult;
      if (hasWon) {
        // 通关时记录有效用时：总耗时 - 所有暂停时间
        const finishedAt = Date.now();
        const pausedDuringFinish = state.isPaused
          ? Math.max(0, finishedAt - state.pausedAt)
          : 0;
        const record: GameRecord = {
          id: createRecordId(),
          gridSize: state.settings.gridSize,
          density: state.settings.density,
          moves: movesCount,
          durationMs: Math.max(
            0,
            finishedAt -
              state.startedAt -
              state.pausedTotalMs -
              pausedDuringFinish,
          ),
          finishedAt,
          usedHint: state.usedHint,
        };
        nextRecords = [record, ...state.records].slice(0, MAX_RECORDS);
        saveRecords(nextRecords);
        lastResult = record;
      }

      set({
        grid: {
          initial: state.grid.initial,
          current: newGrid,
        },
        movesCount,
        hasWon,
        records: nextRecords,
        lastResult,
        solution: [],
        solverStatus: hasWon
          ? "idle"
          : canSolve(state.settings.gridSize)
            ? "computing"
            : "unavailable",
        hydrated: true,
      });

      if (!hasWon) {
        // 每次落子后更新提示解
        scheduleSolve(newGrid, state.settings.gridSize);
      }
    },
    updateSettings: (next) => {
      // 修改难度/密度会重建棋盘，并在已开局时重新走倒计时
      const hasStarted = get().hasManualStart;
      const existingPauseReasons = get().pauseReasons.filter(
        (reason) => reason !== "countdown",
      );
      const nextSettings = { ...get().settings, ...next };
      saveSettings(nextSettings);
      const nextState = createInitialState(
        nextSettings,
        hasStarted,
        hasStarted,
      );
      set({
        ...nextState,
        settings: nextSettings,
        hydrated: true,
        showHint: false,
        ...(hasStarted
          ? {
              isPaused: true,
              pausedAt: nextState.startedAt || Date.now(),
              pausedTotalMs: 0,
              pauseReasons: Array.from(
                new Set([...existingPauseReasons, "countdown"]),
              ),
              resumeCountdown: 3,
            }
          : { resumeCountdown: 0 }),
      });
      scheduleSolve(nextState.grid.current, nextSettings.gridSize);
    },
    updateAudioSettings: (next) => {
      const nextSettings = { ...get().audioSettings, ...next };
      saveAudioSettings(nextSettings);
      set({ audioSettings: nextSettings });
    },
    toggleHint: () => {
      set((state) => {
        const nextShow = !state.showHint;
        return {
          // 一旦用户打开过提示，记录 usedHint=true 用于链上成绩标签
          showHint: nextShow,
          usedHint: nextShow ? true : state.usedHint,
        };
      });
    },
  };
});
