import Phaser from 'phaser'
import { ASSET_KEYS, getMapMeta } from '../assets'
import {
  noteSceneInteraction,
  playMenuCloseSound,
  playMenuOpenSound,
  syncSceneAudioSettings,
} from '../audio'
import { AngryBirdsBridge } from '../bridge'
import { createBrandFooter, type BrandFooterHandle } from '../brandFooter'
import { createRect, createViewportLayout, type LayoutRect } from '../layout'
import {
  getReplayableLevels as getReplayableLevelList,
  resolveReplaySelection as pickReplaySelection,
} from '../replaySelector'
import { SCENE_KEYS } from '../sceneKeys'
import { buildHomeSubmissionCopy } from '../submissionCopy'
import type { HistoryRow, InGameMenuTab, LeaderboardRow, LevelCatalogEntry } from '../types'
import {
  MAX_CHAIN_PANEL_ROWS,
  createLeaguePanelShell,
  createScrollableViewport,
  createTextButton,
  formatHistoryLevelTitle,
  formatDurationMs,
  formatSubmittedAtLabel,
  type ScrollableViewportHandle,
  type TextButtonHandle,
} from '../ui'

type HomeSection = 'default' | 'leaderboard' | 'settings' | 'history' | 'wallet'
type SectionButtonKey = Extract<InGameMenuTab, 'leaderboard' | 'settings' | 'history'>
type HomeCardLayout = {
  cardRect: LayoutRect
  contentRect: LayoutRect
  railRect: LayoutRect
  compact: boolean
  headerHighlightHeight: number
  dividerY: number
  hintY: number
  detailY: number
  leaderboardY: number
  settingsY: number
  historyY: number
  ctaY: number
}

const HOME_CARD_BUTTON_FONT_SIZE = 20

export class TitleScene extends Phaser.Scene {
  private readonly bridge: AngryBirdsBridge
  private readonly onPointerDown = () => {
    noteSceneInteraction(this)
  }
  private readonly onScaleResize = () => {
    if (this.sys.isActive()) {
      this.scene.restart()
    }
  }
  private readonly teardownCallbacks: Array<() => void> = []
  private mainCardObjects: Phaser.GameObjects.GameObject[] = []
  private contentObjects: Phaser.GameObjects.GameObject[] = []
  private contentContainer?: Phaser.GameObjects.Container
  private walletChipBackground?: Phaser.GameObjects.Graphics
  private walletChipText?: Phaser.GameObjects.Text
  private walletChipZone?: Phaser.GameObjects.Zone
  private heroHintText?: Phaser.GameObjects.Text
  private heroDetailText?: Phaser.GameObjects.Text
  private sectionButtons = new Map<SectionButtonKey, TextButtonHandle>()
  private ctaButton?: TextButtonHandle
  private contentRect?: LayoutRect
  private activeSection: HomeSection = 'default'
  private scrollViewport?: ScrollableViewportHandle
  private selectedReplayLevelId: string | null = null
  private brandFooter?: BrandFooterHandle

  constructor(bridge: AngryBirdsBridge) {
    super(SCENE_KEYS.title)
    this.bridge = bridge
  }

  private readonly wrapTextByTokens = (text: string, textObject: Phaser.GameObjects.Text) => {
    const wrapWidth = textObject.style.wordWrapWidth
    if (!wrapWidth || wrapWidth <= 0) {
      return text
    }

    return text
      .split('\n')
      .map((line) => this.wrapTextLineByTokens(line, wrapWidth, textObject))
      .join('\n')
  }

