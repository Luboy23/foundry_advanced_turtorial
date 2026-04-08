import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { createWalletClient, http, publicActions, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

import { GameCanvas } from './features/game/GameCanvas'
import { DesktopFloatingControls, GameControls, TouchControls } from './features/ui/GameControls'
import { GameHud } from './features/ui/GameHud'
import { WalletPanel } from './features/ui/WalletPanel'
import { ToastViewport, type ToastInput, type ToastState } from './features/toast/ToastViewport'
import { useGameAudio } from './features/audio/useGameAudio'
import type { GameState, SnapshotStats, WeaponType } from './game/types'
import { BRAVEMAN_CHAIN_ID, BRAVEMAN_RPC_URL } from './lib/chain'
import { createSession, type ApiErrorPayload } from './lib/api'
import {
  BOW_PRICE,
  BRAVEMAN_ABI,
  BRAVEMAN_ADDRESS,
  BRAVEMAN_ADDRESS_VALID,
} from './lib/contract'
import { BRAVEMAN_COPYRIGHT, BRAVEMAN_PROJECT_NAME, BRAVEMAN_REPOSITORY_URL } from './lib/projectMeta'
import { formatTxError } from './lib/txError'
import {
  useChainQueries,
} from './hooks/useChainQueries'
import {
  useSettlementFlow,
} from './hooks/useSettlementFlow'
import {
  useStageLayout,
} from './hooks/useStageLayout'
import {
  useGameControllerBridge,
} from './hooks/useGameControllerBridge'
import { defaultSettings, type SettingsModel } from './shared/storage/types'
import { loadSettings, saveSettings } from './shared/storage/localStore'
import { useViewport } from './shared/utils/useViewport'
import { RailActionButton } from './features/ui/RailActionButton'
import { buttonSecondaryClass, buttonSizeXsClass, parchmentBadgeClass, parchmentPanelClass } from './features/ui/buttonStyles'
import { EquipmentIcon, GitHubIcon } from './features/ui/GameUiIcons'

const loadSettingsModal = () => import('./features/ui/modals/SettingsModal')
const loadHistoryModal = () => import('./features/ui/modals/HistoryModal')
const loadSettlementModal = () => import('./features/ui/modals/SettlementModal')
const loadEquipmentModal = async () => ({
  default: (await import('./features/ui/EquipmentModal')).EquipmentModal,
})

const SettingsModal = lazy(loadSettingsModal)
const HistoryModal = lazy(loadHistoryModal)
const SettlementModal = lazy(loadSettlementModal)
const EquipmentModal = lazy(loadEquipmentModal)

/** E2E 模式：跳过真实钱包连接，改用本地私钥账户。 */
const E2E_BYPASS_WALLET = import.meta.env.VITE_E2E_BYPASS_WALLET === 'true'
/** E2E 模式下注入的测试私钥；缺失时直接禁用旁路钱包。 */
const E2E_TEST_PRIVATE_KEY = import.meta.env.VITE_E2E_TEST_PRIVATE_KEY as Hex | undefined

/** Phaser 尚未产出快照时，HUD 与装备面板统一使用的初始视图。 */
const initialSnapshot: SnapshotStats = {
  kills: 0,
  survivalMs: 0,
  goldEarned: 0,
  activeWeapon: 'sword',
  pose: 'sword_idle',
  targetId: null,
  projectileCount: 0,
  enemyCount: 0,
}

/** 浏览器注入钱包最小接口，只关心 `request` 即可完成加链/切链。 */
type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/** 统一把字符串/对象两种 toast 入参归一化成渲染层状态。 */
const normalizeToastInput = (input: ToastInput): ToastState => {
  if (typeof input === 'string') {
    return {
      id: Date.now(),
      message: input,
      tone: 'info',
      persistent: false,
    }
  }

  const tone = input.tone ?? 'info'
  return {
    id: Date.now(),
    message: input.message,
    tone,
    persistent: input.persistent ?? (tone === 'error' || tone === 'warning'),
  }
}

/** 读取浏览器注入钱包实例；SSR 或无钱包环境下安全回退为 null。 */
const getInjectedEthereum = (): EthereumProvider | null => {
  if (typeof window === 'undefined') return null
  const candidate = (window as Window & { ethereum?: EthereumProvider }).ethereum
  return candidate?.request ? candidate : null
}

/** 判断切链失败是否属于“本地链尚未添加到钱包”，便于后续自动补链。 */
const shouldAttemptAddChain = (error: unknown): boolean => {
  const candidates = [error]
  if (error && typeof error === 'object' && 'cause' in error) {
    candidates.push((error as { cause?: unknown }).cause)
  }

  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false
    const maybeCode = 'code' in candidate ? (candidate as { code?: number }).code : undefined
    const maybeMessage = 'message' in candidate ? String((candidate as { message?: unknown }).message ?? '') : ''
    return maybeCode === 4902 || /4902|unknown chain|unrecognized chain|not added/i.test(maybeMessage)
  })
}

