export type LayoutRect = {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

export type ViewportLayout = {
  width: number
  height: number
  centerX: number
  centerY: number
  viewportRect: LayoutRect
  safeArea: LayoutRect
}

export type ModalLayout = {
  viewport: ViewportLayout
  modal: LayoutRect
  inner: LayoutRect
  headerRect: LayoutRect
  tabRowRect: LayoutRect | null
  contentRect: LayoutRect
  footerRect: LayoutRect | null
  closeButtonCenter: { x: number; y: number } | null
}

export type ModalLayoutOptions = {
  widthRatio?: number
  heightRatio?: number
  maxWidth?: number
  maxHeight?: number
  minWidth?: number
  minHeight?: number
  padding?: number
  headerHeight?: number
  headerGap?: number
  tabRowHeight?: number
  tabGap?: number
  footerHeight?: number
  footerGap?: number
  closeButtonWidth?: number
  closeButtonHeight?: number
  closeButtonGapTop?: number
  closeButtonGapRight?: number
}

type RowLayoutOptions = {
  itemHeight: number
  gap?: number
  maxItemWidth?: number
  minItemWidth?: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const createRect = (left: number, top: number, width: number, height: number): LayoutRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  centerX: left + width / 2,
  centerY: top + height / 2,
})

export const insetRect = (rect: LayoutRect, insetX: number, insetY = insetX) =>
  createRect(rect.left + insetX, rect.top + insetY, rect.width - insetX * 2, rect.height - insetY * 2)

export const createViewportLayout = (width: number, height: number): ViewportLayout => {
  const viewportRect = createRect(0, 0, width, height)
  const safeInset = clamp(Math.round(Math.min(width, height) * 0.035), 18, 40)

  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    viewportRect,
    safeArea: insetRect(viewportRect, safeInset),
  }
}

export const createModalLayout = (
  viewport: ViewportLayout,
  {
    widthRatio = 0.76,
    heightRatio = 0.72,
    maxWidth = 980,
    maxHeight = 560,
    minWidth = 420,
    minHeight = 320,
    padding = 34,
    headerHeight = 98,
    headerGap = 14,
    tabRowHeight = 0,
    tabGap = 14,
    footerHeight = 0,
    footerGap = 18,
    closeButtonWidth = 0,
    closeButtonHeight = 0,
    closeButtonGapTop = 0,
    closeButtonGapRight = 0,
  }: ModalLayoutOptions = {},
): ModalLayout => {
  const modalWidth = clamp(viewport.safeArea.width * widthRatio, minWidth, Math.min(maxWidth, viewport.safeArea.width))
  const modalHeight = clamp(
    viewport.safeArea.height * heightRatio,
    minHeight,
    Math.min(maxHeight, viewport.safeArea.height),
  )

  const modal = createRect(
    viewport.centerX - modalWidth / 2,
    viewport.centerY - modalHeight / 2,
    modalWidth,
    modalHeight,
  )
  const inner = insetRect(modal, padding)
  const headerRect = createRect(inner.left, inner.top, inner.width, headerHeight)
  const tabRowRect =
    tabRowHeight > 0
      ? createRect(inner.left, headerRect.bottom + headerGap, inner.width, tabRowHeight)
      : null
  const footerRect =
    footerHeight > 0
      ? createRect(inner.left, inner.bottom - footerHeight, inner.width, footerHeight)
      : null

  const contentTop = tabRowRect ? tabRowRect.bottom + tabGap : headerRect.bottom + headerGap
  const contentBottom = footerRect ? footerRect.top - footerGap : inner.bottom
  const contentRect = createRect(inner.left, contentTop, inner.width, Math.max(contentBottom - contentTop, 80))

  const closeButtonCenter =
    closeButtonWidth > 0 && closeButtonHeight > 0
      ? {
          x: inner.right - closeButtonWidth / 2 - closeButtonGapRight,
          y: inner.top + closeButtonHeight / 2 + closeButtonGapTop,
        }
      : null

  return {
    viewport,
    modal,
    inner,
    headerRect,
    tabRowRect,
    contentRect,
    footerRect,
    closeButtonCenter,
  }
}

export const createRowSlots = (
  bounds: LayoutRect,
  count: number,
  { itemHeight, gap = 14, maxItemWidth = 180, minItemWidth = 96 }: RowLayoutOptions,
) => {
  if (count <= 0) {
    return []
  }

  const usableWidth = Math.max(bounds.width - gap * (count - 1), minItemWidth * count)
  const itemWidth = clamp(usableWidth / count, minItemWidth, maxItemWidth)
  const totalWidth = itemWidth * count + gap * (count - 1)
  const startLeft = bounds.centerX - totalWidth / 2

  return Array.from({ length: count }, (_, index) =>
    createRect(startLeft + index * (itemWidth + gap), bounds.centerY - itemHeight / 2, itemWidth, itemHeight),
  )
}

export const doRectsOverlap = (left: LayoutRect, right: LayoutRect) =>
  !(left.right <= right.left || right.right <= left.left || left.bottom <= right.top || right.bottom <= left.top)
