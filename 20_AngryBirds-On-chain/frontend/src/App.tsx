import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi'
import { GameCanvas } from './components/GameCanvas'
import { AngryBirdsBridge } from './game/bridge'
import { decorateChainPanelState } from './lib/chainPanel'
import { useBridgeBindings } from './hooks/useBridgeBindings'
import { useGameShellController } from './hooks/useGameShellController'
import { useGameplayStartGuard } from './hooks/useGameplayStartGuard'
import { useAngryBirdsSubmissionFlow } from './hooks/useAngryBirdsSubmissionFlow'
import { E2E_BYPASS_WALLET, getE2EWalletAddress, getE2EWalletClient } from './lib/e2eWallet'
import { fetchLatestRuntimeConfig, getResolvedRuntimeConfig } from './lib/runtime-config'

const App = () => {
  const runtimeConfig = getResolvedRuntimeConfig()
  const [bridge] = useState(() => new AngryBirdsBridge())
  const [session, setSession] = useState(() => bridge.getSession())

  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient()

  const e2eWalletClient = getE2EWalletClient()
  const effectiveWalletClient = walletClient ?? e2eWalletClient ?? undefined
  const effectiveAddress = address ?? getE2EWalletAddress()
  const isWalletConnected = isConnected || Boolean(e2eWalletClient)
  const connector = connectors[0]

  const connectWallet = useCallback(() => {
    if (E2E_BYPASS_WALLET) {
      return
    }
    if (connector) {
      connect({ connector })
    }
  }, [connect, connector])

  const disconnectWallet = useCallback(() => {
    if (E2E_BYPASS_WALLET) {
      return
    }
    disconnect()
  }, [disconnect])

  const {
    settings,
    updateGameSettings,
    persistSettings,
    progress,
    updateProgress,
    persistProgress,
    runSyncScope,
    chainQueries,
    mergedLevels,
    selectedLevel,
    lastPlayedLevelId,
    chainPanelState,
  } = useGameShellController({
    runtimeConfig,
    effectiveAddress,
    currentLevelId: session.currentLevelId,
  })

  const {
    latestSummary,
    summary: submissionSummary,
    submitStage,
    lastStatus,
    submitError,
    requiresSessionRenewal,
    txHash,
    isRecoveryMode,
    canSubmit,
    queuedRuns,
    activeSession,
    acceptSummary,
    clearSubmission,
    ensureSessionReadyForGameplay,
    submitRun,
    finalizeQueuedRuns,
  } = useAngryBirdsSubmissionFlow({
    refreshAfterConfirmedRun: chainQueries.refreshAfterConfirmedRun,
    selectedLevel,
    syncScope: runSyncScope,
    walletClient: effectiveWalletClient,
  })

  const effectiveChainPanelState = useMemo(
    () =>
      decorateChainPanelState({
        baseState: chainPanelState,
        levels: mergedLevels,
        latestSummary,
        submitStage,
        forceChainReadActive: chainQueries.forceChainReadActive,
      }),
    [chainPanelState, chainQueries.forceChainReadActive, latestSummary, mergedLevels, submitStage],
  )

  const { requestGameplayStart } = useGameplayStartGuard({
    bridge,
    walletClient: effectiveWalletClient,
    isWalletConnected,
    isConnecting,
    connectWallet,
    ensureSessionReadyForGameplay,
    queuedRuns,
    submitStage,
  })

  useBridgeBindings({
    bridge,
    setSession,
    currentScene: session.scene,
    mergedLevels,
    progress,
    lastPlayedLevelId,
    settings,
    effectiveAddress,
    isWalletConnected,
    isConnecting,
    connectorAvailable: Boolean(connector),
    connectWallet,
    disconnectWallet,
    requestGameplayStart,
    updateGameSettings,
    updateProgress,
    clearSubmission,
    acceptSummary,
    refreshLeaderboard: chainQueries.refreshLeaderboard,
    refreshHistory: chainQueries.refreshHistory,
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
    chainPanelState: effectiveChainPanelState,
  })

  useEffect(() => {
    persistSettings()
  }, [persistSettings])

  useEffect(() => {
    persistProgress()
  }, [persistProgress])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    let cancelled = false
    let reloading = false

    const checkRuntimeConfigDrift = async () => {
      const latestRuntimeConfig = await fetchLatestRuntimeConfig()
      if (!latestRuntimeConfig || cancelled || reloading) {
        return
      }

      const hasDrift =
        latestRuntimeConfig.chainId !== runtimeConfig.chainId ||
        latestRuntimeConfig.deploymentId !== runtimeConfig.deploymentId ||
        latestRuntimeConfig.apiBaseUrl !== runtimeConfig.apiBaseUrl ||
        latestRuntimeConfig.angryBirdsLevelCatalogAddress !== runtimeConfig.angryBirdsLevelCatalogAddress ||
        latestRuntimeConfig.angryBirdsScoreboardAddress !== runtimeConfig.angryBirdsScoreboardAddress

      if (hasDrift) {
        reloading = true
        window.location.reload()
      }
    }

    const timer = window.setInterval(() => {
      void checkRuntimeConfigDrift()
    }, 3_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [runtimeConfig])

  return (
    <div className="app-shell">
      <GameCanvas bridge={bridge} />
    </div>
  )
}

export default App
