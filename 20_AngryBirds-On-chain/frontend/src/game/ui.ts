import Phaser from 'phaser'
import { playGlobalButtonClick } from './audio'
import { AngryBirdsBridge } from './bridge'
import { createModalLayout, createRowSlots, createViewportLayout, type LayoutRect, type ModalLayout } from './layout'
import type { InGameMenuTab, LevelCatalogEntry, SettingsState } from './types'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'tab'

type ButtonPalette = {
  fill: number
  hoverFill: number
  stroke: number
  text: string
  fillAlpha: number
  hoverAlpha: number
  selectedFill: number
  selectedStroke: number
  selectedAlpha: number
}

const BUTTON_PALETTES: Record<ButtonVariant, ButtonPalette> = {
  primary: {
    fill: 0xf3b244,
    hoverFill: 0xf8c860,
    stroke: 0x945a16,
    text: '#4c290b',
    fillAlpha: 0.98,
    hoverAlpha: 1,
    selectedFill: 0xf8ce67,
    selectedStroke: 0x8c5512,
    selectedAlpha: 1,
  },
  secondary: {
    fill: 0xfff8ef,
    hoverFill: 0xffffff,
    stroke: 0xb59a62,
    text: '#5a3816',
    fillAlpha: 0.92,
    hoverAlpha: 0.98,
    selectedFill: 0xffefc9,
    selectedStroke: 0xa47a32,
    selectedAlpha: 0.98,
  },
  danger: {
    fill: 0xd57246,
    hoverFill: 0xe28254,
    stroke: 0x7a3117,
    text: '#fff8ef',
    fillAlpha: 0.96,
    hoverAlpha: 1,
    selectedFill: 0xe48558,
    selectedStroke: 0x6e2a13,
    selectedAlpha: 1,
  },
  tab: {
    fill: 0xf3fbef,
    hoverFill: 0xfbfff8,
    stroke: 0x9db97c,
    text: '#496133',
    fillAlpha: 0.9,
    hoverAlpha: 0.95,
    selectedFill: 0xdff0bb,
    selectedStroke: 0x7f9f50,
    selectedAlpha: 0.98,
  },
}

export type TextButtonHandle = {
  container: Phaser.GameObjects.Container
  setDisabled: (disabled: boolean) => void
  setLabel: (label: string) => void
  setSelected: (selected: boolean) => void
  destroy: () => void
}

type CreateTextButtonOptions = {
  x: number
  y: number
  width: number
  height?: number
  label: string
  onClick: () => void
  variant?: ButtonVariant
  disabled?: boolean
  fontSize?: number
  depth?: number
  scrollFactor?: number
  playClickSound?: boolean
}

export type PanelHandle = {
  container: Phaser.GameObjects.Container
  layout: ModalLayout
  destroy: () => void
}

export type ScrollableViewportHandle = {
  container: Phaser.GameObjects.Container
  content: Phaser.GameObjects.Container
  scrollToTop: () => void
  setContentHeight: (contentHeight: number) => void
  destroy: () => void
}

export const MAX_CHAIN_PANEL_ROWS = 10

type LeagueSurfaceSpec = {
  rect: LayoutRect
  fill?: number
  fillAlpha?: number
  stroke?: number
  strokeAlpha?: number
  radius?: number
  depthOffset?: number
}

