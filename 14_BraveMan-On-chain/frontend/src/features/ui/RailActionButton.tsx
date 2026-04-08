import { useState, type ButtonHTMLAttributes, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import {
  railButtonBaseClass,
  railButtonPrimaryClass,
  railButtonSecondaryClass,
  railButtonSizeMdClass,
  railButtonSizeSmClass,
  railIconShellBaseClass,
  railIconShellPrimaryClass,
  railIconShellSecondaryClass,
} from './buttonStyles'

// 轨道按钮属性：支持主次色、尺寸、图标 rail 展开模式。
type RailActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode
  label: string
  tone?: 'primary' | 'secondary'
  size?: 'md' | 'sm'
  iconTestId?: string
  layout?: 'default' | 'icon-rail'
  hint?: ReactNode
  hintTestId?: string
}

/**
 * 侧边栏操作按钮。
 * 在 icon-rail 布局下，hover/focus 会展开文案，blur/leave 收起。
 */
export const RailActionButton = ({
  icon,
  label,
  tone = 'secondary',
  size = 'md',
  layout = 'default',
  className,
  iconTestId,
  hint,
  hintTestId,
  type = 'button',
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  title,
  'aria-label': ariaLabel,
  ...props
}: RailActionButtonProps) => {
  // 是否展开（仅 icon-rail 模式使用）。
  const [expanded, setExpanded] = useState(false)
  // 视觉变体衍生类：根据 tone/size/layout 组合。
  const buttonToneClass = tone === 'primary' ? railButtonPrimaryClass : railButtonSecondaryClass
  const iconToneClass = tone === 'primary' ? railIconShellPrimaryClass : railIconShellSecondaryClass
  const sizeClass = size === 'sm' ? railButtonSizeSmClass : railButtonSizeMdClass
  const iconSizeClass = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
  const labelClass = size === 'sm' ? 'text-[11px]' : 'text-sm'
  const isIconRail = layout === 'icon-rail'
  const isExpanded = isIconRail && expanded
  const shouldShowHint = isIconRail && Boolean(hint) && expanded

  // 鼠标进入：icon-rail 展开标签文本。
  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    if (isIconRail) setExpanded(true)
    onMouseEnter?.(event)
  }

  // 鼠标离开：icon-rail 收起标签文本。
  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    if (isIconRail) setExpanded(false)
    onMouseLeave?.(event)
  }

  // 键盘焦点进入：与 hover 保持一致的可访问性行为。
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (isIconRail) setExpanded(true)
    onFocus?.(event)
  }

  // 焦点离开：回收展开态，避免多个 rail 按钮同时展开。
  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (isIconRail) setExpanded(false)
    onBlur?.(event)
  }

  return (
    <button
      aria-label={ariaLabel ?? (isIconRail ? label : undefined)}
      className={[
        railButtonBaseClass,
        buttonToneClass,
        sizeClass,
        isIconRail
          ? [
              'relative origin-right flex-row-reverse justify-start overflow-visible whitespace-nowrap rounded-[1rem] transition-[width,padding,gap]',
              size === 'sm'
                ? (isExpanded ? 'w-[8.2rem] gap-2 pl-2 pr-[4px]' : 'w-10 gap-0 px-[4px]')
                : (isExpanded ? 'w-[9.3rem] gap-3 pl-3 pr-[6px]' : 'w-12 gap-0 px-[6px]'),
            ].join(' ')
          : null,
        className,
      ].filter(Boolean).join(' ')}
      data-expanded={isExpanded}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={title ?? (isIconRail ? label : undefined)}
      type={type}
      {...props}
    >
      {shouldShowHint ? (
        <span
          className="pointer-events-none absolute right-[calc(100%+0.55rem)] top-1/2 z-[2] min-w-[12rem] max-w-[15rem] -translate-y-1/2 rounded-[0.95rem] border border-[rgba(181,57,34,0.16)] bg-[rgba(255,255,255,0.96)] px-3 py-2 text-[10px] leading-4 text-[var(--accent-vermilion)] shadow-[0_10px_22px_rgba(0,0,0,0.1)]"
          data-testid={hintTestId}
        >
          {hint}
        </span>
      ) : null}
      <span
        className={[
          railIconShellBaseClass,
          iconToneClass,
          isIconRail ? (size === 'sm' ? 'h-7 w-7' : 'h-9 w-9') : iconSizeClass,
        ].join(' ')}
        data-testid={iconTestId}
      >
        {icon}
      </span>
      <span
        className={[
          labelClass,
          isIconRail
            ? `pointer-events-none overflow-hidden whitespace-nowrap transition-all duration-200 ${
              isExpanded
                ? 'min-w-0 flex-1 text-center max-w-[5.25rem] translate-x-0 opacity-100'
                : 'max-w-0 flex-none translate-x-1 opacity-0'
            }`
            : 'truncate',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}
