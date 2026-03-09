"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";

import { audioManager } from "@/lib/audio";
import {
  LIGHTS_OUT_ADDRESS,
  LIGHTS_OUT_ADDRESS_VALID,
  densityLabel as densityLabelOnchain,
  densityToIndex,
} from "@/lib/contract";
import {
  DENSITY_OPTIONS,
  GRID_OPTIONS,
  useGameStore,
} from "@/store/gameStore";
import { primaryButtonClass, secondaryButtonClass } from "./buttonStyles";

type ActiveModal = "records" | "settings" | "onchain" | null;
type MobileAction = "records" | "onchain" | "settings";
type HintFilter = "all" | "no" | "used";
type GridFilter = number | "all";
type DensityFilter = "all" | (typeof DENSITY_OPTIONS)[number]["value"];

interface ChainRecord {
  player: string;
  gridSize: number;
  density: number;
  moves: number;
  durationMs: number;
  finishedAt: number;
  usedHint: boolean;
  txHash: string;
}

const resultEvent = parseAbiItem(
  "event ResultSubmitted(address indexed player, uint8 indexed gridSize, uint8 indexed density, uint32 moves, uint32 durationMs, uint64 finishedAt, bool usedHint)",
);

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatChainTime = (timestampSec: number) =>
  formatTime(timestampSec * 1000);

const gridLabel = (size: number) =>
  GRID_OPTIONS.find((option) => option.size === size)?.label ?? "未知";

