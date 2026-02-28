## 合约架构

本项目合约为 `FlappyScoreboard`，用于链上记录玩家成绩与排行榜。

### 核心数据结构

- `MAX_LEADERBOARD = 10`：排行榜固定上限
- `bestScore[address]`：玩家历史最佳分
- `leaderboard[]`：Top10 排行榜（分数 + 时间戳）

### 主要函数

- `submitScore(uint256 score)`：提交成绩
  - 若为个人最佳则更新 `bestScore` 与排行榜
- `getLeaderboard()`：返回 Top10 的地址/分数/时间戳
- `leaderboardLength()`：排行榜长度

### 事件

- `ScoreSubmitted(address player, uint256 score, uint256 timestamp, bool isBest)`

### 排行榜维护规则

- 若玩家已在榜：更新分数与时间戳后重新排序
- 若未在榜且未满 10：直接插入
- 若已满 10 且分数低于末位：忽略
- 若分数高于末位：替换末位并冒泡排序

## 与前端集成

- ABI 输出来自 `contracts/out/FlappyScoreboard.sol/FlappyScoreboard.json`
- 使用根目录脚本同步到前端：

```bash
make sync-contract
```

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge create --rpc-url <your_rpc_url> --private-key <your_private_key> src/FlappyScoreboard.sol:FlappyScoreboard
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
