-include .env

# Anvil 默认账户（本地测试）
ANVIL_DEFAULT_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_DEFAULT_ADDRESS ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ANVIL_USER1_PRIVATE_KEY ?= 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ANVIL_USER1_ADDRESS ?= 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ANVIL_USER2_PRIVATE_KEY ?= 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
ANVIL_USER2_ADDRESS ?= 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

OWNER_PRIVATE_KEY ?= $(ANVIL_DEFAULT_PRIVATE_KEY)
OWNER_ADDRESS ?= $(ANVIL_DEFAULT_ADDRESS)
USER1_PRIVATE_KEY ?= $(ANVIL_USER1_PRIVATE_KEY)
USER1_ADDRESS ?= $(ANVIL_USER1_ADDRESS)
USER2_PRIVATE_KEY ?= $(ANVIL_USER2_PRIVATE_KEY)
USER2_ADDRESS ?= $(ANVIL_USER2_ADDRESS)

# Local Anvil defaults (override with environment variables if needed).
ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_CHAIN_ID ?= 31337
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
ANVIL_MNEMONIC ?= test test test test test test test test test test test junk

anvil:
	@echo "Starting anvil on $(ANVIL_RPC_URL)..."
	anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(ANVIL_CHAIN_ID) --mnemonic "$(ANVIL_MNEMONIC)"

deps:
	@# Install OpenZeppelin contracts if missing or incomplete.
	@if [ ! -f "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol" ]; then \
		echo "Installing OpenZeppelin contracts..."; \
		rm -rf lib/openzeppelin-contracts; \
		forge install OpenZeppelin/openzeppelin-contracts --no-commit; \
	fi

deploy_anvil:
	@echo "Deploying LuLuCoin to anvil..."
	@$(MAKE) deps
	forge create src/LuLuCoin.sol:LuLuCoin \
		--rpc-url $(ANVIL_RPC_URL) \
		--private-key $(OWNER_PRIVATE_KEY) \
		--constructor-args $(OWNER_ADDRESS) \
		--broadcast
