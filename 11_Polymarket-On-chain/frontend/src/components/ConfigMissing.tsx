import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

/** 合约配置缺失提示卡片。 */
export function ConfigMissing() {
  return (
    <Card className="border-black/80">
      <CardHeader>
        <CardTitle className="text-xl">{copy.config.notReadyTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-neutral-700">
        <p>{copy.config.notReadyBody}</p>
        <p className="font-mono text-xs text-neutral-500">
          NEXT_PUBLIC_EVENT_FACTORY_ADDRESS / POSITION_TOKEN_ADDRESS / ETH_COLLATERAL_VAULT_ADDRESS /
          ORACLE_ADAPTER_ADDRESS
        </p>
      </CardContent>
    </Card>
  );
}
