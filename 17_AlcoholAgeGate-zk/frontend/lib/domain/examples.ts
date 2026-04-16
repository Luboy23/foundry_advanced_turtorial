import type { SampleCredentialSetRecord, SampleProductRecord } from "@/types/domain";
import sampleCredentialSet from "@/public/examples/sample-credential-set.json";
import sampleProducts from "@/public/examples/sample-products.json";

async function fetchExampleText(target: string): Promise<string> {
  const response = await fetch(target, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`无法读取示例文件：${target}`);
  }
  return response.text();
}

export function loadSampleProducts() {
  return Promise.resolve(sampleProducts as SampleProductRecord[]);
}

export function loadSampleCredentialSet() {
  return Promise.resolve(sampleCredentialSet as SampleCredentialSetRecord);
}

export function loadSampleIssuerUserListCsv() {
  return fetchExampleText("/examples/issuer-user-list-demo.csv");
}
