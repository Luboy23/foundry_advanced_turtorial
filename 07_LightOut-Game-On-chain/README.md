# 07 LightOut Game On-chain（lightout-game-on-chain）

## 项目定位与边界
- 这是 Lights Out 链上教学项目：解谜过程在前端完成，通关后把结果上链。
- 核心边界：链上只记录结果，不记录每一次点击过程。
- 教学重点：关卡生成可解、提示求解器、`moves+duration+hint` 多字段结算。

## 角色与核心对象
| 角色 | 职责 | 核心对象 |
| --- | --- | --- |
| 玩家 | 开局、解谜、提交成绩 | 当前棋盘、步数、用时 |
| 前端状态层 | 管理局内状态与本地记录 | Zustand `gameStore` |
| 合约 `LightsOutResults` | 记录最新成绩与按配置最佳成绩 | `latestResult`、`bestByConfig` |

**关卡规则 / 提示机制 / 计分逻辑**
- 目标态：棋盘全亮（`true`）。
- 点击规则：翻转“整行 + 整列”（交叉点只翻转一次）。
- 难度参数：`gridSize=4/5/6`，`density=low/medium/high`（链上映射 0/1/2）。
- 提示机制：前端 `solver` 给出解法，提交时带 `usedHint`。
- 最优判定：同一配置下，`moves` 更少优先；同步数时 `durationMs` 更短优先。

## 5 分钟跑通
```bash
cd 07_LightOut-Game-On-chain
cp contracts/.env.example contracts/.env
cp frontend/.env.local.example frontend/.env.local
make dev
```
- `make dev` 会执行：`restart-anvil -> deploy -> web`。
- 部署完成后 `NEXT_PUBLIC_LIGHTS_OUT_ADDRESS` 会自动写入 `frontend/.env.local`。
- 打开 `http://localhost:3000`，连接 Anvil 钱包并开始游戏。

## 业务主流程
1. 玩家连接钱包并选择网格大小与密度。
2. 前端生成可解棋盘并开始计时。
3. 玩家点击翻转，状态层累计 `moves`。
4. 如需提示，求解器返回建议步骤并标记 `usedHint=true`。
5. 通关后前端提交 `submitResult(gridSize,density,moves,durationMs,usedHint)`。
6. 合约更新 `latestResult` 与 `bestByConfig`。
7. 前端通过 `ResultSubmitted` 事件刷新链上记录与最佳成绩。

## 合约接口与状态
| 接口/事件 | 调用方 | 输入 | 状态变化 | 失败条件 | 前端触发入口 |
| --- | --- | --- | --- | --- | --- |
| `submitResult(uint8,uint8,uint32,uint32,bool)` | 玩家 | 配置 + 步数 + 用时 + 提示标志 | 更新最新成绩与配置最佳 | `gridSize` 或 `density` 非法 | `GameOnchainGate` |
| `getLatest(address)` | 任意读 | 玩家地址 | 无 | 无 | 记录面板 |
| `getBest(address,uint8,uint8)` | 任意读 | 玩家地址 + 配置 | 无 | 无 | 最佳成绩展示 |
| `ResultSubmitted` | 合约发出 | 玩家与成绩字段 | 事件日志 | 无 | 事件驱动刷新 |

## 代码架构与调用链
| 页面/模块 | 主要职责 | 下游调用 |
| --- | --- | --- |
| `frontend/src/app/page.tsx` | 页面入口与布局 | `GameField` / `GameActions` |
| `frontend/src/store/gameStore.ts` | 局内状态、设置、本地持久化 | `lib/game.ts` / `lib/solver.ts` |
| `frontend/src/lib/game.ts` | 棋盘生成与翻转规则 | 纯函数计算 |
| `frontend/src/lib/solver.ts` | BFS + 线性代数求解提示 | 供提示面板调用 |
| `frontend/src/lib/contract.ts` | 合约 ABI 与读写入口 | `LightsOutResults` |

## 命令与环境变量
**推荐命令（项目根目录）**
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

**关键环境变量**
- 根目录 `.env` / `contracts/.env`：`PRIVATE_KEY`、`RPC_URL`、`CHAIN_ID`。
- 前端 `frontend/.env.local`：
  - `NEXT_PUBLIC_CHAIN_ID=31337`
  - `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`
  - `NEXT_PUBLIC_LIGHTS_OUT_ADDRESS=0x...`

## 验收与排错
| 症状 | 可能原因 | 修复命令/动作 |
| --- | --- | --- |
| 开始按钮不可点 | 钱包未连或链不对 | 连接钱包并切到 `31337` |
| 提交时报地址缺失 | 未部署或 env 未写入 | `make deploy` |
| 排行榜/记录无数据 | 未完成一次通关提交 | 通关并签名上链 |
| 提示功能异常 | 当前关卡状态未同步 | 点击重开局 `newGame` |
| `make dev` 失败 | 缺少 `anvil/forge/node` | 安装依赖后重试 |

## Demo 展示
![wallet-disconnected](./docs-assets/wallet-disconnected.png)
![game-ready](./docs-assets/game-ready.png)
![leaderboard](./docs-assets/leaderboard.png)
