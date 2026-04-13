# 高考录取资格证明系统前端

`16_UniversityCutoffProof-zk/frontend` 是项目的正式前端，当前采用：

- `Next.js App Router`
- `TypeScript`
- `wagmi + viem`
- `snarkjs + worker` 浏览器内 proving
- `NestJS workbench API + OpenAPI 生成类型`

## 当前能力

- 读取 `public/contract-config.json`
- 连接钱包并做角色 / 链守卫
- 考试院导入本届成绩、生成学生凭证、发布成绩源
- 大学设置录取线、创建规则并审批学生申请
- 学生导入成绩凭证，在浏览器内生成申请证明并提交链上申请
- 通过 NestJS 后端读取考试院 / 大学 / 学生三端工作台聚合数据
- 通过 OpenAPI 生成前后端共享类型

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run backend:types
```

## 推荐启动方式

从项目根目录执行：

```bash
make dev
make dev-fresh
```

这会自动：

1. 启动新链并部署合约
2. 初始化或复用 `backend/dev.db`
3. 启动 NestJS 后端
4. 同步 OpenAPI 生成的前端类型
5. 启动 Next 前端

如果你需要把后端托管的草稿、发放记录和辅助记录一起清空，再从头做演示，可以使用：

```bash
make dev-fresh
```

## 前端与后端边界

前端保留：

- 钱包连接
- 角色守卫
- 学生本地导入成绩凭证
- 浏览器内 proving
- 链上交易直发

后端接管：

- 工作台聚合读模型
- 考试院成绩草稿
- 发放记录
- 学生辅助记录
- 链上发布 / 规则 / 申请 / 审批历史投影

默认本地开发不需要 PostgreSQL，也不需要 Docker。后端会直接使用 `backend/dev.db` 作为 SQLite 数据库文件。

## 说明

- `types/generated/backend-api.ts` 由后端 OpenAPI 生成。
- 页面主数据源已经切到 NestJS 的 `workbench` API。
- 链上写操作成功后，前端会刷新对应的 `workbench` 查询，而不再自己大面积扫链上事件。
