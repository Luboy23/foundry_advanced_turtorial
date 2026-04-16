import { StatePanel } from "@/components/shared/StatePanel";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <StatePanel
        title="页面正在准备"
        description="页面内容正在准备中，请稍候。"
      />
    </div>
  );
}