  private wrapTextLineByTokens(text: string, wrapWidth: number, textObject: Phaser.GameObjects.Text) {
    if (text.length === 0) {
      return text
    }

    const tokens = text.match(/[\u4e00-\u9fff]|[^\u4e00-\u9fff\s]+|\s+/g) ?? [text]
    const lines: string[] = []
    let currentLine = ''

    for (const token of tokens) {
      const candidate = currentLine + token
      const candidateWidth = textObject.context.measureText(candidate).width
      if (currentLine && candidateWidth > wrapWidth) {
        lines.push(currentLine.trimEnd())
        currentLine = token.trimStart()
        continue
      }
      currentLine = candidate
    }

    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trimEnd())
    }

    return lines.join('\n')
  }

  create() {
    const initialSession = this.bridge.getSession()
    if (initialSession.scene === 'play' && initialSession.currentLevelId) {
      this.scene.start(SCENE_KEYS.play)
      return
    }

    const mapMeta = getMapMeta(this)
    const viewport = createViewportLayout(this.scale.width, this.scale.height)
    const titleBackgroundSource = this.textures.get(ASSET_KEYS.titleBackground).getSourceImage() as {
      width: number
      height: number
    }
    const titleBackgroundScale = Math.max(
      viewport.width / titleBackgroundSource.width,
      viewport.height / titleBackgroundSource.height,
    )
    const titleCompact = viewport.height < 680
    const titleText = mapMeta.title
    const isLongProjectTitle = titleText.length > 15
    const titleScale = Phaser.Math.Clamp(Math.min(viewport.width / 1280, viewport.height / 720), 0.74, 1.04)
    const titleFontSize = Math.round(
      Phaser.Math.Clamp((isLongProjectTitle ? 45 : 54) * titleScale, isLongProjectTitle ? 34 : 42, isLongProjectTitle ? 50 : 58),
    )
    const titleLetterSpacing = isLongProjectTitle ? 1 : 3
    const titleTop = viewport.safeArea.top + (titleCompact ? 34 : 44)
    const subtitleFontSize = titleCompact ? 20 : 24
    const subtitleY = titleTop + (titleCompact ? 46 : 54)
    const titleFillColor = '#fff9ea'
    const titleStrokeColor = '#17344c'
    const titleShadowColor = '#8a6228'

    this.bridge.updateUiState({
      overlayRoute: null,
      activeMenuTab: null,
    })
    syncSceneAudioSettings(this, this.bridge.getSettings())
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown)

    this.add
      .image(viewport.centerX, viewport.centerY, ASSET_KEYS.titleBackground)
      .setScale(titleBackgroundScale)
      .setScrollFactor(0)

    this.add
      .text(viewport.centerX + 4, titleTop + 6, titleText, {
        fontFamily: '"Avenir Next", "Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: `${titleFontSize}px`,
        fontStyle: '900',
        color: titleShadowColor,
        stroke: titleStrokeColor,
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setLetterSpacing(titleLetterSpacing)
    this.add
      .text(viewport.centerX, titleTop, titleText, {
        fontFamily: '"Avenir Next", "Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: `${titleFontSize}px`,
        fontStyle: '900',
        color: titleFillColor,
        stroke: titleStrokeColor,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setShadow(0, 4, titleShadowColor, 2, false, true)
      .setDepth(10)
      .setLetterSpacing(titleLetterSpacing)

    this.add
      .text(viewport.centerX + 3, subtitleY + 4, mapMeta.subtitle, {
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        fontSize: `${subtitleFontSize}px`,
        fontStyle: '700',
        color: titleShadowColor,
        stroke: titleStrokeColor,
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setLetterSpacing(1)

    this.add
      .text(viewport.centerX, subtitleY, mapMeta.subtitle, {
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        fontSize: `${subtitleFontSize}px`,
        fontStyle: '700',
        color: titleFillColor,
        stroke: titleStrokeColor,
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, titleShadowColor, 1, false, true)
      .setDepth(10)
      .setLetterSpacing(1)

    this.brandFooter = createBrandFooter(this, { projectTitle: mapMeta.title, depth: 12 })
    this.createWalletChip(viewport)

    const layout = this.buildHomeCardLayout(viewport)
    this.contentRect = createRect(0, 0, layout.contentRect.width, layout.contentRect.height)
    this.createHomeCard(layout)
    this.contentContainer = this.add
      .container(layout.contentRect.left, layout.contentRect.top)
      .setDepth(23)
      .setScrollFactor(0)

    this.heroHintText = this.add
      .text(layout.cardRect.centerX, layout.hintY, '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: layout.compact ? '15px' : '16px',
        fontStyle: '700',
        color: '#53697a',
        align: 'center',
        wordWrap: {
          width: layout.cardRect.width - 90,
          callback: this.wrapTextByTokens,
          callbackScope: this,
        },
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setScrollFactor(0)

    this.heroDetailText = this.add
      .text(layout.cardRect.centerX, layout.detailY, '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: layout.compact ? '12px' : '13px',
        color: '#728693',
        align: 'center',
        wordWrap: {
          width: layout.cardRect.width - 98,
          callback: this.wrapTextByTokens,
          callbackScope: this,
        },
        lineSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setScrollFactor(0)

    this.createSectionButtons(layout)
    this.createCtaButton(layout)
    this.refreshState()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize)

    this.teardownCallbacks.push(
      this.bridge.on('wallet:state-changed', () => this.refreshState()),
      this.bridge.on('progress:changed', () => this.refreshState()),
      this.bridge.on('settings:changed', (settings) => {
        syncSceneAudioSettings(this, settings)
        this.refreshState()
      }),
      this.bridge.on('submission:state-changed', () => this.refreshState()),
      this.bridge.on('chain:changed', () => this.refreshState()),
      this.bridge.on('menu:open-request', ({ route, tab }) => {
        if (route === 'home-menu') {
          this.openSection(tab)
          return
        }
        if (route === null) {
          this.setActiveSection('default')
        }
      }),
      this.bridge.on('session:changed', (session) => {
        if (session.scene === 'play' && session.currentLevelId) {
          this.scene.start(SCENE_KEYS.play)
          return
        }
        if (session.scene === 'title') {
          this.refreshState()
        }
      }),
    )

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize)
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown)
      this.mainCardObjects.splice(0).forEach((object) => object.destroy())
      this.brandFooter?.destroy()
      this.scrollViewport?.destroy()
      this.contentContainer?.destroy(true)
      this.contentObjects = []
      this.walletChipBackground?.destroy()
      this.walletChipText?.destroy()
      this.walletChipZone?.destroy()
      this.heroHintText?.destroy()
      this.heroDetailText?.destroy()
      this.sectionButtons.forEach((button) => button.destroy())
      this.sectionButtons.clear()
      this.ctaButton?.destroy()
      this.teardownCallbacks.splice(0).forEach((callback) => callback())
      this.brandFooter = undefined
      this.contentContainer = undefined
      this.scrollViewport = undefined
    })
  }

  private buildHomeCardLayout(viewport: ReturnType<typeof createViewportLayout>): HomeCardLayout {
    const cardRect = this.buildHomeCardRect(viewport)
    const compact = viewport.height < 680 || cardRect.height < 520
    const headerHeight = compact ? 94 : 108
    const headerHighlightHeight = compact ? 72 : 86
    const hintY = cardRect.top + (compact ? 38 : 45)
    const detailY = cardRect.top + (compact ? 60 : 69)
    const dividerY = cardRect.top + (compact ? 78 : 92)
    const sectionButtonHeight = compact ? 34 : 36
    const sectionButtonGap = compact ? 8 : 10
    const ctaHeight = compact ? 50 : 54
    const ctaGap = compact ? 12 : 14
    const bottomInset = compact ? 18 : 24
    const contentTop = cardRect.top + headerHeight

    const ctaY = cardRect.bottom - bottomInset - ctaHeight / 2
    const historyY = ctaY - ctaHeight / 2 - ctaGap - sectionButtonHeight / 2
    const settingsY = historyY - sectionButtonHeight - sectionButtonGap
    const leaderboardY = settingsY - sectionButtonHeight - sectionButtonGap
    const railTop = leaderboardY - sectionButtonHeight / 2 - (compact ? 16 : 20)
    const railBottom = cardRect.bottom - bottomInset + (compact ? 6 : 10)
    const contentBottom = railTop - (compact ? 12 : 18)
    const contentRect = createRect(
      cardRect.left + 22,
      contentTop,
      cardRect.width - 44,
      Math.max(compact ? 92 : 108, contentBottom - contentTop),
    )
    const railRect = createRect(cardRect.left + 18, railTop, cardRect.width - 36, railBottom - railTop)

    return {
      cardRect,
      contentRect,
      railRect,
      compact,
      headerHighlightHeight,
      dividerY,
      hintY,
      detailY,
      leaderboardY,
      settingsY,
      historyY,
      ctaY,
    }
  }

  private buildHomeCardRect(viewport: ReturnType<typeof createViewportLayout>) {
    const compact = viewport.height < 680
    const width = Phaser.Math.Clamp(viewport.width * (compact ? 0.27 : 0.29), compact ? 340 : 356, 430)
    const topLimit = viewport.safeArea.top + (compact ? 126 : 154)
    const bottomLimit = viewport.safeArea.bottom - (compact ? 46 : 52)
    const availableHeight = Math.max(compact ? 380 : 420, bottomLimit - topLimit)
    const desiredHeight = Phaser.Math.Clamp(viewport.height * (compact ? 0.7 : 0.72), compact ? 430 : 500, 620)
    const height = Math.min(desiredHeight, availableHeight)
    const top = topLimit + Math.max(0, (availableHeight - height) / 2)
    return createRect(viewport.centerX - width / 2, top, width, height)
  }

  private createHomeCard(layout: HomeCardLayout) {
    const { cardRect, contentRect, railRect, headerHighlightHeight, dividerY } = layout
    this.mainCardObjects.push(
      ...createLeaguePanelShell(this, {
        cardRect,
        depth: 14,
        headerHighlightHeight,
        dividerY,
        shellRadius: 0,
        headerHighlightRadius: 0,
        palette: {
          shellStroke: 0x7fae58,
          divider: 0x9cc66b,
          sectionStroke: 0x90bb62,
          railStroke: 0x7fae58,
        },
        surfaces: [
          {
            rect: contentRect,
            fill: 0xfffcf3,
            fillAlpha: 0.62,
            stroke: 0x90bb62,
            strokeAlpha: 0.88,
            radius: 0,
          },
          {
            rect: railRect,
            fill: 0xeff4eb,
            fillAlpha: 0.56,
            stroke: 0x7fae58,
            strokeAlpha: 0.84,
            radius: 0,
          },
        ],
      }),
    )
  }

  private createWalletChip(viewport: ReturnType<typeof createViewportLayout>) {
    this.walletChipBackground = this.add.graphics().setDepth(19).setScrollFactor(0)
    this.walletChipText = this.add
      .text(0, 0, '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: '#3d4d24',
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0)

    this.walletChipZone = this.add
      .zone(viewport.safeArea.right - 120, viewport.safeArea.top + 38, 210, 38)
      .setDepth(21)
      .setScrollFactor(0)
    this.walletChipZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.bridge.getWalletState().isConnected) {
        this.bridge.requestWalletDisconnect()
      }
    })
  }

  private refreshWalletChip() {
    if (!this.walletChipBackground || !this.walletChipText || !this.walletChipZone) {
      return
    }

    const viewport = createViewportLayout(this.scale.width, this.scale.height)
    const wallet = this.bridge.getWalletState()
    const label = wallet.isConnecting ? '钱包连接中…' : wallet.isConnected ? `钱包 ${wallet.label}` : '钱包未连接'
    this.walletChipText.setText(label)

    const width = Phaser.Math.Clamp(this.walletChipText.width + 34, 132, 238)
    const height = 38
    const centerX = viewport.safeArea.right - width / 2
    const centerY = viewport.safeArea.top + 38
    const fill = wallet.isConnected ? 0xf6fff0 : wallet.isConnecting ? 0xfef8e8 : 0xffffff
    const fillAlpha = wallet.isConnected ? 0.93 : wallet.isConnecting ? 0.92 : 0.84
    const stroke = wallet.isConnected ? 0xa5cf73 : wallet.isConnecting ? 0xd1b16a : 0xcfe4f0

    this.walletChipBackground.clear()
    this.walletChipBackground.fillStyle(0x173246, 0.12)
    this.walletChipBackground.fillRoundedRect(centerX - width / 2 + 2, centerY - height / 2 + 4, width, height, 18)
    this.walletChipBackground.fillStyle(fill, fillAlpha)
    this.walletChipBackground.lineStyle(2, stroke, 0.96)
    this.walletChipBackground.fillRoundedRect(centerX - width / 2, centerY - height / 2, width, height, 18)
    this.walletChipBackground.strokeRoundedRect(centerX - width / 2, centerY - height / 2, width, height, 18)

    this.walletChipText.setPosition(centerX, centerY)
    this.walletChipZone.setPosition(centerX, centerY)
    this.walletChipZone.setSize(width, height)

    if (wallet.isConnected) {
      this.walletChipZone.setInteractive({ useHandCursor: true })
    } else if (this.walletChipZone.input) {
      this.walletChipZone.removeInteractive()
    }
  }

  private createSectionButtons(layout: HomeCardLayout) {
    const { cardRect, leaderboardY, settingsY, historyY } = layout
    const buttonCenterX = cardRect.centerX
    const unifiedWidth = Phaser.Math.Clamp(cardRect.width * 0.7, 236, 292)
    const buttonHeight = layout.compact ? 34 : 36
    const buttonFontSize = layout.compact ? 18 : HOME_CARD_BUTTON_FONT_SIZE

    const buttonConfigs: Array<{ key: SectionButtonKey; label: string; y: number }> = [
      { key: 'leaderboard', label: '排行', y: leaderboardY },
      { key: 'settings', label: '设置', y: settingsY },
      { key: 'history', label: '历史成绩', y: historyY },
    ]

    buttonConfigs.forEach((config) => {
      const button = createTextButton(this, {
        x: buttonCenterX,
        y: config.y,
        width: unifiedWidth,
        height: buttonHeight,
        label: config.label,
        onClick: () => this.toggleSection(config.key),
        variant: 'tab',
        fontSize: buttonFontSize,
        depth: 22,
        scrollFactor: 0,
      })
      this.sectionButtons.set(config.key, button)
    })
  }

  private createCtaButton(layout: HomeCardLayout) {
    const { cardRect, ctaY } = layout
    const ctaWidth = Phaser.Math.Clamp(cardRect.width * 0.7, 236, 292)
    this.ctaButton = createTextButton(this, {
      x: cardRect.centerX,
      y: ctaY,
      width: ctaWidth,
      height: layout.compact ? 50 : 54,
      label: '开始游戏',
      onClick: () => {
        const resumeLevel = this.bridge.getResumeLevel()
        if (!resumeLevel) {
          return
        }
        this.bridge.requestStartResumeLevel()
      },
      variant: 'tab',
      fontSize: layout.compact ? 18 : HOME_CARD_BUTTON_FONT_SIZE,
      depth: 22,
      scrollFactor: 0,
    })
  }

  private refreshState() {
    const levels = this.bridge.getLevels()
    const enabledLevels = levels.filter((level) => level.manifest.enabled)
    const progress = this.bridge.getProgress()
    const wallet = this.bridge.getWalletState()
    const submission = this.bridge.getSubmissionState()
    const resumeLevel = this.bridge.getResumeLevel()
    const clearedCount = enabledLevels.filter((level) => progress.completedLevelIds.includes(level.levelId)).length
    const campaignLevelCount = enabledLevels.length || levels.length
    const allCleared = campaignLevelCount > 0 && clearedCount >= campaignLevelCount
    const shouldContinue = clearedCount > 0 && !allCleared
    const isAuthorizing = submission.status === 'signing'
    const isFinalizingBlocking = submission.status === 'finalizing' && submission.queuedRuns > 0
    const copy = buildHomeSubmissionCopy({
      wallet,
      submission,
      hasResumeLevel: Boolean(resumeLevel),
      shouldContinue,
    })

    this.heroHintText?.setText(copy.hintText)
    this.heroDetailText?.setText(copy.detailText)
    this.heroDetailText?.setVisible(copy.detailText.trim().length > 0)
    this.ctaButton?.setLabel(copy.ctaLabel)
    this.ctaButton?.setDisabled(
      wallet.isConnecting || isAuthorizing || isFinalizingBlocking || (wallet.isConnected && !resumeLevel),
    )
    this.refreshWalletChip()
    this.renderSectionButtons()
    this.renderSectionContent()
  }

  private toggleSection(section: SectionButtonKey) {
    if (this.activeSection === section) {
      this.setActiveSection('default')
      return
    }

    this.bridge.requestOpenMenu(section, 'home-menu')
  }

  private openSection(section: InGameMenuTab | null) {
    if (!section) {
      this.setActiveSection('default')
      return
    }
    this.setActiveSection(section)
  }

  private setActiveSection(section: HomeSection) {
    const previousSection = this.activeSection
    this.activeSection = section
    if (previousSection === 'default' && section !== 'default') {
      playMenuOpenSound(this, this.time.now)
    } else if (previousSection !== 'default' && section === 'default') {
      playMenuCloseSound(this, this.time.now)
    }
    this.syncUiStateWithSection()
    this.renderSectionButtons()
    this.renderSectionContent()
  }

  private syncUiStateWithSection() {
    if (this.activeSection === 'default') {
      this.bridge.updateUiState({
        overlayRoute: null,
        activeMenuTab: null,
      })
      return
    }

    this.bridge.updateUiState({
      overlayRoute: 'home-menu',
      activeMenuTab: this.activeSection,
    })
  }

  private renderSectionButtons() {
    this.sectionButtons.forEach((button, key) => {
      button.setSelected(this.activeSection === key)
    })
  }

  private renderSectionContent() {
    const rect = this.contentRect
    if (!rect || !this.contentContainer) {
      return
    }

    this.scrollViewport?.destroy()
    this.scrollViewport = undefined
    this.contentContainer.removeAll(true)
    this.contentObjects = []

    switch (this.activeSection) {
      case 'leaderboard':
        this.renderLeaderboardContent(rect)
        break
      case 'settings':
        this.renderSettingsContent(rect)
        break
      case 'history':
        this.renderHistoryContent(rect)
        break
      case 'wallet':
        this.renderWalletContent(rect)
        break
      default:
        this.renderDefaultContent(rect)
        break
    }

    this.contentContainer.add(this.contentObjects)
  }

  private renderDefaultContent(rect: LayoutRect) {
    const wallet = this.bridge.getWalletState()
    const replayableLevels = this.getReplayableLevels()
    const selectedReplayLevel = this.resolveReplaySelection(replayableLevels)
    const levels = this.bridge.getLevels().filter((level) => level.manifest.enabled)
    const progress = this.bridge.getProgress()
    const clearedCount = levels.filter((level) => progress.completedLevelIds.includes(level.levelId)).length
    const allCleared = levels.length > 0 && clearedCount >= levels.length
    const shouldContinue = clearedCount > 0 && !allCleared

    if (wallet.isConnected && selectedReplayLevel && replayableLevels.length > 0) {
      this.renderReplaySelectorCard(rect, replayableLevels, selectedReplayLevel)
      return
    }

    const title = this.createSectionTitle(
      rect,
      !wallet.isConnected ? '连接钱包' : shouldContinue ? '继续挑战' : '开始挑战',
    )
    const body = this.add
      .text(
        rect.centerX,
        rect.centerY + 10,
        !wallet.isConnected
          ? '连接钱包后即可进入关卡，并保存你的挑战成绩。'
          : shouldContinue
            ? '继续当前进度即可，新的通关成绩会先保存，再自动完成同步。'
            : '进入第一关后会先准备好本次冒险的成绩保存。',
        {
          fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
          fontSize: '16px',
          color: '#5b7281',
          align: 'center',
          wordWrap: {
            width: rect.width - 64,
            callback: this.wrapTextByTokens,
            callbackScope: this,
          },
          lineSpacing: 5,
        },
      )
      .setOrigin(0.5)
      .setDepth(23)
      .setScrollFactor(0)

    this.contentObjects.push(title, body)
  }

  private renderReplaySelectorCard(
    rect: LayoutRect,
    replayableLevels: LevelCatalogEntry[],
    selectedReplayLevel: LevelCatalogEntry,
  ) {
    const selectedIndex = replayableLevels.findIndex((level) => level.levelId === selectedReplayLevel.levelId)
    const compact = rect.height < 156
    const cardRect = createRect(rect.left + 10, rect.top + 8, rect.width - 20, rect.height - 16)
    const buttonGap = compact ? 8 : 10
    const replayButtonBaseWidth = compact ? 114 : 128
    const sideButtonWidth = Phaser.Math.Clamp((cardRect.width - buttonGap * 2 - replayButtonBaseWidth) / 2, 68, 92)
    const replayButtonWidth = cardRect.width - sideButtonWidth * 2 - buttonGap * 2
    const buttonHeight = compact ? 30 : 34
    const buttonY = cardRect.bottom - (compact ? 20 : 24)
    const footerLabelY = buttonY - (compact ? 24 : 28)
    const titleTop = compact ? cardRect.top + 30 : cardRect.top + 34
    const descriptionTop = compact ? titleTop + 26 : titleTop + 30
    const displayTitle = selectedReplayLevel.map.title?.trim() || selectedReplayLevel.levelId
    const levelTitle = selectedReplayLevel.map.label
      ? `第 ${selectedReplayLevel.map.label} 关 · ${displayTitle}`
      : displayTitle
    const levelDescription = selectedReplayLevel.map.description?.trim() || selectedReplayLevel.levelId

    const cardBackground = this.add.graphics().setDepth(23).setScrollFactor(0)
    cardBackground.fillStyle(0xffffff, 0.5)
    cardBackground.lineStyle(2, 0x9db97c, 0.4)
    cardBackground.fillRoundedRect(cardRect.left, cardRect.top, cardRect.width, cardRect.height, 20)
    cardBackground.strokeRoundedRect(cardRect.left, cardRect.top, cardRect.width, cardRect.height, 20)

    const cardHighlight = this.add.graphics().setDepth(23).setScrollFactor(0)
    cardHighlight.fillStyle(0xf7fff2, 0.36)
    cardHighlight.fillRoundedRect(cardRect.left + 10, cardRect.top + 10, cardRect.width - 20, compact ? 34 : 38, 16)

    const sectionTitle = this.add
      .text(cardRect.centerX, cardRect.top + (compact ? 17 : 19), '已通关关卡', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '13px' : '14px',
        fontStyle: '700',
        color: '#5e7447',
      })
      .setOrigin(0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const levelTitleText = this.add
      .text(cardRect.centerX, titleTop, levelTitle, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '16px' : '18px',
        fontStyle: '700',
        color: '#44622f',
        align: 'center',
        wordWrap: { width: cardRect.width - 34 },
      })
      .setOrigin(0.5, 0)
      .setDepth(24)
      .setScrollFactor(0)

    const descriptionText = this.add
      .text(cardRect.centerX, descriptionTop, levelDescription, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '12px' : '13px',
        color: '#5d7380',
        align: 'center',
        wordWrap: { width: cardRect.width - 36 },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(24)
      .setScrollFactor(0)

    const helperText = this.add
      .text(cardRect.centerX, footerLabelY, `已通关 ${replayableLevels.length} 关，可随时回刷`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '11px' : '12px',
        color: '#708391',
      })
      .setOrigin(0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const previousButton = createTextButton(this, {
      x: cardRect.left + sideButtonWidth / 2,
      y: buttonY,
      width: sideButtonWidth,
      height: buttonHeight,
      label: '上一关',
      onClick: () => this.shiftReplaySelection(-1),
      variant: 'secondary',
      disabled: selectedIndex <= 0,
      fontSize: compact ? 13 : 14,
      depth: 24,
      scrollFactor: 0,
    })

    const replayButton = createTextButton(this, {
      x: cardRect.left + sideButtonWidth + buttonGap + replayButtonWidth / 2,
      y: buttonY,
      width: replayButtonWidth,
      height: buttonHeight,
      label: '重玩此关',
      onClick: () => {
        this.bridge.requestStartLevel(selectedReplayLevel.levelId)
      },
      variant: 'primary',
      fontSize: compact ? 14 : 15,
      depth: 24,
      scrollFactor: 0,
    })

    const nextButton = createTextButton(this, {
      x: cardRect.right - sideButtonWidth / 2,
      y: buttonY,
      width: sideButtonWidth,
      height: buttonHeight,
      label: '下一关',
      onClick: () => this.shiftReplaySelection(1),
      variant: 'secondary',
      disabled: selectedIndex >= replayableLevels.length - 1,
      fontSize: compact ? 13 : 14,
      depth: 24,
      scrollFactor: 0,
    })

    this.contentObjects.push(
      cardBackground,
      cardHighlight,
      sectionTitle,
      levelTitleText,
      descriptionText,
      helperText,
      previousButton.container,
      replayButton.container,
      nextButton.container,
    )
  }

  private getReplayableLevels() {
    return getReplayableLevelList(this.bridge.getLevels(), this.bridge.getProgress())
  }

  private resolveReplaySelection(replayableLevels: LevelCatalogEntry[]) {
    this.selectedReplayLevelId = pickReplaySelection({
      replayableLevels,
      selectedReplayLevelId: this.selectedReplayLevelId,
      currentLevelId: this.bridge.getSession().currentLevelId,
    })

    return replayableLevels.find((level) => level.levelId === this.selectedReplayLevelId) ?? null
  }

  private shiftReplaySelection(step: -1 | 1) {
    const replayableLevels = this.getReplayableLevels()
    const selectedReplayLevel = this.resolveReplaySelection(replayableLevels)
    if (!selectedReplayLevel) {
      return
    }

    const currentIndex = replayableLevels.findIndex((level) => level.levelId === selectedReplayLevel.levelId)
    const nextLevel = replayableLevels[currentIndex + step]
    if (!nextLevel) {
      return
    }

    this.selectedReplayLevelId = nextLevel.levelId
    this.renderSectionContent()
  }

  private renderLeaderboardContent(rect: LayoutRect) {
    const chain = this.bridge.getChainPanelState()
    const title = this.createSectionTitle(rect, '排行榜')
    this.contentObjects.push(title)

    if (chain.leaderboardLoading) {
      this.contentObjects.push(this.createCenteredContentText(rect, '排行榜同步中…'))
      return
    }
    if (chain.error) {
      this.contentObjects.push(this.createCenteredContentText(rect, chain.error, '#a13d25'))
      return
    }
    if (chain.leaderboard.length === 0 && chain.leaderboardSyncMessage) {
      this.contentObjects.push(this.createCenteredContentText(rect, chain.leaderboardSyncMessage))
      return
    }
    if (chain.leaderboard.length === 0) {
      this.contentObjects.push(this.createCenteredContentText(rect, '当前还没有链上成绩。'))
      return
    }

    if (!this.contentContainer) {
      return
    }

    const hasSyncHint = Boolean(chain.leaderboardSyncMessage)
    if (chain.leaderboardSyncMessage) {
      this.contentObjects.push(this.createPanelSyncHint(rect, chain.leaderboardSyncMessage))
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
      depth: 23,
    })

    chain.leaderboard.forEach((row, index) => {
      const rowRect = createRect(14, index * (rowHeight + rowGap), rect.width - 28, rowHeight)
      this.scrollViewport?.content.add(this.createLeaderboardRow(rowRect, row))
    })
    this.scrollViewport.setContentHeight(Math.max(chain.leaderboard.length * (rowHeight + rowGap) - rowGap, 0))
    this.scrollViewport.scrollToTop()
  }

  private renderHistoryContent(rect: LayoutRect) {
    const chain = this.bridge.getChainPanelState()
    const wallet = this.bridge.getWalletState()
    const compact = rect.height < 160
    const rowHeight = compact ? 30 : 36
    const rowGap = compact ? 4 : 4
    const hasSyncHint = Boolean(chain.historySyncMessage)
    const title = this.createSectionTitle(rect, '历史成绩')
    this.contentObjects.push(title)

    if (!wallet.isConnected) {
      this.contentObjects.push(this.createCenteredContentText(rect, '连接钱包后可查看历史成绩。'))
      return
    }
    if (chain.historyLoading && chain.history.length === 0) {
      this.contentObjects.push(this.createCenteredContentText(rect, '历史记录同步中…'))
      return
    }
    if (chain.error) {
      this.contentObjects.push(this.createCenteredContentText(rect, chain.error, '#a13d25'))
      return
    }
    if (chain.history.length === 0 && chain.historySyncMessage) {
      this.contentObjects.push(this.createCenteredContentText(rect, chain.historySyncMessage))
      return
    }
    if (chain.history.length === 0) {
      this.contentObjects.push(this.createCenteredContentText(rect, '还没有历史成绩记录。'))
      return
    }

    if (chain.historySyncMessage) {
      this.contentObjects.push(this.createPanelSyncHint(rect, chain.historySyncMessage))
    }

    const historyRows = chain.history.slice(0, MAX_CHAIN_PANEL_ROWS)
    const viewportTop = compact ? (hasSyncHint ? 64 : 46) : hasSyncHint ? 72 : 52
    const viewportHeight = Math.max(72, rect.height - viewportTop - 4)
    const rowStep = rowHeight + rowGap
    this.scrollViewport = createScrollableViewport(this, {
      parent: this.contentContainer,
      x: 0,
      y: viewportTop,
      width: rect.width,
      height: viewportHeight,
      depth: 23,
    })

    historyRows.forEach((row, index) => {
      const rowRect = createRect(14, index * rowStep, rect.width - 28, rowHeight)
      this.scrollViewport?.content.add(this.createHistoryRow(rowRect, row))
    })
    this.scrollViewport.setContentHeight(Math.max(historyRows.length * rowStep - rowGap, 0))
    this.scrollViewport.scrollToTop()
  }

  private renderWalletContent(rect: LayoutRect) {
    const wallet = this.bridge.getWalletState()
    const title = this.createSectionTitle(rect, '钱包状态')
    const body = this.add
      .text(
        rect.centerX,
        rect.centerY + 2,
        wallet.isConnected
          ? `当前已连接 ${wallet.label}\n点击右上角状态条可断开钱包。`
          : wallet.isConnecting
            ? '钱包连接中，请稍候…'
            : '当前未连接钱包。\n点击底部主按钮即可连接。',
        {
          fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
          fontSize: '16px',
          color: '#5a7082',
          align: 'center',
          wordWrap: { width: rect.width - 40 },
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5)
      .setDepth(23)
      .setScrollFactor(0)

    this.contentObjects.push(title, body)
  }

  private renderSettingsContent(rect: LayoutRect) {
    const settings = this.bridge.getSettings()
    const title = this.createSectionTitle(rect, '设置')
    this.contentObjects.push(title)

    this.renderSettingRow(rect, 0, '音乐', 'musicEnabled', settings.musicEnabled)
    this.renderSettingRow(rect, 1, '音效', 'sfxEnabled', settings.sfxEnabled)
  }

  private renderSettingRow(
    rect: LayoutRect,
    index: number,
    label: '音乐' | '音效',
    key: 'musicEnabled' | 'sfxEnabled',
    enabled: boolean,
  ) {
    const compact = rect.height < 160
    const rowHeight = compact ? 40 : 44
    const rowGap = compact ? 48 : 56
    const rowRect = createRect(rect.left + 14, rect.top + (compact ? 48 : 54) + index * rowGap, rect.width - 28, rowHeight)
    const rowBackground = this.add.graphics().setDepth(23).setScrollFactor(0)
    rowBackground.fillStyle(0xffffff, 0.5)
    rowBackground.lineStyle(2, 0xe0efe7, 0.82)
    rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 16)
    rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 16)

    const rowLabel = this.add
      .text(rowRect.left + 14, rowRect.centerY, `${label} ${enabled ? '已开启' : '已关闭'}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '16px',
        fontStyle: '700',
        color: '#556c38',
      })
      .setOrigin(0, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const toggleButton = createTextButton(this, {
      x: rowRect.right - 54,
      y: rowRect.centerY,
      width: 88,
      height: compact ? 32 : 34,
      label: enabled ? '关闭' : '开启',
      onClick: () => {
        this.bridge.requestSettingsUpdate({ [key]: !enabled })
      },
      variant: 'secondary',
      fontSize: 16,
      depth: 24,
      scrollFactor: 0,
    })

    this.contentObjects.push(rowBackground, rowLabel, toggleButton.container)
  }

  private createSectionTitle(rect: LayoutRect, label: string) {
    return this.add
      .text(rect.centerX, rect.top + 24, label, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '22px',
        fontStyle: '700',
        color: '#486538',
      })
      .setOrigin(0.5)
      .setDepth(23)
      .setScrollFactor(0)
  }

  private createCenteredContentText(rect: LayoutRect, text: string, color = '#5a6f7f') {
    return this.add
      .text(rect.centerX, rect.centerY + 12, text, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '16px',
        color,
        align: 'center',
        wordWrap: {
          width: rect.width - 52,
          callback: this.wrapTextByTokens,
          callbackScope: this,
        },
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(23)
      .setScrollFactor(0)
  }

  private createPanelSyncHint(rect: LayoutRect, text: string) {
    return this.add
      .text(rect.centerX, rect.top + 50, text, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: '#738999',
        align: 'center',
        wordWrap: {
          width: rect.width - 48,
          callback: this.wrapTextByTokens,
          callbackScope: this,
        },
      })
      .setOrigin(0.5)
      .setDepth(23)
      .setScrollFactor(0)
  }

  private createLeaderboardRow(rowRect: LayoutRect, row: LeaderboardRow) {
    const rowContainer = this.add.container(0, 0).setDepth(24).setScrollFactor(0)
    const rowBackground = this.add.graphics().setDepth(23).setScrollFactor(0)
    rowBackground.fillStyle(0xffffff, 0.48)
    rowBackground.lineStyle(2, 0xa5d179, 0.34)
    rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 18)
    rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 18)

    const titleText = this.add
      .text(rowRect.left + 12, rowRect.top + 16, `#${row.rank}  ${row.label}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: '#4d6636',
        wordWrap: { width: rowRect.width - 128 },
      })
      .setOrigin(0, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const submittedAtText = this.add
      .text(rowRect.right - 12, rowRect.top + 16, formatSubmittedAtLabel(row.submittedAt), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '11px',
        color: '#6d7f90',
      })
      .setOrigin(1, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const detailText = this.add
      .text(rowRect.left + 12, rowRect.top + 35, `关卡 ${row.levelLabel} · ${row.birdsUsed} 鸟 · ${formatDurationMs(row.durationMs)}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '12px',
        color: '#5c7384',
        wordWrap: { width: rowRect.width - 24 },
      })
      .setOrigin(0, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    rowContainer.add([rowBackground, titleText, submittedAtText, detailText])
    return rowContainer
  }

  private createHistoryRow(rowRect: LayoutRect, row: HistoryRow) {
    const rowContainer = this.add.container(0, 0).setDepth(24).setScrollFactor(0)
    const compact = rowRect.height < 34
    const rowBackground = this.add.graphics().setDepth(23).setScrollFactor(0)
    rowBackground.fillStyle(row.pending ? 0xfef8e8 : 0xffffff, row.pending ? 0.62 : 0.48)
    rowBackground.lineStyle(2, row.pending ? 0xd3b36a : 0x8ec4e2, row.pending ? 0.54 : 0.34)
    rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 16)
    rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 16)

    const titleText = this.add
      .text(rowRect.left + 12, rowRect.centerY - 7, formatHistoryLevelTitle(row.levelLabel, row.levelId), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '13px' : '15px',
        fontStyle: '700',
        color: row.pending ? '#7b5d1f' : '#4b6682',
        wordWrap: { width: rowRect.width - 128 },
      })
      .setOrigin(0, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const submittedAtText = this.add
      .text(rowRect.right - 12, rowRect.centerY - 7, row.pending ? '同步中' : formatSubmittedAtLabel(row.submittedAt), {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '10px' : '11px',
        color: row.pending ? '#9b7421' : '#6d7f90',
      })
      .setOrigin(1, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    const detailText = this.add
      .text(rowRect.left + 12, rowRect.centerY + 8, `${row.birdsUsed} 鸟 · ${row.destroyedPigs} 猪 · ${formatDurationMs(row.durationMs)}`, {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: compact ? '11px' : '12px',
        color: row.pending ? '#866527' : '#5c7384',
      })
      .setOrigin(0, 0.5)
      .setDepth(24)
      .setScrollFactor(0)

    rowContainer.add([rowBackground, titleText, submittedAtText, detailText])
    return rowContainer
  }
}
