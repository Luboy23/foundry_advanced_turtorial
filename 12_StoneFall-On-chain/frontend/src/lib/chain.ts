/**
 * 模块职责：统一管理链相关基础配置（链 ID、RPC URL）。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

/** 本地开发默认 RPC。 */
export const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
/**
 * 默认链 ID（Anvil 本地链）。
 */
export const DEFAULT_CHAIN_ID = 31337;

// 允许通过环境变量覆盖链 ID，便于切换到其他本地/测试链。
const envChainId = Number(import.meta.env.VITE_CHAIN_ID ?? DEFAULT_CHAIN_ID);
/**
 * 最终生效链 ID。
 * 若环境变量不是整数则回退默认值，避免出现 NaN 链配置。
 */
export const STONEFALL_CHAIN_ID = Number.isInteger(envChainId)
  ? envChainId
  : DEFAULT_CHAIN_ID;

/**
 * 最终生效 RPC URL（可被 `.env.local` 覆盖）。
 */
export const STONEFALL_RPC_URL =
  import.meta.env.VITE_RPC_URL || DEFAULT_RPC_URL;
