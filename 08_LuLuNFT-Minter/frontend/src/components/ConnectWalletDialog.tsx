"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";

export const ConnectWalletDialog = ({
  open,
  onClose,
  title = "连接钱包",
  description = "连接后可进行链上操作"
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}) => {
  const { isConnected } = useAccount();
  const { connectAsync, connectors, isPending, error, reset } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const mounted = typeof document !== "undefined";

  useEffect(() => {
    if (open && isConnected) {
      onClose();
    }
  }, [open, isConnected, onClose]);

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  if (!open || !mounted) return null;

  const isAlreadyConnectedError = (error: unknown) =>
    error instanceof Error &&
    (error.name === "ConnectorAlreadyConnectedError" ||
      error.message.includes("already connected"));

  const handleConnect = async () => {
    reset();
    const connector = connectors[0];
    if (!connector) return;
    try {
      await connectAsync({ connector });
    } catch (error) {
      if (isAlreadyConnectedError(error)) {
        try {
          await disconnectAsync({ connector });
        } catch {
          // ignore disconnect errors and retry connection
        }
        reset();
        await connectAsync({ connector });
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="u-stack-2">
          <p className="u-text-meta font-semibold uppercase tracking-[0.28em] text-slate-400">
            尚未连接
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            {title}
          </h3>
          <p className="u-text-body text-slate-500">{description}</p>
        </div>
        {error ? (
          <p className="u-text-meta mt-3 font-semibold text-rose-600">
            {error.message}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap u-gap-2">
          <Button
            type="button"
            onClick={() => void handleConnect()}
            disabled={isPending || connectors.length === 0}
          >
            {isPending ? "连接中" : "连接"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            稍后再说
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
