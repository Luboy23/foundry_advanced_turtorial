include .env

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
