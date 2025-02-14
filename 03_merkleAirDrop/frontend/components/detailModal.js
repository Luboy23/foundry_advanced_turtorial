import { useEffect, useState } from "react";
import { useContractContext } from "./context";
import { ethers } from "ethers";

export default function DetailModal() {
  const {
    airdropContract,
    airdropAddress,
    luluCoinContract,
    setError,
    accounts,
  } = useContractContext();

  const [detailData, setDetailData] = useState({
    show: false,
    loading: true,
    account: "",
    airdropContract: "",
    luluCoinAddress: "",
    balance: "0",
    claimed: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (detailData.show) {
        try {
          const luluCoinAddress = await airdropContract.getAirDropTokenAddress();
          const balance = await luluCoinContract.balanceOf(accounts[0]);
          const claimed = await airdropContract.getClaimState(accounts[0]);

          setDetailData((prev) => ({
            ...prev,
            loading: false,
            account: accounts[0],
            airdropAddress: airdropAddress,
            luluCoinAddress: luluCoinAddress,
            balance: ethers.formatUnits(balance, 18),
            claimed,
          }));
        } catch (err) {
          setError("获取详情失败: " + err.message);
          setDetailData((prev) => ({ ...prev, show: false }));
        }
      }
    };

    fetchData();
  }, [detailData.show, airdropContract, luluCoinContract, setError, accounts]);

  return (
    <>
      <button
        className="bg-blue-700 rounded-lg shadow-md text-xl text-white py-2 w-80 transition-all
          hover:shadow-xl hover:scale-105"
        onClick={() =>
          setDetailData({ ...detailData, show: true, loading: true })
        }
      >
        🔍 查看详细信息
      </button>

      {detailData.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center ">
          <div className="bg-blue-900/95 rounded-xl border-2 border-blue-600 w-full max-w-2xl">
            <div className="p-6 space-y-4">
              <div className="flex  justify-between items-center">
                <h3 className="text-xl text-blue-300">账户详情</h3>
                <button
                  onClick={() => setDetailData({ ...detailData, show: false })}
                  className="text-blue-300 hover:text-blue-100 text-2xl"
                >
                  &times;
                </button>
              </div>

              {detailData.loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-4 text-xl">
                  <div className="grid gap-4">
                    <div>
                      <span className="text-blue-400 mb-2">当前连接账户:</span>
                      <p className="break-words mt-2 ">{detailData.account}</p>
                    </div>
                    <div>
                      <span className="text-blue-400 mb-2">空投合约地址:</span>
                      <p className="break-words mt-2">
                        {detailData.airdropAddress}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-400 mb-2">代币合约地址:</span>
                      <p className="break-words  mt-2">
                        {detailData.luluCoinAddress}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-400 mb-2">
                        当前账户代币余额:
                      </span>
                      <p className="break-words  mt-2">
                        {detailData.balance} ETH
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-400 mb-2">领取状态:</span>
                      <p className="break-words  mt-2">
                        {detailData.claimed ? "已领取" : "未领取"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