type CreatePanelOptions = {
  title?: string
  subtitle?: string
  depth?: number
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

type CreateScrollableViewportOptions = {
  parent?: Phaser.GameObjects.Container
  x: number
  y: number
  width: number
  height: number
  depth?: number
}

type MenuTabObjectOptions = {
  contentWidth?: number
}

const getViewport = (scene: Phaser.Scene) => createViewportLayout(scene.scale.width, scene.scale.height)

const LEAGUE_PANEL_COLORS = {
  shadow: 0x12293d,
  shellFill: 0xf4efe2,
  shellStroke: 0xb98c49,
  headerGlow: 0xffffff,
  divider: 0xd7b77c,
  sectionFill: 0xfffcf3,
  sectionStroke: 0xe4c88c,
  railFill: 0xeff4eb,
  railStroke: 0x99a774,
} as const

type LeaguePanelPalette = Partial<Record<keyof typeof LEAGUE_PANEL_COLORS, number>>

export const createLeaguePanelShell = (
  scene: Phaser.Scene,
  {
    cardRect,
    depth = 190,
    headerHighlightHeight = 0,
    dividerY,
    shellRadius = 28,
    headerHighlightRadius = 22,
    palette = {},
    surfaces = [],
  }: {
    cardRect: LayoutRect
    depth?: number
    headerHighlightHeight?: number
    dividerY?: number
    shellRadius?: number
    headerHighlightRadius?: number
    palette?: LeaguePanelPalette
    surfaces?: LeagueSurfaceSpec[]
  },
) => {
  const objects: Phaser.GameObjects.GameObject[] = []
  const colors = {
    ...LEAGUE_PANEL_COLORS,
    ...palette,
  }

  const shadow = scene.add.graphics().setDepth(depth).setScrollFactor(0)
  shadow.fillStyle(colors.shadow, 0.18)
  shadow.fillRoundedRect(cardRect.left + 12, cardRect.top + 16, cardRect.width, cardRect.height, shellRadius)
  objects.push(shadow)

  const shell = scene.add.graphics().setDepth(depth + 1).setScrollFactor(0)
  shell.fillStyle(colors.shellFill, 0.86)
  shell.lineStyle(3, colors.shellStroke, 0.94)
  shell.fillRoundedRect(cardRect.left, cardRect.top, cardRect.width, cardRect.height, shellRadius)
  shell.strokeRoundedRect(cardRect.left, cardRect.top, cardRect.width, cardRect.height, shellRadius)
  objects.push(shell)

  if (headerHighlightHeight > 0) {
    const highlight = scene.add.graphics().setDepth(depth + 2).setScrollFactor(0)
    highlight.fillStyle(colors.headerGlow, 0.16)
    highlight.fillRoundedRect(
      cardRect.left + 14,
      cardRect.top + 14,
      cardRect.width - 28,
      headerHighlightHeight,
      headerHighlightRadius,
    )
    objects.push(highlight)
  }

  if (typeof dividerY === 'number') {
    const divider = scene.add.graphics().setDepth(depth + 3).setScrollFactor(0)
    divider.lineStyle(2, colors.divider, 0.4)
    divider.beginPath()
    divider.moveTo(cardRect.left + 28, dividerY)
    divider.lineTo(cardRect.right - 28, dividerY)
    divider.closePath()
    divider.strokePath()
    objects.push(divider)
  }

  for (const surface of surfaces) {
    const panel = scene.add.graphics().setDepth(depth + 3 + (surface.depthOffset ?? 0)).setScrollFactor(0)
    panel.fillStyle(surface.fill ?? colors.sectionFill, surface.fillAlpha ?? 0.56)
    panel.lineStyle(2, surface.stroke ?? colors.sectionStroke, surface.strokeAlpha ?? 0.84)
    panel.fillRoundedRect(
      surface.rect.left,
      surface.rect.top,
      surface.rect.width,
      surface.rect.height,
      surface.radius ?? 20,
    )
    panel.strokeRoundedRect(
      surface.rect.left,
      surface.rect.top,
      surface.rect.width,
      surface.rect.height,
      surface.radius ?? 20,
    )
    objects.push(panel)
  }

  return objects
}

export const createTextButton = (
  scene: Phaser.Scene,
  {
    x,
    y,
    width,
    height = 48,
    label,
    onClick,
    variant = 'primary',
    disabled = false,
    fontSize = 20,
    depth = 10,
    scrollFactor = 1,
    playClickSound = true,
  }: CreateTextButtonOptions,
): TextButtonHandle => {
  const palette = BUTTON_PALETTES[variant]
  const shadow = scene.add.rectangle(0, 4, width, height, 0x193244, 0.12)
  const background = scene.add.rectangle(0, 0, width, height, palette.fill, palette.fillAlpha).setStrokeStyle(3, palette.stroke)
  const labelText = scene.add
    .text(0, 0, label, {
      fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: '700',
      color: palette.text,
      align: 'center',
      wordWrap: { width: Math.max(width - 22, 24) },
    })
    .setOrigin(0.5)

  const container = scene.add.container(x, y, [shadow, background, labelText]).setDepth(depth).setScrollFactor(scrollFactor)
  let isDisabled = disabled
  let isSelected = false
  let isHovered = false

  const applyVisualState = () => {
    const fill = isDisabled
      ? 0xd9d1c2
      : isSelected
        ? palette.selectedFill
        : isHovered
          ? palette.hoverFill
          : palette.fill
    const fillAlpha = isDisabled
      ? 0.78
      : isSelected
        ? palette.selectedAlpha
        : isHovered
          ? palette.hoverAlpha
          : palette.fillAlpha
    const stroke = isDisabled ? 0xa29681 : isSelected ? palette.selectedStroke : palette.stroke
    background.setFillStyle(fill, fillAlpha)
    background.setStrokeStyle(3, stroke)
    shadow.setFillStyle(0x193244, isDisabled ? 0.08 : isHovered ? 0.16 : 0.12)
    labelText.setColor(isDisabled ? '#7c725f' : palette.text)
    container.setScale(isDisabled ? 1 : isHovered ? 1.02 : 1)
  }

  const setInteractivity = () => {
    background.disableInteractive()
    if (!isDisabled) {
      background.setInteractive({ useHandCursor: true })
    }
    applyVisualState()
  }

  background.on(Phaser.Input.Events.POINTER_OVER, () => {
    if (isDisabled) {
      return
    }
    isHovered = true
    applyVisualState()
  })
  background.on(Phaser.Input.Events.POINTER_OUT, () => {
    isHovered = false
    applyVisualState()
  })
  background.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (isDisabled) {
      return
    }
    if (playClickSound) {
      playGlobalButtonClick(scene)
    }
    onClick()
  })

  setInteractivity()

  return {
    container,
    setDisabled: (nextDisabled) => {
      isDisabled = nextDisabled
      setInteractivity()
    },
    setLabel: (nextLabel) => {
      labelText.setText(nextLabel)
    },
    setSelected: (selected) => {
      isSelected = selected
      applyVisualState()
    },
    destroy: () => {
      container.destroy(true)
    },
  }
}

