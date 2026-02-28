// 主菜单场景：入口、排行榜与设置，同时控制“必须连接钱包才能开始游戏”的逻辑。
import BaseScene from "./BaseScene";
import { getConnectedAccount, onAccountChanged } from "../chain/accountClient";

class MenuScene extends BaseScene {
  constructor(config) {
    super("MenuScene", config);

    // 菜单项配置
    this.menu = [
      { scene: "PlayScene", text: "开始游戏" },
      { scene: "ScoreScene", text: "排行榜" },
      { scene: "SettingsScene", text: "设置" },
    ];
  }

  // 创建场景并挂载菜单
  create(data) {
    super.create();
    this.createMenu(this.menu, this.setUpMenuEvents.bind(this), {
      button: { width: 260, height: 58, fontSize: "28px" },
      gap: 16,
    });
    // 钱包提示与门禁逻辑
    this.createWalletHint();
    this.initWalletGate();
    if (data?.walletRequired) {
      this.showWalletHint("请先连接钱包后开始游戏");
    }
  }

  // 绑定菜单按钮事件
  setUpMenuEvents(menuItem, button) {
    if (menuItem.scene === "PlayScene") {
      // 开始游戏按钮：要求钱包已连接
      this.startButton = button;
      button.hitZone.on("pointerup", () => {
        if (!this.isWalletConnected) {
          this.showWalletHint("请先连接钱包后开始游戏");
          return;
        }
        this.scene.start(menuItem.scene);
      });
      return;
    }

    // 其他按钮直接切场景
    button.hitZone.on("pointerup", () => {
      menuItem.scene && this.scene.start(menuItem.scene);
    });
  }

  // 创建底部提示文字（用于提示连接钱包）
  createWalletHint() {
    this.walletHint = this.add
      .text(this.screenCenter[0], this.virtualHeight - 36, "", {
        fontSize: "16px",
        fill: "#ff0",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  // 初始化钱包状态监听与按钮可用性
  initWalletGate() {
    const updateState = (address) => {
      this.isWalletConnected = Boolean(address);
      if (this.startButton) {
        // 未连接时降低按钮透明度
        const alpha = this.isWalletConnected ? 1 : 0.7;
        this.startButton.container.setAlpha(alpha);
      }
      if (this.isWalletConnected && this.walletHint?.visible) {
        this.walletHint.setVisible(false);
      }
    };

    // 初始读取钱包状态
    getConnectedAccount()
      .then(updateState)
      .catch(() => updateState(null));

    // 订阅钱包状态变化
    this.walletUnsubscribe = onAccountChanged((address) => {
      updateState(address);
    });

    // 场景销毁时取消订阅
    this.events.once("shutdown", () => {
      if (this.walletUnsubscribe) {
        this.walletUnsubscribe();
      }
    });
  }

  // 显示短提示，并自动隐藏
  showWalletHint(message) {
    if (!this.walletHint) return;
    this.walletHint.setText(message);
    this.walletHint.setVisible(true);
    if (this.walletHintTimer) {
      this.walletHintTimer.remove();
    }
    this.walletHintTimer = this.time.delayedCall(2000, () => {
      this.walletHint?.setVisible(false);
    });
  }
}

export default MenuScene;
