import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { AngryBirdsBridge } from '../game/bridge'
import { createAngryBirdsGame } from '../game/createAngryBirdsGame'

type GameCanvasProps = {
  bridge: AngryBirdsBridge
}

export const GameCanvas = ({ bridge }: GameCanvasProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const game = createAngryBirdsGame({
      parent: hostRef.current,
      bridge,
    })
    gameRef.current = game

    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      ;(window as Window & { __ANGRY_BIRDS_PHASER_GAME__?: Phaser.Game }).__ANGRY_BIRDS_PHASER_GAME__ = game
    }

    const syncScaleBounds = () => {
      const host = hostRef.current
      if (!host) {
        return
      }

      const nextWidth = Math.max(1, Math.round(host.clientWidth || window.innerWidth || 1280))
      const nextHeight = Math.max(1, Math.round(host.clientHeight || window.innerHeight || 720))

      if (game.scale.width !== nextWidth || game.scale.height !== nextHeight) {
        game.scale.resize(nextWidth, nextHeight)
      }

      game.scale.updateBounds()
    }

    const resizeObserver = new ResizeObserver(syncScaleBounds)
    resizeObserver.observe(hostRef.current)
    window.addEventListener('resize', syncScaleBounds)
    document.addEventListener('fullscreenchange', syncScaleBounds)
    syncScaleBounds()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncScaleBounds)
      document.removeEventListener('fullscreenchange', syncScaleBounds)
      game.destroy(true)
      gameRef.current = null
      if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
        delete (window as Window & { __ANGRY_BIRDS_PHASER_GAME__?: Phaser.Game }).__ANGRY_BIRDS_PHASER_GAME__
      }
    }
  }, [bridge])

  return <div ref={hostRef} className="game-canvas" />
}
