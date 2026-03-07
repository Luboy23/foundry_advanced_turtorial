"use client";

import { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  hideHeader?: boolean;
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  hideHeader = false,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-[296px] md:w-[480px] rounded-lg bg-white p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold uppercase tracking-wide text-[var(--button-background)]"
            >
              关闭
            </button>
          </div>
        )}
        <div className={hideHeader ? "" : "mt-4"}>{children}</div>
      </div>
    </div>
  );
}
