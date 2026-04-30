import { fetchJson } from "@/lib/fetch-json";

type TransactionReceiptResponse = {
  hash: `0x${string}`;
  blockNumber: string;
  status: "success" | "reverted";
};

export async function waitForTransactionReceiptViaServer(txHash: `0x${string}`) {
  const params = new URLSearchParams({ hash: txHash });
  const receipt = await fetchJson<TransactionReceiptResponse>(`/api/tx/receipt?${params.toString()}`, {
    cache: "no-store"
  });

  if (receipt.status !== "success") {
    throw new Error("TRANSACTION_REVERTED");
  }

  return {
    transactionHash: receipt.hash,
    blockNumber: BigInt(receipt.blockNumber),
    status: receipt.status
  };
}
