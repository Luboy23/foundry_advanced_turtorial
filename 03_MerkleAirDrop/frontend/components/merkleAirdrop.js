import { useState } from "react";
import ErrorWindow from "./errorWindow.js";
import { useContractContext } from "./context";
import { ethers } from "ethers";
import DetailModal from "./detailModal.js";

export default function MerkleAirDrop() {
  const { isConnected, error, setError, airdropContract } = useContractContext();

  const [formData, setFormData] = useState({
    address: "",
    amount: "",
    merkleProof: "",
  });

  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClaim = async () => {
    console.log("当前合约实例:", airdropContract);
    setError(null);
    setSuccessMsg("");

    if (!formData.address || !formData.amount || !formData.merkleProof) {
      setError("请完善所有输入信息");
      return;
    }

    try {
      const proofArray = formData.merkleProof.split(",").map((s) => {
        const hexValue = s.trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(hexValue)) {
          throw new Error(`无效的Merkle Proof格式: ${hexValue}`);
        }
        return hexValue;
      });

      console.log("转换后的Merkle Proof:", proofArray);
      const amountParsed = ethers.parseUnits(
        formData.amount.toString(),
        "ether"
      );

      const tx = await airdropContract.claim(
        formData.address,
        amountParsed,
        proofArray
      );
      await tx.wait();
      setSuccessMsg("领取成功，交易已确认！");
      setFormData({ address: "", amount: "", merkleProof: "" });
    } catch (err) {
      console.error("Claim error:", err);
      setError(err.message || "领取失败，请重试！");
    }
  };

  return (
    <div className="flex flex-col flex-grow justify-center items-center font-wq mb-6 mt-12 text-white">
      <div className="w-1/2">
        <div className="text-center">
          <h1 className="text-6xl text-blue-700 mb-8">
            LuLuCoin Merkle AirDrop
          </h1>

          {isConnected ? (
            <>
              <p className="text-3xl mb-8 text-shadow-md animate-pulse">
                输入以下信息领取 LuLuCoin 代币空投!!!
              </p>

              <div className="flex flex-col items-center space-y-6">
                {" "}
                {[
                  {
                    name: "address",
                    placeholder: "请输入钱包地址...",
                    type: "text",
                  },
                  {
                    name: "amount",
                    placeholder: "请输入领取数量...",
                    type: "number",
                  },
                  {
                    name: "merkleProof",
                    placeholder: "请输入Merkle Proof...",
                    type: "text",
                  },
                ].map(({ name, placeholder, type }) => (
                  <input
                    key={name}
                    className="w-80 h-12 px-4 text-xl bg-transparent border-2 border-blue-600 rounded-lg
               text-blue-900 placeholder-blue-700 focus:border-blue-700 focus:ring-2 focus:ring-blue-500
               transition-all duration-300"
                    type={type}
                    name={name}
                    placeholder={placeholder}
                    value={formData[name]}
                    onChange={handleChange}
                  />
                ))}
              </div>

              <div className="flex flex-col items-center mt-8 space-y-4">
                <button
                  className={`bg-blue-700 rounded-lg shadow-lg text-2xl text-white py-3 w-80 transition-all
                    ${
                      !formData.address ||
                      !formData.amount ||
                      !formData.merkleProof
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:shadow-2xl hover:scale-105"
                    }`}
                  disabled={
                    !formData.address ||
                    !formData.amount ||
                    !formData.merkleProof
                  }
                  onClick={handleClaim}
                >
                  立即领取！
                </button>

                <div className="flex flex-col items-center mt-8 space-y-4">
                  <DetailModal />
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center text-6xl items-center mt-32 mb-48">
              <p className="text-white animate-pulse">
                连接钱包以领取空投代币...
              </p>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorWindow message={error} onClose={() => setError(null)} />}
    </div>
  );
}
