import { useEffect, useRef, useState } from 'react'

import { stageLayoutMetrics } from '../game/arenaBounds'
import type { GameState } from '../game/types'

type ViewportSize = {
  width: number
  height: number
}

type StageTitleVisual = {
  shellOpacity: number
  brushOpacity: number
  accentOpacity: number
  titleOpacity: number
  subtitleOpacity: number
  scale: number
}

type UseStageLayoutOptions = {
  viewport: ViewportSize
  isDesktop: boolean
  gameState: GameState
  engineReady: boolean
  engineError: string | null
}

/** 倒计时期间标题视觉更克制，避免和中央数字竞争注意力。 */
const countdownTitleVisual: StageTitleVisual = {
  shellOpacity: 0.84,
  brushOpacity: 0.18,
  accentOpacity: 0.52,
  titleOpacity: 0.92,
  subtitleOpacity: 0.5,
  scale: 0.992,
}

/** 默认标题视觉：大厅和运行态下维持较完整的书卷风格。 */
const defaultTitleVisual: StageTitleVisual = {
  shellOpacity: 0.94,
  brushOpacity: 0.3,
  accentOpacity: 0.7,
  titleOpacity: 0.98,
  subtitleOpacity: 0.58,
  scale: 1,
}

/**
 * 统一计算舞台壳层布局、遮罩文案和桌面右侧 rail 的定位。
 * 该 Hook 负责把“Phaser 画布尺寸”转换成“React 外层壳层的视觉坐标”。
 */
export const useStageLayout = ({
  viewport,
  isDesktop,
  gameState,
  engineReady,
  engineError,
}: UseStageLayoutOptions) => {
  const stageShellRef = useRef<HTMLElement | null>(null)
  /** 桌面端战场 chrome 的底边位置，用于把 HUD / rail 放在安全区域之外。 */
  const [desktopStageChromeBottom, setDesktopStageChromeBottom] = useState(
    stageLayoutMetrics.battlefieldInsetTop,
  )

  useEffect(() => {
    if (!isDesktop) return

    const shell = stageShellRef.current
    if (!shell) return

    let frameId = 0
    let resizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null

    /** 重新测量画布在壳层中的位置，推导桌面端上方留白高度。 */
    const measureStageChrome = () => {
      const shellRect = shell.getBoundingClientRect()
      if (shellRect.height <= 0) return

      const canvas = shell.querySelector('canvas')
      if (!canvas) {
        // 画布尚未挂载时，先按比例估算一版位置，避免右侧 rail 抖动。
        setDesktopStageChromeBottom(
          Math.round(shellRect.height * stageLayoutMetrics.battlefieldTopRatio),
        )
        return
      }

      const canvasRect = canvas.getBoundingClientRect()
      const chromeBottom =
        Math.max(0, canvasRect.top - shellRect.top) +
        canvasRect.height * stageLayoutMetrics.battlefieldTopRatio
      setDesktopStageChromeBottom(Math.round(chromeBottom))
    }

    /** 把多次同步触发的测量请求收敛到下一帧，减少布局抖动。 */
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(measureStageChrome)
    }

    scheduleMeasure()

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleMeasure())
      resizeObserver.observe(shell)
      const canvas = shell.querySelector('canvas')
      if (canvas) resizeObserver.observe(canvas)
    }

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        const canvas = shell.querySelector('canvas')
        if (canvas && resizeObserver) resizeObserver.observe(canvas)
        scheduleMeasure()
      })
      mutationObserver.observe(shell, { childList: true, subtree: true })
    }

    window.addEventListener('resize', scheduleMeasure)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [isDesktop])

  // 中央提示文案只在大厅和暂停态展示，运行态避免遮挡战场。
  const overlayText = gameState === 'idle'
    ? engineError
      ? null
      : !engineReady
      ? '游戏引擎初始化中，请稍候...'
      : '连接钱包并点击开始，进入《战斗至死》的无尽战场'
    : gameState === 'paused'
      ? '游戏已暂停，可以观察场上压力并选择结算离场'
      : null
  // footer 的遮罩强度跟随当前态变化：倒计时最轻，大厅/暂停略深。
  const footerOverlayTone = gameState === 'countdown'
    ? 'bg-[rgba(16,16,16,0.12)] backdrop-blur-[1.5px]'
    : overlayText
      ? 'bg-[rgba(16,16,16,0.16)] backdrop-blur-[2px]'
      : null
  /** 移动端画布高度采用夹逼策略，兼顾窄屏可玩性与桌面一致观感。 */
  const mobileCanvasHeight = Math.min(560, Math.max(360, viewport.height * 0.56))
  const stageTitleVisual = gameState === 'countdown' ? countdownTitleVisual : defaultTitleVisual
  const desktopStageChromeHeight = Math.max(desktopStageChromeBottom, 68)
  /** 桌面右侧按钮 rail 需要放在战场 chrome 之下，避免压住标题与 HUD。 */
  const desktopRightRailTop = desktopStageChromeHeight + 8

  return {
    stageShellRef,
    mobileCanvasHeight,
    overlayText,
    footerOverlayTone,
    stageTitleVisual,
    desktopRightRailTop,
  }
}
