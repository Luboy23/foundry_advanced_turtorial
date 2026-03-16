# Frontend（BookManagement On-chain）

面向“图书借阅管理平台”的前端应用：
- `/admin`：馆员工作台（仪表盘 / 馆藏管理 / 借阅台账 / 读者管理）
- `/reader`：读者门户（注册 / 书目查询 / 个人借阅历史）

## 启动
```bash
npm install
npm run dev
```

> `dev` 与 `build` 默认走 Turbopack。  
> 若需要回退 Webpack，可使用 `npm run dev:webpack` 或 `npm run build:webpack`。

演示建议：
```bash
npm run preview
```

推荐根目录一键启动（包含部署与 ABI 同步）：
```bash
cd ..
make dev
```

## 脚本
```bash
npm run lint
npm run typecheck
npm run build
npm run build:webpack
npm run start
npm run preview
npm run dev:webpack
```

## 环境变量
在 `frontend/.env.local` 配置：
```env
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

## 数据边界
- 链上：书籍摘要、库存状态、读者状态、借阅流水
- 链下：书名/作者映射（`bookMetaMap`，用于前端展示）

## 排错
1. 提示“缺少 NEXT_PUBLIC_CONTRACT_ADDRESS”：先执行 `make deploy` 或 `make dev`。
2. 管理端写操作失败：确认钱包在 `31337`，且地址是 owner/operator。
3. 借阅登记失败：确认读者已注册并启用，书籍处于上架且库存充足。
4. 启动报 `EADDRINUSE ... :3000`：使用 `make dev WEB_PORT=3001` 或 `PORT=3001 npm run preview`。
