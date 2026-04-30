import Phaser from 'phaser'
import { createDefaultSettings, type AudioMaterial, type SettingsState } from './types'

export const AUDIO_ASSET_KEYS = {
  menuBgm: 'bgm-menu-home',
  uiClick: 'sfx-ui-click',
  uiOpen: 'sfx-ui-open',
  uiClose: 'sfx-ui-close',
  launch: 'sfx-launch',
  breakPig: 'sfx-target-break-pig',
  jingleClear: 'jingle-clear',
  jingleFail: 'jingle-fail',
} as const

const AUDIO_ASSET_PATHS: Record<(typeof AUDIO_ASSET_KEYS)[keyof typeof AUDIO_ASSET_KEYS], string> = {
  [AUDIO_ASSET_KEYS.menuBgm]: '/audio/music/bgm-menu-field-of-dreams.wav',
  [AUDIO_ASSET_KEYS.uiClick]: '/audio/ui/ui-click-01.wav',
  [AUDIO_ASSET_KEYS.uiOpen]: '/audio/ui/ui-open-01.wav',
  [AUDIO_ASSET_KEYS.uiClose]: '/audio/ui/ui-close-01.wav',
  [AUDIO_ASSET_KEYS.launch]: '/audio/gameplay/launch-01.wav',
  [AUDIO_ASSET_KEYS.breakPig]: '/audio/impact/break-pig-01.wav',
  [AUDIO_ASSET_KEYS.jingleClear]: '/audio/music/jingle-clear-01.wav',
  [AUDIO_ASSET_KEYS.jingleFail]: '/audio/music/jingle-fail-01.wav',
}

type LoopSoundHandle = {
  isPlaying: boolean
  play: () => void
  stop: () => void
}

type AudioRuntime = {
  hasAudio: (key: string) => boolean
  add: (key: string, config: Phaser.Types.Sound.SoundConfig) => LoopSoundHandle
  play: (key: string, config: Phaser.Types.Sound.SoundConfig) => void
}

const BACKGROUND_MUSIC_CONFIG: Phaser.Types.Sound.SoundConfig = {
  loop: true,
  volume: 0.34,
}

const BUTTON_CLICK_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.38,
}

const MENU_OPEN_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.34,
}

const MENU_CLOSE_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.3,
}

const LAUNCH_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.36,
}

const BREAK_PIG_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.32,
}

const RESULT_CLEAR_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.42,
}

const RESULT_FAIL_CONFIG: Phaser.Types.Sound.SoundConfig = {
  volume: 0.4,
}

type SfxPlaybackOptions = {
  cooldownMs?: number
  nowMs?: number
  noteInteraction?: boolean
}

export class GameAudioController {
  private settings: SettingsState = createDefaultSettings()
  private readonly musicBlocks = new Set<string>()
  private isGameplaySceneActive = false
  private hasObservedInteraction = false
  private menuMusic: LoopSoundHandle | null = null
  private readonly lastPlaybackAt = new Map<string, number>()

  constructor(private readonly runtime: AudioRuntime) {}

  syncSettings(settings: SettingsState) {
    this.settings = settings
    this.syncBackgroundMusic()
  }

  enterGameplayScene() {
    this.isGameplaySceneActive = true
    this.syncBackgroundMusic()
  }

  leaveGameplayScene() {
    this.isGameplaySceneActive = false
    this.syncBackgroundMusic()
  }

  blockMusic(blockId: string) {
    this.musicBlocks.add(blockId)
    this.syncBackgroundMusic()
  }

  unblockMusic(blockId: string) {
    this.musicBlocks.delete(blockId)
    this.syncBackgroundMusic()
  }

  noteUserInteraction() {
    this.hasObservedInteraction = true
    this.syncBackgroundMusic()
  }

  playUiClick() {
    this.playSfx(AUDIO_ASSET_KEYS.uiClick, BUTTON_CLICK_CONFIG, {
      cooldownMs: 24,
      noteInteraction: true,
    })
  }

  playMenuOpen(nowMs?: number) {
    this.playSfx(AUDIO_ASSET_KEYS.uiOpen, MENU_OPEN_CONFIG, {
      cooldownMs: 90,
      noteInteraction: true,
      nowMs,
    })
  }

  playMenuClose(nowMs?: number) {
    this.playSfx(AUDIO_ASSET_KEYS.uiClose, MENU_CLOSE_CONFIG, {
      cooldownMs: 90,
      noteInteraction: true,
      nowMs,
    })
  }

  playLaunch(nowMs?: number) {
    this.playSfx(AUDIO_ASSET_KEYS.launch, LAUNCH_CONFIG, {
      cooldownMs: 110,
      noteInteraction: true,
      nowMs,
    })
  }

  playBreak(material: AudioMaterial, nowMs?: number) {
    if (material !== 'pig') {
      return
    }

    this.playSfx(AUDIO_ASSET_KEYS.breakPig, BREAK_PIG_CONFIG, {
      cooldownMs: 120,
      nowMs,
    })
  }

