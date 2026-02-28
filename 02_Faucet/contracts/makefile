# .env 配置文件包含所有敏感的环境变量，确保安全性和可配置性

-include .env
# 引入 .env 文件，确保环境变量能够在 Makefile 中使用

# Anvil 默认账户（本地测试）
ANVIL_OWNER_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_OWNER_ADDRESS ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ANVIL_USER_PRIVATE_KEY ?= 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ANVIL_USER_ADDRESS ?= 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

OWNER_PRIVATE_KEY ?= $(ANVIL_OWNER_PRIVATE_KEY)
OWNER_ADDRESS ?= $(ANVIL_OWNER_ADDRESS)
USER_PRIVATE_KEY ?= $(ANVIL_USER_PRIVATE_KEY)
USER_ADDRESS ?= $(ANVIL_USER_ADDRESS)

deploy_lulucoin:
	@echo "Deploying LuLuCoin contract..."
# 输出部署信息，提示正在部署 LuLuCoin 合约
	forge create src/LuLuCoin.sol:LuLuCoin --private-key ${OWNER_PRIVATE_KEY} --broadcast --constructor-args ${OWNER_ADDRESS}
# 使用 forge 部署 LuLuCoin 合约，传入合约所有者的私钥和地址作为构造函数参数

deploy_faucet:
	@echo "Deploying LLCFaucet contract..."
# 输出部署信息，提示正在部署 LLCFaucet 合约
	forge create --private-key ${OWNER_PRIVATE_KEY} src/LLCFaucet.sol:LLCFaucet --broadcast --constructor-args ${LLC_CONTRACT} ${DRIP_INTERVAL} ${DRIP_LIMIT} ${OWNER_ADDRESS}
# 使用 forge 部署 LLCFaucet 合约，传入相关的合约地址、领取间隔、领取限制和合约所有者的地址作为构造函数参数

mint:
	@echo "Minting tokens..."
# 输出铸币信息，提示正在铸造代币
	cast send ${LLC_CONTRACT} "mint(uint256)" ${MINT_AMOUNT} --private-key ${OWNER_PRIVATE_KEY}
# 使用 cast 发送交易调用 mint 函数，铸造指定数量的代币

balance_of_owner:
	@echo "Getting balance of the owner..."
# 输出查询余额信息，提示正在查询合约所有者的余额
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${OWNER_ADDRESS}
# 使用 cast 调用 `balanceOf` 函数，查询合约所有者的余额

approve_faucet:
	@echo "Approving faucet contract to spend tokens..."
# 输出批准信息，提示正在批准水龙头合约能够支出代币
	cast send ${LLC_CONTRACT} "approve(address,uint256)" ${FAUCET_CONTRACT} ${DEPOSIT_AMOUNT} --private-key ${OWNER_PRIVATE_KEY}
# 使用 cast 发送交易调用 `approve` 函数，允许水龙头合约支出指定数量的代币

drip:
	@echo "Dripping tokens from faucet..."
# 输出领取信息，提示正在从水龙头领取代币
	cast send ${FAUCET_CONTRACT} "drip(uint256)" ${DRIP_AMOUNT} --private-key ${USER_PRIVATE_KEY}
# 使用 cast 发送交易调用 `drip` 函数，用户从水龙头领取指定数量的代币

deposit:
	@echo "Depositing tokens to faucet..."
# 输出存款信息，提示正在向水龙头存入代币
	cast send ${FAUCET_CONTRACT} "deposit(uint256)" ${DEPOSIT_AMOUNT} --private-key ${OWNER_PRIVATE_KEY}
# 使用 cast 发送交易调用 `deposit` 函数，合约所有者向水龙头存入指定数量的代币

balance_of_faucet:
	@echo "Getting balance of the faucet contract..."
# 输出查询余额信息，提示正在查询水龙头合约的代币余额
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${FAUCET_CONTRACT}
# 使用 cast 调用 `balanceOf` 函数，查询水龙头合约的余额

balance_of_user:
	@echo "Getting balance of the faucet contract..."
# 输出查询余额信息，提示正在查询用户的代币余额
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${USER_ADDRESS}
# 使用 cast 调用 `balanceOf` 函数，查询用户的余额
