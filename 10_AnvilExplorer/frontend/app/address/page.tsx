import { redirect } from "next/navigation";
import PageHeader from "@/components/explorer/PageHeader";
import PanelSection from "@/components/explorer/PanelSection";
import { getAddress, isAddress } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 取 query 参数的首值（兼容 string[]）。
 */
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * 地址查询页：
 * - 输入地址并跳转到地址详情页；
 * - 非法地址在当前页提示错误。
 */
export default async function AddressLookupPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").trim();

  let error: string | null = null;
  if (q) {
    if (isAddress(q)) {
      redirect(`/address/${getAddress(q)}`);
    }
    error = "地址格式错误，请输入 0x 开头的 42 位十六进制地址。";
  }

  return (
    <>
      <PageHeader
        kicker="Address Explorer"
        title="地址查询"
        description="输入 EVM 地址并跳转到地址详情页。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "地址" }]}
      />

      <PanelSection
        kicker="Address Lookup"
        title="输入地址"
        description="仅支持标准 EVM 地址（0x + 40 位十六进制）。"
      >
        <form action="/address" method="get" className="space-y-3">
          <label className="field block">
            <span className="label">地址</span>
            <input
              name="q"
              className="input h-10 text-sm"
              placeholder="0x..."
              defaultValue={q}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn h-10 px-4 text-sm">
            查询地址
          </button>
        </form>

        {error ? (
          <div className="notice mt-3">{error}</div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">示例：0x5FbDB2315678afecb367f032d93F642f64180aa3</p>
        )}
      </PanelSection>
    </>
  );
}
