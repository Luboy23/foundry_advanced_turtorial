"use client";

import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import { ActionFeedbackModal } from "@/components/shared/ActionFeedbackModal";

export type ActionFeedbackTone = "success" | "error";

export type ActionFeedbackAction = {
  label: string;
  href?: string;
  onClick?: () => void | Promise<void>;
  closeOnClick?: boolean;
};

export type ActionFeedbackOptions = {
  title: string;
  description: string;
  primaryAction?: ActionFeedbackAction;
  secondaryAction?: ActionFeedbackAction;
};

export type ActionFeedbackState = ActionFeedbackOptions & {
  tone: ActionFeedbackTone;
};

export type ActionFeedbackContextValue = {
  showSuccess: (options: ActionFeedbackOptions) => void;
  showError: (options: ActionFeedbackOptions) => void;
  close: () => void;
};

export const ActionFeedbackContext = createContext<ActionFeedbackContextValue | null>(null);

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const close = useCallback(() => {
    setFeedback(null);
  }, []);

  const showSuccess = useCallback((options: ActionFeedbackOptions) => {
    setFeedback({
      tone: "success",
      ...options
    });
  }, []);

  const showError = useCallback((options: ActionFeedbackOptions) => {
    setFeedback({
      tone: "error",
      ...options
    });
  }, []);

  const value = useMemo(
    () => ({
      showSuccess,
      showError,
      close
    }),
    [close, showError, showSuccess]
  );

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <ActionFeedbackModal feedback={feedback} onClose={close} />
    </ActionFeedbackContext.Provider>
  );
}
