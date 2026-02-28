// 资源预加载场景：加载图片、精灵表与音频。
import Phaser from "phaser";
class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
    // 缓存随机背景的选择结果
    this.selectedBG = null;
  }

  preload() {
    // 背景图片（随机选其一）
    this.load.image("bg1", "assets/bg1.png");
    this.load.image("bg2", "assets/bg2.png");
    this.load.image("bg3", "assets/bg3.png");

    // 角色精灵表
    this.load.spritesheet("bird", "assets/AllBird.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    // 管道与 UI 图标
    this.load.image("pipe", "assets/pipe.png");
    this.load.image("pause", "assets/pause.png");
    this.load.image("back", "assets/back.png");
    // 音效与背景音乐
    this.load.audio("sfxFlap", "assets/audio/sfx_flap.wav");
    this.load.audio("sfxScore", "assets/audio/sfx_score.wav");
    this.load.audio("sfxHit", "assets/audio/sfx_hit.wav");
    this.load.audio("bgm", "assets/audio/bgm_loop.mp3");
  }

  create() {
    // 等待字体加载完成后再进入主菜单，避免文字闪动
    const startMenu = () => this.scene.start("MenuScene");
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(startMenu).catch(startMenu);
    } else {
      startMenu();
    }
  }
}

export default PreloadScene;
