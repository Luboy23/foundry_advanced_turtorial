import fs from "fs";
import path from "path";
import { getEnvRuntimeConfig, normalizeRuntimeConfig } from "@/lib/runtime-config";

/**
 * 服务端运行时配置读取器。
 *
 * 服务端优先以环境变量为基线，再尝试叠加 `public/contract-config.json`，这样既兼容部署脚本
 * 自动同步，也兼容手工设置环境变量的开发场景。
 */
export function readRuntimeConfigForScript() {
  const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
  let runtimeConfig = getEnvRuntimeConfig();

  try {
    if (fs.existsSync(runtimeConfigPath)) {
      runtimeConfig = normalizeRuntimeConfig({
        ...runtimeConfig,
        ...JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8"))
      });
    }
  } catch (error) {
    console.warn("Failed to read frontend runtime config:", error);
  }

  return runtimeConfig;
}
