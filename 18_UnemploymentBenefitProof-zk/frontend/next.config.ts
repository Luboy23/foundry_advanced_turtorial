import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config: any, { isServer }: { isServer: boolean }) {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        snarkjs$: path.resolve(process.cwd(), "node_modules/snarkjs/build/browser.esm.js")
      };
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /web-worker\/cjs\/node\.js/,
        message: /Critical dependency: the request of a dependency is an expression/
      }
    ];

    return config;
  }
};

export default nextConfig;
