type MinimalTransactionReceipt = {
  status: "success" | "reverted";
};

export function assertSuccessfulTransactionReceipt(
  receipt: MinimalTransactionReceipt,
  actionLabel: string
) {
  if (receipt.status !== "success") {
    throw new Error(`${actionLabel}交易已回退，链上状态未更新。`);
  }

  return receipt;
}
