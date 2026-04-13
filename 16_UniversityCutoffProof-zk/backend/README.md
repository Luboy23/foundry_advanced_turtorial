# NestJS Backend

这个目录承载 `16_UniversityCutoffProof-zk` 的 NestJS 后端增强层，目标是把项目升级为：

- `Next.js 前端`
- `NestJS + Prisma + SQLite` 后端
- `Foundry + Circom` 链上与 zk 主流程

当前后端负责的职责边界是：

- 托管考试院成绩草稿
- 托管成绩凭证发放批次与发放记录
- 托管学生辅助记录
- 读取并投影链上成绩源、大学规则、学生申请与审批历史
- 为考试院 / 大学 / 学生三端提供稳定的 `workbench` 聚合 API
- 提供钱包 challenge / verify / logout 的会话骨架
- 暴露 OpenAPI 文档，供前端生成 TypeScript 类型

当前后端**不**接管：

- 钱包交易签名
- 学生浏览器内 proving
- 链上最终真相

## 技术栈

- `NestJS`
- `Express`
- `Prisma`
- `SQLite`
- `viem`
- `Swagger / OpenAPI`

## 启动方式

推荐从项目根目录直接启动整套系统：

```bash
make dev
make dev-fresh
```

这会自动完成：

1. 重启 Anvil
2. 部署合约并同步前端运行时配置
3. 初始化或复用 `backend/dev.db`
4. 启动 NestJS 后端
5. 生成前端后端 API 类型
6. 启动 Next 前端

如果你想把考试院草稿、发放记录和学生辅助记录一起清空，再从零开始演示：

```bash
make dev-fresh
```

如果你只想单独启动后端：

```bash
make backend
```

健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

OpenAPI 文档：

- JSON：`http://127.0.0.1:8787/api/openapi.json`
- Swagger UI 默认不在 `make dev` 时启用；如需开启，可设置：

```bash
BACKEND_SWAGGER_ENABLED=true
```

## 环境变量

复制 `.env.example` 为 `.env` 后可按需调整，常用项包括：

- `BACKEND_DATABASE_URL`
- `BACKEND_STORAGE_DIR`
- `BACKEND_CHAIN_RPC_URL`
- `BACKEND_CHAIN_ID`
- `BACKEND_CONTRACT_CONFIG_PATH`
- `BACKEND_SWAGGER_ENABLED`

默认数据库连接串是：

```bash
BACKEND_DATABASE_URL=file:./dev.db
```

这表示本地开发会直接使用 `backend/dev.db` 文件库，不需要额外安装 PostgreSQL，也不需要 Docker。

## 当前说明

- 索引器默认开启，会周期性把链上历史投影到 SQLite 数据库文件。
- 所有链上写操作仍由前端钱包直发。
- 学生申请证明仍在浏览器内生成，不迁到服务端。
