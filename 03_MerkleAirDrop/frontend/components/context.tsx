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
  buildAirdropContracts,
  type AirdropContracts,
} from "@/lib/airdrop-contract";
import {
  getResolvedRuntimeConfig,
  loadRuntimeContractConfig,
} from "@/lib/runtime-config";

type ContractContextValue = {
  isConnected: boolean;
  accounts: string[];
  setAccounts: Dispatch<SetStateAction<string[]>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  airdropAddress: string;
  setAirdropAddress: Dispatch<SetStateAction<string>>;
  airdropContract: AirdropContracts["airdropContract"] | null;
  luluCoinContract: AirdropContracts["luluCoinContract"] | null;
  isResultModalOpen: boolean;
  setIsResultModalOpen: Dispatch<SetStateAction<boolean>>;
  isConfigModalOpen: boolean;
  setIsConfigModalOpen: Dispatch<SetStateAction<boolean>>;
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
  const [error, setError] = useState<string | null>(null);
  const [airdropAddress, setAirdropAddress] = useState(
    fallbackRuntime.airdropAddress
  );
  const [airdropContract, setAirDropContract] =
    useState<AirdropContracts["airdropContract"] | null>(null);
  const [luluCoinContract, setLuluCoinContract] =
    useState<AirdropContracts["luluCoinContract"] | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const isConnected = Boolean(accounts[0]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const runtimeConfig = await loadRuntimeContractConfig();
      if (!cancelled) {
        setAirdropAddress(runtimeConfig.airdropAddress);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initContract = async () => {
      if (!isConnected) {
        if (!cancelled) {
          setAirDropContract(null);
          setLuluCoinContract(null);
        }
        return;
      }

      try {
        const contracts = await buildAirdropContracts(airdropAddress);
        if (!cancelled) {
          setAirDropContract(contracts.airdropContract);
          setLuluCoinContract(contracts.luluCoinContract);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("创建合约实例失败:", err);
        if (!cancelled) {
          setAirDropContract(null);
          setLuluCoinContract(null);
          setError(`创建合约实例失败: ${message}`);
        }
      }
    };

    void initContract();

    return () => {
      cancelled = true;
    };
  }, [airdropAddress, isConnected]);

  return (
    <ContractContext.Provider
      value={{
        isConnected,
        accounts,
        setAccounts,
        error,
        setError,
        airdropAddress,
        setAirdropAddress,
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
