import { describe, expect, it, vi } from "vitest";
import { runDialogAction } from "@/lib/dialog-actions";

describe("runDialogAction", () => {
  it("stops immediately when the user cancels the confirmation dialog", async () => {
    const run = vi.fn(async () => "done");
    const dialog = {
      confirm: vi.fn(async () => false),
      showInfo: vi.fn(() => ({
        close: vi.fn(),
        update: vi.fn()
      })),
      showSuccess: vi.fn(async () => undefined),
      showError: vi.fn(async () => undefined)
    };

    const result = await runDialogAction(dialog, {
      confirm: {
        title: "确认继续",
        description: "确认后才会继续。"
      },
      run
    });

    expect(result).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(dialog.showInfo).not.toHaveBeenCalled();
    expect(dialog.showSuccess).not.toHaveBeenCalled();
    expect(dialog.showError).not.toHaveBeenCalled();
  });

  it("shows progress and success feedback for a successful action", async () => {
    const close = vi.fn();
    const update = vi.fn();
    const dialog = {
      confirm: vi.fn(async () => true),
      showInfo: vi.fn(() => ({
        close,
        update
      })),
      showSuccess: vi.fn(async () => undefined),
      showError: vi.fn(async () => undefined)
    };

    const result = await runDialogAction(dialog, {
      confirm: {
        title: "确认发布",
        description: "确认后会发布当前版本。"
      },
      progress: {
        title: "正在发布",
        description: "系统正在提交交易。"
      },
      success: (hash) => ({
        title: "发布成功",
        description: "资格集合已更新。",
        details: hash
      }),
      run: async () => "0xabc"
    });

    expect(result).toBe("0xabc");
    expect(dialog.showInfo).toHaveBeenCalledWith({
      title: "正在发布",
      description: "系统正在提交交易。",
      busy: true,
      dismissible: false
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog.showSuccess).toHaveBeenCalledWith({
      title: "发布成功",
      description: "资格集合已更新。",
      details: "0xabc"
    });
    expect(dialog.showError).not.toHaveBeenCalled();
  });

  it("closes the progress dialog and shows an error when the action fails", async () => {
    const close = vi.fn();
    const dialog = {
      confirm: vi.fn(async () => true),
      showInfo: vi.fn(() => ({
        close,
        update: vi.fn()
      })),
      showSuccess: vi.fn(async () => undefined),
      showError: vi.fn(async () => undefined)
    };

    const result = await runDialogAction(dialog, {
      progress: {
        title: "正在处理",
        description: "请稍候。"
      },
      error: () => ({
        title: "处理失败",
        description: "当前没有完成本次操作。",
        details: "boom"
      }),
      run: async () => {
        throw new Error("boom");
      }
    });

    expect(result).toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog.showError).toHaveBeenCalledWith({
      title: "处理失败",
      description: "当前没有完成本次操作。",
      details: "boom"
    });
    expect(dialog.showSuccess).not.toHaveBeenCalled();
  });
});
