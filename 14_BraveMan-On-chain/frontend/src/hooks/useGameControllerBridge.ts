import { useCallback, useEffect, useRef } from 'react'

import type { SfxType } from '../features/audio/useGameAudio'
import type { BraveManController } from '../game/createBraveManGame'
import type {
  GameState,
  PlayerPose,
  SessionStats,
  SnapshotStats,
} from '../game/types'

type UseGameControllerBridgeOptions = {
  isEquipmentOpen: boolean
  bowAvailable: boolean
  playSfx: (name: SfxType) => void
  onGameOver: (stats: SessionStats) => void | Promise<void>
  setGameState: (state: GameState) => void
  setEngineReady: (ready: boolean) => void
  setCountdownValue: (value: number | null) => void
  setSnapshot: (snapshot: SnapshotStats) => void
  setSessionBowUnlocked: (value: boolean) => void
  setIsEquipmentOpen: (open: boolean) => void
}

/** 攻击音效节流窗口，避免多目标命中时一帧重复播太多次。 */
const ATTACK_SFX_THROTTLE_MS = 80
/** 会触发攻击音效的角色姿态集合。 */
const ATTACK_POSE_SET: ReadonlySet<PlayerPose> = new Set([
  'sword_attack',
  'hook_spear_attack',
  'bow_attack',
])

/** 判断某个姿态是否处于攻击阶段。 */
const isAttackPose = (pose: PlayerPose): boolean => ATTACK_POSE_SET.has(pose)

/**
 * 连接 React 状态层与 Phaser 控制器。
 * 该 Hook 负责把场景事件翻译成前端状态，并把装备弹窗/弓可用状态同步回场景。
 */
export const useGameControllerBridge = ({
  isEquipmentOpen,
  bowAvailable,
  playSfx,
  onGameOver,
  setGameState,
  setEngineReady,
  setCountdownValue,
  setSnapshot,
  setSessionBowUnlocked,
  setIsEquipmentOpen,
}: UseGameControllerBridgeOptions) => {
  const controllerRef = useRef<BraveManController | null>(null)
  /** 当前控制器上的事件解绑句柄集合；重绑或卸载时统一清理。 */
  const unsubscribeRef = useRef<Array<() => void>>([])

  /** 绑定新的 Phaser 控制器，并建立状态/音效/结算事件桥接。 */
  const bindController = useCallback((controller: BraveManController | null) => {
    // 先解绑旧控制器，避免重复订阅导致状态双写。
    unsubscribeRef.current.forEach((unsubscribe) => unsubscribe())
    unsubscribeRef.current = []
    controllerRef.current = controller
    setEngineReady(Boolean(controller))
    if (!controller) return

    // 控制器刚接入时，立即同步当前 UI 外部状态，避免首帧出现错位。
    controller.setEquipmentModalOpen(isEquipmentOpen)
    controller.setBowAvailability(bowAvailable)
    let previousState: GameState = 'idle'
    let previousPose: PlayerPose | null = null
    // 最近一次攻击音效时间戳，用于给连续攻击姿态做节流。
    let lastAttackSfxAtMs = 0

    unsubscribeRef.current = [
      controller.on('onGameState', ({ state }) => {
        // 倒计时 -> running 的瞬间播开始音效，其余状态切换只做状态同步。
        const cameFromCountdown = previousState === 'countdown'
        previousState = state
        setGameState(state)

        if (state === 'running' && cameFromCountdown) {
          playSfx('start')
        }
        if (state !== 'running') {
          previousPose = null
        }
        if (state === 'idle') {
          setSessionBowUnlocked(false)
        }
        if (state === 'countdown' || state === 'gameover') {
          setIsEquipmentOpen(false)
        }
        if (state !== 'countdown') {
          setCountdownValue(null)
        }
      }),
      controller.on('onCountdown', ({ value }) => {
        setCountdownValue(value)
        // 只在正数倒计时阶段播 tick 音效，避免 0 或清空时重复触发。
        if (value > 0) {
          playSfx('countdown')
        }
      }),
      controller.on('onSnapshot', (next) => {
        setSnapshot(next)
        // 只在“进入攻击姿态”的边界触发音效，避免同一姿态持续帧连播。
        const enteredAttackPose =
          isAttackPose(next.pose) && (previousPose === null || !isAttackPose(previousPose))
        if (enteredAttackPose) {
          const nowMs = Date.now()
          if (nowMs - lastAttackSfxAtMs >= ATTACK_SFX_THROTTLE_MS) {
            playSfx('attack')
            lastAttackSfxAtMs = nowMs
          }
        }
        previousPose = next.pose
      }),
      controller.on('onGameOver', ({ stats }) => {
        // 终局时先播死亡音效并收起装备弹窗，再把结算数据交给上层。
        playSfx('death')
        setIsEquipmentOpen(false)
        void onGameOver(stats)
      }),
    ]
  }, [
    bowAvailable,
    isEquipmentOpen,
    onGameOver,
    playSfx,
    setCountdownValue,
    setEngineReady,
    setGameState,
    setIsEquipmentOpen,
    setSessionBowUnlocked,
    setSnapshot,
  ])

  /** 组件卸载时解除全部控制器订阅，避免销毁后的回调落到旧状态。 */
  useEffect(() => () => unsubscribeRef.current.forEach((unsubscribe) => unsubscribe()), [])

  useEffect(() => {
    // 装备弹窗开关变化后，及时同步给场景快捷键屏蔽逻辑。
    controllerRef.current?.setEquipmentModalOpen(isEquipmentOpen)
  }, [isEquipmentOpen])

  useEffect(() => {
    // 链上购买或 session 解锁会改变弓可用性，这里持续同步给场景。
    controllerRef.current?.setBowAvailability(bowAvailable)
  }, [bowAvailable])

  return {
    controllerRef,
    bindController,
  }
}
