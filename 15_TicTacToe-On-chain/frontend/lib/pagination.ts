// 全局默认分页大小，历史与排行榜统一使用该值。
export const PAGE_SIZE = 20;

// 计算总页数，至少返回 1，便于 UI 稳定渲染分页控件。
export const getTotalPages = (total: number, pageSize = PAGE_SIZE) =>
  Math.max(1, Math.ceil(total / pageSize));

// 将任意页码收敛到合法范围，避免越界请求。
export const clampPage = (page: number, total: number, pageSize = PAGE_SIZE) => {
  const normalizedPage = Number.isFinite(page) ? Math.trunc(page) : 1;
  return Math.min(getTotalPages(total, pageSize), Math.max(1, normalizedPage));
};

// 从完整列表切片出指定页的数据。
export const slicePage = <T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

// 生成链上分页查询的 offset 列表（0, pageSize, 2*pageSize ...）。
export const pageOffsets = (total: number, pageSize = PAGE_SIZE): number[] => {
  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += pageSize) {
    offsets.push(offset);
  }
  return offsets;
};
