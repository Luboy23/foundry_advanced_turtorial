import { CheckCircle2, PlugZap, Wallet } from "lucide-react";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { formatAddress } from "@/lib/utils";

export function WalletStatusCard({
  address,
  connectorName,
  connected,
  onConnect,
  onDisconnect,
  connecting
}: {
  address: string | undefined;
  connectorName: string | null;
  connected: boolean;
  onConnect: () => Promise<void> | void;
  onDisconnect: () => void;
  connecting?: boolean;
}) {
  return (
    <SectionCard title="1. 连接钱包" description="大学申请资格证明会与当前钱包地址绑定。">
      {connected && address ? (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge variant="success">已连接</Badge>
            <div className="flex items-center gap-2 text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold">{formatAddress(address, 5)}</span>
            </div>
            <p className="text-sm text-slate-500">
              当前连接器：{connectorName ?? "Injected"}。更换钱包地址后，需要重新生成该校的录取资格 proof。
            </p>
          </div>
          <Button variant="outline" onClick={onDisconnect}>
            <PlugZap className="h-4 w-4" />
            断开连接
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <Wallet className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">尚未连接钱包</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              连接钱包后，前端会把当前地址映射为 recipientField，并用于生成“当前钱包对该校”的 nullifier。
            </p>
          </div>
          <Button onClick={() => void onConnect()} disabled={connecting}>
            {connecting ? "连接中..." : "连接钱包"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
