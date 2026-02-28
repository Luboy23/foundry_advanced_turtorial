// 场景基类：统一处理背景、缩放、菜单按钮、钱包状态显示与音频解锁。
import Phaser from "phaser";
import { syncBgm } from "../audio/audioManager";
import { loadSettings } from "../state/settings";
import { getConnectedAccount, onAccountChanged } from "../chain/accountClient";

// 将地址缩短显示（例如 0x1234...abcd）
const formatAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

class BaseScene extends Phaser.Scene {
  constructor(key, config) {
    super(key);
    // 场景共享配置（宽高、初始位置等）
    this.config = config;
    // 虚拟分辨率，用于缩放计算
    this.virtualWidth = config.width;
    this.virtualHeight = config.height;
    // 字体与布局相关
    this.fontSize = 32;
    this.fontFamily =
      '"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif';
    this.textPadding = { x: 6, y: 4 };
    this.lineHeight = this.fontSize + this.textPadding.y * 2 + 12;
    this.fontOptions = {
      fontSize: `${this.fontSize}px`,
      fill: "#fff",
      fontFamily: this.fontFamily,
      padding: this.textPadding,
    };
    // 屏幕中心点
    this.screenCenter = [this.virtualWidth / 2, this.virtualHeight / 2];
    // 背景与菜单缓存
    this.background = null;
    // 当前钱包地址缓存
    this.currentAccount = null;
    // 作者署名文字
    this.authorText = null;
  }

  // 选择并缓存随机背景
  createBG() {
    if (!this.scene.manager.getScene("PreloadScene").selectedBG) {
      const backgrounds = ["bg1", "bg2", "bg3"];

      const randomIndex = Phaser.Math.Between(0, backgrounds.length - 1);
      this.scene.manager.getScene("PreloadScene").selectedBG =
        backgrounds[randomIndex];
    }

    this.selectedBG = this.scene.manager.getScene("PreloadScene").selectedBG;
  }

