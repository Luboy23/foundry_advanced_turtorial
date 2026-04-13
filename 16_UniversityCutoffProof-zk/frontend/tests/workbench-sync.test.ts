import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForUniversityWorkbench } from "@/lib/workbench-sync";
import { getUniversityWorkbench } from "@/lib/api/university";

vi.mock("@/lib/api/university", () => ({
  getUniversityWorkbench: vi.fn()
}));

describe("waitForUniversityWorkbench", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps polling until the workbench reaches the target state", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    vi.mocked(getUniversityWorkbench)
      .mockResolvedValueOnce({
        currentSourceRule: {
          schoolId: "0x1",
          active: false,
          cutoffFrozen: false
        }
      } as never)
      .mockResolvedValueOnce({
        currentSourceRule: {
          schoolId: "0x1",
          active: true,
          cutoffFrozen: true
        }
      } as never);

    const result = await waitForUniversityWorkbench({
      queryClient,
      familyKey: "pku",
      intervalMs: 0,
      timeoutMs: 50,
      timeoutMessage: "timeout",
      predicate: (data) =>
        Boolean(data.currentSourceRule?.active && data.currentSourceRule?.cutoffFrozen)
    });

    expect(getUniversityWorkbench).toHaveBeenCalledTimes(2);
    expect(result.currentSourceRule?.active).toBe(true);
  });

  it("throws when the workbench does not reach the target state in time", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    vi.mocked(getUniversityWorkbench).mockResolvedValue({
      currentSourceRule: {
        schoolId: "0x1",
        active: false,
        cutoffFrozen: false
      }
    } as never);

    await expect(
      waitForUniversityWorkbench({
        queryClient,
        familyKey: "pku",
        intervalMs: 0,
        timeoutMs: 10,
        timeoutMessage: "timeout",
        predicate: (data) =>
          Boolean(data.currentSourceRule?.active && data.currentSourceRule?.cutoffFrozen)
      })
    ).rejects.toThrow("timeout");
  });
});
