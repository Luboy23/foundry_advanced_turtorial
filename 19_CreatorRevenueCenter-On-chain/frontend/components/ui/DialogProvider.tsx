"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

type DialogTone = "info" | "warning" | "success" | "error";

type DialogOptions = {
  title: string;
  description: string;
  details?: string;
  closeLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  busy?: boolean;
  dismissible?: boolean;
};

type DialogState =
  | {
      id: number;
      kind: "confirm";
      options: DialogOptions;
      resolve: (value: boolean) => void;
    }
  | {
      id: number;
      kind: "notice";
      options: DialogOptions;
      resolve?: () => void;
    }
  | null;

type DialogController = {
  close: () => void;
};

type DialogContextValue = {
  confirm: (options: DialogOptions) => Promise<boolean>;
  showSuccess: (options: DialogOptions) => Promise<void>;
  showError: (options: DialogOptions) => Promise<void>;
  showInfo: (options: DialogOptions) => DialogController;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function getToneIcon(tone: DialogTone, busy?: boolean) {
  if (busy) {
    return <LoaderCircle className="h-10 w-10 animate-spin text-brand-pink" />;
  }

  if (tone === "success") {
    return <CheckCircle2 className="h-10 w-10 text-success-mint" />;
  }

  if (tone === "error") {
    return <AlertCircle className="h-10 w-10 text-rose-600" />;
  }

  if (tone === "warning") {
    return <TriangleAlert className="h-10 w-10 text-warning-peach" />;
  }

  return <Info className="h-10 w-10 text-brand-pink" />;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const idRef = useRef(0);

  const closeDialog = useCallback((id: number) => {
    setDialog((current) => (current && current.id === id ? null : current));
  }, []);

  const confirm = useCallback((options: DialogOptions) => {
    const id = ++idRef.current;
    return new Promise<boolean>((resolve) => {
      setDialog({
        id,
        kind: "confirm",
        options: {
          cancelLabel: "取消",
          confirmLabel: "确认",
          tone: "warning",
          ...options
        },
        resolve
      });
    });
  }, []);

  const showSuccess = useCallback((options: DialogOptions) => {
    const id = ++idRef.current;
    return new Promise<void>((resolve) => {
      setDialog({
        id,
        kind: "notice",
        options: {
          closeLabel: "知道了",
          tone: "success",
          ...options
        },
        resolve
      });
    });
  }, []);

  const showError = useCallback((options: DialogOptions) => {
    const id = ++idRef.current;
    return new Promise<void>((resolve) => {
      setDialog({
        id,
        kind: "notice",
        options: {
          closeLabel: "关闭",
          tone: "error",
          ...options
        },
        resolve
      });
    });
  }, []);

  const showInfo = useCallback(
    (options: DialogOptions) => {
      const id = ++idRef.current;
      setDialog({
        id,
        kind: "notice",
        options: {
          closeLabel: "关闭",
          tone: "info",
          ...options
        }
      });

      return {
        close: () => closeDialog(id)
      };
    },
    [closeDialog]
  );

  const value = useMemo<DialogContextValue>(
    () => ({
      confirm,
      showSuccess,
      showError,
      showInfo
    }),
    [confirm, showError, showInfo, showSuccess]
  );

  const tone = dialog?.options.tone ?? "info";

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="surface-card w-full max-w-lg p-6">
            <div className="flex items-start gap-4">
              <div className="mt-1">{getToneIcon(tone, dialog.options.busy)}</div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-text-ink">{dialog.options.title}</h2>
                <p className="mt-2 text-sm leading-7 text-text-muted">{dialog.options.description}</p>
                {dialog.options.details ? (
                  <pre className="mt-4 overflow-x-auto rounded-[1.25rem] bg-bg-soft-pink/50 p-4 text-xs leading-6 text-text-muted whitespace-pre-wrap">
                    {dialog.options.details}
                  </pre>
                ) : null}
              </div>
            </div>

            {dialog.kind === "confirm" ? (
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    dialog.resolve(false);
                    closeDialog(dialog.id);
                  }}
                >
                  {dialog.options.cancelLabel ?? "取消"}
                </Button>
                <Button
                  onClick={() => {
                    dialog.resolve(true);
                    closeDialog(dialog.id);
                  }}
                >
                  {dialog.options.confirmLabel ?? "确认"}
                </Button>
              </div>
            ) : !dialog.options.busy || dialog.options.dismissible ? (
              <div className="mt-6 flex justify-end">
                <Button
                  variant={tone === "success" ? "primary" : "outline"}
                  onClick={() => {
                    dialog.resolve?.();
                    closeDialog(dialog.id);
                  }}
                >
                  {dialog.options.closeLabel ?? "关闭"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return context;
}
