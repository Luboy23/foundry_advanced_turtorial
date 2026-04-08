// 统一复制入口：优先现代 Clipboard API，失败后回退旧方案。
export const copyToClipboard = async (value: string): Promise<boolean> => {
  if (!value) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // 现代接口不可用或被拒绝时，继续尝试旧版 document.execCommand 方案。
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    // 兼容旧浏览器：通过隐藏 textarea + execCommand 完成复制。
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};
