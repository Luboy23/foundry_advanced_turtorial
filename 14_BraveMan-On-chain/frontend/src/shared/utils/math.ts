// 数值钳制：将 value 限制在 [min, max] 闭区间内。
export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
