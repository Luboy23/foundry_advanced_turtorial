"use client";

import Image from "next/image";
import Link from "next/link";
import Bilibili from "@/public/assets/bilibili.png";
import GitHub from "@/public/assets/github.png";
import { useContractContext } from "./context";
import GenerateMerkleProof from "./generateMerkleProof";
import { connectWallet } from "@/lib/airdrop-contract";

export default function Navbar() {
  const { isConnected, setAccounts, setError } = useContractContext();

  const handleConnect = async () => {
    try {
      const accounts = await connectWallet();
      setAccounts(accounts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
    }
  };

  const disconnectAccount = () => {
    setAccounts([]);
    console.log("Disconnected from wallet.");
  };

  return (
    <div className="flex justify-between items-center text-2xl px-8 py-6 font-wq text-white">
      <div className="flex">
        <Link
          href="https://space.bilibili.com/3493288753498847"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex items-center space-x-2">
            <Image src={Bilibili} alt="@lllu_23" width={36} height={36} />
            <span className="font-wq text-3xl px-4 text-white">@lllu_23</span>
          </div>
        </Link>
        <Link
          href="https://github.com/Luboy23"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex items-center px-4 space-x-2">
            <Image src={GitHub} alt="@lllu_23" width={36} height={36} />
            <span className="font-wq text-3xl px-2 text-white">源代码仓库</span>
          </div>
        </Link>
      </div>

      <div className="flex items-center space-x-6 text-2xl">
        {isConnected ? <GenerateMerkleProof /> : null}
        {isConnected ? (
          <div className="flex items-center space-x-4">
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-lg hover:bg-blue-800 transition duration-300"
              onClick={disconnectAccount}
            >
              断开连接
            </button>
          </div>
        ) : (
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-lg hover:bg-blue-800 transition duration-300"
            onClick={handleConnect}
          >
            连接钱包
          </button>
        )}
      </div>
    </div>
  );
}
