/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // 开发模式关闭左下角编译活动提示，避免影响演示体验
  devIndicators: false,
  experimental: {
    // 关闭路由切换时的过渡指示器（Next 16 默认会在左下角提示）
    transitionIndicator: false,
  },
  // 拉长 dev 模式下页面保活时间，减少来回切页后的重复编译
  onDemandEntries: {
    maxInactiveAge: 10 * 60 * 1000,
    pagesBufferLength: 100,
  },
  // 固定 Turbopack 工作根目录，避免从上层目录错误解析依赖
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
