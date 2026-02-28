// 暂停场景：提供继续与返回菜单的入口。
import BaseScene from "./BaseScene";

class PauseScene extends BaseScene {
  constructor(config) {
    super("PauseScene", config);

    // 菜单项配置
    this.menu = [
      { scene: "PlayScene", text: "继续", action: "resume" },
      { scene: "MenuScene", text: "返回菜单", action: "exit" },
    ];
  }

  // 创建暂停菜单
  create() {
    super.create();
    this.createMenu(this.menu, this.setUpMenuEvents.bind(this), {
      button: { width: 220, height: 52, fontSize: "24px" },
      gap: 14,
    });
  }

  // 绑定菜单按钮事件
  setUpMenuEvents(menuItem, button) {
    button.hitZone.on("pointerup", () => {
      if (menuItem.scene && menuItem.action === "resume") {
        // 继续：关闭暂停场景并恢复 PlayScene
        this.scene.stop();
        this.scene.resume(menuItem.scene);
      } else {
        // 退出：结束 PlayScene 并回到主菜单
        this.scene.stop("PlayScene");
        this.scene.start(menuItem.scene);
      }
    });
  }
}

export default PauseScene;
