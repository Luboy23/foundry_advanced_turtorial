import Link from "next/link";
import Image from "next/image";
import BiliBili from "@/public/assets/bilibili.png";
import Github from "@/public/assets/github.png";
import { ethers } from "ethers";

export default function Navbar({ accounts, setAccounts }) {
  const isConnected = Boolean(accounts[0]);

  async function connectAccount() {
    try {
      // Requires an injected EIP-1193 provider (e.g., MetaMask).
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccounts(accounts);
      } else {
        console.error("Ethereum provider not found.");
      }
    } catch (e) {
      console.error("Failed to connect to accounts:", e);
    }
  }

  return (
    <>
      <div className="flex justify-between items-center text-2xl px-8 py-6 font-wq text-white">
        <div className="flex">
          <Link
            href="https://space.bilibili.com/3493288753498847"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="flex items-center space-x-2">
              <Image src={BiliBili} alt="@lllu_23" width={36} height={36} />
              <span className="text-3xl px-4">@lllu_23</span>
            </div>
          </Link>

          <Link
            href="https://github.com/Luboy23"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="flex items-center space-x-2">
              <Image src={Github} alt="@lllu_23" width={36} height={36} />
              <span className="text-3xl px-4">@源代码仓库</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-6 text-2xl">
          <Link
            href="mailto:lllu238744@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            联系作者
          </Link>

          {isConnected ? (
            <p className="bg-pink-600 px-6 py-2 rounded-md">已连接</p>
          ) : (
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
