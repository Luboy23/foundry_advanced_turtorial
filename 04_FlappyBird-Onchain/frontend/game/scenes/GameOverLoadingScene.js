// 游戏结束等待场景：等待用户完成钱包签名后再进入 GameOver。
import BaseScene from "./BaseScene";
import { submitScore, waitForReceipt } from "../chain/scoreboardClient";

class GameOverLoadingScene extends BaseScene {
  constructor(config) {
    super("GameOverLoadingScene", config);
  }

  create(data) {
    // 接收成绩数据
    this.score = data?.score ?? 0;
    this.bestScore = data?.bestScore ?? 0;
    // 结算等待时间（毫秒）
    this.settleDelayMs = data?.settleDelayMs ?? 800;
    // 状态标记，防止重复提交
    this.isSubmitting = false;
    this.hasSubmitted = false;
    this.isSettling = true;

    // 与主场景一致的缩放/居中
    if (this.cameras?.main) {
      this.cameras.main.roundPixels = true;
      this.applyCameraLayout();
    }

    // 监听窗口尺寸变化
    this.scale.on("resize", this.handleResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.handleResize, this);
    });

    // 半透明遮罩层
    this.add
      .rectangle(
        0,
        0,
        this.virtualWidth,
        this.virtualHeight,
        0x000000,
        0.6
      )
      .setOrigin(0);
    // 左下角作者信息
    this.createAuthorSignature();

    // 加载提示文案
    this.loadingText = this.add
      .text(this.screenCenter[0], this.screenCenter[1] - 10, "正在结算中", {
        ...this.fontOptions,
        fontSize: "30px",
      })
      .setOrigin(0.5);

    // 提示用户在钱包中确认
    this.tipText = this.add
      .text(this.screenCenter[0], this.screenCenter[1] + 30, "正在结算，请稍候", {
        fontSize: "16px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0.5);

    // 失败时提供“重新签名”入口
    this.retryText = this.add
      .text(this.screenCenter[0], this.screenCenter[1] + 60, "点击重新签名", {
        fontSize: "16px",
        fill: "#ff0",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.retryText.on("pointerup", () => {
      this.attemptSubmit();
    });

    // 加载中的“...”动画
    this.dotCount = 0;
    this.dotsTimer = this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        this.dotCount = (this.dotCount + 1) % 4;
        const dots = ".".repeat(this.dotCount);
        const baseText = this.isSettling ? "正在结算中" : "等待签名中";
        this.loadingText.setText(`${baseText}${dots}`);
      },
    });

    this.events.once("shutdown", () => {
      this.dotsTimer?.remove();
    });

    // 先显示结算遮罩，再进入签名流程
    this.time.delayedCall(this.settleDelayMs, () => {
      if (!this.scene.isActive()) return;
      this.isSettling = false;
      this.loadingText.setText("等待签名中");
      this.tipText.setText("请在钱包中确认");
      // 启动提交流程
      this.attemptSubmit();
    });
  }

  // 提交分数并等待签名完成
  async attemptSubmit() {
    if (this.isSubmitting || this.hasSubmitted) return;
    this.isSubmitting = true;
    this.retryText.setVisible(false);
    this.tipText.setText("请在钱包中确认");

    let result = null;
    try {
      result = await submitScore(this.score);
    } catch (error) {
      result = { status: "error", error };
    }

    this.isSubmitting = false;

    // 签名成功 -> 进入 GameOverScene
    if (result?.status === "submitted" && result.hash) {
      this.hasSubmitted = true;
      this.scene.stop();
      this.scene.launch("GameOverScene", {
        score: this.score,
        bestScore: this.bestScore,
        submitStatus: result.status,
      });
      // 交易确认后刷新排行榜
      waitForReceipt(result.hash)
        .then(() => {
          window.dispatchEvent(new Event("scoreboard:refresh"));
        })
        .catch(() => null);
      return;
    }

    // 失败时展示原因并允许重试
    this.setFailureMessage(result?.status);
  }

  // 根据失败原因提示用户
  setFailureMessage(status) {
    let message = "签名未完成，请点击重新签名";
    if (status === "no_wallet") {
      message = "未检测到钱包，请安装或启用钱包后重试";
    } else if (status === "no_account") {
      message = "钱包未连接，请连接后重试";
    } else if (status === "wrong_network") {
      message = "网络错误，请切换到 Anvil 后重试";
    } else if (status === "disabled") {
      message = "合约未配置，暂无法提交";
    }

    this.tipText.setText(message);
    this.retryText.setVisible(true);
  }
}

export default GameOverLoadingScene;
