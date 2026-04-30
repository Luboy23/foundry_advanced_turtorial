import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {},
}))

vi.mock('../../audio', () => ({
  playBreakSound: vi.fn(),
}))

import { playBreakSound } from '../../audio'
import { DamageResolver } from './DamageResolver'

type ResolverTestRuntime = {
  hasLaunchedBird: boolean
  pieces: Map<string, unknown>
  world?: {
    destroyBody: ReturnType<typeof vi.fn>
  }
}

const createResolver = () => {
  const runtime: ResolverTestRuntime = {
    hasLaunchedBird: false,
    pieces: new Map(),
  }
  const scene = {
    time: {
      now: 1_000,
    },
    tweens: {
      add: vi.fn(({ onComplete }: { onComplete?: () => void }) => {
        onComplete?.()
      }),
    },
  }

  const resolver = new DamageResolver({
    scene: scene as never,
    runtime: runtime as never,
    getLevel: () => null,
    toPixels: (meters) => meters,
    onPieceDestroyed: vi.fn(),
    onBeginImpactSettle: vi.fn(),
  })

  return { resolver, runtime, scene }
}
describe('DamageResolver break audio', () => {
  beforeEach(() => {
    vi.mocked(playBreakSound).mockReset()
  })

  it('only plays break audio for pigs', () => {
    const { resolver, runtime } = createResolver()
    runtime.world = {
      destroyBody: vi.fn(),
    } as never
    runtime.hasLaunchedBird = true

    ;(resolver as unknown as { destroyPiece: (piece: never, trackRunStats: boolean) => void }).destroyPiece(
      {
        id: 'block-1',
        entityType: 'block',
        audioMaterial: 'wood',
        body: {},
        sprite: {
          play: vi.fn(),
          once: vi.fn(),
          destroy: vi.fn(),
        },
        destroyed: false,
      } as never,
      true,
    )

    ;(resolver as unknown as { destroyPiece: (piece: never, trackRunStats: boolean) => void }).destroyPiece(
      {
        id: 'pig-1',
        entityType: 'pig',
        audioMaterial: 'pig',
        body: {},
        sprite: {
          play: vi.fn(),
          once: vi.fn(),
          destroy: vi.fn(),
        },
        destroyed: false,
      } as never,
      true,
    )

    expect(playBreakSound).toHaveBeenCalledTimes(1)
    expect(playBreakSound).toHaveBeenCalledWith(expect.anything(), 'pig', 1000)
  })

  it('plays the pig defeat animation before removing the sprite', () => {
    const { resolver, runtime, scene } = createResolver()
    runtime.world = {
      destroyBody: vi.fn(),
    } as never

    const destroy = vi.fn()
    const play = vi.fn()
    const once = vi.fn()
    let onAnimationComplete: (() => void) | undefined
    once.mockImplementation((_event: string, callback: () => void) => {
      onAnimationComplete = callback
    })

    ;(resolver as unknown as { destroyPiece: (piece: never, trackRunStats: boolean) => void }).destroyPiece(
      {
        id: 'pig-1',
        entityType: 'pig',
        audioMaterial: 'pig',
        body: {},
        sprite: {
          play,
          once,
          destroy,
        },
        destroyed: false,
        visualState: 'idle',
      } as never,
      true,
    )

    expect(play).toHaveBeenCalledWith('pig-defeat', true)
    expect(once).toHaveBeenCalledWith('animationcomplete-pig-defeat', expect.any(Function))
    expect(destroy).not.toHaveBeenCalled()
    expect(scene.tweens.add).not.toHaveBeenCalled()

    onAnimationComplete?.()

    expect(scene.tweens.add).toHaveBeenCalledWith(
      expect.objectContaining({
        delay: 220,
        duration: 180,
        alpha: 0,
      }),
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
