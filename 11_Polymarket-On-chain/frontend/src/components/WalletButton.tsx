"use client";

import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientMounted } from "@/hooks/useClientMounted";
import { copy } from "@/lib/copy";
import { CHAIN_ID } from "@/lib/config";

/** 地址缩写展示：`0x1234...abcd`。 */
const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

/** 钱包连接入口：展示连接态、网络态与断开动作。 */
export function WalletButton() {
  const mounted = useClientMounted();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const wrongNetwork = isConnected && chainId !== CHAIN_ID;

  // 保证 SSR 输出与首帧客户端渲染一致，避免水合不一致告警。
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" type="button" disabled data-testid="wallet-connect-button">
        {copy.wallet.connect}
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={wrongNetwork ? "destructive" : "secondary"} data-testid="wallet-network-badge">
          {wrongNetwork ? copy.wallet.wrongNetwork(chainId) : copy.common.localChain(CHAIN_ID)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => disconnect()}
          data-testid="wallet-connected-button"
        >
          {formatAddress(address)}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
      disabled={isPending || connectors.length === 0}
      data-testid="wallet-connect-button"
    >
      {connectors.length === 0 ? copy.wallet.noWalletDetected : isPending ? copy.wallet.connecting : copy.wallet.connect}
    </Button>
  );
}
