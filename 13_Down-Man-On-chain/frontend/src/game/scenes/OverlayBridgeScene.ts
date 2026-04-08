/**
 * Overlay 桥接场景。
 * 把内部事件总线转发给 UI 总线，让 React 可以订阅而不直接依赖 Phaser 对象。
 */
import Phaser from 'phaser'
import { TypedEventBus } from '../events/TypedEventBus'
import type { GameEvents } from '../types'

type OverlayBridgeSceneOptions = {
  // 内部总线由 GameScene 直接发出高频/低频事件。
  internalBus: TypedEventBus<GameEvents>
  // UI 总线只暴露给 React，避免页面层直接持有 Phaser 场景引用。
  uiBus: TypedEventBus<GameEvents>
}

// 这里只转发真正需要跨层同步的 UI 事件，避免把内部调试事件也抛给 React。
const FORWARDED_EVENTS: Array<keyof GameEvents> = [
  'onGameState',
  'onScoreTick',
  'onCountdown',
  'onPlayerHit',
  'onGameOver',
  'onSessionStats',
]

export class OverlayBridgeScene extends Phaser.Scene {
  private readonly internalBus: TypedEventBus<GameEvents>
  private readonly uiBus: TypedEventBus<GameEvents>
  private unsubscribers: Array<() => void> = []

  constructor(options: OverlayBridgeSceneOptions) {
    super({ key: 'overlay-bridge-scene' })
    this.internalBus = options.internalBus
    this.uiBus = options.uiBus
  }

  // 场景本身不渲染任何内容，只负责在生命周期内建立与拆除事件桥。
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

  // Phaser 场景重启、销毁时都要清理转发订阅，避免重复订阅把同一事件发多次。
  private handleShutdown(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers = []
  }
}
