export type BirdType = 'red'
export type LevelPieceEntityType = 'block' | 'pig'
export const AUDIO_MATERIALS = ['generic', 'wood', 'stone', 'glass', 'pig'] as const
export type AudioMaterial = (typeof AUDIO_MATERIALS)[number]

export type LevelPiece = {
  id: string
  entityType: LevelPieceEntityType
  prefabKey: string
  x: number
  y: number
  rotation: number
}

export type LevelGameplayDefinition = {
  levelId: string
  version: number
  world: {
    width: number
    height: number
    groundY: number
    gravityY: number
    pixelsPerMeter: number
  }
  camera: {
    minX: number
    maxX: number
    defaultZoom: number
  }
  slingshot: {
    anchorX: number
    anchorY: number
    maxDrag: number
    launchVelocityScale: number
  }
  birdQueue: BirdType[]
  audioMaterials: Record<string, AudioMaterial>
  pieces: LevelPiece[]
}

export type LevelMapNode = {
  levelId: string
  order: number
  label: string
  title: string
  mapX: number
  mapY: number
  description?: string
}

export type LevelMapMeta = {
  title: string
  subtitle: string
  levels: LevelMapNode[]
  popup: {
    victoryTitle: string
    failureTitle: string
    submitLabel: string
    retryLabel: string
    mapLabel: string
  }
}

export type LevelManifestEntry = {
  levelId: string
  version: number
  file: string
  contentHash: `0x${string}`
  order: number
  enabled: boolean
}

export type LevelCatalogEntry = LevelGameplayDefinition & {
  manifest: LevelManifestEntry
  map: LevelMapNode
}

export type ProgressSnapshot = {
  unlockedOrders: number[]
  completedLevelIds: string[]
}

export type ProgressStorageScope = {
  chainId: number
  deploymentId: string
  walletAddress?: `0x${string}`
}

export type ProgressEnvelopeV2 = {
  schemaVersion: 2
  chainId: number
  deploymentId: string
  walletAddress?: `0x${string}`
  progress: ProgressSnapshot
  lastPlayedLevelId: string | null
  updatedAt: number
}

export const createDefaultProgress = (): ProgressSnapshot => ({
  unlockedOrders: [1],
  completedLevelIds: [],
})

export type SettingsState = {
  musicEnabled: boolean
  sfxEnabled: boolean
}

export const createDefaultSettings = (): SettingsState => ({
  musicEnabled: true,
  sfxEnabled: true,
})

export type WalletState = {
  isConnected: boolean
  isConnecting: boolean
  address?: `0x${string}`
  label: string
  mode: 'wallet' | 'e2e' | 'disconnected'
}

export const createDefaultWalletState = (): WalletState => ({
  isConnected: false,
  isConnecting: false,
  label: '钱包未连接',
  mode: 'disconnected',
})

export type LeaderboardRow = {
  rank: number
  player: `0x${string}`
  label: string
  levelId: string
  levelVersion: number
  levelLabel: string
  levelOrder: number
  birdsUsed: number
  durationMs: number
  evidenceHash: `0x${string}`
  submittedAt: number
}

export type HistoryRow = {
  levelId: string
  levelLabel: string
  birdsUsed: number
  destroyedPigs: number
  durationMs: number
  evidenceHash: `0x${string}`
  submittedAt: number
  pending?: boolean
}

export type ChainPanelState = {
  isLoading: boolean
  error: string | null
  leaderboardLoading: boolean
  historyLoading: boolean
  leaderboardRefreshing: boolean
  historyRefreshing: boolean
  leaderboardSyncMessage: string | null
  historySyncMessage: string | null
  leaderboard: LeaderboardRow[]
  history: HistoryRow[]
}

export const createEmptyChainPanelState = (): ChainPanelState => ({
  isLoading: false,
  error: null,
  leaderboardLoading: false,
  historyLoading: false,
  leaderboardRefreshing: false,
  historyRefreshing: false,
  leaderboardSyncMessage: null,
  historySyncMessage: null,
  leaderboard: [],
  history: [],
})

