import type { SummaryTone } from "@/types/types";

export const PROJECT_INFO_CARD_CLASS =
  "rounded-xl border border-primary/15 bg-white shadow-sm";

export const PROJECT_INFO_CARD_SOFT_CLASS =
  "rounded-xl border border-primary/12 bg-primary/[0.04] shadow-sm";

export const PROJECT_PANEL_CLASS =
  "rounded-2xl border border-primary/15 bg-white shadow-sm";

export const PROJECT_SECTION_CLASS =
  "rounded-md border border-primary/15 bg-primary/[0.04] p-3 text-sm text-primary/80";

export const PROJECT_LABEL_CLASS =
  "text-xs uppercase tracking-[0.18em] text-primary/60";

export const PROJECT_VALUE_CLASS = "mt-2 font-semibold text-primary";

export const PROJECT_VALUE_SUBTLE_CLASS = "mt-2 font-medium text-primary/85";

export const PROJECT_TITLE_CLASS = "font-semibold text-primary";

export const PROJECT_BODY_CLASS = "text-primary/80";

export const getProjectTonePanelClass = (tone: SummaryTone) => {
  if (tone === "danger") {
    return "border-primary/[0.30] bg-primary/[0.10] text-primary";
  }
  if (tone === "warning") {
    return "border-primary/[0.24] bg-primary/[0.08] text-primary";
  }
  if (tone === "success") {
    return "border-primary/[0.20] bg-primary/[0.06] text-primary";
  }
  return "border-primary/15 bg-white text-primary";
};

export const getProjectToneCardClass = (tone?: SummaryTone) => {
  if (tone === "danger") {
    return "border-primary/[0.28] bg-primary/[0.09]";
  }
  if (tone === "warning") {
    return "border-primary/[0.22] bg-primary/[0.07]";
  }
  if (tone === "success") {
    return "border-primary/[0.18] bg-primary/[0.05]";
  }
  return "border-primary/15 bg-white";
};

export const getProjectScoreClass = (value: number | bigint) =>
  value === 0 || value === BigInt(0) ? "text-primary/70" : "text-primary";
