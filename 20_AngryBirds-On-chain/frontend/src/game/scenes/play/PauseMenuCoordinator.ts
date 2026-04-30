import Phaser from 'phaser'

import { playMenuOpenSound } from '../../audio'
import type { AngryBirdsBridge } from '../../bridge'
import { SCENE_KEYS } from '../../sceneKeys'
import type { InGameMenuTab } from '../../types'

type PauseMenuCoordinatorOptions = {
  scene: Phaser.Scene
  bridge: AngryBirdsBridge
  getCurrentLevelId: () => string | null
  isRunCompleted: () => boolean
  onForceWin: (levelId?: string | null) => void
}

export class PauseMenuCoordinator {
  private readonly scene: Phaser.Scene
  private readonly bridge: AngryBirdsBridge
  private readonly getCurrentLevelId: () => string | null
  private readonly isRunCompleted: () => boolean
  private readonly onForceWin: (levelId?: string | null) => void
  private readonly teardownCallbacks: Array<() => void> = []

  constructor({
    scene,
    bridge,
    getCurrentLevelId,
    isRunCompleted,
    onForceWin,
  }: PauseMenuCoordinatorOptions) {
    this.scene = scene
    this.bridge = bridge
    this.getCurrentLevelId = getCurrentLevelId
    this.isRunCompleted = isRunCompleted
    this.onForceWin = onForceWin
  }

  bind() {
    this.scene.input.keyboard?.on('keydown-ESC', this.handlePauseHotkey, this)

    this.teardownCallbacks.push(
      this.bridge.on('debug:force-win-request', ({ levelId }) => {
        this.onForceWin(levelId)
      }),
    )

    this.teardownCallbacks.push(
      this.bridge.on('menu:open-request', ({ route, tab }) => {
        if ((route === 'pause-menu' || route === null) && this.bridge.getSession().scene === 'play') {
          this.openPauseMenu(tab)
        }
      }),
    )

    this.teardownCallbacks.push(
      this.bridge.on('session:changed', (session) => {
        if (this.scene.scene.isPaused()) {
          return
        }

        if (session.scene === 'title') {
          this.scene.scene.stop(SCENE_KEYS.result)
          this.scene.scene.start(SCENE_KEYS.title)
          return
        }

        if (session.scene === 'play' && session.currentLevelId && session.currentLevelId !== this.getCurrentLevelId()) {
          this.scene.scene.stop(SCENE_KEYS.result)
          this.scene.scene.restart()
        }
      }),
    )
  }

  cleanup() {
    this.scene.input.keyboard?.off('keydown-ESC', this.handlePauseHotkey, this)
    this.teardownCallbacks.splice(0).forEach((callback) => callback())
  }

  openPauseMenu(initialTab: InGameMenuTab) {
    if (this.isRunCompleted() || this.scene.scene.isPaused() || this.scene.scene.isActive(SCENE_KEYS.pause)) {
      return
    }

    playMenuOpenSound(this.scene, this.scene.time.now)
    this.scene.scene.launch(SCENE_KEYS.pause, { initialTab })
    this.scene.scene.pause()
  }

  private handlePauseHotkey() {
    this.openPauseMenu('settings')
  }
}
