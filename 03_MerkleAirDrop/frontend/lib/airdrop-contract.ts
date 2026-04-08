import { ethers } from "ethers";
import LLCAirDropJson from "../LLCAirDrop.json";
import LuLuCoinJson from "../LuLuCoin.json";
import { loadRuntimeContractConfig } from "./runtime-config";

export type AirdropContracts = {
  airdropContract: ethers.Contract;
  luluCoinContract: ethers.Contract;
};

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

export const connectWallet = async () => {
  const ethereum = getEthereum();
  const accounts = await ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts as string[];
};

export const buildAirdropContracts = async (
  airdropAddress: string
): Promise<AirdropContracts> => {
  const signer = await getSigner();
  const airdropContract = new ethers.Contract(
    airdropAddress,
    (LLCAirDropJson as { abi: unknown[] }).abi,
    signer
  );
  const luluCoinAddress = await airdropContract.getAirDropTokenAddress();
  const luluCoinContract = new ethers.Contract(
    luluCoinAddress,
    (LuLuCoinJson as { abi: unknown[] }).abi,
    signer
  );

  return {
    airdropContract,
    luluCoinContract,
  };
};

export const fetchAirdropDetail = async ({
  account,
  airdropContract,
  luluCoinContract,
  airdropAddress,
}: {
  account: string;
  airdropContract: ethers.Contract;
  luluCoinContract: ethers.Contract;
  airdropAddress: string;
}) => {
  const [luluCoinAddress, balance, claimed] = await Promise.all([
    airdropContract.getAirDropTokenAddress(),
    luluCoinContract.balanceOf(account),
    airdropContract.getClaimState(account),
  ]);

  return {
    airdropAddress,
    luluCoinAddress: luluCoinAddress.toString(),
    balance: ethers.formatUnits(balance, 18),
    claimed: Boolean(claimed),
  };
};

export const claimAirdrop = async ({
  airdropContract,
  address,
  amount,
  merkleProof,
}: {
  airdropContract: ethers.Contract;
  address: string;
  amount: string;
  merkleProof: string;
}) => {
  const proofArray = merkleProof.split(",").map((item) => {
    const hexValue = item.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(hexValue)) {
      throw new Error(`无效的Merkle Proof格式: ${hexValue}`);
    }
    return hexValue;
  });

  const amountParsed = ethers.parseUnits(amount.toString(), "ether");
  const transaction = await airdropContract.claim(address, amountParsed, proofArray);
  return transaction.wait();
};
