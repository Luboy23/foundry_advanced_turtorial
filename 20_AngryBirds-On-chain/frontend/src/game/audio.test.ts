import { describe, expect, it, vi } from 'vitest'
import { AUDIO_ASSET_KEYS, GameAudioController } from './audio'

const createAudioHarness = () => {
  const availableKeys = new Set<string>(Object.values(AUDIO_ASSET_KEYS))
  const menuMusic = {
    isPlaying: false,
    play: vi.fn(() => {
      menuMusic.isPlaying = true
    }),
    stop: vi.fn(() => {
      menuMusic.isPlaying = false
    }),
  }

  const runtime = {
    hasAudio: vi.fn((key: string) => availableKeys.has(key)),
    add: vi.fn((_key: string) => menuMusic),
    play: vi.fn(),
  }

  return {
    controller: new GameAudioController(runtime),
    menuMusic,
    runtime,
  }
}

describe('GameAudioController', () => {
  it('starts and stops gameplay BGM based on interaction and music settings', () => {
    const { controller, menuMusic, runtime } = createAudioHarness()

    controller.enterGameplayScene()
    expect(runtime.add).not.toHaveBeenCalled()

    controller.noteUserInteraction()
    expect(runtime.add).toHaveBeenCalledWith(AUDIO_ASSET_KEYS.menuBgm, expect.objectContaining({ loop: true }))
    expect(menuMusic.play).toHaveBeenCalledTimes(1)
    expect(menuMusic.isPlaying).toBe(true)

    controller.syncSettings({ musicEnabled: false, sfxEnabled: true })
    expect(menuMusic.stop).toHaveBeenCalledTimes(1)
    expect(menuMusic.isPlaying).toBe(false)

    controller.syncSettings({ musicEnabled: true, sfxEnabled: true })
    expect(menuMusic.play).toHaveBeenCalledTimes(2)
    expect(menuMusic.isPlaying).toBe(true)

    controller.leaveGameplayScene()
    expect(menuMusic.stop).toHaveBeenCalledTimes(2)
  })

  it('keeps BGM silent outside gameplay and pauses it while overlays are open', () => {
    const { controller, menuMusic } = createAudioHarness()

    controller.noteUserInteraction()
    expect(menuMusic.play).not.toHaveBeenCalled()

    controller.enterGameplayScene()
    expect(menuMusic.play).toHaveBeenCalledTimes(1)
    expect(menuMusic.isPlaying).toBe(true)

    controller.blockMusic('pause-overlay')
    expect(menuMusic.stop).toHaveBeenCalledTimes(1)
    expect(menuMusic.isPlaying).toBe(false)

    controller.unblockMusic('pause-overlay')
    expect(menuMusic.play).toHaveBeenCalledTimes(2)
    expect(menuMusic.isPlaying).toBe(true)
  })

  it('plays click sound only when sfx is enabled', () => {
    const { controller, runtime } = createAudioHarness()

    controller.syncSettings({ musicEnabled: true, sfxEnabled: false })
    controller.playUiClick()
    expect(runtime.play).not.toHaveBeenCalled()

    controller.syncSettings({ musicEnabled: true, sfxEnabled: true })
    controller.playUiClick()
    expect(runtime.play).toHaveBeenCalledWith(
      AUDIO_ASSET_KEYS.uiClick,
      expect.objectContaining({ volume: 0.38 }),
    )
  })

  it('ignores non-pig break sounds while preserving result cues', () => {
    const { controller, runtime } = createAudioHarness()

    controller.syncSettings({ musicEnabled: true, sfxEnabled: true })
    controller.playBreak('glass', 120)
    controller.playResult(true, 150)

    expect(runtime.play).toHaveBeenNthCalledWith(
      1,
      AUDIO_ASSET_KEYS.jingleClear,
      expect.objectContaining({ volume: 0.42 }),
    )
    expect(runtime.play).toHaveBeenCalledTimes(1)
  })

  it('keeps pig break cues', () => {
    const { controller, runtime } = createAudioHarness()

    controller.syncSettings({ musicEnabled: true, sfxEnabled: true })
    controller.playBreak('pig', 260)

    expect(runtime.play).toHaveBeenNthCalledWith(
      1,
      AUDIO_ASSET_KEYS.breakPig,
      expect.objectContaining({ volume: 0.32 }),
    )
    expect(runtime.play).toHaveBeenCalledTimes(1)
  })
})
