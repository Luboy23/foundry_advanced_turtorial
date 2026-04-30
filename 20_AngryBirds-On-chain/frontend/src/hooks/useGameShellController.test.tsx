import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveProgress } from '../features/progress/localStore'
import type { LevelCatalogEntry } from '../game/types'
import type { AngryBirdsRuntimeConfig } from '../lib/runtime-config'
import { useGameShellController } from './useGameShellController'

const { mockLoadLevelCatalog, mockUseAngryBirdsChainQueries } = vi.hoisted(() => ({
  mockLoadLevelCatalog: vi.fn(),
  mockUseAngryBirdsChainQueries: vi.fn(),
}))

vi.mock('../game/content', () => ({
  loadLevelCatalog: mockLoadLevelCatalog,
}))

vi.mock('./useAngryBirdsChainQueries', () => ({
  useAngryBirdsChainQueries: mockUseAngryBirdsChainQueries,
}))

const createLevel = (levelId: string, order: number, label: string): LevelCatalogEntry => ({
  levelId,
  version: 1,
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
      id: `${levelId}-pig`,
      entityType: 'pig',
      prefabKey: 'pig-basic',
      x: 960,
      y: 560,
      rotation: 0,
    },
  ],
  manifest: {
    levelId,
    version: 1,
    file: `/levels/${levelId}.json`,
    contentHash: '0x1234',
    order,
    enabled: true,
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

const createRuntimeConfig = (): AngryBirdsRuntimeConfig => ({
  chainId: 31337,
  rpcUrl: 'http://127.0.0.1:8545',
  deploymentId: 'local-dev',
  apiBaseUrl: 'http://127.0.0.1:8788/api',
  angryBirdsLevelCatalogAddress: '0x1111111111111111111111111111111111111111',
  angryBirdsScoreboardAddress: '0x2222222222222222222222222222222222222222',
})

describe('useGameShellController', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    mockLoadLevelCatalog.mockReset()
    mockUseAngryBirdsChainQueries.mockReset()
  })

  it('emits sync messages while background refresh is active and the panel is still empty', async () => {
    mockLoadLevelCatalog.mockResolvedValue({
      mapMeta: {
        title: 'AngryBirds-On-chain',
        subtitle: '愤怒的小鸟',
        levels: [],
        popup: {
          victoryTitle: '据点净空',
          failureTitle: '本轮失利',
          submitLabel: '提交战绩',
          retryLabel: '重新开始',
          mapLabel: '返回首页',
        },
      },
      levels: [createLevel('level-1', 1, '第1关')],
    })
    mockUseAngryBirdsChainQueries.mockReturnValue({
      chainCatalog: [],
      leaderboardEntries: [],
      historyEntries: [],
      leaderboardRefreshing: true,
      historyRefreshing: true,
      leaderboardQuery: {
        isLoading: false,
        error: null,
      },
      historyQuery: {
        isLoading: false,
        error: null,
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useGameShellController({
          runtimeConfig: createRuntimeConfig(),
          effectiveAddress: '0x1234567890123456789012345678901234567890',
          currentLevelId: null,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.mergedLevels).toHaveLength(1))

    expect(result.current.chainPanelState.leaderboard).toHaveLength(0)
    expect(result.current.chainPanelState.history).toHaveLength(0)
    expect(result.current.chainPanelState.leaderboardSyncMessage).toBe('排行榜同步中…')
    expect(result.current.chainPanelState.historySyncMessage).toBe('历史记录同步中…')
  })

  it('prefers the current unfinished level as resumeLevelId', async () => {
    mockLoadLevelCatalog.mockResolvedValue({
      mapMeta: {
        title: 'AngryBirds-On-chain',
        subtitle: '愤怒的小鸟',
        levels: [],
        popup: {
          victoryTitle: '据点净空',
          failureTitle: '本轮失利',
          submitLabel: '提交战绩',
          retryLabel: '重新开始',
          mapLabel: '返回首页',
        },
      },
      levels: [
        createLevel('level-0', 1, '第1关'),
        createLevel('level-1', 2, '第2关'),
        createLevel('level-2', 3, '第3关'),
      ],
    })
    mockUseAngryBirdsChainQueries.mockReturnValue({
      chainCatalog: [],
      leaderboardEntries: [],
      historyEntries: [],
      leaderboardRefreshing: false,
      historyRefreshing: false,
      leaderboardQuery: {
        isLoading: false,
        error: null,
      },
      historyQuery: {
        isLoading: false,
        error: null,
      },
    })

    const runtimeConfig = createRuntimeConfig()
    const effectiveAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`
    saveProgress(
      {
        chainId: runtimeConfig.chainId,
        deploymentId: runtimeConfig.deploymentId,
        walletAddress: effectiveAddress,
      },
      {
        unlockedOrders: [1, 2, 3],
        completedLevelIds: ['level-0'],
      },
      'level-1',
    )

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useGameShellController({
          runtimeConfig,
          effectiveAddress,
          currentLevelId: 'level-1',
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.mergedLevels).toHaveLength(3))
    expect(result.current.resumeLevelId).toBe('level-1')
    expect(result.current.lastPlayedLevelId).toBe('level-1')
  })

  it('falls back to the persisted last played level when every level is already cleared', async () => {
    mockLoadLevelCatalog.mockResolvedValue({
      mapMeta: {
        title: 'AngryBirds-On-chain',
        subtitle: '愤怒的小鸟',
        levels: [],
        popup: {
          victoryTitle: '据点净空',
          failureTitle: '本轮失利',
          submitLabel: '提交战绩',
          retryLabel: '重新开始',
          mapLabel: '返回首页',
        },
      },
      levels: [createLevel('level-0', 1, '第1关'), createLevel('level-1', 2, '第2关')],
    })
    mockUseAngryBirdsChainQueries.mockReturnValue({
      chainCatalog: [],
      leaderboardEntries: [],
      historyEntries: [],
      leaderboardRefreshing: false,
      historyRefreshing: false,
      leaderboardQuery: {
        isLoading: false,
        error: null,
      },
      historyQuery: {
        isLoading: false,
        error: null,
      },
    })

    const runtimeConfig = createRuntimeConfig()
    const effectiveAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`
    saveProgress(
      {
        chainId: runtimeConfig.chainId,
        deploymentId: runtimeConfig.deploymentId,
        walletAddress: effectiveAddress,
      },
      {
        unlockedOrders: [1, 2],
        completedLevelIds: ['level-0', 'level-1'],
      },
      'level-1',
    )

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useGameShellController({
          runtimeConfig,
          effectiveAddress,
          currentLevelId: null,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.mergedLevels).toHaveLength(2))
    expect(result.current.resumeLevelId).toBe('level-1')
    expect(result.current.lastPlayedLevelId).toBe('level-1')
  })
})
