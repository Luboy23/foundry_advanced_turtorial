import { useEffect, useRef } from 'react'
import { AngryBirdsBridge } from '../game/bridge'
import type {
  ChainPanelState,
  GameplayStartRequest,
  LevelCatalogEntry,
  OverlayRoute,
  ProgressSnapshot,
  SessionState,
  SettingsState,
  SubmissionStage,
} from '../game/types'
import { markLevelCleared } from '../features/progress/localStore'
import { E2E_BYPASS_WALLET } from '../lib/e2eWallet'
import { shortAddress } from '../lib/contract'

// 仅在开发/测试环境暴露 debug bridge，避免生产环境暴露调试入口。
export const shouldExposeDebugBridge = (
  env: Pick<ImportMetaEnv, 'DEV' | 'MODE'> = import.meta.env,
) => env.DEV || env.MODE === 'test'

type AngryBirdsDebugSnapshot = {
  session: ReturnType<AngryBirdsBridge['getSession']>
  progress: ReturnType<AngryBirdsBridge['getProgress']>
  wallet: ReturnType<AngryBirdsBridge['getWalletState']>
  submission: ReturnType<AngryBirdsBridge['getSubmissionState']>
  ui: ReturnType<AngryBirdsBridge['getUiState']>
  chain: ReturnType<AngryBirdsBridge['getChainPanelState']>
}

type AngryBirdsDebugBridge = {
  startLevel: (levelId: string) => void
  forceWin: (levelId?: string | null) => void
  submitPending: () => void
  submitCurrentResult: () => void
  goToHome: () => void
  goToTitle: () => void
  openMenu: (tab: 'leaderboard' | 'history' | 'wallet' | 'settings', route?: OverlayRoute | null) => void
  getSession: () => ReturnType<AngryBirdsBridge['getSession']>
  getProgress: () => ReturnType<AngryBirdsBridge['getProgress']>
  getUiState: () => ReturnType<AngryBirdsBridge['getUiState']>
  getSnapshot: () => AngryBirdsDebugSnapshot
}

type UseBridgeBindingsOptions = {
  bridge: AngryBirdsBridge
  setSession: (session: SessionState) => void
  currentScene: SessionState['scene']
  mergedLevels: LevelCatalogEntry[]
  progress: ProgressSnapshot
  lastPlayedLevelId: string | null
  settings: SettingsState
  effectiveAddress?: `0x${string}`
  isWalletConnected: boolean
  isConnecting: boolean
  connectorAvailable: boolean
  connectWallet: () => void
  disconnectWallet: () => void
  requestGameplayStart: (request: GameplayStartRequest) => void
  updateGameSettings: (patch: Partial<SettingsState>) => void
  updateProgress: (nextProgress: ProgressSnapshot | ((current: ProgressSnapshot) => ProgressSnapshot)) => void
  clearSubmission: () => void
  acceptSummary: (summary: ReturnType<AngryBirdsBridge['getSession']>['runSummary']) => void
  refreshLeaderboard: () => Promise<unknown>
  refreshHistory: () => Promise<unknown>
  submitRun: (summary?: ReturnType<AngryBirdsBridge['getSession']>['runSummary']) => Promise<void>
  finalizeQueuedRuns: () => Promise<boolean>
  queuedRuns: number
  submitStage: SubmissionStage
  lastStatus: string | null
  canSubmit: boolean
  submitError: string | null
  requiresSessionRenewal: boolean
  txHash: `0x${string}` | null
  isRecoveryMode: boolean
  submissionSummary: ReturnType<AngryBirdsBridge['getSession']>['runSummary']
  activeSession: ReturnType<AngryBirdsBridge['getSubmissionState']>['activeSession']
  chainPanelState: ChainPanelState
}

