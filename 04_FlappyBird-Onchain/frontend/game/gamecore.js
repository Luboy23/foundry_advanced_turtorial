// Phaser 游戏入口：配置画布、物理引擎与场景列表。
import Phaser from "phaser";
import PlayScene from "./scenes/PlayScene";
import MenuScene from "./scenes/MenuScene";
import PreloadScene from "./scenes/PreloadScene";
import ScoreScene from "./scenes/ScoreScene";
import PauseScene from "./scenes/PauseScene";
import GameOverScene from "./scenes/GameOverScene";
import SettingsScene from "./scenes/SettingsScene";
import GameOverLoadingScene from "./scenes/GameOverLoadingScene";

// 设计稿的虚拟分辨率
const WIDTH = 720;
const HEIGHT = 600;
// 鸟的初始位置
const BIRD_POSITION = {
  x: WIDTH / 10,
  y: HEIGHT / 2,
};
// 共享配置（注入到各个场景中）
const SHARED_CONFIG = {
  width: WIDTH,
  height: HEIGHT,
  startPosition: BIRD_POSITION,
};

// 场景顺序（Preload 负责资源加载，其余为实际玩法）
const Scenes = [
  PreloadScene,
  MenuScene,
  ScoreScene,
  SettingsScene,
  GameOverLoadingScene,
  PlayScene,
  PauseScene,
  GameOverScene,
];
// 统一注入共享配置
const createScene = Scene => new Scene(SHARED_CONFIG);
// 初始化场景实例列表
const initScene = () => Scenes.map(createScene);

export default class FlappyBirdGame {
  constructor(containerId) {
    // Phaser 全局配置
    const config = {
      type: Phaser.AUTO,
      // 将共享配置合并到 Phaser config
      ...SHARED_CONFIG,
      // 画布背景色（白色，与留白一致）
      backgroundColor: "#ffffff",
      // 像素风渲染
      pixelArt: true,
      // 物理引擎：Arcade
      physics: {
        default: "arcade",
      },
      // 注册场景
      scene: initScene(),
      // 缩放策略：根据屏幕大小自动缩放并居中
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: containerId,
        width: WIDTH,
        height: HEIGHT
      },
    };

    // 创建 Phaser Game 实例
    return new Phaser.Game(config);
  }
}
