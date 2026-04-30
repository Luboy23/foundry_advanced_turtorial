import Phaser from 'phaser'
import { AngryBirdsBridge } from '../bridge'
import { ASSET_KEYS, ensureGeneratedUiTextures, preloadFrameTextures } from '../assets'
import { preloadAudioAssets } from '../audio'
import { registerCharacterAnimations } from '../characterAnimations'
import { SCENE_KEYS } from '../sceneKeys'

export class BootScene extends Phaser.Scene {
  private readonly bridge: AngryBirdsBridge
  private readonly teardownCallbacks: Array<() => void> = []
  private hasRouted = false

  constructor(bridge: AngryBirdsBridge) {
    super(SCENE_KEYS.boot)
    this.bridge = bridge
  }

  preload() {
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    this.cameras.main.setBackgroundColor('#b7e4ff')

    const loadingLabel = this.add
      .text(centerX, centerY - 54, 'AngryBirds-On-chain', {
        fontFamily: '"Avenir Next", "Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '38px',
        fontStyle: '800',
        color: '#17344c',
        stroke: '#fff7e6',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, '#102133', 5, false, true)
      .setLetterSpacing(1)

    const loadingTag = this.add
      .text(centerX, centerY - 18, '愤怒的小鸟', {
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: '#6f461a',
      })
      .setOrigin(0.5)
      .setLetterSpacing(1)

    const loadingHint = this.add
      .text(centerX, centerY + 18, '正在装载赛道装置、关卡数据与战绩面板…', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '18px',
        color: '#7c4d28',
      })
      .setOrigin(0.5)

    const progressBox = this.add.rectangle(centerX, centerY + 74, 360, 18, 0xf4efe2).setStrokeStyle(2, 0x9f7a44)
    const progressFill = this.add.rectangle(centerX - 178, centerY + 74, 0, 12, 0xd69b3a).setOrigin(0, 0.5)

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      progressFill.width = 356 * value
    })

    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      progressBox.destroy()
      progressFill.destroy()
      loadingHint.setText('资源加载完成，正在接入关卡目录…')
    })

    this.load.bitmapFont(
      ASSET_KEYS.numbersFont,
      '/game-images/fonts/hud-score-numbers.png',
      '/game-images/fonts/hud-score-numbers.xml',
    )
    this.load.image(ASSET_KEYS.playBackdropMain, '/game-images/backgrounds/play-backdrop-meadow-mountains.png')
    this.load.image(ASSET_KEYS.playForegroundGrass, '/game-images/backgrounds/play-foreground-grass-clean.png')
    this.load.image(ASSET_KEYS.titleBackground, '/game-images/backgrounds/bg-home.png')
    this.load.json(ASSET_KEYS.mapMeta, '/levels/map-meta.json')
    preloadFrameTextures(this)
    preloadAudioAssets(this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      loadingLabel.destroy()
      loadingTag.destroy()
      loadingHint.destroy()
      this.teardownCallbacks.splice(0).forEach((callback) => callback())
    })
  }

  create() {
    ensureGeneratedUiTextures(this)
    registerCharacterAnimations(this)

    if (this.tryRoute()) {
      return
    }

    this.teardownCallbacks.push(
      this.bridge.on('levels:changed', () => {
        this.tryRoute()
      }),
    )
    this.teardownCallbacks.push(
      this.bridge.on('session:changed', () => {
        this.tryRoute()
      }),
    )
  }

  private tryRoute() {
    if (this.hasRouted || this.bridge.getLevels().length === 0) {
      return false
    }

    this.hasRouted = true
    const session = this.bridge.getSession()
    if (session.scene === 'play' && session.currentLevelId) {
      this.scene.start(SCENE_KEYS.play)
      return true
    }

    this.scene.start(SCENE_KEYS.title)
    return true
  }
}
