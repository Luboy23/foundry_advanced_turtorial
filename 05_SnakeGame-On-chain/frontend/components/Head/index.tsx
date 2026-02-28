import Head from 'next/head'

// 页面头信息组件：SEO 与社交卡片配置
export const HeadComponent = () => (
  <Head>
    <title>Snake Game On-chain</title>
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link
      rel="icon"
      type="image/png"
      sizes="192x192"
      href="/android-chrome-192x192.png"
    />
    <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    <meta name="author" content="lllu_23" />
    <meta name="theme-color" content="#f43f5e" />
    <meta
      name="description"
      content="使用 Next.js 构建的极简浏览器贪吃蛇游戏"
    />
    <meta
      name="keywords"
      content="贪吃蛇, 贪吃蛇游戏, 浏览器游戏, nextjs, react"
    />

    {/* OG Meta Tags */}
    <meta property="og:url" content="https://snake-on-chian.vercel.app/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="snake-on-chian" />
    <meta property="og:title" content="Snake Game On-chain" />
    <meta
      property="og:description"
      content="使用 Next.js 构建的极简浏览器贪吃蛇游戏"
    />
    <meta
      property="og:image"
      content="https://snake-on-chian.vercel.app/twitter-summary-card.jpg"
    />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />

    {/* Twitter Card */}
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:url" content="https://snake-on-chian.vercel.app/" />
    <meta name="twitter:site" content="@lllu_23" />
    <meta name="twitter:title" content="Snake Game On-chain" />
    <meta
      name="twitter:description"
      content="使用 Next.js 构建的极简浏览器贪吃蛇游戏"
    />
    <meta
      name="twitter:image"
      content="https://snake-on-chian.vercel.app/twitter-summary-card.jpg"
    />
  </Head>
)
