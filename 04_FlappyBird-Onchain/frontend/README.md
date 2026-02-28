# Game Frontend

前端基于 React + Vite + Phaser，Web3 使用 wagmi + viem。

## 开发启动

```bash
npm install
npm run dev
```

## 常用命令

```bash
npm run build
npm run preview
npm run lint
```

## 环境变量

复制示例文件后再填写实际值：
`cp .env.local.example .env.local`

- `VITE_FLAPPY_SCORE_ADDRESS`：合约地址（由根目录 Makefile 的 `deploy` 写入 `frontend/.env.local`）。
- `VITE_ANVIL_RPC_URL`（可选）：自定义 RPC URL。

## 合约同步

在根目录运行：

```bash
make sync-contract
```

会从 `contracts/out/` 中同步 ABI，并写入 `frontend/components/Web3/`。

## 架构概览

- React 作为宿主 UI，负责钱包连接、容器渲染与全局状态注入。
- Phaser 负责游戏逻辑与 UI（菜单/排行榜/暂停/结束/设置）。
- Web3 读写通过 viem，在 Phaser 内部调用；钱包连接由 wagmi 管理。

## 运行流程

1. `index.html` 提供 `#root`。
2. `src/main.jsx` 启动 React，注入 Provider。
3. `components/FlappyBird.jsx` 创建 Phaser 实例并挂载到 `#game-container`。
4. `game/gamecore.js` 初始化游戏与场景列表。
5. `game/scenes/PreloadScene.js` 预加载资源并进入菜单。

## 场景与系统

- `MenuScene`：开始/最高分/设置，且要求连接钱包后才能开始游戏。
- `PlayScene`：主循环、分数与难度曲线、自适应管道间距。
- `PauseScene`：暂停与继续。
- `ScoreScene`：链上 Top10 与最佳分展示。
- `GameOverLoadingScene`：等待钱包签名，签名完成才进入 GameOver。
- `GameOverScene`：重新开始/菜单/设置。

## 缩放与适配

- 使用虚拟分辨率（720x600）+ 相机缩放适配屏幕。
- 白色留白区域作为安全边界，核心游戏画面居中。

## Web3/链上交互

- 读取排行榜：`game/chain/scoreboardClient.js` → `getLeaderboard()`
- 提交成绩：`submitScore()`（需要钱包签名）
- 钱包连接：`components/Web3/WalletConnect.jsx` + 全局事件 `wallet:status`
- Phaser 显示钱包状态：`game/scenes/BaseScene.js`

## 音频与设置

- 设置项：音效开关、音乐开关、难度模式（自适应/固定）
- 音效：`game/audio/audioManager.js`
- 设置持久化：`game/state/settings.js`

## 资源说明

- 静态资源放在 `public/assets/`（Phaser 运行时直接加载）。
- 游戏逻辑位于 `game/`，React 宿主位于 `src/`。
