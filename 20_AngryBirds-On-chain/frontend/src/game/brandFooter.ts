import Phaser from 'phaser'
import { getMapMeta } from './assets'
import { createViewportLayout } from './layout'

export type BrandFooterHandle = {
  layout: (width?: number, height?: number) => void
  destroy: () => void
}

type CreateBrandFooterOptions = {
  depth?: number
  projectTitle?: string
}

export const createBrandFooter = (
  scene: Phaser.Scene,
  { depth = 12, projectTitle = getMapMeta(scene).title }: CreateBrandFooterOptions = {},
): BrandFooterHandle => {
  const ornamentShadow = scene.add.graphics().setDepth(depth - 1).setScrollFactor(0)
  const ornamentLine = scene.add.graphics().setDepth(depth).setScrollFactor(0)
  const ornamentDiamond = scene.add.graphics().setDepth(depth).setScrollFactor(0)
  const footerLabel = scene.add
    .text(0, 0, '', {
      fontFamily: '"Avenir Next", "Trebuchet MS", "PingFang SC", sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#fff7dd',
      align: 'center',
    })
    .setOrigin(0.5, 1)
    .setDepth(depth)
    .setScrollFactor(0)
    .setAlpha(0.88)

  const layout = (width = scene.scale.width, height = scene.scale.height) => {
    const viewport = createViewportLayout(width, height)
    const compact = viewport.height < 680
    const footerText = `© 2026 lllu_23  ${projectTitle}`
    const footerBottomY = viewport.safeArea.bottom - (compact ? 14 : 18)
    const ornamentY = footerBottomY - (compact ? 19 : 24)
    const ornamentSpan = Phaser.Math.Clamp(viewport.safeArea.width * 0.18, 84, 126)
    const ornamentGap = compact ? 14 : 18
    const diamondRadius = compact ? 4 : 5
    const diamondPoints = [
      new Phaser.Geom.Point(viewport.centerX, ornamentY - diamondRadius),
      new Phaser.Geom.Point(viewport.centerX + diamondRadius, ornamentY),
      new Phaser.Geom.Point(viewport.centerX, ornamentY + diamondRadius),
      new Phaser.Geom.Point(viewport.centerX - diamondRadius, ornamentY),
    ]

    ornamentShadow.clear()
    ornamentShadow.lineStyle(2, 0x17344c, 0.1)
    ornamentShadow.beginPath()
    ornamentShadow.moveTo(viewport.centerX - ornamentSpan + 1, ornamentY + 1)
    ornamentShadow.lineTo(viewport.centerX - ornamentGap + 1, ornamentY + 1)
    ornamentShadow.moveTo(viewport.centerX + ornamentGap + 1, ornamentY + 1)
    ornamentShadow.lineTo(viewport.centerX + ornamentSpan + 1, ornamentY + 1)
    ornamentShadow.strokePath()

    ornamentLine.clear()
    ornamentLine.lineStyle(2, 0xffefc8, 0.34)
    ornamentLine.beginPath()
    ornamentLine.moveTo(viewport.centerX - ornamentSpan, ornamentY)
    ornamentLine.lineTo(viewport.centerX - ornamentGap, ornamentY)
    ornamentLine.moveTo(viewport.centerX + ornamentGap, ornamentY)
    ornamentLine.lineTo(viewport.centerX + ornamentSpan, ornamentY)
    ornamentLine.strokePath()

    ornamentDiamond.clear()
    ornamentDiamond.fillStyle(0xfff2d1, 0.42)
    ornamentDiamond.lineStyle(1.5, 0x17344c, 0.18)
    ornamentDiamond.fillPoints(diamondPoints, true)
    ornamentDiamond.strokePoints(diamondPoints, true)

    footerLabel
      .setText(footerText)
      .setPosition(viewport.centerX, footerBottomY)
      .setFontSize(compact ? 12 : 15)
      .setLetterSpacing(compact ? 0.8 : 1.2)
      .setShadow(0, 2, '#17344c', 1.1, false, true)
  }

  layout()

  return {
    layout,
    destroy: () => {
      ornamentShadow.destroy()
      ornamentLine.destroy()
      ornamentDiamond.destroy()
      footerLabel.destroy()
    },
  }
}
