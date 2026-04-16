import Link from "next/link";
import { StatePanel } from "@/components/shared/StatePanel";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <StatePanel
        title="页面不存在"
        description="当前路由没有对应的业务页面，请返回首页、买家中心或年龄验证方页重新进入。"
        action={
          <Link href="/" className="btn-primary">
            返回首页
          </Link>
        }
      />
    </div>
  );
}
