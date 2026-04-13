import { describe, expect, it } from "vitest";
import { parseCredentialJson } from "@/lib/credential/parser";
import sampleCredential from "../../zk/data/generated/sample-admission/sample-credential.json";

describe("parseCredentialJson", () => {
  // 保护目标：系统内置样例凭证必须能被当前解析器完整接受。
  it("accepts the generated sample credential", () => {
    const result = parseCredentialJson(JSON.stringify(sampleCredential));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.credential.scoreSourceId).toBe("GAOKAO_2026");
    expect(result.credential.pathElements).toHaveLength(20);
  });

  // 保护目标：路径长度异常的凭证必须被阻断，不能继续进入学生申请链路。
  it("rejects malformed path lengths", () => {
    const malformed = {
      ...sampleCredential,
      pathElements: sampleCredential.pathElements.slice(0, 3)
    };

    const result = parseCredentialJson(JSON.stringify(malformed));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("成绩凭证中的校验路径不完整。");
  });
});
