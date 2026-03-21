import Link from "next/link";
import HashValue from "@/components/explorer/HashValue";
import PageHeader from "@/components/explorer/PageHeader";
import TablePaginationBar from "@/components/explorer/TablePaginationBar";
import TableToolbar from "@/components/explorer/TableToolbar";
import DataTableShell from "@/components/explorer/DataTableShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRecentBlockSummaries, getScanContext } from "@/lib/data";
import { formatNumber, formatTimestamp } from "@/lib/format";
import {
  applySortOrder,
  compareNumberish,
  parseTableQuery,
  withPagination,
} from "@/lib/table-query";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 区块列表页：
 * - 展示扫描窗口内的区块摘要；
 * - 提供筛选、排序、分页；
 * - 支持进入区块详情。
 */
export default async function BlockListPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;

  let error: string | null = null;
  let blocksData: Awaited<ReturnType<typeof getRecentBlockSummaries>> | null = null;

  try {
    const scanContext = await getScanContext();
    blocksData = await getRecentBlockSummaries(scanContext.count, scanContext);
  } catch (err) {
    error = err instanceof Error ? err.message : "无法读取区块列表";
  }

  const query = parseTableQuery(params, {
    namespace: "blocksList",
    defaultSort: "number",
    defaultOrder: "desc",
    defaultPageSize: 20,
  });

  const blocks = blocksData?.blocks ?? [];

  const filteredBlocks = blocks.filter((block) => {
    if (!query.filter) return true;
    const keyword = query.filter.toLowerCase();
    return (
      block.hash?.toLowerCase().includes(keyword) ||
      block.number?.toString().includes(keyword)
    );
  });

  const sortedBlocks = [...filteredBlocks].sort((a, b) => {
    if (query.sort === "txCount") {
      return applySortOrder(
        compareNumberish(a.transactions.length, b.transactions.length),
        query.order
      );
    }
    if (query.sort === "gasUsed") {
      return applySortOrder(
        compareNumberish(a.gasUsed ?? 0n, b.gasUsed ?? 0n),
        query.order
      );
    }
    if (query.sort === "timestamp") {
      return applySortOrder(
        compareNumberish(a.timestamp ?? 0n, b.timestamp ?? 0n),
        query.order
      );
    }
    return applySortOrder(compareNumberish(a.number ?? 0n, b.number ?? 0n), query.order);
  });

  const pagedBlocks = withPagination(sortedBlocks, query.page, query.pageSize);

  return (
    <>
      <PageHeader
        kicker="Blocks Explorer"
        title="区块列表"
        description="查看扫描窗口内的区块摘要，并跳转到区块详情。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "区块" }]}
      />

      {error ? <div className="notice">{error}</div> : null}

      <DataTableShell
        id="blocks-panel"
        kicker="Blocks Stream"
        title="最近区块"
        description="支持筛选、排序与分页，表格状态写入 URL。"
        toolbar={
          <TableToolbar
            namespace="blocksList"
            filterPlaceholder="筛选区块号或区块哈希"
            sortOptions={[
              { value: "number", label: "区块号" },
              { value: "timestamp", label: "时间" },
              { value: "txCount", label: "交易数" },
              { value: "gasUsed", label: "Gas Used" },
            ]}
          />
        }
        pagination={
          <TablePaginationBar
            namespace="blocksList"
            page={pagedBlocks.page}
            totalPages={pagedBlocks.totalPages}
            total={pagedBlocks.total}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>区块号</TableHead>
              <TableHead>区块哈希</TableHead>
              <TableHead>时间</TableHead>
              <TableHead className="text-right">交易数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedBlocks.items.map((block) => (
              <TableRow key={`${block.number?.toString() ?? "0"}-${block.hash ?? ""}`}>
                <TableCell>
                  <Link
                    href={`/block/${block.number?.toString() ?? "0"}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {formatNumber(block.number ?? 0n)}
                  </Link>
                </TableCell>
                <TableCell>
                  {block.hash ? (
                    <HashValue value={block.hash} href={`/block/${block.number?.toString() ?? "0"}`} />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{formatTimestamp(block.timestamp)}</TableCell>
                <TableCell className="text-right">{formatNumber(block.transactions.length)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableShell>
    </>
  );
}
