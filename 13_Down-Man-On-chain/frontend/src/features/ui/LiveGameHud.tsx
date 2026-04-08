/**
 * 直播态 HUD 容器。
 * 单独订阅 onScoreTick，避免分数更新把整个 App 带着一起重渲染。
 */
import { memo, useEffect, useState } from 'react'
import type { DownManController } from '../../game/createDownManGame'
import { GameHud } from './GameHud'

type LiveGameHudProps = {
  bestScore: number
  controller: DownManController | null
}

type HudState = {
  score: number
  survivalMs: number
  totalLandings: number
}

// 把初始值抽出来，便于 controller 变更时快速重置 HUD。
const createInitialHudState = (): HudState => ({
  score: 0,
  survivalMs: 0,
  totalLandings: 0,
})

export const LiveGameHud = memo(function LiveGameHud({
  bestScore,
  controller,
}: LiveGameHudProps) {
  const [hudState, setHudState] = useState<HudState>(() => createInitialHudState())

  useEffect(() => {
    if (!controller) {
      return
    }

    // HUD 只订阅 onScoreTick，并在值没变时返回旧对象，继续压低 React 重渲染频率。
    const unsubscribeScore = controller.subscribe(
      'onScoreTick',
      ({ score, survivalMs, totalLandings }) => {
        setHudState((current) => {
          if (
            current.score === score &&
            current.survivalMs === survivalMs &&
            current.totalLandings === totalLandings
          ) {
            return current
          }

          return {
            ...current,
            score,
            survivalMs,
            totalLandings,
          }
        })
      },
    )

    return () => {
      unsubscribeScore()
    }
  }, [controller])

  return (
    <GameHud
      bestScore={bestScore}
      score={hudState.score}
      survivalMs={hudState.survivalMs}
      totalDodged={hudState.totalLandings}
    />
  )
})
