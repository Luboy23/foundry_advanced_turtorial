# 01 ERC20 Mint（erc20）
## 项目介绍
这是一个使用 `Nextjs15` 以及 `Foundry` 框架制作的 Web3 网页应用的简单demo，教程的视频连接：

**铸造页面（首页）**
![铸造页面（首页）](./docs-assets/ui-mint-home.png)

# 文档汇总
- 前端部分
  1. [Nextjs15 官方文档](https://nextjs.org/)
  2. [TailwindCSS 官方文档](https://tailwindcss.com/)
  3. [ethers@5.7.0 官方文档](https://docs.ethers.org/v5/)
   
- 合约部分
  1. [Foundry 官方文档](https://book.getfoundry.sh/)
  2. [Solidity 官方文档](https://docs.soliditylang.org/en/latest/)
  3. [以太坊单位转换器](https://eth-converter.com/)

# 环境配置
## 前端部分
`NextJs`的版本为`15.1.4`
   - 初始化项目的指令: `npx create-next-app@latest`
`ethers.js`的版本为`5.7.0`

## 合约部分
`Foundry` 版本为`0.3.0`
   - 初始化项目的指令: `forge init`, 如果项目不为空文件夹这需要加上`--force`,初始化项目时，不进行 Git 提交需要加上`--no-commit`
   - 安装 `OpenZeppelin` 的指令为: `forge install OpenZeppelin/openzeppelin-contracts` 

# 环境变量（contracts/.env）
复制示例文件后再填写实际值：
`cp contracts/.env.example contracts/.env`

变量说明：
- `OWNER_PRIVATE_KEY`：部署/签名用私钥（默认使用 Anvil Account #0：`0xac0974...`，仅本地测试）。
- `OWNER_ADDRESS`：与私钥对应的地址（默认 `0xf39F...`）。
- `USER1_PRIVATE_KEY`/`USER1_ADDRESS`、`USER2_PRIVATE_KEY`/`USER2_ADDRESS`：可选测试用户。
- `CONTRACT_ADDRESS`：可选，已部署合约地址（本地调试用）。

# Demo 展示
## `LuLuCoin` ERC-20合约
**合约实现（LuLuCoin.sol）**
![合约实现（LuLuCoin.sol）](./docs-assets/contract-lulucoin.png)

## `LuLuCoinTest` 测试合约
**测试合约（LuLuCoinTest.t.sol）**
![测试合约（LuLuCoinTest.t.sol）](./docs-assets/test-lulucoin.png)

## `Home`前端页面
**前端页面（page.js）**
![前端页面代码（page.js）](./docs-assets/frontend-home-code.png)


## `erc20mint` 核心组件中与智能合约交互的部分
**合约交互核心（erc20mint.js）**
![合约交互代码（erc20mint.js）](./docs-assets/web3-mint-code.png)


# 本次教程中使用到的和合约交互的指令
* 编译合约
`forge compile`

* 测试合约
`forge test`

* 测试指定测试合约中过的函数
`forge test --mt ${函数名称} -vvvvv `

* 部署合约
`forge create src/LuLuCoin.sol:LuLuCoin --private-key ${OWNER_PRIVATE_KEY} --broadcast --constructor-args ${OWNER_ADDRESS}`

* 函数选择器
`forge selectors find`

* 调用`mint`函数
`cast send ${LLC_CONTRACT} "mint(uint256)" ${AMOUNT} --private-key ${OWNER_PRIVATE_KEY}`
 
* 查看合约中的代币余额
` cast call ${LLC_CONTRACT} "balanceOf(address)" ${OWNER_ADDRESS}`

# Makefile 一键启动（推荐）
* 一键启动（启动 Anvil → 部署合约 → 启动前端）
`make`
`make dev`
`make run`

* 分步启动
`make anvil`
`make deploy_anvil`
`make frontend`

* 覆盖本地 Anvil 端口
`ANVIL_PORT=9545 make`

## 标准化命令（统一模板）
```bash
make help
make dev
make deploy
make web
make build-contracts
make test
make anvil
make clean
```
