import { EventState, Outcome, type EventEntity, type ResolutionEntity } from "@/lib/event-types";

type EventTuple = [string, bigint, number, number, bigint, bigint, bigint, bigint, bigint, string, string];
type ResolutionTuple = [`0x${string}`, number, bigint, boolean, boolean, bigint];

/**
 * 将 `getEvent` 返回的 tuple 解码为前端实体对象。
 * 保持字段顺序与合约 ABI 一致，避免位置错配导致状态展示异常。
 */
export function decodeEventTuple(eventId: bigint, tuple: EventTuple): EventEntity {
  return {
    id: eventId,
    question: tuple[0],
    closeTime: tuple[1],
    state: tuple[2] as EventState,
    finalOutcome: tuple[3] as Outcome,
    totalCollateral: tuple[4],
    yesPool: tuple[5],
    noPool: tuple[6],
    totalPoolSnapshot: tuple[7],
    winningPoolSnapshot: tuple[8],
    resolutionSourceURI: tuple[9],
    metadataURI: tuple[10]
  };
}

/**
 * 将 `getResolutionState` 返回的 tuple 解码为前端结算状态实体。
 * 当 proposer 为零地址时转换为 `null`，便于 UI 统一展示空态。
 */
export function decodeResolutionTuple(tuple: ResolutionTuple): ResolutionEntity {
  return {
    proposer: tuple[0] === "0x0000000000000000000000000000000000000000" ? null : tuple[0],
    proposedOutcome: tuple[1] as Outcome,
    proposedAt: tuple[2],
    proposed: tuple[3],
    finalized: tuple[4],
    canFinalizeAt: tuple[5]
  };
}
