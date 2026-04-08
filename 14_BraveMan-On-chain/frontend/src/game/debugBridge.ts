// 调试桥开关：开发模式和测试模式启用，生产构建默认关闭。
export const ENABLE_DEBUG_BRIDGE = import.meta.env.DEV || import.meta.env.MODE === 'test'
