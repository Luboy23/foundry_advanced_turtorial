import { ethers } from "ethers";
import { useState, useEffect } from "react";
import { useContractContext } from "./context";
import LuLuCoin from "../LuLuCoin.json";
import LLCFaucet from "../LLCFaucet.json";
import ErrorWindow from "./errorWindow.js";
import ConnectionInfo from "./connectionInfo";

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
    dripLimit,
  } = useContractContext(); // 从上下文读取合约状态与操作方法
  const [showConnectionInfo, setShowConnectionInfo] = useState(false);
  const isConnected = Boolean(accounts[0]);

  const handleClose = () => {
    setShowConnectionInfo(false);
  };

  async function handleDrip() {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const faucetContract = new ethers.Contract(
        FaucetAddress,
        LLCFaucet.abi,
        signer
      );
      try {
        const dripAmountInWei = ethers.parseUnits(
          dripAmount.toString(),
          "ether"
        );
        const response = await faucetContract.drip(BigInt(dripAmountInWei));
        console.log("Drip response", response);
        faucetContract.on("LLCFaucet__Drip", async () => {
          fetchBalance();
          fetchDripTime();
          setShowConnectionInfo(true);
        });
      } catch (err) {
        console.log("error", err);
        setError(`发生错误: ${err.message}`);
      }
    }
  }

  async function fetchBalance() {
    if (window.ethereum && isConnected) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const luluCoinContract = new ethers.Contract(
        LuLuCoinAddress,
        LuLuCoin.abi,
        signer
      );
      try {
        const userBalance = await luluCoinContract.balanceOf(accounts[0]);
        const formattedBalance = parseFloat(
          ethers.formatUnits(userBalance, 18)
        ).toFixed(2);

        setBalance(formattedBalance);

        const FaucetBalance = await luluCoinContract.balanceOf(FaucetAddress);
        const formattedFaucetBalance = parseFloat(
          ethers.formatUnits(FaucetBalance, 18)
        ).toFixed(2);
        setFaucetBalance(formattedFaucetBalance);
      } catch (err) {
        console.log("Error fetching balance", err);
        setError(`发生错误: ${err.message}`);
      }
    }
  }

  async function fetchDripTime() {
    if (window.ethereum && isConnected) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const faucetContract = new ethers.Contract(
        FaucetAddress,
        LLCFaucet.abi,
        signer
      );
      try {
        const lastDripTime = await faucetContract.getDripTime(accounts[0]);
        const dripInterval = await faucetContract.getDripInterval();
        const nextAvailableTime =
          Number(lastDripTime.toString()) + Number(dripInterval.toString());
        setNextDripTime(new Date(nextAvailableTime * 1000).toLocaleString());
      } catch (err) {
        console.log("Error fetching drip time", err);
        setError(`发生错误: ${err.message}`);
      }
    }
  }

  async function fetchChainId() {
    if (window.ethereum && isConnected) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setChainId(network.chainId);
    }
  }

  useEffect(() => {
    if (showConnectionInfo) {
      fetchBalance(), fetchDripTime(), fetchChainId();
    }
  }, [showConnectionInfo]);

  return (
    <div className="flex flex-col  flex-grow justify-center items-center font-wq mb-6 mt-12 text-white">
      <div className="w-1/2">
        <div className="text-center">
          <h1 className="text-6xl text-[#ff2c73] "> LuLuCoin 代币水龙头</h1>
          {isConnected ? (
            <>
              <p className="text-4xl mt-12 mb-12 text-shadow-md animate-pulse">
                免费领取一定数量的 LuLuCoin 代币 <br />
                <br />
                单次最多领取 {parseFloat(
                  ethers.formatUnits(dripLimit, 18)
                )}{" "}
                个代币,
                <span className="whitespace-nowrap">
                  领取间隔时间为 {dripInterval} 秒
                </span>
              </p>
              <div className="flex justify-center mt-4">
                <input
                  value={dripAmount}
                  onChange={(e) => setDripAmount(Number(e.target.value))}
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
                  className="bg-[#D6517D] rounded-md shadow-md text-2xl  text-white p-4 w-80"
                >
                  立即领取！
                </button>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      fetchBalance();
                      fetchChainId();
                      fetchDripTime();
                      setShowConnectionInfo(true);
                    }}
                    className="bg-[#D6517D] rounded-md shadow-md text-xl  text-white p-2 w-80"
                  >
                    查看详细信息
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center text-6xl items-center mt-48 mb-32">
              <p className=" text-white animate-marquee">
                连接钱包以领取代币...
              </p>
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
