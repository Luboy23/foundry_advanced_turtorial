# 11_Polymarket-On-chain Contracts

本目录为 Pari-mutuel 二元奖池模型的教学合约与 Foundry 测试。

## 核心模块
- `src/EventFactory.sol`：统一入口（create/buy/resolve/redeem）。
- `src/BinaryEventCore.sol`：核心状态机、奖池规则、结算快照与赎回分配。
- `src/PositionToken.sol`：YES/NO 头寸 ERC1155。
- `src/ETHCollateralVault.sol`：抵押池（仅 operator 可入金/出金）。
- `src/OracleAdapterMock.sol`：提案 -> 冷静期 -> 最终化（无 dispute）。
- `src/OracleAdapterDisputeMock.sol`：可争议教学适配器（独立演示）。
- `src/PolymarketTypes.sol`：事件状态、结果、头寸方向等公共类型。

## 测试套件
- `test/CreateEvent.t.sol`：事件创建、参数与权限。
- `test/PositionFlow.t.sol`：`buyYes/buyNo` 头寸与池子累积规则。
- `test/Resolution.t.sol`：提案/最终化与赢家池为 0 自动 Invalid。
- `test/Redeem.t.sol`：赢家按比例赎回与 Invalid 1:1 退款。
- `test/Invariant.t.sol`：金库余额覆盖不变量。
- `test/DisputeOracleMock.t.sol`：可争议 oracle mock 流程。

## 常用命令
```bash
forge build
forge test
```
