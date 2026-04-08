/**
 * 旧版平台索引构建工具。
 * 当前热路径主要依赖 runtime entry + bucket index，这里更多保留给测试与兼容逻辑。
 */
import type Phaser from 'phaser'

export type RuntimePlatformType = 'stable' | 'moving' | 'vanishing'

export type ActivePlatformEntry = {
  platformId: number
  platform: Phaser.Physics.Arcade.Sprite
  body: Phaser.Physics.Arcade.Body
  type: RuntimePlatformType
}

export type ActivePlatformIndex = {
  entries: ActivePlatformEntry[]
  byId: Map<number, ActivePlatformEntry>
}

const resolvePlatformType = (raw: unknown): RuntimePlatformType => {
  if (raw === 'moving' || raw === 'vanishing') {
    return raw
  }
  return 'stable'
}

export const createEmptyActivePlatformIndex = (): ActivePlatformIndex => ({
  entries: [],
  byId: new Map<number, ActivePlatformEntry>(),
})

export const buildActivePlatformIndex = (
  platforms: Phaser.Physics.Arcade.Group,
): ActivePlatformIndex => {
  const entries: ActivePlatformEntry[] = []
  const byId = new Map<number, ActivePlatformEntry>()

  for (const child of platforms.getChildren()) {
    const platform = child as Phaser.Physics.Arcade.Sprite
    const body = platform.body as Phaser.Physics.Arcade.Body
    if (!platform.active || !body?.enable) {
      continue
    }

    const platformId = platform.getData('platformId') as number
    if (!Number.isFinite(platformId)) {
      continue
    }

    const entry: ActivePlatformEntry = {
      platformId,
      platform,
      body,
      type: resolvePlatformType(platform.getData('platformType')),
    }
    entries.push(entry)
    byId.set(platformId, entry)
  }

  return {
    entries,
    byId,
  }
}
