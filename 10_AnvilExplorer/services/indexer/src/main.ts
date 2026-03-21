import { openDatabase } from "./db/client.js";
import { SyncLoop } from "./sync/sync-loop.js";
import { createApiServer } from "./api/server.js";

/**
 * 进程主入口：初始化数据库、启动 Sync Loop 与 HTTP API，并绑定优雅退出逻辑。
 */
const start = async () => {
  // `db` 是整个 Indexer 进程共享的 SQLite 连接。
  const db = openDatabase();
  // `sync` 负责持续把链上数据增量同步到本地索引库。
  const sync = new SyncLoop(db);
  await sync.init();

  const api = createApiServer(db, sync);
  await api.start();

  // 后台循环执行同步，不阻塞 API 线程启动。
  void sync.runForever();

  /**
   * 统一关闭顺序：
   * 1) 停止同步循环；
   * 2) 关闭 HTTP 服务；
   * 3) 关闭数据库句柄。
   */
  const shutdown = async () => {
    sync.stop();
    await api.stop();
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

/**
 * 启动失败即视为致命错误，直接退出进程让外部进程管理器接管重启。
 */
start().catch((error) => {
  console.error("[indexer] fatal error:", error);
  process.exit(1);
});
