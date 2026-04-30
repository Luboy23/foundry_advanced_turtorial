import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { stringToHex } from 'viem'
import type { LevelCatalogEntry, RunSummary } from '../game/types'
import { MAX_LEADERBOARD_ROWS, useAngryBirdsChainQueries } from './useAngryBirdsChainQueries'

const mockReadContract = vi.fn()
const mockFetch = vi.fn()

vi.mock('../lib/runtime-config', () => ({
  getResolvedRuntimeConfig: () => ({
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    deploymentId: 'test-deployment',
    apiBaseUrl: 'http://127.0.0.1:8788/api',
    angryBirdsLevelCatalogAddress: '0x1111111111111111111111111111111111111111',
    angryBirdsScoreboardAddress: '0x2222222222222222222222222222222222222222',
  }),
}))

vi.mock('../lib/publicClient', () => ({
  getPublicClient: () => ({
    readContract: mockReadContract,
  }),
}))

const createLevel = (
  levelId: string,
  order: number,
  label: string,
  enabled = true,
  version = 1,
): LevelCatalogEntry => ({
  levelId,
  version,
  world: {
    width: 1280,
    height: 720,
    groundY: 612,
    gravityY: 22,
    pixelsPerMeter: 32,
  },
  camera: {
    minX: 0,
    maxX: 1280,
    defaultZoom: 1,
  },
  slingshot: {
    anchorX: 240,
    anchorY: 520,
    maxDrag: 130,
    launchVelocityScale: 14,
  },
  birdQueue: ['red'],
  audioMaterials: {
    'pig-basic': 'pig',
  },
  pieces: [
    {
      id: `${levelId}-piece-0`,
      entityType: 'pig',
      prefabKey: 'pig-basic',
      x: 960,
      y: 560,
      rotation: 0,
    },
  ],
  manifest: {
    levelId,
    version,
    file: `/levels/${levelId}.json`,
    contentHash: '0x1234' as `0x${string}`,
    order,
    enabled,
  },
  map: {
    levelId,
    order,
    label,
    title: `${label} title`,
    mapX: 640,
    mapY: 320,
  },
})

const createSummary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  runId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  levelId: 'level-1',
  levelVersion: 1,
  birdsUsed: 2,
  destroyedPigs: 4,
  durationMs: 12_000,
  evidenceHash: stringToHex('evidence-1', { size: 32 }),
  cleared: true,
  evidence: {
    sessionId: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    levelId: 'level-1',
    levelVersion: 1,
    levelContentHash: '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    clientBuildHash: '0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    startedAtMs: 1_000,
    finishedAtMs: 13_000,
    summary: {
      birdsUsed: 2,
      destroyedPigs: 4,
      durationMs: 12_000,
      cleared: true,
    },
    launches: [],
    abilities: [],
    destroys: [],
    checkpoints: [],
  },
  ...overrides,
})

const createPlayerAddress = (index: number): `0x${string}` =>
  `0x${(index + 1).toString(16).padStart(40, '0')}` as `0x${string}`

const createIndexedLeaderboardRow = (index: number) => ({
  player: createPlayerAddress(index),
  result: {
    levelId: 'level-1',
    levelVersion: 1,
    birdsUsed: index + 1,
    destroyedPigs: 4,
    durationMs: 12_000 + index,
    evidenceHash: stringToHex(`evidence-${index + 1}`, { size: 32 }),
    submittedAt: 1_000 + index,
  },
})

const createChainLeaderboardRow = (index: number) => ({
  player: createPlayerAddress(index),
  result: {
    levelId: stringToHex('level-1', { size: 32 }),
    levelVersion: 1n,
    birdsUsed: BigInt(index + 1),
    destroyedPigs: 4n,
    durationMs: BigInt(12_000 + index),
    evidenceHash: stringToHex(`evidence-${index + 1}`, { size: 32 }),
    submittedAt: BigInt(1_000 + index),
  },
})