export const createPanel = (
  scene: Phaser.Scene,
  {
    title,
    subtitle,
    depth = 20,
    widthRatio,
    heightRatio,
    maxWidth,
    maxHeight,
    minWidth,
    minHeight,
    padding,
    headerHeight,
    headerGap,
    tabRowHeight,
    tabGap,
    footerHeight,
    footerGap,
    closeButtonWidth,
    closeButtonHeight,
    closeButtonGapTop,
    closeButtonGapRight,
  }: CreatePanelOptions,
): PanelHandle => {
  const layout = createModalLayout(getViewport(scene), {
    widthRatio,
    heightRatio,
    maxWidth,
    maxHeight,
    minWidth,
    minHeight,
    padding,
    headerHeight,
    headerGap,
    tabRowHeight,
    tabGap,
    footerHeight,
    footerGap,
    closeButtonWidth,
    closeButtonHeight,
    closeButtonGapTop,
    closeButtonGapRight,
  })

  const children: Phaser.GameObjects.GameObject[] = createLeaguePanelShell(scene, {
    cardRect: layout.modal,
    depth,
    headerHighlightHeight: layout.headerRect.height + 14,
    dividerY: layout.headerRect.bottom + 8,
    surfaces: [
      {
        rect: {
          left: layout.modal.left + 18,
          top: layout.modal.top + 18,
          width: layout.modal.width - 36,
          height: layout.modal.height - 36,
          right: layout.modal.right - 18,
          bottom: layout.modal.bottom - 18,
          centerX: layout.modal.centerX,
          centerY: layout.modal.centerY,
        },
        fill: 0xffffff,
        fillAlpha: 0.14,
        stroke: 0xeed8a4,
        strokeAlpha: 0.26,
        radius: 22,
        depthOffset: 0,
      },
    ],
  })

  if (title) {
    children.push(
      scene.add
        .text(layout.headerRect.left, layout.headerRect.top, title, {
          fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
          fontSize: `${Math.round(Math.max(24, Math.min(30, layout.modal.width * 0.032)))}px`,
          fontStyle: '700',
          color: '#4c3313',
          wordWrap: { width: layout.headerRect.width - 150 },
        })
        .setShadow(0, 2, '#fffdf4', 4, false, true)
        .setScrollFactor(0),
    )
  }

  if (subtitle) {
    children.push(
      scene.add
        .text(layout.headerRect.left + 2, layout.headerRect.top + 42, subtitle, {
          fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
          fontSize: '16px',
          color: '#5d6c46',
          wordWrap: { width: layout.headerRect.width - 150 },
        })
        .setScrollFactor(0),
    )
  }

  const container = scene.add.container(0, 0, children).setDepth(depth).setScrollFactor(0)

  return {
    container,
    layout,
    destroy: () => {
      container.destroy(true)
    },
  }
}

