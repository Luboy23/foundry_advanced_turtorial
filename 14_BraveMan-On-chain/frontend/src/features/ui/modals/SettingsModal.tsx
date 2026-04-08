import type { ReactNode } from 'react'
import { Modal } from '../Modal'
import { buttonPrimaryClass, buttonSecondaryClass, buttonSizeSmClass, modalInsetClass, modalSectionClass, parchmentBadgeClass } from '../buttonStyles'
import type { SettingsModel, TouchControlMode } from '../../../shared/storage/types'
import { BRAVEMAN_REPOSITORY_URL } from '../../../lib/projectMeta'

/** 设置弹窗输入：所有状态源都来自上层 App。 */
type SettingsModalProps = {
  isOpen: boolean
  settings: SettingsModel
  onClose: () => void
  onToggleMusic: () => void
  onToggleSfx: () => void
  onSelectTouchMode: (mode: TouchControlMode) => void
}

/**
 * 设置弹窗：
 * - 管理本地偏好（音乐/音效/触控模式）；
 * - 展示玩法规则与项目链接；
 * - 不直接触发链上或后端请求。
 */
export default function SettingsModal({ isOpen, settings, onClose, onToggleMusic, onToggleSfx, onSelectTouchMode }: SettingsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="设置"
    >
      <div className="space-y-4">
        <div className={`${modalSectionClass} px-4 py-4`}>
          <p className="text-[10px] font-semibold tracking-[0.24em] text-[var(--ink-500)]">音频设置</p>
          <p className="mt-1 text-base font-semibold text-[var(--ink-900)]">音频</p>
          <div className="mt-3 space-y-2">
            <SettingRow
              label="背景音乐"
              value={settings.musicEnabled ? '开启' : '关闭'}
              action={
                // 音频开关只改本地设置，不触发链上/后端请求。
                <button className={`${settings.musicEnabled ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} min-w-[4.75rem]`} onClick={onToggleMusic} type="button">
                  {settings.musicEnabled ? '开启' : '关闭'}
                </button>
              }
            />
            <SettingRow
              label="音效"
              value={settings.sfxEnabled ? '开启' : '关闭'}
              action={
                <button className={`${settings.sfxEnabled ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} min-w-[4.75rem]`} onClick={onToggleSfx} type="button">
                  {settings.sfxEnabled ? '开启' : '关闭'}
                </button>
              }
            />
          </div>
        </div>

        <div className={`${modalSectionClass} px-4 py-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.24em] text-[var(--ink-500)]">触控方式</p>
              <p className="mt-1 text-base font-semibold text-[var(--ink-900)]">移动端操控</p>
            </div>
            <span className={`${parchmentBadgeClass} px-2.5 py-1 text-[11px] font-semibold`}>
              {settings.touchControlMode === 'joystick' ? '摇杆' : '按键'}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {/* 触控模式只影响输入映射策略，不改变核心战斗规则。 */}
            <button className={`${settings.touchControlMode === 'joystick' ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} flex-1`} onClick={() => onSelectTouchMode('joystick')} type="button">虚拟摇杆</button>
            <button className={`${settings.touchControlMode === 'buttons' ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} flex-1`} onClick={() => onSelectTouchMode('buttons')} type="button">按键模式</button>
          </div>
        </div>

        <div className={`${modalSectionClass} px-4 py-4 text-sm`}>
          <p className="text-[10px] font-semibold tracking-[0.24em] text-[var(--ink-500)]">玩法说明</p>
          <div className="mt-3 space-y-2 text-[var(--ink-800)]">
            <div className={`${modalInsetClass} px-3 py-2`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">目标</p>
              <p className="mt-1">在固定竞技场中不断击杀从左右刷入的怪物，尽可能活得更久并拿到更多金币。</p>
            </div>
            <div className={`${modalInsetClass} px-3 py-2`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">规则</p>
              {/* 此处文案需与实际按键行为保持一致，避免教学误导。 */}
              <p className="mt-1">玄火镇岳、金钩裂甲与霜翎逐月均为自动攻击；被怪物碰到会立即阵亡；可打开装备页并用 `J` 循环切换武器，`空格` 暂停/继续；可在暂停状态选择结算离场。</p>
            </div>
            <div className={`${modalInsetClass} px-3 py-2`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">经济</p>
              <p className="mt-1">链上金币会按本局战绩结算，累计 10 金币可永久解锁霜翎逐月。</p>
            </div>
          </div>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-500)]">项目链接</p>
          <a
            className={`${parchmentBadgeClass} mt-2 px-3 py-1.5 text-sm font-semibold text-[var(--accent-vermilion)] transition hover:opacity-80`}
            href={BRAVEMAN_REPOSITORY_URL}
            rel="noreferrer"
            target="_blank"
          >
            GitHub 仓库
          </a>
        </div>
      </div>
    </Modal>
  )
}

/** 设置项行组件：左侧标签与右侧动作按钮的统一布局。 */
const SettingRow = ({
  label,
  value,
  action,
}: {
  label: string
  value: string
  action: ReactNode
}) => (
  <div className={`${modalInsetClass} flex items-center justify-between gap-3 px-3 py-2.5`}>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[var(--ink-900)]">{label}</p>
      <p className="mt-0.5 text-[11px] text-[var(--ink-500)]">{value}</p>
    </div>
    {action}
  </div>
)
