"use client";

import { useState } from "react";
import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  formatUnits,
  hashMessage,
  keccak256,
  parseAbi,
  parseUnits,
  toHex,
  hexToString,
  type Hex,
} from "viem";
import CastResult from "@/components/cast/CastResult";
import { useCastExecution } from "@/components/cast/useCastExecution";
import {
  normalizeBlockTag,
  parseAbiJson,
  parseJson,
  parseQuantity,
  parseTopics,
} from "@/lib/cast-utils";

/**
 * Cast 控制台主组件：
 * - 在线：封装常见 RPC 查询/调试动作；
 * - 离线：ABI 编解码、单位换算、哈希与字符串工具。
 */
export default function CastConsole() {
  // `outputs/loading` 由统一执行 Hook 管理，key 对应每个功能模块。
  const { outputs, loading, callApi, safeCallApi, handleOffline } = useCastExecution();

  // 区块查询参数组。
  const [blockQueryValue, setBlockQueryValue] = useState("");
  const [blockQueryType, setBlockQueryType] = useState("number");
  const [blockIncludeTx, setBlockIncludeTx] = useState(false);

  // 交易查询参数组。
  const [txHash, setTxHash] = useState("");

  // 地址查询参数组。
  const [address, setAddress] = useState("");
  const [addressBlockTag, setAddressBlockTag] = useState("latest");

  // Storage 查询参数组。
  const [storageAddress, setStorageAddress] = useState("");
  const [storageSlot, setStorageSlot] = useState("0x0");
  const [storageBlockTag, setStorageBlockTag] = useState("latest");

  // Logs 查询参数组。
  const [logsFromBlock, setLogsFromBlock] = useState("latest");
  const [logsToBlock, setLogsToBlock] = useState("latest");
  const [logsAddress, setLogsAddress] = useState("");
  const [logsTopics, setLogsTopics] = useState("");

  // call / estimateGas 参数组。
  const [callTo, setCallTo] = useState("");
  const [callFrom, setCallFrom] = useState("");
  const [callData, setCallData] = useState("0x");
  const [callValue, setCallValue] = useState("");
  const [callBlockTag, setCallBlockTag] = useState("latest");

  // feeHistory 参数组。
  const [feeBlockCount, setFeeBlockCount] = useState("0x10");
  const [feeNewestBlock, setFeeNewestBlock] = useState("latest");
  const [feePercentiles, setFeePercentiles] = useState("[10, 50, 90]");

  // 派生查询参数组。
  const [ageBlockTag, setAgeBlockTag] = useState("latest");
  const [findTimestamp, setFindTimestamp] = useState("");

  // 自定义 RPC 参数组。
  const [customMethod, setCustomMethod] = useState("");
  const [customParams, setCustomParams] = useState("[]");

  // ABI 编解码参数组。
  const [abiFuncSig, setAbiFuncSig] = useState("");
  const [abiArgs, setAbiArgs] = useState("[]");
  const [abiJson, setAbiJson] = useState("");
  const [abiData, setAbiData] = useState("0x");

  // 事件解码参数组。
  const [eventAbiJson, setEventAbiJson] = useState("");
  const [eventTopics, setEventTopics] = useState("[]");
  const [eventData, setEventData] = useState("0x");

  // 单位转换参数组。
  const [formatUnitsValue, setFormatUnitsValue] = useState("");
  const [formatUnitsDecimals, setFormatUnitsDecimals] = useState("18");
  const [parseUnitsValue, setParseUnitsValue] = useState("");
  const [parseUnitsDecimals, setParseUnitsDecimals] = useState("18");

  // 哈希工具参数组。
  const [keccakInput, setKeccakInput] = useState("");
  const [keccakMode, setKeccakMode] = useState("utf8");
  const [messageInput, setMessageInput] = useState("");

  // 字符串/bytes32 工具参数组。
  const [utf8Input, setUtf8Input] = useState("");
  const [hexInput, setHexInput] = useState("");
  const [bytes32Input, setBytes32Input] = useState("");
  const [bytes32HexInput, setBytes32HexInput] = useState("");

  /**
   * 统一渲染模块结果区。
   */
  const renderResult = (key: string) => {
    return <CastResult loading={loading[key]} output={outputs[key]} />;
  };

  return (
    <div className="cast-console">
      {/* RPC 在线查询模块。 */}
      <details open className="cast-section">
        <summary>链上查询（RPC）</summary>
        <div className="cast-grid">
          <div className="cast-module">
            <div className="section-title">最新区块号</div>
            <button
              className="btn"
              type="button"
              onClick={() => callApi("blockNumber", { method: "eth_blockNumber" })}
            >
              查询
            </button>
            {renderResult("blockNumber")}
          </div>

          <div className="cast-module">
            <div className="section-title">区块详情</div>
            <div className="form-row">
              <div className="field">
                <label className="label">类型</label>
                <select
                  className="select"
                  value={blockQueryType}
                  onChange={(event) => setBlockQueryType(event.target.value)}
                >
                  <option value="number">区块号</option>
                  <option value="hash">区块哈希</option>
                </select>
              </div>
              <div className="field">
                <label className="label">区块值</label>
                <input
                  className="input"
                  value={blockQueryValue}
                  onChange={(event) => setBlockQueryValue(event.target.value)}
                  placeholder="latest / 100 / 0x..."
                />
              </div>
              <div className="field checkbox-field">
                <label className="label">包含交易</label>
                <input
                  type="checkbox"
                  checked={blockIncludeTx}
                  onChange={(event) => setBlockIncludeTx(event.target.checked)}
                />
              </div>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("blockQuery", () => {
                  const method =
                    blockQueryType === "hash"
                      ? "eth_getBlockByHash"
                      : "eth_getBlockByNumber";
                  const value =
                    blockQueryType === "hash"
                      ? blockQueryValue.trim()
                      : normalizeBlockTag(blockQueryValue);
                  return { method, params: [value, blockIncludeTx] };
                })
              }
            >
              查询
            </button>
            {renderResult("blockQuery")}
          </div>

          <div className="cast-module">
            <div className="section-title">交易 / 回执</div>
            <div className="field">
              <label className="label">交易哈希</label>
              <input
                className="input"
                value={txHash}
                onChange={(event) => setTxHash(event.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="form-row">
              <button
                className="btn"
                type="button"
                onClick={() =>
                  callApi("tx", {
                    method: "eth_getTransactionByHash",
                    params: [txHash.trim()],
                  })
                }
              >
                查交易
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  callApi("receipt", {
                    method: "eth_getTransactionReceipt",
                    params: [txHash.trim()],
                  })
                }
              >
                查回执
              </button>
            </div>
            {renderResult("tx")}
            {renderResult("receipt")}
          </div>

          <div className="cast-module">
            <div className="section-title">地址信息</div>
            <div className="form-row">
              <div className="field">
                <label className="label">地址</label>
                <input
                  className="input"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="field">
                <label className="label">区块</label>
                <input
                  className="input"
                  value={addressBlockTag}
                  onChange={(event) => setAddressBlockTag(event.target.value)}
                  placeholder="latest"
                />
              </div>
            </div>
            <div className="form-row">
              <button
                className="btn"
                type="button"
                onClick={() =>
                  safeCallApi("balance", () => ({
                    method: "eth_getBalance",
                    params: [address.trim(), normalizeBlockTag(addressBlockTag)],
                  }))
                }
              >
                余额
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  safeCallApi("nonce", () => ({
                    method: "eth_getTransactionCount",
                    params: [address.trim(), normalizeBlockTag(addressBlockTag)],
                  }))
                }
              >
                Nonce
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  safeCallApi("code", () => ({
                    method: "eth_getCode",
                    params: [address.trim(), normalizeBlockTag(addressBlockTag)],
                  }))
                }
              >
                Code
              </button>
            </div>
            <div className="form-row">
              <button
                className="btn"
                type="button"
                onClick={() =>
                  callApi("codesize", {
                    action: "codesize",
                    params: [address.trim(), addressBlockTag],
                  })
                }
              >
                Code Size
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  callApi("codehash", {
                    action: "codehash",
                    params: [address.trim(), addressBlockTag],
                  })
                }
              >
                Code Hash
              </button>
            </div>
            {renderResult("balance")}
            {renderResult("nonce")}
            {renderResult("code")}
            {renderResult("codesize")}
            {renderResult("codehash")}
          </div>

          <div className="cast-module">
            <div className="section-title">Storage</div>
            <div className="form-row">
              <div className="field">
                <label className="label">地址</label>
                <input
                  className="input"
                  value={storageAddress}
                  onChange={(event) => setStorageAddress(event.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="field">
                <label className="label">Slot</label>
                <input
                  className="input"
                  value={storageSlot}
                  onChange={(event) => setStorageSlot(event.target.value)}
                  placeholder="0x0"
                />
              </div>
              <div className="field">
                <label className="label">区块</label>
                <input
                  className="input"
                  value={storageBlockTag}
                  onChange={(event) => setStorageBlockTag(event.target.value)}
                  placeholder="latest"
                />
              </div>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("storage", () => ({
                  method: "eth_getStorageAt",
                  params: [
                    storageAddress.trim(),
                    storageSlot.trim(),
                    normalizeBlockTag(storageBlockTag),
                  ],
                }))
              }
            >
              查询
            </button>
            {renderResult("storage")}
          </div>

          <div className="cast-module">
            <div className="section-title">Logs</div>
            <div className="form-row">
              <div className="field">
                <label className="label">fromBlock</label>
                <input
                  className="input"
                  value={logsFromBlock}
                  onChange={(event) => setLogsFromBlock(event.target.value)}
                  placeholder="latest"
                />
              </div>
              <div className="field">
                <label className="label">toBlock</label>
                <input
                  className="input"
                  value={logsToBlock}
                  onChange={(event) => setLogsToBlock(event.target.value)}
                  placeholder="latest"
                />
              </div>
              <div className="field">
                <label className="label">address</label>
                <input
                  className="input"
                  value={logsAddress}
                  onChange={(event) => setLogsAddress(event.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>
            <div className="field">
              <label className="label">topics (JSON 数组或逗号分隔)</label>
              <input
                className="input"
                value={logsTopics}
                onChange={(event) => setLogsTopics(event.target.value)}
                placeholder='["0x..."]'
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("logs", () => {
                  const topics = parseTopics(logsTopics);
                  const filter: Record<string, any> = {
                    fromBlock: normalizeBlockTag(logsFromBlock),
                    toBlock: normalizeBlockTag(logsToBlock),
                  };
                  if (logsAddress.trim()) filter.address = logsAddress.trim();
                  if (topics) filter.topics = topics;
                  return {
                    method: "eth_getLogs",
                    params: [filter],
                  };
                })
              }
            >
              查询
            </button>
            {renderResult("logs")}
          </div>

          <div className="cast-module">
            <div className="section-title">Gas / Chain</div>
            <div className="form-row">
              <button
                className="btn"
                type="button"
                onClick={() => callApi("gasPrice", { method: "eth_gasPrice" })}
              >
                Gas Price
              </button>
              <button
                className="btn btn-secondary text-white hover:text-white"
                type="button"
                onClick={() => callApi("chainId", { method: "eth_chainId" })}
              >
                Chain ID
              </button>
              <button
                className="btn btn-secondary text-white hover:text-white"
                type="button"
                onClick={() => callApi("clientVersion", { method: "web3_clientVersion" })}
              >
                Client
              </button>
            </div>
            {renderResult("gasPrice")}
            {renderResult("chainId")}
            {renderResult("clientVersion")}
          </div>

          <div className="cast-module">
            <div className="section-title">Fee History</div>
            <div className="form-row">
              <div className="field">
                <label className="label">blockCount</label>
                <input
                  className="input"
                  value={feeBlockCount}
                  onChange={(event) => setFeeBlockCount(event.target.value)}
                  placeholder="0x10"
                />
              </div>
              <div className="field">
                <label className="label">newestBlock</label>
                <input
                  className="input"
                  value={feeNewestBlock}
                  onChange={(event) => setFeeNewestBlock(event.target.value)}
                  placeholder="latest"
                />
              </div>
            </div>
            <div className="field">
              <label className="label">rewardPercentiles (JSON)</label>
              <input
                className="input"
                value={feePercentiles}
                onChange={(event) => setFeePercentiles(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("feeHistory", () => ({
                  method: "eth_feeHistory",
                  params: [feeBlockCount, feeNewestBlock, parseJson(feePercentiles) ?? []],
                }))
              }
            >
              查询
            </button>
            {renderResult("feeHistory")}
          </div>

          <div className="cast-module">
            <div className="section-title">eth_call</div>
            <div className="form-row">
              <div className="field">
                <label className="label">to</label>
                <input
                  className="input"
                  value={callTo}
                  onChange={(event) => setCallTo(event.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="field">
                <label className="label">from (可选)</label>
                <input
                  className="input"
                  value={callFrom}
                  onChange={(event) => setCallFrom(event.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="label">data</label>
              <input
                className="input"
                value={callData}
                onChange={(event) => setCallData(event.target.value)}
                placeholder="0x"
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label className="label">value (可选)</label>
                <input
                  className="input"
                  value={callValue}
                  onChange={(event) => setCallValue(event.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">blockTag</label>
                <input
                  className="input"
                  value={callBlockTag}
                  onChange={(event) => setCallBlockTag(event.target.value)}
                />
              </div>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("ethCall", () => {
                  const tx: Record<string, any> = {
                    to: callTo.trim(),
                    data: callData.trim(),
                  };
                  if (callFrom.trim()) tx.from = callFrom.trim();
                  const value = parseQuantity(callValue);
                  if (value) tx.value = value;
                  return {
                    method: "eth_call",
                    params: [tx, normalizeBlockTag(callBlockTag)],
                  };
                })
              }
            >
              查询
            </button>
            {renderResult("ethCall")}
          </div>

          <div className="cast-module">
            <div className="section-title">estimateGas</div>
            <div className="form-row">
              <div className="field">
                <label className="label">to</label>
                <input
                  className="input"
                  value={callTo}
                  onChange={(event) => setCallTo(event.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="field">
                <label className="label">from (可选)</label>
                <input
                  className="input"
                  value={callFrom}
                  onChange={(event) => setCallFrom(event.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="label">data</label>
              <input
                className="input"
                value={callData}
                onChange={(event) => setCallData(event.target.value)}
                placeholder="0x"
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("estimateGas", () => {
                  const tx: Record<string, any> = {
                    to: callTo.trim(),
                    data: callData.trim(),
                  };
                  if (callFrom.trim()) tx.from = callFrom.trim();
                  const value = parseQuantity(callValue);
                  if (value) tx.value = value;
                  return {
                    method: "eth_estimateGas",
                    params: [tx],
                  };
                })
              }
            >
              查询
            </button>
            {renderResult("estimateGas")}
          </div>

          <div className="cast-module">
            <div className="section-title">派生查询</div>
            <div className="field">
              <label className="label">区块 age</label>
              <input
                className="input"
                value={ageBlockTag}
                onChange={(event) => setAgeBlockTag(event.target.value)}
                placeholder="latest / 0x区块哈希"
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                callApi("age", { action: "age", params: [ageBlockTag] })
              }
            >
              查询 age
            </button>
            {renderResult("age")}
            <div className="field">
              <label className="label">find-block (时间戳秒)</label>
              <input
                className="input"
                value={findTimestamp}
                onChange={(event) => setFindTimestamp(event.target.value)}
                placeholder="1700000000"
              />
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() =>
                callApi("findBlock", {
                  action: "find-block",
                  params: [findTimestamp],
                })
              }
            >
              查询区块
            </button>
            {renderResult("findBlock")}
          </div>
        </div>
      </details>

      {/* 高级 RPC：允许自定义 method/params。 */}
      <details className="cast-section">
        <summary>高级 RPC</summary>
        <div className="cast-grid">
          <div className="cast-module">
            <div className="section-title">自定义 method / params</div>
            <div className="field">
              <label className="label">method</label>
              <input
                className="input"
                value={customMethod}
                onChange={(event) => setCustomMethod(event.target.value)}
                placeholder="eth_getBlockByNumber"
              />
            </div>
            <div className="field">
              <label className="label">params (JSON 数组)</label>
              <input
                className="input"
                value={customParams}
                onChange={(event) => setCustomParams(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                safeCallApi("customRpc", () => ({
                  method: customMethod.trim(),
                  params: parseJson(customParams) ?? [],
                }))
              }
            >
              执行
            </button>
            {renderResult("customRpc")}
          </div>
        </div>
      </details>

      {/* 离线工具：本地执行，不触发网络请求。 */}
      <details className="cast-section">
        <summary>离线工具</summary>
        <div className="cast-grid">
          <div className="cast-module">
            <div className="section-title">ABI 编码</div>
            <div className="field">
              <label className="label">函数签名</label>
              <input
                className="input"
                value={abiFuncSig}
                onChange={(event) => setAbiFuncSig(event.target.value)}
                placeholder="transfer(address,uint256)"
              />
            </div>
            <div className="field">
              <label className="label">参数 (JSON 数组)</label>
              <input
                className="input"
                value={abiArgs}
                onChange={(event) => setAbiArgs(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                handleOffline("abiEncode", () => {
                  if (!abiFuncSig.trim()) throw new Error("需要函数签名");
                  const fnSig = `function ${abiFuncSig.trim()}`;
                  const abi = parseAbi([fnSig]);
                  const args = parseJson(abiArgs) ?? [];
                  const functionName = abiFuncSig.trim().split("(")[0];
                  return encodeFunctionData({
                    abi: abi as any,
                    functionName: functionName as any,
                    args: args as any,
                  } as any);
                })
              }
            >
              编码
            </button>
            {renderResult("abiEncode")}
          </div>

          <div className="cast-module">
            <div className="section-title">ABI 解码</div>
            <div className="field">
              <label className="label">ABI JSON</label>
              <textarea
                className="textarea"
                rows={4}
                value={abiJson}
                onChange={(event) => setAbiJson(event.target.value)}
                placeholder='[{"type":"function","name":"balanceOf"...}]'
              />
            </div>
            <div className="field">
              <label className="label">data</label>
              <input
                className="input"
                value={abiData}
                onChange={(event) => setAbiData(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                handleOffline("abiDecode", () => {
                  const abi = parseAbiJson(abiJson);
                  const decoded = decodeFunctionData({
                    abi: abi as any,
                    data: abiData as Hex,
                  } as any);
                  return {
                    functionName: decoded.functionName,
                    args: decoded.args,
                  };
                })
              }
            >
              解码
            </button>
            {renderResult("abiDecode")}
          </div>

          <div className="cast-module">
            <div className="section-title">事件解码</div>
            <div className="field">
              <label className="label">ABI JSON</label>
              <textarea
                className="textarea"
                rows={4}
                value={eventAbiJson}
                onChange={(event) => setEventAbiJson(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">topics (JSON 数组)</label>
              <input
                className="input"
                value={eventTopics}
                onChange={(event) => setEventTopics(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">data</label>
              <input
                className="input"
                value={eventData}
                onChange={(event) => setEventData(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                handleOffline("eventDecode", () => {
                  const abi = parseAbiJson(eventAbiJson);
                  const topics = parseTopics(eventTopics) ?? [];
                  const decoded = decodeEventLog({
                    abi: abi as any,
                    data: eventData as Hex,
                    topics: topics as Hex[],
                  } as any);
                  return {
                    eventName: decoded.eventName,
                    args: decoded.args,
                  };
                })
              }
            >
              解码
            </button>
            {renderResult("eventDecode")}
          </div>

          <div className="cast-module">
            <div className="section-title">单位换算</div>
            <div className="form-row">
              <div className="field">
                <label className="label">wei 到 unit</label>
                <input
                  className="input"
                  value={formatUnitsValue}
                  onChange={(event) => setFormatUnitsValue(event.target.value)}
                  placeholder="1000000000"
                />
              </div>
              <div className="field">
                <label className="label">decimals</label>
                <input
                  className="input"
                  value={formatUnitsDecimals}
                  onChange={(event) => setFormatUnitsDecimals(event.target.value)}
                />
              </div>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                handleOffline("formatUnits", () => {
                  const decimals = Number(formatUnitsDecimals || "18");
                  return formatUnits(BigInt(formatUnitsValue), decimals);
                })
              }
            >
              格式化
            </button>
            {renderResult("formatUnits")}
            <div className="form-row">
              <div className="field">
                <label className="label">unit 到 wei</label>
                <input
                  className="input"
                  value={parseUnitsValue}
                  onChange={(event) => setParseUnitsValue(event.target.value)}
                  placeholder="1.5"
                />
              </div>
              <div className="field">
                <label className="label">decimals</label>
                <input
                  className="input"
                  value={parseUnitsDecimals}
                  onChange={(event) => setParseUnitsDecimals(event.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() =>
                handleOffline("parseUnits", () => {
                  const decimals = Number(parseUnitsDecimals || "18");
                  return parseUnits(parseUnitsValue, decimals).toString();
                })
              }
            >
              转换
            </button>
            {renderResult("parseUnits")}
          </div>

          <div className="cast-module">
            <div className="section-title">哈希</div>
            <div className="field">
              <label className="label">输入</label>
              <input
                className="input"
                value={keccakInput}
                onChange={(event) => setKeccakInput(event.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label className="label">输入类型</label>
                <select
                  className="select"
                  value={keccakMode}
                  onChange={(event) => setKeccakMode(event.target.value)}
                >
                  <option value="utf8">UTF-8</option>
                  <option value="hex">Hex</option>
                </select>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  handleOffline("keccak", () => {
                    const input = keccakInput.trim();
                    if (!input) throw new Error("需要输入");
                    const hex = keccakMode === "hex" ? (input as Hex) : toHex(input);
                    return keccak256(hex);
                  })
                }
              >
                keccak256
              </button>
            </div>
            {renderResult("keccak")}
            <div className="field">
              <label className="label">hashMessage</label>
              <input
                className="input"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
              />
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() =>
                handleOffline("hashMessage", () => hashMessage(messageInput))
              }
            >
              hashMessage
            </button>
            {renderResult("hashMessage")}
          </div>

          <div className="cast-module">
            <div className="section-title">字符串 / Hex</div>
            <div className="field">
              <label className="label">UTF-8 到 Hex</label>
              <input
                className="input"
                value={utf8Input}
                onChange={(event) => setUtf8Input(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => handleOffline("utf8ToHex", () => toHex(utf8Input))}
            >
              转换
            </button>
            {renderResult("utf8ToHex")}
            <div className="field">
              <label className="label">Hex 到 UTF-8</label>
              <input
                className="input"
                value={hexInput}
                onChange={(event) => setHexInput(event.target.value)}
                placeholder="0x..."
              />
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() =>
                handleOffline("hexToUtf8", () => hexToString(hexInput as Hex))
              }
            >
              转换
            </button>
            {renderResult("hexToUtf8")}
          </div>

          <div className="cast-module">
            <div className="section-title">bytes32 字符串</div>
            <div className="field">
              <label className="label">string 到 bytes32</label>
              <input
                className="input"
                value={bytes32Input}
                onChange={(event) => setBytes32Input(event.target.value)}
              />
            </div>
            <button
              className="btn"
              type="button"
              onClick={() =>
                handleOffline("bytes32ToHex", () => toHex(bytes32Input, { size: 32 }))
              }
            >
              转换
            </button>
            {renderResult("bytes32ToHex")}
            <div className="field">
              <label className="label">bytes32 到 string</label>
              <input
                className="input"
                value={bytes32HexInput}
                onChange={(event) => setBytes32HexInput(event.target.value)}
                placeholder="0x..."
              />
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() =>
                handleOffline("hexToBytes32", () =>
                  hexToString(bytes32HexInput as Hex, { size: 32 })
                )
              }
            >
              转换
            </button>
            {renderResult("hexToBytes32")}
          </div>
        </div>
      </details>
    </div>
  );
}
