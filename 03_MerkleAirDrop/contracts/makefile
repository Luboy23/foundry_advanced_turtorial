-include .env

# Anvil 默认账户（本地测试）
ANVIL_OWNER_SK ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_OWNER_PK ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ANVIL_USER1_SK ?= 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ANVIL_USER1_PK ?= 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ANVIL_USER2_SK ?= 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
ANVIL_USER2_PK ?= 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
ANVIL_USER3_SK ?= 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
ANVIL_USER3_PK ?= 0x90F79bf6EB2c4f870365E785982E1f101E93b906

OWNER_SK ?= $(ANVIL_OWNER_SK)
OWNER_PK ?= $(ANVIL_OWNER_PK)
USER1_SK ?= $(ANVIL_USER1_SK)
USER1_PK ?= $(ANVIL_USER1_PK)
USER2_SK ?= $(ANVIL_USER2_SK)
USER2_PK ?= $(ANVIL_USER2_PK)
USER3_SK ?= $(ANVIL_USER3_SK)
USER3_PK ?= $(ANVIL_USER3_PK)

deploy_llc:
	@echo "Deploying LuLuCoin contract..."
	forge create src/LuLuCoin.sol:LuLuCoin --private-key ${OWNER_SK} --broadcast --constructor-args ${OWNER_PK}

deploy_airdrop:
	@echo "Deploying AirDrop contract..."
	forge create src/LLCAirDrop.sol:LLCAirDrop --private-key ${OWNER_SK} --broadcast --constructor-args ${MERKLE_ROOT} ${LLC_CONTRACT}
	
mint:
	@echo "Minting tokens..."
	@echo "Minting tokens..."
	cast send ${LLC_CONTRACT} "mint(uint256)" ${TOTAL_AMOUNT} --private-key ${OWNER_SK}

transfer:
	@echo "Minting tokens..."
	cast send ${LLC_CONTRACT} "transfer(address,uint256)" ${AIRDROP_CONTRACT} ${TOTAL_AMOUNT} --private-key ${OWNER_SK}
user1_airdrop:
	@echo "Minting tokens..."
	cast send ${AIRDROP_CONTRACT} "claim(address, uint256, bytes32[])" ${USER1_PK} ${USER1_AIRDROP_AMOUNT} ${USER1_PROOF} --private-key ${USER1_SK}
	@echo "Minting tokens..."
user2_airdrop:
	@echo "Minting tokens..."
	cast send ${AIRDROP_CONTRACT} "claim(address, uint256, bytes32[])" ${USER2_PK} ${USER2_AIRDROP_AMOUNT} ${USER2_PROOF} --private-key ${USER2_SK}

user3_airdrop:
	@echo "Minting tokens..."
	cast send ${AIRDROP_CONTRACT} "claim(address, uint256, bytes32[])" ${USER3_PK} ${USER3_AIRDROP_AMOUNT} ${USER3_PROOF} --private-key ${USER2_SK}

owner_balance:
	@echo "Getting balance of the faucet contract..."
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${OWNER_PK}

airdrop_balance:
	@echo "Getting balance of the faucet contract..."
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${AIRDROP_CONTRACT}

user1_balance:
	@echo "Getting balance of the user1..."
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${USER1_PK}

user2_balance:
	@echo "Getting balance of the user2..."
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${USER2_PK}

user3_balance:
	@echo "Getting balance of the user2..."
	cast call ${LLC_CONTRACT} "balanceOf(address)" ${USER3_PK}

user1_claim_status:
	@echo "Getting the claimStatus of the user..."
	cast call ${AIRDROP_CONTRACT} "getClaimState(address)" ${USER1_PK}

user2_claim_status:
	@echo "Getting the claimStatus of the user..."
	cast call ${AIRDROP_CONTRACT} "getClaimState(address)" ${USER2_PK}

user3_claim_status:
	@echo "Getting the claimStatus of the user..."
	cast call ${AIRDROP_CONTRACT} "getClaimState(address)" ${USER3_PK}
