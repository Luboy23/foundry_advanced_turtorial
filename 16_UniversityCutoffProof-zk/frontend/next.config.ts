import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        snarkjs$: path.resolve(process.cwd(), "node_modules/snarkjs/build/browser.esm.js"),
        ffjavascript$: path.resolve(process.cwd(), "node_modules/ffjavascript/build/browser.esm.js"),
        "web-worker$": path.resolve(process.cwd(), "node_modules/web-worker/cjs/browser.js")
      };

      config.module.rules.push({
        test: /node_modules[\\/]web-worker[\\/]cjs[\\/]node\.js$/,
        parser: {
          exprContextCritical: false
        }
      });
    }
    return config;
  }
};

export default nextConfig;
