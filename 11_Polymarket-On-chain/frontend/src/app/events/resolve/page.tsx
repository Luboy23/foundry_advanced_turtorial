import { ConfigMissing } from "@/components/ConfigMissing";
import { EventResolveListPage } from "@/components/pages/EventResolveListPage";
import { IS_CONTRACT_CONFIGURED } from "@/lib/config";

/** 事件结算列表路由：未配置合约时展示配置缺失提示。 */
export default function EventResolveListRoute() {
  if (!IS_CONTRACT_CONFIGURED) {
    return <ConfigMissing />;
  }
  return <EventResolveListPage />;
}
