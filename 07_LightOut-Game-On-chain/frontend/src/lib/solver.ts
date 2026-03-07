import { type Grid, type Move } from "./game";

type GridHash = number;

// 目标态定义：所有 bit 为 1（即全亮）
const isWon = (grid: GridHash, size: number): boolean => {
  const winHash = (1 << (size * size)) - 1;
  return grid === winHash;
};

// 将二维棋盘压缩为位图整数，便于做 BFS 去重与线性代数运算
const hash = (grid: Grid, size: number): number => {
  let result = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        result |= 1 << (r * size + c);
      }
    }
  }

  return result;
};

const toggleCell = (
  grid: GridHash,
  row: number,
  column: number,
  size: number,
): GridHash => {
  let newGrid = grid;

  // 规则与游戏一致：翻转整行整列
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (row === r || column === c) {
        newGrid = newGrid ^ (1 << (r * size + c));
      }
    }
  }

  return newGrid;
};

// 小棋盘用 BFS 求最短解，结果更直观且便于教学演示
const solveByBfs = (grid: Grid, size: number): Move[] => {
  const start = hash(grid, size);
  if (isWon(start, size)) {
    return [];
  }

  const queue: GridHash[] = [start];
  let head = 0;
  const visited = new Set<GridHash>([start]);
  const parents = new Map<GridHash, { prev: GridHash; move: Move }>();
  const winHash = (1 << (size * size)) - 1;

  // 标准 BFS：首次到达目标即为最少步数解
  while (head < queue.length) {
    const current = queue[head++];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const next = toggleCell(current, r, c, size);
        if (visited.has(next)) continue;
        visited.add(next);
        parents.set(next, { prev: current, move: { row: r, column: c } });
        if (next === winHash) {
          // 回溯父节点重建路径
          const path: Move[] = [];
          let cursor = next;
          while (parents.has(cursor)) {
            const { prev, move } = parents.get(cursor)!;
            path.push(move);
            cursor = prev;
          }
          return path.reverse();
        }
        queue.push(next);
      }
    }
  }

  return [];
};

// GF(2) 高斯消元：把 Lights Out 转成线性方程组 A*x=b
const gaussianElimination = (
  matrix: number[][],
  vector: number[],
): {
  matrix: number[][];
  vector: number[];
  pivotCols: number[];
  rank: number;
} | null => {
  const rowCount = matrix.length;
  const colCount = matrix[0].length;
  const pivotCols: number[] = [];

  let row = 0;
  for (let col = 0; col < colCount && row < rowCount; col++) {
    // 找主元（值为 1 的行）
    let pivot = row;
    while (pivot < rowCount && matrix[pivot][col] === 0) {
      pivot += 1;
    }
    if (pivot === rowCount) {
      continue;
    }

    if (pivot !== row) {
      // 行交换
      [matrix[row], matrix[pivot]] = [matrix[pivot], matrix[row]];
      [vector[row], vector[pivot]] = [vector[pivot], vector[row]];
    }

    pivotCols[row] = col;
    // 消元（按位异或）
    for (let r = row + 1; r < rowCount; r++) {
      if (matrix[r][col] === 1) {
        for (let c = col; c < colCount; c++) {
          matrix[r][c] ^= matrix[row][c];
        }
        vector[r] ^= vector[row];
      }
    }
    row += 1;
  }

  // 检查无解：0 = 1 这类矛盾行
  for (let r = row; r < rowCount; r++) {
    let hasCoefficient = false;
    for (let c = 0; c < colCount; c++) {
      if (matrix[r][c] === 1) {
        hasCoefficient = true;
        break;
      }
    }
    if (!hasCoefficient && vector[r] === 1) {
      return null;
    }
  }

  return { matrix, vector, pivotCols, rank: row };
};

// 回代求一个具体解；自由元由枚举外层提供
const backSubstitute = (
  matrix: number[][],
  vector: number[],
  pivotCols: number[],
  rank: number,
  freeValues: number[],
  freeCols: number[],
): number[] => {
  const colCount = matrix[0].length;
  const solution = Array(colCount).fill(0);

  for (let i = 0; i < freeCols.length; i++) {
    solution[freeCols[i]] = freeValues[i];
  }

  for (let r = rank - 1; r >= 0; r--) {
    const col = pivotCols[r];
    let value = vector[r];
    for (let c = col + 1; c < colCount; c++) {
      if (matrix[r][c] === 1 && solution[c] === 1) {
        value ^= 1;
      }
    }
    solution[col] = value;
  }

  return solution;
};

// 大棋盘用线性代数求解，避免 BFS 状态爆炸
const solveByLinear = (grid: Grid, size: number): Move[] => {
  const variableCount = size * size;
  const matrix = Array.from({ length: variableCount }, () =>
    Array(variableCount).fill(0),
  );
  const vector = Array(variableCount).fill(0);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const eqIndex = r * size + c;
      // A 矩阵第 eqIndex 行：点击同一行/列的变量对该格有影响
      for (let j = 0; j < size; j++) {
        matrix[eqIndex][r * size + j] = 1;
      }
      for (let i = 0; i < size; i++) {
        matrix[eqIndex][i * size + c] = 1;
      }
      vector[eqIndex] = grid[r][c] ? 0 : 1;
    }
  }

  const reduced = gaussianElimination(matrix, vector);
  if (!reduced) {
    return [];
  }

  const { matrix: reducedMatrix, vector: reducedVector, pivotCols, rank } =
    reduced;
  const colCount = reducedMatrix[0].length;
  const isPivot = Array(colCount).fill(false);
  for (let i = 0; i < rank; i++) {
    isPivot[pivotCols[i]] = true;
  }
  const freeCols = [];
  for (let c = 0; c < colCount; c++) {
    if (!isPivot[c]) {
      freeCols.push(c);
    }
  }

  const freeCount = freeCols.length;
  const totalCombinations = 1 << freeCount;
  let bestSolution: number[] | null = null;
  let bestWeight = Number.POSITIVE_INFINITY;

  // 穷举自由元，选汉明重量最小（点击次数最少）的解
  const freeValues = Array(freeCount).fill(0);
  for (let mask = 0; mask < totalCombinations; mask++) {
    for (let i = 0; i < freeCount; i++) {
      freeValues[i] = (mask >> i) & 1;
    }
    const solution = backSubstitute(
      reducedMatrix,
      reducedVector,
      pivotCols,
      rank,
      freeValues,
      freeCols,
    );
    let weight = 0;
    for (let i = 0; i < solution.length; i++) {
      weight += solution[i];
      if (weight >= bestWeight) break;
    }
    if (weight < bestWeight) {
      bestWeight = weight;
      bestSolution = solution;
      if (bestWeight === 0) {
        break;
      }
    }
  }

  const finalSolution = bestSolution ?? [];
  const moves: Move[] = [];
  for (let idx = 0; idx < finalSolution.length; idx++) {
    if (finalSolution[idx] === 1) {
      moves.push({ row: Math.floor(idx / size), column: idx % size });
    }
  }
  return moves;
};

export const solve = (grid: Grid): Move[] => {
  const size = grid.length;
  // 教学场景下 4x4 用 BFS 更容易解释“最短路径”概念；
  // 5x5、6x6 用线性代数更稳定且性能更好
  if (size <= 4) {
    return solveByBfs(grid, size);
  }
  return solveByLinear(grid, size);
};
