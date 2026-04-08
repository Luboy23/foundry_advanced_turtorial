import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

// 统一线性图标笔触参数，保证全站图标风格一致。
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.8,
}

// 通用 SVG 包装器：封装 viewBox 与 aria-hidden 等基础属性。
const Svg = ({ className, children, ...props }: IconProps & { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {children}
  </svg>
)

// 图标组件：EquipmentIcon，返回统一 24x24 线性 SVG。
export const EquipmentIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M6.25 8.25h11.5l1.45 9.35H4.8Z" {...strokeProps} />
    <path d="M9 8.25V6.9a3 3 0 0 1 6 0v1.35" {...strokeProps} />
    <path d="M8.95 12.45h6.1" {...strokeProps} />
    <path d="M10.55 15.45h2.9" {...strokeProps} />
  </Svg>
)

// 图标组件：KillIcon，返回统一 24x24 线性 SVG。
export const KillIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="m7 6 4.5 4.5M13.5 13.5 18 18" {...strokeProps} />
    <path d="m17 6-4.5 4.5M10.5 13.5 6 18" {...strokeProps} />
    <path d="m5.6 5.6 2-2M16.4 18.4l2-2M18.4 5.6l-2-2M7.6 18.4l-2-2" {...strokeProps} />
  </Svg>
)

// 图标组件：GoldIcon，返回统一 24x24 线性 SVG。
export const GoldIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <ellipse cx="13" cy="8" rx="5.5" ry="2.75" {...strokeProps} />
    <path d="M7.5 8v6c0 1.52 2.46 2.75 5.5 2.75s5.5-1.23 5.5-2.75V8" {...strokeProps} />
    <path d="M5 11.5v5.25c0 1.24 2.01 2.25 4.5 2.25 1.29 0 2.46-.28 3.28-.73" {...strokeProps} />
    <ellipse cx="9.5" cy="11.5" rx="4.5" ry="2.25" {...strokeProps} />
  </Svg>
)

// 图标组件：CoinStackIcon，返回统一 24x24 线性 SVG。
export const CoinStackIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <ellipse cx="13.4" cy="8" rx="4.85" ry="2.35" {...strokeProps} />
    <path d="M8.55 8v5.3c0 1.3 2.17 2.35 4.85 2.35s4.85-1.05 4.85-2.35V8" {...strokeProps} />
    <ellipse cx="9.1" cy="12.1" rx="3.7" ry="1.8" {...strokeProps} />
    <path d="M5.4 12.1v3.75c0 .97 1.66 1.8 3.7 1.8 1.06 0 2.04-.22 2.73-.6" {...strokeProps} />
  </Svg>
)

// 图标组件：GreatswordItemIcon，返回统一 24x24 线性 SVG。
export const GreatswordItemIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M14.05 3.9 20.1 9.95 11 19.05 4.95 13Z" fill="currentColor" opacity="0.12" />
    <path d="M13.95 4.1 19.9 10.05 10.95 19" {...strokeProps} />
    <path d="M16.2 6.35 9.25 13.3" {...strokeProps} />
    <path d="M9.55 18.5 5.4 22.6" {...strokeProps} />
    <path d="M7.4 16.35 11.65 20.6" {...strokeProps} />
    <path d="M6.15 19.85 8.15 21.85" {...strokeProps} />
    <path d="M8.55 14 6.15 11.6" {...strokeProps} />
  </Svg>
)

// 图标组件：BowItemIcon，返回统一 24x24 线性 SVG。
export const BowItemIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M8.2 5.4c4.15 1.85 6.95 5.95 7.3 10.95" {...strokeProps} />
    <path d="M8.2 18.6c4.15-1.85 6.95-5.95 7.3-10.95" {...strokeProps} />
    <path d="M15.5 5.4v13.2" {...strokeProps} />
    <path d="M8.45 12h10.1" {...strokeProps} />
    <path d="m18.55 12-2.55-1.45M18.55 12l-2.55 1.45" {...strokeProps} />
    <path d="M6.2 6.8c.9 1.65 1.3 3.38 1.3 5.2 0 1.82-.4 3.55-1.3 5.2" {...strokeProps} />
  </Svg>
)

// 图标组件：HookSpearItemIcon，返回统一 24x24 线性 SVG。
export const HookSpearItemIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M5.2 19.1 18.8 5.5" {...strokeProps} />
    <path d="M17.3 4.2 20.8 7.7 17.8 10.7 14.3 7.2Z" fill="currentColor" opacity="0.12" />
    <path d="M17.25 4.25 20.7 7.7 17.75 10.65 14.3 7.2Z" {...strokeProps} />
    <path d="m14.3 7.2-2.8.2 1.2-2.55" {...strokeProps} />
    <path d="m18.15 9.1-1.65 3.55-2.35-2.35" {...strokeProps} />
    <path d="M8.2 16.1 5.9 13.8" {...strokeProps} />
    <path d="M6.65 19.85 4.3 17.5" {...strokeProps} />
  </Svg>
)

