/**
 * 游戏实例工厂。
 * 负责创建 Phaser.Game、拼接场景，并向 React 暴露语义化 controller 接口。
 */
import Phaser from 'phaser'
import { TypedEventBus } from './events/TypedEventBus'
import { ENABLE_DEBUG_BRIDGE } from './debugBridge'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { OverlayBridgeScene } from './scenes/OverlayBridgeScene'
import type {
  DebugPlatformStateSnapshot,
  DebugPlayerStateSnapshot,
  DebugSetPlayerStatePayload,
  DebugSpawnTestPlatformPayload,
  GameCommandPayloads,
  GameEvents,
  InputMode,
} from './types'

export type DownManController = {
  // 这些命令是 React 控制 Phaser 的唯一公共入口。
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
  debugSetPlayerState: (payload: DebugSetPlayerStatePayload) => void
  debugSpawnTestPlatform: (payload: DebugSpawnTestPlatformPayload) => void
  debugClearTestPlatforms: () => void
  debugGetPlayerX: () => number
  debugGetPlayerY: () => number
  debugGetPlayerVelocityX: () => number
  debugGetPlayerVelocityY: () => number
  debugGetPlayerStateSnapshot: () => DebugPlayerStateSnapshot
  debugGetPlatformState: (platformId: number) => DebugPlatformStateSnapshot | null
  debugGetSpawnTelemetry: () => Array<{
    timestampMs: number
    lane: number
    x: number
    count: 1 | 2
  }>
}

// 所有跨场景命令都先经过事件总线，避免 React 直接依赖具体场景实例。
const emitCommand = <Key extends keyof GameCommandPayloads>(
  commandBus: TypedEventBus<GameCommandPayloads>,
  command: Key,
  payload: GameCommandPayloads[Key],
): void => {
  commandBus.emit(command, payload)
}

// 调试桥关闭时也返回稳定默认值，避免测试/页面代码额外判空。
const DEFAULT_DEBUG_PLAYER_STATE: DebugPlayerStateSnapshot = {
  x: 0,
  y: 0,
  bodyLeft: 0,
  bodyRight: 0,
  bodyWidth: 0,
  bodyHeight: 0,
  velocityX: 0,
  velocityY: 0,
  cameraScrollY: 0,
  blockedDown: false,
  touchingDown: false,
  grounded: false,
  currentGroundPlatformId: null,
  currentGroundSource: null,
  lastLandingEvent: null,
}

// React 只通过 controller 交互，不直接依赖具体场景实例。
export const createDownManGame = (mountNode: HTMLElement): DownManController => {
  // UI 总线与内部总线拆开，减少场景内部事件命名调整对 React 的直接影响。
  const uiBus = new TypedEventBus<GameEvents>()
  const internalBus = new TypedEventBus<GameEvents>()
  const commandBus = new TypedEventBus<GameCommandPayloads>()

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
        fps: 60,
        fixedStep: true,
        customUpdate: true,
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

  // 运行时只暴露 GameScene 的语义化查询，不把 Phaser.SceneManager 泄漏到页面层。
  const getGameScene = (): GameScene | null => {
    const scene = game.scene.getScene('game-scene')
    return scene instanceof GameScene ? scene : null
  }
  // 调试桥完全由环境开关控制，生产模式不允许页面直接碰调试接口。
  const getDebugGameScene = (): GameScene | null => (ENABLE_DEBUG_BRIDGE ? getGameScene() : null)
  const emitDebugCommand = <Key extends keyof GameCommandPayloads>(
    command: Key,
    payload: GameCommandPayloads[Key],
  ): void => {
    if (!ENABLE_DEBUG_BRIDGE) {
      return
    }
    emitCommand(commandBus, command, payload)
  }

  return {
    // 这些方法只是投递命令，不直接执行场景逻辑，因此调用时序更容易被测试控制。
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
      // 先断开所有事件再销毁 Phaser，可避免 destroy 过程中再触发旧订阅。
      uiBus.clear()
      internalBus.clear()
      commandBus.clear()
      game.destroy(true)
    },
    debugForceGameOver: () => emitDebugCommand('debugForceGameOver', undefined),
    debugSetElapsedMs: (elapsedMs) =>
      emitDebugCommand('debugSetElapsed', {
        elapsedMs,
      }),
    debugSetPlayerState: (payload) => emitDebugCommand('debugSetPlayerState', payload),
    debugSpawnTestPlatform: (payload) => emitDebugCommand('debugSpawnTestPlatform', payload),
    debugClearTestPlatforms: () => emitDebugCommand('debugClearTestPlatforms', undefined),
    debugGetPlayerX: () => getDebugGameScene()?.debugGetPlayerX() ?? 0,
    debugGetPlayerY: () => getDebugGameScene()?.debugGetPlayerY() ?? 0,
    debugGetPlayerVelocityX: () => getDebugGameScene()?.debugGetPlayerVelocityX() ?? 0,
    debugGetPlayerVelocityY: () => getDebugGameScene()?.debugGetPlayerVelocityY() ?? 0,
    debugGetPlayerStateSnapshot: () =>
      getDebugGameScene()?.debugGetPlayerStateSnapshot() ?? DEFAULT_DEBUG_PLAYER_STATE,
    debugGetPlatformState: (platformId) =>
      getDebugGameScene()?.debugGetPlatformState(platformId) ?? null,
    debugGetSpawnTelemetry: () => getDebugGameScene()?.debugGetSpawnTelemetry() ?? [],
  }
}
