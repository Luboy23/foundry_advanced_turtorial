// @ts-nocheck
// 设置场景：提供音效/音乐开关与难度选择。
import BaseScene from "./BaseScene";
import { syncBgm } from "../audio/audioManager";
import {
  getBackgroundKey,
  getDifficultyMode,
  loadSettings,
  saveSettings,
} from "../state/settings";

// 难度标签显示
const DIFFICULTY_LABELS = {
  auto: "自适应",
  easy: "简单",
  normal: "普通",
  hard: "困难",
};

// 难度循环顺序
const DIFFICULTY_ORDER = ["auto", "easy", "normal", "hard"];

class SettingsScene extends BaseScene {
  constructor(config) {
    // canGoBack=true：显示返回菜单按钮
    super("SettingsScene", { ...config, canGoBack: true });
    // 初始化设置
    this.settings = loadSettings();
  }

  // 创建场景
  create() {
    super.create();
    // 进入场景时重新读取最新设置
    this.settings = loadSettings();
    this.createTitle();
    this.createSettingsMenu();
    this.createBackgroundSelector();
  }

  // 标题与提示文字
  createTitle() {
    this.add
      .text(this.screenCenter[0], this.screenCenter[1] - 150, "设置", {
        ...this.fontOptions,
        fontSize: "36px",
        fill: "#fff",
      })
      .setOrigin(0.5);

    this.add
      .text(this.screenCenter[0], this.screenCenter[1] - 110, "点击选项切换", {
        fontSize: "16px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0.5);
  }

  // 创建设置选项菜单
  createSettingsMenu() {
    const menu = [
      { key: "soundEnabled", type: "toggle", label: "音效" },
      { key: "musicEnabled", type: "toggle", label: "音乐" },
      {
        key: "difficulty",
        type: "cycle",
        label: "难度",
        values: DIFFICULTY_ORDER,
      },
    ];

    // 将菜单项转换为可显示文本
    menu.forEach((item) => {
      item.text = this.getMenuText(item);
    });

    this.createMenu(menu, this.setUpMenuEvents.bind(this), {
      button: { width: 300, height: 56, fontSize: "24px" },
      gap: 16,
    });
  }

  // 根据设置生成菜单显示文本
  getMenuText(item) {
    if (item.type === "toggle") {
      return `${item.label}：${this.settings[item.key] ? "开" : "关"}`;
    }

    if (item.type === "cycle") {
      const mode = getDifficultyMode(this.settings);
      return `${item.label}：${DIFFICULTY_LABELS[mode]}`;
    }

    return item.label;
  }

  // 处理菜单点击事件
  setUpMenuEvents(menuItem, button) {
    button.hitZone.on("pointerup", () => {
      if (menuItem.type === "toggle") {
        // 开关类选项：直接取反
        this.settings[menuItem.key] = !this.settings[menuItem.key];
      }

      if (menuItem.type === "cycle") {
        // 循环类选项：按顺序切换
        const current = getDifficultyMode(this.settings);
        const index = menuItem.values.indexOf(current);
        const nextIndex = index === -1 ? 0 : (index + 1) % menuItem.values.length;
        this.settings[menuItem.key] = menuItem.values[nextIndex];
      }

      // 保存设置并同步背景音乐
      this.settings = saveSettings(this.settings);
      syncBgm(this, this.settings);
      // 更新按钮文字
      button.text.setText(this.getMenuText(menuItem));
    });
  }

  // 背景选择模块（缩略图 + 随机）
  createBackgroundSelector() {
    const options = [
      { key: "random", label: "随机", texture: null },
      { key: "bg1", label: "bg1", texture: "bg1" },
      { key: "bg2", label: "bg2", texture: "bg2" },
      { key: "bg3", label: "bg3", texture: "bg3" },
    ];

    const lastButton =
      this.menuButtons?.[this.menuButtons.length - 1] ?? null;
    const baseY = lastButton ? lastButton.y + 70 : this.screenCenter[1] + 60;

    this.add
      .text(this.screenCenter[0], baseY, "背景选择", {
        fontSize: "18px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0.5);

    const cardWidth = 90;
    const cardHeight = 60;
    const gap = 14;
    const rowWidth =
      options.length * cardWidth + (options.length - 1) * gap;
    const startX =
      this.screenCenter[0] - rowWidth / 2 + cardWidth / 2;
    const rowY = baseY + 48;

    this.bgOptionNodes = options.map((option, index) => {
      const x = startX + index * (cardWidth + gap);

      const background = this.add
        .rectangle(x, rowY, cardWidth, cardHeight, 0x111111, 0.75)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff, 0.3);

      let content = null;
      if (option.texture) {
        content = this.add
          .image(x, rowY, option.texture)
          .setDisplaySize(cardWidth - 6, cardHeight - 6);
      } else {
        content = this.add
          .text(x, rowY, option.label, {
            fontSize: "16px",
            fill: "#fff",
            fontFamily: this.fontFamily,
            padding: this.textPadding,
          })
          .setOrigin(0.5);
      }

      const hitZone = this.add
        .zone(x, rowY, cardWidth + 8, cardHeight + 8)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      hitZone.on("pointerup", () => {
        this.applyBackgroundSelection(option.key);
      });

      return {
        key: option.key,
        background,
        content,
        hitZone,
      };
    });

    this.updateBackgroundSelector();
  }

  updateBackgroundSelector() {
    const selected = getBackgroundKey(this.settings);
    if (!this.bgOptionNodes) return;
    this.bgOptionNodes.forEach((node) => {
      const isActive = node.key === selected;
      node.background.setStrokeStyle(
        2,
        isActive ? 0xfff58a : 0xffffff,
        isActive ? 0.95 : 0.3
      );
    });
  }

  applyBackgroundSelection(key) {
    this.settings.background = key;
    this.settings = saveSettings(this.settings);

    const preloadScene = this.scene.manager.getScene("PreloadScene");
    if (key === "random") {
      if (preloadScene) {
        preloadScene.selectedBG = null;
      }
      this.createBG();
      if (this.background && this.selectedBG) {
        this.background.setTexture(this.selectedBG);
      }
    } else {
      if (preloadScene) {
        preloadScene.selectedBG = key;
      }
      this.selectedBG = key;
      if (this.background) {
        this.background.setTexture(key);
      }
    }

    this.updateBackgroundSelector();
  }
}

export default SettingsScene;
