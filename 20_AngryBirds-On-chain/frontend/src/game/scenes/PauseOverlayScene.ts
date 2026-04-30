import Phaser from 'phaser'
import { blockSceneMusic, playMenuCloseSound, syncSceneAudioSettings, unblockSceneMusic } from '../audio'
import { AngryBirdsBridge } from '../bridge'
import { createBrandFooter, type BrandFooterHandle } from '../brandFooter'
import { createRect, createViewportLayout, type LayoutRect } from '../layout'
import { SCENE_KEYS } from '../sceneKeys'
import type { HistoryRow, InGameMenuTab, LeaderboardRow } from '../types'
import {
  MAX_CHAIN_PANEL_ROWS,
  createLeaguePanelShell,
  createOverlayBackdrop,
  createScrollableViewport,
  createTextButton,
  formatHistoryLevelTitle,
  formatDurationMs,
  formatSubmittedAtLabel,
  type ScrollableViewportHandle,
  type TextButtonHandle,
} from '../ui'

type PauseOverlayData = {
  initialTab?: InGameMenuTab | null
}

type PauseMenuSection = Extract<InGameMenuTab, 'leaderboard' | 'history' | 'settings'>

type PauseCardLayout = {
  cardRect: LayoutRect
  contentRect: LayoutRect
  railRect: LayoutRect
  leaderboardY: number
  settingsY: number
  historyY: number
  retryY: number
  homeY: number
  resumeY: number
}

const MENU_BUTTON_FONT_SIZE = 20
const PAUSE_MENU_GREEN = {
  shellStroke: 0x78ad54,
  sectionStroke: 0x89ba61,
  railStroke: 0x78ad54,
  divider: 0x9cc76c,
} as const

export class PauseOverlayScene extends Phaser.Scene {
  private readonly bridge: AngryBirdsBridge
  private readonly onScaleResize = () => {
    if (this.sys.isActive()) {
      this.scene.restart({ initialTab: this.currentTab })
    }
  }
  private readonly teardownCallbacks: Array<() => void> = []
  private currentTab: PauseMenuSection = 'settings'
  private contentContainer?: Phaser.GameObjects.Container
  private cardObjects: Phaser.GameObjects.GameObject[] = []
  private buttonHandles: TextButtonHandle[] = []
  private sectionButtons = new Map<PauseMenuSection, TextButtonHandle>()
  private contentRect?: LayoutRect
  private scrollViewport?: ScrollableViewportHandle
  private brandFooter?: BrandFooterHandle

  constructor(bridge: AngryBirdsBridge) {
    super(SCENE_KEYS.pause)
    this.bridge = bridge
  }

  create(data?: PauseOverlayData) {
    this.currentTab = this.normalizeTab(data?.initialTab)
    syncSceneAudioSettings(this, this.bridge.getSettings())
    blockSceneMusic(this, 'pause-overlay')
    this.bridge.updateUiState({
      overlayRoute: 'pause-menu',
      activeMenuTab: this.currentTab,
    })

    createOverlayBackdrop(
      this,
      () => {
        this.resumeGame()
      },
      180,
    )
    this.brandFooter = createBrandFooter(this, { depth: 186 })

    const layout = this.buildPauseCardLayout()
    this.contentRect = createRect(0, 0, layout.contentRect.width, layout.contentRect.height)

    this.createPauseCard(layout)
    this.createMenuButtons(layout)

    this.contentContainer = this.add
      .container(layout.contentRect.left, layout.contentRect.top)
      .setDepth(200)
      .setScrollFactor(0)
    this.renderContent()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize)

    this.input.keyboard?.on('keydown-ESC', this.resumeGame, this)

