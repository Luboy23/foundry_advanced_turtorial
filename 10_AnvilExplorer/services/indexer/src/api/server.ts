import Fastify from "fastify";
import type { DbClient } from "../db/client.js";
import { indexerConfig } from "../config.js";
import { SyncLoop } from "../sync/sync-loop.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerDebugRoutes } from "./routes/debug.js";

/**
 * 创建 Indexer API 服务器：
 * - 读取接口（`/v1/*`）面向前端数据展示；
 * - 调试接口（`/v1/debug/*`）面向本地开发调试。
 */
export const createApiServer = (db: DbClient, sync: SyncLoop) => {
  const app = Fastify({ logger: false });
  registerReadRoutes(app, { db, client: sync.getClient() });
  registerDebugRoutes(app, sync.getClient());

  return {
    app,
    /**
     * 启动 HTTP 监听。
     */
    async start() {
      await app.listen({ host: indexerConfig.host, port: indexerConfig.port });
      console.log(`[indexer] listening on http://${indexerConfig.host}:${indexerConfig.port}`);
    },
    /**
     * 停止 HTTP 服务并释放 Fastify 资源。
     */
    async stop() {
      await app.close();
    },
  };
};
