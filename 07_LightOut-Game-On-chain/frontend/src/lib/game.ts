export type Grid = boolean[][];
export type Move = { row: number; column: number };

// 深拷贝棋盘，保证状态更新时不污染旧引用（配合 Zustand 不可变更新）
export const cloneGrid = (grid: Grid): Grid => grid.map((row) => [...row]);

// 生成“全灭”初始棋盘：false 表示未点亮
export const createEmptyGrid = (size: number): Grid =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => false));

export const initializeGrid = (size: number, density: number): Grid => {
  // 游戏内部采用“全亮”为目标态；初始化时从全亮状态反推若干随机操作，确保关卡必可解
  const grid: Grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => true),
  );

  // 与玩家点击规则一致：翻转整行 + 整列（交叉点仅翻转一次）
  const toggleInPlace = (row: number, column: number) => {
    for (let c = 0; c < size; c++) {
      grid[row][c] = !grid[row][c];
    }
    for (let r = 0; r < size; r++) {
      if (r === row) continue;
      grid[r][column] = !grid[r][column];
    }
  };

  // 随机采样生成关卡，density 越高，翻转概率越大
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (Math.random() < density) {
        toggleInPlace(r, c);
      }
    }
  }

  return grid;
};

export const toggleGridCell = (
  grid: Grid,
  row: number,
  column: number,
): Grid => {
  const size = grid.length;
  // 返回新棋盘而不是原地修改，便于 React 做变更检测
  const newGrid = cloneGrid(grid);

  for (let c = 0; c < size; c++) {
    newGrid[row][c] = !newGrid[row][c];
  }
  for (let r = 0; r < size; r++) {
    if (r === row) continue;
    newGrid[r][column] = !newGrid[r][column];
  }

  return newGrid;
};
