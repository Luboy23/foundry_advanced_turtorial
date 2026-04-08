/**
 * 游戏画布容器。
 * 延迟加载 Phaser 工厂并在挂载/卸载时创建或销毁 controller。
 */
import { useEffect, useRef, useState } from 'react'
import type { DownManController } from '../../game/createDownManGame'

let createDownManGameModulePromise: Promise<typeof import('../../game/createDownManGame')> | null =
  null

// 动态 import 只拉起一次，后续页面重新挂载可以直接复用同一个 promise。
const loadCreateDownManGameModule = () => {
  if (!createDownManGameModulePromise) {
    createDownManGameModulePromise = import('../../game/createDownManGame')
  }

  return createDownManGameModulePromise
}

type GameCanvasProps = {
  onControllerReady: (controller: DownManController | null) => void
}

export const GameCanvas = ({ onControllerReady }: GameCanvasProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onControllerReady)
  const [isBooting, setIsBooting] = useState(true)

  useEffect(() => {
    // callbackRef 避免 boot 异步流程闭包住旧的回调引用。
    callbackRef.current = onControllerReady
  }, [onControllerReady])

  useEffect(() => {
    // 浏览器空闲时预热模块，降低真正进入游戏时的首帧阻塞。
    const requestIdle = window.requestIdleCallback?.bind(window)
    const cancelIdle = window.cancelIdleCallback?.bind(window)

    if (!requestIdle || !cancelIdle) {
      const timer = window.setTimeout(() => {
        void loadCreateDownManGameModule()
      }, 0)

      return () => {
        window.clearTimeout(timer)
      }
    }

    const idleId = requestIdle(() => {
      void loadCreateDownManGameModule()
    })

    return () => {
      cancelIdle(idleId)
    }
  }, [])

  useEffect(() => {
    if (!mountRef.current) {
      return
    }

    let disposed = false
    let controller: DownManController | null = null

    const boot = async () => {
      setIsBooting(true)

      const { createDownManGame } = await loadCreateDownManGameModule()
      if (disposed || !mountRef.current) {
        return
      }

      controller = createDownManGame(mountRef.current)
      callbackRef.current(controller)
      setIsBooting(false)
    }

    void boot()

    return () => {
      disposed = true
      // 卸载时先把 controller 置空，再销毁 Phaser，保持 React 侧状态一致。
      callbackRef.current(null)
      controller?.destroy()
    }
  }, [])

  return (
    <div
      className="h-full w-full bg-[linear-gradient(160deg,var(--paper-50),var(--paper-100))]"
      data-testid="game-canvas"
      ref={mountRef}
    >
      {isBooting ? (
        <div className="pointer-events-none flex h-full items-center justify-center text-xs font-semibold tracking-[0.08em] text-[var(--ink-500)]">
          加载游戏引擎中...
        </div>
      ) : null}
    </div>
  )
}
