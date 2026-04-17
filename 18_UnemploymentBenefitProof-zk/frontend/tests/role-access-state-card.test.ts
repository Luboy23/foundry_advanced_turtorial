import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RoleAccessStateCard } from "@/components/shared/RoleAccessStateCard";
import { resolveRoleAccess } from "@/lib/role-access";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children)
}));

const demoAddresses = {
  government: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  applicant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  agency: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  ineligibleApplicant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
} as const;

const wallet = {
  address: demoAddresses.government,
  chainId: 31337,
  connectorName: "Injected",
  isConnected: true,
  hasWalletClient: true,
  wrongChain: false,
  isConnecting: false,
  isSwitching: false,
  connectError: null,
  connectWallet: vi.fn(),
  switchToExpectedChain: vi.fn(),
  disconnectWallet: vi.fn()
};

describe("RoleAccessStateCard", () => {
  it("renders an explicit error state when role access cannot be queried", () => {
    const access = resolveRoleAccess({
      role: "government",
      walletConnected: true,
      wrongChain: false,
      roleStatusLoading: false,
      roleStatusError: true,
      demoAddresses
    });

    const markup = renderToStaticMarkup(
      createElement(RoleAccessStateCard, {
        access,
        wallet,
        onConnect: vi.fn(),
        onSwitch: vi.fn()
      })
    );

    expect(markup).toContain("账户权限读取失败");
    expect(markup).toContain("当前无法确认账户可使用的服务");
    expect(markup).not.toContain("正在确认权限");
  });
});
