import { useCallback, useEffect, useRef, useState } from 'react'
import type { WalletClient } from 'viem'
import { AngryBirdsBridge } from '../game/bridge'
import type { GameplayStartRequest } from '../game/types'
import type { SubmitStage } from './useAngryBirdsSubmissionFlow'

type UseGameplayStartGuardOptions = {
  bridge: AngryBirdsBridge
  walletClient: WalletClient | undefined
  isWalletConnected: boolean
  isConnecting: boolean
  connectWallet: () => void
  ensureSessionReadyForGameplay: () => Promise<unknown>
  queuedRuns: number
  submitStage: SubmitStage
}

// 守护“开始游戏”流程：确保钱包与会话准备完成后再真正切场景。
export const useGameplayStartGuard = ({
  bridge,
  walletClient,
  isWalletConnected,
  isConnecting,
  connectWallet,
  ensureSessionReadyForGameplay,
  queuedRuns,
  submitStage,
}: UseGameplayStartGuardOptions) => {
  const startGuardInFlightRef = useRef(false)
  const [pendingStartRequest, setPendingStartRequest] = useState<GameplayStartRequest | null>(null)
  const [hasRequestedStartConnection, setHasRequestedStartConnection] = useState(false)

  // 根据请求模式分发到对应的桥接启动动作。
  const performGameplayStart = useCallback(
    (request: GameplayStartRequest) => {
      switch (request.mode) {
        case 'home':
          bridge.startResumeLevel()
          return
        case 'next':
          bridge.startNextLevel()
          return
        case 'retry':
          bridge.restartLevel()
          return
        case 'level':
          if (request.levelId) {
            bridge.startLevel(request.levelId)
          }
      }
    },
    [bridge],
  )

  // 处理待执行的开始请求：必要时先连钱包，再校验会话，最后放行开始游戏。
  const processPendingGameplayStart = useCallback(async () => {
    if (!pendingStartRequest || startGuardInFlightRef.current) {
      return
    }

    if (submitStage === 'finalizing' && queuedRuns > 0) {
      return
    }

    if (!walletClient?.account) {
      if (!hasRequestedStartConnection && !isWalletConnected && !isConnecting) {
        setHasRequestedStartConnection(true)
        connectWallet()
      }
      return
    }

    startGuardInFlightRef.current = true
    try {
      await ensureSessionReadyForGameplay()
      performGameplayStart(pendingStartRequest)
      setPendingStartRequest(null)
      setHasRequestedStartConnection(false)
    } catch {
      setPendingStartRequest(null)
      setHasRequestedStartConnection(false)
    } finally {
      startGuardInFlightRef.current = false
    }
  }, [
    connectWallet,
    ensureSessionReadyForGameplay,
    hasRequestedStartConnection,
    isConnecting,
    isWalletConnected,
    pendingStartRequest,
    performGameplayStart,
    queuedRuns,
    submitStage,
    walletClient,
  ])

  // 一旦有挂起请求，立即尝试推进启动流程。
  useEffect(() => {
    if (!pendingStartRequest) {
      return
    }

    void processPendingGameplayStart()
  }, [pendingStartRequest, processPendingGameplayStart])

  // 对外暴露统一入口，把请求写入待处理队列。
  const requestGameplayStart = useCallback((request: GameplayStartRequest) => {
    setPendingStartRequest(request)
    setHasRequestedStartConnection(false)
  }, [])

  return {
    requestGameplayStart,
  }
}
