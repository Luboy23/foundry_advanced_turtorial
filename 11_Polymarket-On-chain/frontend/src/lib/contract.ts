import type { Abi } from "viem";

import eventFactory from "@/abi/EventFactory.json";
import positionToken from "@/abi/PositionToken.json";
import ethCollateralVault from "@/abi/ETHCollateralVault.json";
import oracleAdapter from "@/abi/OracleAdapterMock.json";

/** EventFactory ABI（主交互入口）。 */
export const eventFactoryAbi = eventFactory as Abi;
/** PositionToken ABI（ERC1155 头寸读写）。 */
export const positionTokenAbi = positionToken as Abi;
/** ETHCollateralVault ABI（金库指标查询）。 */
export const ethCollateralVaultAbi = ethCollateralVault as Abi;
/** OracleAdapter ABI（提案与最终化状态读取）。 */
export const oracleAdapterAbi = oracleAdapter as Abi;
