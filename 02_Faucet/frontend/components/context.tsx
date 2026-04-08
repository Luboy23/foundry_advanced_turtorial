"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  getResolvedRuntimeConfig,
  loadRuntimeContractConfig,
} from "@/lib/runtime-config";

type ContractContextValue = {
  isConnected: boolean;
  accounts: string[];
  setAccounts: Dispatch<SetStateAction<string[]>>;
  LuLuCoinAddress: string;
  setLuLuCoinAddress: Dispatch<SetStateAction<string>>;
  FaucetAddress: string;
  setFaucetAddress: Dispatch<SetStateAction<string>>;
  balance: string | null;
  setBalance: Dispatch<SetStateAction<string | null>>;
  faucetBalance: string | null;
  setFaucetBalance: Dispatch<SetStateAction<string | null>>;
  nextDripTime: string | null;
  setNextDripTime: Dispatch<SetStateAction<string | null>>;
  dripAmount: number;
  setDripAmount: Dispatch<SetStateAction<number>>;
  chainId: bigint | number | null;
  setChainId: Dispatch<SetStateAction<bigint | number | null>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  dripInterval: bigint;
  setDripInterval: Dispatch<SetStateAction<bigint>>;
  dripLimit: bigint;
  setDripLimit: Dispatch<SetStateAction<bigint>>;
};

const ContractContext = createContext<ContractContextValue | null>(null);

const fallbackRuntime = getResolvedRuntimeConfig();

export const useContractContext = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContractContext must be used within ContractContextProvider");
  }
  return context;
};

export const ContractContextProvider = ({
  children,
}: PropsWithChildren) => {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [LuLuCoinAddress, setLuLuCoinAddress] = useState(
    fallbackRuntime.luluCoinAddress
  );
  const [FaucetAddress, setFaucetAddress] = useState(
    fallbackRuntime.faucetAddress
  );
  const [balance, setBalance] = useState<string | null>(null);
  const [faucetBalance, setFaucetBalance] = useState<string | null>(null);
  const [nextDripTime, setNextDripTime] = useState<string | null>(null);
  const [dripAmount, setDripAmount] = useState(1);
  const [chainId, setChainId] = useState<bigint | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dripInterval, setDripInterval] = useState<bigint>(10n);
  const [dripLimit, setDripLimit] = useState<bigint>(100n * 10n ** 18n);
  const isConnected = Boolean(accounts[0]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const runtimeConfig = await loadRuntimeContractConfig();
      if (cancelled) return;
      setLuLuCoinAddress(runtimeConfig.luluCoinAddress);
      setFaucetAddress(runtimeConfig.faucetAddress);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

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
