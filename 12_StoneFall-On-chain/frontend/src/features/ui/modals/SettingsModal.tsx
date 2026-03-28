/**
 * 模块职责：提供游戏设置弹窗，管理音频与移动端操控配置。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { Modal } from '../Modal'
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonSizeSmClass,
} from '../buttonStyles'
import type { SettingsModel, TouchControlMode } from '../../../shared/storage/types'

type SettingsModalProps = {
  isOpen: boolean
  settings: SettingsModel
  onClose: () => void
  onToggleMusic: () => void
  onToggleSfx: () => void
  onSelectTouchMode: (mode: TouchControlMode) => void
}

/**
 * 设置弹窗。
 * 设置项变更由上层统一持久化，本组件仅负责交互与展示。
 */
export default function SettingsModal({
  isOpen,
  settings,
  onClose,
  onToggleMusic,
  onToggleSfx,
  onSelectTouchMode,
}: SettingsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="设置"
    >
      <div className="space-y-4">
        {/* 音频设置区 */}
        <div className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.58)] px-3 py-3">
          <p className="text-sm font-semibold text-[var(--ink-900)]">音频</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm">背景音乐</span>
            <button
              className={`${settings.musicEnabled ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} min-w-[4.75rem]`}
              onClick={onToggleMusic}
              type="button"
            >
              {settings.musicEnabled ? '开启' : '关闭'}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm">音效</span>
            <button
              className={`${settings.sfxEnabled ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} min-w-[4.75rem]`}
              onClick={onToggleSfx}
              type="button"
            >
              {settings.sfxEnabled ? '开启' : '关闭'}
            </button>
          </div>
        </div>

        {/* 触控模式设置区 */}
        <div className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.58)] px-3 py-3">
          <p className="text-sm font-semibold text-[var(--ink-900)]">移动端操控</p>
          <p className="mt-1 text-xs text-[var(--ink-500)]">
            默认使用目标点跟随，可切换为按键控制。
          </p>
          <div className="mt-2 flex gap-2">
            <button
              className={`${settings.touchControlMode === 'follow' ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} flex-1`}
              onClick={() => onSelectTouchMode('follow')}
              type="button"
            >
              目标跟随
            </button>
            <button
              className={`${settings.touchControlMode === 'buttons' ? buttonPrimaryClass : buttonSecondaryClass} ${buttonSizeSmClass} flex-1`}
              onClick={() => onSelectTouchMode('buttons')}
              type="button"
            >
              按键模式
            </button>
          </div>
        </div>

        {/* 玩法说明：避免用户首次进入不清楚目标与结算逻辑。 */}
        <div className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.58)] px-3 py-3 text-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">玩法说明</p>
          <p className="mt-1">目标：左右移动躲避落下的石块，坚持越久分数越高。</p>
          <p className="mt-1">操作：键盘 `A/D` 或 `←/→`，`Space` 可暂停/继续；移动端默认按住触控区跟随目标，可切换按键模式。</p>
          <p className="mt-1">结算：被击中即结束，本局成绩会自动发起链上提交。</p>
        </div>
      </div>
    </Modal>
  )
}
