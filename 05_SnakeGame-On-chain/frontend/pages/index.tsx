import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import useInterval from '@use-it/interval'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { UserRejectedRequestError } from 'viem'

import { HeadComponent as Head } from 'components/Head'
import WalletStatus from 'components/WalletStatus'
import { useSnakeAudio } from 'hooks/useSnakeAudio'
import {
  formatAddress,
  formatDuration,
  formatRelativeTime,
  formatTxHash,
} from 'lib/format'
import scoreboardAbi from 'lib/scoreboard.abi.json'
import {
  checkContractReady,
  fetchGlobalTop,
  fetchUserRecent,
  resolveScoreboardAddress,
} from 'lib/scoreboardClient'
import {
  loadRuntimeConfig,
  type RuntimeScoreboardConfig,
} from 'lib/scoreboardRuntime'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type Apple = {
  x: number
  y: number
}

type Velocity = {
  dx: number
  dy: number
}

type GlobalEntry = {
  player: string
  score: bigint
  durationSec: bigint
  speedPeak: bigint
  timestamp: bigint
}

type UserEntry = {
  score: bigint
  durationSec: bigint
  speedPeak: bigint
  timestamp: bigint
}

type SubmitPayload = {
  score: number
  durationSec: number
  speedPeak: number
}

type SubmitStatus =
  | 'idle'
  | 'needs-wallet'
  | 'signing'
  | 'pending'
  | 'success'
  | 'error'
  | 'rejected'

