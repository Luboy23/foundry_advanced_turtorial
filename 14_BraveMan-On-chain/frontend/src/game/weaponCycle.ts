import type { WeaponType } from './types'

export const WEAPON_CYCLE_ORDER: readonly WeaponType[] = ['sword', 'hook_spear', 'bow'] as const

/** 根据霜翎逐月是否已解锁，返回当前局可切换的武器列表。 */
export const getAvailableWeapons = (bowAvailable: boolean): WeaponType[] =>
  bowAvailable ? [...WEAPON_CYCLE_ORDER] : WEAPON_CYCLE_ORDER.filter((weapon) => weapon !== 'bow')

/** 从当前武器出发，按循环顺序计算下一把可用武器。 */
export const getNextWeapon = (current: WeaponType, bowAvailable: boolean): WeaponType => {
  const available = getAvailableWeapons(bowAvailable)
  const currentIndex = available.indexOf(current)
  if (currentIndex === -1) return available[0]
  return available[(currentIndex + 1) % available.length]
}

/** 计算从 current 切到 target 需要触发多少次“循环切武器”。 */
export const countToggleStepsToWeapon = (
  current: WeaponType,
  target: WeaponType,
  bowAvailable: boolean,
): number => {
  const available = getAvailableWeapons(bowAvailable)
  const currentIndex = available.indexOf(current)
  const targetIndex = available.indexOf(target)
  if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return 0
  return (targetIndex - currentIndex + available.length) % available.length
}
