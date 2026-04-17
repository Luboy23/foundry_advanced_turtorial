import type { RuntimeConfig } from "@/types/contract-config";

/** 记录已经触发过的资源预加载任务，避免同一路由多次悬停重复拉取大文件。 */
const preloadPromises = new Map<string, Promise<void>>();

/** 预加载单个 zk 资源文件。 */
function preloadAsset(url: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const existing = preloadPromises.get(url);
  if (existing) {
    return existing;
  }

  const task = fetch(url, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`当前未能预加载核验资源：${url}`);
      }

      await response.arrayBuffer();
    })
    .catch((error) => {
      // 失败请求不应该永久占住缓存键，否则后续恢复网络后也无法再次预热资源。
      preloadPromises.delete(url);
      throw error;
    });

  preloadPromises.set(url, task);
  return task;
}

/** 并行预加载 wasm 与 zkey，供申请页进入核验页前提前热身。 */
export function preloadZkArtifacts(config: RuntimeConfig) {
  return Promise.all([
    preloadAsset(config.zkArtifactPaths.wasm),
    preloadAsset(config.zkArtifactPaths.zkey)
  ]).then(() => undefined);
}
