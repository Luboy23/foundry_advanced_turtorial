import { useEffect, useState } from 'react'

// 读取当前视口尺寸；SSR 环境回退到默认教学分辨率。
const readViewport = () => ({
  width: typeof window === 'undefined' ? 1280 : window.innerWidth,
  height: typeof window === 'undefined' ? 720 : window.innerHeight,
})

/**
 * 订阅窗口尺寸变化并返回实时 viewport。
 * 生命周期：挂载时绑定 resize，卸载时解除绑定。
 */
export const useViewport = () => {
  const [viewport, setViewport] = useState(readViewport)

  useEffect(() => {
    // 回调只做一次状态同步，避免在 resize 热路径做重计算。
    const handleResize = () => setViewport(readViewport())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return viewport
}
