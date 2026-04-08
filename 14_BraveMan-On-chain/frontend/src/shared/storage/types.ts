// 触控模式：摇杆模式适合移动端持续操作，按钮模式适合离散控制。
export type TouchControlMode = 'joystick' | 'buttons'

// 本地设置模型：仅保存偏好，不保存链上真值资产。
export type SettingsModel = {
  musicEnabled: boolean
  sfxEnabled: boolean
  touchControlMode: TouchControlMode
  dismissPortraitHint: boolean
  dismissFirstRunHint: boolean
}

// 默认设置：首次进入或本地存储异常时的回退值。
export const defaultSettings: SettingsModel = {
  musicEnabled: true,
  sfxEnabled: true,
  touchControlMode: 'joystick',
  dismissPortraitHint: false,
  dismissFirstRunHint: false,
}
