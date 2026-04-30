import { describe, expect, it } from 'vitest'
import { createModalLayout, createViewportLayout, doRectsOverlap } from './layout'

describe('createModalLayout', () => {
  const viewports = [
    { width: 1280, height: 720, label: '16:9' },
    { width: 1440, height: 900, label: '16:10' },
    { width: 820, height: 1180, label: 'narrow portrait-ish' },
  ]

  viewports.forEach(({ width, height, label }) => {
    it(`keeps header, tabs, content, and footer separated on ${label}`, () => {
      const viewport = createViewportLayout(width, height)
      const layout = createModalLayout(viewport, {
        widthRatio: 0.84,
        heightRatio: 0.78,
        maxWidth: 1040,
        maxHeight: 620,
        minWidth: 640,
        minHeight: 460,
        padding: 34,
        headerHeight: 90,
        tabRowHeight: 42,
        footerHeight: 70,
        closeButtonWidth: 118,
        closeButtonHeight: 38,
        closeButtonGapTop: 6,
      })

      expect(layout.modal.left).toBeGreaterThanOrEqual(viewport.safeArea.left)
      expect(layout.modal.right).toBeLessThanOrEqual(viewport.safeArea.right)
      expect(layout.modal.top).toBeGreaterThanOrEqual(viewport.safeArea.top)
      expect(layout.modal.bottom).toBeLessThanOrEqual(viewport.safeArea.bottom)
      expect(layout.tabRowRect).not.toBeNull()
      expect(layout.footerRect).not.toBeNull()
      expect(layout.closeButtonCenter).not.toBeNull()
      expect(doRectsOverlap(layout.headerRect, layout.tabRowRect!)).toBe(false)
      expect(doRectsOverlap(layout.tabRowRect!, layout.contentRect)).toBe(false)
      expect(doRectsOverlap(layout.contentRect, layout.footerRect!)).toBe(false)
      expect(layout.contentRect.width).toBeGreaterThan(220)
      expect(layout.contentRect.height).toBeGreaterThan(120)
    })
  })
})
