// 设置存储键名
const SETTINGS_KEY = "flappy:settings";

// 默认设置
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  musicEnabled: true,
  difficulty: "auto",
};

// 读取设置（合并默认值，容错异常）
export const loadSettings = () => {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
};

// 保存设置（确保字段完整）
export const saveSettings = (settings) => {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
};

// 规范化难度字段，非法值回退为 auto
export const getDifficultyMode = (settings) => {
  const value = settings?.difficulty;
  if (value === "easy" || value === "normal" || value === "hard") {
    return value;
  }
  return "auto";
};
