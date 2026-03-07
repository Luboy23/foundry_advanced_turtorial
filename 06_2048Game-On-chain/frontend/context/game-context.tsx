"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Tile } from "@/models/tile";

type Direction = "up" | "down" | "left" | "right";
type Status = "playing" | "won" | "lost";

type GameContextValue = {
  getTiles: () => Tile[];
  moveTiles: (direction: Direction) => void;
  startGame: () => void;
  markScoreSubmitted: () => void;
  isReady: boolean;
  status: Status;
  score: number;
  durationSeconds: number;
  submissionRequired: boolean;
};

const BOARD_SIZE = 4;
const PERSIST_KEY = "onchain2048:state";
const PERSIST_VERSION = 1;

type PersistedState = {
  version: number;
  board: number[][];
  score: number;
  status: Status;
  isReady: boolean;
  submissionRequired: boolean;
  durationSeconds: number;
  startedAt: number | null;
  updatedAt: number;
};

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 0)
  );
}

function isValidBoard(board: unknown): board is number[][] {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) {
    return false;
  }
  return board.every(
    (row) =>
      Array.isArray(row) &&
      row.length === BOARD_SIZE &&
      row.every((value) => Number.isFinite(value) && value >= 0)
  );
}

function loadPersistedState(): PersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== PERSIST_VERSION) {
      return null;
    }
    // 持久化数据按“版本 + 结构 + 数值范围”三层校验，避免旧数据污染状态机。
    if (!isValidBoard(parsed.board)) {
      return null;
    }
    if (!Number.isFinite(parsed.score) || parsed.score < 0) {
      return null;
    }
    if (parsed.status !== "playing" && parsed.status !== "won" && parsed.status !== "lost") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function addRandomTile(board: number[][]): number[][] {
  const empty: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === 0) {
        empty.push({ row, col });
      }
    }
  }

  if (empty.length === 0) {
    return board;
  }

  const choice = empty[Math.floor(Math.random() * empty.length)];
  // 2048 标准概率：90% 出 2，10% 出 4。
  const value = Math.random() < 0.9 ? 2 : 4;
  const next = board.map((row) => [...row]);
  next[choice.row][choice.col] = value;
  return next;
}

function mergeLine(line: number[]) {
  const filtered = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let score = 0;

  // 同一行（或列）每个数字每次移动最多参与一次合并。
  for (let index = 0; index < filtered.length; index += 1) {
    if (filtered[index] === filtered[index + 1]) {
      const value = filtered[index] * 2;
      merged.push(value);
      score += value;
      index += 1;
    } else {
      merged.push(filtered[index]);
    }
  }

  while (merged.length < BOARD_SIZE) {
    merged.push(0);
  }

  const moved = !line.every((value, idx) => value === merged[idx]);
  return { line: merged, score, moved };
}

function hasWon(board: number[][]) {
  return board.some((row) => row.some((value) => value >= 2048));
}

function hasMoves(board: number[][]) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = board[row][col];
      if (value === 0) {
        return true;
      }
      // 只检查右、下相邻即可覆盖所有可合并场景。
      if (row < BOARD_SIZE - 1 && board[row + 1][col] === value) {
        return true;
      }
      if (col < BOARD_SIZE - 1 && board[row][col + 1] === value) {
        return true;
      }
    }
  }
  return false;
}

function computeNextBoard(board: number[][], direction: Direction) {
  const next = createEmptyBoard();
  let moved = false;
  let score = 0;

  // 左右移动按“行”处理，上下移动按“列”处理，最后统一写回新棋盘。
  if (direction === "left" || direction === "right") {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      const line = direction === "left" ? board[row] : [...board[row]].reverse();
      const merged = mergeLine(line);
      const finalLine =
        direction === "left" ? merged.line : [...merged.line].reverse();

      next[row] = finalLine;
      moved = moved || merged.moved;
      score += merged.score;
    }
  } else {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const column = board.map((row) => row[col]);
      const line = direction === "up" ? column : [...column].reverse();
      const merged = mergeLine(line);
      const finalLine =
        direction === "up" ? merged.line : [...merged.line].reverse();

      for (let row = 0; row < BOARD_SIZE; row += 1) {
        next[row][col] = finalLine[row];
      }

      moved = moved || merged.moved;
      score += merged.score;
    }
  }

  return { next, moved, score };
}

