/**
 * 设置弹窗。
 * 当前只管理音频与移动端操控模式；移动端区块按 viewport 条件显示。
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
  showTouchControlsSection: boolean
  onClose: () => void
  onToggleMusic: () => void
  onToggleSfx: () => void
  onSelectTouchMode: (mode: TouchControlMode) => void
}

export default function SettingsModal({
  isOpen,
  settings,
  showTouchControlsSection,
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
        {/* 音频设置永远显示，因为桌面端和移动端都共用同一套音效开关。 */}
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

        {showTouchControlsSection ? (
          <div className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.58)] px-3 py-3">
            {/* 移动端操控模块按 viewport 条件显示，桌面端不再出现无效设置。 */}
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
        ) : null}

        {/* 玩法说明和当前平台控制策略一起展示，减少用户来回试错。 */}
        <div className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.58)] px-3 py-3 text-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">玩法说明</p>
          <p className="mt-1">目标：在自动下滚的视窗中不断下层，持续落到平台上生存。</p>
          <p className="mt-1">
            {showTouchControlsSection
              ? '操作：键盘 `A/D` 或 `←/→`，`Space` 可暂停/继续；移动端默认按住触控区跟随目标，可切换按键模式。'
              : '操作：键盘 `A/D` 或 `←/→`，`Space` 可暂停/继续。'}
          </p>
          <p className="mt-1">判定：角色触顶或触底即结束，成绩会自动发起链上提交。</p>
        </div>
      </div>
    </Modal>
  )
}
