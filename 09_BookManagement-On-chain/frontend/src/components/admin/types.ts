// 批量上架的本地书籍草稿
export type DemoBook = {
  // 基础展示信息
  title: string;
  author: string;
  // 扩展信息（可选）
  isbn?: string;
  category?: string;
  // 业务必填：用于生成 contentHash
  summary: string;
  // 业务可选：用于生成 policyHash
  policy?: string;
  // 表单层用 string，提交前再转 number 做校验
  totalCopies: string;
};
