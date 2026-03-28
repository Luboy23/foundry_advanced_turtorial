/**
 * 模块职责：实现障碍波次与类型抽样策略，抑制连续重复带来的体感波动。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { clamp } from '../../shared/utils/math'
import type { HazardType } from '../types'

type RandomFn = () => number

const TYPE_BAG_SIZE = 20
const MAX_TYPE_STREAK = 3
const MAX_CARRY_OVER = 2

const LOW_THREAT_WAVE_BAG: Array<1 | 2 | 3> = [1, 1, 1, 1, 2, 2]
const MID_THREAT_WAVE_BAG: Array<1 | 2 | 3> = [1, 1, 1, 2, 2, 2, 3]
const HIGH_THREAT_WAVE_BAG: Array<1 | 2 | 3> = [1, 1, 2, 2, 2, 3, 3, 3]

/**
 * 类型定义：SpawnDirectorState。
 */
export type SpawnDirectorState = {
  waveBag: Array<1 | 2 | 3>
  typeBag: HazardType[]
  carryOver: number
  lastType: HazardType | null
  typeRunLength: number
}

/**
 * 生成洗牌副本，避免直接修改常量袋子。
 */
const shuffleCopy = <T>(source: T[], random: RandomFn): T[] => {
  const bag = [...source]

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = bag[index]
    bag[index] = bag[target]
    bag[target] = current
  }

  return bag
}

/**
 * createSpawnDirectorState：创建并返回新的实例或状态。
 */
export const createSpawnDirectorState = (): SpawnDirectorState => {
  return {
    waveBag: [],
    typeBag: [],
    carryOver: 0,
    lastType: null,
    typeRunLength: 0,
  }
}

/**
 * 重置生成导演状态。
 * @param state 需要原地清空的状态对象
 */
export const resetSpawnDirectorState = (state: SpawnDirectorState): void => {
  state.waveBag = []
  state.typeBag = []
  state.carryOver = 0
  state.lastType = null
  state.typeRunLength = 0
}

/**
 * 按威胁等级构建波次袋。
 * 低威胁更多单发，中高威胁逐步提升双发/三发占比。
 */
export const buildWaveBag = (
  threatLevel: number,
  random: RandomFn = Math.random,
): Array<1 | 2 | 3> => {
  if (threatLevel < 4) {
    return shuffleCopy(LOW_THREAT_WAVE_BAG, random)
  }

  if (threatLevel < 8) {
    return shuffleCopy(MID_THREAT_WAVE_BAG, random)
  }

  return shuffleCopy(HIGH_THREAT_WAVE_BAG, random)
}

const getBurstCap = (threatLevel: number): 2 | 3 => {
  return threatLevel < 8 ? 2 : 3
}

/**
 * 计算本次波次应生成的障碍数量。
 * 关键点：当场上满员时，会把需求累计到 carryOver，后续在可用时补偿释放。
 */
export const drawWaveSpawnCount = ({
  state,
  threatLevel,
  availableSlots,
  random = Math.random,
}: {
  state: SpawnDirectorState
  threatLevel: number
  availableSlots: number
  random?: RandomFn
}): number => {
  if (availableSlots <= 0) {
    state.carryOver = clamp(state.carryOver + 1, 0, MAX_CARRY_OVER)
    return 0
  }

  if (state.waveBag.length === 0) {
    state.waveBag = buildWaveBag(threatLevel, random)
  }

  const planned = state.waveBag.pop() ?? 1
  const burstCap = getBurstCap(threatLevel)
  const demand = planned + state.carryOver
  const actual = Math.min(demand, availableSlots, burstCap)

  // 未被满足的需求继续保留，但限制最大 carryOver，避免下一帧突然爆发。
  state.carryOver = clamp(demand - actual, 0, MAX_CARRY_OVER)
  return Math.max(1, actual)
}

/**
 * 根据 spikeRatio 构建类型袋并洗牌。
 */
export const buildTypeBag = (
  spikeRatio: number,
  random: RandomFn = Math.random,
): HazardType[] => {
  const normalizedRatio = clamp(spikeRatio, 0.05, 0.95)
  const spikeCount = clamp(
    Math.round(normalizedRatio * TYPE_BAG_SIZE),
    1,
    TYPE_BAG_SIZE - 1,
  )

  const bag: HazardType[] = []
  for (let index = 0; index < spikeCount; index += 1) {
    bag.push('spike')
  }
  for (let index = spikeCount; index < TYPE_BAG_SIZE; index += 1) {
    bag.push('boulder')
  }

  return shuffleCopy(bag, random)
}

const updateTypeStreak = (state: SpawnDirectorState, current: HazardType): void => {
  if (state.lastType === current) {
    state.typeRunLength += 1
    return
  }

  state.lastType = current
  state.typeRunLength = 1
}

const forceAlternateType = ({
  state,
  selected,
  spikeRatio,
  random,
}: {
  state: SpawnDirectorState
  selected: HazardType
  spikeRatio: number
  random: RandomFn
}): HazardType => {
  // 连续超限时优先切换到另一类型；若袋子没有另一类型则重新构建。
  const alternate: HazardType = selected === 'spike' ? 'boulder' : 'spike'
  let alternateIndex = state.typeBag.lastIndexOf(alternate)

  if (alternateIndex < 0) {
    state.typeBag = buildTypeBag(spikeRatio, random)
    alternateIndex = state.typeBag.lastIndexOf(alternate)
  }

  if (alternateIndex < 0) {
    return selected
  }

  state.typeBag.splice(alternateIndex, 1)
  state.typeBag.push(selected)
  return alternate
}

/**
 * 从类型袋抽取本次障碍类型。
 * 连续同类型超过 MAX_TYPE_STREAK 时强制交替，降低体感单调性。
 */
export const drawHazardType = ({
  state,
  spikeRatio,
  random = Math.random,
}: {
  state: SpawnDirectorState
  spikeRatio: number
  random?: RandomFn
}): HazardType => {
  if (state.typeBag.length === 0) {
    state.typeBag = buildTypeBag(spikeRatio, random)
  }

  let selected = state.typeBag.pop() ?? 'spike'

  if (state.lastType === selected && state.typeRunLength >= MAX_TYPE_STREAK) {
    selected = forceAlternateType({
      state,
      selected,
      spikeRatio,
      random,
    })
  }

  updateTypeStreak(state, selected)
  return selected
}
