// 游戏主场景：负责游戏循环、碰撞检测、分数、难度与输入处理。
import BaseScene from "./BaseScene";
import { playSfx } from "../audio/audioManager";
import { getDifficultyMode, loadSettings } from "../state/settings";

// 同时渲染的管道组数
const PIPES_TO_RENDER = 4;

class PlayScene extends BaseScene {
  constructor(config) {
    // hideDisconnect=true：游戏过程中隐藏断开按钮
    super("PlayScene", { ...config, hideDisconnect: true });

    // 游戏对象引用
    this.bird = null;
    this.pipes = null;
    // 暂停状态
    this.isPaused = false;

    // 拍翅膀向上的速度
    this.flapVelocity = 350;

    // 分数相关
    this.score = 0;
    this.scoreText = "";

    // 难度配置与区间
    this.currentDifficulty = "easy";
    this.difficulties = {
      easy: {
        pipeVerticalOpeningRange: [150, 250],
        pipeHorizontalDistanceRange: [400, 450],
      },
      normal: {
        pipeVerticalOpeningRange: [140, 190],
        pipeHorizontalDistanceRange: [350, 400],
      },
      hard: {
        pipeVerticalOpeningRange: [100, 150],
        pipeHorizontalDistanceRange: [300, 350],
      },
    };
    // 管道速度（像素/秒）
    this.pipeSpeedByDifficulty = {
      easy: 360,
      normal: 400,
      hard: 440,
    };
    // 自适应模式达到最大难度的分数阈值
    this.adaptiveMaxScore = 60;
    // 自适应的微扰动范围
    this.openJitter = 5;
    this.distJitter = 8;
  }

  // 场景初始化
  create() {
    // 读取设置并确定难度模式
    const settings = loadSettings();
    this.difficultyMode = getDifficultyMode(settings);
    this.currentDifficulty =
      this.difficultyMode === "auto" ? "auto" : this.difficultyMode;
    this.hasGameEnded = false;
    // 继承 BaseScene 的初始化（背景、账户显示、缩放等）
    super.create();
    // 保留 settings，供音效控制使用
    this.settings = this.settings || settings;
    // 设置物理世界边界
    this.physics.world.setBounds(0, 0, this.config.width, this.config.height);
    // 初始化核心元素
    this.createBird();
    this.createRandomBird();
    this.createPipes();
    this.createColliders();
    this.createScore();
    this.createPause();
    this.handleInputs();
    this.listenEvents();
    this.events.once("shutdown", () => {
      this.input.off("pointerdown", this.flap, this);
      if (this.spaceKey) {
        this.spaceKey.off("down", this.flap, this);
        this.spaceKey.destroy();
        this.spaceKey = null;
      }
    });

    // 播放飞行动画
    this.bird.play("fly");

  }

  // 主循环：每帧检查状态与回收管道
  update() {
    this.checkGameStatus();
    this.checkScore();
    this.recyclePipes();
  }

  // 检测触顶/触底导致的游戏结束
  checkGameStatus() {
    const birdBounds = this.bird.getBounds();
    if (
      birdBounds.bottom >= this.config.height ||
      birdBounds.top <= 0
    ) {
      this.gameOver();
    }
  }


  // 创建小鸟角色与物理属性
  createBird() {
    this.bird = this.physics.add
      .sprite(this.config.startPosition.x, this.config.startPosition.y, "bird")
      .setScale(3)
      .setOrigin(0);

    // 调整碰撞盒与重力
    this.bird.setBodySize(this.bird.width, this.bird.height - 8);
    this.bird.body.gravity.y = 800;
    this.bird.setCollideWorldBounds();
  }

