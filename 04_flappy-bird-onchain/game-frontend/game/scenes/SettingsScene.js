// 设置场景：提供音效/音乐开关与难度选择。
import BaseScene from "./BaseScene";
import { syncBgm } from "../audio/audioManager";
import { getDifficultyMode, loadSettings, saveSettings } from "../state/settings";

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
}

export default SettingsScene;
