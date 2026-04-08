import { getAppConfig } from "@/components/web3/config";
import {
  CONTRACT_ABI,
  SESSION_ACCOUNT_ABI,
  SESSION_ALLOWED_SELECTORS,
  SESSION_DURATION_SECONDS,
  SESSION_FACTORY_ABI,
  SESSION_MAX_CALLS,
  SESSION_PREFUND_WEI,
  buildRuntimeChain,
  getResolvedRuntimeConfig,
} from "@/constants";
import type { SessionStatus } from "@/types/types";
import {
  Address,
  Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  zeroAddress,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";

// 允许通过会话免签执行的链上动作名称。
export type GameActionName =
  | "makeMove"
  | "resign"
  | "claimTimeoutWin"
  | "cancelGame";

// 内存中的会话快照，记录一次授权周期的全部关键信息。
type SessionState = {
  owner: Address;
  smartAccount: Address;
  sessionKey: Address;
  privateKey: Hex;
  expiresAt: number;
  maxCalls: number;
  callsUsed: number;
};

// 会话缓存：key 为主钱包地址，value 为当前回合可复用的会话配置。
const sessionCache = new Map<Address, SessionState>();

// 判断会话是否失效：时间过期或调用次数耗尽均视为不可用。
const isSessionExpired = (session: SessionState) =>
  Math.floor(Date.now() / 1000) > session.expiresAt ||
  session.callsUsed >= session.maxCalls;

// 生成一组新的会话参数，供 setup/refresh 统一复用。
const buildSessionConfig = () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

  return {
    privateKey,
    sessionAddress: account.address,
    config: {
      sessionKey: account.address,
      expiresAt,
      maxCalls: SESSION_MAX_CALLS,
      allowedSelectors: [...SESSION_ALLOWED_SELECTORS],
      prefundAmount: SESSION_PREFUND_WEI,
    },
  };
};

// 读取 owner 对应的智能账户地址，若尚未创建则返回 undefined。
const readSmartAccountAddress = async (
  owner: Address
): Promise<Address | undefined> => {
  const runtime = getResolvedRuntimeConfig();
  const account = (await readContract(getAppConfig(), {
    address: runtime.sessionFactoryAddress,
    abi: SESSION_FACTORY_ABI,
    functionName: "accountOf",
    args: [owner],
  })) as Address;

  if (account === zeroAddress) {
    return undefined;
  }
  return account;
};

// 写入会话缓存并返回同一个对象，便于调用链串联。
const cacheSession = (state: SessionState) => {
  sessionCache.set(state.owner, state);
  return state;
};

// 测试辅助：直接注入会话缓存，便于验证会话写链逻辑。
export const setSessionForTests = (state: SessionState) => cacheSession(state);

// 主动清理某个 owner 的会话，常用于降级直连或登出后复位。
export const clearSession = (owner: Address) => {
  sessionCache.delete(owner);
};

// 测试辅助：重置全部会话缓存，避免跨用例状态泄漏。
export const resetSessionCacheForTests = () => {
  sessionCache.clear();
};

// 获取会话并执行惰性失效清理，避免 UI 读取到过期会话。
export const getSession = (owner: Address): SessionState | undefined => {
  const session = sessionCache.get(owner);
  if (!session) return undefined;
  if (isSessionExpired(session)) {
    sessionCache.delete(owner);
    return undefined;
  }
  return session;
};

// 对外暴露轻量状态，供页面文案与按钮禁用逻辑使用。
export const getSessionStatus = (owner?: Address): SessionStatus => {
  if (!owner) return "idle";
  const session = sessionCache.get(owner);
  if (!session) return "idle";
  return isSessionExpired(session) ? "expired" : "active";
};

// 解析玩家用于合约交互的地址：优先智能账户，兜底 EOA。
export const getPlayerAddress = async (
  owner?: Address
): Promise<Address | undefined> => {
  if (!owner) return undefined;
  const session = getSession(owner);
  if (session) return session.smartAccount;
  const account = await readSmartAccountAddress(owner);
  return account || owner;
};

