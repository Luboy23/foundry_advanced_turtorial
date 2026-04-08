import { defaultSettings, type SettingsModel } from './types'

// 本地设置键：版本化命名便于未来 schema 迁移。
const SETTINGS_KEY = 'braveman.settings.v1'

/**
 * 读取本地设置。
 * 失败路径：
 * 1) SSR 环境：直接返回默认值；
 * 2) JSON 损坏：捕获异常并回退默认值。
 */
export const loadSettings = (): SettingsModel => {
  if (typeof window === 'undefined') {
    return defaultSettings
  }
  try {
    // 无本地记录时返回默认设置，不主动写入。
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    // 合并默认值以兼容“旧版本少字段”场景。
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<SettingsModel>) }
  } catch {
    return defaultSettings
  }
}

/**
 * 持久化设置到 localStorage。
 * 存储异常（隐私模式/配额）时吞掉错误，避免影响主流程。
 */
export const saveSettings = (settings: SettingsModel): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore storage failures
  }
}
