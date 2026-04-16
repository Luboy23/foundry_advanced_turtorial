"use client";

import { useContext } from "react";
import { ActionFeedbackContext } from "@/components/shared/ActionFeedbackProvider";

export function useActionFeedback() {
  const context = useContext(ActionFeedbackContext);

  if (!context) {
    throw new Error("useActionFeedback 必须在 ActionFeedbackProvider 内使用。");
  }

  return context;
}
