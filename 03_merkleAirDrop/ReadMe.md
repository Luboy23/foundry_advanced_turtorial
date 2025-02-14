# 03 Merkle AirDrop 
## 项目介绍
这是一个使用 `Nextjs15` 以及 `Foundry` 框架以及`MerkleTree`制作的 AirDrop 空投领取项目

![项目概览](./docs-assets/demo1.png)
![项目概览](./docs-assets/demo2.png)
![项目概览](./docs-assets/demo3.png)

# 文档汇总
- 前端部分
  1. [Nextjs15 官方文档](https://nextjs.org/)
  2. [TailwindCSS 官方文档](https://tailwindcss.com/)
  3. [ethers@6.13.5 官方文档](https://docs.ethers.org/v6/)
   
- 合约部分
  1. [Foundry 官方文档](https://book.getfoundry.sh/)
  2. [Solidity 官方文档](https://docs.soliditylang.org/en/latest/)
  3. [以太坊单位转换器](https://eth-converter.com/)

# 环境配置
## 前端部分
`NextJs`的版本为`15.1.7`
   - 初始化项目的指令: `npx create-next-app@latest`
`ethers.js`的版本为`6.13.5`
   - 安装 `ethers v6`的指令: `npm install ethers@6.13.5`


## 合约部分
`Foundry` 版本为`0.3.0`
   - 初始化项目的指令: `forge init`, 如果项目不为空文件夹这需要加上`--force`,初始化项目时，不进行 Git 提交需要加上`--no-commit`
   - 安装 `OpenZeppelin` 的指令为: `forge install OpenZeppelin/openzeppelin-contracts` 

# 代码展示
## `LLCAirDrop` 默克尔树合约
![LLCAirDrop.sol](./docs-assets/contract.png)

## `LLCAirDrop` 测试合约
![LLCAirDropTest.t.sol](./docs-assets/test.png)

## `Makefile`指令
![Makefile](./docs-assets/makefile.png)

## 使用 `javascript` 编写的用于生成 `MerkleRoot & MerkleProof` 脚本
![Script](./docs-assets/script.png)
![Script](./docs-assets/script2.png)


# 本次教程中使用到的和合约交互的指令
* 编译合约
`forge compile`

* 测试合约
`forge test`

* 测试指定测试合约中过的函数
`forge test --mt ${函数名称} -vvvvv `

* 函数选择器
`forge selectors find`

- 使用 makefile指令完成与合约的交互
`make deploy_llc`: 部署 LuLuCoin ERC20 代币合约
`make deploy_airdrop`: 部署空投合约
`make mint`: 使用 `Owner` 账户进行 ERC20 代币的铸造
`make transfer`: 使用 `Owner` 账户对 `AirDrop` 合约进行转账
`make user1_airdrop`: 使用`user1`领取空投
`make user1_balance`: 查看 `user1` 的账户余额
`make user1_claim_status`: 查看 `user1` 的空投领取状态



