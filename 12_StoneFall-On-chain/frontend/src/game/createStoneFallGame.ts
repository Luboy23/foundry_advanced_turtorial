/**
 * 模块职责：封装 Phaser 实例创建，并对外暴露统一控制器接口。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import Phaser from 'phaser'
import { TypedEventBus } from './events/TypedEventBus'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { OverlayBridgeScene } from './scenes/OverlayBridgeScene'
import type { GameCommandPayloads, GameEvents, InputMode } from './types'

/**
 * 类型定义：StoneFallController。
 */
export type StoneFallController = {
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  restartGame: () => void
  returnToIdle: () => void
  setInputMode: (mode: InputMode, axis?: -1 | 0 | 1, targetX?: number) => void
  setAudioSettings: (musicEnabled: boolean, sfxEnabled: boolean) => void
  subscribe: <Key extends keyof GameEvents>(
    event: Key,
    listener: (payload: GameEvents[Key]) => void,
  ) => () => void
  destroy: () => void
  debugForceGameOver: () => void
  debugSetElapsedMs: (elapsedMs: number) => void
  debugGetPlayerX: () => number
  debugGetPlayerVelocityX: () => number
  debugGetSpawnTelemetry: () => Array<{
    timestampMs: number
    lane: number
    x: number
    count: 1 | 2
  }>
}

/**
 * 将控制层命令统一发送到命令总线。
 * 这里保留独立函数是为了避免在返回对象中重复写 emit 细节。
 */
const emitCommand = <Key extends keyof GameCommandPayloads>(
  commandBus: TypedEventBus<GameCommandPayloads>,
  command: Key,
  payload: GameCommandPayloads[Key],
): void => {
  commandBus.emit(command, payload)
}

/**
 * 创建 StoneFall 游戏实例并返回控制器。
 * @param mountNode Phaser 挂载容器
 * @returns 提供开始/暂停/重开/订阅等能力的控制器
 */
export const createStoneFallGame = (mountNode: HTMLElement): StoneFallController => {
  // 三层总线：
  // 1) commandBus: React -> Scene 命令
  // 2) internalBus: Scene 内部事件
  // 3) uiBus: 对 React 暴露的 UI 事件
  const uiBus = new TypedEventBus<GameEvents>()
  const internalBus = new TypedEventBus<GameEvents>()
  const commandBus = new TypedEventBus<GameCommandPayloads>()

  // Phaser 主实例。BootScene 负责贴图准备，GameScene 负责玩法，OverlayBridgeScene 负责桥接事件。
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: mountNode,
    width: 1280,
    height: 720,
    transparent: true,
    backgroundColor: '#f7f4ed',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0, x: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [
      new BootScene(),
      new GameScene({ internalBus, commandBus }),
      new OverlayBridgeScene({ internalBus, uiBus }),
    ],
  })

  // 调试接口需要直接访问 GameScene 实例，取不到时返回 null 保证调用安全。
  const getGameScene = (): GameScene | null => {
    const scene = game.scene.getScene('game-scene')
    return scene instanceof GameScene ? scene : null
  }

  return {
    startGame: () => emitCommand(commandBus, 'startGame', undefined),
    pauseGame: () => emitCommand(commandBus, 'pauseGame', undefined),
    resumeGame: () => emitCommand(commandBus, 'resumeGame', undefined),
    restartGame: () => emitCommand(commandBus, 'restartGame', undefined),
    returnToIdle: () => emitCommand(commandBus, 'returnToIdle', undefined),
    setInputMode: (mode, axis, targetX) =>
      emitCommand(commandBus, 'setInputMode', {
        mode,
        axis,
        targetX,
      }),
    setAudioSettings: (musicEnabled, sfxEnabled) =>
      emitCommand(commandBus, 'setAudioSettings', {
        musicEnabled,
        sfxEnabled,
      }),
    subscribe: (event, listener) => uiBus.on(event, listener),
    destroy: () => {
      uiBus.clear()
      internalBus.clear()
      commandBus.clear()
      game.destroy(true)
    },
    debugForceGameOver: () => emitCommand(commandBus, 'debugForceGameOver', undefined),
    debugSetElapsedMs: (elapsedMs) =>
      emitCommand(commandBus, 'debugSetElapsed', {
        elapsedMs,
      }),
    debugGetPlayerX: () => getGameScene()?.debugGetPlayerX() ?? 0,
    debugGetPlayerVelocityX: () => getGameScene()?.debugGetPlayerVelocityX() ?? 0,
    debugGetSpawnTelemetry: () => getGameScene()?.debugGetSpawnTelemetry() ?? [],
  }
}