export const createOverlayBackdrop = (scene: Phaser.Scene, onClick?: () => void, depth = 15) => {
  const viewport = getViewport(scene)
  const backdrop = scene.add
    .rectangle(viewport.centerX, viewport.centerY, viewport.width, viewport.height, 0x112d44, 0.28)
    .setScrollFactor(0)
    .setDepth(depth)

  backdrop.setInteractive({ useHandCursor: !!onClick })
  if (onClick) {
    backdrop.on(Phaser.Input.Events.POINTER_DOWN, onClick)
  }
  return backdrop
}

export const createScrollableViewport = (
  scene: Phaser.Scene,
  { parent, x, y, width, height, depth = 20 }: CreateScrollableViewportOptions,
): ScrollableViewportHandle => {
  const worldX = (parent?.x ?? 0) + x
  const worldY = (parent?.y ?? 0) + y
  const bounds = new Phaser.Geom.Rectangle(worldX, worldY, width, height)
  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(0)
  const content = scene.add.container(0, 0).setScrollFactor(0)
  container.add(content)
  parent?.add(container)

  const maskGraphics = scene.add.graphics().setDepth(depth).setScrollFactor(0)
  maskGraphics.fillStyle(0xffffff, 1)
  maskGraphics.fillRect(worldX, worldY, width, height)
  const mask = maskGraphics.createGeometryMask()
  maskGraphics.setVisible(false)
  content.setMask(mask)

  const hitZone = scene.add
    .zone(worldX + width / 2, worldY + height / 2, width, height)
    .setOrigin(0.5)
    .setDepth(depth + 1)
    .setScrollFactor(0)
  hitZone.setInteractive()

  let scrollY = 0
  let contentHeight = height
  let dragPointerId: number | null = null
  let dragLastY = 0

  const maxScrollY = () => Math.max(0, contentHeight - height)
  const applyScroll = () => {
    content.setY(-scrollY)
  }
  const setScrollY = (nextScrollY: number) => {
    scrollY = Phaser.Math.Clamp(nextScrollY, 0, maxScrollY())
    applyScroll()
  }
  const endDrag = (pointer?: Phaser.Input.Pointer) => {
    if (pointer && dragPointerId !== null && pointer.id !== dragPointerId) {
      return
    }
    dragPointerId = null
  }

  const startDrag = (pointer: Phaser.Input.Pointer) => {
    if (maxScrollY() <= 0) {
      return
    }
    dragPointerId = pointer.id
    dragLastY = pointer.y
  }

  hitZone.on(Phaser.Input.Events.POINTER_DOWN, startDrag)

  const handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!bounds.contains(pointer.x, pointer.y)) {
      return
    }
    startDrag(pointer)
  }

  const handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (dragPointerId !== pointer.id) {
      return
    }
    const deltaY = pointer.y - dragLastY
    dragLastY = pointer.y
    setScrollY(scrollY - deltaY)
  }

  const handlePointerUp = (pointer: Phaser.Input.Pointer) => {
    endDrag(pointer)
  }

  const handleGameOut = () => {
    endDrag()
  }

  const handleWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
    _deltaZ: number,
    event: WheelEvent,
  ) => {
    if (maxScrollY() <= 0 || !bounds.contains(pointer.x, pointer.y)) {
      return
    }
    event.preventDefault()
    setScrollY(scrollY + deltaY)
  }

  scene.input.on(Phaser.Input.Events.POINTER_DOWN, handlePointerDown)
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, handlePointerMove)
  scene.input.on(Phaser.Input.Events.POINTER_UP, handlePointerUp)
  scene.input.on(Phaser.Input.Events.GAME_OUT, handleGameOut)
  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, handleWheel)

  return {
    container,
    content,
    scrollToTop: () => {
      setScrollY(0)
    },
    setContentHeight: (nextContentHeight: number) => {
      contentHeight = Math.max(nextContentHeight, height)
      setScrollY(scrollY)
    },
    destroy: () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, handlePointerDown)
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, handlePointerMove)
      scene.input.off(Phaser.Input.Events.POINTER_UP, handlePointerUp)
      scene.input.off(Phaser.Input.Events.GAME_OUT, handleGameOut)
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL, handleWheel)
      content.clearMask(true)
      hitZone.destroy()
      mask.destroy()
      maskGraphics.destroy()
      container.destroy(true)
    },
  }
}

