"use client";

import { useCallback } from "react";
import { useDialog } from "@/components/shared/DialogProvider";
import {
  DialogActionCancelledError,
  runDialogAction,
  type DialogActionMessage,
  type DialogMessageResolver
} from "@/lib/dialog-actions";

export { DialogActionCancelledError, type DialogActionMessage, type DialogMessageResolver };

/** 把共享 Dialog context 适配成 `runDialogAction` 所需的调用形式。 */
export function useDialogAction() {
  const dialog = useDialog();

  return useCallback(
    /** 用当前页面的 DialogProvider 执行完整的确认 / 进度 / 成功 / 失败流程。 */
    async function runDialogActionWithDialog<Result>(config: {
      confirm?: DialogMessageResolver<void>;
      progress?: DialogMessageResolver<void>;
      success?: DialogMessageResolver<Result>;
      error?: DialogMessageResolver<unknown>;
      run: () => Promise<Result>;
    }) {
      return runDialogAction(dialog, config);
    },
    [dialog]
  );
}
