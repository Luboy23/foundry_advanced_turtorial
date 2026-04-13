"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/shared/Button";

export function WalletConnectButton({
  onConnect,
  loading
}: {
  onConnect: () => Promise<void> | void;
  loading?: boolean;
}) {
  return (
    <Button onClick={() => void onConnect()} disabled={loading} size="lg">
      <Wallet className="h-4 w-4" />
      {loading ? "连接中..." : "连接钱包"}
    </Button>
  );
}
