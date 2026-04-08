/**
 * 极小型数学工具集。
 * 当前只保留 clamp，供难度、触控和物理边界复用。
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}