  // 场景通用初始化：背景、缩放、返回按钮、钱包状态显示
  create() {
    this.createBG();
    // 读取设置并同步背景音乐
    this.settings = loadSettings();
    syncBgm(this, this.settings);
    // 首次交互解锁音频播放
    this.ensureAudioUnlocked();
    // 初始化相机缩放与视口裁剪
    if (this.cameras?.main) {
      this.cameras.main.roundPixels = true;
      this.applyCameraLayout();
    }
    // 创建背景图
    this.background = this.add
      .image(...this.screenCenter, this.selectedBG)
      .setOrigin(0.5, 0.5);
    this.updateBackgroundSize();

    // 可选返回按钮
    if (this.config.canGoBack) {
      this.backButton = this.add
        .image(this.virtualWidth - 10, this.virtualHeight - 10, "back")
        .setOrigin(1)
        .setScale(2)
        .setInteractive();

      this.backButton.on("pointerup", () => {
        this.scene.start("MenuScene");
      });
    }

    // 右上角钱包状态 UI
    this.createAccountDisplay();
    // 左下角作者信息
    this.createAuthorSignature();

    // 监听窗口缩放
    this.scale.on("resize", this.handleResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.handleResize, this);
    });
  }

  // 左下角作者署名
  createAuthorSignature() {
    if (this.authorText) return;
    this.authorText = this.add
      .text(10, this.virtualHeight - 10, "© 2026 lllu_23 • Flappy Bird On-chain", {
        fontSize: "12px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0, 1)
      .setAlpha(0.85)
      .setDepth(999);
  }

  // 创建统一样式的文本按钮
  createTextButton(x, y, label, options = {}) {
    const width = options.width ?? 240;
    const height = options.height ?? 54;
    const hitPadding = options.hitPadding ?? 10;
    const bgColor = options.bgColor ?? 0x1f1f1f;
    const hoverBgColor = options.hoverBgColor ?? 0x3a3a3a;
    const textColor = options.textColor ?? "#fff";
    const hoverTextColor = options.hoverTextColor ?? "#ff0";
    const fontSize = options.fontSize ?? "28px";

    // 背景矩形
    const background = this.add
      .rectangle(0, 0, width, height, bgColor, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0.7);

    // 按钮文字
    const text = this.add
      .text(0, 0, label, {
        fontSize,
        fill: textColor,
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0.5);

    // 点击命中区域（比按钮略大，提升可点击性）
    const hitWidth = width + hitPadding * 2;
    const hitHeight = height + hitPadding * 2;
    const hitZone = this.add
      .zone(0, 0, hitWidth, hitHeight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // 将命中区域、背景与文字打包成容器
    const container = this.add.container(x, y, [hitZone, background, text]);

    // Hover 效果
    hitZone.on("pointerover", () => {
      background.setFillStyle(hoverBgColor, 0.95);
      text.setStyle({ fill: hoverTextColor });
    });

    hitZone.on("pointerout", () => {
      background.setFillStyle(bgColor, 0.9);
      text.setStyle({ fill: textColor });
    });

    return { container, background, text, hitZone };
  }

  // 创建菜单并自动布局
  createMenu(menu, setupMenuEvents, options = {}) {
    const buttonOptions = options.button ?? {};
    const gap = options.gap ?? 14;
    const buttonHeight = buttonOptions.height ?? 54;

    // 缓存按钮列表供 layout 使用
    this.menuButtons = [];
    this.menuLayout = { gap, buttonHeight };

    menu.forEach((menuItem) => {
      const button = this.createTextButton(0, 0, menuItem.text, buttonOptions);
      menuItem.button = button;
      this.menuButtons.push(button.container);
      setupMenuEvents(menuItem, button);
    });

    this.layoutMenu();
  }

  // 根据数量与间距垂直居中布局菜单
  layoutMenu() {
    if (!this.menuButtons || this.menuButtons.length === 0) return;
    const gap = this.menuLayout?.gap ?? 14;
    const buttonHeight = this.menuLayout?.buttonHeight ?? this.lineHeight;
    const totalHeight =
      this.menuButtons.length * buttonHeight +
      (this.menuButtons.length - 1) * gap;
    const startY =
      this.screenCenter[1] - totalHeight / 2 + buttonHeight / 2;

    this.menuButtons.forEach((button, index) => {
      button.setPosition(
        Math.round(this.screenCenter[0]),
        Math.round(startY + index * (buttonHeight + gap))
      );
    });
  }

  // 让背景覆盖虚拟画布尺寸
  updateBackgroundSize() {
    if (!this.background) return;
    this.background.setPosition(
      this.virtualWidth / 2,
      this.virtualHeight / 2
    );
    this.background.setDisplaySize(this.virtualWidth, this.virtualHeight);
  }

  // 计算自适应缩放比例
  getFitZoom() {
    const width = this.scale.width || this.virtualWidth;
    const height = this.scale.height || this.virtualHeight;
    return Math.min(width / this.virtualWidth, height / this.virtualHeight);
  }

  // 应用相机缩放与视口裁剪
  applyCameraLayout() {
    if (!this.cameras?.main) return;
    const zoom = this.getFitZoom();
    const viewWidth = this.virtualWidth * zoom;
    const viewHeight = this.virtualHeight * zoom;
    const offsetX = (this.scale.width - viewWidth) / 2;
    const offsetY = (this.scale.height - viewHeight) / 2;

    this.cameras.main.setZoom(zoom);
    this.cameras.main.setViewport(offsetX, offsetY, viewWidth, viewHeight);
    this.cameras.main.centerOn(
      this.virtualWidth / 2,
      this.virtualHeight / 2
    );
  }

  // 窗口缩放事件处理
  handleResize(gameSize) {
    this.applyCameraLayout();

    // 返回按钮位置更新
    if (this.backButton) {
      this.backButton.setPosition(
        this.virtualWidth - 10,
        this.virtualHeight - 10
      );
    }

    // 钱包 UI 根据当前地址重新布局
    if (this.updateAccountDisplay) {
      this.updateAccountDisplay(this.currentAccount);
    }

    // 菜单重新布局
    this.layoutMenu();

    // 子类自定义响应
    if (typeof this.onResize === "function") {
      this.onResize(this.virtualWidth, this.virtualHeight, this.getFitZoom());
    }
  }

  // 右上角钱包状态显示
  createAccountDisplay() {
    const padding = 6;
    const buttonPaddingX = 10;
    const buttonPaddingY = 4;
    const topRightX = this.virtualWidth - 12;
    const topRightY = 12;

    // 地址背景
    this.accountBg = this.add
      .rectangle(topRightX, topRightY, 10, 10, 0x000000, 0.45)
      .setOrigin(1, 0)
      .setDepth(10)
      .setVisible(false);

    this.accountText = this.add
      .text(topRightX - padding, topRightY + padding, "", {
        fontSize: "12px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(1, 0)
      .setDepth(11)
      .setVisible(false);

    this.disconnectBg = this.add
      .rectangle(topRightX, topRightY, 10, 10, 0x000000, 0.45)
      .setOrigin(1, 0)
      .setDepth(10)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // 断开按钮文字
    this.disconnectText = this.add
      .text(topRightX, topRightY, "断开连接", {
        fontSize: "12px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(1, 0)
      .setDepth(11)
      .setVisible(false);

    // 断开按钮 hover 效果
    this.disconnectBg.on("pointerover", () => {
      if (!this.disconnectBg.visible) return;
      this.disconnectBg.setFillStyle(0x333333, 0.6);
      this.disconnectText.setStyle({ fill: "#ff0" });
    });

    this.disconnectBg.on("pointerout", () => {
      this.disconnectBg.setFillStyle(0x000000, 0.45);
      this.disconnectText.setStyle({ fill: "#fff" });
    });

    // 断开按钮点击事件
    this.disconnectBg.on("pointerup", () => {
      if (typeof window !== "undefined" && window.__walletDisconnect) {
        window.__walletDisconnect();
      }
    });

    // 连接按钮背景
    this.connectBg = this.add
      .rectangle(topRightX, topRightY, 10, 10, 0x000000, 0.45)
      .setOrigin(1, 0)
      .setDepth(10)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // 连接按钮文字
    this.connectText = this.add
      .text(topRightX, topRightY, "连接钱包", {
        fontSize: "12px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(1, 0)
      .setDepth(11)
      .setVisible(false);

    // 连接按钮 hover 效果
    this.connectBg.on("pointerover", () => {
      if (!this.connectBg.visible) return;
      this.connectBg.setFillStyle(0x333333, 0.6);
      this.connectText.setStyle({ fill: "#ff0" });
    });

    this.connectBg.on("pointerout", () => {
      this.connectBg.setFillStyle(0x000000, 0.45);
      this.connectText.setStyle({ fill: "#fff" });
    });

    // 连接按钮点击事件
    this.connectBg.on("pointerup", async () => {
      if (typeof window !== "undefined" && window.__walletConnect) {
        try {
          await window.__walletConnect();
        } catch (error) {
          // 忽略用户拒绝或连接失败
        }
      }
    });

    // 根据地址状态更新 UI
    const updateDisplay = (address) => {
      this.currentAccount = address || null;
      if (!address) {
        this.accountBg.setVisible(false);
        this.accountText.setVisible(false);
        this.disconnectBg.setVisible(false);
        this.disconnectText.setVisible(false);
        this.connectBg.setVisible(true);
        this.connectText.setVisible(true);
        // 连接按钮尺寸与位置
        const buttonWidth = this.connectText.width + buttonPaddingX * 2;
        const buttonHeight = this.connectText.height + buttonPaddingY * 2;
        this.connectBg.setPosition(topRightX, topRightY);
        this.connectBg.setSize(buttonWidth, buttonHeight);
        this.connectText.setPosition(
          topRightX - buttonPaddingX,
          topRightY + buttonPaddingY
        );
        return;
      }

      // 已连接：显示地址
      const label = `钱包：${formatAddress(address)}`;
      this.accountText.setText(label);

      const width = this.accountText.width + padding * 2;
      const height = this.accountText.height + padding * 2;
      this.accountBg.setPosition(topRightX, topRightY);
      this.accountText.setPosition(topRightX - padding, topRightY + padding);
      this.accountBg.setSize(width, height);
      this.accountBg.setVisible(true);
      this.accountText.setVisible(true);

      // 如果场景要求隐藏断开按钮，则直接隐藏并返回
      if (this.config.hideDisconnect) {
        this.disconnectBg.setVisible(false);
        this.disconnectText.setVisible(false);
        this.connectBg.setVisible(false);
        this.connectText.setVisible(false);
        return;
      }

      // 断开按钮尺寸与位置
      const buttonWidth = this.disconnectText.width + buttonPaddingX * 2;
      const buttonHeight = this.disconnectText.height + buttonPaddingY * 2;
      const buttonY = topRightY + height + 6;
      this.disconnectBg.setPosition(topRightX, buttonY);
      this.disconnectBg.setSize(buttonWidth, buttonHeight);
      this.disconnectText.setPosition(
        topRightX - buttonPaddingX,
        buttonY + buttonPaddingY
      );
      this.disconnectBg.setVisible(true);
      this.disconnectText.setVisible(true);

      this.connectBg.setVisible(false);
      this.connectText.setVisible(false);
    };

    this.updateAccountDisplay = updateDisplay;

    // 初始化钱包状态
    getConnectedAccount()
      .then((address) => updateDisplay(address))
      .catch(() => updateDisplay(null));

    // 监听钱包状态变化
    this.accountUnsubscribe = onAccountChanged((address) => {
      updateDisplay(address);
    });

    // 场景销毁时取消订阅
    this.events.once("shutdown", () => {
      if (this.accountUnsubscribe) {
        this.accountUnsubscribe();
      }
    });
  }

  // 解除浏览器自动播放限制（首次交互后解锁音频）
  ensureAudioUnlocked() {
    if (!this.game?.registry || this.game.registry.get("audioUnlocked")) {
      return;
    }

    const unlock = () => {
      if (this.game.registry.get("audioUnlocked")) return;
      if (this.sound?.context?.state === "suspended") {
        this.sound.context.resume();
      }
      // 标记为已解锁，避免重复触发
      this.game.registry.set("audioUnlocked", true);
      // 解锁后立即同步背景音乐状态
      syncBgm(this, loadSettings());
    };

    // 监听首次点击或按键
    this.input.once("pointerdown", unlock);
    this.input.keyboard?.once("keydown", unlock);
  }
}

export default BaseScene;
