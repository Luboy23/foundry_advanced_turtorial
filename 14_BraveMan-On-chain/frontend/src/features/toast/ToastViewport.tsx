export type ToastTone = 'info' | 'success' | 'warning' | 'error'
export type ToastState = {
  id: number
  message: string
  tone: ToastTone
  persistent: boolean
}
export type ToastInput =
  | string
  | {
      message: string
      tone?: ToastTone
      persistent?: boolean
    }

type ToastViewportProps = {
  toast: ToastState | null
  onDismiss: () => void
}

/**
 * 顶部轻提示容器。
 * 约定：toast 为空时不渲染，避免占用布局与事件层级。
 */
export const ToastViewport = ({ toast, onDismiss }: ToastViewportProps) => {
  if (!toast) return null

  const toneClass = toast.tone === 'success'
    ? 'border-emerald-200 bg-[rgba(240,255,247,0.96)] text-emerald-900'
    : toast.tone === 'warning'
      ? 'border-amber-200 bg-[rgba(255,249,237,0.98)] text-amber-900'
      : toast.tone === 'error'
        ? 'border-[rgba(181,57,34,0.18)] bg-[rgba(255,245,242,0.98)] text-[var(--accent-vermilion)]'
        : 'border-[var(--line-soft)] bg-[rgba(255,255,255,0.96)] text-[var(--ink-900)]'
  const liveMode = toast.tone === 'error' || toast.tone === 'warning' ? 'assertive' : 'polite'

  return (
    <div className="fixed inset-x-0 top-16 z-[80] flex justify-center px-4">
      <div
        aria-atomic="true"
        aria-live={liveMode}
        className={`flex min-w-[15rem] max-w-[min(32rem,calc(100vw-2rem))] items-start gap-3 rounded-[1rem] border px-4 py-2.5 text-xs font-semibold shadow-lg shadow-black/10 ${toneClass}`}
        role="status"
      >
        <p className="min-w-0 flex-1 leading-5">{toast.message}</p>
        <button
          aria-label="关闭提示"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/8 bg-white/70 text-[11px] font-bold text-current transition hover:bg-white"
          onClick={onDismiss}
          type="button"
        >
          x
        </button>
      </div>
    </div>
  )
}
