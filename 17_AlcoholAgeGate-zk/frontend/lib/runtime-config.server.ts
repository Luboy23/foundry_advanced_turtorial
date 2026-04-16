import fs from "fs";
import path from "path";
import { getEnvRuntimeConfig, normalizeRuntimeConfig } from "@/lib/runtime-config";

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
