type DialogTone = "info" | "warning" | "success" | "error";

/** 对话框动作层使用的标准消息结构。 */
export type DialogActionMessage = {
  title: string;
  description: string;
  details?: string;
  closeLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

/** 允许消息写死，也允许根据运行结果动态生成。 */
export type DialogMessageResolver<Input> =
  | DialogActionMessage
  | false
  | ((value: Input) => DialogActionMessage | false);

/** 长流程弹窗控制器，支持在异步过程中更新标题、描述和忙碌状态。 */
export type DialogController = {
  close: () => void;
  update: (
    patch: Partial<
      Pick<
        DialogActionMessage,
        "title" | "description" | "details" | "confirmLabel" | "tone"
      > & {
        closeLabel: string;
        busy: boolean;
        dismissible: boolean;
      }
    >
  ) => void;
};

/** 页面层需要实现的最小 Dialog 能力集合。 */
export type DialogLike = {
  confirm: (options: DialogActionMessage) => Promise<boolean>;
  showInfo: (
    options: DialogActionMessage & {
      busy?: boolean;
      dismissible?: boolean;
    }
  ) => DialogController;
  showSuccess: (options: DialogActionMessage) => Promise<void>;
  showError: (options: DialogActionMessage) => Promise<void>;
};

/** 用于显式区分“用户取消操作”和“真实错误”的控制流异常。 */
export class DialogActionCancelledError extends Error {
  constructor(message = "dialog action cancelled") {
    super(message);
    this.name = "DialogActionCancelledError";
  }
}

/**
 * 统一执行“确认 -> 进度提示 -> 成功/失败反馈”的异步弹窗流程。
 *
 * 页面只需声明消息和 `run` 方法，避免每个按钮都手写重复的弹窗状态机。
 */
export async function runDialogAction<Result>(
  dialog: DialogLike,
  config: {
    confirm?: DialogMessageResolver<void>;
    progress?: DialogMessageResolver<void>;
    success?: DialogMessageResolver<Result>;
    error?: DialogMessageResolver<unknown>;
    run: () => Promise<Result>;
  }
) {
  /** 统一把静态消息和动态 resolver 收敛成最终消息对象。 */
  const resolveMessage = <Input,>(message: DialogMessageResolver<Input>, value: Input) => {
    if (typeof message === "function") {
      return message(value);
    }
    return message;
  };

  const confirmConfig = config.confirm ? resolveMessage(config.confirm, undefined) : null;
  if (confirmConfig) {
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
      await dialog.showError(errorConfig);
    }
    return undefined;
  }
}
