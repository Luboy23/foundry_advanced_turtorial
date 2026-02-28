import { ethers, BigNumber } from "ethers";
import { useState, useEffect } from "react";
import LuLuCoin from "../LuLuCoin.json";

export default function MintERC20({ accounts }) {
  // Deployed token address; must match the currently selected network.
  const ContractAddress =
    process.env.NEXT_PUBLIC_LULUCOIN_ADDRESS ??
    "0x663F3ad617193148711d28f5334eE4Ed07016602";

  const [balance, setBalance] = useState(null);
  const [mintAmount, setMintAmount] = useState(1);
  const isConnected = Boolean(accounts[0]);

  async function handleMint() {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        ContractAddress,
        LuLuCoin.abi,
        signer
      );

      try {
        // Assumes token uses 18 decimals; adjust if contract decimals differ.
        const mintAmountInETH = ethers.utils.parseUnits(
          mintAmount.toString(),
          18
        );
        const response = await contract.mint(BigNumber.from(mintAmountInETH));
        console.log("Minting response", response);

        // Note: registering on every mint can create multiple listeners; consider once() or cleanup.
        contract.on("Mint", async () => {
          fetchBalance();
        });
      } catch (e) {
        console.log("error", e);
      }
    }
  }

  async function fetchBalance() {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        ContractAddress,
        LuLuCoin.abi,
        signer
      );

      try {
        const userBalance = await contract.balanceOf(accounts[0]);
        const formattedBalance = parseFloat(
          ethers.utils.formatUnits(userBalance, 18)
        ).toFixed(2);

        setBalance(formattedBalance);
      } catch (e) {
        console.log("error fetching balance", e);
      }
    }
  }

  useEffect(() => {
    if (isConnected) {
      // Polls balance every 1s after connect; consider a longer interval for performance.
      fetchBalance();
      const intervalId = setInterval(fetchBalance, 1000);
      return () => clearInterval(intervalId);
    }
  }, [accounts, isConnected]);

  return (
    <>
      <div className="flex flex-col flex-grow justify-center items-center font-wq mb-12 mt-20 text-white">
        <div className="w-[640-px] text-center">
          <h1 className="text-6xl text-[#ff2c73]">铸造 LuLuCoin</h1>
          {isConnected ? (
            <>
              <p className="text-4xl mt-20 mb-12 animate-pulse">
                开始铸造你的第一个 LuLuCoin 代币吧!
              </p>
              <div className="flex justify-center mt-4">
                <input
                  value={mintAmount}
                  onChange={(e) => setMintAmount(Number(e.target.value))}
                  className="text-center w-80 h-10 mt-4 mb-4 text-pink-600 text-2xl"
                  type="number"
                  placeholder="请输入你想要铸造的代币数量..."
                  min="0"
                />
              </div>

              <div className="flex-col justify-center items-center mt-8">
                <button
                  onClick={handleMint}
                  className="bg-[#D6517D] rounded-md shadow-md text-2xl p-4 w-80"
                >
                  立即铸造！
                </button>
                <p className="t text-[#ff2c73] text-xl animate-pulse mt-4">
                  当前的 LuLuCoin 代币余额：{" "}
                  {balance !== null ? `${balance} ETH` : "正在加载中..."}
                </p>
              </div>
            </>
          ) : (
            <div className="flex justify-center text-6xl items-center mt-48 mb-20">
              <p className="animate-pulse">连接钱包以开始铸造代币...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