export type RunSummary = {
  runId: `0x${string}`
  levelId: string
  levelVersion: number
  birdsUsed: number
  destroyedPigs: number
  durationMs: number
  evidenceHash: `0x${string}`
  cleared: boolean
  evidence: RunEvidenceV1
}

export type RunLaunchEvidence = {
  birdIndex: number
  birdType: string
  launchAtMs: number
  dragX: number
  dragY: number
}

export type RunAbilityEvidence = {
  birdIndex: number
  usedAtMs: number
}

export type RunDestroyEvidence = {
  entityId: string
  entityType: string
  atMs: number
  cause: string
}

export type RunCheckpointEvidence = {
  atMs: number
  birdIndex: number
  x: number
  y: number
}

export type RunEvidenceV1 = {
  sessionId: `0x${string}`
  levelId: string
  levelVersion: number
  levelContentHash: `0x${string}`
  clientBuildHash: `0x${string}`
  startedAtMs: number
  finishedAtMs: number
  summary: {
    birdsUsed: number
    destroyedPigs: number
    durationMs: number
    cleared: boolean
  }
  launches: RunLaunchEvidence[]
  abilities: RunAbilityEvidence[]
  destroys: RunDestroyEvidence[]
  checkpoints: RunCheckpointEvidence[]
}

export type ActiveSessionPermit = {
  player: `0x${string}`
  delegate: `0x${string}`
  sessionId: `0x${string}`
  deploymentIdHash: `0x${string}`
  issuedAt: number
  deadline: number
  nonce: number
  maxRuns: number
}

export type ActiveSessionGrant = {
  permit: ActiveSessionPermit
  permitSignature: `0x${string}`
}

export type SessionPermitTypedData = {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: `0x${string}`
  }
  primaryType: 'SessionPermit'
  types: Record<string, Array<{ name: string; type: string }>>
  message: ActiveSessionPermit
}

export type RunSyncScope = {
  chainId: number
  deploymentId: string
  walletAddress?: `0x${string}`
}

export type RunSyncState = {
  activeSession: ActiveSessionGrant | null
  pendingSessionId: `0x${string}` | null
  queue: RunSummary[]
  txHashes: `0x${string}`[]
  lastStatus: string | null
  walletAddress?: `0x${string}`
}

export type GameplayStartMode = 'home' | 'next' | 'retry' | 'level'

export type GameplayStartRequest = {
  mode: GameplayStartMode
  levelId?: string
}

export type InGameMenuTab = 'leaderboard' | 'history' | 'wallet' | 'settings'
export type OverlayRoute = 'home-menu' | 'pause-menu' | 'result'

export type SubmissionStage =
  | 'idle'
  | 'signing'
  | 'queued'
  | 'validating'
  | 'synced'
  | 'finalizing'
  | 'confirmed'
  | 'error'

export type SubmissionState = {
  status: SubmissionStage
  lastStatus: string | null
  canSubmit: boolean
  error: string | null
  requiresSessionRenewal: boolean
  txHash: `0x${string}` | null
  isRecoveryMode: boolean
  summary: RunSummary | null
  queuedRuns: number
  activeSession: ActiveSessionGrant | null
}

export const createDefaultSubmissionState = (): SubmissionState => ({
  status: 'idle',
  lastStatus: null,
  canSubmit: false,
  error: null,
  requiresSessionRenewal: false,
  txHash: null,
  isRecoveryMode: false,
  summary: null,
  queuedRuns: 0,
  activeSession: null,
})

export type UiState = {
  overlayRoute: OverlayRoute | null
  activeMenuTab: InGameMenuTab | null
}

export const createDefaultUiState = (): UiState => ({
  overlayRoute: null,
  activeMenuTab: null,
})

export type SessionScene = 'boot' | 'title' | 'play' | 'result'

export type SessionState = {
  scene: SessionScene
  currentLevelId: string | null
  runSummary: RunSummary | null
}

export const createDefaultSessionState = (): SessionState => ({
  scene: 'boot',
  currentLevelId: null,
  runSummary: null,
})
