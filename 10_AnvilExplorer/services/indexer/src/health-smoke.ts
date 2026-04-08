import Fastify from "fastify";
import { openDatabase, nowTs } from "./db/client.js";
import { registerReadRoutes } from "./api/routes/read.js";

const run = async () => {
  const db = openDatabase();

  db.prepare(
    `
      INSERT OR REPLACE INTO chain_meta (
        id,
        chain_id,
        rpc_url,
        genesis_hash,
        latest_rpc_block,
        indexed_block,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(1, 31337, "http://127.0.0.1:8545", null, "128", "128", nowTs());

  const app = Fastify({ logger: false });
  registerReadRoutes(app, { db, client: {} as never });

  const response = await app.inject({
    method: "GET",
    url: "/v1/health",
  });

  const payload = response.json() as { ok?: boolean };
  if (response.statusCode !== 200 || payload.ok !== true) {
    throw new Error(`Health endpoint failed: ${response.statusCode} ${response.body}`);
  }

  await app.close();
  db.close();
  console.log("[indexer] health smoke passed");
};

run().catch((error) => {
  console.error("[indexer] health smoke failed:", error);
  process.exit(1);
});
