import { createConfig, http } from "wagmi";
import type { Address } from "viem";
import { injected, mock } from "wagmi/connectors";

import { foundryLocal } from "@/lib/chain";
import { RPC_URL } from "@/lib/config";

/** 是否启用 e2e 模式（使用 mock connector 自动连接测试账户）。 */
const E2E_MODE = process.env.NEXT_PUBLIC_E2E_MODE === "1";
const E2E_ACCOUNT_INDEX_RAW = Number(process.env.NEXT_PUBLIC_E2E_ACCOUNT_INDEX ?? "0");
const E2E_ACCOUNT_INDEX = Number.isInteger(E2E_ACCOUNT_INDEX_RAW) && E2E_ACCOUNT_INDEX_RAW >= 0 ? E2E_ACCOUNT_INDEX_RAW : 0;

/** Anvil 默认测试账户列表，供 e2e 模式按索引选取。 */
const ANVIL_TEST_ACCOUNTS: readonly Address[] = [
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906"
] as const;

const e2eMockAccount = ANVIL_TEST_ACCOUNTS[E2E_ACCOUNT_INDEX] ?? ANVIL_TEST_ACCOUNTS[0];
const connectors = E2E_MODE
  ? [
      mock({
        accounts: [e2eMockAccount],
        features: {
          reconnect: true
        }
      }),
      injected()
    ]
  : [injected()];

/** 应用统一使用的 wagmi 配置（本地链 + 注入钱包/测试连接器）。 */
export const wagmiConfig = createConfig({
  chains: [foundryLocal],
  connectors,
  transports: {
    [foundryLocal.id]: http(RPC_URL)
  }
});
