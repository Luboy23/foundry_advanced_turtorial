/**
 * 调试桥开关。
 * 开发模式、测试模式或显式环境变量开启时，允许 React / e2e 访问场景调试接口。
 */
export const ENABLE_DEBUG_BRIDGE =
  import.meta.env.DEV ||
  import.meta.env.MODE === 'test' ||
  import.meta.env.VITE_ENABLE_DEBUG_BRIDGE === 'true'
