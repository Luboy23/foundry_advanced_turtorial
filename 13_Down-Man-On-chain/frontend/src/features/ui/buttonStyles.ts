/**
 * 统一按钮样式令牌。
 * 通过字符串常量复用 Tailwind 组合，避免各组件重复拼接样式。
 */
const buttonBaseClass =
  'inline-flex items-center justify-center rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

// 主按钮用于开始/确认类动作，强调色统一走朱砂红。
export const buttonPrimaryClass = `${buttonBaseClass} border-[var(--accent-vermilion)] bg-[var(--accent-vermilion)] text-[var(--paper-50)] shadow-md shadow-black/20 hover:bg-[#8e2f1e] focus-visible:ring-[var(--accent-vermilion)] focus-visible:ring-offset-[var(--paper-50)]`

// 次按钮承载次级操作，保持纸白底避免和游戏主按钮抢层级。
export const buttonSecondaryClass = `${buttonBaseClass} border-[var(--line-soft)] bg-white text-[var(--ink-700)] shadow-sm shadow-black/5 hover:bg-[var(--paper-100)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[var(--paper-50)]`

// subtle 用于背景更轻的场景，比如工具栏刷新按钮或弱提示操作。
export const buttonSubtleClass = `${buttonBaseClass} border-[var(--line-soft)] bg-[rgba(255,255,255,0.62)] text-[var(--ink-700)] shadow-sm shadow-black/5 hover:bg-[var(--paper-100)] focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-[var(--paper-50)]`

// 尺寸令牌与颜色令牌拆开，方便各弹窗组合复用。
export const buttonSizeXsClass = 'px-2.5 py-1 text-[11px] sm:text-xs'
export const buttonSizeSmClass = 'px-3 py-1.5 text-xs sm:text-sm'
export const buttonSizeMdClass = 'px-4 py-2 text-sm sm:text-base'
