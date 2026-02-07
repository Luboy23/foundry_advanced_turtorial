# 02 ERC20 Faucet 
## 项目介绍
这是一个使用 `Nextjs15` 以及 `Foundry` 框架制作的ERC20代币水龙头领取网页

![项目概览](./docs-assets/demo1.png)
![项目概览](./docs-assets/demo2.png)
![项目概览](./docs-assets/demo3.png)
![项目概览](./docs-assets/demo4.png)
![项目概览](./docs-assets/demo5.png)


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
`NextJs`的版本为`15.1.4`
   - 初始化项目的指令: `npx create-next-app@latest`
`ethers.js`的版本为`6.13.5`
   - 安装 `ethers v6`的指令: `npm install ethers@6.13.5`


## 合约部分
`Foundry` 版本为`0.3.0`
   - 初始化项目的指令: `forge init`, 如果项目不为空文件夹这需要加上`--force`,初始化项目时，不进行 Git 提交需要加上`--no-commit`
   - 安装 `OpenZeppelin` 的指令为: `forge install OpenZeppelin/openzeppelin-contracts` 

# 代码展示
## `LLCFaucet` 代币水龙头合约
![LLCFaucet.sol](./docs-assets/contract.png)

## `LLCFaucetTest` 测试合约
![LuLuCoinTest.t.sol](./docs-assets/test.png)

## `Makefile`指令
![Makefile](./docs-assets/makefile.png)

## 新增的`context`组件
![context.js](./docs-assets/context.png)


## 使用 `ethers` 获取链上数据
![ethers](./docs-assets/ethers.png)




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
`make deploy_lulucoin`: 部署 LuLuCoin ERC20 代币合约
`make deploy_faucet`: 部署水龙头代币合约
`make mint`: 使用 `Owner` 账户进行 ERC20 代币的铸造
`make approve_faucet`: 使用 `Owner` 账户对 `LLCFaucet` 合约进行授权
`make deposit`: 使用 `Owner` 账户向水龙头合约中进行转账


# 根目录 Makefile 使用说明（新增）
- 使用根目录 Makefile 一键运行项目
`make start`: 一键部署合约并启动前端开发服务器
`make` 或 `make run`: 仅启动前端开发服务器（默认目标）
`make dev`: 同上，开发模式启动
`make contracts-setup`: 合约端初始化流程（部署/铸币/授权/存入）
`make frontend-build`: 构建前端生产包
`make frontend-start`: 启动前端生产服务器
`make frontend-lint`: 前端代码检查
`make clean-frontend`: 清理前端依赖
`make help`: 查看全部指令说明

- 注意事项
`contracts/.env` 为必需文件，需配置私钥/地址/RPC 等环境变量
`make start` 会触发链上交易（部署/铸币/授权/存入），请确认使用测试网或准备好 Gas


