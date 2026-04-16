# AlcoholAgeGate-zk Frontend

官方前端采用 `Next.js App Router + TypeScript`，并围绕本地 Anvil 演示链、正式 ABI、正式地址同步和浏览器内 ZK proving 组织。

常用命令：

```bash
npm install
npm run dev
npm run check
npm run build:ci
```

运行前请先在项目根目录完成：

```bash
make deploy
```

这样会同步 ABI、运行时地址、zk 产物和样例数据。