  // 创建管道组并放置到初始位置
  createPipes() {
    this.pipes = this.physics.add.group();

    for (let i = 0; i < PIPES_TO_RENDER; i++) {
      const upperPipe = this.pipes
        .create(0, 0, "pipe")
        .setImmovable(true)
        .setFlipY(true)
        .setScale(1.5)
        .setOrigin(0, 1);
      const lowerPipe = this.pipes
        .create(0, 0, "pipe")
        .setImmovable(true)
        .setScale(1.5)
        .setOrigin(0, 0);

      upperPipe.isUpper = true;
      lowerPipe.isUpper = false;

      this.placePipe(upperPipe, lowerPipe);
    }

    // 管道向左移动速度
    this.updatePipeSpeed();
  }

  // 设置碰撞：鸟与管道碰撞即游戏结束
  createColliders() {
    this.physics.add.collider(this.bird, this.pipes, this.gameOver, null, this);
  }

  // 初始化分数显示
  createScore() {
    this.score = 0;
    this.scoreText = this.add.text(16, 16, `分数：${0}`, {
      fontSize: "32px",
      fill: "#000",
      fontFamily: this.fontFamily,
      padding: this.textPadding,
    });
  }
  // 创建暂停按钮
  createPause() {
    this.isPaused = false;
    this.pauseButton = this.add
      .image(this.config.width - 10, this.config.height - 10, "pause")
      .setScale(3)
      .setOrigin(1)
      .setInteractive();

    // 点击暂停：暂停物理并进入 PauseScene
    this.pauseButton.on("pointerdown", () => {
      this.isPaused = true;

      this.physics.pause();
      this.scene.pause();
      this.scene.launch("PauseScene");
    });
  }

