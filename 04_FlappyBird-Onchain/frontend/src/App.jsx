// 主应用组件：负责组合钱包连接与游戏画布。
import FlappyBird from "../components/FlappyBird";
import WalletConnect from "../components/Web3/WalletConnect";

function App() {
  return (
    // 顶层容器：占满视口并作为 Phaser 画布的承载区域
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* WalletConnect 仅注入连接逻辑（UI 已迁移到 Phaser 内部） */}
      <WalletConnect />
      {/* Phaser 游戏容器 */}
      <FlappyBird />
    </div>
  );
}

export default App;
