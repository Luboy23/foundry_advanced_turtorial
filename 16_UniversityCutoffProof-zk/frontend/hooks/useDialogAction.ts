"use client";

import { useCallback } from "react";
import { useDialog } from "@/components/shared/DialogProvider";

// 把“确认 -> 执行异步动作 -> 成功/失败反馈”收成统一模板。
// 这样页面层只描述业务文案和执行函数，不需要重复维护弹窗串联逻辑。
type DialogActionMessage = {
  title: string;
  description: string;
  details?: string;
  closeLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "info" | "warning" | "success" | "error";
};

type DialogMessageResolver<Input> =
  | DialogActionMessage
  | false
  | ((value: Input) => DialogActionMessage | false);

export class DialogActionCancelledError extends Error {
  constructor(message = "dialog action cancelled") {
    super(message);
    this.name = "DialogActionCancelledError";
  }
}

export function useDialogAction() {
  const dialog = useDialog();

  return useCallback(
    async function runDialogAction<Result>(config: {
      confirm?: DialogMessageResolver<void>;
      progress?: DialogMessageResolver<void>;
      success?: DialogMessageResolver<Result>;
      error?: DialogMessageResolver<unknown>;
      run: () => Promise<Result>;
    }) {
      const resolveMessage = <Input,>(message: DialogMessageResolver<Input>, value: Input) => {
        if (typeof message === "function") {
          return message(value);
        }
        return message;
      };

      const confirmConfig = config.confirm ? resolveMessage(config.confirm, undefined) : null;
      if (confirmConfig) {
        // 关键动作先经过确认，避免链上交易、后台写入这类不可逆操作被误触发。
        const confirmed = await dialog.confirm(confirmConfig);
        if (!confirmed) {
          return undefined;
        }
      }

      const progressConfig = config.progress ? resolveMessage(config.progress, undefined) : null;
      const progressController = progressConfig
        ? dialog.showInfo({
            ...progressConfig,
            busy: true,
            dismissible: false
          })
        : null;

      try {
        const result = await config.run();
        progressController?.close();

        const successConfig = config.success ? resolveMessage(config.success, result) : null;
        if (successConfig) {
          await dialog.showSuccess(successConfig);
        }

        return result;
      } catch (error) {
        progressController?.close();
        if (error instanceof DialogActionCancelledError) {
          return undefined;
        }

        const errorConfig = config.error ? resolveMessage(config.error, error) : null;
        if (errorConfig) {
          // 技术细节统一走 details 折叠区，页面主文案优先向用户说明业务影响。
          await dialog.showError(errorConfig);
        }
        return undefined;
      }
    },
    [dialog]
  );
}