// 图标组件：LockBadgeIcon，返回统一 24x24 线性 SVG。
export const LockBadgeIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M8.25 10.25V8.9a3.75 3.75 0 1 1 7.5 0v1.35" {...strokeProps} />
    <rect x="6.5" y="10.25" width="11" height="8" rx="2.2" {...strokeProps} />
    <path d="M12 13.1v2.35" {...strokeProps} />
  </Svg>
)

// 图标组件：EquipStampIcon，返回统一 24x24 线性 SVG。
export const EquipStampIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <circle cx="12" cy="12" r="7.5" {...strokeProps} />
    <path d="m8.85 12.2 2.05 2.1 4.35-4.6" {...strokeProps} />
    <path d="M12 4.1v1.25M19.9 12h-1.25M12 18.65v1.25M5.35 12H4.1" {...strokeProps} />
  </Svg>
)

// 图标组件：EmptySlotMarkIcon，返回统一 24x24 线性 SVG。
export const EmptySlotMarkIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M6.1 8.2V6.1h2.1M17.9 8.2V6.1h-2.1M6.1 15.8v2.1h2.1M17.9 15.8v2.1h-2.1" {...strokeProps} />
    <path d="M8.65 8.65h6.7v6.7h-6.7Z" {...strokeProps} />
    <path d="m9.65 14.35 4.7-4.7" {...strokeProps} />
  </Svg>
)

// 图标组件：StartIcon，返回统一 24x24 线性 SVG。
export const StartIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M7.25 6.5 17.25 12l-10 5.5Z" {...strokeProps} />
    <path d="M6 5.5v13" {...strokeProps} />
  </Svg>
)

// 图标组件：PauseIcon，返回统一 24x24 线性 SVG。
export const PauseIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M8.25 6.5v11" {...strokeProps} />
    <path d="M15.75 6.5v11" {...strokeProps} />
    <path d="M6 18h12" {...strokeProps} />
  </Svg>
)

// 图标组件：ResumeIcon，返回统一 24x24 线性 SVG。
export const ResumeIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M8 7.25 16.5 12 8 16.75Z" {...strokeProps} />
    <path d="M5.75 12a6.25 6.25 0 0 0 10.75 4.35" {...strokeProps} />
    <path d="M14.25 4.75A6.25 6.25 0 0 1 18.25 12" {...strokeProps} />
  </Svg>
)

// 图标组件：RetreatIcon，返回统一 24x24 线性 SVG。
export const RetreatIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M8.5 12H18" {...strokeProps} />
    <path d="m11.5 8-4 4 4 4" {...strokeProps} />
    <path d="M18 5.5v13" {...strokeProps} />
  </Svg>
)

// 图标组件：SettingsIcon，返回统一 24x24 线性 SVG。
export const SettingsIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z" {...strokeProps} />
    <path d="M12 4.75v1.5M12 17.75v1.5M19.25 12h-1.5M6.25 12h-1.5M17.12 6.88l-1.06 1.06M7.94 16.06l-1.06 1.06M17.12 17.12l-1.06-1.06M7.94 7.94 6.88 6.88" {...strokeProps} />
  </Svg>
)

// 图标组件：HistoryIcon，返回统一 24x24 线性 SVG。
export const HistoryIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M7.25 8.5H4.75v-3" {...strokeProps} />
    <path d="M6.1 15.9A7 7 0 1 0 5 8.5" {...strokeProps} />
    <path d="M12 8.25v4l2.9 1.65" {...strokeProps} />
  </Svg>
)

// 图标组件：ConnectIcon，返回统一 24x24 线性 SVG。
export const ConnectIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path d="M8.5 12a3.5 3.5 0 0 1 3.5-3.5h2" {...strokeProps} />
    <path d="M15.5 12A3.5 3.5 0 0 1 12 15.5h-2" {...strokeProps} />
    <path d="M9.25 8.25 7 10.5M17 13.5l-2.25 2.25" {...strokeProps} />
    <path d="M9.5 12h5" {...strokeProps} />
  </Svg>
)

// 图标组件：GitHubIcon，返回实心 GitHub 品牌 SVG（用于页脚仓库入口）。
export const GitHubIcon = ({ className, ...props }: IconProps) => (
  <Svg className={className} {...props}>
    <path
      d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.24.78-.54 0-.27-.01-.98-.02-1.92-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.07 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.6.24 2.78.12 3.07.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.67.41.35.78 1.04.78 2.1 0 1.52-.02 2.74-.02 3.11 0 .3.2.65.79.54A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      fill="currentColor"
    />
  </Svg>
)
