import { InfoRow } from "./infoRow";

type ConnectionInfoProps = {
  onClose: () => void;
  chainId: bigint | number | null;
  accounts: string[];
  LuLuCoinAddress: string;
  balance: string | null;
  FaucetAddress: string;
  faucetBalance: string | null;
  nextDripTime: string | null;
};

export default function ConnectionInfo({
  onClose,
  chainId,
  accounts,
  LuLuCoinAddress,
  balance,
  FaucetAddress,
  faucetBalance,
  nextDripTime,
}: ConnectionInfoProps) {
  return (
    <div
      className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-40"
      onClick={onClose}
    >
      <div className="text-center bg-transparent p-6 rounded-md shadow-md border-8 border-white border-opacity-25 w-1/2">
        <h1 className="text-xl mb-8 font-bold bg-[#D6517D] rounded-md shadow-md px-8 py-3">
          详细信息
        </h1>
        <InfoRow label="链ID" value={chainId?.toString() ?? "-"} />
        <InfoRow label="当前账户" value={accounts[0] ?? "-"} />
        <InfoRow label="LuLuCoin代币地址" value={LuLuCoinAddress} />
        <InfoRow label="当前账户LuLuCoin代币余额" value={balance ?? "-"} />
        <InfoRow label="Faucet代币地址" value={FaucetAddress} />
        <InfoRow label="当前Faucet代币余额" value={faucetBalance ?? "-"} />
        <InfoRow label="下次可领取时间" value={nextDripTime ?? "-"} />
      </div>
    </div>
  );
}
