"use client";

import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { useContractContext } from "./context";
import ErrorWindow from "./errorWindow";
import ConnectionInfo from "./connectionInfo";
import {
  dripFromFaucet,
  fetchChainId,
  fetchDripMetadata,
  fetchFaucetBalances,
} from "@/lib/faucet-contract";

export default function Faucet() {
  const {
    accounts,
    LuLuCoinAddress,
    FaucetAddress,
    balance,
    setBalance,
    faucetBalance,
    setFaucetBalance,
    nextDripTime,
    setNextDripTime,
    dripAmount,
    setDripAmount,
    chainId,
    setChainId,
    error,
    setError,
    dripInterval,
    setDripInterval,
    dripLimit,
    setDripLimit,
  } = useContractContext();
  const [showConnectionInfo, setShowConnectionInfo] = useState(false);
  const isConnected = Boolean(accounts[0]);

  const refreshConnectionInfo = async () => {
    try {
      const [balances, dripMeta, currentChainId] = await Promise.all([
        fetchFaucetBalances({
          account: accounts[0],
          luluCoinAddress: LuLuCoinAddress,
          faucetAddress: FaucetAddress,
        }),
        fetchDripMetadata({
          account: accounts[0],
          faucetAddress: FaucetAddress,
        }),
        fetchChainId(),
      ]);

      setBalance(balances.balance);
      setFaucetBalance(balances.faucetBalance);
      setNextDripTime(dripMeta.nextDripTime);
      setDripInterval(dripMeta.dripInterval);
      setDripLimit(dripMeta.dripLimit);
      setChainId(currentChainId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`发生错误: ${message}`);
    }
  };

  const handleClose = () => {
    setShowConnectionInfo(false);
  };

  const handleDrip = async () => {
    try {
      await dripFromFaucet({
        faucetAddress: FaucetAddress,
        amount: dripAmount,
      });
      await refreshConnectionInfo();
      setShowConnectionInfo(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`发生错误: ${message}`);
    }
  };

  useEffect(() => {
    if (!showConnectionInfo || !isConnected) {
      return;
    }
    void refreshConnectionInfo();
  }, [showConnectionInfo, isConnected, LuLuCoinAddress, FaucetAddress]);

  return (
    <div className="flex flex-col flex-grow justify-center items-center font-wq mb-6 mt-12 text-white">
      <div className="w-1/2">
        <div className="text-center">
          <h1 className="text-6xl text-[#ff2c73]"> LuLuCoin 代币水龙头</h1>
          {isConnected ? (
            <>
              <p className="text-4xl mt-12 mb-12 text-shadow-md animate-pulse">
                免费领取一定数量的 LuLuCoin 代币 <br />
                <br />
                单次最多领取 {parseFloat(ethers.formatUnits(dripLimit, 18))} 个代币,
                <span className="whitespace-nowrap">
                  领取间隔时间为 {dripInterval.toString()} 秒
                </span>
              </p>
              <div className="flex justify-center mt-4">
                <input
                  value={dripAmount}
                  onChange={(event) => setDripAmount(Number(event.target.value))}
                  className="text-center w-80 h-10 mt-4 mb-4 text-pink-600 text-2xl"
                  type="number"
                  min="0"
                  max="100"
                  style={{
                    WebkitAppearance: "none",
                    appearance: "textfield",
                  }}
                />
              </div>
              <div className="flex-col justify-center items-center mt-8">
                <button
                  onClick={handleDrip}
                  className="bg-[#D6517D] rounded-md shadow-md text-2xl text-white p-4 w-80"
                >
                  立即领取！
                </button>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      void refreshConnectionInfo();
                      setShowConnectionInfo(true);
                    }}
                    className="bg-[#D6517D] rounded-md shadow-md text-xl text-white p-2 w-80"
                  >
                    查看详细信息
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center text-6xl items-center mt-48 mb-32">
              <p className="text-white animate-marquee">连接钱包以领取代币...</p>
            </div>
          )}
        </div>
      </div>
      {error && <ErrorWindow message={error} onClose={() => setError(null)} />}

      {showConnectionInfo && isConnected && (
        <ConnectionInfo
          chainId={chainId}
          accounts={accounts}
          LuLuCoinAddress={LuLuCoinAddress}
          balance={balance}
          FaucetAddress={FaucetAddress}
          faucetBalance={faucetBalance}
          nextDripTime={nextDripTime}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
