/**
 * 模块职责：负责 Phaser 画布挂载、懒加载启动与控制器生命周期管理。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { useEffect, useRef, useState } from 'react'
import type { StoneFallController } from '../../game/createStoneFallGame'

type GameCanvasProps = {
  onControllerReady: (controller: StoneFallController | null) => void
}

/**
 * 游戏画布容器组件。
 * @param onControllerReady 当 Phaser 控制器可用/销毁时回传给上层
 */
export const GameCanvas = ({ onControllerReady }: GameCanvasProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onControllerReady)
  const [isBooting, setIsBooting] = useState(true)

  useEffect(() => {
    callbackRef.current = onControllerReady
  }, [onControllerReady])

  useEffect(() => {
    if (!mountRef.current) {
      return
    }

    // disposed 标记用于防止异步 import 返回后写入已卸载组件。
    let disposed = false
    let controller: StoneFallController | null = null

    const boot = async () => {
      setIsBooting(true)

      // 懒加载 Phaser 入口，减少首屏 bundle 压力。
      const { createStoneFallGame } = await import('../../game/createStoneFallGame')
      if (disposed || !mountRef.current) {
        return
      }

      // 创建控制器并回传给上层，便于 App 层绑定事件。
      controller = createStoneFallGame(mountRef.current)
      callbackRef.current(controller)
      setIsBooting(false)
    }

    void boot()

    return () => {
      disposed = true
      callbackRef.current(null)
      // 卸载时主动销毁 Phaser 实例与内部场景，释放事件与 WebGL 资源。
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
