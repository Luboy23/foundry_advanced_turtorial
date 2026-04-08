import { render, screen, waitFor } from "@testing-library/react";
import Providers from "@/app/providers";

const mockInitializeAppConfig = jest.fn();
const mockGetAppConfig = jest.fn();

jest.mock("@/components/web3/config", () => ({
  initializeAppConfig: () => mockInitializeAppConfig(),
  getAppConfig: () => mockGetAppConfig(),
}));

jest.mock("wagmi", () => ({
  WagmiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@tanstack/react-query", () => ({
  QueryClient: class QueryClient {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@rainbow-me/rainbowkit", () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

describe("Providers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppConfig.mockReturnValue({});
  });

  it("waits for runtime config initialization before rendering children", async () => {
    let resolveConfig: ((value: unknown) => void) | undefined;
    const configPromise = new Promise((resolve) => {
      resolveConfig = resolve;
    });
    mockInitializeAppConfig.mockReturnValue(configPromise);

    render(
      <Providers>
        <div>child-ready</div>
      </Providers>
    );

    expect(screen.getByText("正在加载链上配置...")).toBeInTheDocument();
    expect(screen.queryByText("child-ready")).not.toBeInTheDocument();

    resolveConfig?.({});

    await waitFor(() => {
      expect(screen.getByText("child-ready")).toBeInTheDocument();
    });
  });
});
