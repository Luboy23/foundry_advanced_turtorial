/**
 * 模块职责：提供 shared/utils/math.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}
