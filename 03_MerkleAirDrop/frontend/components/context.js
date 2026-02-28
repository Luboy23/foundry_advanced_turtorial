import React, { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import LLCAirDropABI from "../../contracts/out/LLCAirDrop.sol/LLCAirDrop.json";
import LuLuCoinABI from "../../contracts/out/LuLuCoin.sol/LuLuCoin.json";

const ContractContext = createContext();

export const useContractContext = () => useContext(ContractContext);

export const ContractContextProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);

  const [error, setError] = useState(null);

  const [airdropAddress, setAirdropAddress] = useState(
    process.env.NEXT_PUBLIC_AIRDROP_ADDRESS ??
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
  );

  const [airdropContract, setAirDropContract] = useState(null);
  const [luluCoinContract, setLuluCoinContract] = useState(null);

  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const isConnected = Boolean(accounts[0]);

  useEffect(() => {
    const initContract = async () => {
      if (isConnected && typeof window.ethereum !== "undefined") {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();

          const airdropInstance = new ethers.Contract(
            airdropAddress,
            LLCAirDropABI.abi,
            signer
          );
          setAirDropContract(airdropInstance);

          const luluCoinAddress = await airdropInstance.getAirDropTokenAddress();
          const luluCoinInstance = new ethers.Contract(
            luluCoinAddress,
            LuLuCoinABI.abi,
            signer
          );
          setLuluCoinContract(luluCoinInstance);
        } catch (err) {
          console.error("创建合约实例失败:", err);
          setError("创建合约实例失败: " + err.message);
        }
      } else {
        setAirDropContract(null);
        setLuluCoinContract(null);
      }
    };

    initContract();
  }, [isConnected]);

  return (
    <ContractContext.Provider
      value={{
        isConnected,
        accounts,
        setAccounts,
        error,
        setError,
        airdropAddress,
        airdropContract,
        luluCoinContract,
        isResultModalOpen,
        setIsResultModalOpen,
        isConfigModalOpen,
        setIsConfigModalOpen,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};
