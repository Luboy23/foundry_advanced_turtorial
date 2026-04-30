import Phaser from 'phaser'
import { ASSET_KEYS, FRAME_ASSET_IDS, getFrameTextureKey } from './assets'
import { buildSlingshotRigLayout, type SlingshotRigLayout } from './slingshotLayout'

const BAND_THICKNESS = 11
const REAR_BAND_DEPTH = 14
const REAR_STICK_DEPTH = 16
const POUCH_DEPTH = 27
const FRONT_BAND_DEPTH = 30
const FRONT_STICK_DEPTH = 31

const SLINGSHOT_REAR_FRAME = FRAME_ASSET_IDS.slingshotBack
const SLINGSHOT_FRONT_FRAME = FRAME_ASSET_IDS.slingshotFront

export type SlingshotRig = {
  layout: SlingshotRigLayout
  setBandTarget: (target?: Phaser.Types.Math.Vector2Like | null) => void
  destroy: () => void
}

const positionBand = (
  sprite: Phaser.GameObjects.Image,
  start: Phaser.Types.Math.Vector2Like,
  end: Phaser.Types.Math.Vector2Like,
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(Math.hypot(dx, dy), 6)

  sprite
    .setPosition(start.x, start.y)
    .setRotation(Math.atan2(dy, dx))
    .setDisplaySize(length, BAND_THICKNESS)
    .setVisible(true)
}

export const createSlingshotRig = (
  scene: Phaser.Scene,
  anchorX: number,
  anchorY: number,
): SlingshotRig => {
  const layout = buildSlingshotRigLayout(anchorX, anchorY)

  const rearStick = scene.add
    .image(layout.rearStickTopLeft.x, layout.rearStickTopLeft.y, getFrameTextureKey(SLINGSHOT_REAR_FRAME))
    .setOrigin(0, 0)
    .setDepth(REAR_STICK_DEPTH)
  const rearBand = scene.add
    .image(layout.rearBandAnchor.x, layout.rearBandAnchor.y, ASSET_KEYS.slingshotBand)
    .setOrigin(0, 0.5)
    .setDepth(REAR_BAND_DEPTH)
    .setVisible(false)
  const pouch = scene.add.graphics().setDepth(POUCH_DEPTH)
  const frontBand = scene.add
    .image(layout.frontBandAnchor.x, layout.frontBandAnchor.y, ASSET_KEYS.slingshotBand)
    .setOrigin(0, 0.5)
    .setDepth(FRONT_BAND_DEPTH)
    .setVisible(false)
  const frontStick = scene.add
    .image(
      layout.frontStickTopLeft.x,
      layout.frontStickTopLeft.y,
      getFrameTextureKey(SLINGSHOT_FRONT_FRAME),
    )
    .setOrigin(0, 0)
    .setDepth(FRONT_STICK_DEPTH)

  const setBandTarget = (target?: Phaser.Types.Math.Vector2Like | null) => {
    const pouchTarget = target
      ? new Phaser.Math.Vector2(target.x, target.y)
      : new Phaser.Math.Vector2(layout.idleBandTarget.x, layout.idleBandTarget.y)
    const rearTarget = new Phaser.Math.Vector2(pouchTarget.x - 14, pouchTarget.y + 8)
    const frontTarget = new Phaser.Math.Vector2(pouchTarget.x - 15, pouchTarget.y + 8)

    positionBand(rearBand, layout.rearBandAnchor, rearTarget)
    positionBand(frontBand, layout.frontBandAnchor, frontTarget)

    pouch.clear()
    pouch.fillStyle(0x5b3114, target ? 0.92 : 0.74)
    pouch.fillRoundedRect(pouchTarget.x - 17, pouchTarget.y + 1, 34, 14, 5)
    pouch.fillStyle(0xe6c284, target ? 0.18 : 0.1)
    pouch.fillRoundedRect(pouchTarget.x - 12, pouchTarget.y + 4, 24, 8, 4)
  }

  setBandTarget(null)

  return {
    layout,
    setBandTarget,
    destroy: () => {
      rearStick.destroy()
      rearBand.destroy()
      pouch.destroy()
      frontBand.destroy()
      frontStick.destroy()
    },
  }
}
