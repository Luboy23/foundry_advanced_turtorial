/**
 * 平台运行时结构。
 * 用强类型 runtime data 保存平台状态，避免热路径频繁做弱类型读取。
 */
import type Phaser from 'phaser'

export type PlatformRuntimeType = 'stable' | 'moving' | 'vanishing'

// data 保存的是热路径里会频繁读写的字段，避免反复走 sprite.data 弱类型接口。
export type PlatformRuntimeData = {
  type: PlatformRuntimeType
  moveMinX: number
  moveMaxX: number
  moveSpeed: number
  moveDirection: -1 | 0 | 1
  vanishingHoldMs: number
  broken: boolean
  prevLeft: number
  prevRight: number
}

// entry 把 sprite、body、bucket 与业务数据绑定成一个稳定句柄，供 GameScene 复用。
export type PlatformRuntimeEntry = {
  index: number
  bucketId: number
  bucketSlot: number
  platformId: number
  platform: Phaser.Physics.Arcade.Sprite
  body: Phaser.Physics.Arcade.Body
  data: PlatformRuntimeData
}
