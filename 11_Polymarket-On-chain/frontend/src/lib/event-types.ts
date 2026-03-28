import { copy } from "@/lib/copy";

/** 事件最终结果枚举（与合约 `Outcome` 对齐）。 */
export enum Outcome {
  Unresolved = 0,
  Yes = 1,
  No = 2,
  Invalid = 3
}

/** 事件生命周期状态枚举（与合约 `EventState` 对齐）。 */
export enum EventState {
  Open = 0,
  Closed = 1,
  Proposed = 2,
  Resolved = 3
}

/** 二元头寸方向枚举（与合约 `PositionSide` 对齐）。 */
export enum PositionSide {
  Yes = 0,
  No = 1
}

/** 事件基础实体：由链上 `getEvent` 解码得到。 */
export type EventEntity = {
  id: bigint;
  question: string;
  closeTime: bigint;
  state: EventState;
  finalOutcome: Outcome;
  totalCollateral: bigint;
  yesPool: bigint;
  noPool: bigint;
  totalPoolSnapshot: bigint;
  winningPoolSnapshot: bigint;
  resolutionSourceURI: string;
  metadataURI: string;
};

/** 结算提案实体：由链上 `getResolutionState` 解码得到。 */
export type ResolutionEntity = {
  proposer: `0x${string}` | null;
  proposedOutcome: Outcome;
  proposedAt: bigint;
  proposed: boolean;
  finalized: boolean;
  canFinalizeAt: bigint;
};

/** 用户在单个事件中的 YES/NO 持仓。 */
export type PositionEntity = {
  yesBalance: bigint;
  noBalance: bigint;
};

/** 事件状态到 UI 文案的映射。 */
export const eventStateLabel: Record<EventState, string> = {
  [EventState.Open]: copy.labels.eventStateOpen,
  [EventState.Closed]: copy.labels.eventStateClosed,
  [EventState.Proposed]: copy.labels.eventStateProposed,
  [EventState.Resolved]: copy.labels.eventStateResolved
};

/** 结果枚举到 UI 文案的映射。 */
export const outcomeLabel: Record<Outcome, string> = {
  [Outcome.Unresolved]: copy.labels.outcomeUnresolved,
  [Outcome.Yes]: copy.common.yes,
  [Outcome.No]: copy.common.no,
  [Outcome.Invalid]: copy.common.invalidOutcome
};

/** 头寸方向到 UI 文案的映射。 */
export const positionSideLabel: Record<PositionSide, string> = {
  [PositionSide.Yes]: copy.common.yes,
  [PositionSide.No]: copy.common.no
};
