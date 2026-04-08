/**
 * 通用弹窗骨架。
 * 统一处理焦点圈定、Esc 关闭、滚动锁定和移动端/桌面端布局差异。
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { buttonSecondaryClass } from './buttonStyles'

type ModalProps = {
  title: string
  isOpen: boolean
  onClose: () => void
  closeDisabled?: boolean
  children: ReactNode
}

export const Modal = ({ title, isOpen, onClose, closeDisabled = false, children }: ModalProps) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // 打开弹窗时锁 body 滚动并记住焦点，关闭时再完整恢复。
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    if (!closeDisabled) {
      closeButtonRef.current?.focus()
    }

    // 这里只实现最小可用 focus trap，保证 Tab 不会跳出弹窗。
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeDisabled && event.key === 'Escape') {
        event.preventDefault()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const container = dialogRef.current
      if (!container) {
        return
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'))

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [closeDisabled, isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--fog-wash)] px-0 pb-0 pt-8 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6">
      {/* 移动端使用底部抽屉感，桌面端回到居中 modal。 */}
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[var(--line-soft)] border-b-0 bg-[rgba(255,255,255,0.9)] shadow-[0_20px_48px_rgba(0,0,0,0.22)] sm:max-h-[72vh] sm:rounded-2xl sm:border-b"
        ref={dialogRef}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink-900)]" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="关闭"
            title="关闭"
            className={`${buttonSecondaryClass} h-10 w-10 p-0 text-base font-bold leading-none`}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
            disabled={closeDisabled}
          >
            x
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 text-sm text-[var(--ink-900)]">{children}</div>
      </section>
    </div>
  )
}