describe('useAngryBirdsChainQueries', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getCatalog') {
        return [
          {
            levelId: stringToHex('level-1', { size: 32 }),
            version: 1n,
            contentHash: stringToHex('level-1-content', { size: 32 }),
            order: 10n,
            enabled: true,
          },
        ]
      }
      if (functionName === 'getGlobalLeaderboard') {
        return [
          {
            player: '0x1234567890123456789012345678901234567890',
            result: {
              levelId: stringToHex('level-1', { size: 32 }),
              levelVersion: 1n,
              birdsUsed: 2n,
              destroyedPigs: 4n,
              durationMs: 12000n,
              evidenceHash: stringToHex('evidence-1', { size: 32 }),
              submittedAt: 1000n,
            },
          },
        ]
      }
      if (functionName === 'getUserHistory') {
        return []
      }
      throw new Error(`Unexpected function: ${functionName}`)
    })
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/leaderboard')) {
        return {
          ok: true,
          json: async () => [
            {
              player: '0x1234567890123456789012345678901234567890',
              result: {
                levelId: 'level-1',
                levelVersion: 1,
                birdsUsed: 2,
                destroyedPigs: 4,
                durationMs: 12000,
                evidenceHash: stringToHex('evidence-1', { size: 32 }),
                submittedAt: 1000,
              },
            },
          ],
          headers: new Headers(),
        } as Response
      }
      if (url.includes('/history/')) {
        return {
          ok: true,
          json: async () => [],
          headers: new Headers(),
        } as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })
  })

  afterEach(() => {
    mockReadContract.mockReset()
    mockFetch.mockReset()
    vi.unstubAllGlobals()
  })

  it('loads leaderboard/history from indexer first and enriches local metadata', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useAngryBirdsChainQueries({
          address: '0x1234567890123456789012345678901234567890',
          localLevels: [createLevel('level-1', 1, '第1关')],
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(1), { timeout: 3000 })

    expect(result.current.leaderboardEntries[0]).toMatchObject({
      player: '0x1234567890123456789012345678901234567890',
      levelLabel: '第1关',
      levelOrder: 10,
    })
    expect(mockFetch.mock.calls.some(([url]) => String(url).includes('/leaderboard?limit=10'))).toBe(true)
    expect(mockReadContract.mock.calls.some(([call]) => call.functionName === 'getGlobalLeaderboard')).toBe(false)
    expect(mockReadContract.mock.calls.some(([call]) => call.functionName === 'getLeaderboard')).toBe(false)
  })

  it('caps indexer leaderboard results to the first 10 rows', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/leaderboard')) {
        return {
          ok: true,
          json: async () => Array.from({ length: 12 }, (_, index) => createIndexedLeaderboardRow(index)),
          headers: new Headers(),
        } as Response
      }
      if (url.includes('/history/')) {
        return {
          ok: true,
          json: async () => [],
          headers: new Headers(),
        } as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useAngryBirdsChainQueries({
          address: '0x1234567890123456789012345678901234567890',
          localLevels: [createLevel('level-1', 1, '第1关')],
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(MAX_LEADERBOARD_ROWS), { timeout: 3000 })

    expect(result.current.leaderboardEntries[0]?.player).toBe(createPlayerAddress(0))
    expect(result.current.leaderboardEntries.at(-1)?.player).toBe(createPlayerAddress(MAX_LEADERBOARD_ROWS - 1))
    expect(result.current.leaderboardEntries.at(-1)?.result.birdsUsed).toBe(MAX_LEADERBOARD_ROWS)
    expect(mockFetch.mock.calls.some(([url]) => String(url).includes('/leaderboard?limit=10'))).toBe(true)
  })

  it('falls back to chain reads when indexer responds with a retriable failure', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/leaderboard') || url.includes('/history/')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ message: 'temporary unavailable' }),
          headers: new Headers(),
        } as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useAngryBirdsChainQueries({
          address: '0x1234567890123456789012345678901234567890',
          localLevels: [createLevel('level-1', 1, '第1关')],
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(1), { timeout: 3000 })

    expect(mockReadContract.mock.calls.some(([call]) => call.functionName === 'getGlobalLeaderboard')).toBe(true)
  })

  it('caps chain fallback leaderboard results to the first 10 rows', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/leaderboard') || url.includes('/history/')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ message: 'temporary unavailable' }),
          headers: new Headers(),
        } as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })
    mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getCatalog') {
        return [
          {
            levelId: stringToHex('level-1', { size: 32 }),
            version: 1n,
            contentHash: stringToHex('level-1-content', { size: 32 }),
            order: 10n,
            enabled: true,
          },
        ]
      }
      if (functionName === 'getGlobalLeaderboard') {
        return Array.from({ length: 12 }, (_, index) => createChainLeaderboardRow(index))
      }
      if (functionName === 'getUserHistory') {
        return []
      }
      throw new Error(`Unexpected function: ${functionName}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useAngryBirdsChainQueries({
          address: '0x1234567890123456789012345678901234567890',
          localLevels: [createLevel('level-1', 1, '第1关')],
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(MAX_LEADERBOARD_ROWS), { timeout: 3000 })

    expect(result.current.leaderboardEntries[0]?.player).toBe(createPlayerAddress(0))
    expect(result.current.leaderboardEntries.at(-1)?.player).toBe(createPlayerAddress(MAX_LEADERBOARD_ROWS - 1))
    expect(result.current.leaderboardEntries.at(-1)?.result.birdsUsed).toBe(MAX_LEADERBOARD_ROWS)
    expect(mockReadContract.mock.calls.some(([call]) => call.functionName === 'getGlobalLeaderboard')).toBe(true)
  })

  it('refreshes leaderboard and history from chain reads after a confirmed run even when the indexer is stale', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/leaderboard') || url.includes('/history/')) {
        return {
          ok: true,
          json: async () => [],
          headers: new Headers(),
        } as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })
    mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getCatalog') {
        return [
          {
            levelId: stringToHex('level-1', { size: 32 }),
            version: 1n,
            contentHash: stringToHex('level-1-content', { size: 32 }),
            order: 10n,
            enabled: true,
          },
        ]
      }
      if (functionName === 'getGlobalLeaderboard') {
        return [
          {
            player: '0x1234567890123456789012345678901234567890',
            result: {
              levelId: stringToHex('level-1', { size: 32 }),
              levelVersion: 1n,
              birdsUsed: 2n,
              destroyedPigs: 4n,
              durationMs: 12000n,
              evidenceHash: stringToHex('evidence-1', { size: 32 }),
              submittedAt: 1000n,
            },
          },
        ]
      }
      if (functionName === 'getUserHistory') {
        return [
          {
            levelId: stringToHex('level-1', { size: 32 }),
            levelVersion: 1n,
            birdsUsed: 2n,
            destroyedPigs: 4n,
            durationMs: 12000n,
            evidenceHash: stringToHex('evidence-1', { size: 32 }),
            submittedAt: 1000n,
          },
        ]
      }
      throw new Error(`Unexpected function: ${functionName}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useAngryBirdsChainQueries({
          address: '0x1234567890123456789012345678901234567890',
          localLevels: [createLevel('level-1', 1, '第1关')],
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(0), { timeout: 3000 })
    await waitFor(() => expect(result.current.historyEntries).toHaveLength(0), { timeout: 3000 })

    await act(async () => {
      await result.current.refreshAfterConfirmedRun(createSummary())
    })

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(1), { timeout: 3000 })
    await waitFor(() => expect(result.current.historyEntries).toHaveLength(1), { timeout: 3000 })
    expect(mockReadContract.mock.calls.some(([call]) => call.functionName === 'getGlobalLeaderboard')).toBe(true)
    expect(mockReadContract.mock.calls.some(([call]) => call.functionName === 'getUserHistory')).toBe(true)
  })

  it('keeps targeted refreshes on chain reads while the forced confirmation window is active', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/leaderboard') || url.includes('/history/')) {
        return {
          ok: true,
          json: async () => [],
          headers: new Headers(),
        } as Response
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })
    mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getCatalog') {
        return [
          {
            levelId: stringToHex('level-1', { size: 32 }),
            version: 1n,
            contentHash: stringToHex('level-1-content', { size: 32 }),
            order: 10n,
            enabled: true,
          },
        ]
      }
      if (functionName === 'getGlobalLeaderboard') {
        return [
          {
            player: '0x1234567890123456789012345678901234567890',
            result: {
              levelId: stringToHex('level-1', { size: 32 }),
              levelVersion: 1n,
              birdsUsed: 2n,
              destroyedPigs: 4n,
              durationMs: 12000n,
              evidenceHash: stringToHex('evidence-1', { size: 32 }),
              submittedAt: 1000n,
            },
          },
        ]
      }
      if (functionName === 'getUserHistory') {
        return [
          {
            levelId: stringToHex('level-1', { size: 32 }),
            levelVersion: 1n,
            birdsUsed: 2n,
            destroyedPigs: 4n,
            durationMs: 12000n,
            evidenceHash: stringToHex('evidence-1', { size: 32 }),
            submittedAt: 1000n,
          },
        ]
      }
      throw new Error(`Unexpected function: ${functionName}`)
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useAngryBirdsChainQueries({
          address: '0x1234567890123456789012345678901234567890',
          localLevels: [createLevel('level-1', 1, '第1关')],
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.leaderboardEntries).toHaveLength(0), { timeout: 3000 })
    const fetchCallsBefore = mockFetch.mock.calls.length

    await act(async () => {
      await result.current.refreshAfterConfirmedRun(createSummary())
    })
    await act(async () => {
      await result.current.refreshLeaderboard()
      await result.current.refreshHistory()
    })

    expect(mockFetch.mock.calls).toHaveLength(fetchCallsBefore)
    expect(mockReadContract.mock.calls.filter(([call]) => call.functionName === 'getGlobalLeaderboard').length).toBeGreaterThan(0)
    expect(mockReadContract.mock.calls.filter(([call]) => call.functionName === 'getUserHistory').length).toBeGreaterThan(0)
  })
})
