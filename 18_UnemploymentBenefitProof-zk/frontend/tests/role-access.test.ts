import { describe, expect, it } from "vitest";
import { getRecommendedDemoAddressLabel, resolveRoleAccess } from "@/lib/role-access";

const demoAddresses = {
  government: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  applicant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  agency: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  ineligibleApplicant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
} as const;

describe("resolveRoleAccess", () => {
  it("keeps all roles blocked before a wallet is connected", () => {
    const governmentAccess = resolveRoleAccess({
      role: "government",
      walletConnected: false,
      wrongChain: false,
      roleStatusLoading: false,
      demoAddresses
    });

    expect(governmentAccess.allowed).toBe(false);
    expect(governmentAccess.reason).toBe("wallet-disconnected");
    expect(governmentAccess.reasonTitle).toBe("请先连接账户");
  });

  it("returns a checking state while role status is still loading", () => {
    const applicantAccess = resolveRoleAccess({
      role: "applicant",
      walletConnected: true,
      wrongChain: false,
      roleStatusLoading: true,
      demoAddresses
    });

    expect(applicantAccess.allowed).toBe(false);
    expect(applicantAccess.reason).toBe("checking-role");
  });

  it("returns an explicit failure state when role status loading fails", () => {
    const governmentAccess = resolveRoleAccess({
      role: "government",
      walletConnected: true,
      wrongChain: false,
      roleStatusLoading: false,
      roleStatusError: true,
      demoAddresses
    });

    expect(governmentAccess.allowed).toBe(false);
    expect(governmentAccess.reason).toBe("role-query-failed");
    expect(governmentAccess.reasonTitle).toBe("账户权限读取失败");
    expect(governmentAccess.reasonBody).toContain("当前无法确认账户可使用的服务");
  });

  it("allows only the matching role and includes the short recommended account for blocked roles", () => {
    const governmentAccess = resolveRoleAccess({
      role: "government",
      walletConnected: true,
      wrongChain: false,
      roleStatusLoading: false,
      roleStatus: {
        isGovernment: true,
        isApplicant: false,
        isAgency: false
      },
      demoAddresses
    });
    const agencyAccess = resolveRoleAccess({
      role: "agency",
      walletConnected: true,
      wrongChain: false,
      roleStatusLoading: false,
      roleStatus: {
        isGovernment: true,
        isApplicant: false,
        isAgency: false
      },
      demoAddresses
    });

    expect(governmentAccess.allowed).toBe(true);
    expect(agencyAccess.allowed).toBe(false);
    expect(agencyAccess.reason).toBe("missing-role");
    expect(agencyAccess.reasonBody).toContain("0x3C44...93BC");
    expect(getRecommendedDemoAddressLabel("government", demoAddresses)).toBe("审核管理账户 0xf39F...2266");
  });
});
