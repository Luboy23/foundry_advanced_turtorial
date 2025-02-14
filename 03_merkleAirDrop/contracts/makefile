include .env

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
