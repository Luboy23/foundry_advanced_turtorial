import Phaser from 'phaser'

import { ASSET_KEYS, FRAME_ASSET_IDS, getFrameTextureKey } from '../../assets'
import type { LevelCatalogEntry } from '../../types'
import { type PlaySceneRuntime, type HudChip, type HudChipKey, type HudLevelPill, type HudMenuButton } from './runtime'

type HudControllerOptions = {
  scene: Phaser.Scene
  runtime: PlaySceneRuntime
  getLevel: () => LevelCatalogEntry | null
  getRemainingPigCount: () => number
  onOpenMenu: () => void
}

export class HudController {
  private readonly scene: Phaser.Scene
  private readonly runtime: PlaySceneRuntime
  private readonly getLevel: () => LevelCatalogEntry | null
  private readonly getRemainingPigCount: () => number
  private readonly onOpenMenu: () => void

  constructor({ scene, runtime, getLevel, getRemainingPigCount, onOpenMenu }: HudControllerOptions) {
    this.scene = scene
    this.runtime = runtime
    this.getLevel = getLevel
    this.getRemainingPigCount = getRemainingPigCount
    this.onOpenMenu = onOpenMenu
  }

  create() {
    this.runtime.hudChips.time = this.createHudChip('time', 132)
    this.runtime.hudChips.birds = this.createHudChip('birds', 92)
    this.runtime.hudChips.pigs = this.createHudChip('pigs', 92)
    this.runtime.hudLevelPill = this.createHudLevelPill()
    this.runtime.hudMenuButton = this.createHudMenuButton()
    this.layout()
    this.update()
  }

  update() {
    const level = this.getLevel()
    if (!level) {
      return
    }

    const birdsRemaining = Math.max(level.birdQueue.length - this.runtime.birdsUsed, 0)
    const elapsedMs = Math.max(this.runtime.runElapsedMs, 0)
    this.runtime.hudChips.time?.valueText.setText(this.formatHudElapsedTime(elapsedMs))
    this.runtime.hudChips.birds?.valueText.setText(`${birdsRemaining}`)
    this.runtime.hudChips.pigs?.valueText.setText(`${this.getRemainingPigCount()}`)
  }

  layout(width = this.scene.scale.width, height = this.scene.scale.height) {
    const safePadding = Phaser.Math.Clamp(Math.min(width, height) * 0.04, 18, 34)
    const chipGap = 10
    const chipLeft = safePadding
    const chipTop = safePadding
    const timeChip = this.runtime.hudChips.time
    const birdsChip = this.runtime.hudChips.birds
    const pigsChip = this.runtime.hudChips.pigs

    if (timeChip) {
      this.layoutHudChip(timeChip, chipLeft, chipTop)
    }
    if (birdsChip && timeChip) {
      this.layoutHudChip(birdsChip, chipLeft + timeChip.width + chipGap, chipTop)
    }
    if (pigsChip && timeChip && birdsChip) {
      this.layoutHudChip(pigsChip, chipLeft + timeChip.width + chipGap + birdsChip.width + chipGap, chipTop)
    }

    const leftClusterRight =
      pigsChip && birdsChip && timeChip
        ? chipLeft + timeChip.width + chipGap + birdsChip.width + chipGap + pigsChip.width
        : birdsChip && timeChip
          ? chipLeft + timeChip.width + chipGap + birdsChip.width
          : timeChip
            ? chipLeft + timeChip.width
            : chipLeft

    const menuLeft =
      this.runtime.hudMenuButton ? width - safePadding - this.runtime.hudMenuButton.width : width - safePadding
    if (this.runtime.hudLevelPill) {
      const pillPreferredLeft = Math.round(width / 2 - this.runtime.hudLevelPill.width / 2)
      const pillMinLeft = leftClusterRight + 18
      const pillMaxLeft = menuLeft - this.runtime.hudLevelPill.width - 18
      const pillLeft =
        pillMaxLeft >= pillMinLeft
          ? Phaser.Math.Clamp(pillPreferredLeft, pillMinLeft, pillMaxLeft)
          : Phaser.Math.Clamp(
              pillPreferredLeft,
              safePadding,
              width - safePadding - this.runtime.hudLevelPill.width,
            )
      this.layoutHudLevelPill(this.runtime.hudLevelPill, pillLeft, chipTop)
    }

    if (this.runtime.hudMenuButton) {
      this.layoutHudMenuButton(menuLeft, chipTop)
    }
  }

