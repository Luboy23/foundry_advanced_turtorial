// React 宿主组件：负责创建 Phaser 游戏实例并挂载到 DOM。
import FlappyBirdGame from "../game/gamecore.js";
import React, { useEffect } from "react";

const FlappyBird = ({ onGameOver }) => {
  // 监听游戏结束事件（由 Phaser 主循环抛出）
  useEffect(() => {
    if (!onGameOver) return undefined;
    const handleGameOver = (event) => {
      const score = event?.detail?.score ?? 0;
      const endedAt = event?.detail?.endedAt ?? Date.now();
      onGameOver({ score, endedAt });
    };

    window.addEventListener("game:over", handleGameOver);
    return () => window.removeEventListener("game:over", handleGameOver);
  }, [onGameOver]);

  // 初始化 Phaser 实例，并在组件卸载时销毁
  useEffect(() => {
    const game = new FlappyBirdGame("game-container");

    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div
      id="game-container"
      style={{
        // 使用绝对定位 + transform 将画布居中
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        zIndex: 1,
      }}
    ></div>
  );
};

export default FlappyBird;
