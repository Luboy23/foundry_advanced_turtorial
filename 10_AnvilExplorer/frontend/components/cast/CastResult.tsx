"use client";

/**
 * Cast 模块结果区：
 * - loading 时显示“查询中”；
 * - 无结果时显示空态；
 * - 有结果时显示代码块。
 */
export default function CastResult({
  loading,
  output,
}: {
  loading?: boolean;
  output?: string;
}) {
  if (loading) {
    return <div className="notice">查询中...</div>;
  }
  if (!output) {
    return <div className="empty-state">暂无结果</div>;
  }
  return <pre className="code-block">{output}</pre>;
}
