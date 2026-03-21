import { isAddress, isHex, numberToHex, type PublicClient } from "viem";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

// 调试网关允许的只读 RPC method 白名单，防止任意危险调用。
const READONLY_METHODS = new Set([
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getLogs",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_chainId",
  "web3_clientVersion",
  "trace_transaction",
  "debug_traceTransaction",
]);

/**
 * 把十进制/十六进制输入标准化为 RPC quantity hex。
 */
const toQuantityHex = (value: string | number | bigint) => {
  if (typeof value === "string") {
    const input = value.trim();
    if (isHex(input)) return input;
    if (/^\d+$/.test(input)) return numberToHex(BigInt(input));
    throw new Error("invalid numeric value");
  }
  return numberToHex(BigInt(value));
};

/**
 * 统一 body 解析与校验。
 * 校验失败抛错，由路由层返回 400。
 */
const parseBody = <T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
};

/**
 * 注册本地调试路由：
 * - `/v1/debug/rpc`：只读 RPC 转发；
 * - 其他 `/v1/debug/*`：Anvil 专属调试能力（snapshot/mine/time/impersonate/state）。
 */
export const registerDebugRoutes = (app: FastifyInstance, client: PublicClient) => {
  // 统一底层 RPC 请求入口，便于后续增加日志与限流。
  const requestRpc = (method: string, params: unknown[] = []) =>
    client.request({ method: method as any, params } as any);

  /**
   * 只读 RPC 代理。
   */
  app.post("/v1/debug/rpc", async (request, reply) => {
    try {
      const body = parseBody(
        z.object({
          method: z.string().min(1),
          params: z.array(z.unknown()).optional(),
        }),
        request.body
      );
      if (!READONLY_METHODS.has(body.method)) {
        return reply.status(403).send({ ok: false, error: "method not allowed" });
      }
      const result = await requestRpc(body.method, body.params ?? []);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 创建链快照，返回 snapshotId。
   */
  app.post("/v1/debug/snapshot", async () => {
    const result = await requestRpc("evm_snapshot");
    return { ok: true, result };
  });

  /**
   * 回滚到指定快照。
   */
  app.post("/v1/debug/revert", async (request, reply) => {
    try {
      const body = parseBody(z.object({ snapshotId: z.union([z.string(), z.number()]) }), request.body);
      const result = await requestRpc("evm_revert", [body.snapshotId]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 手动出块：可指定块数与间隔秒数。
   */
  app.post("/v1/debug/mine", async (request, reply) => {
    try {
      const body = parseBody(
        z.object({
          blocks: z.number().int().min(1).max(10000).optional(),
          intervalSeconds: z.number().int().min(0).max(3600).optional(),
        }),
        request.body ?? {}
      );
      const result = await requestRpc(
        "evm_mine",
        body.blocks ? [toQuantityHex(body.blocks), body.intervalSeconds ?? 0] : []
      );
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 增加虚拟链时间（秒）。
   */
  app.post("/v1/debug/time/increase", async (request, reply) => {
    try {
      const body = parseBody(z.object({ seconds: z.number().int().min(1) }), request.body);
      const result = await requestRpc("evm_increaseTime", [body.seconds]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 设置下一块时间戳。
   */
  app.post("/v1/debug/time/set-next", async (request, reply) => {
    try {
      const body = parseBody(
        z.object({ timestamp: z.union([z.string().regex(/^\d+$/), z.number().int().min(0)]) }),
        request.body
      );
      const timestamp =
        typeof body.timestamp === "number" ? body.timestamp : Number(body.timestamp);
      const result = await requestRpc("evm_setNextBlockTimestamp", [timestamp]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 开始地址模拟（impersonate）。
   */
  app.post("/v1/debug/impersonate/start", async (request, reply) => {
    try {
      const body = parseBody(z.object({ address: z.string() }), request.body);
      if (!isAddress(body.address)) {
        return reply.status(400).send({ ok: false, error: "invalid address" });
      }
      const result = await requestRpc("anvil_impersonateAccount", [body.address]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 停止地址模拟。
   */
  app.post("/v1/debug/impersonate/stop", async (request, reply) => {
    try {
      const body = parseBody(z.object({ address: z.string() }), request.body);
      if (!isAddress(body.address)) {
        return reply.status(400).send({ ok: false, error: "invalid address" });
      }
      const result = await requestRpc("anvil_stopImpersonatingAccount", [body.address]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 直接设置账户余额（仅本地开发链使用）。
   */
  app.post("/v1/debug/state/set-balance", async (request, reply) => {
    try {
      const body = parseBody(
        z.object({ address: z.string(), balance: z.union([z.string(), z.number(), z.bigint()]) }),
        request.body
      );
      if (!isAddress(body.address)) {
        return reply.status(400).send({ ok: false, error: "invalid address" });
      }
      const result = await requestRpc("anvil_setBalance", [
        body.address,
        toQuantityHex(body.balance),
      ]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 直接设置账户 nonce。
   */
  app.post("/v1/debug/state/set-nonce", async (request, reply) => {
    try {
      const body = parseBody(
        z.object({ address: z.string(), nonce: z.union([z.string(), z.number(), z.bigint()]) }),
        request.body
      );
      if (!isAddress(body.address)) {
        return reply.status(400).send({ ok: false, error: "invalid address" });
      }
      const result = await requestRpc("anvil_setNonce", [
        body.address,
        toQuantityHex(body.nonce),
      ]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });

  /**
   * 直接改写 storage slot/value。
   */
  app.post("/v1/debug/state/set-storage", async (request, reply) => {
    try {
      const body = parseBody(
        z.object({
          address: z.string(),
          slot: z.string(),
          value: z.string(),
        }),
        request.body
      );
      if (!isAddress(body.address)) {
        return reply.status(400).send({ ok: false, error: "invalid address" });
      }
      if (!isHex(body.slot) || !isHex(body.value)) {
        return reply.status(400).send({ ok: false, error: "slot/value 必须为 hex" });
      }
      const result = await requestRpc("anvil_setStorageAt", [
        body.address,
        body.slot,
        body.value,
      ]);
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({ ok: false, error: error instanceof Error ? error.message : "bad request" });
    }
  });
};
