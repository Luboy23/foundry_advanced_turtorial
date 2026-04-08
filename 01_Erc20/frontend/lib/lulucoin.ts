import { ethers } from "ethers";
import LuLuCoin from "../LuLuCoin.json";
import {
  getResolvedRuntimeConfig,
  loadRuntimeContractConfig,
} from "./runtime-config";

type EthereumWindow = Window & {
  ethereum?: unknown;
};

const getEthereum = () => (window as EthereumWindow).ethereum;

const getContract = async () => {
  await loadRuntimeContractConfig();

  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error("Ethereum provider not found.");
  }

  const provider = new ethers.providers.Web3Provider(ethereum as ethers.providers.ExternalProvider);
  const signer = provider.getSigner();
  return new ethers.Contract(
    getResolvedRuntimeConfig().luluCoinAddress,
    (LuLuCoin as { abi: unknown[] }).abi,
    signer
  );
};

export const mintLuLuCoin = async (amount: number) => {
  const contract = await getContract();
  const parsedAmount = ethers.utils.parseUnits(amount.toString(), 18);
  const response = await contract.mint(parsedAmount);
  return response.wait();
};

export const fetchLuLuCoinBalance = async (account: string) => {
  const contract = await getContract();
  const userBalance = await contract.balanceOf(account);
  return parseFloat(ethers.utils.formatUnits(userBalance, 18)).toFixed(2);
};
