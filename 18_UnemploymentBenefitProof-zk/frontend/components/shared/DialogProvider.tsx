"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DialogController } from "@/lib/dialog-actions";

/**
 * 全局对话框系统。
 *
 * 页面不会直接渲染某个具体弹窗，而是通过 context 调用 confirm / showInfo / showError 等
 * 能力，由这里统一处理焦点锁定、ESC 关闭、Portal 挂载和异步流程中的状态更新。
 */
type DialogTone = "info" | "warning" | "success" | "error";

type DialogControllerPatch = Partial<{
  title: string;
  description: string;
  details: string;
  busy: boolean;
  dismissible: boolean;
  tone: DialogTone;
  confirmLabel: string;
  closeLabel: string;
}>;

type DialogConfirmOptions = {
  title: string;
  description: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type DialogResultOptions = {
  title: string;
  description: string;
  details?: string;
  closeLabel?: string;
  tone?: DialogTone;
};

type DialogInfoOptions = {
  title: string;
  description: string;
  details?: string;
  confirmLabel?: string;
  tone?: DialogTone;
  busy?: boolean;
  dismissible?: boolean;
};

type DialogContextValue = {
  confirm: (options: DialogConfirmOptions) => Promise<boolean>;
  showSuccess: (options: DialogResultOptions) => Promise<void>;
  showError: (options: DialogResultOptions) => Promise<void>;
  showInfo: (options: DialogInfoOptions) => DialogController;
};

type ActiveDialog = {
  id: number;
  mode: "confirm" | "result";
  tone: DialogTone;
  title: string;
  description: string;
  details?: string;
  confirmLabel: string;
  cancelLabel?: string;
  closeLabel: string;
  dismissible: boolean;
  busy: boolean;
  resolve?: (value: boolean | void) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

/** 根据弹窗语气返回对应的外观样式。 */
function getToneStyles(tone: DialogTone) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (tone === "error") {
    return "border-[#F2C7C3] bg-[#FFF2F1] text-brand-seal";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-brand-ink/15 bg-brand-ink/5 text-brand-ink";
}

/** 收集当前弹窗内所有可聚焦元素，用于实现键盘 Tab 循环。 */
function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

/** 统一按钮外观，避免 confirm / result 弹窗重复写一套按钮样式判断。 */
function DialogButton({
  children,
  onClick,
  variant = "primary",
  disabled = false
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "seal" | "danger";
  disabled?: boolean;
}) {
  const className =
    variant === "outline"
      ? "btn-outline"
      : variant === "seal"
        ? "btn-seal"
        : variant === "danger"
          ? "inline-flex items-center justify-center rounded-xl bg-brand-seal px-5 py-2.5 font-medium text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          : "btn-primary";

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

/**
 * 实际挂到 Portal 中的弹窗宿主。
 *
 * 这里集中处理：
 * 1. 打开时的焦点捕获；
 * 2. 关闭时的焦点恢复；
 * 3. ESC 和 Tab 的键盘交互。
 */
function DialogHost({
  dialog,
  onClose,
  onConfirm
}: {
  dialog: ActiveDialog | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!dialog) {
      document.body.style.removeProperty("overflow");
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    // 等 Portal 内容真正挂载后再尝试抢焦点，避免访问到尚未渲染的节点。
    const frame = window.requestAnimationFrame(() => {
      const container = dialogRef.current;
      if (!container) {
        return;
      }

      const focusableElements = getFocusableElements(container);
      if (focusableElements[0]) {
        focusableElements[0].focus();
        return;
      }

      container.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.removeProperty("overflow");
    };
  }, [dialog]);

  useEffect(() => {
    if (!dialog) {
      return;
    }

    const currentDialog = dialog;

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && currentDialog.dismissible && !currentDialog.busy) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container = dialogRef.current;
      if (!container) {
        return;
      }

      const focusableElements = getFocusableElements(container);
      if (!focusableElements.length) {
        event.preventDefault();
        container.focus();
        return;
      }

      const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // 用手动循环把焦点锁在弹窗内部，避免 Tab 跳到页面背后的可交互元素。
      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (currentIndex === -1 || document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [dialog, onClose]);

  if (typeof document === "undefined" || !dialog) {
    return null;
  }

  const toneStyles = getToneStyles(dialog.tone);
  const Icon =
    dialog.busy
      ? LoaderCircle
      : dialog.tone === "success"
        ? CheckCircle2
        : dialog.tone === "error"
          ? AlertCircle
          : dialog.tone === "warning"
            ? CircleAlert
            : Info;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-ink/45 px-4 py-6">
      <button
        type="button"
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={dialog.dismissible && !dialog.busy ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-[101] w-full max-w-lg rounded-[28px] border border-line-soft bg-surface p-6 shadow-[0_30px_80px_rgba(34,50,74,0.28)] outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", toneStyles)}>
            <Icon className={cn("h-6 w-6", dialog.busy ? "animate-spin" : "")} />
          </div>
          {dialog.dismissible && !dialog.busy ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-text-muted transition hover:bg-bg-paper hover:text-brand-ink"
              aria-label="关闭弹窗"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-5">
          <h2 id={titleId} className="text-xl font-semibold text-brand-ink">
            {dialog.title}
          </h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-text-muted">
            {dialog.description}
          </p>
        </div>

        {dialog.details ? (
          <details className="mt-5 rounded-2xl border border-line-soft bg-bg-paper px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-ink">查看详情</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-5 text-text-muted">
              {dialog.details}
            </pre>
          </details>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {dialog.mode === "confirm" ? (
            <>
              <DialogButton variant="outline" onClick={onClose} disabled={dialog.busy}>
                {dialog.cancelLabel ?? "取消"}
              </DialogButton>
              <DialogButton
                variant={dialog.tone === "error" ? "danger" : dialog.tone === "warning" ? "seal" : "primary"}
                onClick={onConfirm}
                disabled={dialog.busy}
              >
                {dialog.confirmLabel}
              </DialogButton>
            </>
          ) : (
            <DialogButton
              variant={dialog.tone === "error" ? "danger" : dialog.tone === "warning" ? "seal" : "primary"}
              onClick={onClose}
              disabled={dialog.busy}
            >
              {dialog.closeLabel}
            </DialogButton>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** 提供全局对话框能力的 Provider。 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const nextIdRef = useRef(1);
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);

  /** 只关闭当前 id 对应的弹窗，避免异步流程里新旧弹窗互相覆盖。 */
  const closeById = useCallback((id: number, value?: boolean | void) => {
    setDialog((current) => {
      if (!current || current.id !== id) {
        return current;
      }
      current.resolve?.(value);
      return null;
    });
  }, []);

  /** 允许长流程在不中断弹窗的情况下更新标题、描述和状态。 */
  const updateById = useCallback((id: number, patch: DialogControllerPatch) => {
    setDialog((current) => {
      if (!current || current.id !== id) {
        return current;
      }
      return {
        ...current,
        ...patch
      };
    });
  }, []);

  /** 打开一个可持续更新的提示弹窗，常用于加载中和只读信息提示。 */
  const showInfo = useCallback(
    (options: DialogInfoOptions): DialogController => {
      const id = nextIdRef.current++;
      setDialog({
        id,
        mode: "result",
        tone: options.tone ?? "info",
        title: options.title,
        description: options.description,
        details: options.details,
        confirmLabel: options.confirmLabel ?? "知道了",
        closeLabel: options.confirmLabel ?? "知道了",
        dismissible: options.dismissible ?? !options.busy,
        busy: options.busy ?? false
      });

      return {
        close: () => closeById(id),
        update: (patch) => updateById(id, patch)
      };
    },
    [closeById, updateById]
  );

  /** 构造 success / error 这类一次性结果弹窗。 */
  const showResult = useCallback(
    (tone: DialogTone, options: DialogResultOptions) =>
      new Promise<void>((resolve) => {
        const id = nextIdRef.current++;
        setDialog({
          id,
          mode: "result",
          tone,
          title: options.title,
          description: options.description,
          details: options.details,
          confirmLabel: options.closeLabel ?? "知道了",
          closeLabel: options.closeLabel ?? "知道了",
          dismissible: true,
          busy: false,
          resolve: () => resolve()
        });
      }),
    []
  );

  /** 打开一个需要用户显式确认或取消的弹窗。 */
  const confirm = useCallback(
    (options: DialogConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        const id = nextIdRef.current++;
        setDialog({
          id,
          mode: "confirm",
          tone: options.tone ?? "warning",
          title: options.title,
          description: options.description,
          details: options.details,
          confirmLabel: options.confirmLabel ?? "确认",
          cancelLabel: options.cancelLabel ?? "取消",
          closeLabel: options.cancelLabel ?? "取消",
          dismissible: true,
          busy: false,
          resolve: (value) => resolve(Boolean(value))
        });
      }),
    []
  );

  /** 暴露给页面层使用的 Dialog context 值。 */
  const value = useMemo<DialogContextValue>(
    () => ({
      confirm,
      showInfo,
      showSuccess: (options) => showResult("success", options),
      showError: (options) => showResult("error", options)
    }),
    [confirm, showInfo, showResult]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogHost
        dialog={dialog}
        onClose={() => {
          if (dialog) {
            closeById(dialog.id, dialog.mode === "confirm" ? false : undefined);
          }
        }}
        onConfirm={() => {
          if (dialog) {
            closeById(dialog.id, true);
          }
        }}
      />
    </DialogContext.Provider>
  );
}

/** 读取当前 Dialog context；缺少 Provider 时立即抛错。 */
export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider.");
  }
  return context;
}
