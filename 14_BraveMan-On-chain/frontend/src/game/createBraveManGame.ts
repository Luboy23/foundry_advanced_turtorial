import Phaser from 'phaser'
import { TypedEventBus } from './events/TypedEventBus'
import { ENABLE_DEBUG_BRIDGE } from './debugBridge'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import type { GameCommandPayloads, GameEvents, InputSource, SessionHandshake, WeaponType } from './types'

export type BraveManController = {
  destroy: () => void
  on: <TKey extends keyof GameEvents>(event: TKey, handler: (payload: GameEvents[TKey]) => void) => () => void
  startGame: (session: SessionHandshake) => void
  pauseGame: () => void
  resumeGame: () => void
  returnToIdle: () => void
  setMovement: (x: -1 | 0 | 1, y: -1 | 0 | 1, source: InputSource) => void
  setEquipmentModalOpen: (open: boolean) => void
  setBowAvailability: (available: boolean) => void
  toggleWeapon: () => void
  equipWeapon: (weapon: WeaponType) => void
  unlockBowAndEquip: () => void
  retreat: () => void
  forceGameOver: () => void
}

/**
 * 创建 BraveMan 游戏实例，并返回一组前端 UI 可调用的控制接口。
 * 该函数只负责场景装配和命令分发，不直接包含具体玩法规则。
 */
export const createBraveManGame = (mountNode: HTMLDivElement): BraveManController => {
  // internalBus: Phaser -> React 的上行事件通道（状态、快照、结算）。
  const internalBus = new TypedEventBus<GameEvents>()
  // commandBus: React -> Phaser 的下行命令通道（开始、暂停、切武器等）。
  const commandBus = new TypedEventBus<GameCommandPayloads>()

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: mountNode,
    backgroundColor: '#efebe2',
    scene: [new BootScene(), new GameScene({ internalBus, commandBus })],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })

  const controller: BraveManController = {
    /** 销毁游戏实例与事件总线，通常在 React 组件卸载时调用。 */
    destroy: () => {
      // 先清空总线再销毁 Phaser，避免销毁过程中遗留回调触发。
      internalBus.clear()
      commandBus.clear()
      game.destroy(true)
    },
    /** 订阅内部事件（如状态变化、倒计时、结算）。 */
    on: (event, handler) => internalBus.on(event, handler),
    /** 开始一局新游戏。 */
    // session 中包含 seed/ruleset 元数据，驱动本地模拟与后端重放对齐。
    startGame: (session) => commandBus.emit('startGame', { session }),
    /** 暂停当前游戏。 */
    pauseGame: () => commandBus.emit('pauseGame', undefined),
    /** 从暂停态恢复。 */
    resumeGame: () => commandBus.emit('resumeGame', undefined),
    /** 回到大厅待机态。 */
    returnToIdle: () => commandBus.emit('returnToIdle', undefined),
    /** 更新移动输入。 */
    setMovement: (x, y, source) => commandBus.emit('setMovement', { x, y, source }),
    /** 告知场景装备弹窗开关状态。 */
    setEquipmentModalOpen: (open) => commandBus.emit('setEquipmentModalOpen', { open }),
    /** 告知场景霜翎逐月是否可用。 */
    setBowAvailability: (available) => commandBus.emit('setBowAvailability', { available }),
    /** 循环切换武器。 */
    toggleWeapon: () => commandBus.emit('toggleWeapon', undefined),
    /** 切换到指定武器。 */
    equipWeapon: (weapon) => commandBus.emit('equipWeapon', { weapon }),
    /** 解锁并装备霜翎逐月。 */
    unlockBowAndEquip: () => commandBus.emit('unlockBowAndEquip', undefined),
    /** 主动撤离结束本局。 */
    retreat: () => commandBus.emit('retreat', undefined),
    /** 调试接口：强制结束当前局。 */
    forceGameOver: () => commandBus.emit('debugForceGameOver', undefined),
  }

  if (ENABLE_DEBUG_BRIDGE) {
    /** 将关键调试能力暴露到 window，便于 e2e 或手动调试。 */
    ;(window as Window & { __BRAVEMAN_DEBUG__?: unknown }).__BRAVEMAN_DEBUG__ = {
      forceGameOver: controller.forceGameOver,
      setTouchMove: (x: -1 | 0 | 1, y: -1 | 0 | 1) => controller.setMovement(x, y, 'touch'),
      toggleWeapon: controller.toggleWeapon,
      equipWeapon: controller.equipWeapon,
      retreat: controller.retreat,
      getSnapshot: () => (window as Window & { __BRAVEMAN_DEBUG_SNAPSHOT__?: unknown }).__BRAVEMAN_DEBUG_SNAPSHOT__,
    }
  }

  return controller
}
