import { ConfigMissing } from "@/components/ConfigMissing";
import { EventsPage } from "@/components/pages/EventsPage";
import { IS_CONTRACT_CONFIGURED } from "@/lib/config";

/** 事件大厅路由：未配置合约时展示配置缺失提示。 */
export default function EventsRoute() {
  if (!IS_CONTRACT_CONFIGURED) {
    return <ConfigMissing />;
  }
  return <EventsPage />;
}