// 开局授权入口：一次链上确认完成“开局 + 会话激活 + 预充值”。
export const setupRoundSession = async ({
  owner,
  openingCallData,
  onPhaseChange,
}: {
  owner: Address;
  openingCallData: Hex;
  onPhaseChange?: (phase: "awaiting_signature" | "confirming") => void;
}): Promise<SessionState> => {
  const runtime = getResolvedRuntimeConfig();
  const prepared = buildSessionConfig();

  const setup = await simulateContract(getAppConfig(), {
    address: runtime.sessionFactoryAddress,
    abi: SESSION_FACTORY_ABI,
    functionName: "setupRound",
    args: [runtime.tictactoeAddress, openingCallData, prepared.config],
    value: SESSION_PREFUND_WEI,
  });

  onPhaseChange?.("awaiting_signature");
  const hash = await writeContract(getAppConfig(), setup.request);
  onPhaseChange?.("confirming");
  await waitForTransactionReceipt(getAppConfig(), { hash, timeout: 30_000 });

  const smartAccount = await readSmartAccountAddress(owner);
  if (!smartAccount) {
    throw new Error("创建智能账户失败，请重试");
  }

  return cacheSession({
    owner,
    smartAccount,
    sessionKey: prepared.sessionAddress,
    privateKey: prepared.privateKey,
    expiresAt: prepared.config.expiresAt,
    maxCalls: prepared.config.maxCalls,
    callsUsed: 0,
  });
};

// 刷新已有智能账户的会话授权，不改账户地址，仅更新会话密钥与配额。
export const refreshSession = async (
  owner: Address,
  onPhaseChange?: (phase: "awaiting_signature" | "confirming") => void
): Promise<SessionState> => {
  const runtime = getResolvedRuntimeConfig();
  const smartAccount = await readSmartAccountAddress(owner);
  if (!smartAccount) {
    throw new Error("未找到智能账户，请先创建或加入对局");
  }

  const prepared = buildSessionConfig();
  const refresh = await simulateContract(getAppConfig(), {
    address: runtime.sessionFactoryAddress,
    abi: SESSION_FACTORY_ABI,
    functionName: "refreshSession",
    args: [runtime.tictactoeAddress, prepared.config],
    value: SESSION_PREFUND_WEI,
  });

  onPhaseChange?.("awaiting_signature");
  const hash = await writeContract(getAppConfig(), refresh.request);
  onPhaseChange?.("confirming");
  await waitForTransactionReceipt(getAppConfig(), { hash, timeout: 30_000 });

  return cacheSession({
    owner,
    smartAccount,
    sessionKey: prepared.sessionAddress,
    privateKey: prepared.privateKey,
    expiresAt: prepared.config.expiresAt,
    maxCalls: prepared.config.maxCalls,
    callsUsed: 0,
  });
};

// 使用会话密钥发起免签交易；成功后扣减调用额度并更新缓存。
export const sendGameAction = async ({
  owner,
  action,
  args,
  onPhaseChange,
}: {
  owner: Address;
  action: GameActionName;
  args: readonly unknown[];
  onPhaseChange?: (phase: "awaiting_signature" | "confirming") => void;
}) => {
  const runtime = getResolvedRuntimeConfig();
  const session = getSession(owner);
  if (!session) {
    throw new Error("当前会话不可用，请先重新授权");
  }

  const chain = buildRuntimeChain(runtime);
  const account = privateKeyToAccount(session.privateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(runtime.rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(runtime.rpcUrl),
  });

  const data = encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: action,
    args,
  });

  onPhaseChange?.("awaiting_signature");
  const hash = await walletClient.writeContract({
    address: session.smartAccount,
    abi: SESSION_ACCOUNT_ABI,
    functionName: "executeWithSession",
    args: [runtime.tictactoeAddress, data],
  });

  onPhaseChange?.("confirming");
  await publicClient.waitForTransactionReceipt({ hash });

  session.callsUsed += 1;
  if (session.callsUsed >= session.maxCalls) {
    sessionCache.delete(owner);
  } else {
    sessionCache.set(owner, session);
  }
};
