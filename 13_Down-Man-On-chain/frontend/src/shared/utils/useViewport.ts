/**
 * 视口尺寸 Hook。
 * 统一给布局层提供最新的 width / height，供响应式计算使用。
 */
import { useEffect, useState } from 'react'

export const useViewport = () => {
  // SSR / 测试环境没有 window 时给出稳定默认值，避免首次渲染抖动。
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }))

  useEffect(() => {
    // 统一在一个地方订阅 resize，外层组件只消费 width/height 结果。
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    onResize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return viewport
}
