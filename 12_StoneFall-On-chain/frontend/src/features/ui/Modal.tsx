/**
 * 模块职责：提供全局可复用的弹窗容器，统一处理遮罩、焦点管理与键盘交互。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
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

/**
 * 通用弹窗组件。
 * @param title 弹窗标题
 * @param isOpen 是否显示
 * @param onClose 关闭回调
 * @param closeDisabled 是否禁用关闭（例如链上提交锁定态）
 * @param children 弹窗内容区域
 */
export const Modal = ({ title, isOpen, onClose, closeDisabled = false, children }: ModalProps) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // 记录进入弹窗前的焦点与滚动状态，关闭时恢复。
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow

    // 打开弹窗时锁定页面滚动，避免背景内容滚动穿透。
    document.body.style.overflow = 'hidden'
    if (!closeDisabled) {
      closeButtonRef.current?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // 关闭禁用态下拦截 Escape，避免“流程未完成”被提前关闭。
      if (closeDisabled && event.key === 'Escape') {
        event.preventDefault()
        return
      }

      // 普通态 Escape 关闭弹窗。
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

      // 计算可聚焦元素集合，用于实现焦点环（Focus Trap）。
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

      // Shift+Tab 从第一个元素回绕到最后一个元素。
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      // Tab 从最后一个元素回绕到第一个元素。
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // 关闭弹窗时恢复页面原始状态与焦点位置。
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [closeDisabled, isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--fog-wash)] px-4 py-6 backdrop-blur-[2px]">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[72vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.9)] shadow-[0_20px_48px_rgba(0,0,0,0.22)]"
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
