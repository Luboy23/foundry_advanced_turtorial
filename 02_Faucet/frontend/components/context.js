import React, { createContext, useContext, useState } from "react";

const ContractContext = createContext();

export const useContractContext = () => useContext(ContractContext);

export const ContractContextProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [LuLuCoinAddress, setLuLuCoinAddress] = useState(
    process.env.NEXT_PUBLIC_LULUCOIN_ADDRESS ??
      "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  );
  const [FaucetAddress, setFaucetAddress] = useState(
    process.env.NEXT_PUBLIC_FAUCET_ADDRESS ??
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
  );
  const [balance, setBalance] = useState(null);
  const [faucetBalance, setFaucetBalance] = useState(null);
  const [nextDripTime, setNextDripTime] = useState(null);
  const [dripAmount, setDripAmount] = useState(1);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [dripInterval, setDripInterval] = useState(10);
  const [dripLimit, setDripLimit] = useState(100);
  const isConnected = Boolean(accounts[0]);

  return (
    <ContractContext.Provider
      value={{
        isConnected,
        accounts,
        setAccounts,
        LuLuCoinAddress,
        setLuLuCoinAddress,
        FaucetAddress,
        setFaucetAddress,
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
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};
