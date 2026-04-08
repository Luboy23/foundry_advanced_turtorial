export type DifficultyMode = 'auto' | 'easy' | 'normal' | 'hard'
export type BackgroundKey = 'random' | 'bg1' | 'bg2' | 'bg3'

const SETTINGS_KEY = 'flappy:settings'

export type FlappySettings = {
  soundEnabled: boolean
  musicEnabled: boolean
  difficulty: DifficultyMode
  background: BackgroundKey
}

const DEFAULT_SETTINGS: FlappySettings = {
  soundEnabled: true,
  musicEnabled: true,
  difficulty: 'auto',
  background: 'random',
}

export const loadSettings = (): FlappySettings => {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) as Partial<FlappySettings> : {}
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const saveSettings = (settings: Partial<FlappySettings>): FlappySettings => {
  const next = { ...DEFAULT_SETTINGS, ...settings }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }
  return next
}

export const getDifficultyMode = (settings?: Partial<FlappySettings>): DifficultyMode => {
  const value = settings?.difficulty
  if (value === 'easy' || value === 'normal' || value === 'hard') {
    return value
  }
  return 'auto'
}

export const getBackgroundKey = (settings?: Partial<FlappySettings>): BackgroundKey => {
  const value = settings?.background
  if (value === 'bg1' || value === 'bg2' || value === 'bg3') {
    return value
  }
  return 'random'
}
