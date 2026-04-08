"use client";

import Image from "next/image";
import Link from "next/link";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import Bilibili from "@/public/assets/bilibili.png";
import GitHub from "@/public/assets/github.png";
import { useContractContext } from "./context";
import { ManagementRow } from "./managementRow";
import {
  connectWallet,
  fetchDripMetadata,
  updateFaucetAddress,
  updateDripInterval,
  updateDripLimit,
  updateLuLuCoinAddress,
} from "@/lib/faucet-contract";

type EditingField = "" | "dripInterval" | "FaucetAddress" | "LuLuCoinAddress" | "dripLimit";

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
    setError,
  } = useContractContext();
  const isConnected = Boolean(accounts[0]);

  const [showManagementTable, setShowManagementTable] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [editingField, setEditingField] = useState<EditingField>("");

  const closeManagementTable = () => {
    setShowManagementTable(false);
  };

  const openModal = (field: EditingField) => {
    setEditingField(field);
    setInputValue("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const refreshFaucetSettings = async () => {
    if (!FaucetAddress) return;

    try {
      const metadata = await fetchDripMetadata({
        account: accounts[0],
        faucetAddress: FaucetAddress,
      });
      setDripInterval(metadata.dripInterval);
      setDripLimit(metadata.dripLimit);
    } catch (error) {
      console.error("Error refreshing faucet settings:", error);
    }
  };

  const handleSave = async () => {
    try {
      switch (editingField) {
        case "dripInterval":
          if (!Number.isNaN(Number(inputValue))) {
            await updateDripInterval(FaucetAddress, Number(inputValue));
            await refreshFaucetSettings();
          }
          break;
        case "FaucetAddress":
          updateFaucetAddress(inputValue, setFaucetAddress);
          break;
        case "LuLuCoinAddress":
          updateLuLuCoinAddress(inputValue, setLuLuCoinAddress);
          break;
        case "dripLimit":
          if (!Number.isNaN(Number(inputValue))) {
            await updateDripLimit(FaucetAddress, Number(inputValue));
            await refreshFaucetSettings();
          }
          break;
        default:
          console.error("Invalid editing field");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`发生错误: ${message}`);
    } finally {
      closeModal();
    }
  };

  const handleConnect = async () => {
    try {
      const nextAccounts = await connectWallet();
      setAccounts(nextAccounts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`发生错误: ${message}`);
    }
  };

  const disconnectAccount = () => {
    setAccounts([]);
    console.log("Disconnected from wallet.");
  };

  useEffect(() => {
    if (!isConnected) return;
    void refreshFaucetSettings();
  }, [isConnected, FaucetAddress]);

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
        {isConnected ? (
          <p
            className="cursor-pointer"
            onClick={() => {
              setShowManagementTable(true);
            }}
          >
            管理页面
          </p>
        ) : null}
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
            onClick={handleConnect}
          >
            连接钱包
          </button>
        )}
      </div>

      {showManagementTable && isConnected ? (
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
              value={dripInterval.toString()}
              onEdit={() => openModal("dripInterval")}
            />
            <ManagementRow
              label="单次最大领取限额"
              value={parseFloat(ethers.formatUnits(dripLimit, 18))}
              onEdit={() => openModal("dripLimit")}
            />
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md shadow-lg w-1/3 text-center">
            <h2 className="text-2xl mb-4">修改 {editingField}</h2>
            <input
              className="w-full border text-[#ff2c73] px-3 py-2 rounded-md mb-4"
              type="text"
              placeholder={`请输入新的 ${editingField}`}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
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
      ) : null}
    </div>
  );
}
