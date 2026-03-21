import CastConsole from "@/components/CastConsole";
import PageHeader from "@/components/explorer/PageHeader";
import PanelSection from "@/components/explorer/PanelSection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Cast 页面：聚合 RPC 调试与离线编码工具。
 */
export default function CastPage() {
  return (
    <>
      <PageHeader
        kicker="Debug Console"
        title="Cast 控制台"
        description="聚合 RPC 只读查询与离线编码工具，便于教学演示。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "Cast" }]}
      />

      <PanelSection
        title="开发者控制台"
        kicker="Cast Workbench"
        description="分组式参数输入区 + 结果区，适合快速排查链上数据。"
      >
        <CastConsole />
      </PanelSection>
    </>
  );
}
