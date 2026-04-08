// 按钮基础样式：封装通用结构、焦点环与禁用态。
const buttonBaseClass =
  'inline-flex items-center justify-center rounded-[1rem] border font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

// 主按钮视觉（高强调操作）。
export const buttonPrimaryClass = `${buttonBaseClass} border-[var(--accent-vermilion)] bg-[var(--accent-vermilion)] text-[var(--paper-50)] shadow-[0_10px_22px_rgba(0,0,0,0.14)] hover:-translate-y-[1px] hover:border-[#8e2f1e] hover:bg-[#8e2f1e] hover:shadow-[0_12px_24px_rgba(0,0,0,0.16)] active:translate-y-[1px] active:shadow-[0_6px_14px_rgba(0,0,0,0.14)] focus-visible:ring-[var(--accent-vermilion)] focus-visible:ring-offset-[rgba(255,255,255,0.94)]`
// 次按钮视觉（中强调操作）。
export const buttonSecondaryClass = `${buttonBaseClass} border-[var(--ui-panel-border)] bg-[rgba(255,255,255,0.94)] text-[var(--ink-700)] shadow-[0_8px_18px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] hover:border-[var(--ui-panel-border-strong)] hover:bg-[rgba(255,255,255,1)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.1)] active:translate-y-[1px] active:shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[rgba(255,255,255,0.94)]`
// 弱强调按钮视觉（低风险操作）。
export const buttonSubtleClass = `${buttonBaseClass} border-[var(--line-soft)] bg-[rgba(255,255,255,0.72)] text-[var(--ink-700)] shadow-[0_6px_14px_rgba(0,0,0,0.06)] hover:bg-[rgba(255,255,255,0.88)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[rgba(255,255,255,0.94)]`
// 尺寸档位：XS/SM/MD。
export const buttonSizeXsClass = 'px-2.5 py-1 text-[11px] sm:text-xs'
export const buttonSizeSmClass = 'px-3 py-1.5 text-xs sm:text-sm'
export const buttonSizeMdClass = 'px-4 py-2 text-sm sm:text-base'

// 纸张面板与徽章等容器样式集合。
export const parchmentPanelClass = 'border border-[var(--ui-panel-border-strong)] bg-[var(--ui-panel-bg)] shadow-[0_16px_36px_rgba(0,0,0,0.14)]'
export const parchmentBadgeClass = 'inline-flex items-center rounded-full border border-[var(--ui-panel-border)] bg-[rgba(255,255,255,0.88)] text-[var(--ink-700)] shadow-[0_4px_10px_rgba(0,0,0,0.05)]'
export const modalPanelClass = `${parchmentPanelClass} rounded-t-[1.6rem] border-b-0 sm:rounded-[1.7rem] sm:border-b`
export const modalHeaderClass = 'border-b border-[var(--ui-panel-border)] bg-[rgba(255,255,255,0.96)]'
export const modalBodyClass = 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.44),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,248,248,0.94))]'
export const modalTitleClass = 'text-[0.98rem] font-semibold tracking-tight text-[var(--ink-900)] sm:text-[1.05rem]'
export const modalCloseButtonClass = `${buttonSecondaryClass} h-9 w-9 rounded-[1rem] p-0 text-base font-semibold leading-none sm:h-10 sm:w-10`
export const modalBodyTextClass = 'text-sm leading-[1.55] text-[var(--ink-900)]'
export const modalSectionClass = 'rounded-[1.25rem] border border-[var(--ui-panel-border)] bg-[rgba(255,255,255,0.82)] shadow-[0_8px_18px_rgba(0,0,0,0.06)]'
export const modalInsetClass = 'rounded-[1rem] border border-[rgba(16,16,16,0.1)] bg-[rgba(255,255,255,0.66)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
export const railPanelClass = `${parchmentPanelClass} rounded-[1.2rem] bg-[var(--ui-rail-bg)] backdrop-blur-[10px]`
export const railButtonBaseClass = `${buttonBaseClass} justify-start gap-3 rounded-[1.1rem] px-3 text-left shadow-[0_8px_18px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] active:translate-y-[1px]`
export const railButtonPrimaryClass = 'border-[var(--accent-vermilion)] bg-[var(--accent-vermilion)] text-[var(--paper-50)] hover:border-[#8e2f1e] hover:bg-[#8e2f1e] focus-visible:ring-[var(--accent-vermilion)] focus-visible:ring-offset-[rgba(255,255,255,0.94)]'
export const railButtonSecondaryClass = 'border-[var(--ui-panel-border)] bg-[rgba(255,255,255,0.94)] text-[var(--ink-700)] hover:border-[var(--ui-panel-border-strong)] hover:bg-[rgba(255,255,255,1)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[rgba(255,255,255,0.94)]'
export const railButtonSizeMdClass = 'min-h-[3.15rem] py-2.5'
export const railButtonSizeSmClass = 'min-h-[2.5rem] py-2'
export const railIconShellBaseClass = 'inline-flex shrink-0 items-center justify-center rounded-[0.9rem] border shadow-[0_4px_10px_rgba(0,0,0,0.05)]'
export const railIconShellPrimaryClass = 'border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.12)] text-[var(--paper-50)]'
export const railIconShellSecondaryClass = 'border-[rgba(16,16,16,0.1)] bg-[rgba(255,255,255,0.72)] text-[var(--ink-700)]'
