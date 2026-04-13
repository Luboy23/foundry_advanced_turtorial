import fs from "fs";
import path from "path";
import Script from "next/script";
import type { Metadata } from "next";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "高考录取资格证明系统 | UniversityCutoffProof-zk",
  description: "高考录取资格证明系统：考试院、学生、大学围绕录取线证明协同工作。"
};

function buildRuntimeConfigScript() {
  const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
  const fallback = {
    admissionRoleRegistryAddress:
      process.env.NEXT_PUBLIC_ADMISSION_ROLE_REGISTRY_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    scoreRootRegistryAddress:
      process.env.NEXT_PUBLIC_SCORE_ROOT_REGISTRY_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    universityAdmissionVerifierAddress:
      process.env.NEXT_PUBLIC_UNIVERSITY_ADMISSION_VERIFIER_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337"),
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545",
    deploymentBlockNumber: process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK_NUMBER
      ? Number(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK_NUMBER)
      : undefined,
    deploymentBlockHash: process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK_HASH
  };

  let runtimeConfig = fallback;
  try {
    if (fs.existsSync(runtimeConfigPath)) {
      runtimeConfig = {
        ...fallback,
        ...JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8"))
      };
    }
  } catch (error) {
    console.warn("Failed to read contract-config.json:", error);
  }

  return `window.__APP_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <Script id="app-runtime-config" strategy="beforeInteractive">
          {buildRuntimeConfigScript()}
        </Script>
        <Providers>
          <AppHeader />
          <PageContainer>{children}</PageContainer>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