export const GameContext = createContext<GameContextValue>({
  getTiles: () => [],
  moveTiles: () => {},
  startGame: () => {},
  markScoreSubmitted: () => {},
  isReady: false,
  status: "playing",
  score: 0,
  durationSeconds: 0,
  submissionRequired: false,
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [board, setBoard] = useState<number[][]>(() => createEmptyBoard());
  const [status, setStatus] = useState<Status>("playing");
  const [score, setScore] = useState(0);
  const [submissionRequired, setSubmissionRequired] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    // 刷新页面后恢复进行中的棋局，避免误丢局。
    const persisted = loadPersistedState();
    if (!persisted) {
      return;
    }
    setBoard(persisted.board);
    setScore(persisted.score);
    setStatus(persisted.status);
    setIsReady(persisted.isReady);
    setSubmissionRequired(persisted.submissionRequired);
    setDurationSeconds(persisted.durationSeconds);
    setStartedAt(persisted.startedAt);
  }, []);

  const startGame = useCallback(() => {
    // 等待上链提交期间禁止开新局，避免一局多次提交。
    if (submissionRequired) {
      return;
    }
    let fresh = createEmptyBoard();
    fresh = addRandomTile(fresh);
    fresh = addRandomTile(fresh);
    setBoard(fresh);
    setScore(0);
    setStatus("playing");
    setSubmissionRequired(false);
    setIsReady(true);
    setDurationSeconds(0);
    setStartedAt(Date.now());
  }, [submissionRequired]);

  const markScoreSubmitted = useCallback(() => {
    // 上链成功后关闭“待提交”标记，允许用户开始下一局。
    setSubmissionRequired(false);
  }, []);

  const finalizeDuration = useCallback(() => {
    if (startedAt === null) {
      return;
    }
    const finalSeconds = Math.floor((Date.now() - startedAt) / 1000);
    setDurationSeconds(finalSeconds);
  }, [startedAt]);

  useEffect(() => {
    if (!isReady || status !== "playing" || startedAt === null) {
      return;
    }

    // 只在对局进行中刷新用时；结束后由 finalizeDuration 固化最终值。
    const timer = window.setInterval(() => {
      const nextSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setDurationSeconds(nextSeconds);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isReady, startedAt, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    // 仅持久化“进行中”或“等待上链提交”的对局；其它状态直接清理。
    const shouldPersist = isReady && (status === "playing" || submissionRequired);
    if (!shouldPersist) {
      window.localStorage.removeItem(PERSIST_KEY);
      return;
    }
    const payload: PersistedState = {
      version: PERSIST_VERSION,
      board,
      score,
      status,
      isReady,
      submissionRequired,
      durationSeconds,
      startedAt,
      updatedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
    } catch {
      // 忽略存储异常（如配额不足），不影响当前局继续进行。
    }
  }, [
    board,
    durationSeconds,
    isReady,
    score,
    startedAt,
    status,
    submissionRequired,
  ]);

  const moveTiles = useCallback(
    (direction: Direction) => {
      setBoard((prev) => {
        if (status !== "playing") {
          return prev;
        }

        // 先计算“纯移动结果”，再决定是否生成新块与切换胜负状态。
        const { next, moved, score: gained } = computeNextBoard(prev, direction);

        if (!moved) {
          // 即使本次方向不能移动，也要判断是否已无路可走。
          if (!hasMoves(prev)) {
            setStatus("lost");
            setSubmissionRequired(true);
            finalizeDuration();
          }
          return prev;
        }

        const withSpawn = addRandomTile(next);
        setScore((current) => current + gained);

        // 一旦胜利或失败就进入“待上链提交”状态，由 AutoSubmitter 负责发交易。
        if (hasWon(withSpawn)) {
          setStatus("won");
          setSubmissionRequired(true);
          finalizeDuration();
        } else if (!hasMoves(withSpawn)) {
          setStatus("lost");
          setSubmissionRequired(true);
          finalizeDuration();
        }

        return withSpawn;
      });
    },
    [finalizeDuration, status]
  );

  const tiles = useMemo<Tile[]>(() => {
    const result: Tile[] = [];
    let id = 0;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const value = board[row][col];
        if (value !== 0) {
          result.push({ id, value, row, col });
        }
        id += 1;
      }
    }
    return result;
  }, [board]);

  const getTiles = useCallback(() => tiles, [tiles]);

  const value = useMemo(
    () => ({
      getTiles,
      moveTiles,
      startGame,
      markScoreSubmitted,
      isReady,
      status,
      score,
      durationSeconds,
      submissionRequired,
    }),
    [
      getTiles,
      moveTiles,
      startGame,
      markScoreSubmitted,
      isReady,
      status,
      score,
      durationSeconds,
      submissionRequired,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
