# LightOut Frontend

## 简介
`frontend/` 是 07 项目的 Next.js 前端，负责游戏交互、钱包连接、链上成绩提交与榜单展示。

## 开发命令
```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

## 环境变量
复制模板：
```bash
cp .env.local.example .env.local
```

变量说明：
- `NEXT_PUBLIC_CHAIN_ID`：前端允许写交易的链 ID（默认 `31337`）
- `NEXT_PUBLIC_RPC_URL`：读链 RPC（默认 `http://127.0.0.1:8545`）
- `NEXT_PUBLIC_LIGHTS_OUT_ADDRESS`：部署后的合约地址

## 说明
- 推荐从项目根目录使用 `make dev` 一键启动（anvil + deploy + web）。
- 若仅调试前端，可在本目录执行 `npm run dev`。
