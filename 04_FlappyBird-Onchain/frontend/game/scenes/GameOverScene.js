// 游戏结束场景：展示得分与操作按钮（重开/菜单/设置）。
import BaseScene from "./BaseScene";
import { fetchLeaderboard, isContractReady } from "../chain/scoreboardClient";

class GameOverScene extends BaseScene {
  constructor(config) {
    super("GameOverScene", config);
    // 用于控制按钮的短暂冷却，避免误触
    this.canInteract = false;
  }

  create(data) {
    // 接收成绩数据
    const score = data?.score ?? 0;
    const submitStatus = data?.submitStatus ?? "";
    this.canInteract = false;

    // 与主场景一致的缩放/居中
    if (this.cameras?.main) {
      this.cameras.main.roundPixels = true;
      this.applyCameraLayout();
    }

    // 监听窗口尺寸变化
    this.scale.on("resize", this.handleResize, this);
    this.events.once("shutdown", () => {
      this.isShuttingDown = true;
      this.scale.off("resize", this.handleResize, this);
      if (this.onScoreboardRefresh) {
        window.removeEventListener(
          "scoreboard:refresh",
          this.onScoreboardRefresh
        );
      }
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

    // 标题与分数显示
    // 统一使用动态布局，避免文本与按钮重叠
    const submitStatusMap = {
      submitted: "链上提交：签名已完成",
      disabled: "链上提交：合约未配置",
      no_wallet: "链上提交：未检测到钱包",
      no_account: "链上提交：钱包未连接",
      error: "链上提交：提交失败",
    };
    const submitLabel = submitStatusMap[submitStatus];

    const titleText = this.add
      .text(0, 0, "游戏结束", {
        ...this.fontOptions,
        fontSize: "40px",
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(0, 0, `得分：${score}`, {
        ...this.fontOptions,
      })
      .setOrigin(0.5);

    const bestText = this.add
      .text(0, 0, "最高分：加载中...", {
        ...this.fontOptions,
      })
      .setOrigin(0.5);
    // 用链上榜首更新最高分（优先链上数据）
    this.isShuttingDown = false;
    this.updateBestScoreFromChain(bestText);
    this.onScoreboardRefresh = () => {
      this.updateBestScoreFromChain(bestText);
    };
    window.addEventListener("scoreboard:refresh", this.onScoreboardRefresh);

    const statusText = submitLabel
      ? this.add
          .text(0, 0, submitLabel, {
            ...this.fontOptions,
            fontSize: "18px",
          })
          .setOrigin(0.5)
      : null;

    // 重新开始：重启 PlayScene
    const restart = () => {
      if (!this.canInteract) return;
      this.canInteract = false;
      const playScene = this.scene.get("PlayScene");
      if (playScene?.anims?.exists && playScene.anims.exists("fly")) {
        playScene.anims.remove("fly");
      }
      this.scene.stop("PlayScene");
      this.scene.start("PlayScene");
      this.scene.stop();
    };

    // 返回主菜单
    const goMenu = () => {
      if (!this.canInteract) return;
      this.canInteract = false;
      this.scene.stop("PlayScene");
      this.scene.start("MenuScene");
      this.scene.stop();
    };

    // 进入设置
    const goSettings = () => {
      if (!this.canInteract) return;
      this.canInteract = false;
      this.scene.stop("PlayScene");
      this.scene.start("SettingsScene");
      this.scene.stop();
    };

    // 创建按钮（统一样式）
    const startButton = this.createTextButton(0, 0, "重新开始", {
      width: 260,
      height: 58,
      fontSize: "26px",
      bgColor: 0x2a5b2a,
      hoverBgColor: 0x3a7a3a,
    });

    const menuButton = this.createTextButton(0, 0, "菜单", {
      width: 260,
      height: 58,
      fontSize: "26px",
    });

    const settingsButton = this.createTextButton(0, 0, "设置", {
      width: 260,
      height: 58,
      fontSize: "26px",
      bgColor: 0x2a2a5b,
      hoverBgColor: 0x3a3a7a,
    });

    const gap = 12;
    const blocks = [titleText, scoreText, bestText];
    if (statusText) {
      blocks.push(statusText);
    }
    const buttons = [startButton, menuButton, settingsButton];

    const textHeights = blocks.map((item) => item.height);
    const buttonHeights = buttons.map((item) => item.background.height);
    const totalTextHeight =
      textHeights.reduce((sum, height) => sum + height, 0) +
      gap * (blocks.length - 1);
    const totalButtonHeight =
      buttonHeights.reduce((sum, height) => sum + height, 0) +
      gap * (buttons.length - 1);
    const totalHeight = totalTextHeight + 18 + totalButtonHeight;
    let cursorY = this.screenCenter[1] - totalHeight / 2;

    blocks.forEach((item) => {
      item.setPosition(this.screenCenter[0], cursorY + item.height / 2);
      cursorY += item.height + gap;
    });

    cursorY += 18;
    buttons.forEach((button) => {
      button.container.setPosition(
        this.screenCenter[0],
        cursorY + button.background.height / 2
      );
      cursorY += button.background.height + gap;
    });

    // 绑定按钮事件（点击命中区域即可触发）
    startButton.hitZone.on("pointerup", restart);
    menuButton.hitZone.on("pointerup", goMenu);
    settingsButton.hitZone.on("pointerup", goSettings);

    // 空格键快速重开
    const onSpace = () => {
      if (!this.canInteract) return;
      this.input.keyboard.off("keydown-SPACE", onSpace);
      restart();
    };

    this.input.keyboard.on("keydown-SPACE", onSpace);

    // 300ms 冷却，防止误触
    this.time.delayedCall(300, () => {
      this.canInteract = true;
    });
  }

  // 拉取链上榜首并更新最高分展示
  async updateBestScoreFromChain(bestText) {
    if (!bestText) return;
    if (!isContractReady) {
      bestText.setText("最高分：暂无数据");
      return;
    }
    try {
      const leaderboard = await fetchLeaderboard();
      if (this.isShuttingDown) return;
      if (!leaderboard || leaderboard.length === 0) {
        bestText.setText("最高分：暂无数据");
        return;
      }
      const topScore = Number(leaderboard[0].score);
      bestText.setText(`最高分：${topScore}`);
    } catch (error) {
      // 链上读取失败时给出提示
      bestText.setText("最高分：暂无数据");
    }
  }
}

export default GameOverScene;
