# Game Frontend

前端基于 React 19 + Vite 7 + Phaser，Web3 使用 wagmi + viem。当前模板已经完成从 legacy Vite 游戏脚手架回收，并统一到仓库推荐的 TypeScript 基线。

## 开发启动

```bash
npm install
npm run dev
```

## 常用命令

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run analyze
npm run preview
```

## 运行时配置

复制示例文件后再填写本地兜底值：

```bash
cp .env.local.example .env.local
```

前端读取优先级固定为：

1. `public/contract-config.json`
2. `frontend/.env.local`
3. 代码内默认值

关键变量：

- `VITE_FLAPPY_SCORE_ADDRESS`：排行榜合约地址
- `VITE_RPC_URL`：优先 RPC URL
- `VITE_ANVIL_RPC_URL`：本地 Anvil RPC URL
- `VITE_CHAIN_ID`：链 ID，默认 `31337`

## 合约同步

在项目根目录运行：

```bash
make deploy
```

或单独执行：

```bash
make sync-contract
```

同步脚本会输出 ABI、`public/contract-config.json` 和前端 `.env.local` 兜底配置。

## 架构概览

- React 作为宿主 UI，负责 runtime config 加载、Provider 注入和钱包桥延迟挂载。
- Phaser 负责游戏逻辑与 UI（菜单、排行榜、暂停、结束、设置）。
- Web3 读写通过 viem，在 Phaser 内部调用；钱包连接由 wagmi 管理。

## 运行流程

1. `index.html` 提供 `#root`。
2. `src/main.tsx` 先加载 runtime config，再异步挂载 React。
3. `src/App.tsx` 延迟挂载钱包桥，并渲染 `components/FlappyBird.tsx`。
4. `components/FlappyBird.tsx` 异步加载 `game/gamecore.ts` 并创建 Phaser 实例。
5. `game/scenes/PreloadScene.ts` 只同步预加载首屏视觉资源；音频在首次交互后再懒加载。

## 场景与系统

- `MenuScene`：开始、最高分、设置，且要求连接钱包后才能开始游戏。
- `PlayScene`：主循环、分数与难度曲线、自适应管道间距。
- `PauseScene`：暂停与继续。
- `ScoreScene`：链上 Top10 与最佳分展示。
- `GameOverLoadingScene`：等待钱包签名，签名完成才进入 GameOver。
- `GameOverScene`：重新开始、菜单、设置。

## Web3/链上交互

- 读取排行榜：`game/chain/scoreboardClient.ts`
- 提交成绩：`submitScore()`（需要钱包签名）
- 钱包连接：`components/Web3/WalletConnect.tsx` + 全局事件 `wallet:status`
- Phaser 显示钱包状态：`game/scenes/BaseScene.ts`

## 音频与资源策略

- 设置项：音效开关、音乐开关、难度模式（自适应/固定）
- 音效引擎：`game/audio/audioManager.ts`
- 设置持久化：`game/state/settings.ts`
- 静态资源位于 `public/assets/`
- 图片与音频采用“保守压缩 + 文件名稳定”策略
- BGM 与 SFX 不在页面首屏空载入时抢下载，首次交互后才进入真正可播放状态
