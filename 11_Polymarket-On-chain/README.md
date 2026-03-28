# 11 Polymarket On-chain（Pari-mutuel 教学版）

## 项目定位
- 教学目标：在本地链跑通“创建事件 -> 买是/买否 -> 结算 -> 赎回”。
- 核心模型：Pari-mutuel 二元奖池，不使用订单簿撮合。
- 当前范围：ETH 抵押、ERC1155 头寸、30 秒冷静期、无争议主流程。

## 核心规则
- 用户通过 `buyYes` / `buyNo` 购买 ERC1155 头寸（1 ETH -> 1 份）。
- 首页与详情概率按池子占比展示：
  - `yesRatio = yesPool / (yesPool + noPool)`
  - `noRatio = 1 - yesRatio`
- 事件结算后：
  - `Yes/No` 胜方按快照比例分配：`payout = userWinningAmount * totalPoolSnapshot / winningPoolSnapshot`
  - `Invalid` 按 1:1 退款：`payout = yesAmount + noAmount`
- 若最终结果为 `Yes/No` 但赢家池为 0，系统自动按 `Invalid` 处理。

## 角色
| 角色 | 职责 |
| --- | --- |
| Owner | 创建事件、管理 resolver |
| Resolver | 提案并最终化结果 |
| Trader | 买入是/否、结算后赎回 |

## 5 分钟跑通
```bash
cd 11_Polymarket-On-chain
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
make dev
```

- `make dev` 会执行：`restart-anvil -> deploy -> web`
- 部署会同步地址与 ABI 到前端
- 打开 `http://localhost:3000`，连接 `31337` 后体验完整流程

## 合约主流程
1. Owner 创建事件（`createEvent` / `createEventWithDuration`）。
2. 用户在开放期内 `buyYes` / `buyNo`。
3. 到期后 Resolver `proposeResolution`，冷静期后 `finalizeResolution`。
4. 用户 `redeemToETH` 赎回。

## 前端主页面
- `/events`：事件列表 + 标签筛选（全部/金融/体育）+ 池子概率展示。
- `/events/[id]`：二元买入面板、持仓、结算赎回、活动流。
- `/events/resolve` 与 `/events/[id]/resolve`：Resolver 结算流程。

## 常用命令
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

## 关键环境变量
- `.env`：`PRIVATE_KEY`、`RPC_URL`、`CHAIN_ID`
- `frontend/.env.local`（由 `make deploy` 自动写入）：
  - `NEXT_PUBLIC_EVENT_FACTORY_ADDRESS`
  - `NEXT_PUBLIC_POSITION_TOKEN_ADDRESS`
  - `NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS`
  - `NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS`
