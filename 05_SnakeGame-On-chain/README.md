# 05 Snake Game On-chain（snake-game-on-chain）
Next.js + Foundry

一个以 Next.js 作为前端宿主、集成 wagmi 钱包连接与链上排行榜的贪吃蛇游戏。前端位于 `frontend/`，合约工程独立在 `contracts/`（Foundry）。

## 技术栈

- 前端：Next.js + React
- Web3：wagmi + viem
- 合约：Foundry（`contracts/`）

## 快速开始（推荐）

确保已安装 Node.js、npm 以及 Foundry（forge/anvil）。

```bash
make dev
```

`make dev` 会自动：
- 启动本地 anvil（RPC `http://127.0.0.1:8545`）
- 部署 `SnakeScoreboard`
- 同步 ABI/地址到前端
- 写入 `frontend/public/scoreboard.json`
- 启动前端开发服务器

启动后访问 Next.js 默认地址（通常是 `http://localhost:3000`）。

## 手动启动

```bash
make anvil
make deploy
make web
```

或仅前端：

```bash
cd frontend
npm install
npm run dev
```

## 环境变量

复制示例文件后再填写实际值：
`cp frontend/.env.local.example frontend/.env.local`

- `NEXT_PUBLIC_SCOREBOARD_ADDRESS`：合约地址（`make deploy` 会写入）
- `NEXT_PUBLIC_ANVIL_RPC_URL`（可选）：自定义 RPC URL（默认 `http://127.0.0.1:8545`）

地址读取优先级：`frontend/public/scoreboard.json` > `.env.local` > `frontend/lib/scoreboard.address.json`。

## 目录结构（核心）

```
.
├─ frontend/
│  ├─ pages/
│  │  └─ index.tsx               # 游戏与 UI 主页面
│  ├─ components/
│  │  ├─ Head/                   # 页面 head 配置
│  │  └─ WalletStatus.tsx        # 钱包状态浮层
│  ├─ lib/
│  │  ├─ scoreboardClient.ts     # 读链客户端（viem）
│  │  └─ scoreboardRuntime.ts    # 运行时地址读取
│  └─ public/
│     └─ scoreboard.json         # 运行时配置（地址/RPC）
├─ contracts/
│  └─ src/SnakeScoreboard.sol    # 链上排行榜合约
└─ scripts/
   └─ sync-contract.js           # ABI/地址同步脚本
```

## 架构与流程

### 启动与渲染
1. Next.js 入口为 `pages/index.tsx`
2. `Head` 设置页面 metadata 与 favicon
3. `WalletStatus` 显示钱包状态与连接入口
4. Canvas 负责游戏渲染与交互

### 关键交互
- 未连接钱包无法开始游戏（前端 gating）
- 游戏结束自动提交成绩（钱包签名）
- 排行榜/历史成绩在点击时强制刷新，并在交易确认后刷新

## 核心逻辑

- 游戏循环：蛇移动、吃星星加分、碰撞判定
- 难度与速度：随分数提升速度峰值
- 暂停/继续：支持手动暂停与弹窗触发暂停
- 结算逻辑：游戏结束触发链上提交

## 数据与持久化

- 主要数据写入链上 `SnakeScoreboard`
- 地址与 RPC 通过 `public/scoreboard.json` 运行时读取
- 链上数据读取失败会提示明确错误（RPC/地址失效）

## Web3 / 链上交互

- 读取排行榜：`fetchGlobalTop()`  
- 读取历史成绩：`fetchUserRecent(address)`  
- 提交成绩：`submitScore(score, durationSec, speedPeak)`  

合约概要（`contracts/src/SnakeScoreboard.sol`）：
- `MAX_RECORDS = 20`
- `getGlobalTop()` / `getUserRecent()` / `submitScore()`

## 常用命令

根目录（Makefile）：
- `make dev`：一键启动（anvil + deploy + sync + frontend）
- `make anvil` / `make deploy` / `make web`
- `make build-contracts` / `make test` / `make clean`

合约（Foundry）：
```bash
cd contracts
forge build
forge test
```

前端：
```bash
cd frontend
npm run dev
npm run build
npm run start
npm run lint
```

## 排错指南

- **提示“合约未部署或地址失效”**
  - 运行 `make deploy` 或 `make dev`
  - 确认 `frontend/public/scoreboard.json` 地址正确
- **RPC 无响应**
  - 确认 anvil 是否运行（`make anvil`）
- **链 ID 错误**
  - 切换到本地链 `31337`

## 标准化命令（统一模板）
```bash
make help
make dev
make deploy
make web
make build-contracts
make test
make anvil
make clean
```
