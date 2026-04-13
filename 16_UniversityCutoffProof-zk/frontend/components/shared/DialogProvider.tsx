"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/utils";

// 全局弹窗基础设施。
// 这一层只负责“确认 / 成功 / 失败 / 信息提示”四类交互，不负责页面级空状态或权限说明。
type DialogTone = "info" | "warning" | "success" | "error";

type DialogController = {
  close: () => void;
  update: (
    patch: Partial<
      Pick<
        ActiveDialog,
        "title" | "description" | "details" | "busy" | "dismissible" | "tone" | "confirmLabel"
      >
    >
  ) => void;
};

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

function getToneClassName(tone: DialogTone) {
  if (tone === "success") {
    return "border-emerald-100 bg-emerald-50 text-emerald-900";
  }
  if (tone === "error") {
    return "border-rose-100 bg-rose-50 text-rose-900";
  }
  if (tone === "warning") {
    return "border-amber-100 bg-amber-50 text-amber-900";
  }
  return "border-blue-100 bg-blue-50 text-blue-900";
}

// 单实例弹窗宿主。
// 整个项目同一时刻只显示一个弹窗，避免多个操作反馈叠在一起打断主流程。
function DialogHost({
  dialog,
  onClose,
  onConfirm
}: {
  dialog: ActiveDialog | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (!dialog) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [dialog]);

  useEffect(() => {
    if (!dialog || !dialog.dismissible || dialog.busy) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [dialog, onClose]);

  if (typeof document === "undefined" || !dialog) {
    return null;
  }

  const toneClassName = getToneClassName(dialog.tone);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <button
        type="button"
        aria-label="关闭弹窗遮罩"
        className="absolute inset-0 cursor-default"
        onClick={dialog.dismissible && !dialog.busy ? onClose : undefined}
      />
      <div className="relative z-[101] w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", toneClassName)}>
            <Icon className={cn("h-6 w-6", dialog.busy ? "animate-spin" : "")} />
          </div>
          {dialog.dismissible && !dialog.busy ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="关闭弹窗"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-5">
          <h2 className="text-xl font-semibold text-slate-900">{dialog.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{dialog.description}</p>
        </div>

        {dialog.details ? (
          <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">查看详情</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-5 text-slate-500">
              {dialog.details}
            </pre>
          </details>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {dialog.mode === "confirm" ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={dialog.busy}>
                {dialog.cancelLabel ?? "取消"}
              </Button>
              <Button
                variant={dialog.tone === "error" ? "danger" : "primary"}
                onClick={onConfirm}
                disabled={dialog.busy}
              >
                {dialog.confirmLabel}
              </Button>
            </>
          ) : (
            <Button
              variant={dialog.tone === "error" ? "danger" : "primary"}
              onClick={onClose}
              disabled={dialog.busy}
            >
              {dialog.closeLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Provider 负责把弹窗能力挂到全局上下文。
// 页面层只需要声明“什么时候确认、什么时候成功、什么时候失败”，不用自己维护弹窗状态机。
export function DialogProvider({ children }: { children: ReactNode }) {
  const nextIdRef = useRef(1);
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);

  const closeById = useCallback((id: number, value?: boolean | void) => {
    setDialog((current) => {
      if (!current || current.id !== id) {
        return current;
      }
      current.resolve?.(value);
      return null;
    });
  }, []);

  const updateById = useCallback((id: number, patch: Partial<ActiveDialog>) => {
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

  const showInfo = useCallback(
    (options: DialogInfoOptions): DialogController => {
      const id = nextIdRef.current++;
      // 信息弹窗主要用于“正在处理”的阻塞态提示，因此默认按 result 模式渲染一个单按钮弹窗。
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

  const showResult = useCallback(
    (tone: DialogTone, options: DialogResultOptions) =>
      new Promise<void>((resolve) => {
        const id = nextIdRef.current++;
        // 成功与失败弹窗都复用同一套结果对话框，只通过 tone 和文案区分语义。
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

  const confirm = useCallback(
    (options: DialogConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        const id = nextIdRef.current++;
        // 关键动作统一先落到确认弹窗，避免每个页面自己拼接确认状态和按钮文案。
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

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider.");
  }
  return context;
}
