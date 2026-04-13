const DEFAULT_BACKEND_API_BASE_URL = "http://127.0.0.1:8787";

function resolveBrowserBackendApiBaseUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_BACKEND_API_BASE_URL;
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "127.0.0.1";
  return `${protocol}//${hostname}:8787`;
}

export function getBackendApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL?.trim() ||
    resolveBrowserBackendApiBaseUrl()
  );
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    let message = `后端请求失败：${response.status}`;
    try {
      const raw = await response.text();
      if (raw.trim()) {
        const payload = JSON.parse(raw) as { error?: string; message?: string | string[] };
        if (payload.error) {
          message = payload.error;
        } else if (Array.isArray(payload.message) && payload.message.length) {
          message = payload.message.join("；");
        } else if (typeof payload.message === "string" && payload.message.trim()) {
          message = payload.message;
        }
      }
    } catch {
      // 保持默认错误文案。
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null as T;
  }

  return JSON.parse(text) as T;
}
