import { describe, expect, it } from "vitest";
import { parseTableQuery, withPagination } from "./table-query";

describe("parseTableQuery", () => {
  it("uses defaults and trims filter", () => {
    // 前置条件：仅提供 filter，其余参数走默认值。
    const parsed = parseTableQuery(
      {
        booksFilter: "  Alice  ",
      },
      {
        namespace: "books",
        defaultSort: "number",
        defaultOrder: "desc",
        defaultPageSize: 20,
      }
    );

    // 断言目标：分页/排序默认值正确，filter 会被 trim。
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.sort).toBe("number");
    expect(parsed.order).toBe("desc");
    expect(parsed.filter).toBe("Alice");
  });

  it("normalizes invalid page and disallowed pageSize", () => {
    // 前置条件：page 为非法负值，pageSize 不在白名单。
    const parsed = parseTableQuery(
      {
        txPage: "-2",
        txPageSize: "999",
        txOrder: "asc",
      },
      {
        namespace: "tx",
        defaultSort: "block",
        defaultOrder: "desc",
        defaultPageSize: 10,
      }
    );

    // 断言目标：非法值被规范化为安全默认值。
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(10);
    expect(parsed.order).toBe("asc");
  });
});

describe("withPagination", () => {
  it("clips page into legal range", () => {
    // 前置条件：请求页码超出总页数。
    const data = Array.from({ length: 26 }, (_, i) => i + 1);
    const result = withPagination(data, 99, 10);
    // 断言目标：应自动裁剪到最后一页并返回该页数据。
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.items).toEqual([21, 22, 23, 24, 25, 26]);
  });
});
