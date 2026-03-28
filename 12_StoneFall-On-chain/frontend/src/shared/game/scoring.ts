/**
 * 模块职责：提供 shared/game/scoring.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { HazardType } from '../../game/types'

/**
 * getHazardDodgeScore：读取并返回对应数据。
 */
export const getHazardDodgeScore = (hazardType: HazardType): number => {
  return hazardType === 'spike' ? 1 : 2
}