export const formatDurationMs = (durationMs: number) => `${(durationMs / 1000).toFixed(2)}s`

const padTimePart = (value: number) => value.toString().padStart(2, '0')

export const formatSubmittedAtLabel = (submittedAt: number) => {
  if (!submittedAt) {
    return '--'
  }

  const date = new Date(submittedAt * 1000)
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`
}

export const formatHistoryLevelTitle = (levelLabel: string, levelId: string) => {
  const trimmedLabel = levelLabel.trim()
  if (trimmedLabel && trimmedLabel !== levelId) {
    return `第 ${trimmedLabel} 关`
  }

  const matched = levelId.match(/^level-(.+)$/i)
  if (matched?.[1]) {
    return `第 ${matched[1]} 关`
  }

  return levelId
}

export const describeSubmissionStatus = (bridge: AngryBirdsBridge) => {
  const submission = bridge.getSubmissionState()
  if (submission.status === 'confirmed') {
    return submission.txHash ? `已上链 ${submission.txHash.slice(0, 10)}...` : '链上提交成功'
  }
  if (submission.status === 'finalizing') {
    if (submission.lastStatus === 'queued') {
      return '战绩已入队，等待 relayer 提交链上交易…'
    }
    if (submission.lastStatus === 'submitted') {
      return submission.txHash ? `交易已发送 ${submission.txHash.slice(0, 10)}...` : '链上交易已发送，等待确认…'
    }
    return '战绩批量上链中…'
  }
  if (submission.status === 'validating') {
    return '战绩正在同步到 Rust 后端…'
  }
  if (submission.status === 'signing') {
    return '本局会话授权签名中…'
  }
  if (submission.status === 'error') {
    return submission.error ?? '提交失败，请重试'
  }
  if (submission.activeSession && submission.queuedRuns === 0) {
    return '本局已授权，通关后会自动缓存并批量上链'
  }
  if (submission.status === 'synced') {
    return submission.queuedRuns > 0 ? `已缓存 ${submission.queuedRuns} 条战绩，等待批量上链` : '战绩已同步'
  }
  if (submission.canSubmit && submission.summary) {
    return `待同步 ${submission.summary.levelId} · ${formatDurationMs(submission.summary.durationMs)}`
  }
  return '暂无待提交成绩'
}

export const createMenuTabObjects = (
  scene: Phaser.Scene,
  bridge: AngryBirdsBridge,
  tab: InGameMenuTab,
  _level: LevelCatalogEntry | null,
  { contentWidth = 440 }: MenuTabObjectOptions = {},
): Phaser.GameObjects.GameObject[] => {
  const objects: Phaser.GameObjects.GameObject[] = []
  const chain = bridge.getChainPanelState()
  const wallet = bridge.getWalletState()
  const settings = bridge.getSettings()
  const submission = bridge.getSubmissionState()
  const lineGap = 10
  const rowGap = 16
  const buttonWidth = Math.max(150, Math.min(200, (contentWidth - rowGap) / 2))
  const buttonHeight = 46

  const pushLine = (y: number, text: string, fontSize = 18, color = '#5a3b1a', width = contentWidth) => {
    const line = scene.add.text(0, y, text, {
      fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
      fontSize: `${fontSize}px`,
      color,
      wordWrap: { width },
      lineSpacing: 6,
    })
    objects.push(line)
    return line
  }

  const createButtonRow = (
    y: number,
    left: { label: string; onClick: () => void; variant?: ButtonVariant; disabled?: boolean },
    right?: { label: string; onClick: () => void; variant?: ButtonVariant; disabled?: boolean },
  ) => {
    const leftButton = createTextButton(scene, {
      x: buttonWidth / 2,
      y,
      width: buttonWidth,
      height: buttonHeight,
      label: left.label,
      onClick: left.onClick,
      variant: left.variant,
      disabled: left.disabled,
      fontSize: 18,
    })
    objects.push(leftButton.container)

    if (right) {
      const rightButton = createTextButton(scene, {
        x: buttonWidth + rowGap + buttonWidth / 2,
        y,
        width: buttonWidth,
        height: buttonHeight,
        label: right.label,
        onClick: right.onClick,
        variant: right.variant,
        disabled: right.disabled,
        fontSize: 18,
      })
      objects.push(rightButton.container)
    }
  }

  if (tab === 'leaderboard') {
    pushLine(0, '跨关卡总榜', 18, '#4c2a0f')
    if (chain.isLoading) {
      pushLine(46, '排行榜同步中…')
      return objects
    }
    if (chain.error) {
      pushLine(46, chain.error, 16, '#a13d25')
      return objects
    }
    if (chain.leaderboard.length === 0) {
      pushLine(46, '当前还没有链上成绩。')
      return objects
    }

    chain.leaderboard.slice(0, MAX_CHAIN_PANEL_ROWS).forEach((row, index) => {
      pushLine(
        46 + index * 56,
        `#${row.rank}  ${row.label}\n关卡 ${row.levelLabel} · ${row.birdsUsed} 鸟 · ${formatDurationMs(row.durationMs)}`,
        17,
        '#5b3918',
      )
    })
    return objects
  }

  if (tab === 'history') {
    pushLine(0, '最近链上历史', 18, '#4c2a0f')
    if (chain.isLoading) {
      pushLine(46, '历史记录同步中…')
      return objects
    }
    if (chain.error) {
      pushLine(46, chain.error, 16, '#a13d25')
      return objects
    }
    if (chain.history.length === 0) {
      pushLine(46, '连接钱包后，这里会显示你的最近成绩。')
      return objects
    }

    chain.history.slice(0, MAX_CHAIN_PANEL_ROWS).forEach((row, index) => {
      pushLine(
        46 + index * 58,
        `${formatHistoryLevelTitle(row.levelLabel, row.levelId)} · ${formatSubmittedAtLabel(row.submittedAt)}\n${row.birdsUsed} 鸟 · ${row.destroyedPigs} 猪 · ${formatDurationMs(row.durationMs)}`,
        17,
        '#5b3918',
      )
    })
    return objects
  }

  if (tab === 'wallet') {
    pushLine(0, `当前状态: ${wallet.label}`, 18, '#4c2a0f')
    pushLine(44, describeSubmissionStatus(bridge), 17, submission.status === 'error' ? '#a13d25' : '#6b4d2d')
    createButtonRow(
      130,
      {
        label: wallet.isConnected ? '断开钱包' : wallet.isConnecting ? '连接中…' : '连接钱包',
        onClick: () => {
          if (wallet.isConnected) {
            bridge.requestWalletDisconnect()
            return
          }
          bridge.requestWalletConnect()
        },
        variant: wallet.isConnected ? 'secondary' : 'primary',
        disabled: wallet.isConnecting,
      },
      submission.summary && (submission.canSubmit || submission.requiresSessionRenewal)
        ? {
            label: submission.requiresSessionRenewal ? '回首页授权' : '重试同步',
            onClick: () => {
              if (submission.requiresSessionRenewal) {
                bridge.returnHome()
                return
              }
              bridge.requestSubmit(submission.summary)
            },
            disabled: submission.requiresSessionRenewal ? false : !submission.canSubmit,
          }
        : undefined,
    )

    if (submission.summary) {
      pushLine(
        180,
        `${submission.summary.levelId} · ${submission.summary.birdsUsed} 鸟 · ${formatDurationMs(submission.summary.durationMs)}`,
        18,
        '#4c2a0f',
      )
      createButtonRow(
        256,
        {
          label: '丢弃成绩',
          onClick: () => {
            bridge.requestClearSubmission()
          },
          variant: 'danger',
        },
      )
    }
    return objects
  }

  const createToggle = (y: number, label: string, key: keyof SettingsState, enabled: boolean) => {
    pushLine(y, `${label}: ${enabled ? '开启' : '关闭'}`, 18, '#5b3918')
    const button = createTextButton(scene, {
      x: buttonWidth / 2,
      y: y + 68,
      width: buttonWidth,
      label: enabled ? '关闭' : '开启',
      onClick: () => {
        bridge.requestSettingsUpdate({ [key]: !enabled } as Partial<SettingsState>)
      },
      variant: 'secondary',
      fontSize: 18,
    })
    objects.push(button.container)
  }

  pushLine(0, '音效与设置', 18, '#4c2a0f')
  createToggle(46, '音乐', 'musicEnabled', settings.musicEnabled)
  createToggle(46 + buttonHeight + lineGap + 74, '音效', 'sfxEnabled', settings.sfxEnabled)
  return objects
}

export { createRowSlots, createViewportLayout }
