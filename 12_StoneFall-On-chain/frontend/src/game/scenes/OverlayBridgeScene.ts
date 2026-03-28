/**
 * 模块职责：提供 game/scenes/OverlayBridgeScene.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import Phaser from 'phaser'
import { TypedEventBus } from '../events/TypedEventBus'
import type { GameEvents } from '../types'

type OverlayBridgeSceneOptions = {
  internalBus: TypedEventBus<GameEvents>
  uiBus: TypedEventBus<GameEvents>
}

const FORWARDED_EVENTS: Array<keyof GameEvents> = [
  'onGameState',
  'onScoreTick',
  'onDifficultyTick',
  'onCountdown',
  'onPlayerHit',
  'onGameOver',
  'onSessionStats',
]

/**
 * 类实现：OverlayBridgeScene。
 */
export class OverlayBridgeScene extends Phaser.Scene {
  private readonly internalBus: TypedEventBus<GameEvents>
  private readonly uiBus: TypedEventBus<GameEvents>
  private unsubscribers: Array<() => void> = []

  constructor(options: OverlayBridgeSceneOptions) {
    super({ key: 'overlay-bridge-scene' })
    this.internalBus = options.internalBus
    this.uiBus = options.uiBus
  }

  create(): void {
    for (const eventName of FORWARDED_EVENTS) {
      const unsubscribe = this.internalBus.on(eventName, (payload) => {
        this.uiBus.emit(eventName, payload)
      })
      this.unsubscribers.push(unsubscribe)
    }

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this)
    this.events.on(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this)
  }

  private handleShutdown(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers = []
  }
}
