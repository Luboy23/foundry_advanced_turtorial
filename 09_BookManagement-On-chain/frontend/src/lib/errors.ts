// 将任意错误对象转换为可展示的中文提示
export const formatErrorMessage = (error: unknown) => {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const anyError = error as { shortMessage?: string; message?: string; details?: string };
  return anyError.shortMessage || anyError.message || anyError.details || "未知错误";
};