    this.teardownCallbacks.push(
      this.bridge.on('chain:changed', () => this.renderContent()),
      this.bridge.on('wallet:state-changed', () => this.renderContent()),
      this.bridge.on('settings:changed', (settings) => {
        syncSceneAudioSettings(this, settings)
        this.renderContent()
      }),
      this.bridge.on('menu:open-request', ({ route, tab }) => {
        if (route === 'pause-menu' || route === null) {
          this.openTab(tab)
        }
      }),
      this.bridge.on('session:changed', (session) => {
        if (session.scene === 'title') {
          this.scene.stop(SCENE_KEYS.play)
          this.scene.stop(SCENE_KEYS.pause)
          this.scene.start(SCENE_KEYS.title)
          return
        }
        if (session.scene === 'play') {
          this.scene.stop(SCENE_KEYS.play)
          this.scene.stop(SCENE_KEYS.pause)
          this.scene.start(SCENE_KEYS.play)
        }
      }),
    )

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unblockSceneMusic(this, 'pause-overlay')
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize)
      this.input.keyboard?.off('keydown-ESC', this.resumeGame, this)
      if (this.bridge.getUiState().overlayRoute === 'pause-menu') {
        this.bridge.updateUiState({
          overlayRoute: null,
          activeMenuTab: null,
        })
      }
      this.teardownCallbacks.splice(0).forEach((callback) => callback())
      this.brandFooter?.destroy()
      this.scrollViewport?.destroy()
      this.contentContainer?.destroy(true)
      this.cardObjects.splice(0).forEach((object) => object.destroy())
      this.buttonHandles.splice(0).forEach((button) => button.destroy())
      this.sectionButtons.clear()
      this.contentContainer = undefined
      this.contentRect = undefined
      this.scrollViewport = undefined
      this.brandFooter = undefined
    })
  }

  private normalizeTab(tab: InGameMenuTab | null | undefined): PauseMenuSection {
    if (tab === 'leaderboard' || tab === 'history') {
      return tab
    }
    return 'settings'
  }

  private buildPauseCardLayout() {
    const viewport = createViewportLayout(this.scale.width, this.scale.height)
    const width = Phaser.Math.Clamp(viewport.width * 0.31, 380, 430)
    const topLimit = viewport.safeArea.top + 14
    const bottomLimit = viewport.safeArea.bottom - 14
    const availableHeight = Math.max(520, bottomLimit - topLimit)
    const desiredHeight = Phaser.Math.Clamp(viewport.height * 0.78, 540, 620)
    const height = Math.min(desiredHeight, availableHeight)
    const top = topLimit + Math.max(0, (availableHeight - height) / 2)
    const cardRect = createRect(viewport.centerX - width / 2, top, width, height)

    const sectionButtonHeight = 36
    const actionButtonHeight = 36
    const ctaButtonHeight = 54
    const buttonGap = 10
    const ctaGap = 14
    const bottomInset = 24

    const resumeY = cardRect.bottom - bottomInset - ctaButtonHeight / 2
    const homeY = resumeY - ctaButtonHeight / 2 - ctaGap - actionButtonHeight / 2
    const retryY = homeY - actionButtonHeight - buttonGap
    const historyY = retryY - sectionButtonHeight - buttonGap
    const settingsY = historyY - sectionButtonHeight - buttonGap
    const leaderboardY = settingsY - sectionButtonHeight - buttonGap

    const railTop = leaderboardY - sectionButtonHeight / 2 - 18
    const railBottom = cardRect.bottom - bottomInset + 10
    const contentRect = createRect(
      cardRect.left + 22,
      cardRect.top + 28,
      cardRect.width - 44,
      Math.max(156, railTop - cardRect.top - 44),
    )
    const railRect = createRect(cardRect.left + 18, railTop, cardRect.width - 36, railBottom - railTop)

    return {
      cardRect,
      contentRect,
      railRect,
      leaderboardY,
      settingsY,
      historyY,
      retryY,
      homeY,
      resumeY,
    } satisfies PauseCardLayout
  }

  private createPauseCard(layout: PauseCardLayout) {
    const { cardRect, contentRect, railRect } = layout
    this.cardObjects.push(
      ...createLeaguePanelShell(this, {
        cardRect,
        depth: 190,
        headerHighlightHeight: 56,
        shellRadius: 0,
        headerHighlightRadius: 0,
        palette: PAUSE_MENU_GREEN,
        surfaces: [
          {
            rect: contentRect,
            fill: 0xfcfff7,
            fillAlpha: 0.66,
            stroke: PAUSE_MENU_GREEN.sectionStroke,
            strokeAlpha: 0.88,
            radius: 0,
          },
          {
            rect: railRect,
            fill: 0xf2f9ec,
            fillAlpha: 0.62,
            stroke: PAUSE_MENU_GREEN.railStroke,
            strokeAlpha: 0.84,
            radius: 0,
          },
        ],
      }),
    )
  }

  private createMenuButtons(layout: PauseCardLayout) {
    const unifiedWidth = Phaser.Math.Clamp(layout.cardRect.width * 0.7, 236, 292)
    const buttonCenterX = layout.cardRect.centerX

    const createButton = (config: {
      label: string
      y: number
      onClick: () => void
      variant?: 'primary' | 'secondary' | 'tab'
      height?: number
    }) => {
      const handle = createTextButton(this, {
        x: buttonCenterX,
        y: config.y,
        width: unifiedWidth,
        height: config.height ?? 36,
        label: config.label,
        onClick: config.onClick,
        variant: config.variant ?? 'secondary',
        fontSize: MENU_BUTTON_FONT_SIZE,
        depth: 201,
        scrollFactor: 0,
      })
      this.buttonHandles.push(handle)
      return handle
    }

    ;(
      [
        { key: 'leaderboard', label: '排行', y: layout.leaderboardY },
        { key: 'settings', label: '设置', y: layout.settingsY },
        { key: 'history', label: '历史成绩', y: layout.historyY },
      ] as const
    ).forEach((button) => {
      const handle = createButton({
        label: button.label,
        y: button.y,
        onClick: () => this.bridge.requestOpenMenu(button.key, 'pause-menu'),
        variant: 'tab',
      })
      this.sectionButtons.set(button.key, handle)
    })

    createButton({
      label: '重新开始',
      y: layout.retryY,
      onClick: () => {
        this.bridge.requestRestartLevel()
      },
      variant: 'secondary',
    })
    createButton({
      label: '返回首页',
      y: layout.homeY,
      onClick: () => {
        this.bridge.returnHome()
      },
      variant: 'secondary',
    })
    createButton({
      label: '继续游戏',
      y: layout.resumeY,
      onClick: () => this.resumeGame(),
      variant: 'primary',
      height: 54,
    })
  }

  private resumeGame() {
    playMenuCloseSound(this, this.time.now)
    this.bridge.updateUiState({
      overlayRoute: null,
      activeMenuTab: null,
    })
    this.scene.stop(SCENE_KEYS.pause)
    this.scene.resume(SCENE_KEYS.play)
  }

  private openTab(tab: InGameMenuTab | null | undefined) {
    this.currentTab = this.normalizeTab(tab)
    this.bridge.updateUiState({
      overlayRoute: 'pause-menu',
      activeMenuTab: this.currentTab,
    })
    this.renderContent()
  }

  private renderContent() {
    if (!this.contentContainer || !this.contentRect) {
      return
    }

    this.scrollViewport?.destroy()
    this.scrollViewport = undefined
    this.contentContainer.removeAll(true)
    this.sectionButtons.forEach((button, tab) => {
      button.setSelected(tab === this.currentTab)
    })

    const contentObjects =
      this.currentTab === 'leaderboard'
        ? this.createLeaderboardContent(this.contentRect)
        : this.currentTab === 'history'
          ? this.createHistoryContent(this.contentRect)
          : this.createSettingsContent(this.contentRect)

    this.contentContainer.add(contentObjects)
  }

  private createSettingsContent(rect: LayoutRect) {
    const settings = this.bridge.getSettings()
    const objects: Phaser.GameObjects.GameObject[] = [this.createSectionTitle(rect, '设置')]
    objects.push(this.createSettingRow(rect, 0, '音乐', 'musicEnabled', settings.musicEnabled))
    objects.push(this.createSettingRow(rect, 1, '音效', 'sfxEnabled', settings.sfxEnabled))
    return objects
  }

  private createSettingRow(
    rect: LayoutRect,
    index: number,
    label: '音乐' | '音效',
    key: 'musicEnabled' | 'sfxEnabled',
    enabled: boolean,
  ) {
    const rowRect = createRect(14, 56 + index * 64, rect.width - 28, 44)
    const rowContainer = this.add.container(0, 0).setDepth(202).setScrollFactor(0)

    const rowBackground = this.add.graphics().setScrollFactor(0)
    rowBackground.fillStyle(0xfcfff8, 0.72)
    rowBackground.lineStyle(2, 0x9bc86f, 0.9)
    rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 0)
    rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 0)

    const rowLabel = this.add
      .text(rowRect.left + 14, rowRect.centerY, `${label} ${enabled ? '已开启' : '已关闭'}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '16px',
        fontStyle: '700',
        color: '#556c38',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    const toggleButton = createTextButton(this, {
      x: rowRect.right - 54,
      y: rowRect.centerY,
      width: 88,
      height: 34,
      label: enabled ? '关闭' : '开启',
      onClick: () => {
        this.bridge.requestSettingsUpdate({ [key]: !enabled })
      },
      variant: 'tab',
      fontSize: 16,
      depth: 203,
      scrollFactor: 0,
    })

    rowContainer.add([rowBackground, rowLabel, toggleButton.container])
    return rowContainer
  }

  private createLeaderboardContent(rect: LayoutRect) {
    const chain = this.bridge.getChainPanelState()
    const objects: Phaser.GameObjects.GameObject[] = [this.createSectionTitle(rect, '排行榜')]

    if (chain.leaderboardLoading) {
      objects.push(this.createCenteredContentText(rect, '排行榜同步中…'))
      return objects
    }
    if (chain.error) {
      objects.push(this.createCenteredContentText(rect, chain.error, '#a13d25'))
      return objects
    }
    if (chain.leaderboard.length === 0 && chain.leaderboardSyncMessage) {
      objects.push(this.createCenteredContentText(rect, chain.leaderboardSyncMessage))
      return objects
    }
    if (chain.leaderboard.length === 0) {
      objects.push(this.createCenteredContentText(rect, '当前还没有链上成绩'))
      return objects
    }

    if (!this.contentContainer) {
      return objects
    }

    const hasSyncHint = Boolean(chain.leaderboardSyncMessage)
    if (chain.leaderboardSyncMessage) {
      objects.push(this.createPanelSyncHint(rect, chain.leaderboardSyncMessage))
    }

    const viewportTop = hasSyncHint ? 72 : 52
    const viewportHeight = Math.max(72, rect.height - viewportTop - 4)
    const rowHeight = 52
    const rowGap = 10
    this.scrollViewport = createScrollableViewport(this, {
      parent: this.contentContainer,
      x: 0,
      y: viewportTop,
      width: rect.width,
      height: viewportHeight,
      depth: 202,
    })

    chain.leaderboard.forEach((row, index) => {
      const rowRect = createRect(14, index * (rowHeight + rowGap), rect.width - 28, rowHeight)
      this.scrollViewport?.content.add(this.createLeaderboardRow(rowRect, row))
    })
    this.scrollViewport.setContentHeight(Math.max(chain.leaderboard.length * (rowHeight + rowGap) - rowGap, 0))
    this.scrollViewport.scrollToTop()
    return objects
  }

  private createHistoryContent(rect: LayoutRect) {
    const chain = this.bridge.getChainPanelState()
    const wallet = this.bridge.getWalletState()
    const objects: Phaser.GameObjects.GameObject[] = [this.createSectionTitle(rect, '历史成绩')]

    if (!wallet.isConnected) {
      objects.push(this.createCenteredContentText(rect, '连接钱包后可查看历史成绩'))
      return objects
    }
    if (chain.historyLoading && chain.history.length === 0) {
      objects.push(this.createCenteredContentText(rect, '历史记录同步中…'))
      return objects
    }
    if (chain.error) {
      objects.push(this.createCenteredContentText(rect, chain.error, '#a13d25'))
      return objects
    }
    if (chain.history.length === 0 && chain.historySyncMessage) {
      objects.push(this.createCenteredContentText(rect, chain.historySyncMessage))
      return objects
    }
    if (chain.history.length === 0) {
      objects.push(this.createCenteredContentText(rect, '还没有历史成绩'))
      return objects
    }

    if (chain.historySyncMessage) {
      objects.push(this.createPanelSyncHint(rect, chain.historySyncMessage))
    }

    const historyRows = chain.history.slice(0, MAX_CHAIN_PANEL_ROWS)
    const viewportTop = chain.historySyncMessage ? 74 : 54
    const viewportHeight = Math.max(72, rect.height - viewportTop - 4)
    const rowHeight = 36
    const rowGap = 8
    const rowStep = rowHeight + rowGap
    this.scrollViewport = createScrollableViewport(this, {
      parent: this.contentContainer,
      x: 0,
      y: viewportTop,
      width: rect.width,
      height: viewportHeight,
      depth: 202,
    })

    historyRows.forEach((row, index) => {
      const rowRect = createRect(14, index * rowStep, rect.width - 28, rowHeight)
      this.scrollViewport?.content.add(this.createHistoryRow(rowRect, row))
    })
    this.scrollViewport.setContentHeight(Math.max(historyRows.length * rowStep - rowGap, 0))
    this.scrollViewport.scrollToTop()
    return objects
  }

  private createSectionTitle(rect: LayoutRect, label: string) {
    return this.add
      .text(rect.centerX, 24, label, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '22px',
        fontStyle: '700',
        color: '#486538',
      })
      .setOrigin(0.5)
      .setDepth(202)
      .setScrollFactor(0)
  }

  private createCenteredContentText(rect: LayoutRect, text: string, color = '#5a6f7f') {
    return this.add
      .text(rect.centerX, rect.centerY + 10, text, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '16px',
        color,
        align: 'center',
        wordWrap: { width: rect.width - 40 },
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(202)
      .setScrollFactor(0)
  }

  private createPanelSyncHint(rect: LayoutRect, text: string) {
    return this.add
      .text(rect.centerX, 50, text, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: '#738999',
        align: 'center',
        wordWrap: { width: rect.width - 38 },
      })
      .setOrigin(0.5)
      .setDepth(202)
      .setScrollFactor(0)
  }

  private createLeaderboardRow(rowRect: LayoutRect, row: LeaderboardRow) {
    const rowContainer = this.add.container(0, 0).setDepth(202).setScrollFactor(0)
    const rowBackground = this.add.graphics().setScrollFactor(0)
    rowBackground.fillStyle(0xfcfff8, 0.58)
    rowBackground.lineStyle(2, 0x92be67, 0.52)
    rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 0)
    rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 0)

    const titleText = this.add
      .text(rowRect.left + 12, rowRect.top + 16, `#${row.rank}  ${row.label}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: '#4d6636',
        wordWrap: { width: rowRect.width - 128 },
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    const submittedAtText = this.add
      .text(rowRect.right - 12, rowRect.top + 16, formatSubmittedAtLabel(row.submittedAt), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '11px',
        color: '#6d7f90',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)

    const detailText = this.add
      .text(rowRect.left + 12, rowRect.top + 35, `关卡 ${row.levelLabel} · ${row.birdsUsed} 鸟 · ${formatDurationMs(row.durationMs)}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '12px',
        color: '#5c7384',
        wordWrap: { width: rowRect.width - 24 },
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    rowContainer.add([rowBackground, titleText, submittedAtText, detailText])
    return rowContainer
  }

  private createHistoryRow(rowRect: LayoutRect, row: HistoryRow) {
    const rowContainer = this.add.container(0, 0).setDepth(202).setScrollFactor(0)
    const rowBackground = this.add.graphics().setScrollFactor(0)
    rowBackground.fillStyle(row.pending ? 0xf7f8e8 : 0xfcfff8, row.pending ? 0.72 : 0.58)
    rowBackground.lineStyle(2, row.pending ? 0xb6bb61 : 0x92be67, row.pending ? 0.7 : 0.52)
    rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 0)
    rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 0)

    const titleText = this.add
      .text(rowRect.left + 12, rowRect.centerY - 7, formatHistoryLevelTitle(row.levelLabel, row.levelId), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: row.pending ? '#7b5d1f' : '#4b6682',
        wordWrap: { width: rowRect.width - 128 },
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    const submittedAtText = this.add
      .text(rowRect.right - 12, rowRect.centerY - 7, row.pending ? '同步中' : formatSubmittedAtLabel(row.submittedAt), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '11px',
        color: row.pending ? '#9b7421' : '#6d7f90',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)

    const detailText = this.add
      .text(rowRect.left + 12, rowRect.centerY + 8, `${row.birdsUsed} 鸟 · ${row.destroyedPigs} 猪 · ${formatDurationMs(row.durationMs)}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '12px',
        color: row.pending ? '#866527' : '#5c7384',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    rowContainer.add([rowBackground, titleText, submittedAtText, detailText])
    return rowContainer
  }
}
