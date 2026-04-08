import { ethers } from "ethers";
import LLCFaucet from "../LLCFaucet.json";
import LuLuCoin from "../LuLuCoin.json";
import { loadRuntimeContractConfig } from "./runtime-config";

const getEthereum = () => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Ethereum provider not found.");
  }
  return window.ethereum;
};

const getProvider = async () => {
  await loadRuntimeContractConfig();
  return new ethers.BrowserProvider(getEthereum());
};

const getSigner = async () => {
  const provider = await getProvider();
  return provider.getSigner();
};

const getFaucetContract = async (faucetAddress: string) =>
  new ethers.Contract(
    faucetAddress,
    (LLCFaucet as { abi: unknown[] }).abi,
    await getSigner()
  );

const getLuLuCoinContract = async (luluCoinAddress: string) =>
  new ethers.Contract(
    luluCoinAddress,
    (LuLuCoin as { abi: unknown[] }).abi,
    await getSigner()
  );

export const connectWallet = async () => {
  const ethereum = getEthereum();
  const accounts = await ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts as string[];
};

export const fetchFaucetBalances = async ({
  account,
  luluCoinAddress,
  faucetAddress,
}: {
  account: string;
  luluCoinAddress: string;
  faucetAddress: string;
}) => {
  const luluCoinContract = await getLuLuCoinContract(luluCoinAddress);
  const [userBalance, faucetBalance] = await Promise.all([
    luluCoinContract.balanceOf(account),
    luluCoinContract.balanceOf(faucetAddress),
  ]);

  return {
    balance: parseFloat(ethers.formatUnits(userBalance, 18)).toFixed(2),
    faucetBalance: parseFloat(ethers.formatUnits(faucetBalance, 18)).toFixed(2),
  };
};

export const fetchDripMetadata = async ({
  account,
  faucetAddress,
}: {
  account: string;
  faucetAddress: string;
}) => {
  const faucetContract = await getFaucetContract(faucetAddress);
  const [lastDripTime, dripInterval, dripLimit] = await Promise.all([
    faucetContract.getDripTime(account),
    faucetContract.getDripInterval(),
    faucetContract.getDripLimit(),
  ]);
  const nextAvailableTime =
    Number(lastDripTime.toString()) + Number(dripInterval.toString());

  return {
    nextDripTime: new Date(nextAvailableTime * 1000).toLocaleString(),
    dripInterval: BigInt(dripInterval.toString()),
    dripLimit: BigInt(dripLimit.toString()),
  };
};

export const fetchChainId = async () => {
  const provider = await getProvider();
  const network = await provider.getNetwork();
  return network.chainId;
};

export const dripFromFaucet = async ({
  faucetAddress,
  amount,
}: {
  faucetAddress: string;
  amount: number;
}) => {
  const faucetContract = await getFaucetContract(faucetAddress);
  const dripAmountInWei = ethers.parseUnits(amount.toString(), "ether");
  const response = await faucetContract.drip(BigInt(dripAmountInWei));
  return response.wait();
};

export const updateDripInterval = async (faucetAddress: string, nextInterval: number) => {
  const faucetContract = await getFaucetContract(faucetAddress);
  const response = await faucetContract.setDripInterval(BigInt(nextInterval));
  return response.wait();
};

export const updateDripLimit = async (faucetAddress: string, nextLimit: number) => {
  const faucetContract = await getFaucetContract(faucetAddress);
  const response = await faucetContract.setDripLimit(
    BigInt(ethers.parseUnits(nextLimit.toString(), 18))
  );
  return response.wait();
};

export const updateLuLuCoinAddress = (
  nextAddress: string,
  setLuLuCoinAddress: (value: string) => void
) => {
  setLuLuCoinAddress(nextAddress);
};

export const updateFaucetAddress = (
  nextAddress: string,
  setFaucetAddress: (value: string) => void
) => {
  setFaucetAddress(nextAddress);
};
