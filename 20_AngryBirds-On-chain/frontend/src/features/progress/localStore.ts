import type {
  ActiveSessionGrant,
  LevelCatalogEntry,
  ProgressEnvelopeV2,
  ProgressStorageScope,
  ProgressSnapshot,
  RunSummary,
  RunSyncScope,
  RunSyncState,
  SettingsState,
} from '../../game/types'
import { createDefaultProgress, createDefaultSettings } from '../../game/types'

const SETTINGS_KEY = 'angrybirds.settings.v1'
const RUN_SYNC_PREFIX = 'angrybirds.session-run-queue.v4'
const PROGRESS_PREFIX = 'angrybirds.progress.v2'

export type RunSyncSnapshot = {
  schemaVersion: 6
  chainId: number
  deploymentId: string
  activeSession: ActiveSessionGrant | null
  pendingSessionId: `0x${string}` | null
  queue: RunSummary[]
  txHashes: `0x${string}`[]
  lastStatus: string | null
  walletAddress?: `0x${string}`
  capturedAt: number
}

const normalizeDeploymentId = (deploymentId: string) =>
  encodeURIComponent(deploymentId.trim())

export const buildProgressStorageKey = ({ chainId, deploymentId, walletAddress }: ProgressStorageScope) =>
  `${PROGRESS_PREFIX}.${chainId}.${normalizeDeploymentId(deploymentId)}.${walletAddress?.toLowerCase() ?? 'guest'}`

export const buildRunSyncStorageKey = ({ chainId, deploymentId, walletAddress }: RunSyncScope) =>
  `${RUN_SYNC_PREFIX}.${chainId}.${normalizeDeploymentId(deploymentId)}.${walletAddress?.toLowerCase() ?? 'guest'}`

const parseProgressEnvelope = (
  raw: string | null,
  scope: ProgressStorageScope,
): ProgressEnvelopeV2 | null => {
  const parsed = safeJsonParse<ProgressEnvelopeV2>(raw)
  if (!parsed || parsed.schemaVersion !== 2) {
    return null
  }

  if (parsed.chainId !== scope.chainId || parsed.deploymentId !== scope.deploymentId) {
    return null
  }

  const normalizedWalletAddress = scope.walletAddress?.toLowerCase()
  const normalizedEnvelopeWalletAddress = parsed.walletAddress?.toLowerCase()
  if ((normalizedEnvelopeWalletAddress ?? undefined) !== (normalizedWalletAddress ?? undefined)) {
    return null
  }

  if (
    !parsed.progress ||
    !Array.isArray(parsed.progress.unlockedOrders) ||
    !Array.isArray(parsed.progress.completedLevelIds)
  ) {
    return null
  }

  return parsed
}

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const loadSettings = (): SettingsState => {
  if (typeof window === 'undefined') {
    return createDefaultSettings()
  }

  return safeJsonParse<SettingsState>(window.localStorage.getItem(SETTINGS_KEY)) ?? createDefaultSettings()
}

export const saveSettings = (settings: SettingsState) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const readRunSyncSnapshot = (scope: RunSyncScope): RunSyncSnapshot | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return safeJsonParse<RunSyncSnapshot>(window.sessionStorage.getItem(buildRunSyncStorageKey(scope)))
}

export const writeRunSyncSnapshot = (scope: RunSyncScope, record: RunSyncSnapshot | null) => {
  if (typeof window === 'undefined') {
    return
  }
  if (!record) {
    window.sessionStorage.removeItem(buildRunSyncStorageKey(scope))
    return
  }
  window.sessionStorage.setItem(buildRunSyncStorageKey(scope), JSON.stringify(record))
}

export const clearRunSyncSnapshot = (scope: RunSyncScope) => {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.removeItem(buildRunSyncStorageKey(scope))
}

export const createDefaultRunSyncState = (): RunSyncState => ({
  activeSession: null,
  pendingSessionId: null,
  queue: [],
  txHashes: [],
  lastStatus: null,
})

export const hydrateRunSyncState = (scope: RunSyncScope): RunSyncState => {
  const snapshot = readRunSyncSnapshot(scope)
  if (
    !snapshot ||
    snapshot.schemaVersion !== 6 ||
    snapshot.chainId !== scope.chainId ||
    snapshot.deploymentId !== scope.deploymentId ||
    snapshot.walletAddress?.toLowerCase() !== scope.walletAddress?.toLowerCase()
  ) {
    return createDefaultRunSyncState()
  }

  return {
    activeSession: snapshot.activeSession,
    pendingSessionId: snapshot.pendingSessionId ?? null,
    queue: snapshot.queue,
    txHashes: snapshot.txHashes,
    lastStatus: snapshot.lastStatus,
    walletAddress: snapshot.walletAddress,
  }
}

export const loadProgress = (scope: ProgressStorageScope): ProgressSnapshot => {
  if (typeof window === 'undefined') {
    return createDefaultProgress()
  }

  return parseProgressEnvelope(window.localStorage.getItem(buildProgressStorageKey(scope)), scope)?.progress ?? createDefaultProgress()
}

export const loadLastPlayedLevel = (scope: ProgressStorageScope) => {
  if (typeof window === 'undefined') {
    return null
  }

  return parseProgressEnvelope(window.localStorage.getItem(buildProgressStorageKey(scope)), scope)?.lastPlayedLevelId ?? null
}

export const saveProgress = (
  scope: ProgressStorageScope,
  progress: ProgressSnapshot,
  lastPlayedLevelId: string | null = null,
) => {
  if (typeof window === 'undefined') {
    return
  }

  const envelope: ProgressEnvelopeV2 = {
    schemaVersion: 2,
    chainId: scope.chainId,
    deploymentId: scope.deploymentId,
    walletAddress: scope.walletAddress,
    progress,
    lastPlayedLevelId,
    updatedAt: Date.now(),
  }

  window.localStorage.setItem(buildProgressStorageKey(scope), JSON.stringify(envelope))
}

export const clearProgress = (scope: ProgressStorageScope) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(buildProgressStorageKey(scope))
}

export const markLevelCleared = (
  progress: ProgressSnapshot,
  level: LevelCatalogEntry,
): ProgressSnapshot => {
  const unlockedOrders = new Set(progress.unlockedOrders)
  const completedLevelIds = new Set(progress.completedLevelIds)

  unlockedOrders.add(level.manifest.order)
  unlockedOrders.add(level.manifest.order + 1)
  completedLevelIds.add(level.levelId)

  return {
    unlockedOrders: [...unlockedOrders].sort((left, right) => left - right),
    completedLevelIds: [...completedLevelIds],
  }
}
