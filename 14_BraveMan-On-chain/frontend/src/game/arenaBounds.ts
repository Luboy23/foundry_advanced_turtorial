import rulesetData from '../lib/braveman-ruleset.generated.json'
import { clamp } from '../shared/utils/math'

export type ArenaRect = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export const bravemanRuleset = rulesetData.ruleset

const BATTLEFIELD_FRAME_INSET_X = 44
const BATTLEFIELD_FRAME_INSET_TOP = 82
const BATTLEFIELD_FRAME_INSET_BOTTOM = 26

/** 根据四条边界快速构建包含宽高和中心点的矩形描述。 */
const makeArenaRect = (left: number, right: number, top: number, bottom: number): ArenaRect => ({
  left,
  right,
  top,
  bottom,
  width: right - left,
  height: bottom - top,
  centerX: (left + right) * 0.5,
  centerY: (top + bottom) * 0.5,
})

export const battlefieldRect = makeArenaRect(
  BATTLEFIELD_FRAME_INSET_X,
  bravemanRuleset.arena_width - BATTLEFIELD_FRAME_INSET_X,
  BATTLEFIELD_FRAME_INSET_TOP,
  bravemanRuleset.arena_height - BATTLEFIELD_FRAME_INSET_BOTTOM,
)

export const stageLayoutMetrics = {
  battlefieldInsetX: BATTLEFIELD_FRAME_INSET_X,
  battlefieldInsetTop: BATTLEFIELD_FRAME_INSET_TOP,
  battlefieldInsetBottom: BATTLEFIELD_FRAME_INSET_BOTTOM,
  battlefieldLeftRatio: BATTLEFIELD_FRAME_INSET_X / bravemanRuleset.arena_width,
  battlefieldTopRatio: BATTLEFIELD_FRAME_INSET_TOP / bravemanRuleset.arena_height,
  battlefieldBottomRatio: BATTLEFIELD_FRAME_INSET_BOTTOM / bravemanRuleset.arena_height,
}

export const playerCombatRect = makeArenaRect(
  bravemanRuleset.player_bounds_inset_x,
  bravemanRuleset.arena_width - bravemanRuleset.player_bounds_inset_x,
  bravemanRuleset.player_bounds_inset_top,
  bravemanRuleset.arena_height - bravemanRuleset.player_bounds_inset_bottom,
)

export const enemyCombatRect = makeArenaRect(
  bravemanRuleset.enemy_bounds_inset_x,
  bravemanRuleset.arena_width - bravemanRuleset.enemy_bounds_inset_x,
  bravemanRuleset.enemy_bounds_inset_top,
  bravemanRuleset.arena_height - bravemanRuleset.enemy_bounds_inset_bottom,
)

/** 将任意点裁剪到给定矩形内，避免实体越界。 */
export const clampPointToRect = (x: number, y: number, rect: ArenaRect) => ({
  x: clamp(x, rect.left, rect.right),
  y: clamp(y, rect.top, rect.bottom),
})
