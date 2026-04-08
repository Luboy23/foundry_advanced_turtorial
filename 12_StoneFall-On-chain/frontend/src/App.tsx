/**
 * 模块职责：承载游戏主页面状态编排、钱包交互、链上读写与弹窗控制。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
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

import type { StoneFallController } from './game/createStoneFallGame'
import type {
  DifficultySnapshot,
  GameState,
  InputSource,
  SessionStats,
} from './game/types'
import { GameCanvas } from './features/game/GameCanvas'
import { GameControls, TouchControls } from './features/ui/GameControls'
import { GameHud } from './features/ui/GameHud'
import { WalletPanel } from './features/ui/WalletPanel'
import {
  buttonSecondaryClass,
  buttonSizeXsClass,
} from './features/ui/buttonStyles'
import { useGameAudio } from './features/audio/useGameAudio'
import { getDifficultySnapshot } from './shared/game/difficulty'
import { loadSettings, saveSettings, purgeLegacyLeaderboardData } from './shared/storage/localStore'
import type { SettingsModel } from './shared/storage/types'
import { defaultSettings } from './shared/storage/types'
import { useViewport } from './shared/utils/useViewport'
import {
  STONEFALL_ABI,
  STONEFALL_ADDRESS,
  STONEFALL_ADDRESS_VALID,
} from './lib/contract'
import { STONEFALL_CHAIN_ID, STONEFALL_RPC_URL } from './lib/chain'
import { formatTxError } from './lib/txError'

const LeaderboardModalEntry = lazy(() => import('./features/ui/modals/LeaderboardModalEntry'))
const HistoryModalEntry = lazy(() => import('./features/ui/modals/HistoryModalEntry'))
const SettingsModal = lazy(() => import('./features/ui/modals/SettingsModal'))
const GameOverModal = lazy(() => import('./features/ui/modals/GameOverModal'))

/**
 * 调试窗口扩展：在浏览器控制台中暴露场景调试能力，便于 e2e 与手工排障。
 */
type DebugWindow = Window & {
  __STONEFALL_DEBUG__?: {
    forceGameOver: () => void
    setElapsedMs: (elapsedMs: number) => void
    getPlayerX: () => number
    getPlayerVelocityX: () => number
    getSpawnTelemetry: () => Array<{
      timestampMs: number
      lane: number
      x: number
      count: 1 | 2
    }>
  }
}

/**
 * 链上提交流程状态机：
 * idle -> signing/pending -> success/retriable_error/terminal_error。
 */
type SubmitStage =
  | 'idle'
  | 'signing'
  | 'pending'
  | 'success'
  | 'retriable_error'
  | 'terminal_error'

type SubmitFailureKind = 'retriable' | 'terminal'

/**
 * 待提交成绩快照。
 * 使用递增 id 防止上一局异步回调误更新当前局状态。
 */
type PendingSubmission = {
  id: number
  stats: SessionStats
  inputType: InputSource
}

/** 触控跟随模式下用于比例映射的世界宽度。 */
const TOUCH_FOLLOW_WORLD_WIDTH = 1280
const E2E_BYPASS_WALLET = import.meta.env.VITE_E2E_BYPASS_WALLET === 'true'
const E2E_TEST_PRIVATE_KEY = import.meta.env.VITE_E2E_TEST_PRIVATE_KEY as
  | Hex
  | undefined

const TERMINAL_SUBMIT_ERROR_PATTERNS: RegExp[] = [
  /scoremustbegreaterthanzero/i,
  /must be greater than zero/i,
  /分数为 0/,
]

