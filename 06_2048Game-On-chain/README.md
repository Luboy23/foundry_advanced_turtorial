# 06 2048 Game On-chain（2048-game-on-chain）

## 项目定位与边界
- 这是 2048 链上教学版：**玩法全在前端本地运行**，只把最终成绩提交到链上。
- 设计取舍：牺牲“每步上链可验证”，换取流畅体验和低交易频率。
- 链上负责：Top10 榜单 + 玩家历史 + 最佳分统计。

## 角色与核心对象
| 角色 | 职责 | 核心对象 |
| --- | --- | --- |
| 玩家 | 本地游玩并在结算时签名提交 | 钱包地址、最终分数 |
| 前端 | 棋盘状态、自动提交、历史分页 | `AutoSubmitter`、`ScoreEventWatcher` |
| 合约 `OnChain2048Scores` | 排行榜与历史存储 | `MAX_LEADERBOARD=10`、`MAX_HISTORY=50` |

## 5 分钟跑通
```bash
cd 06_2048Game-On-chain
make dev
```
- `make dev` 会执行：`restart-anvil -> deploy -> frontend`。
- 部署后会写入 `frontend/.env.local`。
- 打开 `http://localhost:3000`，钱包切到 `31337` 后游玩。

## 业务主流程
1. 玩家连接钱包并开始本地 2048。
2. 棋盘移动、合并、计分都在前端内存执行。
3. 游戏结束触发自动提交 `submitScore(score, duration)`。
4. 合约写入玩家历史，按规则更新 Top10。
5. 合约触发 `ScoreSubmitted` 事件。
6. 前端监听事件并刷新排行榜/历史。
7. 用户可在弹窗分页查看链上历史记录。

**本地玩法与链上结算边界图**
```text
本地：按键输入 -> 棋盘演化 -> 分数累积 -> 结束
链上：submitScore -> 记录历史/榜单 -> 事件广播 -> 前端刷新
```

## 合约接口与状态
| 接口/事件 | 调用方 | 输入 | 状态变化 | 失败条件 | 前端触发入口 |
| --- | --- | --- | --- | --- | --- |
| `submitScore(uint64,uint32)` | 玩家 | 分数、时长 | 更新 `bestScores`、历史、Top10 | `score=0` 回滚 | 自动结算模块 |
| `getLeaderboard()` | 任意读 | 无 | 无 | 无 | 排行榜弹窗 |
| `getPlayerHistory(address,offset,limit)` | 任意读 | 地址+分页 | 无 | 越界返回空 | 历史弹窗 |
| `getPlayerHistoryCount(address)` | 任意读 | 地址 | 无 | 无 | 分页判断 |
| `ScoreSubmitted` | 合约发出 | 玩家、分数、是否新高 | 事件日志 | 无 | 实时刷新 |

## 代码架构与调用链
| 页面/模块 | 主要职责 | 下游调用 |
| --- | --- | --- |
| `frontend/app/page.tsx` | 主页容器与流程编排 | `components/board/*` |
| `frontend/components/onchain/AutoSubmitter.tsx` | 游戏结束后自动发交易 | `lib/contract.ts` |
| `frontend/components/onchain/ScoreEventWatcher.tsx` | 监听事件并触发刷新 | wagmi/viem event |
| `frontend/lib/contract.ts` | 合约读写封装 | `OnChain2048Scores` |
| `contracts/src/OnChain2048Scores.sol` | 排行榜/历史核心逻辑 | 环形缓冲 + 排序 |

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
make reset-anvil
```

**关键环境变量（`frontend/.env.local`）**
- `NEXT_PUBLIC_SCORE_CONTRACT_ADDRESS`：合约地址。
- `NEXT_PUBLIC_RPC_URL`：默认 `http://127.0.0.1:8545`。

## 验收与排错
| 症状 | 可能原因 | 修复命令/动作 |
| --- | --- | --- |
| `WagmiProviderNotFoundError` | 组件未包在 Web3 Provider 内 | 检查 `app/layout.tsx` |
| 提交交易失败 | 合约地址或 ABI 不一致 | 重新 `make deploy` 并重启前端 |
| 排行榜为空 | 尚无上链成绩 | 完成一局并确认交易 |
| 无法连接 RPC | Anvil 未启动 | `make restart-anvil` 或 `make dev` |
| 链不匹配 | 钱包仍在其他网络 | 切到 `31337` |

## Demo 展示
![游戏主界面（已连接，准备开始）](./docs-assets/game-ready.png)
![游戏结束（上链等待签名）](./docs-assets/game-over-pending.png)
![链上排行榜弹窗](./docs-assets/leaderboard.png)
