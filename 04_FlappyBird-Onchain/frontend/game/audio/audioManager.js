// 音频管理：控制背景音乐与音效播放。
import { loadSettings } from "../state/settings";

// 背景音乐资源 key（与 PreloadScene 保持一致）
const BGM_KEY = "bgm";

// 判断音频资源是否已加载
const hasAudioKey = (scene, key) =>
  !!scene?.cache?.audio?.exists && scene.cache.audio.exists(key);

// 同步背景音乐状态（根据设置开启/关闭）
export const syncBgm = (scene, settings = loadSettings()) => {
  if (!scene?.sound || !hasAudioKey(scene, BGM_KEY)) return;

  const current = scene.sound.get(BGM_KEY);
  if (settings.musicEnabled) {
    // 如果已存在但未播放，则播放
    if (current) {
      if (!current.isPlaying) {
        current.play();
      }
    } else {
      // 首次创建并循环播放
      const bgm = scene.sound.add(BGM_KEY, { loop: true, volume: 0.25 });
      bgm.play();
    }
    return;
  }

  // 设置为关闭时停止播放
  if (current?.isPlaying) {
    current.stop();
  }
};

// 播放短音效（受音效设置控制）
export const playSfx = (scene, key, options = {}) => {
  if (!scene?.sound || !hasAudioKey(scene, key)) return;
  const settings = options.settings ?? loadSettings();
  if (!settings.soundEnabled) return;
  // 默认音量可通过 options 覆盖
  const volume = typeof options.volume === "number" ? options.volume : 0.6;
  scene.sound.play(key, { volume });
};