const isTerminalSubmitErrorMessage = (message: string): boolean => {
  const normalized = message.trim()
  if (normalized.length === 0) {
    return false
  }
  return TERMINAL_SUBMIT_ERROR_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * 地址短显工具。
 * @param address 钱包地址或交易哈希
 * @returns 形如 0x1234...cdef 的短文本
 */
const shortAddress = (address?: string) => {
  if (!address) {
    return '--'
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/** Footer GitHub 品牌图标：使用实心版本并继承链接文本色。 */
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

/**
 * 将触控比例映射为游戏世界坐标。
 * @param ratio 0~1 的触控水平比例
 * @returns 世界坐标系中的目标 X
 */
const resolveTouchFollowTargetX = (ratio: number): number => {
  const normalizedRatio = Math.max(0, Math.min(1, ratio))
  return Math.round(normalizedRatio * TOUCH_FOLLOW_WORLD_WIDTH)
}

/**
 * 判断键盘事件目标是否为输入类元素。
 * 空格快捷键在输入场景下应让位于原生输入行为。
 */
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

/**
 * 应用根组件：负责状态编排、链上交互与 UI 事件联动。
 */
function App() {
  // Phaser 控制器与订阅解绑器使用 ref 持有，避免重渲染丢失引用。
  const controllerRef = useRef<StoneFallController | null>(null)
  const unsubscribeRef = useRef<Array<() => void>>([])
  const submissionIdRef = useRef(0)

  // 游戏会话实时状态（HUD + 流程控制）。
  const [gameState, setGameState] = useState<GameState>('idle')
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [survivalMs, setSurvivalMs] = useState(0)
  const [totalDodged, setTotalDodged] = useState(0)
  const [difficulty, setDifficulty] = useState<DifficultySnapshot>(
    getDifficultySnapshot(0),
  )
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)

  // 用户设置与弹窗开关状态。
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

  // 视口信息用于响应式布局计算。
  const viewport = useViewport()
  const isPortrait = viewport.height > viewport.width
  const queryClient = useQueryClient()

  // 钱包连接状态与链上读写能力。
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, isPending: isWritePending } = useWriteContract()
  const publicClient = usePublicClient({ chainId: STONEFALL_CHAIN_ID })

  const injectedConnector = useMemo(() => connectors[0], [connectors])
  // E2E 模式可绕过浏览器钱包，直接用测试私钥签名。
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
      id: STONEFALL_CHAIN_ID,
      name: 'Anvil',
      rpcUrls: {
        default: { http: [STONEFALL_RPC_URL] },
        public: { http: [STONEFALL_RPC_URL] },
      },
    }
    return createWalletClient({
      account: testWalletAccount,
      chain: localChain,
      transport: http(STONEFALL_RPC_URL),
    }).extend(publicActions)
  }, [testWalletAccount])
  // 统一对外有效钱包状态，屏蔽正常模式与 E2E 模式差异。
  const effectiveAddress = E2E_BYPASS_WALLET ? testWalletAccount?.address : address
  const effectiveConnected = E2E_BYPASS_WALLET ? Boolean(testWalletAccount) : isConnected
  const effectiveChainId = E2E_BYPASS_WALLET ? STONEFALL_CHAIN_ID : chainId

  const {
    activateAudio,
    playSfx,
    setBgmRunning,
  } = useGameAudio(
    settings.musicEnabled,
    settings.sfxEnabled,
  )

  // 链上化后启动即清理旧本地排行榜，避免展示过期本地数据。
  useEffect(() => {
    purgeLegacyLeaderboardData()
  }, [])

  // 设置变更后持久化，并同步给 Phaser 音频系统。
  useEffect(() => {
    saveSettings(settings)
    controllerRef.current?.setAudioSettings(settings.musicEnabled, settings.sfxEnabled)
  }, [settings])

  // 只有 running 状态才维持背景音乐播放。
  useEffect(() => {
    setBgmRunning(gameState === 'running')
  }, [gameState, setBgmRunning])

  // 开始游戏与提交成绩前置条件。
  const hasContractAddress = STONEFALL_ADDRESS_VALID && !!STONEFALL_ADDRESS
  const isCorrectChain = effectiveChainId === STONEFALL_CHAIN_ID

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
      return `请切换到 Anvil (${STONEFALL_CHAIN_ID})`
    }
    return null
  }, [effectiveConnected, hasContractAddress, isCorrectChain, testWalletAccount])

  const disconnectLocked = effectiveConnected && gameState !== 'idle'
  const disconnectLockReason = disconnectLocked
    ? '对局进行中，暂不可断开钱包连接'
    : undefined

  // 读取当前地址链上最佳分。
  const bestScoreQuery = useQuery({
    queryKey: ['stonefall', 'best-score', STONEFALL_ADDRESS, effectiveAddress],
    enabled: hasContractAddress && !!publicClient && !!effectiveAddress,
    queryFn: async () => {
      const value = (await publicClient!.readContract({
        address: STONEFALL_ADDRESS!,
        abi: STONEFALL_ABI,
        functionName: 'bestScoreOf',
        args: [effectiveAddress!],
      })) as number | bigint

      return Number(value)
    },
    staleTime: 5000,
    gcTime: 60000,
  })

  const chainBestScore = useMemo(() => {
    if (!effectiveConnected) {
      return 0
    }
    return bestScoreQuery.data ?? 0
  }, [bestScoreQuery.data, effectiveConnected])

  // 页面可见性用于控制后台轮询开销。
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === 'undefined') {
      return true
    }
    return document.visibilityState === 'visible'
  })
  const lastInvalidateAtRef = useRef(0)
  const lastEventAtRef = useRef(0)
  // 查询刷新节流，避免事件/轮询并发导致高频重复请求。
  const invalidateOnchainQueries = useCallback((force = false) => {
    const now = Date.now()
    if (!force && now - lastInvalidateAtRef.current < 1200) {
      return
    }
    lastInvalidateAtRef.current = now
    void queryClient.invalidateQueries({ queryKey: ['stonefall'] })
  }, [queryClient])

  // 监听标签页可见性。
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

  // 合约事件驱动刷新：监听 ScoreSubmitted。
  useEffect(() => {
    if (!hasContractAddress || !publicClient) {
      return
    }

    const unwatch = publicClient.watchContractEvent({
      address: STONEFALL_ADDRESS!,
      abi: STONEFALL_ABI,
      eventName: 'ScoreSubmitted',
      onLogs: () => {
        lastEventAtRef.current = Date.now()
        invalidateOnchainQueries(true)
      },
    })

    return () => {
      unwatch()
    }
  }, [hasContractAddress, invalidateOnchainQueries, publicClient])

  // 兜底轮询：在页面可见时低频刷新，防止漏事件。
  useEffect(() => {
    if (!hasContractAddress || !isPageVisible) {
      return
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastEventAtRef.current <= 30_000) {
        return
      }
      invalidateOnchainQueries()
    }, 15_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasContractAddress, invalidateOnchainQueries, isPageVisible])

  // 统一解绑 Phaser 事件订阅。
  const teardownSubscriptions = useCallback(() => {
    for (const unsubscribe of unsubscribeRef.current) {
      unsubscribe()
    }
    unsubscribeRef.current = []
  }, [])

  // 绑定 Phaser 控制器并桥接到 React 状态。
  const bindController = useCallback(
    (controller: StoneFallController | null) => {
      teardownSubscriptions()
      controllerRef.current = controller

      if (!controller) {
        return
      }

      controller.setAudioSettings(settings.musicEnabled, settings.sfxEnabled)
      controller.setInputMode('auto')

      // 所有游戏事件在此统一汇总处理。
      unsubscribeRef.current = [
        controller.subscribe('onGameState', ({ state }) => {
          setGameState(state)
          if (state !== 'countdown') {
            setCountdownValue(null)
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
        controller.subscribe(
          'onScoreTick',
          ({
            score: nextScore,
            survivalMs: nextMs,
            totalDodged: nextTotalDodged,
          }) => {
            setScore(nextScore)
            setSurvivalMs(nextMs)
            setTotalDodged(nextTotalDodged)
          },
        ),
        controller.subscribe('onDifficultyTick', (snapshot) => {
          setDifficulty(snapshot)
        }),
        controller.subscribe('onCountdown', ({ value }) => {
          setCountdownValue(value)
          if (value > 0) {
            playSfx('countdown')
          } else if (value === 0) {
            playSfx('start')
          }
        }),
        controller.subscribe('onSessionStats', (stats) => {
          setSessionStats(stats)
        }),
        controller.subscribe('onGameOver', ({ stats, inputType }) => {
          setSessionStats(stats)
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

      // 暴露调试句柄给控制台和自动化脚本。
      ;(window as DebugWindow).__STONEFALL_DEBUG__ = {
        forceGameOver: () => {
          controller.debugForceGameOver()
        },
        setElapsedMs: (elapsedMs: number) => {
          controller.debugSetElapsedMs(elapsedMs)
        },
        getPlayerX: () => controller.debugGetPlayerX(),
        getPlayerVelocityX: () => controller.debugGetPlayerVelocityX(),
        getSpawnTelemetry: () => controller.debugGetSpawnTelemetry(),
      }
    },
    [
      playSfx,
      settings.musicEnabled,
      settings.sfxEnabled,
      teardownSubscriptions,
    ],
  )

  // 页面卸载时释放订阅和调试对象。
  useEffect(() => {
    return () => {
      teardownSubscriptions()
      ;(window as DebugWindow).__STONEFALL_DEBUG__ = undefined
    }
  }, [teardownSubscriptions])

  const commitSubmitFailure = useCallback(
    (message: string, kind: SubmitFailureKind) => {
      setSubmitStage(kind === 'terminal' ? 'terminal_error' : 'retriable_error')
      setSubmitError(message)
      setTxHash(null)
    },
    [],
  )

  // 自动上链提交。
  const submitScoreOnchain = useCallback(async () => {
    if (!pendingSubmission) {
      return
    }
    if (submitStage === 'signing' || submitStage === 'pending') {
      return
    }

    if (!hasContractAddress || !STONEFALL_ADDRESS) {
      commitSubmitFailure('合约地址未配置，请先执行 make deploy', 'terminal')
      return
    }

    if (!effectiveConnected || !effectiveAddress) {
      commitSubmitFailure('钱包已断开，请重新连接后重试', 'retriable')
      return
    }

    if (!isCorrectChain) {
      commitSubmitFailure(`请切换到 Anvil (${STONEFALL_CHAIN_ID})`, 'retriable')
      return
    }

    const normalizedScore = Math.max(0, Math.floor(pendingSubmission.stats.score))
    if (normalizedScore <= 0) {
      commitSubmitFailure('分数为 0，无法上链提交', 'terminal')
      return
    }

    setSubmitStage(E2E_BYPASS_WALLET ? 'pending' : 'signing')
    setSubmitError(null)

    try {
      // 入参统一归一化为非负整数，防止异常值上链。
      const args = [
        normalizedScore,
        Math.max(0, Math.floor(pendingSubmission.stats.survivalMs)),
        Math.max(0, Math.floor(pendingSubmission.stats.totalDodged)),
      ] as const
      let hash: `0x${string}`

      if (E2E_BYPASS_WALLET) {
        // E2E 模式下直接本地签名，不依赖浏览器钱包弹窗。
        if (!testWalletClient || !testWalletAccount) {
          throw new Error('测试钱包不可用，请检查 VITE_E2E_TEST_PRIVATE_KEY')
        }
        hash = await testWalletClient.writeContract({
          address: STONEFALL_ADDRESS,
          abi: STONEFALL_ABI,
          functionName: 'submitScore',
          args,
          account: testWalletAccount,
        })
      } else {
        hash = await writeContractAsync({
          address: STONEFALL_ADDRESS,
          abi: STONEFALL_ABI,
          functionName: 'submitScore',
          args,
        })
      }
      setTxHash(hash)
      setSubmitStage('pending')
    } catch (error) {
      const message = formatTxError(error)
      commitSubmitFailure(
        message,
        isTerminalSubmitErrorMessage(message) ? 'terminal' : 'retriable',
      )
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

  // 有待提交成绩且状态为 idle 时自动触发一次提交。
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

  // 交易回执查询。
  const receiptState = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: {
      enabled: Boolean(txHash),
    },
  })

  // 回执状态落地到 UI：成功则解锁下一局，失败则允许重试。
  useEffect(() => {
    if (!txHash) {
      return
    }

    if (receiptState.isSuccess) {
      const timer = window.setTimeout(() => {
        setSubmitStage('success')
        setSubmitError(null)
        lastEventAtRef.current = Date.now()
        invalidateOnchainQueries(true)
      }, 0)
      return () => {
        window.clearTimeout(timer)
      }
    }

    if (receiptState.isError) {
      const timer = window.setTimeout(() => {
        commitSubmitFailure('交易回滚或确认失败，请重试', 'retriable')
      }, 0)
      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [
    commitSubmitFailure,
    invalidateOnchainQueries,
    receiptState.isError,
    receiptState.isSuccess,
    txHash,
  ])

  // 按视口动态计算卡片与 16:9 画布尺寸。
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

  // 钱包连接入口。
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

  // 顶部控制栏交互事件处理。
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

  // 空格快捷键：仅在 running/paused 切换暂停与继续。
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

  // 切换触控模式时重置触控轴，避免残留位移。
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
    if (submitStage === 'idle' || submitStage === 'signing' || submitStage === 'pending') {
      return
    }
    playSfx('button')
    setDismissGameOverModal(true)
    controllerRef.current?.returnToIdle()
  }, [playSfx, submitStage])

  const overlayText =
    gameState === 'idle'
      ? '连接钱包并点击开始，进入落石求生挑战'
      : gameState === 'paused'
        ? '已暂停'
        : null

  const submitStatusText =
    submitStage === 'idle'
      ? '等待自动上链...'
      : submitStage === 'signing'
        ? '请在钱包中签名确认'
        : submitStage === 'pending'
          ? '交易已发出，等待链上确认'
          : submitStage === 'success'
            ? '成绩已成功上链'
            : submitStage === 'terminal_error'
              ? '上链失败，本局成绩不可重试'
              : '上链失败，可重试'

  const isGameOverActionsLocked =
    submitStage === 'idle' || submitStage === 'signing' || submitStage === 'pending'

  // -------------------------------
  // 视图渲染区
  // -------------------------------
  return (
    <div className="h-dvh overflow-hidden bg-gradient-to-br from-[var(--paper-50)] via-[var(--paper-100)] to-[var(--paper-200)] px-3 py-2 text-[var(--ink-900)] sm:px-4 sm:py-3">
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
          <h1 className="text-[1.35rem] font-bold leading-[1.08] tracking-tight text-[var(--ink-900)] sm:text-[1.85rem]">
            <span className="block">落石求生</span>
          </h1>
          <p className="mt-0.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--accent-vermilion)] sm:text-[13px]">
            StoneFall On-chain
          </p>
        </header>

        <div className="flex min-h-0 items-center justify-center">
          <main
            className="w-full overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.82)] shadow-[0_18px_42px_rgba(0,0,0,0.12)] backdrop-blur-[1px]"
            style={{ maxWidth: `${layoutMetrics.cardWidth}px` }}
          >
            <GameHud
              bestScore={chainBestScore}
              difficulty={difficulty}
              score={score}
              survivalMs={survivalMs}
              totalDodged={totalDodged}
            />

            <section
              className="relative w-full overflow-hidden"
              style={{ height: `${layoutMetrics.canvasHeight}px` }}
            >
              <GameCanvas onControllerReady={bindController} />

              {overlayText ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[rgba(16,16,16,0.16)] backdrop-blur-[2px]">
                  <p className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.88)] px-5 py-3 text-sm font-semibold text-[var(--ink-900)] shadow-md shadow-black/15 sm:text-base">
                    {overlayText}
                  </p>
                </div>
              ) : null}

              {gameState === 'countdown' && countdownValue !== null ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[rgba(16,16,16,0.12)]">
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
          <span className="h-px w-8 bg-[var(--line-soft)] sm:w-12" />
          <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.16em]">
            <span>© 2026 lllu_23 • StoneFall-On-chain</span>
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
          <SettingsModal
            isOpen={isSettingsOpen}
            settings={settings}
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