const shortAddress = (address?: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "未知地址";

const RECORD_FILTERS_KEY = "lights-out-record-filters-open";
const ONCHAIN_FILTERS_KEY = "lights-out-onchain-filters-open";

const loadBoolSetting = (key: string, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (stored === null) return fallback;
  return stored === "true";
};

const saveBoolSetting = (key: string, value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
};

const Modal = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const handleClose = () => {
    audioManager.playSfx("click");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/20 px-4 py-6 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[86dvh] w-full max-w-lg flex-col rounded-2xl border border-rose-200 bg-white p-5 text-left text-rose-700 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-rose-600">{title}</p>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-semibold text-rose-400 transition hover:text-rose-500"
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
};

const FilterBar = ({
  open,
  onToggle,
  gridValue,
  densityValue,
  hintValue,
  onGridChange,
  onDensityChange,
  onHintChange,
}: {
  open: boolean;
  onToggle: () => void;
  gridValue: GridFilter;
  densityValue: DensityFilter;
  hintValue: HintFilter;
  onGridChange: (value: GridFilter) => void;
  onDensityChange: (value: DensityFilter) => void;
  onHintChange: (value: HintFilter) => void;
}) => (
  <div className="mb-4 flex items-center gap-2 overflow-x-auto text-[11px] whitespace-nowrap">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2 py-1 font-semibold text-rose-500 transition hover:border-rose-300"
    >
      <span>筛选</span>
      <span className="text-[10px] font-medium text-rose-400">
        {open ? "收起" : "展开"}
      </span>
    </button>
    {open && (
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-rose-400">
          难度
          <select
            value={String(gridValue)}
            onChange={(event) => {
              const value = event.target.value;
              onGridChange(value === "all" ? "all" : Number(value));
            }}
            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          >
            <option value="all">全部</option>
            {GRID_OPTIONS.map((option) => (
              <option key={option.size} value={option.size}>
                {option.label} · {option.size}×{option.size}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-rose-400">
          密度
          <select
            value={densityValue}
            onChange={(event) =>
              onDensityChange(event.target.value as DensityFilter)
            }
            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          >
            <option value="all">全部</option>
            {DENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-rose-400">
          提示
          <select
            value={hintValue}
            onChange={(event) => onHintChange(event.target.value as HintFilter)}
            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          >
            <option value="all">全部</option>
            <option value="no">无提示</option>
            <option value="used">使用提示</option>
          </select>
        </label>
      </div>
    )}
  </div>
);

export const GameActions = () => {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [showHintNotice, setShowHintNotice] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [chainRecords, setChainRecords] = useState<ChainRecord[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [selfRecords, setSelfRecords] = useState<ChainRecord[]>([]);
  const [selfLoading, setSelfLoading] = useState(false);
  const [selfError, setSelfError] = useState<string | null>(null);
  const chainLastBlockRef = useRef<bigint | null>(null);
  const selfLastBlockRef = useRef<bigint | null>(null);
  const lastSelfAddressRef = useRef<string | null>(null);
  const newGame = useGameStore((state) => state.newGame);
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const chainRefreshNonce = useGameStore((state) => state.chainRefreshNonce);
  const showHint = useGameStore((state) => state.showHint);
  const toggleHint = useGameStore((state) => state.toggleHint);
  const hydrateFromStorage = useGameStore((state) => state.hydrateFromStorage);
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const hasManualStart = useGameStore((state) => state.hasManualStart);
  const hasWon = useGameStore((state) => state.hasWon);
  const isPaused = useGameStore((state) => state.isPaused);
  const resumeCountdown = useGameStore((state) => state.resumeCountdown);
  const audioSettings = useGameStore((state) => state.audioSettings);
  const updateAudioSettings = useGameStore((state) => state.updateAudioSettings);
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [recordGrid, setRecordGrid] = useState<GridFilter>("all");
  const [recordDensity, setRecordDensity] = useState<DensityFilter>("all");
  const [recordHintFilter, setRecordHintFilter] =
    useState<HintFilter>("all");
  const [recordFiltersOpen, setRecordFiltersOpen] = useState(true);
  const [onchainGrid, setOnchainGrid] = useState<GridFilter>("all");
  const [onchainDensity, setOnchainDensity] = useState<DensityFilter>("all");
  const [onchainHintFilter, setOnchainHintFilter] =
    useState<HintFilter>("all");
  const [onchainFiltersOpen, setOnchainFiltersOpen] = useState(true);

  const filteredRecords = useMemo(() => {
    return selfRecords
      .filter((record) => {
        if (recordGrid === "all") return true;
        return record.gridSize === recordGrid;
      })
      .filter((record) => {
        if (recordDensity === "all") return true;
        return record.density === densityToIndex(recordDensity);
      })
      .filter((record) => {
        if (recordHintFilter === "no") return !record.usedHint;
        if (recordHintFilter === "used") return record.usedHint;
        return true;
      })
      .sort((a, b) => b.finishedAt - a.finishedAt);
  }, [selfRecords, recordDensity, recordGrid, recordHintFilter]);

  const filteredOnchain = useMemo(() => {
    return chainRecords
      .filter((record) => {
        if (onchainGrid === "all") return true;
        return record.gridSize === onchainGrid;
      })
      .filter((record) => {
        if (onchainDensity === "all") return true;
        return record.density === densityToIndex(onchainDensity);
      })
      .filter((record) => {
        if (onchainHintFilter === "no") return !record.usedHint;
        if (onchainHintFilter === "used") return record.usedHint;
        return true;
      })
      .sort((a, b) => {
        const moveDiff = a.moves - b.moves;
        if (moveDiff !== 0) return moveDiff;
        const timeDiff = a.durationMs - b.durationMs;
        if (timeDiff !== 0) return timeDiff;
        return a.finishedAt - b.finishedAt;
      })
      .slice(0, 10);
  }, [chainRecords, onchainDensity, onchainGrid, onchainHintFilter]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    const nextAddress = address ?? null;
    if (lastSelfAddressRef.current !== nextAddress) {
      lastSelfAddressRef.current = nextAddress;
      selfLastBlockRef.current = null;
      setSelfRecords([]);
    }
  }, [address]);

  useEffect(() => {
    setRecordFiltersOpen(loadBoolSetting(RECORD_FILTERS_KEY, true));
    setOnchainFiltersOpen(loadBoolSetting(ONCHAIN_FILTERS_KEY, true));
  }, []);

  useEffect(() => {
    saveBoolSetting(RECORD_FILTERS_KEY, recordFiltersOpen);
  }, [recordFiltersOpen]);

  useEffect(() => {
    saveBoolSetting(ONCHAIN_FILTERS_KEY, onchainFiltersOpen);
  }, [onchainFiltersOpen]);

  useEffect(() => {
    if (activeModal !== "onchain") return;
    if (!publicClient) return;
    if (!LIGHTS_OUT_ADDRESS_VALID || !LIGHTS_OUT_ADDRESS) {
      setChainError("未配置合约地址");
      setChainRecords([]);
      return;
    }

    let cancelled = false;
    if (chainRefreshNonce > 0) {
      chainLastBlockRef.current = null;
      setChainRecords([]);
    }
    const load = async () => {
      setChainLoading(true);
      setChainError(null);
      try {
        const latestBlock = await publicClient.getBlockNumber();
        if (
          chainLastBlockRef.current !== null &&
          latestBlock < chainLastBlockRef.current
        ) {
          chainLastBlockRef.current = null;
          setChainRecords([]);
        }

        const fromBlock =
          chainLastBlockRef.current !== null
            ? chainLastBlockRef.current + 1n
            : 0n;

        if (fromBlock > latestBlock) {
          setChainLoading(false);
          return;
        }

        const logs = await publicClient.getLogs({
          address: LIGHTS_OUT_ADDRESS,
          event: resultEvent,
          fromBlock,
          toBlock: latestBlock,
        });
        if (cancelled) return;
        const entries = logs.map((log) => ({
          player: log.args.player as string,
          gridSize: Number(log.args.gridSize),
          density: Number(log.args.density),
          moves: Number(log.args.moves),
          durationMs: Number(log.args.durationMs),
          finishedAt: Number(log.args.finishedAt),
          usedHint: Boolean(log.args.usedHint),
          txHash: log.transactionHash,
        }));
        setChainRecords((prev) =>
          fromBlock === 0n ? entries : [...prev, ...entries],
        );
        chainLastBlockRef.current = latestBlock;
      } catch {
        if (!cancelled) {
          setChainError("链上数据加载失败");
        }
      } finally {
        if (!cancelled) {
          setChainLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [activeModal, chainRefreshNonce, publicClient]);

  useEffect(() => {
    if (activeModal !== "records") return;
    if (!publicClient) return;
    if (!LIGHTS_OUT_ADDRESS_VALID || !LIGHTS_OUT_ADDRESS) {
      setSelfError("未配置合约地址");
      setSelfRecords([]);
      setSelfLoading(false);
      return;
    }
    if (!isConnected || !address) {
      setSelfError("连接钱包后查看");
      setSelfRecords([]);
      setSelfLoading(false);
      return;
    }

    let cancelled = false;
    if (chainRefreshNonce > 0) {
      selfLastBlockRef.current = null;
      setSelfRecords([]);
    }
    const load = async () => {
      setSelfLoading(true);
      setSelfError(null);
      try {
        const latestBlock = await publicClient.getBlockNumber();
        if (
          selfLastBlockRef.current !== null &&
          latestBlock < selfLastBlockRef.current
        ) {
          selfLastBlockRef.current = null;
          setSelfRecords([]);
        }

        const fromBlock =
          selfLastBlockRef.current !== null ? selfLastBlockRef.current + 1n : 0n;

        if (fromBlock > latestBlock) {
          setSelfLoading(false);
          return;
        }

        const logs = await publicClient.getLogs({
          address: LIGHTS_OUT_ADDRESS,
          event: resultEvent,
          fromBlock,
          toBlock: latestBlock,
          args: { player: address },
        });
        if (cancelled) return;
        const entries = logs.map((log) => ({
          player: log.args.player as string,
          gridSize: Number(log.args.gridSize),
          density: Number(log.args.density),
          moves: Number(log.args.moves),
          durationMs: Number(log.args.durationMs),
          finishedAt: Number(log.args.finishedAt),
          usedHint: Boolean(log.args.usedHint),
          txHash: log.transactionHash,
        }));
        setSelfRecords((prev) =>
          fromBlock === 0n ? entries : [...prev, ...entries],
        );
        selfLastBlockRef.current = latestBlock;
      } catch {
        if (!cancelled) {
          setSelfError("链上记录加载失败");
        }
      } finally {
        if (!cancelled) {
          setSelfLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [activeModal, address, chainRefreshNonce, isConnected, publicClient]);

  const handleNewGame = () => {
    audioManager.playSfx("click");
    if (!isConnected) {
      return;
    }
    newGame();
  };

  const handleToggleHint = () => {
    if (!showHint) {
      setShowHintNotice(true);
      return;
    }
    audioManager.playSfx("click");
    toggleHint();
  };

  const handleConfirmHint = () => {
    audioManager.playSfx("hint");
    setShowHintNotice(false);
    if (!showHint) {
      toggleHint();
    }
  };

  const handleCancelHint = () => {
    setShowHintNotice(false);
  };

  const handleOpenModal = (next: ActiveModal) => {
    if (resumeCountdown > 0) return;
    audioManager.playSfx("click");
    if (hasManualStart && !hasWon) {
      pauseGame("modal");
    }
    if (next === "records") {
      setRecordGrid("all");
      setRecordDensity("all");
      setRecordHintFilter("all");
    }
    if (next === "onchain") {
      setOnchainGrid("all");
      setOnchainDensity("all");
      setOnchainHintFilter("all");
    }
    setActiveModal(next);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    if (isPaused) {
      resumeGame("modal");
    }
  };

  const handleOpenActionSheet = () => {
    if (resumeCountdown > 0) return;
    audioManager.playSfx("click");
    setActionSheetOpen(true);
  };

  const handleCloseActionSheet = () => {
    audioManager.playSfx("click");
    setActionSheetOpen(false);
  };

  const handleSelectMobileAction = (action: MobileAction) => {
    setActionSheetOpen(false);
    handleOpenModal(action);
  };

  useEffect(() => {
    if (showHintNotice) {
      pauseGame("hint");
    } else {
      resumeGame("hint");
    }
  }, [pauseGame, resumeGame, showHintNotice]);

  useEffect(() => {
    const handleVisibilityPause = () => {
      if (!hasManualStart || hasWon) return;
      if (document.hidden) {
        pauseGame("visibility");
      } else {
        resumeGame("visibility");
      }
    };
    const handleBlur = () => {
      if (!hasManualStart || hasWon) return;
      pauseGame("visibility");
    };
    const handleFocus = () => {
      if (!hasManualStart || hasWon) return;
      resumeGame("visibility");
    };
    document.addEventListener("visibilitychange", handleVisibilityPause);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityPause);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [hasManualStart, hasWon, pauseGame, resumeGame]);

  const handleToggleMusic = () => {
    audioManager.playSfx("click");
    updateAudioSettings({ musicEnabled: !audioSettings.musicEnabled });
  };

  const handleToggleSfx = () => {
    audioManager.playSfx("click");
    updateAudioSettings({ sfxEnabled: !audioSettings.sfxEnabled });
  };

  const handleConnect = () => {
    audioManager.playSfx("click");
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  const handleDisconnect = () => {
    audioManager.playSfx("click");
    disconnect();
  };

  const isCountdownActive = resumeCountdown > 0;

  return (
    <>
      <div className="mt-2.5 rounded-2xl border border-rose-200 bg-white/95 p-2 shadow-sm md:mt-2 md:p-2.5">
        <div className="hidden grid-cols-5 gap-1.5 lg:grid">
          <button
            className={`${primaryButtonClass} w-full ${
              !isConnected || isPaused ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={handleNewGame}
            disabled={!isConnected || isPaused}
          >
            新游戏
          </button>
          <button
            className={`${secondaryButtonClass} w-full ${
              showHint
                ? "!border-rose-500 !bg-rose-500 !text-white shadow-md shadow-rose-500/30 hover:!bg-rose-600"
                : ""
            } ${isPaused ? "cursor-not-allowed opacity-70" : ""}`}
            onClick={handleToggleHint}
            disabled={isPaused}
          >
            {showHint ? "隐藏提示" : "提示"}
          </button>
          <button
            className={`${secondaryButtonClass} w-full ${
              isCountdownActive ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={() => handleOpenModal("records")}
            disabled={isCountdownActive}
          >
            对局记录
          </button>
          <button
            className={`${secondaryButtonClass} w-full ${
              isCountdownActive ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={() => handleOpenModal("onchain")}
            disabled={isCountdownActive}
          >
            链上榜
          </button>
          <button
            className={`${secondaryButtonClass} w-full ${
              isCountdownActive ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={() => handleOpenModal("settings")}
            disabled={isCountdownActive}
          >
            设置
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:hidden">
          <button
            className={`${primaryButtonClass} w-full ${
              !isConnected || isPaused ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={handleNewGame}
            disabled={!isConnected || isPaused}
          >
            新游戏
          </button>
          <button
            className={`${secondaryButtonClass} w-full ${
              showHint
                ? "!border-rose-500 !bg-rose-500 !text-white shadow-md shadow-rose-500/30 hover:!bg-rose-600"
                : ""
            } ${isPaused ? "cursor-not-allowed opacity-70" : ""}`}
            onClick={handleToggleHint}
            disabled={isPaused}
          >
            {showHint ? "隐藏提示" : "提示"}
          </button>
          <button
            className={`${secondaryButtonClass} w-full ${
              isCountdownActive ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={handleOpenActionSheet}
            disabled={isCountdownActive}
          >
            更多操作
          </button>
        </div>

        {isCountdownActive && (
          <p className="mt-2 text-[11px] text-rose-400 lg:hidden">
            倒计时进行中，更多操作暂不可用
          </p>
        )}
      </div>

      {actionSheetOpen && (
        <div className="fixed inset-0 z-[55] lg:hidden">
          <button
            type="button"
            aria-label="关闭操作面板"
            className="absolute inset-0 bg-rose-950/35"
            onClick={handleCloseActionSheet}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-rose-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 shadow-2xl shadow-rose-200/40">
            <button
              type="button"
              aria-label="拖拽关闭区"
              onClick={handleCloseActionSheet}
              className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-rose-200/80"
            />
            <p className="text-center text-sm font-semibold text-rose-600">
              更多操作
            </p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => handleSelectMobileAction("records")}
                className={`${secondaryButtonClass} w-full justify-center`}
              >
                对局记录
              </button>
              <button
                type="button"
                onClick={() => handleSelectMobileAction("onchain")}
                className={`${secondaryButtonClass} w-full justify-center`}
              >
                链上榜
              </button>
              <button
                type="button"
                onClick={() => handleSelectMobileAction("settings")}
                className={`${secondaryButtonClass} w-full justify-center`}
              >
                设置
              </button>
            </div>
            <button
              type="button"
              onClick={handleCloseActionSheet}
              className="mt-3 w-full rounded-lg border border-rose-200 bg-rose-50 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-100"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {activeModal === "records" && (
        <Modal title="对局记录" onClose={handleCloseModal}>
          <p className="mb-3 text-xs text-rose-400">
            仅展示当前钱包的链上对局记录 · 按时间倒序展示
          </p>
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-xs text-rose-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {isConnected ? `钱包：${shortAddress(address)}` : "未连接钱包"}
              </span>
              {isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  断开
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  {isConnecting ? "连接中…" : "连接钱包"}
                </button>
              )}
            </div>
            <div className="mt-2 text-[11px] text-rose-400">
              网络：Anvil (31337)
            </div>
            <div className="mt-1 break-all text-[11px] text-rose-400">
              合约：{LIGHTS_OUT_ADDRESS_VALID ? LIGHTS_OUT_ADDRESS : "未配置"}
            </div>
          </div>
          <FilterBar
            open={recordFiltersOpen}
            onToggle={() => setRecordFiltersOpen((prev) => !prev)}
            gridValue={recordGrid}
            densityValue={recordDensity}
            hintValue={recordHintFilter}
            onGridChange={setRecordGrid}
            onDensityChange={setRecordDensity}
            onHintChange={setRecordHintFilter}
          />
          {selfLoading ? (
            <p className="text-sm text-rose-400">加载中…</p>
          ) : selfError ? (
            <p className="text-sm text-rose-400">{selfError}</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-rose-400">暂无记录</p>
          ) : (
            <ol className="space-y-2">
              {filteredRecords.map((record) => (
                <li
                  key={record.txHash}
                  className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700 sm:text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{gridLabel(record.gridSize)}</span>
                      <span className="text-rose-400">
                        {record.gridSize}×{record.gridSize}
                      </span>
                      <span className="text-rose-500">
                        {record.moves} 步
                      </span>
                      {record.usedHint ? (
                        <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                          使用提示
                        </span>
                      ) : (
                        <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                          无提示
                        </span>
                      )}
                    </div>
                    <span className="text-rose-400">
                      {formatChainTime(record.finishedAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-rose-400">
                    用时 {formatDuration(record.durationMs)} · 初始密度{" "}
                    {densityLabelOnchain(record.density)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      {activeModal === "onchain" && (
        <Modal title="链上榜" onClose={handleCloseModal}>
          <p className="mb-3 text-xs text-rose-400">
            最少步数优先 · 时间次之 · 仅展示前 10 名
          </p>
          <FilterBar
            open={onchainFiltersOpen}
            onToggle={() => setOnchainFiltersOpen((prev) => !prev)}
            gridValue={onchainGrid}
            densityValue={onchainDensity}
            hintValue={onchainHintFilter}
            onGridChange={setOnchainGrid}
            onDensityChange={setOnchainDensity}
            onHintChange={setOnchainHintFilter}
          />
          {chainLoading ? (
            <p className="text-sm text-rose-400">加载中…</p>
          ) : chainError ? (
            <p className="text-sm text-rose-400">{chainError}</p>
          ) : filteredOnchain.length === 0 ? (
            <p className="text-sm text-rose-400">暂无链上记录</p>
          ) : (
            <ol className="space-y-2">
              {filteredOnchain.map((record, index) => (
                <li
                  key={`${record.txHash}-${index}`}
                  className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700 sm:text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-500">
                        #{index + 1}
                      </span>
                      <span>{shortAddress(record.player)}</span>
                      <span className="text-rose-400">
                        {record.gridSize}×{record.gridSize}
                      </span>
                    </div>
                    <span className="font-semibold text-rose-600">
                      {record.moves} 步
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-rose-400">
                    用时 {formatDuration(record.durationMs)} · 初始密度{" "}
                    {densityLabelOnchain(record.density)} ·{" "}
                    {formatChainTime(record.finishedAt)}
                    {record.usedHint ? " · 使用提示" : ""}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      {showHintNotice && (
        <Modal title="提示说明" onClose={handleCancelHint}>
          <p className="text-sm text-rose-500">
            使用提示将会在链上记录中标记“使用提示”。
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmHint}
              className={`${primaryButtonClass} w-full`}
            >
              继续使用提示
            </button>
            <button
              type="button"
              onClick={handleCancelHint}
              className={`${secondaryButtonClass} w-full`}
            >
              取消
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "settings" && (
        <Modal title="设置" onClose={handleCloseModal}>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-rose-700">难度</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GRID_OPTIONS.map((option) => {
                  const isActive = option.size === settings.gridSize;
                  return (
                    <button
                      key={option.size}
                      type="button"
                      onClick={() => {
                        audioManager.playSfx("click");
                        updateSettings({ gridSize: option.size });
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                          : "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
                      }`}
                    >
                      {option.label} · {option.size}×{option.size}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-700">初始密度</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DENSITY_OPTIONS.map((option) => {
                  const isActive = option.value === settings.density;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        audioManager.playSfx("click");
                        updateSettings({ density: option.value });
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                          : "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-rose-400">
                切换难度或初始密度会重新开始游戏
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-700">声音</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  aria-pressed={audioSettings.musicEnabled}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    audioSettings.musicEnabled
                      ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                      : "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
                  }`}
                >
                  背景音乐{audioSettings.musicEnabled ? "：开" : "：关"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleSfx}
                  aria-pressed={audioSettings.sfxEnabled}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    audioSettings.sfxEnabled
                      ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                      : "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
                  }`}
                >
                  音效{audioSettings.sfxEnabled ? "：开" : "：关"}
                </button>
              </div>
              <p className="mt-2 text-xs text-rose-400">
                首次交互后自动开始播放
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
