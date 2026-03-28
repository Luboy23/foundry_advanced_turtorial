import { ConfigMissing } from "@/components/ConfigMissing";
import { EventDetailPage } from "@/components/pages/EventDetailPage";
import { IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { redirect } from "next/navigation";

/** 事件详情路由：参数非法时回事件大厅，配置缺失时展示提示。 */
export default async function EventDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[1-9]\d*$/.test(id)) {
    redirect("/events");
  }

  if (!IS_CONTRACT_CONFIGURED) {
    return <ConfigMissing />;
  }
  return <EventDetailPage eventIdParam={id ?? ""} />;
}
