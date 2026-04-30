import Phaser from 'phaser'
import { blockSceneMusic, syncSceneAudioSettings, unblockSceneMusic } from '../audio'
import { AngryBirdsBridge } from '../bridge'
import { createBrandFooter, type BrandFooterHandle } from '../brandFooter'
import { createRect, createRowSlots, createViewportLayout, type LayoutRect } from '../layout'
import { SCENE_KEYS } from '../sceneKeys'
import { buildResultSubmissionCopy } from '../submissionCopy'
import type { LevelCatalogEntry, RunSummary, SubmissionState } from '../types'
import { createLeaguePanelShell, createOverlayBackdrop, createTextButton } from '../ui'

type PopupViewMode = 'victory-next' | 'failure' | 'campaign-complete'
type PopupButtonKey = 'home' | 'retry' | 'recover' | 'next' | 'restart'
type SummaryRowKey = 'duration' | 'birdsUsed' | 'destroyedPigs'
type SummaryRowHandle = {
  background: Phaser.GameObjects.Graphics
  labelText: Phaser.GameObjects.Text
  valueText: Phaser.GameObjects.Text
}
type ResultCardLayout = {
  cardRect: LayoutRect
  dataRect: LayoutRect
  footerRect: LayoutRect
}
type StatusBadgeSpec = {
  label: string
  fill: number
  fillAlpha: number
  stroke: number
  text: string
}

type PopupButton = {
  key: PopupButtonKey
  handle: ReturnType<typeof createTextButton>
}

const RESULT_ROW_ORDER: Array<{ key: SummaryRowKey; label: string }> = [
  { key: 'duration', label: '耗时' },
  { key: 'birdsUsed', label: '发射次数' },
  { key: 'destroyedPigs', label: '清除目标' },
]

export class ResultPopupScene extends Phaser.Scene {
  private readonly bridge: AngryBirdsBridge
  private readonly onScaleResize = () => {
    if (this.sys.isActive()) {
      this.scene.restart()
    }
  }
  private readonly teardownCallbacks: Array<() => void> = []
  private currentSummary: RunSummary | null = null
  private nextLevel: LevelCatalogEntry | null = null
  private viewMode: PopupViewMode = 'failure'
  private cardObjects: Phaser.GameObjects.GameObject[] = []
  private footerRect?: LayoutRect
  private titleText?: Phaser.GameObjects.Text
  private statusBadgeBackground?: Phaser.GameObjects.Graphics
  private statusBadgeText?: Phaser.GameObjects.Text
  private statusLineText?: Phaser.GameObjects.Text
  private statusDetailText?: Phaser.GameObjects.Text
  private rowHandles = new Map<SummaryRowKey, SummaryRowHandle>()
  private buttons = new Map<PopupButtonKey, PopupButton>()
  private brandFooter?: BrandFooterHandle

  constructor(bridge: AngryBirdsBridge) {
    super(SCENE_KEYS.result)
    this.bridge = bridge
  }

  create() {
    const summary = this.bridge.getSession().runSummary
    if (!summary) {
      this.scene.stop()
      return
    }
    syncSceneAudioSettings(this, this.bridge.getSettings())
    blockSceneMusic(this, 'result-popup')

    this.syncScenario(summary)
    const submissionState = this.bridge.getSubmissionState()

    this.bridge.updateUiState({
      overlayRoute: 'result',
      activeMenuTab: null,
    })

    createOverlayBackdrop(this, undefined, 200)
    this.brandFooter = createBrandFooter(this, { depth: 206 })
    const layout = this.buildCardLayout()
    this.footerRect = layout.footerRect
    this.createCard(layout)
    this.createDataRows(layout.dataRect)
    this.refreshContent(submissionState)
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize)

