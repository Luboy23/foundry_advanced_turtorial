/**
 * 模块职责：提供 features/ui/buttonStyles.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

const buttonBaseClass =
  'inline-flex items-center justify-center rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

/**
 * buttonPrimaryClass：导出可复用能力。
 */
export const buttonPrimaryClass = `${buttonBaseClass} border-[var(--accent-vermilion)] bg-[var(--accent-vermilion)] text-[var(--paper-50)] shadow-md shadow-black/20 hover:bg-[#8e2f1e] focus-visible:ring-[var(--accent-vermilion)] focus-visible:ring-offset-[var(--paper-50)]`

/**
 * buttonSecondaryClass：导出可复用能力。
 */
export const buttonSecondaryClass = `${buttonBaseClass} border-[var(--line-soft)] bg-white text-[var(--ink-700)] shadow-sm shadow-black/5 hover:bg-[var(--paper-100)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[var(--paper-50)]`

/**
 * buttonSubtleClass：导出可复用能力。
 */
export const buttonSubtleClass = `${buttonBaseClass} border-[var(--line-soft)] bg-[rgba(255,255,255,0.62)] text-[var(--ink-700)] shadow-sm shadow-black/5 hover:bg-[var(--paper-100)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[var(--paper-50)]`

/**
 * buttonSizeXsClass：导出可复用能力。
 */
export const buttonSizeXsClass = 'px-2.5 py-1 text-[11px] sm:text-xs'
/**
 * buttonSizeSmClass：导出可复用能力。
 */
export const buttonSizeSmClass = 'px-3 py-1.5 text-xs sm:text-sm'
/**
 * buttonSizeMdClass：导出可复用能力。
 */
export const buttonSizeMdClass = 'px-4 py-2 text-sm sm:text-base'
