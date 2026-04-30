import Phaser from 'phaser'
import { AngryBirdsBridge } from './bridge'
import { BootScene } from './scenes/BootScene'
import { PauseOverlayScene } from './scenes/PauseOverlayScene'
import { PlayScene } from './scenes/PlayScene'
import { ResultPopupScene } from './scenes/ResultPopupScene'
import { TitleScene } from './scenes/TitleScene'

type CreateAngryBirdsGameOptions = {
  parent: HTMLElement
  bridge: AngryBirdsBridge
}

export const createAngryBirdsGame = ({
  parent,
  bridge,
}: CreateAngryBirdsGameOptions) =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || window.innerWidth || 1280,
    height: parent.clientHeight || window.innerHeight || 720,
    backgroundColor: '#d9f1ff',
    render: {
      antialias: true,
      pixelArt: false,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: parent.clientWidth || window.innerWidth || 1280,
      height: parent.clientHeight || window.innerHeight || 720,
    },
    scene: [
      new BootScene(bridge),
      new TitleScene(bridge),
      new PlayScene(bridge),
      new PauseOverlayScene(bridge),
      new ResultPopupScene(bridge),
    ],
  })