    this.teardownCallbacks.push(
      this.bridge.on('settings:changed', (settings) => {
        syncSceneAudioSettings(this, settings)
      }),
      this.bridge.on('submission:state-changed', (state) => {
        this.refreshContent(state)
      }),
      this.bridge.on('session:changed', (session) => {
        if (session.scene === 'result') {
          if (session.runSummary) {
            this.syncScenario(session.runSummary)
            this.refreshContent(this.bridge.getSubmissionState())
          }
          return
        }

        if (session.scene === 'play') {
          this.scene.stop(SCENE_KEYS.play)
          this.scene.stop(SCENE_KEYS.result)
          this.scene.start(SCENE_KEYS.play)
          return
        }

        if (session.scene === 'title') {
          this.scene.stop(SCENE_KEYS.play)
          this.scene.stop(SCENE_KEYS.result)
          this.scene.start(SCENE_KEYS.title)
        }
      }),
    )

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unblockSceneMusic(this, 'result-popup')
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize)
      if (this.bridge.getUiState().overlayRoute === 'result') {
        this.bridge.updateUiState({
          overlayRoute: null,
          activeMenuTab: null,
        })
      }
      this.teardownCallbacks.splice(0).forEach((callback) => callback())
      this.brandFooter?.destroy()
      this.cardObjects.splice(0).forEach((object) => object.destroy())
      this.buttons.forEach((button) => button.handle.destroy())
      this.buttons.clear()
      this.rowHandles.clear()
      this.brandFooter = undefined
    })
  }

  private buildCardLayout(): ResultCardLayout {
    const viewport = createViewportLayout(this.scale.width, this.scale.height)
    const cardWidth = Phaser.Math.Clamp(viewport.width * 0.36, 450, 560)
    const cardHeight = Phaser.Math.Clamp(viewport.height * 0.74, 500, 620)
    const isCampaignComplete = this.viewMode === 'campaign-complete'
    const dataTopInset = isCampaignComplete ? 170 : 156
    const dataBottomInset = isCampaignComplete ? 280 : 266
    const cardRect = createRect(
      viewport.centerX - cardWidth / 2,
      viewport.centerY - cardHeight / 2,
      cardWidth,
      cardHeight,
    )
    const dataRect = createRect(
      cardRect.left + 24,
      cardRect.top + dataTopInset,
      cardRect.width - 48,
      cardRect.height - dataBottomInset,
    )
    const footerRect = createRect(cardRect.left + 24, cardRect.bottom - 82, cardRect.width - 48, 54)

    return {
      cardRect,
      dataRect,
      footerRect,
    }
  }

  private createCard(layout: ResultCardLayout) {
    const { cardRect, dataRect, footerRect } = layout
    const isCampaignComplete = this.viewMode === 'campaign-complete'
    const footerRailRect = createRect(
      footerRect.left - 10,
      footerRect.top - 12,
      footerRect.width + 20,
      footerRect.height + 24,
    )

    this.cardObjects.push(
      ...createLeaguePanelShell(this, {
        cardRect,
        depth: 210,
        headerHighlightHeight: isCampaignComplete ? 112 : 94,
        dividerY: cardRect.top + (isCampaignComplete ? 158 : 102),
        palette: isCampaignComplete
          ? {
              shellFill: 0xfff7e7,
              shellStroke: 0xc89b43,
              headerGlow: 0xfff3ca,
              divider: 0xd8b365,
            }
          : undefined,
        surfaces: [
          {
            rect: dataRect,
            fill: isCampaignComplete ? 0xfff9ef : 0xfffcf3,
            fillAlpha: isCampaignComplete ? 0.72 : 0.62,
            stroke: isCampaignComplete ? 0xdabc75 : 0xe4c88c,
            strokeAlpha: 0.88,
            radius: 22,
          },
          {
            rect: footerRailRect,
            fill: isCampaignComplete ? 0xf5f4df : 0xeff4eb,
            fillAlpha: isCampaignComplete ? 0.68 : 0.56,
            stroke: isCampaignComplete ? 0xb5b063 : 0x99a774,
            strokeAlpha: 0.84,
            radius: 22,
          },
        ],
      }),
    )

    if (isCampaignComplete) {
      this.createCampaignCompleteAccents(cardRect)
    }

    this.titleText = this.add
      .text(cardRect.centerX, cardRect.top + (isCampaignComplete ? 54 : 48), '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: isCampaignComplete ? '38px' : '34px',
        fontStyle: '700',
        color: isCampaignComplete ? '#fffaf0' : '#4b2c11',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(214)
      .setScrollFactor(0)

    if (isCampaignComplete) {
      this.titleText.setStroke('#84551a', 7)
      this.titleText.setShadow(0, 4, '#d79a32', 1.2, false, true)
      this.tweens.add({
        targets: this.titleText,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    this.statusBadgeBackground = this.add.graphics().setDepth(214).setScrollFactor(0)
    this.statusBadgeText = this.add
      .text(cardRect.centerX, cardRect.top + (isCampaignComplete ? 102 : 88), '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: isCampaignComplete ? '16px' : '16px',
        fontStyle: '700',
        color: isCampaignComplete ? '#7b5719' : '#35536c',
      })
      .setOrigin(0.5)
      .setDepth(215)
      .setScrollFactor(0)

    this.statusLineText = this.add
      .text(cardRect.centerX, cardRect.top + (isCampaignComplete ? 130 : 114), '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '15px',
        color: isCampaignComplete ? '#7c5a1d' : '#9e3a24',
        align: 'center',
        wordWrap: { width: cardRect.width - 64 },
      })
      .setOrigin(0.5)
      .setDepth(214)
      .setScrollFactor(0)

    if (isCampaignComplete) {
      this.statusLineText.setLineSpacing(6)
    }

    this.statusDetailText = this.add
      .text(cardRect.centerX, cardRect.top + (isCampaignComplete ? 150 : 138), '', {
        fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
        fontSize: '12px',
        color: isCampaignComplete ? '#8a6b28' : '#7d8d99',
        align: 'center',
        wordWrap: { width: cardRect.width - 80 },
      })
      .setOrigin(0.5)
      .setDepth(214)
      .setScrollFactor(0)

    this.cardObjects.push(
      this.titleText,
      this.statusBadgeBackground,
      this.statusBadgeText,
      this.statusLineText,
      this.statusDetailText,
    )
  }

  private createDataRows(dataRect: LayoutRect) {
    const rowGap = 8
    const rowHeight = Math.floor((dataRect.height - rowGap * (RESULT_ROW_ORDER.length - 1)) / RESULT_ROW_ORDER.length)
    const isCampaignComplete = this.viewMode === 'campaign-complete'

    RESULT_ROW_ORDER.forEach((row, index) => {
      const rowTop = dataRect.top + index * (rowHeight + rowGap)
      const rowRect = createRect(dataRect.left + 12, rowTop, dataRect.width - 24, rowHeight)

      const rowBackground = this.add.graphics().setDepth(214).setScrollFactor(0)
      rowBackground.fillStyle(isCampaignComplete ? 0xfffdf6 : 0xfcfffb, isCampaignComplete ? 0.74 : 0.52)
      rowBackground.lineStyle(2, isCampaignComplete ? 0xe0cc8a : 0xe0eef5, isCampaignComplete ? 0.92 : 0.84)
      rowBackground.fillRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 18)
      rowBackground.strokeRoundedRect(rowRect.left, rowRect.top, rowRect.width, rowRect.height, 18)

      const labelText = this.add
        .text(rowRect.left + 16, rowRect.centerY, row.label, {
          fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
          fontSize: '18px',
          fontStyle: '700',
          color: isCampaignComplete ? '#7a6725' : '#587144',
        })
        .setOrigin(0, 0.5)
        .setDepth(215)
        .setScrollFactor(0)

      const valueText = this.add
        .text(rowRect.right - 16, rowRect.centerY, '', {
          fontFamily: '"Trebuchet MS", "PingFang SC", sans-serif',
          fontSize: '22px',
          fontStyle: '700',
          color: isCampaignComplete ? '#456625' : '#36516a',
        })
        .setOrigin(1, 0.5)
        .setDepth(215)
        .setScrollFactor(0)

      this.rowHandles.set(row.key, {
        background: rowBackground,
        labelText,
        valueText,
      })
      this.cardObjects.push(rowBackground, labelText, valueText)
    })
  }

  private createCampaignCompleteAccents(cardRect: LayoutRect) {
    const centerX = cardRect.centerX
    const highlightCenterY = cardRect.top + 78

    const glow = this.add.graphics().setDepth(212).setScrollFactor(0)
    glow.fillStyle(0xffefb1, 0.14)
    glow.fillEllipse(centerX, highlightCenterY, 252, 116)
    glow.fillStyle(0xffffff, 0.12)
    glow.fillEllipse(centerX, highlightCenterY - 6, 154, 60)

    const confetti = this.add.graphics().setDepth(213).setScrollFactor(0)
    confetti.fillStyle(0xf0c45d, 0.34)
    ;[
      { x: centerX - 100, y: cardRect.top + 54, r: 2.5 },
      { x: centerX - 82, y: cardRect.top + 92, r: 1.8 },
      { x: centerX + 92, y: cardRect.top + 56, r: 2.5 },
      { x: centerX + 76, y: cardRect.top + 94, r: 1.8 },
      { x: centerX - 52, y: cardRect.top + 34, r: 1.6 },
      { x: centerX + 48, y: cardRect.top + 34, r: 1.6 },
    ].forEach(({ x, y, r }) => {
      confetti.fillCircle(x, y, r)
    })

    const crestHalo = this.add.graphics().setDepth(213).setScrollFactor(0)
    crestHalo.fillStyle(0xfff3cf, 0.3)
    crestHalo.fillCircle(centerX, cardRect.top + 38, 28)

    const crown = this.add.graphics().setDepth(214).setScrollFactor(0)
    crown.fillStyle(0xf3c55e, 0.98)
    crown.lineStyle(3, 0x8a5b18, 0.96)
    const crownPoints = [
      new Phaser.Geom.Point(centerX - 28, cardRect.top + 28),
      new Phaser.Geom.Point(centerX - 20, cardRect.top + 46),
      new Phaser.Geom.Point(centerX - 8, cardRect.top + 24),
      new Phaser.Geom.Point(centerX, cardRect.top + 44),
      new Phaser.Geom.Point(centerX + 8, cardRect.top + 24),
      new Phaser.Geom.Point(centerX + 20, cardRect.top + 46),
      new Phaser.Geom.Point(centerX + 28, cardRect.top + 28),
      new Phaser.Geom.Point(centerX + 28, cardRect.top + 54),
      new Phaser.Geom.Point(centerX - 28, cardRect.top + 54),
    ]
    crown.fillPoints(crownPoints, true)
    crown.strokePoints(crownPoints, true)
    crown.fillStyle(0xffefc4, 0.86)
    crown.fillCircle(centerX - 14, cardRect.top + 37, 3)
    crown.fillCircle(centerX, cardRect.top + 33, 4)
    crown.fillCircle(centerX + 14, cardRect.top + 37, 3)

    const leftSpark = this.createCelebrationStar(centerX - 138, cardRect.top + 70, 9, 4)
    const rightSpark = this.createCelebrationStar(centerX + 138, cardRect.top + 70, 9, 4)

    this.tweens.add({
      targets: [leftSpark, rightSpark],
      alpha: 0.5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.cardObjects.push(glow, confetti, crestHalo, crown, leftSpark, rightSpark)
  }

  private createCelebrationStar(x: number, y: number, outerRadius: number, innerRadius: number) {
    const star = this.add.graphics().setDepth(214).setScrollFactor(0)
    const points = this.createStarPoints(x, y, outerRadius, innerRadius)
    star.fillStyle(0xffefb8, 0.98)
    star.lineStyle(2, 0xc78d29, 0.92)
    star.fillPoints(points, true)
    star.strokePoints(points, true)
    return star
  }

  private createStarPoints(centerX: number, centerY: number, outerRadius: number, innerRadius: number) {
    const points: Phaser.Geom.Point[] = []
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * (Math.PI / 5)
      const radius = index % 2 === 0 ? outerRadius : innerRadius
      points.push(new Phaser.Geom.Point(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius))
    }
    return points
  }

  private rebuildButtons(submissionState: SubmissionState) {
    const summary = this.currentSummary
    if (!summary || !this.footerRect) {
      return
    }

    this.buttons.forEach((button) => button.handle.destroy())
    this.buttons.clear()

    const buttonSpecs =
      this.viewMode === 'failure'
        ? [
            {
              key: 'home' as const,
              label: '返回首页',
              variant: 'tab' as const,
              onClick: () => this.bridge.returnHome(),
            },
            {
              key: 'retry' as const,
              label: '重新开始',
              variant: 'primary' as const,
              onClick: () => this.bridge.requestRestartLevel(),
            },
          ]
        : submissionState.status === 'error'
          ? [
              {
                key: 'home' as const,
                label: '返回首页',
                variant: 'tab' as const,
                onClick: () => this.bridge.returnHome(),
              },
              {
                key: 'recover' as const,
                label: submissionState.requiresSessionRenewal ? '回首页重新登录' : '重试同步',
                variant: 'primary' as const,
                onClick: () => {
                  if (submissionState.requiresSessionRenewal) {
                    this.bridge.returnHome()
                    return
                  }
                  this.bridge.requestSubmit(summary)
                },
              },
            ]
          : this.viewMode === 'campaign-complete'
            ? [
              {
                  key: 'home' as const,
                  label: '返回首页',
                  variant: 'tab' as const,
                  onClick: () => this.bridge.returnHome(),
                },
                {
                  key: 'restart' as const,
                  label: '开启新一轮',
                  variant: 'primary' as const,
                  onClick: () => {
                    const firstLevel = this.bridge.getLevels().find((level) => level.manifest.enabled) ?? this.bridge.getLevels()[0]
                    if (firstLevel) {
                      this.bridge.requestStartLevel(firstLevel.levelId)
                    }
                  },
                },
              ]
            : [
                {
                  key: 'home' as const,
                  label: '返回首页',
                  variant: 'tab' as const,
                  onClick: () => this.bridge.returnHome(),
                },
                {
                  key: 'next' as const,
                  label: '下一关',
                  variant: 'primary' as const,
                  onClick: () => this.bridge.requestStartNextLevel(),
                },
              ]

    const slots = createRowSlots(this.footerRect, buttonSpecs.length, {
      itemHeight: 52,
      gap: 16,
      maxItemWidth: buttonSpecs.length === 2 ? 190 : 156,
      minItemWidth: buttonSpecs.length === 2 ? 150 : 124,
    })

    buttonSpecs.forEach((spec, index) => {
      const slot = slots[index]
      this.buttons.set(spec.key, {
        key: spec.key,
        handle: createTextButton(this, {
          x: slot.centerX,
          y: slot.centerY,
          width: slot.width,
          height: slot.height,
          label: spec.label,
          onClick: spec.onClick,
          variant: spec.variant,
          depth: 220,
          scrollFactor: 0,
        }),
      })
    })
  }

  private refreshContent(submissionState: SubmissionState) {
    const summary = this.currentSummary
    if (!summary) {
      return
    }

    this.rebuildButtons(submissionState)
    this.titleText?.setText(this.getCardTitle())
    this.refreshStatusBadge(summary, submissionState)
    this.refreshSummaryRows(summary)
    this.refreshButtons(submissionState)
  }

  private syncScenario(summary: RunSummary) {
    this.currentSummary = summary
    this.nextLevel = this.bridge.getNextLevelAfter(summary.levelId)
    this.viewMode = !summary.cleared ? 'failure' : this.nextLevel ? 'victory-next' : 'campaign-complete'
  }

  private getCardTitle() {
    if (this.viewMode === 'failure') {
      return '未通关'
    }
    if (this.viewMode === 'campaign-complete') {
      return '全线通关'
    }
    return '关卡完成'
  }

  private getCampaignCompleteSummaryText() {
    const totalLevels = this.bridge.getLevels().filter((level) => level.manifest.enabled).length
    const normalizedTotal = totalLevels > 0 ? totalLevels : 5
    return `你已完成全部 ${normalizedTotal} 关挑战，所有据点已被清空。`
  }

  private getStatusBadgeSpec(summary: RunSummary, submissionState: SubmissionState): StatusBadgeSpec {
    if (!summary.cleared) {
      return {
        label: '本局未保存',
        fill: 0xfff8ef,
        fillAlpha: 0.94,
        stroke: 0xb59a62,
        text: '#6b4a22',
      }
    }
    if (this.viewMode === 'campaign-complete' && submissionState.status !== 'error') {
      if (submissionState.status === 'confirmed') {
        return {
          label: '同步完成',
          fill: 0xfff7e3,
          fillAlpha: 0.98,
          stroke: 0xd7b15d,
          text: '#77531a',
        }
      }

      if (
        submissionState.status === 'finalizing' ||
        submissionState.status === 'signing' ||
        submissionState.status === 'validating'
      ) {
        return {
          label: '正在同步',
          fill: 0xfff3df,
          fillAlpha: 0.98,
          stroke: 0xdebb71,
          text: '#7c5a1f',
        }
      }

      return {
        label: '成绩已保存',
        fill: 0xfff8ea,
        fillAlpha: 0.98,
        stroke: 0xd8bc77,
        text: '#7a5b20',
      }
    }

    if (submissionState.status === 'confirmed') {
      return {
        label: '同步完成',
        fill: 0xf3fbef,
        fillAlpha: 0.96,
        stroke: 0x9db97c,
        text: '#496133',
      }
    }
    if (submissionState.status === 'finalizing') {
      return {
        label: '正在同步',
        fill: 0xfef8e8,
        fillAlpha: 0.96,
        stroke: 0xd3b36a,
        text: '#775620',
      }
    }
    if (submissionState.status === 'signing') {
      return {
        label: '正在同步',
        fill: 0xfef8e8,
        fillAlpha: 0.96,
        stroke: 0xd3b36a,
        text: '#775620',
      }
    }
    if (submissionState.status === 'validating') {
      return {
        label: '正在同步',
        fill: 0xfef8e8,
        fillAlpha: 0.96,
        stroke: 0xd3b36a,
        text: '#775620',
      }
    }
    if (submissionState.status === 'error') {
      return {
        label: submissionState.requiresSessionRenewal ? '需要重新登录' : '同步出了点问题',
        fill: 0xfde9e5,
        fillAlpha: 0.96,
        stroke: 0xd57246,
        text: '#8b351a',
      }
    }
    if (submissionState.status === 'synced') {
      return {
        label: '成绩已保存',
        fill: 0xf0f7ff,
        fillAlpha: 0.96,
        stroke: 0xbddff3,
        text: '#35536c',
      }
    }
    return {
      label: '成绩已保存',
      fill: 0xf0f7ff,
      fillAlpha: 0.96,
      stroke: 0xbddff3,
      text: '#35536c',
    }
  }

  private refreshStatusBadge(summary: RunSummary, submissionState: SubmissionState) {
    if (
      !this.statusBadgeBackground ||
      !this.statusBadgeText ||
      !this.titleText ||
      !this.statusLineText ||
      !this.statusDetailText
    ) {
      return
    }

    const badge = this.getStatusBadgeSpec(summary, submissionState)
    const campaignCompleteSummary = this.viewMode === 'campaign-complete' ? this.getCampaignCompleteSummaryText() : ''
    const copy = buildResultSubmissionCopy({
      summaryCleared: summary.cleared,
      submission: submissionState,
      campaignCompleteSummary,
    })
    this.statusBadgeText.setText(copy.badgeLabel).setColor(badge.text)

    const width = Phaser.Math.Clamp(this.statusBadgeText.width + 34, 92, 164)
    const isCampaignComplete = this.viewMode === 'campaign-complete'
    const height = isCampaignComplete ? 32 : 34
    const centerX = this.statusBadgeText.x
    const centerY = this.statusBadgeText.y
    const radius = isCampaignComplete ? 15 : 16
    const shadowOffsetY = isCampaignComplete ? 2 : 3
    const shadowAlpha = isCampaignComplete ? 0.05 : 0.08

    this.statusBadgeBackground.clear()
    this.statusBadgeBackground.fillStyle(0x153349, shadowAlpha)
    this.statusBadgeBackground.fillRoundedRect(
      centerX - width / 2 + 2,
      centerY - height / 2 + shadowOffsetY,
      width,
      height,
      radius,
    )
    this.statusBadgeBackground.fillStyle(badge.fill, badge.fillAlpha)
    this.statusBadgeBackground.lineStyle(2, badge.stroke, 0.96)
    this.statusBadgeBackground.fillRoundedRect(centerX - width / 2, centerY - height / 2, width, height, radius)
    this.statusBadgeBackground.strokeRoundedRect(centerX - width / 2, centerY - height / 2, width, height, radius)
    this.statusLineText.setText(copy.statusText)
    this.statusDetailText.setText(copy.detailText)
    this.statusDetailText.setVisible(copy.detailText.trim().length > 0)
  }

  private refreshSummaryRows(summary: RunSummary) {
    this.rowHandles.get('duration')?.valueText.setText(`${(summary.durationMs / 1000).toFixed(2)}s`)
    this.rowHandles.get('birdsUsed')?.valueText.setText(`${summary.birdsUsed}`)
    this.rowHandles.get('destroyedPigs')?.valueText.setText(`${summary.destroyedPigs}`)
  }

  private refreshButtons(submissionState: SubmissionState) {
    this.buttons.get('home')?.handle.setDisabled(false)
    this.buttons.get('retry')?.handle.setDisabled(false)
    this.buttons.get('restart')?.handle.setDisabled(false)
    this.buttons.get('next')?.handle.setDisabled(!this.nextLevel)

    const recover = this.buttons.get('recover')
    if (recover) {
      const disabled =
        submissionState.requiresSessionRenewal
          ? false
          : !submissionState.canSubmit ||
            submissionState.status === 'signing' ||
            submissionState.status === 'validating' ||
            submissionState.status === 'finalizing' ||
            submissionState.status === 'confirmed'
      recover.handle.setDisabled(disabled)
    }
  }
}
