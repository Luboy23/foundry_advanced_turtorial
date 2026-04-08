/**
 * React 应用壳。
 * 负责钱包连接、链上查询、游戏控制器绑定、结算弹窗与成绩提交流程。
 * Phaser 的实时模拟仍在场景内执行，这里只处理低频 UI 和副作用。
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { createWalletClient, http, publicActions, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

import type { DownManController } from './game/createDownManGame'
import type {
  DebugPlatformStateSnapshot,
  DebugPlayerStateSnapshot,
  DebugSetPlayerStatePayload,
  DebugSpawnTestPlatformPayload,
  GameState,
  InputSource,
  SessionStats,
} from './game/types'
import { ENABLE_DEBUG_BRIDGE } from './game/debugBridge'
import { GameCanvas } from './features/game/GameCanvas'
import { GameControls, TouchControls } from './features/ui/GameControls'
import { LiveGameHud } from './features/ui/LiveGameHud'
import { WalletPanel } from './features/ui/WalletPanel'
import {
  buttonSecondaryClass,
  buttonSizeXsClass,
} from './features/ui/buttonStyles'
import { useGameAudio } from './features/audio/useGameAudio'
import { loadSettings, saveSettings, purgeLegacyLeaderboardData } from './shared/storage/localStore'
import type { SettingsModel } from './shared/storage/types'
import { defaultSettings } from './shared/storage/types'
import { useViewport } from './shared/utils/useViewport'
import {
  DOWNMAN_ABI,
  DOWNMAN_ADDRESS,
  DOWNMAN_ADDRESS_VALID,
} from './lib/contract'
import { DOWNMAN_CHAIN_ID, DOWNMAN_RPC_URL } from './lib/chain'
import {
  SUBMIT_PENDING_RECHECK_MS,
  SUBMIT_PENDING_WATCHDOG_MS,
  type SubmitStage,
  resolveSubmitStatusText,
} from './lib/submissionState'
import { formatTxError } from './lib/txError'

const LeaderboardModalEntry = lazy(() => import('./features/ui/modals/LeaderboardModalEntry'))
const HistoryModalEntry = lazy(() => import('./features/ui/modals/HistoryModalEntry'))
const SettingsModal = lazy(() => import('./features/ui/modals/SettingsModal'))
const GameOverModal = lazy(() => import('./features/ui/modals/GameOverModal'))

// 调试桥只在开发/测试模式下注入到 window，生产环境不暴露这组入口。
type DebugWindow = Window & {
  __DOWNMAN_DEBUG__?: {
    forceGameOver: () => void
    setElapsedMs: (elapsedMs: number) => void
    setPlayerState: (payload: DebugSetPlayerStatePayload) => void
    spawnTestPlatform: (payload: DebugSpawnTestPlatformPayload) => void
    clearTestPlatforms: () => void
    getPlayerX: () => number
    getPlayerY: () => number
    getPlayerVelocityX: () => number
    getPlayerVelocityY: () => number
    getPlayerStateSnapshot: () => DebugPlayerStateSnapshot
    getPlatformState: (platformId: number) => DebugPlatformStateSnapshot | null
    getSpawnTelemetry: () => Array<{
      timestampMs: number
      lane: number
      x: number
      count: 1 | 2
    }>
  }
}

// 结算后待提交流程只关心一局统计与输入来源，不把整套 UI 状态绑进去。
type PendingSubmission = {
  id: number
  stats: SessionStats
  inputType: InputSource
}

// 链上失效粒度按目标拆分，避免一次事件把所有 query 全部打掉。
type DownmanQueryTarget = 'leaderboard' | 'best-score' | 'history-count' | 'history'

const TOUCH_FOLLOW_WORLD_WIDTH = 1280
const E2E_BYPASS_WALLET = import.meta.env.VITE_E2E_BYPASS_WALLET === 'true'
const E2E_TEST_PRIVATE_KEY = import.meta.env.VITE_E2E_TEST_PRIVATE_KEY as
  | Hex
  | undefined

// 仅用于 UI 展示，避免在界面里暴露完整地址或交易哈希。
const shortAddress = (address?: string) => {
  if (!address) {
    return '--'
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Footer GitHub 品牌图标：使用实心版本并继承链接文本色。
const FooterGitHubIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    data-testid="footer-github-icon"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.24.78-.54 0-.27-.01-.98-.02-1.92-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.07 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.6.24 2.78.12 3.07.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.67.41.35.78 1.04.78 2.1 0 1.52-.02 2.74-.02 3.11 0 .3.2.65.79.54A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      fill="currentColor"
    />
  </svg>
)

// 触控跟随条使用 0-1 比例描述，再统一映射到 Phaser 世界坐标。
const resolveTouchFollowTargetX = (ratio: number): number => {
  const normalizedRatio = Math.max(0, Math.min(1, ratio))
  return Math.round(normalizedRatio * TOUCH_FOLLOW_WORLD_WIDTH)
}

// 输入类元素应保留原生空格输入行为，避免快捷键误触发暂停。
const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  return target.isContentEditable
}

function App() {
  // 控制器引用与提交流程的瞬态状态放在 ref 中，避免频繁重渲染时丢失上下文。
  const controllerRef = useRef<DownManController | null>(null)
  const unsubscribeRef = useRef<Array<() => void>>([])
  const submissionIdRef = useRef(0)
  const receiptProbeInFlightRef = useRef(false)

  // App 只维护低频 UI 状态；实时分数改由 LiveGameHud 独立订阅。
  const [gameState, setGameState] = useState<GameState>('idle')
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [hudController, setHudController] = useState<DownManController | null>(null)
  const [hudBindingId, setHudBindingId] = useState(0)
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)

  const [settings, setSettings] = useState<SettingsModel>(() =>
    typeof window === 'undefined' ? defaultSettings : loadSettings(),
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [dismissGameOverModal, setDismissGameOverModal] = useState(false)

  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null)
  const [submitStage, setSubmitStage] = useState<SubmitStage>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  // 设备态会影响画布尺寸、横竖屏提示与移动端控制区显示。
  const viewport = useViewport()
  const isMobileViewport = viewport.width < 768
  const isPortrait = viewport.height > viewport.width
  const queryClient = useQueryClient()

  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, isPending: isWritePending } = useWriteContract()
  const publicClient = usePublicClient({ chainId: DOWNMAN_CHAIN_ID })

  // 常规钱包模式与 E2E 绕过模式都收敛为同一组 effective* 变量，减少分支扩散。
  const injectedConnector = useMemo(() => connectors[0], [connectors])
  const testWalletAccount = useMemo(() => {
    if (!E2E_BYPASS_WALLET || !E2E_TEST_PRIVATE_KEY) {
      return null
    }
    try {
      return privateKeyToAccount(E2E_TEST_PRIVATE_KEY)
    } catch {
      return null
    }
  }, [])
  const testWalletClient = useMemo(() => {
    if (!testWalletAccount) {
      return null
    }
    const localChain = {
      ...anvil,
      id: DOWNMAN_CHAIN_ID,
      name: 'Anvil',
      rpcUrls: {
        default: { http: [DOWNMAN_RPC_URL] },
        public: { http: [DOWNMAN_RPC_URL] },
      },
    }
    return createWalletClient({
      account: testWalletAccount,
      chain: localChain,
      transport: http(DOWNMAN_RPC_URL),
    }).extend(publicActions)
  }, [testWalletAccount])
  // 页面其他逻辑只依赖 effective*，不用关心当前到底是真钱包还是测试私钥模式。
  const effectiveAddress = E2E_BYPASS_WALLET ? testWalletAccount?.address : address
  const effectiveConnected = E2E_BYPASS_WALLET ? Boolean(testWalletAccount) : isConnected
  const effectiveChainId = E2E_BYPASS_WALLET ? DOWNMAN_CHAIN_ID : chainId

  const {
    activateAudio,
    playSfx,
    setBgmRunning,
  } = useGameAudio(
    settings.musicEnabled,
    settings.sfxEnabled,
  )

  // 启动时清空旧版本地榜单，避免链上时代继续展示过期的离线成绩。
  useEffect(() => {
    purgeLegacyLeaderboardData()
  }, [])

  useEffect(() => {
    saveSettings(settings)
    controllerRef.current?.setAudioSettings(settings.musicEnabled, settings.sfxEnabled)
  }, [settings])

  useEffect(() => {
    setBgmRunning(gameState === 'running')
  }, [gameState, setBgmRunning])

  // best score 常驻给 HUD 使用；排行榜/历史只在弹窗打开时才发起读取。
  const hasContractAddress = DOWNMAN_ADDRESS_VALID && !!DOWNMAN_ADDRESS
  const isCorrectChain = effectiveChainId === DOWNMAN_CHAIN_ID
  // query key 统一带上地址，避免切钱包后读到上一位用户缓存。
  const leaderboardQueryKey = useMemo(
    () => ['downman', 'leaderboard', DOWNMAN_ADDRESS] as const,
    [],
  )
  const bestScoreQueryKey = useMemo(
    () => ['downman', 'best-score', DOWNMAN_ADDRESS, effectiveAddress] as const,
    [effectiveAddress],
  )
  const historyCountQueryKey = useMemo(
    () => ['downman', 'history-count', DOWNMAN_ADDRESS, effectiveAddress] as const,
    [effectiveAddress],
  )
  const historyQueryKey = useMemo(
    () => ['downman', 'history', DOWNMAN_ADDRESS, effectiveAddress] as const,
    [effectiveAddress],
  )
  // 开始按钮和阻塞提示复用同一组前置条件判断。
  const startBlockedReason = useMemo(() => {
    if (!hasContractAddress) {
      return '合约地址未配置，请先执行 make deploy'
    }
    if (E2E_BYPASS_WALLET && !testWalletAccount) {
      return 'E2E 测试钱包未配置，请设置 VITE_E2E_TEST_PRIVATE_KEY'
    }
    if (!effectiveConnected) {
      return '请先连接钱包后开始'
    }
    if (!isCorrectChain) {
      return `请切换到 Anvil (${DOWNMAN_CHAIN_ID})`
    }
    return null
  }, [effectiveConnected, hasContractAddress, isCorrectChain, testWalletAccount])

  const disconnectLocked = effectiveConnected && gameState !== 'idle'
  const disconnectLockReason = disconnectLocked
    ? '对局进行中，暂不可断开钱包连接'
    : undefined

  // 链上查询统一走 React Query，并禁用窗口聚焦自动刷新来控制 RPC 压力。
  // HUD 只需要个人 best score，因此它是唯一常驻读取的链上查询。
  const bestScoreQuery = useQuery({
    queryKey: bestScoreQueryKey,
    enabled: hasContractAddress && !!publicClient && !!effectiveAddress,
    queryFn: async () => {
      const value = (await publicClient!.readContract({
        address: DOWNMAN_ADDRESS!,
        abi: DOWNMAN_ABI,
        functionName: 'bestScoreOf',
        args: [effectiveAddress!],
      })) as number | bigint

      return Number(value)
    },
    staleTime: 15000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
  })

  // 钱包未连接时 HUD 不展示历史缓存的旧最佳，避免造成“似乎已连上链”的错觉。
  const chainBestScore = useMemo(() => {
    if (!effectiveConnected) {
      return 0
    }
    return bestScoreQuery.data ?? 0
  }, [bestScoreQuery.data, effectiveConnected])

  // 事件回调和主动轮询都可能触发失效，这里统一做节流，避免短时间内重复打 RPC。
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === 'undefined') {
      return true
    }
    return document.visibilityState === 'visible'
  })
  const lastInvalidateAtRef = useRef<Record<DownmanQueryTarget, number>>({
    leaderboard: 0,
    'best-score': 0,
    'history-count': 0,
    history: 0,
  })
  const lastEventAtRef = useRef(0)
  const invalidateOnchainQueries = useCallback(
    (
      targets: DownmanQueryTarget[],
      force = false,
    ) => {
      const now = Date.now()
      const targetQueryKeys: Record<DownmanQueryTarget, readonly unknown[]> = {
        leaderboard: leaderboardQueryKey,
        'best-score': bestScoreQueryKey,
        'history-count': historyCountQueryKey,
        history: historyQueryKey,
      }

      for (const target of targets) {
        if (!force && now - lastInvalidateAtRef.current[target] < 1200) {
          continue
        }

        lastInvalidateAtRef.current[target] = now
        // 只失效受影响的 key，把排行榜、个人历史、best score 的刷新边界彻底分开。
        void queryClient.invalidateQueries({ queryKey: targetQueryKeys[target] })
      }
    },
    [
      bestScoreQueryKey,
      historyCountQueryKey,
      historyQueryKey,
      leaderboardQueryKey,
      queryClient,
    ],
  )

  // 同步页面可见性，后续轮询逻辑会根据它决定是否继续刷新链上数据。
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!hasContractAddress || !publicClient) {
      return
    }

    // 合约事件负责“被动同步”真实链上结果，优先级高于定时轮询。
    const unwatch = publicClient.watchContractEvent({
      address: DOWNMAN_ADDRESS!,
      abi: DOWNMAN_ABI,
      eventName: 'ScoreSubmitted',
      onLogs: (logs) => {
        lastEventAtRef.current = Date.now()
        const typedLogs = logs as Array<{
          args?: {
            player?: `0x${string}`
          }
        }>

        const shouldInvalidatePersonalQueries = Boolean(
          effectiveAddress &&
          typedLogs.some((log) => {
            const player = log.args?.player
            return player?.toLowerCase() === effectiveAddress.toLowerCase()
          }),
        )

        invalidateOnchainQueries(['leaderboard'], true)
        if (shouldInvalidatePersonalQueries) {
          invalidateOnchainQueries(['best-score', 'history-count', 'history'], true)
        }
      },
    })

    return () => {
      unwatch()
    }
  }, [effectiveAddress, hasContractAddress, invalidateOnchainQueries, publicClient])

  // 标签页不可见时暂停轮询，只在用户真正打开排行榜/历史弹窗时维持刷新。
  useEffect(() => {
    if (!hasContractAddress || !isPageVisible || (!isLeaderboardOpen && !isHistoryOpen)) {
      return
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastEventAtRef.current <= 30_000) {
        return
      }

      if (isLeaderboardOpen) {
        invalidateOnchainQueries(['leaderboard'])
      }
      if (isHistoryOpen) {
        invalidateOnchainQueries(['history-count', 'history'])
      }
    }, 30_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [
    hasContractAddress,
    invalidateOnchainQueries,
    isHistoryOpen,
    isLeaderboardOpen,
    isPageVisible,
  ])

  // Controller 是 React 与 Phaser 的桥。绑定时只接低频事件，并按需暴露调试接口。
  const teardownSubscriptions = useCallback(() => {
    for (const unsubscribe of unsubscribeRef.current) {
      unsubscribe()
    }
    unsubscribeRef.current = []
  }, [])

  const bindController = useCallback(
    (controller: DownManController | null) => {
      teardownSubscriptions()
      controllerRef.current = controller
      setHudController(controller)
      setHudBindingId((current) => current + 1)

      if (!controller) {
        return
      }

      controller.setAudioSettings(settings.musicEnabled, settings.sfxEnabled)
      controller.setInputMode('auto')
      let previousState: GameState = 'idle'

      // 高频 HUD 已下放给 LiveGameHud，这里只绑定会驱动弹窗/流程切换的低频事件。
      unsubscribeRef.current = [
        controller.subscribe('onGameState', ({ state }) => {
          const cameFromCountdown = previousState === 'countdown'
          previousState = state

          setGameState(state)
          if (state !== 'countdown') {
            setCountdownValue(null)
          }
          if (state === 'running' && cameFromCountdown) {
            playSfx('start')
          }
          if (state !== 'gameover') {
            setDismissGameOverModal(false)
            setPendingSubmission(null)
            setSubmitStage('idle')
            setSubmitError(null)
            setTxHash(null)
          }
        }),
        controller.subscribe('onPlayerHit', () => {
          playSfx('collision')
        }),
        controller.subscribe('onCountdown', ({ value }) => {
          setCountdownValue(value)
          if (value > 0) {
            playSfx('countdown')
          }
        }),
        controller.subscribe('onSessionStats', (stats) => {
          setSessionStats(stats)
        }),
        controller.subscribe('onGameOver', ({ stats, inputType }) => {
          setSessionStats(stats)
          // 每次结算都分配新的 submission id，避免异步回执串到旧局。
          submissionIdRef.current += 1
          setPendingSubmission({
            id: submissionIdRef.current,
            stats,
            inputType,
          })
          setSubmitStage('idle')
          setSubmitError(null)
          setTxHash(null)
        }),
      ]

      if (ENABLE_DEBUG_BRIDGE) {
        ;(window as DebugWindow).__DOWNMAN_DEBUG__ = {
          forceGameOver: () => {
            controller.debugForceGameOver()
          },
          setElapsedMs: (elapsedMs: number) => {
            controller.debugSetElapsedMs(elapsedMs)
          },
          setPlayerState: (payload) => {
            controller.debugSetPlayerState(payload)
          },
          spawnTestPlatform: (payload) => {
            controller.debugSpawnTestPlatform(payload)
          },
          clearTestPlatforms: () => {
            controller.debugClearTestPlatforms()
          },
          getPlayerX: () => controller.debugGetPlayerX(),
          getPlayerY: () => controller.debugGetPlayerY(),
          getPlayerVelocityX: () => controller.debugGetPlayerVelocityX(),
          getPlayerVelocityY: () => controller.debugGetPlayerVelocityY(),
          getPlayerStateSnapshot: () => controller.debugGetPlayerStateSnapshot(),
          getPlatformState: (platformId) => controller.debugGetPlatformState(platformId),
          getSpawnTelemetry: () => controller.debugGetSpawnTelemetry(),
        }
      } else {
        ;(window as DebugWindow).__DOWNMAN_DEBUG__ = undefined
      }
    },
    [
      playSfx,
      settings.musicEnabled,
      settings.sfxEnabled,
      teardownSubscriptions,
    ],
  )

  useEffect(() => {
    return () => {
      teardownSubscriptions()
      ;(window as DebugWindow).__DOWNMAN_DEBUG__ = undefined
    }
  }, [teardownSubscriptions])

  // 成功后刷新相关链上查询，并驱动结算弹窗解锁。
  const commitSubmitSuccess = useCallback(() => {
    setSubmitStage('success')
    setSubmitError(null)
    lastEventAtRef.current = Date.now()
    invalidateOnchainQueries(
      ['leaderboard', 'best-score', 'history-count', 'history'],
      true,
    )
  }, [invalidateOnchainQueries])

  // 所有失败都归并为 retriable_error，保持“成功上链前不能放行结算”。
  const commitSubmitFailure = useCallback((message: string) => {
    setSubmitStage('retriable_error')
    setSubmitError(message)
    setTxHash(null)
  }, [])

  // watchdog 之外再主动探测一次 receipt，解决钱包/节点偶发漏推送的问题。
  const probePendingReceipt = useCallback(async (hash: `0x${string}`): Promise<boolean> => {
    if (!publicClient || receiptProbeInFlightRef.current) {
      return false
    }

    receiptProbeInFlightRef.current = true
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash })
      if (receipt.status === 'success') {
        commitSubmitSuccess()
        return true
      }
      commitSubmitFailure('交易执行失败，请重试')
      return false
    } catch {
      return false
    } finally {
      receiptProbeInFlightRef.current = false
    }
  }, [commitSubmitFailure, commitSubmitSuccess, publicClient])

  // 真正的上链提交入口：校验环境、准备参数、写入交易并把状态机切到 pending。
  const submitScoreOnchain = useCallback(async () => {
    if (!pendingSubmission) {
      return
    }
    if (submitStage === 'signing' || submitStage === 'pending') {
      return
    }

    const score = Math.max(0, Math.floor(pendingSubmission.stats.score))
    if (score === 0) {
      // 合约不接受 0 分，本局按产品策略跳过链上提交并直接放行结算。
      setSubmitStage('zero_score_skipped')
      setSubmitError('零分局已跳过链上提交，不计入链上成绩')
      setTxHash(null)
      return
    }

    if (!hasContractAddress || !DOWNMAN_ADDRESS) {
      commitSubmitFailure('合约地址未配置，请先执行 make deploy')
      return
    }

    if (!effectiveConnected || !effectiveAddress) {
      commitSubmitFailure('钱包已断开，请重新连接后重试')
      return
    }

    if (!isCorrectChain) {
      commitSubmitFailure(`请切换到 Anvil (${DOWNMAN_CHAIN_ID})`)
      return
    }

    // 普通钱包要先经历 signing，E2E 绕过模式则直接视为已发出交易。
    setSubmitStage(E2E_BYPASS_WALLET ? 'pending' : 'signing')
    setSubmitError(null)

    try {
      const args = [
        score,
        Math.max(0, Math.floor(pendingSubmission.stats.survivalMs)),
        Math.max(0, Math.floor(pendingSubmission.stats.totalLandings)),
      ] as const
      // 合约仍沿用 totalDodged 字段名，前端只在提交边界上映射 totalLandings。
      let hash: `0x${string}`

      if (E2E_BYPASS_WALLET) {
        if (!testWalletClient || !testWalletAccount) {
          throw new Error('测试钱包不可用，请检查 VITE_E2E_TEST_PRIVATE_KEY')
        }
        hash = await testWalletClient.writeContract({
          address: DOWNMAN_ADDRESS,
          abi: DOWNMAN_ABI,
          functionName: 'submitScore',
          args,
          account: testWalletAccount,
        })
      } else {
        hash = await writeContractAsync({
          address: DOWNMAN_ADDRESS,
          abi: DOWNMAN_ABI,
          functionName: 'submitScore',
          args,
        })
      }
      setTxHash(hash)
      setSubmitStage('pending')
    } catch (error) {
      const message = formatTxError(error)
      commitSubmitFailure(message)
    }
  }, [
    commitSubmitFailure,
    effectiveAddress,
    effectiveConnected,
    hasContractAddress,
    isCorrectChain,
    pendingSubmission,
    submitStage,
    testWalletAccount,
    testWalletClient,
    writeContractAsync,
  ])

  // 结算产生后自动异步发起一次提交，避免在事件回调里直接串行做链上写入。
  useEffect(() => {
    if (!pendingSubmission) {
      return
    }
    if (submitStage !== 'idle') {
      return
    }

    const timer = window.setTimeout(() => {
      void submitScoreOnchain()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [pendingSubmission, submitScoreOnchain, submitStage])

  // 常规 receipt 监听与主动 watchdog 并存，优先保证用户不会永远卡在 pending。
  const receiptState = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: {
      enabled: Boolean(txHash && submitStage === 'pending'),
    },
  })

  useEffect(() => {
    if (submitStage !== 'pending' || !txHash) {
      return
    }

    if (receiptState.isSuccess) {
      commitSubmitSuccess()
      return
    }

    if (receiptState.isError) {
      commitSubmitFailure('交易回滚或确认失败，请重试')
    }
  }, [
    commitSubmitFailure,
    commitSubmitSuccess,
    receiptState.isError,
    receiptState.isSuccess,
    submitStage,
    txHash,
  ])

  useEffect(() => {
    receiptProbeInFlightRef.current = false
    if (submitStage !== 'pending' || !txHash || !publicClient) {
      return
    }

    // 定时复查与最终 watchdog 双重兜底，防止 receipt 订阅偶发失效。
    let cancelled = false
    const intervalId = window.setInterval(() => {
      if (cancelled) {
        return
      }
      void probePendingReceipt(txHash)
    }, SUBMIT_PENDING_RECHECK_MS)

    const watchdogId = window.setTimeout(() => {
      void (async () => {
        if (cancelled) {
          return
        }
        const resolved = await probePendingReceipt(txHash)
        if (resolved || cancelled) {
          return
        }
        commitSubmitFailure('链上确认超时，自动重查回执未成功，请重试上链')
      })()
    }, SUBMIT_PENDING_WATCHDOG_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.clearTimeout(watchdogId)
    }
  }, [
    commitSubmitFailure,
    probePendingReceipt,
    publicClient,
    submitStage,
    txHash,
  ])

  // 布局以 16:9 画布为中心反推整卡尺寸，同时为控制区和底部信息预留固定高度。
  const layoutMetrics = useMemo(() => {
    const horizontalGutter = viewport.width < 640 ? 24 : 56
    const maxCardWidth = Math.max(320, Math.min(viewport.width - horizontalGutter, 1180))
    const fixedUiHeight = viewport.width < 768
      ? (isPortrait ? 454 : 420)
      : 332
    const maxCanvasHeightByWidth = Math.floor((maxCardWidth * 9) / 16)
    const availableCanvasHeight = Math.max(220, viewport.height - fixedUiHeight)
    const targetCanvasHeight = Math.max(
      220,
      Math.min(maxCanvasHeightByWidth, availableCanvasHeight, 760),
    )
    const cardWidth = Math.min(maxCardWidth, Math.floor((targetCanvasHeight * 16) / 9))
    const canvasHeight = Math.floor((cardWidth * 9) / 16)

    return {
      cardWidth,
      canvasHeight,
    }
  }, [isPortrait, viewport.height, viewport.width])

  // 交互回调只做三件事：激活音频、播放按钮音效、再把命令交给控制器。
  const connectWallet = useCallback(() => {
    if (E2E_BYPASS_WALLET) {
      return
    }
    if (!injectedConnector) {
      return
    }
    connect({ connector: injectedConnector })
  }, [connect, injectedConnector])

  const handleToggleConnect = useCallback(() => {
    playSfx('button')
    if (E2E_BYPASS_WALLET) {
      return
    }
    if (effectiveConnected) {
      if (disconnectLocked) {
        return
      }
      disconnect()
      return
    }
    connectWallet()
  }, [connectWallet, disconnect, disconnectLocked, effectiveConnected, playSfx])

  const handleStart = useCallback(() => {
    activateAudio()
    if (startBlockedReason) {
      if (!effectiveConnected) {
        connectWallet()
      }
      return
    }

    playSfx('button')
    controllerRef.current?.startGame()
  }, [activateAudio, connectWallet, effectiveConnected, playSfx, startBlockedReason])

  const handlePause = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.pauseGame()
  }, [activateAudio, playSfx])

  const handleResume = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.resumeGame()
  }, [activateAudio, playSfx])

  // 空格快捷键：仅在 running/paused 之间切换暂停与继续。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSpace = event.code === 'Space' || event.key === ' '
      if (!isSpace || event.repeat) {
        return
      }

      if (isEditableKeyboardTarget(event.target)) {
        return
      }

      if (gameState === 'running') {
        event.preventDefault()
        handlePause()
        return
      }

      if (gameState === 'paused') {
        event.preventDefault()
        handleResume()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gameState, handlePause, handleResume])

  const handleRestart = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.restartGame()
  }, [activateAudio, playSfx])

  const handleTouchAxis = useCallback((axis: -1 | 0 | 1) => {
    activateAudio()
    controllerRef.current?.setInputMode('touch', axis, undefined)
  }, [activateAudio])

  // 移动端 follow 模式始终使用 0-1 比例映射到世界坐标，React 不直接持有 Phaser 尺寸。
  const handleTouchFollowStart = useCallback((ratio: number) => {
    activateAudio()
    const controller = controllerRef.current
    if (!controller) {
      return
    }
    const targetX = resolveTouchFollowTargetX(ratio)
    controller.setInputMode('touch', undefined, targetX)
  }, [activateAudio])

  const handleTouchFollowMove = useCallback((ratio: number) => {
    const controller = controllerRef.current
    if (!controller) {
      return
    }
    const targetX = resolveTouchFollowTargetX(ratio)
    controller.setInputMode('touch', undefined, targetX)
  }, [])

  const handleTouchFollowEnd = useCallback(() => {
    controllerRef.current?.setInputMode('touch', 0, undefined)
  }, [])

  // 切换移动端操控模式时先清空上一种模式残留的 touch 输入。
  useEffect(() => {
    controllerRef.current?.setInputMode('touch', 0, undefined)
  }, [settings.touchControlMode])

  const handleOpenSettings = useCallback(() => {
    playSfx('button')
    setIsSettingsOpen(true)
  }, [playSfx])

  const handleOpenLeaderboard = useCallback(() => {
    playSfx('button')
    setIsLeaderboardOpen(true)
  }, [playSfx])

  const handleOpenHistory = useCallback(() => {
    playSfx('button')
    setIsHistoryOpen(true)
  }, [playSfx])

  const handleCloseGameOver = useCallback(() => {
    const canExitGameOver = submitStage === 'success' || submitStage === 'zero_score_skipped'
    if (!canExitGameOver) {
      return
    }
    playSfx('button')
    setDismissGameOverModal(true)
    controllerRef.current?.returnToIdle()
  }, [playSfx, submitStage])

  // 叠层提示只表达全局状态，不直接参与游戏规则。
  const overlayText =
    gameState === 'idle'
      ? '连接钱包并点击开始，进入无尽的落下挑战'
      : gameState === 'paused'
        ? '已暂停'
        : null

  const submitStatusText = resolveSubmitStatusText(submitStage)

  const canExitGameOver = submitStage === 'success' || submitStage === 'zero_score_skipped'
  const isGameOverActionsLocked = !canExitGameOver

  return (
    <div className="h-dvh overflow-hidden bg-gradient-to-br from-[var(--paper-50)] via-[var(--paper-100)] to-[var(--paper-200)] px-3 py-2 text-[var(--ink-900)] sm:px-4 sm:py-3">
      {/* 钱包角标固定悬浮在页面右上，避免主布局挤压游戏画布。 */}
      <WalletPanel
        isConnected={effectiveConnected}
        isCorrectChain={isCorrectChain}
        chainId={effectiveChainId}
        displayAddress={shortAddress(effectiveAddress)}
        isConnecting={isConnecting}
        bypassMode={E2E_BYPASS_WALLET}
        disconnectLocked={disconnectLocked}
        disconnectLockReason={disconnectLockReason}
        onToggleConnect={handleToggleConnect}
      />

      <div className="mx-auto grid h-full w-full max-w-[1280px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 sm:gap-3">
        <header className="text-center">
          {/* 中文标题已切到主视觉，英文名保留在副标题便于链上项目识别。 */}
          <h1 className="text-[1.35rem] font-bold leading-[1.08] tracking-tight text-[var(--ink-900)] sm:text-[1.85rem]">
            <span className="block">无尽的落下</span>
          </h1>
          <p className="mt-0.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--accent-vermilion)] sm:text-[13px]">
            Down-Man On-chain
          </p>
        </header>

        <div className="flex min-h-0 items-center justify-center">
          <main
            className="w-full overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.82)] shadow-[0_18px_42px_rgba(0,0,0,0.12)] backdrop-blur-[1px]"
            style={{ maxWidth: `${layoutMetrics.cardWidth}px` }}
          >
            {/* HUD 已从根状态拆分成独立订阅组件，避免分数刷新牵连整个 App。 */}
            <LiveGameHud
              bestScore={chainBestScore}
              controller={hudController}
              key={hudBindingId}
            />

            <section
              className="relative w-full overflow-hidden"
              style={{ height: `${layoutMetrics.canvasHeight}px` }}
            >
              <GameCanvas onControllerReady={bindController} />

              {overlayText ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[rgba(16,16,16,0.16)] backdrop-blur-[2px]">
                  {/* 空闲态/暂停态提示只覆盖画布，不阻断外部按钮交互。 */}
                  <p className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.88)] px-5 py-3 text-sm font-semibold text-[var(--ink-900)] shadow-md shadow-black/15 sm:text-base">
                    {overlayText}
                  </p>
                </div>
              ) : null}

              {gameState === 'countdown' && countdownValue !== null ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[rgba(16,16,16,0.12)]">
                  {/* 倒计时单独一层，避免被游戏场景本身的滚屏影响。 */}
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--line-soft)] bg-[rgba(255,255,255,0.9)] text-4xl font-bold text-[var(--ink-900)] shadow-lg shadow-black/15 sm:h-24 sm:w-24">
                    {countdownValue}
                  </div>
                </div>
              ) : null}
            </section>

            <GameControls
              gameState={gameState}
              startBlockedReason={startBlockedReason}
              onOpenHistory={handleOpenHistory}
              onOpenLeaderboard={handleOpenLeaderboard}
              onOpenSettings={handleOpenSettings}
              onPause={handlePause}
              onResume={handleResume}
              onStart={handleStart}
            />

            <TouchControls
              touchControlMode={settings.touchControlMode}
              onTouchAxis={handleTouchAxis}
              onTouchFollowEnd={handleTouchFollowEnd}
              onTouchFollowMove={handleTouchFollowMove}
              onTouchFollowStart={handleTouchFollowStart}
            />
          </main>
        </div>

        <footer className="flex w-full items-center justify-center gap-2 text-[10px] text-[var(--ink-500)] sm:gap-3 sm:text-[11px]">
          {/* 页脚保持轻量，只承担署名与仓库入口，不塞入玩法说明。 */}
          <span className="h-px w-8 bg-[var(--line-soft)] sm:w-12" />
          <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.16em]">
            <span>© 2026 lllu_23 • Down-Man-On-chain</span>
            <span className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
            <a
              className="inline-flex items-center gap-1 text-[var(--ink-700)] transition hover:text-[var(--accent-vermilion)]"
              href="https://github.com/Luboy23/foundry_advanced_turtorial"
              rel="noreferrer"
              target="_blank"
            >
              <FooterGitHubIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </div>
          <span className="h-px w-8 bg-[var(--line-soft)] sm:w-12" />
        </footer>
      </div>

      {isSettingsOpen ? (
        <Suspense fallback={null}>
          {/* 设置、排行榜、历史、结算四类弹窗都按需懒加载，减少首屏包体压力。 */}
          <SettingsModal
            isOpen={isSettingsOpen}
            settings={settings}
            showTouchControlsSection={isMobileViewport}
            onClose={() => setIsSettingsOpen(false)}
            onToggleMusic={() => {
              activateAudio()
              playSfx('button')
              setSettings((current) => ({
                ...current,
                musicEnabled: !current.musicEnabled,
              }))
            }}
            onToggleSfx={() => {
              activateAudio()
              playSfx('button')
              setSettings((current) => ({
                ...current,
                sfxEnabled: !current.sfxEnabled,
              }))
            }}
            onSelectTouchMode={(mode) => {
              playSfx('button')
              setSettings((current) => ({
                ...current,
                touchControlMode: mode,
              }))
            }}
          />
        </Suspense>
      ) : null}

      {isLeaderboardOpen ? (
        <Suspense fallback={null}>
          <LeaderboardModalEntry
            isOpen={isLeaderboardOpen}
            hasContractAddress={hasContractAddress}
            shortAddress={shortAddress}
            onClose={() => setIsLeaderboardOpen(false)}
          />
        </Suspense>
      ) : null}

      {isHistoryOpen ? (
        <Suspense fallback={null}>
          <HistoryModalEntry
            isOpen={isHistoryOpen}
            connected={effectiveConnected}
            address={effectiveAddress}
            hasContractAddress={hasContractAddress}
            onClose={() => setIsHistoryOpen(false)}
          />
        </Suspense>
      ) : null}

      {(gameState === 'gameover' && !dismissGameOverModal) ? (
        <Suspense fallback={null}>
          {/* 结算弹窗关闭/重开锁定完全由 submitStage 控制，避免用户在 pending 时逃逸。 */}
          <GameOverModal
            isOpen={gameState === 'gameover' && !dismissGameOverModal}
            sessionStats={sessionStats}
            submitStatusText={submitStatusText}
            submitError={submitError}
            txHash={txHash}
            isLocked={isGameOverActionsLocked}
            canRetry={submitStage === 'retriable_error'}
            isWritePending={isWritePending}
            isReceiptLoading={receiptState.isLoading}
            onClose={handleCloseGameOver}
            onRetry={() => {
              playSfx('button')
              void submitScoreOnchain()
            }}
            onRestart={() => {
              if (isGameOverActionsLocked) {
                return
              }
              activateAudio()
              playSfx('button')
              handleRestart()
              setDismissGameOverModal(true)
            }}
            shortAddress={shortAddress}
          />
        </Suspense>
      ) : null}

      {isPortrait && !settings.dismissPortraitHint ? (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-6 text-center backdrop-blur-sm">
          {/* 横竖屏提示属于纯 UI 辅助层，不改变任何玩法或控制逻辑。 */}
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.92)] px-5 py-4 text-[var(--ink-900)] shadow-xl shadow-black/20">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold">建议横屏体验</p>
              <button
                aria-label="关闭提示"
                className={`${buttonSecondaryClass} ${buttonSizeXsClass} h-10 w-10 p-0 text-base font-bold leading-none`}
                onClick={() => {
                  playSfx('button')
                  setSettings((current) => ({
                    ...current,
                    dismissPortraitHint: true,
                  }))
                }}
                type="button"
              >
                x
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-700)]">
              游戏已支持竖屏最低可玩，但横屏下视野更完整、操作更稳定。
            </p>
            <div className="mt-3 flex justify-end">
              <button
                className={`${buttonSecondaryClass} ${buttonSizeXsClass}`}
                onClick={() => {
                  playSfx('button')
                  setSettings((current) => ({
                    ...current,
                    dismissPortraitHint: true,
                  }))
                }}
                type="button"
              >
                本次不再提醒
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
