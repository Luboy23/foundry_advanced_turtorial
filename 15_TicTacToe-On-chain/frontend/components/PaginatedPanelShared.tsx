"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";

import InlineCopyButton from "@/components/InlineCopyButton";
import { Button } from "@/components/ui/button";
import {
  PROJECT_INFO_CARD_CLASS,
  PROJECT_LABEL_CLASS,
  PROJECT_SECTION_CLASS,
  PROJECT_TITLE_CLASS,
  PROJECT_VALUE_CLASS,
  PROJECT_VALUE_SUBTLE_CLASS,
} from "@/lib/projectTheme";

// 地址展示 helper：统一历史面板和排行榜里的短地址口径。
export const formatAddress = (address: Address) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

type PanelStatCardProps = {
  label: string;
  value: ReactNode;
  emphasis?: "strong" | "subtle";
};

// 统计卡原语：顶部摘要区都通过它共享同一套标题/强调样式。
export function PanelStatCard({
  label,
  value,
  emphasis = "subtle",
}: PanelStatCardProps) {
  return (
    <div className={`${PROJECT_INFO_CARD_CLASS} p-4`}>
      <p className={PROJECT_LABEL_CLASS}>{label}</p>
      <div
        className={
          emphasis === "strong"
            ? `text-xl ${PROJECT_VALUE_CLASS}`
            : PROJECT_VALUE_SUBTLE_CLASS
        }
      >
        {value}
      </div>
    </div>
  );
}

type AddressActionsProps = {
  address: Address;
  explorerUrl?: string;
  layout?: "inline" | "buttons";
};

// 地址操作原语：统一封装复制和区块浏览器跳转，避免各面板重复拼接按钮。
export function AddressActions({
  address,
  explorerUrl,
  layout = "inline",
}: AddressActionsProps) {
  if (layout === "buttons") {
    return (
      <div className="flex flex-wrap gap-2">
        <InlineCopyButton
          value={address}
          successText="地址已复制"
          idleLabel="复制地址"
          copiedLabel="已复制"
          variant="outline"
          className="flex-1 min-w-[120px]"
        />
        {explorerUrl ? (
          <Button asChild variant="secondary" size="sm" className="flex-1 min-w-[120px]">
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              查看链上
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-xs">
      <InlineCopyButton
        value={address}
        successText="地址已复制"
        idleLabel="复制"
        copiedLabel="已复制"
        variant="default"
        size="sm"
        className="h-7 rounded-full px-3 text-xs font-semibold shadow-none"
      />
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          查看链上
        </a>
      ) : null}
    </div>
  );
}

type PanelNotesSectionProps = {
  lines: ReactNode[];
  action?: ReactNode;
};

// 说明区原语：固定承载计分和统计口径说明，不作为任意富文本容器扩散使用。
export function PanelNotesSection({
  lines,
  action,
}: PanelNotesSectionProps) {
  return (
    <div className={`${PROJECT_SECTION_CLASS} space-y-1`}>
      <p className={PROJECT_TITLE_CLASS}>计分与统计口径</p>
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

type PanelEmptyStateProps = {
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryDisabled?: boolean;
};

// 空状态原语：统一“开始首局 / 前往大厅”这类引导动作的布局和禁用规则。
export function PanelEmptyState({
  title,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryDisabled = false,
}: PanelEmptyStateProps) {
  return (
    <div className="space-y-3 py-8 text-center text-muted-foreground">
      <p>{title}</p>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <Button
          variant="default"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="w-full sm:w-auto"
        >
          {primaryLabel}
        </Button>
        <Button
          variant="outline"
          onClick={onSecondary}
          className="w-full sm:w-auto"
        >
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}

type PanelPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalLabel: string;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

// 分页原语：集中处理总量展示和翻页按钮边界，避免每个面板各自维护页码逻辑。
export function PanelPagination({
  currentPage,
  totalPages,
  totalLabel,
  isLoading,
  onPrevious,
  onNext,
}: PanelPaginationProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">
        第 {currentPage}/{totalPages} 页，{totalLabel}
      </span>
      <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || currentPage <= 1}
          onClick={onPrevious}
          className="w-full"
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || currentPage >= totalPages}
          onClick={onNext}
          className="w-full"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
