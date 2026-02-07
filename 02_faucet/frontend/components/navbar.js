import Link from "next/link";
import Image from "next/image";
import Bilibili from "@/public/assets/bilibili.png";
import GitHub from "@/public/assets/github.png";
import LLCFaucet from "../LLCFaucet.json";
import { useState, useEffect } from "react";
import { useContractContext } from "./context";
import { ethers } from "ethers";
import { ManagementRow } from "./managementRow";

export default function Navbar() {
  const {
    accounts,
    setAccounts,
    LuLuCoinAddress,
    FaucetAddress,
    setLuLuCoinAddress,
    setFaucetAddress,
    dripInterval,
    setDripInterval,
    dripLimit,
    setDripLimit,
  } = useContractContext();
  const isConnected = Boolean(accounts[0]);

  const [showManagementTable, setShowManagementTable] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [editingField, setEditingField] = useState("");

  const closeManagementTable = () => {
    setShowManagementTable(false);
  };

  const openModal = (field) => {
    setEditingField(field);
    setInputValue("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    try {
      switch (editingField) {
        case "dripInterval":
          if (!isNaN(inputValue)) await handleDripInterval(inputValue);
          break;
        case "FaucetAddress":
          setFaucetAddress(inputValue);
          console.log("FaucetAddress updated to:", inputValue);
          break;
        case "LuLuCoinAddress":
          setLuLuCoinAddress(inputValue);
          break;
        case "dripLimit":
          if (!isNaN(inputValue)) await handleDripLimit(inputValue);
          break;
        default:
          console.error("Invalid editing field");
      }
    } catch (error) {
      console.error("Error saving value:", error);
    } finally {
      closeModal();
    }
  };

  // 通过 EIP-1193 provider 请求连接钱包
  async function connectAccount() {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccounts(accounts);
      } else {
        console.error("Ethereum provider not found.");
      }
    } catch (error) {
      console.error("Failed to connect to accounts:", error);
    }
  }

  async function handleDripInterval(newInterval) {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const faucetContract = new ethers.Contract(
        FaucetAddress,
        LLCFaucet.abi,
        signer
      );
      try {
        const response = await faucetContract.setDripInterval(
          BigInt(newInterval)
        );
        console.log("Drip interval updated", response);
        await fetchDripInterval();
      } catch (err) {
        console.log("Error updating drip interval", err);
      }
    }
  }

  async function handleDripLimit(newLimit) {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const faucetContract = new ethers.Contract(
        FaucetAddress,
        LLCFaucet.abi,
        signer
      );
      try {
        const response = await faucetContract.setDripLimit(
          BigInt(newLimit * 1e18)
        );
        console.log("Drip interval updated", response);
        fetchDripLimit(); // 刷新前端显示的领取间隔
      } catch (err) {
        console.log("Error updating drip interval", err);
      }
    }
  }

  async function fetchDripInterval() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const faucetContract = new ethers.Contract(
      FaucetAddress,
      LLCFaucet.abi,
      signer
    );
    const dripLimit = await faucetContract.getDripLimit();
    setDripLimit(dripLimit);
  }

  async function fetchDripLimit() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const faucetContract = new ethers.Contract(
      FaucetAddress,
      LLCFaucet.abi,
      signer
    );
    const dripInterval = await faucetContract.getDripInterval();
    setDripInterval(dripInterval);
  }

  // 仅清空本地连接状态，不会断开钱包本身
  function disconnectAccount() {
    setAccounts([]);
    console.log("Disconnected from wallet.");
  }

  useEffect(() => {
    fetchDripInterval();
    fetchDripLimit();
  });

  useEffect(() => {
    console.log("FaucetAddress has been updated to:", FaucetAddress);
  }, [FaucetAddress]);

  useEffect(() => {
    const storedLuLuCoinAddress = localStorage.getItem("LuLuCoinAddress");
    const storedFaucetAddress = localStorage.getItem("FaucetAddress");

    if (storedLuLuCoinAddress) {
      setLuLuCoinAddress(storedLuLuCoinAddress);
    }
    if (storedFaucetAddress) {
      setFaucetAddress(storedFaucetAddress);
    }
  }, [setFaucetAddress, setLuLuCoinAddress]);

  useEffect(() => {
    if (LuLuCoinAddress) {
      localStorage.setItem("LuLuCoinAddress", LuLuCoinAddress);
    }
    if (FaucetAddress) {
      localStorage.setItem("FaucetAddress", FaucetAddress);
    }
  }, [LuLuCoinAddress, FaucetAddress]);
  return (
    <div className="flex justify-between items-center text-2xl px-8 py-6 font-wq text-white">
      {/* 左侧：Bilibili / GitHub 外链 */}
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

      {/* 右侧：连接状态与管理入口 */}
      <div className="flex items-center space-x-6 text-2xl">
        {isConnected && (
          <p
            className="cursor-pointer"
            onClick={() => {
              setShowManagementTable(true); // 打开管理信息弹窗
            }}
          >
            管理页面
          </p>
        )}
        {isConnected ? (
          <div className="flex items-center space-x-4">
            <button
              className="bg-pink-600 text-white px-6 py-2 rounded-md shadow-lg hover:bg-pink-700 transition duration-300"
              onClick={disconnectAccount}
            >
              断开连接
            </button>
          </div>
        ) : (
          <button
            className="bg-pink-600 text-white px-6 py-2 rounded-md shadow-lg hover:bg-pink-700 transition duration-300"
            onClick={connectAccount}
          >
            连接钱包
          </button>
        )}
      </div>

      {showManagementTable && isConnected && (
        <div
          className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-40"
          onClick={closeManagementTable}
        >
          <div className="text-center bg-transparent p-6 rounded-md shadow-md border-8 border-white border-opacity-25 w-1/2">
            <h1 className="text-xl mb-8 font-bold bg-[#D6517D] rounded-md shadow-md px-8 py-3">
              详细信息
            </h1>
            <ManagementRow label="当前账户" value={accounts[0]} />
            <ManagementRow
              label="LuLuCoin代币地址"
              value={LuLuCoinAddress}
              onEdit={() => openModal("LuLuCoinAddress")}
            />
            <ManagementRow
              label="Faucet代币地址"
              value={FaucetAddress}
              onEdit={() => openModal("FaucetAddress")}
            />
            <ManagementRow
              label="领取时间间隔"
              value={dripInterval}
              onEdit={() => openModal("dripInterval")}
            />
            <ManagementRow
              label="单次最大领取限额"
              value={parseFloat(ethers.formatUnits(dripLimit, 18))}
              onEdit={() => openModal("dripLimit")}
            />
          </div>
        </div>
      )}

      {/* 管理项编辑弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md shadow-lg w-1/3 text-center">
            <h2 className="text-2xl mb-4">修改 {editingField}</h2>
            <input
              className="w-full border text-[#ff2c73] px-3 py-2 rounded-md mb-4"
              type="text"
              placeholder={`请输入新的 ${editingField}`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <div className="flex justify-end space-x-4">
              <button
                className="bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400"
                onClick={closeModal}
              >
                取消
              </button>
              <button
                className="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700"
                onClick={handleSave}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