  // 随机选择小鸟动画帧
  createRandomBird() {
    if (this.anims.exists && this.anims.exists("fly")) {
      this.anims.remove("fly");
    }
    const birdTypes = [
      { start: 0, end: 3 }, // 第一种鸟
      { start: 4, end: 7 }, // 第二种鸟
      { start: 8, end: 11 }, // 第三种鸟
      { start: 12, end: 15 }, // 第四种鸟
      { start: 16, end: 19 }, // 第五种鸟
      { start: 20, end: 23 }, // 第六种鸟
      { start: 24, end: 27 }, // 第七种鸟
    ];

    // 随机取一个鸟的帧区间
    const randomIndex = Phaser.Math.Between(0, birdTypes.length - 1);
    const selectedBirdType = birdTypes[randomIndex];
    
    // 创建飞行动画
    this.anims.create({
      key: "fly",
      frames: this.anims.generateFrameNumbers("bird", {
        start: selectedBirdType.start,
        end: selectedBirdType.end,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }

  // 绑定输入：鼠标点击或空格键起飞
  handleInputs() {
    this.input.on("pointerdown", this.flap, this);
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.spaceKey.on("down", this.flap, this);
  }

  // 放置一对上下管道（基于难度与自适应规则）
  placePipe(uPipe, lPipe) {
    const rightMostX = this.getRIghtMostPipe();

    // 计算当前难度的范围
    const ranges = this.getDifficultyRanges();
    let pipeVerticalDistance = Phaser.Math.Between(
      Math.round(ranges.openMin),
      Math.round(ranges.openMax)
    );
    let pipeHorizontalDistance = Phaser.Math.Between(
      Math.round(ranges.distMin),
      Math.round(ranges.distMax)
    );

    // 自适应模式加入轻微扰动，避免机械感
    if (this.difficultyMode === "auto") {
      pipeVerticalDistance = this.clamp(
        pipeVerticalDistance +
          Phaser.Math.Between(-this.openJitter, this.openJitter),
        this.difficulties.hard.pipeVerticalOpeningRange[0],
        this.difficulties.easy.pipeVerticalOpeningRange[1]
      );
      pipeHorizontalDistance = this.clamp(
        pipeHorizontalDistance +
          Phaser.Math.Between(-this.distJitter, this.distJitter),
        this.difficulties.hard.pipeHorizontalDistanceRange[0],
        this.difficulties.easy.pipeHorizontalDistanceRange[1]
      );
    }

    // 在可视高度范围内随机管道位置
    const pipeVerticalPosition = Phaser.Math.Between(
      20,
      this.config.height - 20 - pipeVerticalDistance
    );

    // 上管道位置
    uPipe.x = rightMostX + pipeHorizontalDistance;
    uPipe.y = pipeVerticalPosition;

    // 下管道位置（上管道 + 开口距离）
    lPipe.x = uPipe.x;
    lPipe.y = uPipe.y + pipeVerticalDistance;

    // 重置计分标记
    uPipe.scored = false;
    lPipe.scored = false;
  }
  recyclePipes() {
    const tempPipes = [];

    this.pipes.getChildren().forEach((pipe) => {
      // 当管道离开左边界时回收并重用
      if (pipe.getBounds().right < 0) {
        tempPipes.push(pipe);
        if (tempPipes.length === 2) {
          // 上下管道成对回收后重新放置
          const upperPipe = tempPipes.find((p) => p.isUpper);
          const lowerPipe = tempPipes.find((p) => !p.isUpper);
          if (upperPipe && lowerPipe) {
            this.placePipe(upperPipe, lowerPipe);
          }
          tempPipes.length = 0;
        }
      }
    });
  }

  // 当小鸟通过管道时加分
  checkScore() {
    if (this.hasGameEnded || this.isPaused) {
      return;
    }
    const birdBounds = this.bird.getBounds();
    this.pipes.getChildren().forEach((pipe) => {
      if (!pipe.isUpper || pipe.scored) {
        return;
      }
      if (pipe.getBounds().right < birdBounds.left) {
        pipe.scored = true;
        this.increaseScore();
        this.saveBestScore();
      }
    });
  }

  // 监听从 PauseScene 恢复时的倒计时
  listenEvents() {
    if (this.pauseEvent) {
      return;
    }
    this.pauseEvent = this.events.on("resume", () => {
      if (this.timeEvent) {
        this.timeEvent.remove();
        this.timeEvent = null;
      }
      if (this.countDownText) {
        this.countDownText.destroy();
        this.countDownText = null;
      }
      // 恢复时给玩家 3 秒准备
      this.initialTime = 3;
      this.countDownText = this.add
        .text(
          ...this.screenCenter,
          "起飞倒计时：" + this.initialTime,
          this.fontOptions
        )
        .setOrigin(0.5);
      this.timeEvent = this.time.addEvent({
        delay: 1000,
        callback: this.countDown,
        callbackScope: this,
        loop: true,
      });
    });
  }

  // 倒计时逻辑：结束后恢复物理
  countDown() {
    this.initialTime--;
    this.countDownText.setText("起飞倒计时：" + this.initialTime);
    if (this.initialTime <= 0) {
      this.isPaused = false;
      if (this.countDownText) {
        this.countDownText.destroy();
        this.countDownText = null;
      }
      this.physics.resume();
      if (this.timeEvent) {
        this.timeEvent.remove();
        this.timeEvent = null;
      }
    }
  }

  // 获取当前最右侧管道的 X 位置
  getRIghtMostPipe() {
    let rightMostX = 0;

    this.pipes.getChildren().forEach((pipe) => {
      rightMostX = Math.max(pipe.getBounds().right, rightMostX);
    });

    return rightMostX;
  }

  // 根据当前分数/难度模式计算管道范围
  getDifficultyRanges() {
    if (this.difficultyMode !== "auto") {
      const difficulty = this.difficulties[this.currentDifficulty];
      return {
        openMin: difficulty.pipeVerticalOpeningRange[0],
        openMax: difficulty.pipeVerticalOpeningRange[1],
        distMin: difficulty.pipeHorizontalDistanceRange[0],
        distMax: difficulty.pipeHorizontalDistanceRange[1],
      };
    }

    // 自适应：将 score 映射到 0~1，并使用 smoothstep 平滑过渡
    const t = this.clamp(this.score / this.adaptiveMaxScore, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    const easy = this.difficulties.easy;
    const hard = this.difficulties.hard;

    // 在 easy 与 hard 之间插值
    return {
      openMin: this.lerp(
        easy.pipeVerticalOpeningRange[0],
        hard.pipeVerticalOpeningRange[0],
        smooth
      ),
      openMax: this.lerp(
        easy.pipeVerticalOpeningRange[1],
        hard.pipeVerticalOpeningRange[1],
        smooth
      ),
      distMin: this.lerp(
        easy.pipeHorizontalDistanceRange[0],
        hard.pipeHorizontalDistanceRange[0],
        smooth
      ),
      distMax: this.lerp(
        easy.pipeHorizontalDistanceRange[1],
        hard.pipeHorizontalDistanceRange[1],
        smooth
      ),
    };
  }

  // 根据难度与分数计算管道速度
  getPipeSpeed() {
    if (this.difficultyMode !== "auto") {
      return (
        this.pipeSpeedByDifficulty[this.currentDifficulty] ??
        this.pipeSpeedByDifficulty.normal
      );
    }

    // 自适应：分数越高，速度越快
    const t = this.clamp(this.score / this.adaptiveMaxScore, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    return this.lerp(
      this.pipeSpeedByDifficulty.easy,
      this.pipeSpeedByDifficulty.hard,
      smooth
    );
  }

  // 更新所有管道速度
  updatePipeSpeed() {
    if (!this.pipes || this.isPaused || this.hasGameEnded) {
      return;
    }
    this.pipes.setVelocityX(-this.getPipeSpeed());
  }

  // 线性插值工具
  lerp(start, end, t) {
    return start + (end - start) * t;
  }

  // 数值夹紧工具
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // 保存本地最高分
  saveBestScore() {
    const bestScoreText = localStorage.getItem("bestScore");
    const bestScore = bestScoreText && parseInt(bestScoreText, 10);

    if (!bestScore || this.score > bestScore) {
      localStorage.setItem("bestScore", this.score);
      if (this.bestScoreText) {
        this.bestScoreText.setText(`最高分：${this.score}`);
      }
    }
  }

  // 触发游戏结束流程
  gameOver() {
    if (this.hasGameEnded) {
      return;
    }
    this.hasGameEnded = true;
    // 播放死亡音效并暂停物理
    playSfx(this, "sfxHit", { settings: this.settings, volume: 0.7 });
    this.physics.pause();
    this.bird.setTint(0xee4824);

    // 更新本地最高分并通知外部
    this.saveBestScore();
    window.dispatchEvent(
      new CustomEvent("game:over", {
        detail: { score: this.score, endedAt: Date.now() },
      })
    );
    // 进入等待签名界面（签名完成才显示 GameOver 选项）
    const bestScoreText = localStorage.getItem("bestScore");
    const bestScore = bestScoreText && parseInt(bestScoreText, 10);
    this.scene.pause();
    this.scene.launch("GameOverLoadingScene", {
      score: this.score,
      bestScore: bestScore || 0,
    });
    this.scene.bringToTop("GameOverLoadingScene");
  }

  // 鸟起飞逻辑（点击/空格触发）
  flap() {
    if (this.isPaused || this.hasGameEnded) {
      return;
    }
    this.bird.body.velocity.y = -this.flapVelocity;
    playSfx(this, "sfxFlap", { settings: this.settings, volume: 0.4 });
  }

  // 加分并更新文本
  increaseScore() {
    this.score += 1;
    this.scoreText.setText(`分数：${this.score}`);
    playSfx(this, "sfxScore", { settings: this.settings, volume: 0.5 });
    this.updatePipeSpeed();
  }

  // 响应缩放：更新暂停按钮位置
  onResize(width, height) {
    if (this.pauseButton) {
      this.pauseButton.setPosition(this.config.width - 10, this.config.height - 10);
    }
  }
}

export default PlayScene;
