import { useEffect, useId, useRef, type ReactNode } from 'react'
import { modalBodyClass, modalBodyTextClass, modalCloseButtonClass, modalHeaderClass, modalPanelClass, modalTitleClass } from './buttonStyles'

type ModalProps = {
  title: string
  isOpen: boolean
  onClose: () => void
  closeDisabled?: boolean
  hideCloseButton?: boolean
  children: ReactNode
  panelClassName?: string
  headerClassName?: string
  bodyClassName?: string
  titleClassName?: string
  closeButtonClassName?: string
}

export const Modal = ({
  title,
  isOpen,
  onClose,
  closeDisabled = false,
  hideCloseButton = false,
  children,
  panelClassName,
  headerClassName,
  bodyClassName,
  titleClassName,
  closeButtonClassName,
}: ModalProps) => {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!closeDisabled && !hideCloseButton) closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!closeDisabled) onClose()
        return
      }

      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)

      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
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
  }, [closeDisabled, hideCloseButton, isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--fog-wash)] px-0 pb-0 pt-8 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        if (!closeDisabled) onClose()
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        aria-describedby={descriptionId}
        className={[
          'flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden sm:max-h-[72vh]',
          modalPanelClass,
          panelClassName,
        ].filter(Boolean).join(' ')}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={[
          'flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4',
          modalHeaderClass,
          headerClassName,
        ].filter(Boolean).join(' ')}>
          <h2 className={[
            modalTitleClass,
            titleClassName,
          ].filter(Boolean).join(' ')} id={titleId}>{title}</h2>
          {hideCloseButton ? null : (
            <button
              aria-label="关闭"
              className={[
                modalCloseButtonClass,
                closeButtonClassName,
              ].filter(Boolean).join(' ')}
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
              disabled={closeDisabled}
            >
              x
            </button>
          )}
        </header>
        <div className={[
          'overflow-y-auto px-4 py-4 sm:px-5 sm:py-5',
          modalBodyTextClass,
          modalBodyClass,
          bodyClassName,
        ].filter(Boolean).join(' ')} id={descriptionId}>{children}</div>
      </section>
    </div>
  )
}
