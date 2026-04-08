import { useEffect, useRef, useState } from 'react'
import type { BraveManController } from '../../game/createBraveManGame'

let createBraveManGameModulePromise: Promise<typeof import('../../game/createBraveManGame')> | null =
  null

const loadCreateBraveManGameModule = () => {
  if (!createBraveManGameModulePromise) {
    createBraveManGameModulePromise = import('../../game/createBraveManGame')
  }

  return createBraveManGameModulePromise
}

type GameCanvasProps = {
  onControllerReady: (controller: BraveManController | null) => void
  onBootErrorChange?: (message: string | null) => void
}

export const GameCanvas = ({ onControllerReady, onBootErrorChange }: GameCanvasProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onControllerReady)
  const bootErrorCallbackRef = useRef(onBootErrorChange)
  const [isBooting, setIsBooting] = useState(true)
  const [bootNonce, setBootNonce] = useState(0)
  const [bootError, setBootError] = useState<string | null>(null)

  /** 当外部回调引用变化时，更新到 ref，避免重新初始化 Phaser 实例。 */
  useEffect(() => {
    callbackRef.current = onControllerReady
  }, [onControllerReady])

  useEffect(() => {
    bootErrorCallbackRef.current = onBootErrorChange
  }, [onBootErrorChange])

  useEffect(() => {
    const requestIdle = window.requestIdleCallback?.bind(window)
    const cancelIdle = window.cancelIdleCallback?.bind(window)

    if (!requestIdle || !cancelIdle) {
      const timer = window.setTimeout(() => {
        void loadCreateBraveManGameModule()
      }, 0)

      return () => {
        window.clearTimeout(timer)
      }
    }

    const idleId = requestIdle(() => {
      void loadCreateBraveManGameModule()
    })

    return () => {
      cancelIdle(idleId)
    }
  }, [])

  /** 组件挂载后异步加载游戏引擎，并在卸载时释放控制器与场景资源。 */
  useEffect(() => {
    if (!mountRef.current) return
    let disposed = false
    let controller: BraveManController | null = null

    /** 懒加载游戏模块，降低首屏 JS 体积。 */
    const boot = async () => {
      setIsBooting(true)
      setBootError(null)
      bootErrorCallbackRef.current?.(null)
      try {
        const { createBraveManGame } = await loadCreateBraveManGameModule()
        if (disposed || !mountRef.current) return
        controller = createBraveManGame(mountRef.current)
        callbackRef.current(controller)
        setIsBooting(false)
      } catch (error) {
        callbackRef.current(null)
        const message =
          error instanceof Error
            ? `游戏引擎加载失败：${error.message}`
            : '游戏引擎加载失败，请重试或刷新页面。'
        setBootError(message)
        bootErrorCallbackRef.current?.(message)
        setIsBooting(false)
      }
    }

    void boot()

    /** 清理阶段：通知上层控制器失效并销毁 Phaser 实例。 */
    return () => {
      disposed = true
      callbackRef.current(null)
      controller?.destroy()
    }
  }, [bootNonce])

  return (
    <div className="h-full w-full bg-[var(--field-chrome)]" data-testid="game-canvas" ref={mountRef}>
      {bootError ? (
        <div className="pointer-events-none flex h-full items-center justify-center px-5">
          <div className="pointer-events-auto w-full max-w-md rounded-[1.35rem] border border-[rgba(181,57,34,0.14)] bg-[rgba(255,255,255,0.94)] px-5 py-4 text-center shadow-[0_18px_34px_rgba(0,0,0,0.12)]">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--ink-500)]">引擎异常</p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink-900)]">战场加载失败</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-700)]">{bootError}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-[1rem] border border-[var(--accent-vermilion)] bg-[var(--accent-vermilion)] px-4 text-sm font-semibold text-[var(--paper-50)] shadow-[0_10px_22px_rgba(0,0,0,0.14)]"
                onClick={() => setBootNonce((current) => current + 1)}
                type="button"
              >
                重试加载
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-[1rem] border border-[rgba(16,16,16,0.1)] bg-[rgba(255,255,255,0.88)] px-4 text-sm font-semibold text-[var(--ink-700)] shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
                onClick={() => window.location.reload()}
                type="button"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isBooting ? (
        <div className="pointer-events-none flex h-full items-center justify-center text-xs font-semibold tracking-[0.08em] text-[var(--ink-500)]">
          正在加载《战斗至死》...
        </div>
      ) : null}
    </div>
  )
}
