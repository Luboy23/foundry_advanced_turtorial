# StoneFall 前端实施计划与落地说明

## 1. 项目目标
- 使用 `Vite + React + TypeScript + Tailwind + Phaser3` 构建 `StoneFall` 小游戏前端。
- 横屏优先（16:9），玩法为“底部横向移动躲避下落点”。
- 视觉参考 `05_SnakeGame-On-chain`：浅色渐变、rose 色系、卡片化、半透明遮罩弹窗。

## 2. 已实现范围

### 2.1 工程与基础设施
- 脚手架：Vite React TS。
- 依赖：`phaser`、`tailwindcss`、`@tailwindcss/vite`、`vitest`、`@testing-library/*`、`@playwright/test`。
- 分层目录：
  - `src/game`（Phaser 场景/事件总线/控制器）
  - `src/features`（React 视图、音频、UI 模态）
  - `src/shared`（难度公式、LocalStorage、格式化工具）

### 2.2 Phaser 架构
- 场景：`BootScene`、`GameScene`、`OverlayBridgeScene`。
- 缩放策略：`FIT + CENTER_BOTH`，逻辑分辨率 `1280x720`。
- 事件桥接：
  - React -> Phaser 命令：`startGame` / `pauseGame` / `resumeGame` / `restartGame` / `setInputMode` / `setAudioSettings`
  - Phaser -> React 事件：`onGameState` / `onScoreTick` / `onDifficultyTick` / `onCountdown` / `onGameOver` / `onSessionStats`

### 2.3 玩法规则
- 玩家仅 X 轴移动，速度目标 `620 px/s`（平滑阻尼）。
- 下落点对象池复用（`Physics Group` + `get/disableBody`）。
- 单次碰撞即结束。
- 计分：`score = floor(survivalMs / 100)`；同时展示 `survivalMs` 秒数。
- 连续难度曲线：
  - `spawnIntervalMs = clamp(900 - t*8, 240, 900)`
  - `fallSpeed = clamp(220 + t*6, 220, 620)`
  - `maxActiveDots = clamp(3 + floor(t/8), 3, 14)`
- 生成模式：
  - `0-20s` 单点
  - `20-45s` 25% 双点
  - `45s+` 15% 三连波次、50% 双点
- 状态机：`Idle -> Countdown -> Running -> Paused -> Running -> GameOver`
- 失焦恢复：失焦自动暂停，回焦通过倒计时恢复。

### 2.4 UI/UX
- 单页壳 + 叠层面板。
- 顶部标题、中心画布卡片、底部操作区。
- 弹窗：设置、排行榜、清空确认、结算。
- 移动端：左右按钮长按移动。
- 竖屏提示层：建议横屏体验。
- 音频：SFX（按钮/开始/倒计时/碰撞）+ 可切换 BGM。

### 2.5 数据与持久化
- `LocalStorage` Key：
  - `stonefall.settings.v1`
  - `stonefall.leaderboard.v1`
- 设置结构：`musicEnabled`、`sfxEnabled`、`language`、`bestScore`。
- 成绩结构：`id`、`score`、`survivalMs`、`maxDifficulty`、`createdAt`、`inputType`、`version`。
- 排序规则：`score desc` -> `survivalMs desc` -> `createdAt asc`。
- 数据上限：保留最近 50 条，视图输出 Top10/Recent5。
- 容错：损坏 JSON 自动回退并重建。

## 3. 测试与验证

### 3.1 单元测试（Vitest）
- 难度公式边界与夹紧。
- 生成策略概率分支。
- 排行榜排序与 50 条截断。
- LocalStorage 损坏恢复。

### 3.2 组件测试（Testing Library）
- 状态机驱动按钮状态。
- 触控按钮触发输入命令。
- 结算面板与排行榜写入状态显示。

### 3.3 E2E（Playwright）
- 开始后计分递增。
- 结算后本地榜落盘并刷新保留。
- 暂停冻结分数、继续触发倒计时。
- 移动端视口可见并可操作触控按钮。

## 4. 后续可选增强
- 加入道具层（护盾/减速/清屏）。
- 增加主题皮肤与动效层次（粒子特效、命中闪白）。
- 接入后端或链上排行榜。
- 引入 seed 随机与回放系统，支持可重复挑战。