  private createHudChip(key: HudChipKey, width: number): HudChip {
    const background = this.scene.add.graphics().setDepth(118).setScrollFactor(0)
    const valueText =
      key === 'time'
        ? this.scene.add
            .bitmapText(0, 0, ASSET_KEYS.numbersFont, '00:00', 24)
            .setOrigin(0.5)
            .setTint(0x36516a)
            .setDepth(120)
            .setScrollFactor(0)
        : this.scene.add
            .bitmapText(0, 0, ASSET_KEYS.numbersFont, '0', 24)
            .setOrigin(0.5)
            .setTint(0x36516a)
            .setDepth(120)
            .setScrollFactor(0)

    const chip: HudChip = {
      background,
      valueText,
      width,
      height: 46,
    }

    if (key === 'time') {
      chip.iconGraphics = this.scene.add.graphics().setDepth(121).setScrollFactor(0)
    } else {
      chip.iconSprite = this.scene.add
        .sprite(
          0,
          0,
          getFrameTextureKey(key === 'birds' ? FRAME_ASSET_IDS.birdRedIdle1 : FRAME_ASSET_IDS.pigIdle1),
        )
        .setScale(key === 'birds' ? 0.42 : 0.44)
        .setDepth(121)
        .setScrollFactor(0)
    }

    return chip
  }

  private layoutHudChip(chip: HudChip, left: number, top: number) {
    chip.background.clear()
    chip.background.fillStyle(0x173246, 0.12)
    chip.background.fillRoundedRect(left + 2, top + 4, chip.width, chip.height, 18)
    chip.background.fillStyle(0xfcfffb, 0.8)
    chip.background.lineStyle(2, 0xbddff3, 0.86)
    chip.background.fillRoundedRect(left, top, chip.width, chip.height, 18)
    chip.background.strokeRoundedRect(left, top, chip.width, chip.height, 18)

    const centerY = top + chip.height / 2
    if (chip.iconGraphics) {
      this.drawTimeBadge(chip.iconGraphics, left + 21, centerY)
      chip.valueText.setPosition(left + chip.width / 2, centerY + 1)
      return
    }

    if (chip.iconSprite) {
      chip.iconSprite.setPosition(left + 24, centerY + 1)
    }

    chip.valueText.setPosition(left + chip.width - 32, centerY + 1)
  }

