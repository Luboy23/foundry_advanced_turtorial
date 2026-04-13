import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/shared/Button";

export function ChainGuardNotice({
  expectedChainId,
  onSwitch,
  switching
}: {
  expectedChainId: number;
  onSwitch: () => Promise<void> | void;
  switching?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-amber-900">当前网络与项目配置不一致</h3>
            <p className="mt-1 text-sm text-amber-800">
              请切换到 chainId = {expectedChainId} 后再生成与提交证明。
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void onSwitch()} disabled={switching}>
          {switching ? "切换中..." : "切换网络"}
        </Button>
      </div>
    </div>
  );
}
