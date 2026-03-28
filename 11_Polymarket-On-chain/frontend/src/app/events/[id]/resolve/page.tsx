import { ConfigMissing } from "@/components/ConfigMissing";
import { EventResolvePage } from "@/components/pages/EventResolvePage";
import { IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { redirect } from "next/navigation";

/** 单事件结算路由：参数非法时回结算列表，配置缺失时展示提示。 */
export default async function EventResolveRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[1-9]\d*$/.test(id)) {
    redirect("/events/resolve");
  }

  if (!IS_CONTRACT_CONFIGURED) {
    return <ConfigMissing />;
  }
  return <EventResolvePage eventIdParam={id ?? ""} />;
}