  private createHudMenuButton(): HudMenuButton {
    const background = this.scene.add.graphics().setDepth(118).setScrollFactor(0)
    const icon = this.scene.add.graphics().setDepth(121).setScrollFactor(0)
    const label = this.scene.add
      .text(0, 0, '菜单', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: '#3e566f',
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setScrollFactor(0)
    const hitZone = this.scene.add.zone(0, 0, 142, 46).setDepth(122).setScrollFactor(0)
    const button: HudMenuButton = {
      background,
      icon,
      label,
      hitZone,
      width: 142,
      height: 46,
      hovered: false,
    }

    hitZone.setInteractive({ useHandCursor: true })
    hitZone.on(Phaser.Input.Events.POINTER_OVER, () => {
      button.hovered = true
      this.refreshHudMenuButtonVisual()
    })
    hitZone.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.hovered = false
      this.refreshHudMenuButtonVisual()
    })
    hitZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.onOpenMenu()
    })

    return button
  }

  private createHudLevelPill(): HudLevelPill {
    const label = this.scene.add
      .text(0, 0, this.getHudLevelLabel(), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: '#3e566f',
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setScrollFactor(0)

    return {
      background: this.scene.add.graphics().setDepth(118).setScrollFactor(0),
      label,
      width: Math.max(98, Math.ceil(label.width + 32)),
      height: 46,
    }
  }

  private layoutHudLevelPill(pill: HudLevelPill, left: number, top: number) {
    pill.background.clear()
    pill.background.fillStyle(0x173246, 0.12)
    pill.background.fillRoundedRect(left + 2, top + 4, pill.width, pill.height, 18)
    pill.background.fillStyle(0xfcfffb, 0.8)
    pill.background.lineStyle(2, 0xbddff3, 0.86)
    pill.background.fillRoundedRect(left, top, pill.width, pill.height, 18)
    pill.background.strokeRoundedRect(left, top, pill.width, pill.height, 18)
    pill.label.setPosition(left + pill.width / 2, top + pill.height / 2)
  }

  private layoutHudMenuButton(left: number, top: number) {
    const button = this.runtime.hudMenuButton
    if (!button) {
      return
    }

    const centerY = top + button.height / 2
    button.hitZone.setPosition(left + button.width / 2, centerY)
    button.label.setPosition(left + 86, centerY)
    this.refreshHudMenuButtonVisual(left, top)
  }

  private refreshHudMenuButtonVisual(left?: number, top?: number) {
    const button = this.runtime.hudMenuButton
    if (!button) {
      return
    }

    const resolvedLeft = left ?? button.hitZone.x - button.width / 2
    const resolvedTop = top ?? button.hitZone.y - button.height / 2
    const fillAlpha = button.hovered ? 0.9 : 0.82
    const strokeAlpha = button.hovered ? 0.98 : 0.9

    button.background.clear()
    button.background.fillStyle(0x173246, 0.12)
    button.background.fillRoundedRect(resolvedLeft + 2, resolvedTop + 4, button.width, button.height, 18)
    button.background.fillStyle(0xfcfffb, fillAlpha)
    button.background.lineStyle(2, 0xbddff3, strokeAlpha)
    button.background.fillRoundedRect(resolvedLeft, resolvedTop, button.width, button.height, 18)
    button.background.strokeRoundedRect(resolvedLeft, resolvedTop, button.width, button.height, 18)

    button.icon.clear()
    button.icon.lineStyle(3, 0x5d7690, 1)
    const startX = resolvedLeft + 24
    const lineWidth = 18
    ;[-7, 0, 7].forEach((offsetY) => {
      button.icon.beginPath()
      button.icon.moveTo(startX, button.hitZone.y + offsetY)
      button.icon.lineTo(startX + lineWidth, button.hitZone.y + offsetY)
      button.icon.closePath()
      button.icon.strokePath()
    })
  }

  private drawTimeBadge(graphics: Phaser.GameObjects.Graphics, centerX: number, centerY: number) {
    graphics.clear()
    graphics.fillStyle(0xf3d07b, 1)
    graphics.lineStyle(2, 0x8c6730, 1)
    graphics.fillCircle(centerX, centerY, 11)
    graphics.strokeCircle(centerX, centerY, 11)
    graphics.lineStyle(2, 0xfffbef, 1)
    graphics.beginPath()
    graphics.moveTo(centerX, centerY)
    graphics.lineTo(centerX, centerY - 5)
    graphics.moveTo(centerX, centerY)
    graphics.lineTo(centerX + 4, centerY + 2)
    graphics.closePath()
    graphics.strokePath()
  }

  private formatHudElapsedTime(durationMs: number) {
    const totalSeconds = Math.max(Math.floor(durationMs / 1000), 0)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  private getHudLevelLabel() {
    const level = this.getLevel()
    if (!level) {
      return '第1关'
    }

    const levelLabel = level.map.label?.trim() || `${level.manifest.order}`
    return `第${levelLabel}关`
  }
}
