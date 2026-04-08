import { useEffect, useState } from 'react'

type GameOverPayload = {
  score: number
  endedAt: number
}

type FlappyBirdProps = {
  onGameOver?: (payload: GameOverPayload) => void
}

let flappyBirdGameModulePromise: Promise<typeof import('../game/gamecore')> | undefined

const loadFlappyBirdGame = async () => {
  if (!flappyBirdGameModulePromise) {
    flappyBirdGameModulePromise = import('../game/gamecore')
  }

  return flappyBirdGameModulePromise
}

const FlappyBird = ({ onGameOver }: FlappyBirdProps) => {
  const [isBooting, setIsBooting] = useState(true)

  useEffect(() => {
    if (!onGameOver) return undefined
    const handleGameOver = (event: WindowEventMap['game:over']) => {
      const score = event?.detail?.score ?? 0
      const endedAt = event?.detail?.endedAt ?? Date.now()
      onGameOver({ score, endedAt })
    }

    window.addEventListener('game:over', handleGameOver as EventListener)
    return () => window.removeEventListener('game:over', handleGameOver as EventListener)
  }, [onGameOver])

  useEffect(() => {
    let destroyed = false
    let game: { destroy: (removeCanvas?: boolean) => void } | undefined

    const bootGame = async () => {
      const { default: FlappyBirdGame } = await loadFlappyBirdGame()
      if (destroyed) {
        return
      }

      game = new FlappyBirdGame('game-container') as unknown as {
        destroy: (removeCanvas?: boolean) => void
      }
      setIsBooting(false)
    }

    void bootGame()

    return () => {
      destroyed = true
      if (game) {
        game.destroy(true)
      }
    }
  }, [])

  return (
    <>
      <div
        id="game-container"
        style={{
          // 使用绝对定位 + transform 将画布居中
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          zIndex: 1,
        }}
      ></div>

      {isBooting ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(180deg, rgba(21,57,108,0.82) 0%, rgba(8,26,58,0.7) 100%)',
            color: '#f8fafc',
            fontSize: '0.95rem',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
          }}
        >
          正在加载游戏引擎...
        </div>
      ) : null}
    </>
  )
}

export default FlappyBird
