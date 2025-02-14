# 01-ERC20 MINT
## 项目介绍
这是一个使用 `Nextjs15` 以及 `Foundry` 框架制作的 Web3 网页应用的简单demo，教程的视频连接：

![项目概览](./docs-assets/demo.png)

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

# Demo 展示
## `LuLuCoin` ERC-20合约
![LuLuCoin.sol](./docs-assets/contracts-show.png)

## `LuLuCoinTest` 测试合约
![LuLuCoinTest.t.sol](./docs-assets/test-show.png)

## `Home`前端页面
![page.js](./docs-assets/frontend-show.png)


## `erc20mint` 核心组件中与智能合约交互的部分
![erc20mint.js](./docs-assets/web3-intercation-show.png)


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

