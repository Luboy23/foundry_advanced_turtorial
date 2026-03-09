# 07_LightOut-Game-On-chain

## 项目简介
关灯游戏教学项目：玩家在前端完成 Lights Out 关卡后，可将成绩提交到链上，并在链上榜单中查看排名与历史记录。

## 技术栈
- Contracts: Solidity `0.8.20` + Foundry
- Frontend: Next.js `16.1.6` + React `19.2.3` + Tailwind CSS `4`
- Web3: wagmi `2.12.2` + viem `2.24.3`
- State: Zustand `5.0.11`

## 快速开始
```bash
make dev
```

## 目录结构（核心）
```text
07_LightOut-Game-On-chain/
├── Makefile
├── README.md
├── docs-assets/
├── contracts/
│   ├── src/LightsOutResults.sol
│   ├── test/LightsOutResults.t.sol
│   └── script/Deploy.s.sol
└── frontend/
    ├── src/app
    ├── src/components
    ├── src/store
    └── src/lib
```

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

## 核心链路
1. 用户连接钱包，开始一局游戏。
2. 前端本地状态记录步数、用时、是否使用提示。
3. 通关后调用合约 `submitResult` 上链。
4. 前端通过 `ResultSubmitted` 事件回放链上记录，并渲染“链上榜/对局记录”。

## 环境变量
合约部署（如需手动部署）：
```bash
cp contracts/.env.example contracts/.env
```
- `PRIVATE_KEY`：部署账户私钥（默认 Anvil Account #0，仅本地测试）。

前端配置：
```bash
cp frontend/.env.local.example frontend/.env.local
```
- `NEXT_PUBLIC_CHAIN_ID`：默认 `31337`
- `NEXT_PUBLIC_RPC_URL`：默认 `http://127.0.0.1:8545`
- `NEXT_PUBLIC_LIGHTS_OUT_ADDRESS`：部署后的合约地址（`make dev` 自动写入）

## 验收与排错
- `make dev` 无法启动：检查 `anvil/forge/node/npm` 是否已安装。
- 交易按钮不可用：确认钱包网络为 `Anvil 31337`，且地址已由 `make deploy` 写入。
- 链上榜为空：先完成一次通关并签名提交，再打开“链上榜”查看。

## Demo 展示
![wallet-disconnected](./docs-assets/wallet-disconnected.png)
![game-ready](./docs-assets/game-ready.png)
![gameplay](./docs-assets/gameplay.png)
![hint-panel](./docs-assets/hint-panel.png)
![game-over-pending](./docs-assets/game-over-pending.png)
![leaderboard](./docs-assets/leaderboard.png)
![history](./docs-assets/history.png)
![settings](./docs-assets/settings.png)