/** 将完整钱包地址压缩为 `0x1234...abcd` 形式，便于 UI 展示。 */
const shortAddress = (address?: string) => !address ? '--' : `${address.slice(0, 6)}...${address.slice(-4)}`

/** 页面主容器：负责游戏状态、钱包状态、链上交互与 UI 编排。 */
function App() {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [engineReady, setEngineReady] = useState(false)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<SnapshotStats>(initialSnapshot)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [startPending, setStartPending] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [purchasePending, setPurchasePending] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [optimisticBowOwned, setOptimisticBowOwned] = useState(false)
  const [sessionBowUnlocked, setSessionBowUnlocked] = useState(false)
  const [settings, setSettings] = useState<SettingsModel>(() => typeof window === 'undefined' ? defaultSettings : loadSettings())
  const startAbortRef = useRef<AbortController | null>(null)

  const viewport = useViewport()
  const isPortrait = viewport.height > viewport.width
  const isDesktop = viewport.width >= 768
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: BRAVEMAN_CHAIN_ID })

  /** 选择默认钱包连接器（通常是浏览器注入钱包）。 */
  const injectedConnector = useMemo(() => connectors[0], [connectors])
  /** 仅 E2E 模式下从私钥构造本地测试账户。 */
  const testWalletAccount = useMemo(() => {
    if (!E2E_BYPASS_WALLET || !E2E_TEST_PRIVATE_KEY) return null
    try {
      return privateKeyToAccount(E2E_TEST_PRIVATE_KEY)
    } catch {
      return null
    }
  }, [])
  /** 仅 E2E 模式下构造可直接发交易的钱包客户端。 */
  const testWalletClient = useMemo(() => {
    if (!testWalletAccount) return null
    const localChain = {
      ...anvil,
      id: BRAVEMAN_CHAIN_ID,
      name: 'Anvil',
      rpcUrls: {
        default: { http: [BRAVEMAN_RPC_URL] },
        public: { http: [BRAVEMAN_RPC_URL] },
      },
    }
    return createWalletClient({
      account: testWalletAccount,
      chain: localChain,
      transport: http(BRAVEMAN_RPC_URL),
    }).extend(publicActions)
  }, [testWalletAccount])

  // `effective*` 把真实钱包模式与 E2E 旁路钱包模式收敛成一套后续状态来源。
  const effectiveAddress = E2E_BYPASS_WALLET ? testWalletAccount?.address : address
  const effectiveConnected = E2E_BYPASS_WALLET ? Boolean(testWalletAccount) : isConnected
  const effectiveChainId = E2E_BYPASS_WALLET ? BRAVEMAN_CHAIN_ID : chainId
  const hasContractAddress = BRAVEMAN_ADDRESS_VALID && !!BRAVEMAN_ADDRESS
  const isCorrectChain = effectiveChainId === BRAVEMAN_CHAIN_ID

  /** 钱包变化时重置与钱包绑定的乐观状态。 */
  useEffect(() => {
    setOptimisticBowOwned(false)
    setSessionBowUnlocked(false)
  }, [effectiveAddress])

  /** 组件卸载时中止仍在进行中的 start 请求，避免旧 session 回填到新页面。 */
  useEffect(() => () => startAbortRef.current?.abort(), [])

  useEffect(() => {
    const preloadModals = () => {
      void loadSettingsModal()
      void loadHistoryModal()
      void loadSettlementModal()
      void loadEquipmentModal()
    }

    const requestIdle = window.requestIdleCallback?.bind(window)
    const cancelIdle = window.cancelIdleCallback?.bind(window)

    if (requestIdle) {
      const idleId = requestIdle(() => preloadModals(), { timeout: 500 })
      return () => {
        cancelIdle?.(idleId)
      }
    }

    const timer = window.setTimeout(preloadModals, 160)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const { activateAudio, playSfx, setBgmRunning } = useGameAudio(settings.musicEnabled, settings.sfxEnabled)

  /** 本地设置变更后持久化到 localStorage。 */
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  /** 依据游戏状态控制背景音乐开关。 */
  useEffect(() => {
    setBgmRunning(gameState === 'running')
  }, [gameState, setBgmRunning])

  /** Toast 自动消失定时器。 */
  useEffect(() => {
    if (!toast || toast.persistent) return
    const timer = window.setTimeout(() => setToast(null), toast.tone === 'success' ? 2200 : 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  /** 引擎恢复正常后，主动清掉仅由 boot 失败产生的错误 toast。 */
  useEffect(() => {
    if (engineError) return
    setToast((current) => {
      if (!current) return current
      if (current.tone !== 'error') return current
      return current.message.startsWith('游戏引擎加载失败') ? null : current
    })
  }, [engineError])

  /** 显示一条短时提示。 */
  const showToast = useCallback((input: ToastInput) => {
    setToast(normalizeToastInput(input))
  }, [])

  /** 主动关闭当前 toast。 */
  const dismissToast = useCallback(() => setToast(null), [])

  /** 触发钱包连接。 */
  const connectWallet = useCallback(() => {
    if (!injectedConnector) return
    connect({ connector: injectedConnector })
  }, [connect, injectedConnector])

  /** 把本地 Anvil 网络写入浏览器钱包，供首次接入教学链时自助修复。 */
  const addLocalChainToWallet = useCallback(async () => {
    const ethereum = getInjectedEthereum()
    if (!ethereum) throw new Error('当前钱包不支持自动添加本地链。')
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${BRAVEMAN_CHAIN_ID.toString(16)}`,
        chainName: `Anvil ${BRAVEMAN_CHAIN_ID}`,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: [BRAVEMAN_RPC_URL],
      }],
    })
  }, [])

  /** 网络修复主流程：优先直接切链，失败后在识别到未加链时尝试自动补链。 */
  const handleRepairNetwork = useCallback(async () => {
    if (E2E_BYPASS_WALLET || !effectiveConnected) return
    playSfx('button')

    try {
      await switchChainAsync({ chainId: BRAVEMAN_CHAIN_ID })
      showToast({
        message: `已切换到 Anvil (${BRAVEMAN_CHAIN_ID})`,
        tone: 'success',
      })
      return
    } catch (error) {
      if (shouldAttemptAddChain(error)) {
        try {
          await addLocalChainToWallet()
          await switchChainAsync({ chainId: BRAVEMAN_CHAIN_ID })
          showToast({
            message: `已添加并切换到 Anvil (${BRAVEMAN_CHAIN_ID})`,
            tone: 'success',
          })
          return
        } catch {
          // 钱包不支持自动补链或再次切换失败时，统一走下方的手动修复提示。
        }
      }
    }

    showToast({
      message: `自动切换网络失败，请在钱包中手动切到 Anvil ${BRAVEMAN_CHAIN_ID}（RPC: ${BRAVEMAN_RPC_URL}）。`,
      tone: 'error',
      persistent: true,
    })
  }, [addLocalChainToWallet, effectiveConnected, playSfx, showToast, switchChainAsync])

  const {
    stageShellRef,
    mobileCanvasHeight,
    overlayText,
    footerOverlayTone,
    stageTitleVisual,
    desktopRightRailTop,
  } = useStageLayout({
    viewport,
    isDesktop,
    gameState,
    engineReady,
    engineError,
  })

  const {
    chainGold,
    bowOwned,
    historyQueryState,
    apiUnavailableReason,
    invalidateChainData,
  } = useChainQueries({
    publicClient,
    effectiveAddress,
    hasContractAddress,
    isHistoryOpen,
    gameState,
    optimisticBowOwned,
  })

  /** 发送合约交易并等待链上确认；兼容 E2E 测试钱包与正常钱包模式。 */
  const sendContractAndConfirm = useCallback(async (
    config: Record<string, unknown>,
    onSubmitted?: (hash: `0x${string}`) => void,
  ) => {
    if (E2E_BYPASS_WALLET) {
      if (!testWalletClient) throw new Error('E2E 测试钱包未配置')
      const hash = await testWalletClient.writeContract(config as never)
      onSubmitted?.(hash)
      await testWalletClient.waitForTransactionReceipt({ hash })
      return hash
    }
    if (!publicClient) throw new Error('Public client unavailable')
    const hash = await writeContractAsync(config as never)
    onSubmitted?.(hash)
    await publicClient.waitForTransactionReceipt({ hash })
    return hash
  }, [publicClient, testWalletClient, writeContractAsync])

  const {
    sessionStats,
    submitStage,
    submitError,
    txHash,
    isSettlementOpen,
    isSettlementLocked,
    isSettlementAutoReturning,
    isRecoveryMode,
    submitStatusText,
    canRetry,
    openSettlementForGameOver,
    retrySettlement,
    discardRecoveredSettlement,
    closeSettlement,
    resetSettlementFlow,
  } = useSettlementFlow({
    effectiveAddress,
    sendContractAndConfirm,
    invalidateChainData,
    showToast,
  })

  // 以下派生变量统一约束大厅/对局/结算三个 UI 子系统的可操作性。
  const canToggleWeapon = bowOwned && (gameState === 'idle' || sessionBowUnlocked)
  const disconnectLocked = effectiveConnected && gameState !== 'idle'
  const disconnectLockReason = disconnectLocked
    ? '对局进行中，暂不可断开钱包连接'
    : undefined
  const canOpenEquipment = (gameState === 'idle' || gameState === 'paused' || gameState === 'running') && !(isSettlementOpen && isSettlementLocked)
  /** 购买霜翎逐月前的统一门禁文案，避免按钮禁用逻辑在多个组件分叉。 */
  const purchaseBowBlockedReason = useMemo(() => {
    if (!hasContractAddress) return '合约地址未配置，请先执行 make deploy'
    if (!effectiveConnected) return '请先连接钱包后再购买霜翎逐月'
    if (!isCorrectChain) return `请先切换到 Anvil (${BRAVEMAN_CHAIN_ID})`
    if (gameState !== 'idle' && gameState !== 'paused') return '请在大厅或暂停状态购买霜翎逐月并装备'
    if (bowOwned) return '霜翎逐月已永久解锁，无需重复购买'
    if (purchasePending) return '霜翎逐月购入中，请等待链上确认'
    if (chainGold < Number(BOW_PRICE)) return `链上金币不足，还差 ${Number(BOW_PRICE) - chainGold} 金币`
    return null
  }, [bowOwned, chainGold, effectiveConnected, gameState, hasContractAddress, isCorrectChain, purchasePending])
  const canPurchaseBow = purchaseBowBlockedReason === null

  const { controllerRef, bindController } = useGameControllerBridge({
    isEquipmentOpen,
    bowAvailable: bowOwned || sessionBowUnlocked,
    playSfx,
    onGameOver: openSettlementForGameOver,
    setGameState,
    setEngineReady,
    setCountdownValue,
    setSnapshot,
    setSessionBowUnlocked,
    setIsEquipmentOpen,
  })

  /** 统一计算“开始游戏不可用”原因文案。 */
  const startBlockedReason = useMemo(() => {
    if (!hasContractAddress) return '合约地址未配置，请先执行 make deploy'
    if (E2E_BYPASS_WALLET && !testWalletAccount) return 'E2E 测试钱包未配置，请设置 VITE_E2E_TEST_PRIVATE_KEY'
    if (engineError) return engineError
    if (!engineReady) return '游戏引擎仍在初始化，请稍候再开始'
    if (!effectiveConnected) return '请先连接钱包后开始'
    if (!isCorrectChain) return `请切换到 Anvil (${BRAVEMAN_CHAIN_ID})`
    if (apiUnavailableReason) return apiUnavailableReason
    return null
  }, [apiUnavailableReason, effectiveConnected, engineError, engineReady, hasContractAddress, isCorrectChain, testWalletAccount])

  /** 开始按钮主流程：校验状态 -> 请求 session -> 启动一局。 */
  const handleStart = useCallback(async () => {
    if (startPending) return
    activateAudio()
    playSfx('button')
    if (startBlockedReason) {
      showToast({
        message: startBlockedReason,
        tone: engineError || apiUnavailableReason ? 'error' : 'warning',
        persistent: Boolean(engineError || apiUnavailableReason),
      })
      return
    }
    if (!effectiveAddress) {
      showToast({ message: '请先连接钱包后开始', tone: 'warning' })
      return
    }
    if (!controllerRef.current) {
      showToast({
        message: engineError ?? '游戏引擎尚未完成初始化，请稍后重试',
        tone: 'error',
        persistent: true,
      })
      return
    }
    startAbortRef.current?.abort()
    const requestController = new AbortController()
    startAbortRef.current = requestController
    setStartPending(true)
    try {
      resetSettlementFlow()
      const session = await createSession(effectiveAddress, {
        signal: requestController.signal,
      })
      setSessionBowUnlocked(session.bowUnlocked)
      controllerRef.current.startGame({
        sessionId: session.sessionId,
        seed: session.seed,
        expiresAt: session.expiresAt,
        rulesetVersion: session.rulesetMeta.rulesetVersion,
        configHash: session.rulesetMeta.configHash,
        bowUnlocked: session.bowUnlocked,
      })
    } catch (error) {
      const apiError = error as Partial<ApiErrorPayload>
      if (apiError.code === 'REQUEST_ABORTED') return
      showToast({
        message: apiError.message ?? '申请 session 失败，请确认后端服务已启动',
        tone: 'error',
        persistent: true,
      })
    } finally {
      if (startAbortRef.current === requestController) {
        startAbortRef.current = null
      }
      setStartPending(false)
    }
  }, [activateAudio, apiUnavailableReason, controllerRef, effectiveAddress, engineError, playSfx, resetSettlementFlow, showToast, startBlockedReason, startPending])

  /** 暂停当前局。 */
  const handlePause = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.pauseGame()
  }, [activateAudio, controllerRef, playSfx])

  /** 恢复暂停的对局。 */
  const handleResume = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.resumeGame()
  }, [activateAudio, controllerRef, playSfx])

  /** 主动撤离并进入结算。 */
  const handleRetreat = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.retreat()
  }, [activateAudio, controllerRef, playSfx])

  /** 快捷切换下一把武器。 */
  const handleToggleWeapon = useCallback(() => {
    activateAudio()
    playSfx('button')
    controllerRef.current?.toggleWeapon()
  }, [activateAudio, controllerRef, playSfx])

  /** 打开装备弹窗；若在运行中先请求暂停。 */
  const handleOpenEquipment = useCallback(() => {
    if (isSettlementOpen && isSettlementLocked) return
    if (gameState !== 'idle' && gameState !== 'paused' && gameState !== 'running') return
    activateAudio()
    playSfx('button')
    if (gameState === 'running') {
      controllerRef.current?.pauseGame()
    }
    setIsEquipmentOpen(true)
  }, [activateAudio, controllerRef, gameState, isSettlementLocked, isSettlementOpen, playSfx])

  /** 关闭装备弹窗。 */
  const handleCloseEquipment = useCallback(() => {
    activateAudio()
    playSfx('button')
    setIsEquipmentOpen(false)
  }, [activateAudio, playSfx])

  /** 在装备弹窗中切换指定武器。 */
  const handleEquipWeapon = useCallback((weapon: WeaponType) => {
    if (snapshot.activeWeapon === weapon) return
    if (weapon === 'bow' && !canToggleWeapon) return
    activateAudio()
    playSfx('button')
    controllerRef.current?.equipWeapon(weapon)
  }, [activateAudio, canToggleWeapon, controllerRef, playSfx, snapshot.activeWeapon])

  /** 购买霜翎逐月并在成功后立即装备，同时刷新链上资产缓存。 */
  const handlePurchaseBow = useCallback(async () => {
    if (!BRAVEMAN_ADDRESS || !hasContractAddress) {
      const message = '合约地址未配置，请先执行 make deploy'
      setPurchaseError(message)
      return
    }
    if (!effectiveConnected || !effectiveAddress) {
      connectWallet()
      return
    }
    if (!isCorrectChain) {
      await handleRepairNetwork()
      return
    }
    if (purchaseBowBlockedReason) {
      setPurchaseError(purchaseBowBlockedReason)
      return
    }
    setPurchasePending(true)
    setPurchaseError(null)
    try {
      activateAudio()
      playSfx('button')
      await sendContractAndConfirm({
        address: BRAVEMAN_ADDRESS,
        abi: BRAVEMAN_ABI,
        functionName: 'purchaseBow',
        args: [],
      })
      setOptimisticBowOwned(true)
      setSessionBowUnlocked(true)
      controllerRef.current?.unlockBowAndEquip()
      await invalidateChainData()
      playSfx('purchase')
      showToast({
        message: gameState === 'idle'
          ? '已永久解锁霜翎逐月，并切换为霜翎逐月'
          : '已永久解锁霜翎逐月，并装备到当前局',
        tone: 'success',
      })
    } catch (error) {
      const message = formatTxError(error)
      setPurchaseError(message)
      showToast({
        message,
        tone: 'error',
        persistent: true,
      })
    } finally {
      setPurchasePending(false)
    }
  }, [activateAudio, connectWallet, controllerRef, effectiveAddress, effectiveConnected, gameState, handleRepairNetwork, hasContractAddress, invalidateChainData, isCorrectChain, playSfx, purchaseBowBlockedReason, sendContractAndConfirm, showToast])

  /** 结算完成/放弃后将所有运行态状态重置回大厅。 */
  const handleReturnToIdle = useCallback(() => {
    if (submitStage !== 'success' && submitStage !== 'error') return
    controllerRef.current?.returnToIdle()
    setGameState('idle')
    setIsEquipmentOpen(false)
    setSnapshot(initialSnapshot)
    setCountdownValue(null)
    setSessionBowUnlocked(false)
    resetSettlementFlow()
  }, [controllerRef, resetSettlementFlow, submitStage])

  /** 关闭结算弹窗：处理中/自动返回阶段禁用；失败态关闭会回到待机。 */
  const handleCloseSettlement = useCallback(() => {
    if (isSettlementLocked || isSettlementAutoReturning || (isRecoveryMode && submitStage === 'idle')) return
    if (submitStage === 'error' && !isRecoveryMode) {
      handleReturnToIdle()
      return
    }
    closeSettlement()
  }, [closeSettlement, handleReturnToIdle, isRecoveryMode, isSettlementAutoReturning, isSettlementLocked, submitStage])

  /** 钱包面板点击处理：播放音效并执行连接/断开。 */
  const handleToggleConnect = useCallback(() => {
    playSfx('button')
    if (E2E_BYPASS_WALLET) return
    if (effectiveConnected) {
      if (disconnectLocked) return
      disconnect()
      return
    }
    connectWallet()
  }, [connectWallet, disconnect, disconnectLocked, effectiveConnected, playSfx])

  /** 将异步开始流程包装成可直接传入按钮的同步回调。 */
  const handleStartClick = useCallback(() => {
    void handleStart()
  }, [handleStart])

  /** 打开设置弹窗。 */
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), [])
  /** 打开历史弹窗。 */
  const handleOpenHistory = useCallback(() => setIsHistoryOpen(true), [])
  /** 关闭设置弹窗。 */
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), [])
  /** 关闭历史弹窗。 */
  const handleCloseHistory = useCallback(() => setIsHistoryOpen(false), [])

  /** 切换音乐开关。 */
  const handleToggleMusic = useCallback(
    () => setSettings((current) => ({ ...current, musicEnabled: !current.musicEnabled })),
    [],
  )
  /** 切换音效开关。 */
  const handleToggleSfx = useCallback(
    () => setSettings((current) => ({ ...current, sfxEnabled: !current.sfxEnabled })),
    [],
  )
  /** 选择触控模式。 */
  const handleSelectTouchMode = useCallback(
    (mode: SettingsModel['touchControlMode']) =>
      setSettings((current) => ({ ...current, touchControlMode: mode })),
    [],
  )

  /** 购买霜翎逐月按钮回调包装。 */
  const handlePurchaseBowClick = useCallback(() => {
    void handlePurchaseBow()
  }, [handlePurchaseBow])

  /** 结算重试按钮回调包装。 */
  const handleRetryClaimClick = useCallback(() => {
    void retrySettlement()
  }, [retrySettlement])

  /** 放弃恢复态结算：清缓存并关闭 recovery 弹窗。 */
  const handleDiscardRecoveryClick = useCallback(() => {
    discardRecoveredSettlement()
  }, [discardRecoveredSettlement])

  /** 关闭竖屏提示。 */
  const handleDismissPortraitHint = useCallback(
    () => setSettings((current) => ({ ...current, dismissPortraitHint: true })),
    [],
  )
  /** 关闭首次游玩提示。 */
  const handleDismissFirstRunHint = useCallback(
    () => setSettings((current) => ({ ...current, dismissFirstRunHint: true })),
    [],
  )

  /** 渲染舞台中央标题视觉层。 */
  const stageTitleContent = (compact: boolean) => (
    <div
      className={`relative flex flex-col items-center justify-center ${compact ? 'px-3 py-1' : 'px-4 py-1 sm:px-5 sm:py-1.5'}`}
      style={{ transform: `scale(${stageTitleVisual.scale})` }}
    >
      <h1
        className={`relative z-[1] text-center font-bold leading-[1.08] tracking-tight text-[var(--ink-900)] ${compact ? 'text-[1.32rem] sm:text-[1.56rem]' : 'text-[1.68rem] sm:text-[2.05rem]'}`}
        data-testid="stage-title-cn"
        style={{
          opacity: stageTitleVisual.titleOpacity,
          textShadow: '0 1px 0 rgba(255,255,255,0.68), 0 10px 20px rgba(16,16,16,0.08)',
        }}
      >
        战斗至死
      </h1>
      <p
        className={`relative z-[1] text-center font-semibold uppercase tracking-[0.14em] text-[var(--accent-vermilion)] ${compact ? 'mt-0.5 text-[0.52rem] sm:text-[0.64rem]' : 'mt-0.5 text-[0.62rem] sm:text-[0.82rem]'}`}
        data-testid="stage-title-en"
        style={{
          opacity: stageTitleVisual.subtitleOpacity,
          textShadow: '0 1px 0 rgba(255,255,255,0.34), 0 1px 8px rgba(181,57,34,0.08)',
        }}
      >
        BraveMan On-chain
      </p>
    </div>
  )

  /** 结算成功后自动延时返回大厅。 */
  useEffect(() => {
    if (!isSettlementAutoReturning) return
    const timer = window.setTimeout(() => {
      handleReturnToIdle()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [handleReturnToIdle, isSettlementAutoReturning])

  return (
    <div className="h-dvh overflow-hidden bg-[var(--field-chrome)] px-2 py-2 text-[var(--ink-900)] sm:px-3 sm:py-3">
      <ToastViewport onDismiss={dismissToast} toast={toast} />

      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] items-stretch justify-center">
        <main className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--field-chrome)] shadow-[0_20px_54px_rgba(0,0,0,0.12)]">
          <div className="min-h-0 flex-1">
            <section
              className={`relative overflow-hidden ${isDesktop ? 'h-full min-h-0' : ''}`}
              data-testid="stage-shell"
              ref={stageShellRef}
              style={isDesktop ? undefined : { height: `${mobileCanvasHeight}px` }}
            >
              <GameCanvas
                onBootErrorChange={(message) => {
                  // 引擎启动错误同时写入状态与 toast，确保遮罩文案和顶部提示保持一致。
                  setEngineError(message)
                  if (message) {
                    showToast({
                      message,
                      tone: 'error',
                      persistent: true,
                    })
                  }
                }}
                onControllerReady={bindController}
              />
              <div
                className={`pointer-events-none absolute left-1/2 top-1.5 z-[14] -translate-x-1/2 ${isDesktop ? 'w-[calc(100%-14rem)] max-w-[24rem] sm:top-2' : 'w-[calc(100%-3rem)] max-w-[22rem] sm:top-2 sm:w-[calc(100%-21rem)] sm:max-w-[26rem]'}`}
                data-testid="stage-title"
                style={{ opacity: stageTitleVisual.shellOpacity }}
              >
                {stageTitleContent(false)}
              </div>
              <GameHud
                activeWeapon={snapshot.activeWeapon}
                bowUnlocked={bowOwned || sessionBowUnlocked}
                style={isDesktop ? { top: `${desktopRightRailTop}px` } : undefined}
                kills={snapshot.kills}
                runGold={snapshot.goldEarned}
              />
              {isDesktop ? (
                <>
                  <div className="pointer-events-auto absolute right-1 top-1.5 z-30 sm:right-1.5 sm:top-1.5">
                    <WalletPanel
                      bypassMode={E2E_BYPASS_WALLET}
                      chainId={effectiveChainId}
                      className="w-[9.9rem]"
                      displayAddress={shortAddress(effectiveAddress)}
                      disconnectLocked={disconnectLocked}
                      disconnectLockReason={disconnectLockReason}
                      isConnected={effectiveConnected}
                      isConnecting={isConnecting}
                      isCorrectChain={isCorrectChain}
                      isSwitchingChain={isSwitchingChain}
                      layout="minimal"
                      onRepairNetwork={handleRepairNetwork}
                      onToggleConnect={handleToggleConnect}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute right-0 z-30 flex w-10 flex-col items-end gap-2 overflow-visible"
                    data-testid="stage-right-rail"
                    style={{ top: `${desktopRightRailTop}px` }}
                  >
                    <RailActionButton
                      aria-label="装备"
                      className="pointer-events-auto"
                      data-testid="open-equipment"
                      disabled={!canOpenEquipment}
                      icon={<EquipmentIcon className="h-4.5 w-4.5" />}
                      iconTestId="open-equipment-icon"
                      label="装备"
                      layout="icon-rail"
                      onClick={handleOpenEquipment}
                      size="sm"
                      title="装备"
                      tone="secondary"
                    />
                    <DesktopFloatingControls
                      className="pointer-events-auto"
                      gameState={gameState}
                      startPending={startPending}
                      startBlockedReason={startBlockedReason}
                      onStart={handleStartClick}
                      onPause={handlePause}
                      onResume={handleResume}
                      onRetreat={handleRetreat}
                      onOpenSettings={handleOpenSettings}
                      onOpenHistory={handleOpenHistory}
                    />
                  </div>
                </>
              ) : (
                <div
                  className="absolute right-3 top-3 z-30 flex w-[10.75rem] flex-col items-stretch gap-2.5 sm:right-4 sm:top-4 sm:w-[11.5rem]"
                  data-testid="stage-right-rail"
                >
                  <WalletPanel
                    isConnected={effectiveConnected}
                    isCorrectChain={isCorrectChain}
                    chainId={effectiveChainId}
                    displayAddress={shortAddress(effectiveAddress)}
                    isConnecting={isConnecting}
                    isSwitchingChain={isSwitchingChain}
                    bypassMode={E2E_BYPASS_WALLET}
                    disconnectLocked={disconnectLocked}
                    disconnectLockReason={disconnectLockReason}
                    className="w-full"
                    onRepairNetwork={handleRepairNetwork}
                    onToggleConnect={handleToggleConnect}
                  />
                  <RailActionButton
                    aria-label="装备"
                    className="w-full pr-3.5"
                    data-testid="open-equipment"
                    disabled={!canOpenEquipment}
                    icon={<EquipmentIcon className="h-4.5 w-4.5" />}
                    iconTestId="open-equipment-icon"
                    label="装备"
                    onClick={handleOpenEquipment}
                    title="装备"
                    tone="secondary"
                  />
                </div>
              )}
              {overlayText ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[rgba(16,16,16,0.16)] backdrop-blur-[2px]">
                  <p className={`${parchmentPanelClass} rounded-[1.25rem] px-5 py-3 text-sm font-semibold text-[var(--ink-900)] shadow-black/15 sm:text-base`}>{overlayText}</p>
                </div>
              ) : null}
              {gameState === 'countdown' && countdownValue !== null ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[rgba(16,16,16,0.12)]">
                  <div className={`${parchmentBadgeClass} h-20 w-20 justify-center rounded-[1.75rem] border-[var(--ui-panel-border-strong)] text-4xl font-bold text-[var(--ink-900)] shadow-lg shadow-black/15 sm:h-24 sm:w-24`}>{countdownValue}</div>
                </div>
              ) : null}
            </section>
          </div>

          {!isDesktop ? (
            <GameControls
              gameState={gameState}
              startPending={startPending}
              startBlockedReason={startBlockedReason}
              onStart={handleStartClick}
              onPause={handlePause}
              onResume={handleResume}
              onRetreat={handleRetreat}
              onOpenSettings={handleOpenSettings}
              onOpenHistory={handleOpenHistory}
            />
          ) : null}

          {!isDesktop ? (
            // 触屏输入直接透传给 Phaser 控制器，避免 React 层再维护一份移动状态。
            <TouchControls
              touchControlMode={settings.touchControlMode}
              gameState={gameState}
              onMove={(x, y) => controllerRef.current?.setMovement(x, y, 'touch')}
              onStop={() => controllerRef.current?.setMovement(0, 0, 'touch')}
              onToggleWeapon={handleToggleWeapon}
              onPauseResume={gameState === 'running' ? handlePause : handleResume}
            />
          ) : null}

          <footer
            className="relative isolate shrink-0 overflow-hidden border-t border-[var(--line-soft)] bg-[var(--field-chrome)] px-4 py-2.5 sm:px-5"
            data-testid="game-footer"
          >
            {footerOverlayTone ? (
              <div
                className={`pointer-events-none absolute inset-0 z-[1] ${footerOverlayTone}`}
                data-testid="game-footer-mask"
              />
            ) : null}
            <div className="relative z-[2] flex w-full items-center justify-center gap-2 text-[10px] text-[var(--ink-500)] sm:gap-3 sm:text-[11px]">
              <span aria-hidden="true" className="h-px w-8 bg-[var(--line-soft)] sm:w-12" />
              <div className="flex items-center gap-2 whitespace-nowrap tracking-[0.14em]">
                <span>{BRAVEMAN_COPYRIGHT} • {BRAVEMAN_PROJECT_NAME}</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
                <a
                  aria-label="访问战斗至死 GitHub 仓库"
                  className="inline-flex items-center gap-1 rounded-sm text-[var(--ink-700)] transition hover:text-[var(--accent-vermilion)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--field-chrome)]"
                  data-testid="game-footer-github"
                  href={BRAVEMAN_REPOSITORY_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  <GitHubIcon className="h-3.5 w-3.5" data-testid="footer-github-icon" />
                  <span>GitHub</span>
                </a>
              </div>
              <span aria-hidden="true" className="h-px w-8 bg-[var(--line-soft)] sm:w-12" />
            </div>
          </footer>
        </main>
      </div>

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          settings={settings}
          onClose={handleCloseSettings}
          onToggleMusic={handleToggleMusic}
          onToggleSfx={handleToggleSfx}
          onSelectTouchMode={handleSelectTouchMode}
        />
      </Suspense>

      <Suspense fallback={null}>
        <HistoryModal
          isOpen={isHistoryOpen}
          connected={effectiveConnected}
          hasContractAddress={hasContractAddress}
          entries={historyQueryState.entries}
          isLoading={historyQueryState.isLoading}
          isError={historyQueryState.isError}
          isLoadingMore={historyQueryState.isLoadingMore}
          hasMore={historyQueryState.hasMore}
          total={historyQueryState.total}
          onClose={handleCloseHistory}
          onLoadMore={historyQueryState.loadMore}
          onRetry={historyQueryState.retry}
        />
      </Suspense>

      <Suspense fallback={null}>
        <EquipmentModal
          isOpen={isEquipmentOpen}
          gameState={gameState}
          chainGold={chainGold}
          runGold={snapshot.goldEarned}
          activeWeapon={snapshot.activeWeapon}
          bowOwned={bowOwned}
          canToggleWeapon={canToggleWeapon}
          purchasePending={purchasePending}
          purchaseError={purchaseError}
          canPurchaseBow={canPurchaseBow}
          purchaseBowBlockedReason={purchaseBowBlockedReason}
          onClose={handleCloseEquipment}
          onPurchaseBow={handlePurchaseBowClick}
          onEquipWeapon={handleEquipWeapon}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SettlementModal
          isOpen={isSettlementOpen}
          sessionStats={sessionStats}
          submitStage={submitStage}
          submitStatusText={submitStatusText}
          submitError={submitError}
          txHash={txHash}
          isLocked={isSettlementLocked}
          autoReturning={isSettlementAutoReturning}
          canRetry={canRetry}
          isRecoveryMode={isRecoveryMode}
          onClose={handleCloseSettlement}
          onDiscardRecovery={handleDiscardRecoveryClick}
          onRetry={handleRetryClaimClick}
          shortAddress={shortAddress}
        />
      </Suspense>

      {isPortrait && !settings.dismissPortraitHint ? (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-6 text-center backdrop-blur-sm">
          <div className={`${parchmentPanelClass} pointer-events-auto max-w-sm rounded-[1.6rem] px-5 py-4 text-[var(--ink-900)] shadow-xl shadow-black/20`}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-left">
                <p className="text-[10px] font-semibold tracking-[0.24em] text-[var(--ink-500)]">游玩建议</p>
                <p className="mt-1 text-lg font-semibold">建议横屏体验</p>
              </div>
              <button aria-label="关闭提示" className={`${buttonSecondaryClass} ${buttonSizeXsClass} h-10 w-10 p-0 text-base font-bold leading-none`} onClick={handleDismissPortraitHint} type="button">x</button>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-700)]">横屏下视野更完整，更容易看清左右刷怪节奏，也更方便打开右上角装备页。</p>
          </div>
        </div>
      ) : null}

      {!settings.dismissFirstRunHint ? (
        <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center bg-black/25 px-6 text-center backdrop-blur-sm">
          <div className={`${parchmentPanelClass} pointer-events-auto max-w-md rounded-[1.6rem] px-5 py-4 text-[var(--ink-900)] shadow-xl shadow-black/20`}>
            <p className="text-[10px] font-semibold tracking-[0.24em] text-[var(--ink-500)]">新手提示</p>
            <p className="mt-1 text-lg font-semibold">战斗至死 新手提示</p>
            <p className="mt-2 text-sm text-[var(--ink-700)]">移动角色，避免与怪物接触；系统会自动攻击当前武器范围内最近的怪物。右上角可打开装备页，`J` 可循环切换玄火镇岳、金钩裂甲与霜翎逐月，`空格` 可暂停/继续游戏。阵亡或选择结算离场后，系统会复盘本局战绩并结算链上金币。</p>
            <div className="mt-3 flex justify-end">
              <button className={`${buttonSecondaryClass} ${buttonSizeXsClass}`} onClick={handleDismissFirstRunHint} type="button">开始体验</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
