// 排行榜场景：展示链上 Top10 及最高分。
import BaseScene from "./BaseScene";
import { fetchLeaderboard, isContractReady } from "../chain/scoreboardClient";

// 排行榜展示数量
const MAX_ENTRIES = 10;

class ScoreScene extends BaseScene {
  constructor(config) {
    // canGoBack=true：显示返回菜单按钮
    super("ScoreScene", { ...config, canGoBack: true });
    this.isRefreshing = false;
    this.refreshQueued = false;
    this.isShuttingDown = false;
  }

  // 场景创建入口
  create() {
    super.create();
    this.createLeaderboardPanel();
    // 监听外部刷新事件（例如游戏结束上链后）
    this.onScoreboardRefresh = () => {
      this.refreshLeaderboard();
    };
    window.addEventListener("scoreboard:refresh", this.onScoreboardRefresh);
  }

  // 构建排行榜面板与文本
  createLeaderboardPanel() {
    const panelWidth = 360;
    const panelHeight = 360;
    const panelX = (this.config.width - panelWidth) / 2;
    const panelY = (this.config.height - panelHeight) / 2 - 10;
    const lineHeight = 22;
    const paddingX = 18;
    const headerY = panelY + 16;

    // 面板背景
    const panel = this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x111111, 0.7)
      .setOrigin(0);

    panel.setStrokeStyle(2, 0xffffff, 0.6);

    // 标题
    this.add
      .text(panelX + paddingX, headerY, `排行榜（前${MAX_ENTRIES}）`, {
        fontSize: "18px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0);

    // 状态提示（加载中/错误）
    this.leaderboardStatus = this.add
      .text(panelX + paddingX, headerY + 26, "", {
        fontSize: "14px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0);

    // 排行榜条目
    this.leaderboardEntries = [];
    for (let i = 0; i < MAX_ENTRIES; i += 1) {
      const text = this.add
        .text(panelX + paddingX, headerY + 52 + i * lineHeight, "", {
          fontSize: "14px",
          fill: "#fff",
          fontFamily: this.fontFamily,
          padding: this.textPadding,
        })
        .setOrigin(0);
      this.leaderboardEntries.push(text);
    }

    // 最高分显示
    this.bestText = this.add
      .text(panelX + paddingX, panelY + panelHeight - 40, "最高分：-", {
        fontSize: "16px",
        fill: "#fff",
        fontFamily: this.fontFamily,
        padding: this.textPadding,
      })
      .setOrigin(0);

    // 立即拉取一次数据，并启动定时刷新
    this.refreshLeaderboard();
    this.leaderboardTimer = this.time.addEvent({
      delay: 8000,
      loop: true,
      callback: this.refreshLeaderboard,
      callbackScope: this,
    });

    // 场景退出时清理定时器
    this.events.once("shutdown", () => {
      this.isShuttingDown = true;
      this.leaderboardTimer?.remove();
      if (this.onScoreboardRefresh) {
        window.removeEventListener(
          "scoreboard:refresh",
          this.onScoreboardRefresh
        );
      }
    });
  }

  // 拉取链上排行榜并更新 UI
  async refreshLeaderboard() {
    if (this.isShuttingDown) {
      return;
    }
    if (this.isRefreshing) {
      this.refreshQueued = true;
      return;
    }
    this.isRefreshing = true;
    if (!isContractReady) {
      this.leaderboardStatus.setText("请设置 VITE_FLAPPY_SCORE_ADDRESS");
      this.leaderboardEntries.forEach((text) => text.setText(""));
      this.bestText.setText("最高分：-");
      this.isRefreshing = false;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        this.refreshLeaderboard();
      }
      return;
    }

    try {
      this.leaderboardStatus.setText("加载中...");
      const leaderboard = await fetchLeaderboard();
      const entries = leaderboard.slice(0, MAX_ENTRIES);

      if (entries.length === 0) {
        this.leaderboardStatus.setText("暂无链上分数。");
        this.leaderboardEntries.forEach((text) => text.setText(""));
        this.bestText.setText("最高分：-");
        return;
      }

      this.leaderboardStatus.setText("");
      entries.forEach((entry, index) => {
        const address = entry.player
          ? `${entry.player.slice(0, 6)}...${entry.player.slice(-4)}`
          : "";
        this.leaderboardEntries[index].setText(
          `第${index + 1}名 ${address} 分数：${Number(entry.score)}`
        );
      });

      // 清空不足 10 条的剩余行
      for (let i = entries.length; i < MAX_ENTRIES; i += 1) {
        this.leaderboardEntries[i].setText("");
      }

      // 默认取榜首作为最高分
      const bestScore =
        entries.length > 0 && typeof entries[0].score !== "undefined"
          ? Number(entries[0].score)
          : "-";
      this.bestText.setText(`最高分：${bestScore}`);
    } catch (error) {
      this.leaderboardStatus.setText("链上分数加载失败。");
    } finally {
      this.isRefreshing = false;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        this.refreshLeaderboard();
      }
    }
  }
}

export default ScoreScene;