  playResult(cleared: boolean, nowMs?: number) {
    this.playSfx(
      cleared ? AUDIO_ASSET_KEYS.jingleClear : AUDIO_ASSET_KEYS.jingleFail,
      cleared ? RESULT_CLEAR_CONFIG : RESULT_FAIL_CONFIG,
      {
        cooldownMs: 400,
        nowMs,
      },
    )
  }

  private syncBackgroundMusic() {
    if (
      !this.isGameplaySceneActive ||
      this.musicBlocks.size > 0 ||
      !this.hasObservedInteraction ||
      !this.settings.musicEnabled
    ) {
      this.stopMenuMusic()
      return
    }

    if (!this.runtime.hasAudio(AUDIO_ASSET_KEYS.menuBgm)) {
      return
    }

    this.menuMusic ??= this.runtime.add(AUDIO_ASSET_KEYS.menuBgm, BACKGROUND_MUSIC_CONFIG)
    if (!this.menuMusic.isPlaying) {
      this.menuMusic.play()
    }
  }

  private stopMenuMusic() {
    this.menuMusic?.stop()
  }

  private playSfx(key: string, config: Phaser.Types.Sound.SoundConfig, options: SfxPlaybackOptions = {}) {
    if (options.noteInteraction) {
      this.noteUserInteraction()
    }
    if (!this.settings.sfxEnabled || !this.runtime.hasAudio(key)) {
      return
    }

    const nowMs = options.nowMs ?? Date.now()
    const cooldownMs = options.cooldownMs ?? 0
    const lastPlaybackAt = this.lastPlaybackAt.get(key)
    if (lastPlaybackAt !== undefined && nowMs - lastPlaybackAt < cooldownMs) {
      return
    }

    this.lastPlaybackAt.set(key, nowMs)
    this.runtime.play(key, config)
  }
}

const CONTROLLER_BY_GAME = new WeakMap<Phaser.Game, GameAudioController>()

type PhaserGameWithAudioManagers = Phaser.Game & {
  cache?: {
    audio?: {
      exists: (key: string) => boolean
    }
  }
  sound?: {
    add: (key: string, config: Phaser.Types.Sound.SoundConfig) => LoopSoundHandle
    play: (key: string, config: Phaser.Types.Sound.SoundConfig) => void
  }
}

const createSceneAudioRuntime = (scene: Phaser.Scene): AudioRuntime => {
  const game = scene.game as PhaserGameWithAudioManagers
  const audioCache = game.cache?.audio ?? scene.cache.audio
  const soundManager = game.sound ?? scene.sound

  return {
    hasAudio: (key) => audioCache.exists(key),
    add: (key, config) => soundManager.add(key, config),
    play: (key, config) => {
      soundManager.play(key, config)
    },
  }
}

export const getSceneAudioController = (scene: Phaser.Scene) => {
  const existing = CONTROLLER_BY_GAME.get(scene.game)
  if (existing) {
    return existing
  }

  const controller = new GameAudioController(createSceneAudioRuntime(scene))
  CONTROLLER_BY_GAME.set(scene.game, controller)
  return controller
}

export const preloadAudioAssets = (scene: Phaser.Scene) => {
  for (const [key, path] of Object.entries(AUDIO_ASSET_PATHS)) {
    if (!scene.cache.audio.exists(key)) {
      scene.load.audio(key, path)
    }
  }
}

export const syncSceneAudioSettings = (scene: Phaser.Scene, settings: SettingsState) => {
  getSceneAudioController(scene).syncSettings(settings)
}

export const activateGameplaySceneAudio = (scene: Phaser.Scene) => {
  getSceneAudioController(scene).enterGameplayScene()
}

export const deactivateGameplaySceneAudio = (scene: Phaser.Scene) => {
  getSceneAudioController(scene).leaveGameplayScene()
}

export const blockSceneMusic = (scene: Phaser.Scene, blockId: string) => {
  getSceneAudioController(scene).blockMusic(blockId)
}

export const unblockSceneMusic = (scene: Phaser.Scene, blockId: string) => {
  getSceneAudioController(scene).unblockMusic(blockId)
}

export const noteSceneInteraction = (scene: Phaser.Scene) => {
  getSceneAudioController(scene).noteUserInteraction()
}

export const playGlobalButtonClick = (scene: Phaser.Scene) => {
  getSceneAudioController(scene).playUiClick()
}

export const playMenuOpenSound = (scene: Phaser.Scene, nowMs?: number) => {
  getSceneAudioController(scene).playMenuOpen(nowMs)
}

export const playMenuCloseSound = (scene: Phaser.Scene, nowMs?: number) => {
  getSceneAudioController(scene).playMenuClose(nowMs)
}

export const playLaunchSound = (scene: Phaser.Scene, nowMs?: number) => {
  getSceneAudioController(scene).playLaunch(nowMs)
}

export const playBreakSound = (scene: Phaser.Scene, material: AudioMaterial, nowMs?: number) => {
  getSceneAudioController(scene).playBreak(material, nowMs)
}

export const playResultSound = (scene: Phaser.Scene, cleared: boolean, nowMs?: number) => {
  getSceneAudioController(scene).playResult(cleared, nowMs)
}
