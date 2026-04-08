import type { Page } from '@playwright/test'
import type {
  DebugPlatformStateSnapshot,
  DebugPlayerStateSnapshot,
  DebugSetPlayerStatePayload,
  DebugSpawnTestPlatformPayload,
} from '../../../game/types'

/**
 * 浏览器侧调试桥接口定义。
 * Playwright 通过 window.__DOWNMAN_DEBUG__ 驱动测试专用控制能力。
 */
type DownManDebugBridge = {
  forceGameOver: () => void
  setElapsedMs: (elapsedMs: number) => void
  setPlayerState: (payload: DebugSetPlayerStatePayload) => void
  spawnTestPlatform: (payload: DebugSpawnTestPlatformPayload) => void
  clearTestPlatforms: () => void
  getPlayerStateSnapshot: () => DebugPlayerStateSnapshot
  getPlatformState: (platformId: number) => DebugPlatformStateSnapshot | null
}

type DebugWindow = Window & {
  __DOWNMAN_DEBUG__?: DownManDebugBridge
}

// 检查当前页面是否注入调试桥，便于测试前置条件判断。
export const hasDownmanDebugBridge = async (page: Page): Promise<boolean> =>
  page.evaluate(() => Boolean((window as DebugWindow).__DOWNMAN_DEBUG__))

// 强制触发 game over，用于快速进入结算/提交流程测试。
export const forceGameOver = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    ;(window as DebugWindow).__DOWNMAN_DEBUG__?.forceGameOver()
  })
}

// 直接设置累计存活时间，覆盖难度分段与提交数据边界场景。
export const setElapsedMs = async (page: Page, elapsedMs: number): Promise<void> => {
  await page.evaluate((value) => {
    ;(window as DebugWindow).__DOWNMAN_DEBUG__?.setElapsedMs(value)
  }, elapsedMs)
}

// 注入玩家状态桩，验证落地纠偏、死亡判定等关键逻辑路径。
export const setPlayerState = async (
  page: Page,
  payload: DebugSetPlayerStatePayload,
): Promise<void> => {
  await page.evaluate((nextPayload) => {
    ;(window as DebugWindow).__DOWNMAN_DEBUG__?.setPlayerState(nextPayload)
  }, payload)
}

// 生成测试平台，构造复杂落地/可达性边界场景。
export const spawnTestPlatform = async (
  page: Page,
  payload: DebugSpawnTestPlatformPayload,
): Promise<void> => {
  await page.evaluate((nextPayload) => {
    ;(window as DebugWindow).__DOWNMAN_DEBUG__?.spawnTestPlatform(nextPayload)
  }, payload)
}

// 清理测试注入平台，避免跨用例污染。
export const clearTestPlatforms = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    ;(window as DebugWindow).__DOWNMAN_DEBUG__?.clearTestPlatforms()
  })
}

// 读取玩家状态快照，用于断言场景推进结果。
export const getPlayerStateSnapshot = async (
  page: Page,
): Promise<DebugPlayerStateSnapshot | null> =>
  page.evaluate(() => {
    return (window as DebugWindow).__DOWNMAN_DEBUG__?.getPlayerStateSnapshot() ?? null
  })

// 按平台 ID 拉取平台状态快照，验证平台生命周期分支。
export const getPlatformState = async (
  page: Page,
  platformId: number,
): Promise<DebugPlatformStateSnapshot | null> =>
  page.evaluate((targetPlatformId) => {
    return (window as DebugWindow).__DOWNMAN_DEBUG__?.getPlatformState(targetPlatformId) ?? null
  }, platformId)
