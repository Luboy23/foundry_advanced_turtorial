import { redirect } from "next/navigation";

/** 根路由重定向：统一进入事件大厅。 */
export default function HomePage() {
  redirect("/events");
}
