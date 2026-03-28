import { ConfigMissing } from "@/components/ConfigMissing";
import { CreateEventPage } from "@/components/pages/CreateEventPage";
import { IS_CONTRACT_CONFIGURED } from "@/lib/config";

/** 创建事件路由：未配置合约时展示配置缺失提示。 */
export default function CreateEventRoute() {
  if (!IS_CONTRACT_CONFIGURED) {
    return <ConfigMissing />;
  }
  return <CreateEventPage />;
}
