// 资源键集合：统一管理角色/敌人逐帧贴图键，避免硬编码字符串散落。
export const HERO_SWORD_IDLE_FRAMES = ['hero-sword-idle-0', 'hero-sword-idle-1', 'hero-sword-idle-2'] as const
export const HERO_SWORD_MOVE_FRAMES = [
  'hero-sword-move-0',
  'hero-sword-move-1',
  'hero-sword-move-2',
  'hero-sword-move-3',
  'hero-sword-move-4',
  'hero-sword-move-5',
] as const
export const HERO_SWORD_ATTACK_FRAMES = [
  'hero-sword-attack-0',
  'hero-sword-attack-1',
  'hero-sword-attack-2',
  'hero-sword-attack-3',
  'hero-sword-attack-4',
] as const
export const HERO_HOOK_SPEAR_IDLE_FRAMES = [
  'hero-hook-spear-idle-0',
  'hero-hook-spear-idle-1',
  'hero-hook-spear-idle-2',
] as const
export const HERO_HOOK_SPEAR_MOVE_FRAMES = [
  'hero-hook-spear-move-0',
  'hero-hook-spear-move-1',
  'hero-hook-spear-move-2',
  'hero-hook-spear-move-3',
  'hero-hook-spear-move-4',
  'hero-hook-spear-move-5',
] as const
export const HERO_HOOK_SPEAR_ATTACK_FRAMES = [
  'hero-hook-spear-attack-0',
  'hero-hook-spear-attack-1',
  'hero-hook-spear-attack-2',
  'hero-hook-spear-attack-3',
  'hero-hook-spear-attack-4',
] as const
export const HERO_BOW_IDLE_FRAMES = ['hero-bow-idle-0', 'hero-bow-idle-1', 'hero-bow-idle-2'] as const
export const HERO_BOW_MOVE_FRAMES = [
  'hero-bow-move-0',
  'hero-bow-move-1',
  'hero-bow-move-2',
  'hero-bow-move-3',
  'hero-bow-move-4',
  'hero-bow-move-5',
] as const
export const HERO_BOW_ATTACK_FRAMES = [
  'hero-bow-attack-0',
  'hero-bow-attack-1',
  'hero-bow-attack-2',
  'hero-bow-attack-3',
  'hero-bow-attack-4',
] as const
export const HERO_DEATH_FRAMES = [
  'hero-death-0',
  'hero-death-1',
  'hero-death-2',
  'hero-death-3',
  'hero-death-4',
] as const
export const CHASER_MOVE_FRAMES = [
  'enemy-chaser-move-0',
  'enemy-chaser-move-1',
  'enemy-chaser-move-2',
  'enemy-chaser-move-3',
  'enemy-chaser-move-4',
  'enemy-chaser-move-5',
] as const
export const CHASER_DEATH_FRAMES = [
  'enemy-chaser-death-0',
  'enemy-chaser-death-1',
  'enemy-chaser-death-2',
  'enemy-chaser-death-3',
] as const
export const CHARGER_MOVE_FRAMES = [
  'enemy-charger-move-0',
  'enemy-charger-move-1',
  'enemy-charger-move-2',
  'enemy-charger-move-3',
  'enemy-charger-move-4',
  'enemy-charger-move-5',
] as const
export const CHARGER_TELL_FRAMES = [
  'enemy-charger-tell-0',
  'enemy-charger-tell-1',
  'enemy-charger-tell-2',
  'enemy-charger-tell-3',
] as const
export const CHARGER_CHARGE_FRAMES = [
  'enemy-charger-charge-0',
  'enemy-charger-charge-1',
  'enemy-charger-charge-2',
  'enemy-charger-charge-3',
] as const
export const CHARGER_DEATH_FRAMES = [
  'enemy-charger-death-0',
  'enemy-charger-death-1',
  'enemy-charger-death-2',
  'enemy-charger-death-3',
] as const
export const SWORD_SLASH_FRAMES = [
  'hero-sword-slash-0',
  'hero-sword-slash-1',
  'hero-sword-slash-2',
  'hero-sword-slash-3',
] as const
export const ARROW_TRAIL_FRAMES = ['arrow-trail-0', 'arrow-trail-1', 'arrow-trail-2'] as const

// 动画键：供 Phaser 动画状态机注册与切换。
export const HERO_ANIM = {
  sword_idle: 'hero-sword-idle',
  sword_move: 'hero-sword-move',
  sword_attack: 'hero-sword-attack',
  hook_spear_idle: 'hero-hook-spear-idle',
  hook_spear_move: 'hero-hook-spear-move',
  hook_spear_attack: 'hero-hook-spear-attack',
  hook_spear_sweep: 'hero-hook-spear-sweep',
  bow_idle: 'hero-bow-idle',
  bow_move: 'hero-bow-move',
  bow_attack: 'hero-bow-attack',
  death: 'hero-death',
  sword_slash: 'hero-sword-slash',
  arrow_trail: 'arrow-trail',
} as const

// 敌人动画键。
export const ENEMY_ANIM = {
  chaser_move: 'enemy-chaser-move',
  chaser_death: 'enemy-chaser-death',
  charger_move: 'enemy-charger-move',
  charger_tell: 'enemy-charger-tell',
  charger_charge: 'enemy-charger-charge',
  charger_death: 'enemy-charger-death',
} as const

// 各武器姿态默认贴图：用于创建精灵时的初始纹理。
export const HERO_TEXTURES = {
  sword_idle: HERO_SWORD_IDLE_FRAMES[0],
  sword_move: HERO_SWORD_MOVE_FRAMES[0],
  sword_attack: HERO_SWORD_ATTACK_FRAMES[0],
  hook_spear_idle: HERO_HOOK_SPEAR_IDLE_FRAMES[0],
  hook_spear_move: HERO_HOOK_SPEAR_MOVE_FRAMES[0],
  hook_spear_attack: HERO_HOOK_SPEAR_ATTACK_FRAMES[0],
  bow_idle: HERO_BOW_IDLE_FRAMES[0],
  bow_move: HERO_BOW_MOVE_FRAMES[0],
  bow_attack: HERO_BOW_ATTACK_FRAMES[0],
  death: HERO_DEATH_FRAMES[0],
} as const

// 箭矢投射物默认纹理键。
export const ARROW_TEXTURE = 'arrow-0'