// 贪吃蛇主页面：游戏逻辑 + 上链交互 + UI
export default function SnakeGame() {
  // 画布设置
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasWidth = 640
  const canvasHeight = 480
  const canvasGridSize = 20

  const snakeFillColor = '#f43f5e'
  const snakeStrokeColor = '#be123c'
  const appleFillColor = '#f59e0b'
  const appleStrokeColor = '#d97706'

  // 游戏设置
  const minGameSpeed = 10
  const maxGameSpeed = 15

  const scoreboardAddressFallback = resolveScoreboardAddress()
  const [scoreboardConfig, setScoreboardConfig] =
    useState<RuntimeScoreboardConfig>({
      source: 'fallback',
    })
  const effectiveScoreboardAddress =
    scoreboardConfig.address ?? scoreboardAddressFallback
  const hasScoreboardAddress = Boolean(effectiveScoreboardAddress)
  const scoreboardAddressValue = (effectiveScoreboardAddress ??
    ZERO_ADDRESS) as `0x${string}`

  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const {
    connect,
    connectors,
    isPending: isConnecting,
    error: connectError,
  } = useConnect()
  const { disconnect } = useDisconnect()
  // 写交易：提交成绩到链上
  const { writeContractAsync } = useWriteContract()

  // 游戏状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [speedPeak, setSpeedPeak] = useState(minGameSpeed)
  const [gameDelay, setGameDelay] = useState<number>(1000 / minGameSpeed)
  const [targetDelay, setTargetDelay] = useState<number>(1000 / minGameSpeed)
  const [countDown, setCountDown] = useState<number>(4)
  const [running, setRunning] = useState(false)
  const [isLost, setIsLost] = useState(false)
  const [score, setScore] = useState(0)
  const [submitStatus, setSubmitStatus] =
    useState<SubmitStatus>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitPayload, setSubmitPayload] =
    useState<SubmitPayload | null>(null)
  const [submitHash, setSubmitHash] = useState<`0x${string}` | null>(
    null
  )
  const [copiedHash, setCopiedHash] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isWalletGateActive, setIsWalletGateActive] = useState(false)
  const [isResumePromptActive, setIsResumePromptActive] = useState(false)
  const [snake, setSnake] = useState<{
    head: { x: number; y: number }
    trail: Array<any>
  }>({
    head: { x: 12, y: 9 },
    trail: [],
  })
  const [apple, setApple] = useState<Apple>({ x: -1, y: -1 })
  const [velocity, setVelocity] = useState<Velocity>({ dx: 0, dy: 0 })
  const [previousVelocity, setPreviousVelocity] = useState<Velocity>({
    dx: 0,
    dy: 0,
  })
  const gameOverPlayedRef = useRef(false)
  const autoSubmitRef = useRef(false)
  const pauseBeforeGateRef = useRef(false)
  const overlayPausedRef = useRef(false)

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
  } = useWaitForTransactionReceipt({
    hash: submitHash ?? undefined,
    query: { enabled: Boolean(submitHash) },
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setCopiedHash(false)
  }, [submitHash])

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === 'injected'),
    [connectors]
  )

  const hasProvider =
    mounted &&
    typeof window !== 'undefined' &&
    Boolean((window as Window & { ethereum?: unknown }).ethereum)
  const isCorrectChain = chainId === 31337
  const isWalletReady = mounted && isConnected && isCorrectChain

  // 钱包门禁提示文案
  const walletGateMessage = useMemo(() => {
    if (!mounted) return '请先连接钱包后开始'
    if (!hasProvider) return '未检测到钱包，请安装或启用'
    if (!isConnected) return '请先连接钱包后开始'
    if (!isCorrectChain) return '请切换到 Anvil (31337)'
    return ''
  }, [hasProvider, isConnected, isCorrectChain, mounted])

  const {
    musicEnabled,
    setMusicEnabled,
    sfxEnabled,
    setSfxEnabled,
    playSfx,
    handleUserInteraction,
  } = useSnakeAudio({
    running,
    isPaused,
    isLost,
    countDown,
  })

  const [globalEntries, setGlobalEntries] = useState<GlobalEntry[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const [userEntries, setUserEntries] = useState<UserEntry[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const isCountdownActive = countDown > 0 && countDown < 4
  const isBoardIdle = !running && !isLost
  const isBoardPaused =
    running && isPaused && !isCountdownActive && !isLost

  // 暂停/恢复游戏（包含倒计时恢复逻辑）
  const togglePause = useCallback(() => {
    if (!running || isLost || countDown > 0) return
    handleUserInteraction()
    if (isPaused) {
      setIsPaused(false)
      setCountDown(3)
    } else {
      setIsPaused(true)
    }
    playSfx('toggle')
  }, [
    countDown,
    handleUserInteraction,
    isLost,
    isPaused,
    playSfx,
    running,
  ])

  // 触发注入式钱包连接
  const connectWallet = useCallback(() => {
    const connector = injectedConnector
    if (!connector) return
    connect({ connector })
  }, [connect, injectedConnector])

  // 复制交易哈希到剪贴板
  const handleCopyHash = useCallback(async () => {
    if (!submitHash || typeof navigator === 'undefined') return
    try {
      await navigator.clipboard?.writeText(submitHash)
      setCopiedHash(true)
      window.setTimeout(() => setCopiedHash(false), 1200)
    } catch {
      // 忽略复制失败
    }
  }, [submitHash])

  // 将合约就绪检测结果映射为提示文案
  const resolveReadyError = useCallback((reason?: string) => {
    if (reason === 'missing_address' || reason === 'no_code') {
      return '合约未部署或地址失效，请运行 make deploy'
    }
    if (reason === 'rpc_error' || reason === 'rpc_timeout') {
      return 'RPC 连接失败，请确认 Anvil 是否运行'
    }
    return '读取失败，请稍后重试'
  }, [])

  // 统一格式化链上读取错误
  const formatReadError = useCallback((error: unknown) => {
    const message =
      (error as { message?: string })?.message ??
      (error as { shortMessage?: string })?.shortMessage ??
      ''
    if (message.includes('MISSING_ADDRESS') || message.includes('NO_CODE')) {
      return '合约未部署或地址失效，请运行 make deploy'
    }
    if (
      message.includes('RPC_TIMEOUT') ||
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('ECONNREFUSED')
    ) {
      return 'RPC 连接失败，请确认 Anvil 是否运行'
    }
    return '读取失败，请稍后重试'
  }, [])

  // 读取运行时配置并返回可用地址与 RPC
  const resolveReadConfig = useCallback(async () => {
    const runtime = await loadRuntimeConfig()
    setScoreboardConfig(runtime)
    const address =
      runtime.source === 'runtime'
        ? runtime.address
        : scoreboardAddressFallback ?? undefined
    const rpcUrl = runtime.rpcUrl
    return { address, rpcUrl }
  }, [scoreboardAddressFallback])

  // 刷新全局排行榜数据
  const refreshGlobal = useCallback(async () => {
    setGlobalLoading(true)
    setGlobalError(null)
    const { address, rpcUrl } = await resolveReadConfig()
    if (!address) {
      setGlobalEntries([])
      setGlobalError('合约未部署或地址失效，请运行 make deploy')
      setGlobalLoading(false)
      return
    }
    const ready = await checkContractReady(address, rpcUrl)
    if (!ready.ok) {
      setGlobalEntries([])
      setGlobalError(resolveReadyError(ready.reason))
      setGlobalLoading(false)
      return
    }
    try {
      const entries = (await fetchGlobalTop(
        address,
        rpcUrl
      )) as GlobalEntry[]
      setGlobalEntries(entries)
    } catch (error) {
      setGlobalEntries([])
      setGlobalError(formatReadError(error))
    } finally {
      setGlobalLoading(false)
    }
  }, [
    formatReadError,
    resolveReadConfig,
    resolveReadyError,
  ])

  // 刷新当前用户历史成绩
  const refreshUser = useCallback(async () => {
    if (!address) {
      setUserEntries([])
      setUserError(null)
      return
    }
    setUserLoading(true)
    setUserError(null)
    const { address: contractAddress, rpcUrl } =
      await resolveReadConfig()
    if (!contractAddress) {
      setUserEntries([])
      setUserError('合约未部署或地址失效，请运行 make deploy')
      setUserLoading(false)
      return
    }
    const ready = await checkContractReady(contractAddress, rpcUrl)
    if (!ready.ok) {
      setUserEntries([])
      setUserError(resolveReadyError(ready.reason))
      setUserLoading(false)
      return
    }
    try {
      const entries = (await fetchUserRecent(
        address as `0x${string}`,
        contractAddress,
        rpcUrl
      )) as UserEntry[]
      setUserEntries(entries)
    } catch (error) {
      setUserEntries([])
      setUserError(formatReadError(error))
    } finally {
      setUserLoading(false)
    }
  }, [
    address,
    formatReadError,
    resolveReadConfig,
    resolveReadyError,
  ])

  // 全局榜单按分数/时间排序
  const sortedGlobalEntries = useMemo(() => {
    return [...globalEntries].sort((a, b) => {
      const scoreDiff = Number(b.score) - Number(a.score)
      if (scoreDiff !== 0) return scoreDiff
      const timeDiff = Number(b.timestamp) - Number(a.timestamp)
      if (timeDiff !== 0) return timeDiff
      return 0
    })
  }, [globalEntries])

  // 用户成绩按时间升序排序
  const sortedUserEntries = useMemo(() => {
    return [...userEntries].sort((a, b) => {
      const timeDiff = Number(a.timestamp) - Number(b.timestamp)
      if (timeDiff !== 0) return timeDiff
      return 0
    })
  }, [userEntries])

  // 上链状态提示文本
  const submitStatusText = useMemo(() => {
    if (submitStatus === 'pending' || isConfirming) {
      return '交易确认中...'
    }
    if (submitStatus === 'success') {
      return '成绩已记录上链'
    }
    if (submitStatus === 'signing') {
      return '等待钱包签名...'
    }
    if (submitStatus === 'rejected') {
      return submitError ?? '已取消签名'
    }
    if (submitStatus === 'error') {
      return submitError ?? '提交失败，请稍后重试'
    }
    if (submitPayload && submitPayload.score <= 0) {
      return '本局得分为 0，不会提交'
    }
    if (!hasScoreboardAddress) {
      return '合约未部署或地址失效，请运行 make deploy'
    }
    if (isConnected && !isCorrectChain) {
      return '请切换到 Anvil (31337)'
    }
    if (!isConnected) {
      return '请连接钱包后自动提交成绩'
    }
    return '游戏结束后自动提交成绩'
  }, [
    hasScoreboardAddress,
    isConfirming,
    isConnected,
    isCorrectChain,
    submitError,
    submitPayload,
    submitStatus,
  ])

  const isSubmitBlocking =
    submitStatus === 'signing' || submitStatus === 'pending' || isConfirming

  // 清空画布内容
  const clearCanvas = (ctx: CanvasRenderingContext2D) =>
    ctx.clearRect(-1, -1, canvasWidth + 2, canvasHeight + 2)

  // 生成一个不与蛇身重叠的苹果位置
  const generateApplePosition = (): Apple => {
    const x = Math.floor(Math.random() * (canvasWidth / canvasGridSize))
    const y = Math.floor(Math.random() * (canvasHeight / canvasGridSize))
    // 检查随机位置是否与蛇头或蛇身重叠
    if (
      (snake.head.x === x && snake.head.y === y) ||
      snake.trail.some((snakePart) => snakePart.x === x && snakePart.y === y)
    ) {
      return generateApplePosition()
    }
    return { x, y }
  }

  // 重置上链提交状态
  const resetSubmissionState = useCallback(() => {
    autoSubmitRef.current = false
    setSubmitPayload(null)
    setSubmitStatus('idle')
    setSubmitError(null)
    setSubmitHash(null)
  }, [])

  // 提交成绩到链上
  const submitScoreToChain = useCallback(
    async (payload: SubmitPayload) => {
      if (!hasScoreboardAddress) {
        setSubmitStatus('error')
        setSubmitError('合约未部署或地址失效，请运行 make deploy')
        return
      }
      if (!isConnected) {
        setSubmitStatus('needs-wallet')
        return
      }
      if (!isCorrectChain) {
        setSubmitStatus('error')
        setSubmitError('请切换到 Anvil (31337)')
        return
      }
      if (payload.score <= 0) {
        setSubmitStatus('idle')
        return
      }

      try {
        setSubmitError(null)
        setSubmitStatus('signing')
        // 写交易：提交成绩到链上
        const hash = await writeContractAsync({
          address: scoreboardAddressValue,
          abi: scoreboardAbi,
          functionName: 'submitScore',
          args: [
            BigInt(payload.score),
            BigInt(payload.durationSec),
            BigInt(payload.speedPeak),
          ],
        })
        setSubmitHash(hash)
        setSubmitStatus('pending')
      } catch (error) {
        if (error instanceof UserRejectedRequestError) {
          setSubmitStatus('rejected')
          setSubmitError('你已取消签名')
          return
        }
        const message =
          (error as { shortMessage?: string; message?: string })?.shortMessage ??
          (error as { message?: string })?.message ??
          ''
        if (
          message.includes('chain') ||
          message.includes('Chain') ||
          message.includes('network')
        ) {
          setSubmitStatus('error')
          setSubmitError('请切换到 Anvil (31337)')
          return
        }
        if (
          message.includes('Failed to fetch') ||
          message.includes('NetworkError') ||
          message.includes('ECONNREFUSED')
        ) {
          setSubmitStatus('error')
          setSubmitError('RPC 连接失败，请检查 Anvil 是否运行')
          return
        }
        setSubmitStatus('error')
        setSubmitError('提交失败，请稍后重试')
      }
    },
    [
      hasScoreboardAddress,
      isConnected,
      isCorrectChain,
      scoreboardAddressValue,
      writeContractAsync,
    ]
  )

  // 初始化状态并开始倒计时
  const startGame = () => {
    if (!isWalletReady) {
      return
    }
    handleUserInteraction()
    resetSubmissionState()
    overlayPausedRef.current = false
    setIsResumePromptActive(false)
    setGameDelay(1000 / minGameSpeed)
    setTargetDelay(1000 / minGameSpeed)
    setIsLost(false)
    setIsPaused(false)
    setScore(0)
    setElapsedSeconds(0)
    setSpeedPeak(minGameSpeed)
    setSnake({
      head: { x: 12, y: 9 },
      trail: [],
    })
    setApple(generateApplePosition())
    setVelocity({ dx: 0, dy: -1 })
    setRunning(true)
    setCountDown(3)
    gameOverPlayedRef.current = false
    playSfx('start')
  }

  // 打开弹层时暂停游戏
  const pauseForOverlay = useCallback(() => {
    if (!running || isLost || countDown !== 0) return
    overlayPausedRef.current = true
    if (!isPaused) {
      setIsPaused(true)
    }
  }, [countDown, isLost, isPaused, running])

  // 关闭弹层后恢复游戏（带倒计时）
  const resumeAfterOverlay = useCallback(() => {
    if (!overlayPausedRef.current) return
    overlayPausedRef.current = false
    if (!running || isLost) return
    setIsPaused(false)
    setCountDown(3)
  }, [isLost, running])

  // 关闭设置面板
  const closeSettings = useCallback(() => {
    playSfx('toggle')
    setIsSettingsOpen(false)
    if (!isLeaderboardOpen && !isHistoryOpen) {
      resumeAfterOverlay()
    }
  }, [isHistoryOpen, isLeaderboardOpen, playSfx, resumeAfterOverlay])

  // 关闭排行榜面板
  const closeLeaderboard = useCallback(() => {
    playSfx('toggle')
    setIsLeaderboardOpen(false)
    if (!isHistoryOpen && !isSettingsOpen) {
      resumeAfterOverlay()
    }
  }, [isHistoryOpen, isSettingsOpen, playSfx, resumeAfterOverlay])

  // 关闭历史成绩面板
  const closeHistory = useCallback(() => {
    playSfx('toggle')
    setIsHistoryOpen(false)
    if (!isLeaderboardOpen && !isSettingsOpen) {
      resumeAfterOverlay()
    }
  }, [isLeaderboardOpen, isSettingsOpen, playSfx, resumeAfterOverlay])

  // 返回主页：回到未开始状态
  const returnToHome = () => {
    handleUserInteraction()
    playSfx('toggle')
    setIsLost(false)
    setRunning(false)
    setIsPaused(false)
    setIsResumePromptActive(false)
    setGameDelay(1000 / minGameSpeed)
    setTargetDelay(1000 / minGameSpeed)
    setScore(0)
    setElapsedSeconds(0)
    setSpeedPeak(minGameSpeed)
    setSnake({
      head: { x: 12, y: 9 },
      trail: [],
    })
    setApple(generateApplePosition())
    setVelocity({ dx: 0, dy: 0 })
    setCountDown(4)
  }

  // 重置状态并结束回合
  const gameOver = () => {
    if (gameOverPlayedRef.current) return
    gameOverPlayedRef.current = true
    setSubmitPayload({
      score,
      durationSec: elapsedSeconds,
      speedPeak,
    })
    setIsLost(true)
    setRunning(false)
    setIsPaused(false)
    setVelocity({ dx: 0, dy: 0 })
    setCountDown(4)
    playSfx('gameover')
  }

  // 绘制圆形（描边 + 填充）
  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // 绘制纯填充圆形
  const fillCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
  }

  // 绘制椭圆（描边 + 填充）
  const drawEllipse = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number
  ) => {
    ctx.beginPath()
    ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // 绘制星形（用于苹果）
  const drawStar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    points = 5
  ) => {
    const step = Math.PI / points
    ctx.beginPath()
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const angle = i * step - Math.PI / 2
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // 绘制蛇身与头部细节
  const drawSnake = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = snakeFillColor
    ctx.strokeStyle = snakeStrokeColor
    ctx.lineWidth = 2

    const radius = canvasGridSize / 2 - 2
    const headCenterX = snake.head.x * canvasGridSize + canvasGridSize / 2
    const headCenterY = snake.head.y * canvasGridSize + canvasGridSize / 2
    drawCircle(ctx, headCenterX, headCenterY, radius)
    ctx.fillStyle = '#fb7185'
    fillCircle(ctx, headCenterX, headCenterY, radius * 0.72)
    const direction =
      velocity.dx !== 0 || velocity.dy !== 0
        ? velocity
        : previousVelocity.dx !== 0 || previousVelocity.dy !== 0
        ? previousVelocity
        : { dx: 0, dy: -1 }
    const dirLength = Math.hypot(direction.dx, direction.dy) || 1
    const dirX = direction.dx / dirLength
    const dirY = direction.dy / dirLength
    const perpX = -dirY
    const perpY = dirX
    const eyeForward = radius * 0.28
    const eyeSide = radius * 0.35
    const eyeRadiusX = radius * 0.22
    const eyeRadiusY = radius * 0.16
    const pupilRadius = radius * 0.065
    const eyeRotation = Math.atan2(dirY, dirX)
    const eye1X = headCenterX + dirX * eyeForward + perpX * eyeSide
    const eye1Y = headCenterY + dirY * eyeForward + perpY * eyeSide
    const eye2X = headCenterX + dirX * eyeForward - perpX * eyeSide
    const eye2Y = headCenterY + dirY * eyeForward - perpY * eyeSide
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#fda4af'
    drawEllipse(ctx, eye1X, eye1Y, eyeRadiusX, eyeRadiusY, eyeRotation)
    drawEllipse(ctx, eye2X, eye2Y, eyeRadiusX, eyeRadiusY, eyeRotation)
    ctx.fillStyle = '#be123c'
    ctx.strokeStyle = '#be123c'
    drawCircle(
      ctx,
      eye1X + dirX * radius * 0.05,
      eye1Y + dirY * radius * 0.05,
      pupilRadius
    )
    drawCircle(
      ctx,
      eye2X + dirX * radius * 0.05,
      eye2Y + dirY * radius * 0.05,
      pupilRadius
    )
    ctx.fillStyle = '#ffffff'
    fillCircle(
      ctx,
      eye1X + perpX * radius * 0.06 - dirX * radius * 0.04,
      eye1Y + perpY * radius * 0.06 - dirY * radius * 0.04,
      radius * 0.04
    )
    fillCircle(
      ctx,
      eye2X + perpX * radius * 0.06 - dirX * radius * 0.04,
      eye2Y + perpY * radius * 0.06 - dirY * radius * 0.04,
      radius * 0.04
    )
    const tongueBaseX = headCenterX + dirX * radius * 0.55
    const tongueBaseY = headCenterY + dirY * radius * 0.55
    const tongueTipX = headCenterX + dirX * radius * 0.9
    const tongueTipY = headCenterY + dirY * radius * 0.9
    const tongueSide = radius * 0.18
    ctx.fillStyle = '#e2e8f0'
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(tongueTipX, tongueTipY)
    ctx.lineTo(
      tongueBaseX + perpX * tongueSide,
      tongueBaseY + perpY * tongueSide
    )
    ctx.lineTo(
      tongueBaseX - perpX * tongueSide,
      tongueBaseY - perpY * tongueSide
    )
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.lineWidth = 2

    snake.trail.forEach((snakePart) => {
      const centerX = snakePart.x * canvasGridSize + canvasGridSize / 2
      const centerY = snakePart.y * canvasGridSize + canvasGridSize / 2
      ctx.fillStyle = snakeFillColor
      ctx.strokeStyle = snakeStrokeColor
      drawCircle(ctx, centerX, centerY, radius)
    })
  }

  // 绘制苹果
  const drawApple = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = appleFillColor
    ctx.strokeStyle = appleStrokeColor
    ctx.lineWidth = 2

    if (
      apple &&
      typeof apple.x !== 'undefined' &&
      typeof apple.y !== 'undefined'
    ) {
      const centerX = apple.x * canvasGridSize + canvasGridSize / 2
      const centerY = apple.y * canvasGridSize + canvasGridSize / 2
      const outerRadius = canvasGridSize / 2 - 1
      const innerRadius = outerRadius * 0.5
      drawStar(ctx, centerX, centerY, outerRadius, innerRadius)
    }
  }

  // 更新蛇头/蛇身与苹果位置，并检测碰撞
  const updateSnake = () => {
    // 检查是否撞墙
    const nextHeadPosition = {
      x: snake.head.x + velocity.dx,
      y: snake.head.y + velocity.dy,
    }
    if (
      nextHeadPosition.x < 0 ||
      nextHeadPosition.y < 0 ||
      nextHeadPosition.x >= canvasWidth / canvasGridSize ||
      nextHeadPosition.y >= canvasHeight / canvasGridSize
    ) {
      gameOver()
    }

    // 检查是否吃到苹果
    if (nextHeadPosition.x === apple.x && nextHeadPosition.y === apple.y) {
      const eatenApple = { ...apple }
      setScore((prevScore) => prevScore + 1)
      setApple(generateApplePosition())
      playSfx('eat')
    }

    const updatedSnakeTrail = [...snake.trail, { ...snake.head }]
    // 移除超出蛇身长度的轨迹（分数 + 2）
    while (updatedSnakeTrail.length > score + 2) updatedSnakeTrail.shift()
    // 检查蛇身自撞
    if (
      updatedSnakeTrail.some(
        (snakePart) =>
          snakePart.x === nextHeadPosition.x &&
          snakePart.y === nextHeadPosition.y
      )
    )
      gameOver()

    // 更新状态
    setPreviousVelocity({ ...velocity })
    setSnake({
      head: { ...nextHeadPosition },
      trail: [...updatedSnakeTrail],
    })
  }

  // 游戏 Hook
  useEffect(() => {
    const canvas = canvasRef?.current
    const ctx = canvas?.getContext('2d')

    if (ctx && !isLost) {
      clearCanvas(ctx)
      drawApple(ctx)
      drawSnake(ctx)
    }
  }, [snake])

  // 游戏更新间隔
  useInterval(
    () => {
      if (!isLost) {
        updateSnake()
      }
    },
    running && countDown === 0 && !isPaused ? gameDelay : null
  )

  // 倒计时间隔
  useInterval(
    () => {
      setCountDown((prevCountDown) => prevCountDown - 1)
    },
    countDown > 0 && countDown < 4 && !isPaused ? 800 : null
  )

  useEffect(() => {
    if (!submitHash) return
    if (isConfirmed) {
      setSubmitStatus('success')
      void refreshGlobal()
      if (address) {
        void refreshUser()
      }
      return
    }
    if (isConfirmError) {
      setSubmitStatus('error')
      setSubmitError('交易确认失败')
    }
  }, [
    address,
    isConfirmError,
    isConfirmed,
    refreshGlobal,
    refreshUser,
    submitHash,
  ])

  useEffect(() => {
    if (!isLost || !submitPayload) return
    if (submitPayload.score <= 0) {
      setSubmitStatus('idle')
      return
    }
    if (!hasScoreboardAddress) {
      setSubmitStatus('error')
      setSubmitError('合约未部署或地址失效，请运行 make deploy')
      return
    }
    if (!isConnected) {
      setSubmitStatus('needs-wallet')
      return
    }
    if (!isCorrectChain) {
      setSubmitStatus('error')
      setSubmitError('请切换到 Anvil (31337)')
      return
    }
    if (autoSubmitRef.current) return
    autoSubmitRef.current = true
    void submitScoreToChain(submitPayload)
  }, [
    hasScoreboardAddress,
    isConnected,
    isCorrectChain,
    isLost,
    submitPayload,
    submitScoreToChain,
  ])

  useEffect(() => {
    if (!running || isLost) {
      setIsWalletGateActive(false)
      setIsResumePromptActive(false)
      return
    }
    if (!isWalletReady) {
      if (!isWalletGateActive) {
        pauseBeforeGateRef.current = isPaused
      }
      setIsPaused(true)
      setIsWalletGateActive(true)
      setIsResumePromptActive(false)
      return
    }
    if (isWalletGateActive) {
      setIsWalletGateActive(false)
      setIsResumePromptActive(true)
    }
  }, [isLost, isPaused, isWalletGateActive, isWalletReady, running])

  useEffect(() => {
    if (!isLeaderboardOpen) return
    void refreshGlobal()
  }, [isLeaderboardOpen, refreshGlobal])

  useEffect(() => {
    if (!isHistoryOpen) return
    void refreshUser()
  }, [isHistoryOpen, refreshUser])

  // 分数 Hook：平滑速度变化
  useEffect(() => {
    const clampedSpeed = Math.min(
      maxGameSpeed,
      Math.max(minGameSpeed, score)
    )
    setTargetDelay(1000 / clampedSpeed)
  }, [maxGameSpeed, minGameSpeed, score])

  useInterval(
    () => {
      setGameDelay((prevDelay) => {
        const diff = targetDelay - prevDelay
        if (Math.abs(diff) < 0.5) return targetDelay
        return prevDelay + diff * 0.2
      })
    },
    running && countDown === 0 && !isPaused ? 80 : null
  )

  useEffect(() => {
    if (!running) return
    const currentSpeed = Math.round(1000 / gameDelay)
    setSpeedPeak((prevPeak) => Math.max(prevPeak, currentSpeed))
  }, [gameDelay, running])

  useInterval(
    () => {
      setElapsedSeconds((prevSeconds) => prevSeconds + 1)
    },
    running && countDown === 0 && !isPaused && !isLost ? 1000 : null
  )


  // 事件监听：按键
  useEffect(() => {
    // 处理方向键/空格输入
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (running && !isLost && countDown === 0) {
          e.preventDefault()
          togglePause()
        }
        return
      }
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'w',
          'a',
          's',
          'd',
        ].includes(e.key)
      ) {
        let velocity = { dx: 0, dy: 0 }

        switch (e.key) {
          case 'ArrowRight':
            velocity = { dx: 1, dy: 0 }
            break
          case 'ArrowLeft':
            velocity = { dx: -1, dy: 0 }
            break
          case 'ArrowDown':
            velocity = { dx: 0, dy: 1 }
            break
          case 'ArrowUp':
            velocity = { dx: 0, dy: -1 }
            break
          case 'd':
            velocity = { dx: 1, dy: 0 }
            break
          case 'a':
            velocity = { dx: -1, dy: 0 }
            break
          case 's':
            velocity = { dx: 0, dy: 1 }
            break
          case 'w':
            velocity = { dx: 0, dy: -1 }
            break
          default:
            console.error('Error with handleKeyDown')
        }
        if (
          !(
            previousVelocity.dx + velocity.dx === 0 &&
            previousVelocity.dy + velocity.dy === 0
          )
        ) {
          setVelocity(velocity)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [countDown, isLost, previousVelocity, running, togglePause])

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-start bg-gradient-to-br from-rose-50 via-white to-rose-100 px-4 pb-10 pt-12 text-rose-900 sm:pt-16">
      <Head />
      <WalletStatus />
      <header className="mb-6 flex flex-col items-center text-center sm:mb-8">
        <div className="relative inline-flex items-center justify-center">
          <h1 className="relative z-10 text-4xl font-extrabold tracking-tight text-rose-600 drop-shadow-[0_6px_12px_rgba(244,63,94,0.18)] sm:text-5xl md:text-6xl">
            贪吃蛇
          </h1>
          <span className="absolute -right-12 top-0 z-0 -translate-y-[85%] translate-x-8 skew-x-[-12deg] rounded-md bg-rose-500 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm shadow-rose-500/30 sm:-translate-y-[75%] sm:px-2.5 sm:text-[10px]">
            On-chain
          </span>
        </div>
      </header>
      <div className="relative w-full max-w-[720px]">
        <div className="pointer-events-none absolute right-0 z-30 -translate-y-full rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-md shadow-rose-200/60 ring-1 ring-rose-200 sm:px-4 sm:py-2 sm:text-sm -top-2">
          本局得分：{score}
        </div>
        <main className="relative w-full overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(244,63,94,0.18)] ring-1 ring-rose-100">
          <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasWidth + 1}
            height={canvasHeight + 1}
            className="block h-auto max-h-[60vh] w-full border-b border-rose-100 bg-white"
          />
          {isBoardIdle && isWalletReady && !isWalletGateActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-rose-200/30 text-center backdrop-blur-[2px]">
              <div className="rounded-xl border border-rose-100 bg-white/95 px-4 py-3 text-sm font-semibold text-rose-700 shadow-md shadow-rose-300/50">
                未开始
                <br />
                点击开始游戏
              </div>
            </div>
          )}
          {isBoardPaused && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-rose-200/30 text-center backdrop-blur-[2px]">
              <div className="rounded-xl border border-rose-100 bg-white/95 px-4 py-3 text-sm font-semibold text-rose-700 shadow-md shadow-rose-300/50">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-500">
                  ⏸ Paused
                </div>
                已暂停
              </div>
            </div>
          )}
          {isCountdownActive && !isLost && (
            <div className="absolute inset-0 z-10 bg-rose-200/30 backdrop-blur-[2px]" />
          )}
          {countDown > 0 && countDown < 4 && !isLost && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-3xl font-bold text-rose-600 shadow-lg shadow-rose-200/60 ring-1 ring-rose-100 sm:h-24 sm:w-24 sm:text-4xl">
                {countDown}
              </div>
            </div>
          )}
        </div>
        <section className="relative flex flex-col items-stretch gap-3 px-4 py-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 sm:text-base">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (isCountdownActive) return
                handleUserInteraction()
                playSfx('toggle')
                pauseForOverlay()
                void refreshGlobal()
                setIsLeaderboardOpen(true)
                setIsHistoryOpen(false)
                setIsSettingsOpen(false)
              }}
              disabled={isCountdownActive}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[120px] sm:px-5 sm:py-2.5 sm:text-base"
            >
              排行榜
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCountdownActive) return
                handleUserInteraction()
                playSfx('toggle')
                pauseForOverlay()
                void refreshUser()
                setIsHistoryOpen(true)
                setIsLeaderboardOpen(false)
                setIsSettingsOpen(false)
              }}
              disabled={isCountdownActive}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[120px] sm:px-5 sm:py-2.5 sm:text-base"
            >
              历史成绩
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCountdownActive) return
                handleUserInteraction()
                if (isSettingsOpen) {
                  closeSettings()
                } else {
                  playSfx('toggle')
                  pauseForOverlay()
                  setIsSettingsOpen(true)
                  setIsLeaderboardOpen(false)
                  setIsHistoryOpen(false)
                }
              }}
              disabled={isCountdownActive}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[120px] sm:px-5 sm:py-2.5 sm:text-base"
            >
              设置
            </button>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {!running && (
              <button
                onClick={startGame}
                disabled={!isWalletReady}
                className="inline-flex w-full items-center justify-center rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[120px] sm:px-5 sm:py-2.5 sm:text-base"
              >
                {isLost ? '重新开始' : '开始游戏'}
              </button>
            )}
            <button
              type="button"
              onClick={togglePause}
              disabled={!running || isLost || countDown > 0}
              title="空格"
              className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[120px] sm:px-5 sm:py-2.5 sm:text-base"
            >
              <span className="flex items-center gap-1">
                {isPaused ? '继续' : '暂停'}
                <span className="hidden text-xs font-semibold text-rose-400 sm:inline">
                  (空格)
                </span>
              </span>
            </button>
          </div>
        </section>
        {!running && !isLost && !isWalletReady && !isWalletGateActive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 px-6 text-center backdrop-blur-sm">
            <div className="flex max-w-[360px] flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white/95 px-6 py-5 text-rose-600 shadow-lg shadow-rose-200/40">
              <p className="text-lg font-semibold">
                请先连接钱包后开始
              </p>
              <p className="text-sm text-rose-400">
                连接钱包并切换到 Anvil 后即可开始游戏。
              </p>
              {!isConnected && hasProvider && injectedConnector && (
                <button
                  type="button"
                  onClick={() => {
                    handleUserInteraction()
                    connectWallet()
                  }}
                  disabled={isConnecting || !injectedConnector}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConnecting ? '连接中…' : '连接钱包'}
                </button>
              )}
            </div>
          </div>
        )}
        {isWalletGateActive && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center backdrop-blur-sm">
            <p className="text-2xl font-semibold text-rose-700">
              {isConnected && !isCorrectChain ? '网络不正确' : '钱包已断开'}
            </p>
            <p className="text-sm text-rose-500">
              {walletGateMessage || '请重新连接钱包以继续游戏'}
            </p>
            {!isConnected && hasProvider && injectedConnector && (
              <button
                type="button"
                onClick={() => {
                  handleUserInteraction()
                  connectWallet()
                }}
                disabled={isConnecting || !injectedConnector}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConnecting ? '连接中…' : '连接钱包'}
              </button>
            )}
          </div>
        )}
        {isResumePromptActive && !isLost && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center backdrop-blur-sm">
            <p className="text-2xl font-semibold text-rose-700">
              已重新连接
            </p>
            <p className="text-sm text-rose-500">
              选择继续当前对局，或重新开始新一局。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleUserInteraction()
                  setIsResumePromptActive(false)
                  setIsPaused(false)
                }}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600"
              >
                继续游戏
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUserInteraction()
                  setIsResumePromptActive(false)
                  startGame()
                }}
                className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
              >
                重新开始
              </button>
            </div>
          </div>
        )}
        {isLost && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center backdrop-blur-sm">
            <p className="text-3xl font-semibold text-rose-700">游戏结束</p>
            <p className="text-base font-medium text-rose-500">
              你的得分：{score}
            </p>
            <div className="mt-2 grid w-full max-w-[420px] grid-cols-3 gap-2 text-left">
              <div className="rounded-lg bg-rose-50/80 px-3 py-2">
                <p className="text-xs text-rose-400">本局得分</p>
                <p className="text-base font-semibold text-rose-700">{score}</p>
              </div>
              <div className="rounded-lg bg-rose-50/80 px-3 py-2">
                <p className="text-xs text-rose-400">本局时长</p>
                <p className="text-base font-semibold text-rose-700">
                  {formatDuration(elapsedSeconds)}
                </p>
              </div>
              <div className="rounded-lg bg-rose-50/80 px-3 py-2">
                <p className="text-xs text-rose-400">速度峰值</p>
                <p className="text-base font-semibold text-rose-700">
                  {speedPeak} 格/秒
                </p>
              </div>
            </div>
            <div className="mt-3 w-full max-w-[420px] rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-left text-xs text-rose-500 shadow-sm shadow-rose-100/50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-600">链上提交</span>
                {submitStatus === 'success' && (
                  <span className="text-rose-500">已记录</span>
                )}
              </div>
              <p className="mt-1 text-rose-500">{submitStatusText}</p>
              {submitHash && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-rose-500">
                  <span className="font-semibold">交易</span>
                  <span
                    className="font-mono text-rose-600"
                    title={submitHash}
                  >
                    {formatTxHash(submitHash)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="rounded border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-50"
                  >
                    {copiedHash ? '已复制' : '复制'}
                  </button>
                </div>
              )}
              {submitPayload && submitPayload.score > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {submitStatus === 'needs-wallet' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleUserInteraction()
                        connectWallet()
                      }}
                      disabled={isConnecting || !injectedConnector}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isConnecting ? '连接中...' : '连接钱包并提交'}
                    </button>
                  )}
                  {(submitStatus === 'error' ||
                    submitStatus === 'rejected') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!submitPayload) return
                        void submitScoreToChain(submitPayload)
                      }}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
                    >
                      重新提交
                    </button>
                  )}
                </div>
              )}
            </div>
            {!running && isLost && (
              <div className="mt-3 flex w-full max-w-[360px] flex-wrap items-center justify-center gap-2">
                <button
                  onClick={startGame}
                  disabled={isSubmitBlocking}
                  className="min-w-[160px] rounded-lg bg-rose-500 px-5 py-2.5 text-base font-semibold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {countDown === 4 ? '重新开始' : countDown}
                </button>
                <button
                  type="button"
                  onClick={returnToHome}
                  className="min-w-[160px] rounded-lg border border-rose-200 bg-white px-5 py-2.5 text-base font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
                >
                  返回主页
                </button>
              </div>
            )}
          </div>
        )}
        </main>
      </div>
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/20 px-4 py-6 backdrop-blur-sm"
          onClick={closeSettings}
        >
          <div
            className="flex max-h-[60vh] w-full max-w-md flex-col rounded-2xl border border-rose-100 bg-white p-5 text-left text-rose-700 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-rose-600">设置</p>
              <button
                type="button"
                onClick={closeSettings}
                className="text-xs font-semibold text-rose-400 transition hover:text-rose-500"
              >
                关闭
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2">
                <p className="text-sm font-medium">钱包</p>
                <p className="text-xs text-rose-400">
                  {isConnected
                    ? `已连接 ${formatAddress(address)}`
                    : '未连接钱包'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!isConnected ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleUserInteraction()
                        connectWallet()
                      }}
                      disabled={isConnecting || !injectedConnector}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isConnecting ? '连接中...' : '连接钱包'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => disconnect()}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
                    >
                      断开连接
                    </button>
                  )}
                  {!hasScoreboardAddress && (
                    <span className="text-xs text-rose-500">
                      合约未部署或地址失效，请运行 make deploy
                    </span>
                  )}
                </div>
                {connectError && (
                  <p className="mt-1 text-xs text-rose-500">
                    连接失败，请检查钱包插件
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">背景音乐</p>
                  <p className="text-xs text-rose-400">
                    {musicEnabled ? '已开启' : '已关闭'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleUserInteraction()
                    playSfx('toggle')
                    setMusicEnabled((prev) => !prev)
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    musicEnabled ? 'bg-rose-500' : 'bg-rose-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      musicEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">音效</p>
                  <p className="text-xs text-rose-400">
                    {sfxEnabled ? '已开启' : '已关闭'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleUserInteraction()
                    playSfx('toggle')
                    setSfxEnabled((prev) => !prev)
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    sfxEnabled ? 'bg-rose-500' : 'bg-rose-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      sfxEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isLeaderboardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/20 px-4 py-6 backdrop-blur-sm"
          onClick={closeLeaderboard}
        >
          <div
            className="flex max-h-[60vh] w-full max-w-md flex-col rounded-2xl border border-rose-100 bg-white p-5 text-left text-rose-700 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-rose-600">排行榜</p>
              <button
                type="button"
                onClick={closeLeaderboard}
                className="text-xs font-semibold text-rose-400 transition hover:text-rose-500"
              >
                关闭
              </button>
            </div>
            <p className="mb-3 text-xs text-rose-400">
              公开排行榜 · 最新 20 条 · 同分按时间新→旧，若仍相同按序号
            </p>
            {!hasScoreboardAddress ? (
              <p className="text-sm text-rose-400">
                合约未部署或地址失效，请运行 make deploy
              </p>
            ) : globalLoading ? (
              <p className="text-sm text-rose-400">读取中...</p>
            ) : globalError ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-rose-400">{globalError}</p>
                <button
                  type="button"
                  onClick={() => {
                    handleUserInteraction()
                    void refreshGlobal()
                  }}
                  className="w-fit rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600"
                >
                  重试
                </button>
              </div>
            ) : sortedGlobalEntries.length === 0 ? (
              <p className="text-sm text-rose-400">暂无记录</p>
            ) : (
              <div className="mt-2 flex-1 overflow-y-auto pr-1">
                <ol className="space-y-2">
                  {sortedGlobalEntries.map((entry, index) => {
                    const scoreValue = Number(entry.score)
                    const durationValue = Number(entry.durationSec)
                    const speedValue = Number(entry.speedPeak)
                    const timeValue = Number(entry.timestamp)
                    const isTopThree = index < 3
                    return (
                      <li
                        key={`${entry.player}-${entry.timestamp}-${index}`}
                        className="rounded-xl border border-rose-100 bg-white/90 px-2.5 py-2 text-[11px] text-rose-700 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                isTopThree
                                  ? 'bg-rose-500 text-white shadow-sm'
                                  : 'bg-rose-100 text-rose-600'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-rose-700">
                                {formatAddress(entry.player)}
                              </p>
                              <p className="text-[10px] text-rose-400">
                                {formatRelativeTime(timeValue)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-rose-400">分数</p>
                            <p className="text-base font-semibold text-rose-600">
                              {scoreValue}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-rose-600">
                          <div className="rounded-md bg-rose-50/70 px-2 py-1">
                            <p className="text-[9px] text-rose-400">时长</p>
                            <p className="font-semibold">
                              {formatDuration(durationValue)}
                            </p>
                          </div>
                          <div className="rounded-md bg-rose-50/70 px-2 py-1">
                            <p className="text-[9px] text-rose-400">峰值</p>
                            <p className="font-semibold">
                              {speedValue} 格/秒
                            </p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/20 px-4 py-6 backdrop-blur-sm"
          onClick={closeHistory}
        >
          <div
            className="flex max-h-[60vh] w-full max-w-md flex-col rounded-2xl border border-rose-100 bg-white p-5 text-left text-rose-700 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-rose-600">历史成绩</p>
              <button
                type="button"
                onClick={closeHistory}
                className="text-xs font-semibold text-rose-400 transition hover:text-rose-500"
              >
                关闭
              </button>
            </div>
            <p className="mb-3 text-xs text-rose-400">
              仅显示当前钱包 · 最近 20 条 · 最新在最下方
            </p>
            {!hasScoreboardAddress ? (
              <p className="text-sm text-rose-400">
                合约未部署或地址失效，请运行 make deploy
              </p>
            ) : !isConnected ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-rose-400">请先连接钱包查看</p>
                <button
                  type="button"
                  onClick={() => {
                    handleUserInteraction()
                    connectWallet()
                  }}
                  disabled={isConnecting || !injectedConnector}
                  className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConnecting ? '连接中...' : '连接钱包'}
                </button>
              </div>
            ) : userLoading ? (
              <p className="text-sm text-rose-400">读取中...</p>
            ) : userError ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-rose-400">{userError}</p>
                <button
                  type="button"
                  onClick={() => {
                    handleUserInteraction()
                    void refreshUser()
                  }}
                  className="w-fit rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-500/30 transition hover:bg-rose-600"
                >
                  重试
                </button>
              </div>
            ) : sortedUserEntries.length === 0 ? (
              <p className="text-sm text-rose-400">暂无记录</p>
            ) : (
              <div className="mt-2 flex-1 overflow-y-auto pr-1">
                <ol className="space-y-2">
                  {sortedUserEntries.map((entry, index) => {
                    const scoreValue = Number(entry.score)
                    const durationValue = Number(entry.durationSec)
                    const speedValue = Number(entry.speedPeak)
                    const timeValue = Number(entry.timestamp)
                    return (
                      <li
                        key={`${address ?? 'user'}-${entry.timestamp}-${index}`}
                        className="rounded-xl border border-rose-100 bg-white/90 px-2.5 py-2 text-[11px] text-rose-700 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-600">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-rose-700">
                                {address ? formatAddress(address) : '--'}
                              </p>
                              <p className="text-[10px] text-rose-400">
                                {formatRelativeTime(timeValue)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-rose-400">分数</p>
                            <p className="text-base font-semibold text-rose-600">
                              {scoreValue}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-rose-600">
                          <div className="rounded-md bg-rose-50/70 px-2 py-1">
                            <p className="text-[9px] text-rose-400">时长</p>
                            <p className="font-semibold">
                              {formatDuration(durationValue)}
                            </p>
                          </div>
                          <div className="rounded-md bg-rose-50/70 px-2 py-1">
                            <p className="text-[9px] text-rose-400">峰值</p>
                            <p className="font-semibold">
                              {speedValue} 格/秒
                            </p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
      <footer className="mt-6 flex w-full max-w-[720px] items-center justify-center gap-3 px-4 text-[10px] text-rose-400 sm:text-xs">
        <span className="h-px w-10 bg-rose-200/70" />
        <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] text-rose-400">
          <span>© 2026 lllu_23 • Snake Game On-chain</span>
          <span className="h-1 w-1 rounded-full bg-rose-200/70" />
          <a
            href="https://github.com/Luboy23/foundry_advanced_turtorial"
            className="inline-flex items-center gap-1 text-rose-500 transition hover:text-rose-600"
          >
            <FontAwesomeIcon icon={['fab', 'github']} />
            GitHub
          </a>
        </div>
        <span className="h-px w-10 bg-rose-200/70" />
      </footer>
    </div>
  )
}
