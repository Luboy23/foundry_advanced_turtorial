import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    <div className="rounded-[1.5rem] border border-warning-peach/20 bg-warning-peach/10 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-peach" />
          <div>
            <h3 className="text-sm font-semibold text-text-ink">当前网络与项目配置不一致</h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              请切换到项目网络 `chainId = {expectedChainId}` 后再执行链上动作。
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