// 绑定 UI 层与游戏桥接层事件，统一同步钱包、提交流程、菜单与进度状态。
export const useBridgeBindings = ({
  bridge,
  setSession,
  currentScene,
  mergedLevels,
  progress,
  lastPlayedLevelId,
  settings,
  effectiveAddress,
  isWalletConnected,
  isConnecting,
  connectorAvailable,
  connectWallet,
  disconnectWallet,
  requestGameplayStart,
  updateGameSettings,
  updateProgress,
  clearSubmission,
  acceptSummary,
  refreshLeaderboard,
  refreshHistory,
  submitRun,
  finalizeQueuedRuns,
  queuedRuns,
  submitStage,
  lastStatus,
  canSubmit,
  submitError,
  requiresSessionRenewal,
  txHash,
  isRecoveryMode,
  submissionSummary,
  activeSession,
  chainPanelState,
}: UseBridgeBindingsOptions) => {
  const levelsRef = useRef<LevelCatalogEntry[]>(mergedLevels)

  // 保持最新关卡引用，供异步事件回调读取。
  useEffect(() => {
    levelsRef.current = mergedLevels
  }, [mergedLevels])

  useEffect(() => {
    const unsubscribe = bridge.on('session:changed', setSession)
    return () => unsubscribe()
  }, [bridge, setSession])

  useEffect(() => {
    const unsubscribe = bridge.on('run:finished', (summary) => {
      // 未通关时清空提交状态，避免失败局进入同步流程。
      if (!summary.cleared) {
        clearSubmission()
        return
      }

      const level = levelsRef.current.find((candidate) => candidate.levelId === summary.levelId)
      if (!level) {
        return
      }

      const nextProgress = markLevelCleared(bridge.getProgress(), level)
      bridge.updateProgress(nextProgress, {
        lastPlayedLevelId: summary.levelId,
      })
      updateProgress((current) => markLevelCleared(current, level))
      acceptSummary(summary)
      void submitRun(summary)
    })

    return () => unsubscribe()
  }, [acceptSummary, bridge, clearSubmission, submitRun, updateProgress])

  useEffect(() => {
    const unsubscribe = bridge.on('submission:submit-request', (summary) => {
      if (summary) {
        acceptSummary(summary)
      }
      void submitRun()
    })

    return () => unsubscribe()
  }, [acceptSummary, bridge, submitRun])

  useEffect(() => {
    const unsubscribe = bridge.on('submission:clear-request', () => {
      clearSubmission()
    })

    return () => unsubscribe()
  }, [bridge, clearSubmission])

  useEffect(() => {
    const unsubscribe = bridge.on('menu:open-request', ({ route, tab }) => {
      if (route !== 'home-menu' && route !== 'pause-menu') {
        return
      }
      if (tab === 'leaderboard') {
        void refreshLeaderboard()
      }
      if (tab === 'history') {
        void refreshHistory()
      }
    })

    return () => unsubscribe()
  }, [bridge, refreshHistory, refreshLeaderboard])

  useEffect(() => {
    const unsubscribeConnect = bridge.on('wallet:connect-request', () => {
      connectWallet()
    })
    const unsubscribeDisconnect = bridge.on('wallet:disconnect-request', () => {
      disconnectWallet()
    })
    const unsubscribeGameplayStart = bridge.on('gameplay:start-request', (request) => {
      requestGameplayStart(request)
    })

    return () => {
      unsubscribeConnect()
      unsubscribeDisconnect()
      unsubscribeGameplayStart()
    }
  }, [bridge, connectWallet, disconnectWallet, requestGameplayStart])

  useEffect(() => {
    const unsubscribe = bridge.on('settings:update-request', (patch) => {
      updateGameSettings(patch)
    })

    return () => unsubscribe()
  }, [bridge, updateGameSettings])

  useEffect(() => {
    bridge.updateProgress(progress, {
      lastPlayedLevelId,
    })
  }, [bridge, lastPlayedLevelId, progress])

  useEffect(() => {
    bridge.setLevels(mergedLevels)
  }, [bridge, mergedLevels])

  useEffect(() => {
    bridge.updateSettings(settings)
  }, [bridge, settings])

  useEffect(() => {
    const walletLabel =
      E2E_BYPASS_WALLET && effectiveAddress
        ? `E2E 钱包 ${shortAddress(effectiveAddress)}`
        : isWalletConnected
          ? shortAddress(effectiveAddress)
          : isConnecting
            ? '连接中…'
            : connectorAvailable
              ? '钱包未连接'
              : '未检测到钱包'

    bridge.updateWalletState({
      isConnected: isWalletConnected,
      isConnecting: !E2E_BYPASS_WALLET && isConnecting,
      address: effectiveAddress,
      label: walletLabel,
      mode: E2E_BYPASS_WALLET ? 'e2e' : isWalletConnected ? 'wallet' : 'disconnected',
    })
  }, [bridge, connectorAvailable, effectiveAddress, isConnecting, isWalletConnected])

  useEffect(() => {
    bridge.updateSubmissionState({
      status: submitStage,
      lastStatus,
      canSubmit,
      error: submitError,
      requiresSessionRenewal,
      txHash,
      isRecoveryMode,
      summary: submissionSummary,
      queuedRuns,
      activeSession,
    })
  }, [
    activeSession,
    bridge,
    canSubmit,
    isRecoveryMode,
    lastStatus,
    queuedRuns,
    requiresSessionRenewal,
    submitError,
    submissionSummary,
    submitStage,
    txHash,
  ])

  useEffect(() => {
    // 标题页存在待上链队列时，自动尝试 finalize。
    if (currentScene !== 'title' || queuedRuns === 0 || submitStage === 'finalizing') {
      return
    }

    void finalizeQueuedRuns()
  }, [currentScene, finalizeQueuedRuns, queuedRuns, submitStage])

  useEffect(() => {
    // 钱包断开但仍有待上链队列时，继续触发 finalize 恢复流程。
    if (isWalletConnected || queuedRuns === 0 || submitStage === 'finalizing') {
      return
    }

    void finalizeQueuedRuns()
  }, [finalizeQueuedRuns, isWalletConnected, queuedRuns, submitStage])

  useEffect(() => {
    bridge.updateChainPanelState(chainPanelState)
  }, [bridge, chainPanelState])

  useEffect(() => {
    const debugWindow = window as Window & { __ANGRY_BIRDS_DEBUG__?: AngryBirdsDebugBridge }

    if (!shouldExposeDebugBridge()) {
      delete debugWindow.__ANGRY_BIRDS_DEBUG__
      return
    }

    // 注入调试对象，便于 E2E/手工调试直接触发关键操作。
    debugWindow.__ANGRY_BIRDS_DEBUG__ = {
      startLevel: (levelId) => bridge.startLevel(levelId),
      forceWin: (levelId) => bridge.requestForceWin(levelId),
      submitPending: () => {
        void submitRun()
      },
      submitCurrentResult: () => {
        const summary = bridge.getSession().runSummary ?? submissionSummary
        if (summary) {
          bridge.requestSubmit(summary)
        }
      },
      goToHome: () => bridge.returnHome(),
      goToTitle: () => bridge.returnToTitle(),
      openMenu: (tab, route = null) => bridge.requestOpenMenu(tab, route),
      getSession: () => bridge.getSession(),
      getProgress: () => bridge.getProgress(),
      getUiState: () => bridge.getUiState(),
      getSnapshot: () => ({
        session: bridge.getSession(),
        progress: bridge.getProgress(),
        wallet: bridge.getWalletState(),
        submission: bridge.getSubmissionState(),
        ui: bridge.getUiState(),
        chain: bridge.getChainPanelState(),
      }),
    }

    return () => {
      delete debugWindow.__ANGRY_BIRDS_DEBUG__
    }
  }, [bridge, submissionSummary, submitRun])
}
