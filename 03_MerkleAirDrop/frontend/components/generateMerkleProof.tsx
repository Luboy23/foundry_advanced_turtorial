"use client";

import { useState } from "react";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers } from "ethers";
import { useContractContext } from "./context";
import ErrorWindow from "./errorWindow";

type MerkleEntry = {
  address: string;
  amount: string;
};

type ProofRecord = {
  address: string;
  proof: string[];
  amount: string;
};

export default function GenerateMerkleProof() {
  const {
    isResultModalOpen,
    setIsResultModalOpen,
    isConfigModalOpen,
    setIsConfigModalOpen,
    error,
    setError,
  } = useContractContext();

  const [merkleData, setMerkleData] = useState<{
    root: string;
    proofs: ProofRecord[];
  }>({
    root: "",
    proofs: [],
  });

  const [entries, setEntries] = useState<MerkleEntry[]>([
    { address: "", amount: "" },
  ]);

  const handleEntryChange = (
    index: number,
    field: keyof MerkleEntry,
    value: string
  ) => {
    setEntries((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { address: "", amount: "" }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length === 1) return;
    setEntries((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
  };

  const handleGenerate = () => {
    try {
      const validEntries = entries.map((entry, index) => {
        if (!ethers.isAddress(entry.address)) {
          throw new Error(`第 ${index + 1} 行地址格式无效`);
        }
        if (Number.isNaN(Number(entry.amount)) || Number(entry.amount) <= 0) {
          throw new Error(`第 ${index + 1} 行数量必须大于0`);
        }
        return [
          entry.address,
          ethers.parseUnits(entry.amount, 18).toString(),
        ] as [string, string];
      });

      const tree = StandardMerkleTree.of(validEntries, ["address", "uint256"]);
      const proofs = validEntries.map(([address], index) => ({
        address,
        proof: tree.getProof(index),
        amount: entries[index].amount,
      }));

      setMerkleData({
        root: tree.root,
        proofs: proofs.sort((left, right) => left.address.localeCompare(right.address)),
      });
      setIsConfigModalOpen(false);
      setIsResultModalOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`生成失败: ${message}`);
    }
  };

  const formatProof = (proof: string[]) => proof.map((item) => `"${item}"`).join(",\n");

  return (
    <div className="font-wq text-white p-6 max-w-4xl mx-auto">
      {isConfigModalOpen ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[998] flex items-center justify-center p-4">
          <div className="bg-blue-900 rounded-xl border-2 border-blue-600 p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl text-center text-blue-300 mb-4">配置空投名单</h2>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-blue-300 hover:text-blue-100 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {entries.map((entry, index) => (
                <div key={`${entry.address}-${index}`} className="flex gap-4 items-start group">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="钱包地址 (0x...)"
                      className="w-full px-4 py-2 bg-blue-900/30 border-2 border-blue-600 rounded-lg text-white placeholder-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300 font-mono text-sm"
                      value={entry.address}
                      onChange={(event) =>
                        handleEntryChange(index, "address", event.target.value)
                      }
                    />
                    <input
                      type="number"
                      placeholder="数量 (ETH)"
                      className="w-full px-4 py-2 bg-blue-900/30 border-2 border-blue-600 rounded-lg text-white placeholder-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                      value={entry.amount}
                      onChange={(event) =>
                        handleEntryChange(index, "amount", event.target.value)
                      }
                      step="0.1"
                    />
                  </div>

                  <button
                    onClick={() => removeEntry(index)}
                    className="px-2 py-1 bg-red-600/30 hover:bg-red-700/40 rounded-lg text-red-300 opacity-0 group-hover:opacity-100 transition-all border border-red-600/50"
                    disabled={entries.length === 1}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={addEntry}
                className="px-6 py-2 bg-blue-600/50 hover:bg-blue-700/60 rounded-lg border-2 border-blue-600 transition-all text-blue-100"
              >
                + 添加地址
              </button>
              <button
                onClick={handleGenerate}
                className="px-6 py-2 bg-green-600/50 hover:bg-green-700/60 rounded-lg border-2 border-green-600 transition-all text-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!entries.every((entry) => entry.address && entry.amount)}
              >
                生成Merkle树
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isConfigModalOpen && !isResultModalOpen ? (
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-lg hover:bg-blue-800 transition duration-300"
          onClick={() => setIsConfigModalOpen(true)}
        >
          生成 MerkleProof
        </button>
      ) : null}

      {isResultModalOpen ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-blue-900/95 rounded-xl border-2 border-blue-600 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl text-blue-300">Merkle生成结果</h3>
                <button
                  onClick={() => setIsResultModalOpen(false)}
                  className="text-blue-300 hover:text-blue-100 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-blue-200 block mb-2">Merkle Root:</label>
                  <code className="block break-words p-4 bg-blue-800/20 rounded border border-blue-600">
                    {merkleData.root}
                  </code>
                </div>

                <div className="border-t border-blue-600/50 pt-4">
                  <h4 className="text-xl text-blue-300 mb-4">
                    空投详情 ({merkleData.proofs.length}个地址)
                  </h4>
                  <div className="space-y-6">
                    {merkleData.proofs.map((item, index) => (
                      <div
                        key={`${item.address}-${index}`}
                        className="bg-blue-800/10 p-4 rounded border border-blue-600/30"
                      >
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <span className="text-blue-400">地址:</span>
                            <code className="block break-words">{item.address}</code>
                          </div>
                          <div>
                            <span className="text-blue-400">数量:</span>
                            <span className="block">{item.amount} ETH</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-blue-400">Merkle Proof:</span>
                          <pre className="mt-2 p-4 bg-blue-900/20 rounded overflow-x-auto text-sm">
                            {formatProof(item.proof)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <ErrorWindow message={error} onClose={() => setError(null)} /> : null}
    </div>
  );
}
