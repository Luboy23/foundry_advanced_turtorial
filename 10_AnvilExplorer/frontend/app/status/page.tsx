import PageHeader from "@/components/explorer/PageHeader";
import HashValue from "@/components/explorer/HashValue";
import MetricCard from "@/components/explorer/MetricCard";
import PanelSection from "@/components/explorer/PanelSection";
import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { getChainFingerprint } from "@/lib/data";
import { formatNumber, formatTimestamp, shortenHash } from "@/lib/format";
import {
  getChainId,
  getDataSourceMode,
  getCreatorQuickScanBlocks,
  getIndexerUrl,
  getRpcUrl,
  getRpcFallbackEnabled,
  getScanBlocks,
  getScanCacheTtlMs,
  getScanConcurrency,
} from "@/lib/rpc";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 链指纹展示行定义，控制 UI 字段顺序。
const rows = [
  { key: "chainId", label: "Chain ID" },
  { key: "clientVersion", label: "Client Version" },
  { key: "latestBlockNumber", label: "最新区块" },
  { key: "latestBlockTimestamp", label: "最新区块时间" },
  { key: "latestBlockHash", label: "最新区块哈希" },
  { key: "genesisHash", label: "创世块哈希" },
] as const;

/**
 * 链状态页：展示链指纹与前端运行参数。
 */
export default async function StatusPage() {
  // `fingerprint` 是链指纹数据；`error` 为读取失败提示。
  let fingerprint: Awaited<ReturnType<typeof getChainFingerprint>> | null = null;
  let error: string | null = null;

  try {
    fingerprint = await getChainFingerprint();
  } catch (err) {
    error = err instanceof Error ? err.message : "无法读取链指纹";
  }

  return (
    <>
      <PageHeader
        kicker="Runtime Status"
        title="链状态"
        description="查看当前节点连接、链指纹与扫描参数。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "链状态" }]}
      />

      <section className="tech-grid">
        <MetricCard
          label="Chain ID"
          value={fingerprint?.chainId ?? getChainId()}
          hint="当前连接链标识"
        />
        <MetricCard
          label="Data Source"
          value={getDataSourceMode()}
          valueClassName="uppercase"
          hint={`RPC Fallback: ${getRpcFallbackEnabled() ? "enabled" : "disabled"}`}
        />
        <MetricCard
          label="Latest Block"
          value={formatNumber(fingerprint?.latestBlockNumber ?? null)}
          hint={formatTimestamp(fingerprint?.latestBlockTimestamp ?? null)}
        />
        <MetricCard
          label="Scan Blocks"
          value={getScanBlocks()}
          hint={`并发 ${getScanConcurrency()} / TTL ${getScanCacheTtlMs()}ms`}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <PanelSection
          title="链指纹"
          kicker="Chain Fingerprint"
          description="用于确认当前连接是否为预期 Anvil 网络。"
          className="lg:col-span-2"
        >
          {error ? <div className="notice">{error}</div> : null}
          {fingerprint ? (
            <div className="rounded-xl border border-white/70 bg-white/72 px-3 py-1.5">
              {rows.map((row, index) => {
                // `value` 根据字段键动态组装展示内容。
                let value: ReactNode = "-";
                if (row.key === "chainId") value = fingerprint.chainId;
                if (row.key === "clientVersion") value = fingerprint.clientVersion;
                if (row.key === "latestBlockNumber") value = formatNumber(fingerprint.latestBlockNumber);
                if (row.key === "latestBlockTimestamp")
                  value = formatTimestamp(fingerprint.latestBlockTimestamp);
                if (row.key === "latestBlockHash") {
                  value = fingerprint.latestBlockHash ? (
                    <HashValue value={fingerprint.latestBlockHash} short={false} />
                  ) : (
                    "-"
                  );
                }
                if (row.key === "genesisHash") {
                  value = fingerprint.genesisHash ? (
                    <HashValue value={fingerprint.genesisHash} short={false} />
                  ) : (
                    "-"
                  );
                }
                return (
                  <div key={row.key}>
                    <div className="grid gap-1 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-center">
                      <p className="text-xs text-slate-500">{row.label}</p>
                      <div className="min-w-0 text-sm text-slate-700">{value}</div>
                    </div>
                    {index < rows.length - 1 ? (
                      <Separator className="bg-white/75" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </PanelSection>

        <PanelSection
          title="运行参数"
          kicker="Frontend Runtime"
          description="前端读取的环境配置。"
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-white/70 bg-white/75 p-3">
              <p className="text-xs text-slate-500">RPC URL</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{getRpcUrl()}</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/75 p-3">
              <p className="text-xs text-slate-500">INDEXER URL</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{getIndexerUrl()}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">CHAIN ID</p>
                <p className="mt-1 font-display text-base text-slate-800">{getChainId()}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/75 p-3">
                <p className="text-xs text-slate-500">QUICK SCAN BLOCKS</p>
                <p className="mt-1 font-display text-base text-slate-800">
                  {getCreatorQuickScanBlocks()}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/75 p-3">
              <p className="text-xs text-slate-500">最新块哈希(短)</p>
              <p className="mt-1 font-mono text-xs text-slate-700">
                {fingerprint?.latestBlockHash ? shortenHash(fingerprint.latestBlockHash, 10, 8) : "-"}
              </p>
            </div>
          </div>
        </PanelSection>
      </section>
    </>
  );
}
