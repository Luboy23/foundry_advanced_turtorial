"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InlineCopyButtonProps = {
  value: string;
  successText: string;
  idleLabel?: string;
  copiedLabel?: string;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
};

export default function InlineCopyButton({
  value,
  successText,
  idleLabel = "复制",
  copiedLabel = "已复制",
  className,
  variant = "link",
  size = "sm",
  disabled = false,
}: InlineCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        variant === "link" && "h-auto px-0 py-0 text-xs",
        className
      )}
      disabled={disabled}
      onClick={async () => {
        const success = await copyToClipboard(value);
        if (success) {
          setCopied(true);
          toast.success(successText);
          return;
        }
        toast.error("复制失败，请手动复制。");
      }}
      type="button"
    >
      {copied ? copiedLabel : idleLabel}
    </Button>
  );
}
