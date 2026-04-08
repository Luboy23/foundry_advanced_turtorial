declare const process: {
  env: Record<string, string | undefined>;
};

interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
}
