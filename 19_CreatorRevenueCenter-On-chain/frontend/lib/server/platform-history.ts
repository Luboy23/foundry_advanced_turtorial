import { buildCurrentBillView, readCurrentBillInput } from "@/lib/server/bills";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type {
  CreatorSettlementBill,
  PlatformHistoryMonthRecord,
  PlatformHistoryParticipant,
  SplitEntry
} from "@/types/domain";

function buildRecordKey(record: Pick<PlatformHistoryMonthRecord, "monthLabel" | "batchIdHex" | "claimIdHex">) {
  return `${record.monthLabel}:${record.batchIdHex.toLowerCase()}:${record.claimIdHex.toLowerCase()}`;
}

function getParticipantSortWeight(participant: Pick<PlatformHistoryParticipant, "role" | "recipient">) {
  const config = readRuntimeConfigForScript();

  if (participant.role === "creator") {
    return 0;
  }

  const recipient = participant.recipient.toLowerCase();
  if (recipient === config.demoAddresses.collaboratorA.toLowerCase()) {
    return 1;
  }

  if (recipient === config.demoAddresses.collaboratorB.toLowerCase()) {
    return 2;
  }

  return 3;
}

export function resolvePlatformHistoryParticipantMeta(args: {
  recipient: `0x${string}`;
  creator: `0x${string}`;
  isCreator: boolean;
}) {
  const config = readRuntimeConfigForScript();
  const recipient = args.recipient.toLowerCase();

  if (args.isCreator || recipient === args.creator.toLowerCase()) {
    return {
      role: "creator" as const,
      label: "创作者"
    };
  }

  if (recipient === config.demoAddresses.collaboratorA.toLowerCase()) {
    return {
      role: "collaborator" as const,
      label: "编导"
    };
  }

  if (recipient === config.demoAddresses.collaboratorB.toLowerCase()) {
    return {
      role: "collaborator" as const,
      label: "摄影"
    };
  }

  return {
    role: "collaborator" as const,
    label: "协作者"
  };
}

export function sortPlatformHistoryParticipants(participants: PlatformHistoryParticipant[]) {
  return [...participants].sort((left, right) => {
    const weightDiff = getParticipantSortWeight(left) - getParticipantSortWeight(right);
    if (weightDiff !== 0) {
      return weightDiff;
    }

    return left.recipient.localeCompare(right.recipient);
  });
}

export function sortPlatformHistoryRecords(records: PlatformHistoryMonthRecord[]) {
  return [...records].sort((left, right) => {
    const monthDiff = right.monthLabel.localeCompare(left.monthLabel);
    if (monthDiff !== 0) {
      return monthDiff;
    }

    return right.batchIdHex.localeCompare(left.batchIdHex);
  });
}

export function dedupePlatformHistoryRecords(records: PlatformHistoryMonthRecord[]) {
  const deduped = new Map<string, PlatformHistoryMonthRecord>();

  for (const record of records) {
    const key = buildRecordKey(record);
    if (!deduped.has(key)) {
      deduped.set(key, record);
    }
  }

  return Array.from(deduped.values());
}

function hasRenderableBill(bill: CreatorSettlementBill) {
  return bill.batchIdHex !== "0x0" && (bill.grossAmount !== "0" || bill.splitRuleSnapshot.length > 0);
}

function mapSplitEntryToParticipant(entry: SplitEntry, status: CreatorSettlementBill["status"]): PlatformHistoryParticipant {
  return {
    role: entry.role,
    label: entry.label,
    recipient: entry.recipient,
    amount: entry.amount,
    amountDisplay: entry.amountDisplay,
    status
  };
}

export function buildPlatformHistoryCurrentMonthRecord(status: CreatorSettlementBill["status"]) {
  const bill = buildCurrentBillView(readCurrentBillInput(), status);

  if (!hasRenderableBill(bill)) {
    return null;
  }

  return {
    monthLabel: bill.monthLabel,
    batchIdHex: bill.batchIdHex,
    claimIdHex: bill.claimIdHex,
    grossAmount: bill.grossAmount,
    grossAmountDisplay: bill.grossAmountDisplay,
    status: bill.status,
    participants: sortPlatformHistoryParticipants(
      bill.splitRuleSnapshot.map((entry) => mapSplitEntryToParticipant(entry, bill.status))
    )
  } satisfies PlatformHistoryMonthRecord;
}
