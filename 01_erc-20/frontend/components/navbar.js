// 导入 Next.js 提供的 Link 组件，用于实现页面跳转
import Link from "next/link";
// 导入 Next.js 提供的 Image 组件，用于优化图像加载
import Image from "next/image";
// 导入本地的 Bilibili 图标资源
import BiliBili from "@/public/assets/bilibili.png";
// 导入本地的 GitHub 图标资源
import Github from "@/public/assets/github.png";
// 导入 ethers 库，用于与以太坊区块链进行交互
import { ethers } from "ethers";

// 导出默认组件 Navbar，接收两个 props：accounts（当前连接的账户列表）和 setAccounts（更新账户的方法）
export default function Navbar({ accounts, setAccounts }) {
  // 判断是否已连接账户，若 accounts 数组的第一个元素存在，则表示已连接
  const isConnected = Boolean(accounts[0]);

  // 定义异步函数 connectAccount，用于连接用户的以太坊钱包
  async function connectAccount() {
    try {
      // 检查浏览器是否提供了以太坊对象（window.ethereum），这是与钱包交互的入口
      if (window.ethereum) {
        // 调用以太坊对象的请求方法，请求用户授权并返回账户列表
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        // 更新父组件传递的账户状态
        setAccounts(accounts);
      } else {
        // 如果未检测到以太坊对象，输出错误信息
        console.error("Ethereum provider not found.");
      }
    } catch (e) {
      // 捕获连接失败的异常，并在控制台打印错误信息
      console.error("Failed to connect to accounts:", e);
    }
  }

  // 返回 Navbar 的 JSX 内容
  return (
    <>
      {/* 整体布局为水平排列，使用 TailwindCSS 进行样式控制 */}
      <div className="flex justify-between items-center text-2xl px-8 py-6 font-wq text-white">
        {/* 左侧部分：包含社交媒体的链接与图标 */}
        <div className="flex">
          {/* 链接到哔哩哔哩个人空间 */}
          <Link
            href="https://space.bilibili.com/3493288753498847"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* 图标和文字水平排列 */}
            <div className="flex items-center space-x-2">
              {/* 哔哩哔哩图标 */}
              <Image src={BiliBili} alt="@lllu_23" width={36} height={36} />
              {/* 显示哔哩哔哩用户名 */}
              <span className="text-3xl px-4">@lllu_23</span>
            </div>
          </Link>

          {/* 链接到 GitHub 个人仓库 */}
          <Link
            href="https://github.com/Luboy23"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* 图标和文字水平排列 */}
            <div className="flex items-center space-x-2">
              {/* GitHub 图标 */}
              <Image src={Github} alt="@lllu_23" width={36} height={36} />
              {/* 显示 GitHub 仓库链接描述 */}
              <span className="text-3xl px-4">@源代码仓库</span>
            </div>
          </Link>
        </div>

        {/* 右侧部分：包含连接钱包按钮和其他操作 */}
        <div className="flex items-center space-x-6 text-2xl">
          {/* 联系作者的链接，点击后通过邮件联系 */}
          <Link
            href="mailto:lllu238744@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            联系作者
          </Link>

          {/* 根据是否已连接钱包动态显示内容 */}
          {isConnected ? (
            // 如果已连接账户，显示已连接状态
            <p className="bg-pink-600 px-6 py-2 rounded-md">已连接</p>
          ) : (
            // 如果未连接账户，显示连接钱包按钮
            <button
              onClick={connectAccount}
              className="bg-pink-600 px-6 py-2 rounded-md shadow-lg hover:bg-pink-700 transition duration-300"
            >
              连接钱包
            </button>
          )}
        </div>
      </div>
    </>
  );
}
