"use client";

import Link from "next/link";
import { BadgeCheck, CircleAlert, X } from "lucide-react";
import { useEffect, useId } from "react";
import { cn } from "@/lib/utils";
import type { ActionFeedbackAction, ActionFeedbackState, ActionFeedbackTone } from "@/components/shared/ActionFeedbackProvider";

type ActionFeedbackModalProps = {
  feedback: ActionFeedbackState | null;
  onClose: () => void;
};

type ActionButtonProps = {
  action: ActionFeedbackAction;
  onClose: () => void;
  tone: ActionFeedbackTone;
  variant: "primary" | "secondary";
};

function getActionButtonClassName(tone: ActionFeedbackTone, variant: "primary" | "secondary") {
  return cn(
    "inline-flex min-w-[8rem] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition",
    variant === "primary" && tone === "success" && "bg-brand-green text-paper-white hover:bg-brand-green/90",
    variant === "primary" && tone === "error" && "bg-rose-600 text-white hover:bg-rose-500",
    variant === "secondary" && "border border-brand-green/10 bg-white text-brand-green hover:bg-brand-green/5"
  );
}

function ActionButton({ action, onClose, tone, variant }: ActionButtonProps) {
  const className = getActionButtonClassName(tone, variant);

  if (action.href) {
    return (
      <Link
        href={action.href}
        onClick={() => {
          if (action.onClick) {
            void action.onClick();
          }
          if (action.closeOnClick !== false) {
            onClose();
          }
        }}
        className={className}
      >
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          if (action.onClick) {
            await action.onClick();
          }

          if (action.closeOnClick !== false) {
            onClose();
          }
        })();
      }}
      className={className}
    >
      {action.label}
    </button>
  );
}

export function ActionFeedbackModal({ feedback, onClose }: ActionFeedbackModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [feedback, onClose]);

  if (!feedback) {
    return null;
  }

  const primaryAction = feedback.primaryAction ?? {
    label: feedback.tone === "success" ? "知道了" : "关闭"
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.36),_rgba(252,247,235,0.18)_48%,_rgba(245,238,220,0.24)_100%)] backdrop-blur-[8px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-[2rem] border shadow-2xl",
          feedback.tone === "success" &&
            "border-brand-green/12 bg-[linear-gradient(180deg,_rgba(255,253,248,0.98)_0%,_rgba(245,238,220,0.96)_100%)]",
          feedback.tone === "error" &&
            "border-rose-200 bg-[linear-gradient(180deg,_rgba(255,251,251,0.98)_0%,_rgba(255,241,242,0.98)_100%)]"
        )}
      >
        <button
          type="button"
          aria-label="关闭弹窗"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/88 text-text-muted transition hover:text-brand-green"
          autoFocus
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-6 p-6 sm:p-7">
          <div className="space-y-4">
            <div
              className={cn(
                "inline-flex h-14 w-14 items-center justify-center rounded-2xl",
                feedback.tone === "success" && "bg-brand-green text-paper-white",
                feedback.tone === "error" && "bg-rose-100 text-rose-600"
              )}
            >
              {feedback.tone === "success" ? <BadgeCheck className="h-7 w-7" /> : <CircleAlert className="h-7 w-7" />}
            </div>

            <div className="space-y-2">
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.25em]",
                  feedback.tone === "success" ? "text-brand-amber" : "text-rose-500"
                )}
              >
                {feedback.tone === "success" ? "操作成功" : "操作失败"}
              </p>
              <h2 id={titleId} className="text-2xl font-semibold tracking-tight text-brand-green">
                {feedback.title}
              </h2>
              <p id={descriptionId} className="text-sm leading-7 text-text-muted">
                {feedback.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {feedback.secondaryAction ? (
              <ActionButton
                action={feedback.secondaryAction}
                onClose={onClose}
                tone={feedback.tone}
                variant="secondary"
              />
            ) : null}
            <ActionButton action={primaryAction} onClose={onClose} tone={feedback.tone} variant="primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
