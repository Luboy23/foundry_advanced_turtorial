SHELL := /bin/bash
.DEFAULT_GOAL := dev

FRONTEND_DIR := frontend
CONTRACTS_DIR := contracts
ENV_FILE := $(FRONTEND_DIR)/.env.local
CONTRACTS_ENV := $(CONTRACTS_DIR)/.env
CONTRACTS_ENV_EXAMPLE := $(CONTRACTS_DIR)/.env.example

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
ANVIL_PID_FILE := .anvil.pid
ANVIL_LOG_FILE := .anvil.log

ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_OWNER_ADDRESS ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

.PHONY: dev ensure-anvil restart-anvil deploy frontend-dev frontend-install frontend-build frontend-start frontend-lint \
	clean-frontend build-contracts test anvil clean help \
	deploy_lulucoin deploy_faucet mint balance_of_owner approve_faucet drip deposit balance_of_faucet balance_of_user

ensure-anvil:
	@set -e; \
	for cmd in anvil forge npm nc; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil already running at $(ANVIL_RPC_URL)."; \
	else \
		echo "Starting Anvil on $(ANVIL_RPC_URL)..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
		echo $$! > $(ANVIL_PID_FILE); \
		for i in {1..40}; do \
			if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
			sleep 0.5; \
		done; \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
			echo "Anvil failed to start. Check $(ANVIL_LOG_FILE)"; \
			exit 1; \
		fi; \
	fi

restart-anvil:
	@set -e; \
	for cmd in anvil nc lsof; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	pids=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$pids || true; \
	fi; \
	rm -f "$(ANVIL_PID_FILE)"; \
	for i in {1..40}; do \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	echo "Starting Anvil on $(ANVIL_RPC_URL)..."; \
	anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
	echo $$! > $(ANVIL_PID_FILE); \
	for i in {1..40}; do \
		if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
		sleep 0.5; \
	done; \
	if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil failed to start. Check $(ANVIL_LOG_FILE)"; \
		exit 1; \
	fi

deploy: ensure-anvil
	@bash -euo pipefail -c '\
	update_env() { \
		file="$$1"; key="$$2"; value="$$3"; \
		tmp=$$(mktemp); \
		if [ -f "$$file" ]; then \
			grep -v "^$$key=" "$$file" > "$$tmp" || true; \
		fi; \
		echo "$$key=$$value" >> "$$tmp"; \
		mv "$$tmp" "$$file"; \
	}; \
	if [ ! -f "$(CONTRACTS_ENV)" ]; then \
		cp "$(CONTRACTS_ENV_EXAMPLE)" "$(CONTRACTS_ENV)"; \
	fi; \
	OWNER_PRIVATE_KEY=$$(grep "^OWNER_PRIVATE_KEY=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	OWNER_ADDRESS=$$(grep "^OWNER_ADDRESS=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	DRIP_INTERVAL=$$(grep "^DRIP_INTERVAL=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	DRIP_LIMIT=$$(grep "^DRIP_LIMIT=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	if [ -z "$$OWNER_PRIVATE_KEY" ]; then OWNER_PRIVATE_KEY="$(ANVIL_PRIVATE_KEY)"; fi; \
	if [ -z "$$OWNER_ADDRESS" ]; then OWNER_ADDRESS="$(ANVIL_OWNER_ADDRESS)"; fi; \
	if [ -z "$$DRIP_INTERVAL" ]; then DRIP_INTERVAL=60; fi; \
	if [ -z "$$DRIP_LIMIT" ]; then DRIP_LIMIT=5000000000000000000; fi; \
	echo "Deploying LuLuCoin..."; \
	out=$$(cd "$(CONTRACTS_DIR)" && forge create \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--private-key "$$OWNER_PRIVATE_KEY" \
		--broadcast \
		src/LuLuCoin.sol:LuLuCoin \
		--constructor-args "$$OWNER_ADDRESS"); \
	llc=$$(echo "$$out" | sed -n "s/.*Deployed to: //p" | head -n 1); \
	if [ -z "$$llc" ]; then echo "$$out"; exit 1; fi; \
	update_env "$(CONTRACTS_ENV)" LLC_CONTRACT "$$llc"; \
	echo "Deploying LLCFaucet..."; \
	out=$$(cd "$(CONTRACTS_DIR)" && forge create \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--private-key "$$OWNER_PRIVATE_KEY" \
		--broadcast \
		src/LLCFaucet.sol:LLCFaucet \
		--constructor-args "$$llc" "$$DRIP_INTERVAL" "$$DRIP_LIMIT" "$$OWNER_ADDRESS"); \
	faucet=$$(echo "$$out" | sed -n "s/.*Deployed to: //p" | head -n 1); \
	if [ -z "$$faucet" ]; then echo "$$out"; exit 1; fi; \
	update_env "$(CONTRACTS_ENV)" FAUCET_CONTRACT "$$faucet"; \
	update_env "$(ENV_FILE)" NEXT_PUBLIC_LULUCOIN_ADDRESS "$$llc"; \
	update_env "$(ENV_FILE)" NEXT_PUBLIC_FAUCET_ADDRESS "$$faucet"; \
	echo "Minting / approving / depositing..."; \
	$(MAKE) -C "$(CONTRACTS_DIR)" ETH_RPC_URL="$(ANVIL_RPC_URL)" mint approve_faucet deposit; \
	echo "Wrote $(ENV_FILE)"; \
	echo "LuLuCoin: $$llc"; \
	echo "Faucet: $$faucet"; \
	'

frontend/node_modules: $(FRONTEND_DIR)/package.json $(FRONTEND_DIR)/package-lock.json
	cd $(FRONTEND_DIR) && npm install

frontend-install: frontend/node_modules

frontend-dev: frontend/node_modules
	cd $(FRONTEND_DIR) && npm run dev

dev: restart-anvil deploy frontend-dev

web: frontend-dev

frontend-build: frontend/node_modules
	cd $(FRONTEND_DIR) && npm run build

frontend-start: frontend-build
	cd $(FRONTEND_DIR) && npm run start

frontend-lint: frontend/node_modules
	cd $(FRONTEND_DIR) && npm run lint

clean-frontend:
	rm -rf $(FRONTEND_DIR)/node_modules

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build

test:
	@cd $(CONTRACTS_DIR) && forge test

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT)

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out $(ANVIL_LOG_FILE) $(ANVIL_PID_FILE)
	@echo "Cleaned build artifacts."

deploy_lulucoin deploy_faucet mint balance_of_owner approve_faucet drip deposit balance_of_faucet balance_of_user:
	$(MAKE) -C $(CONTRACTS_DIR) ETH_RPC_URL="$(ANVIL_RPC_URL)" $@

help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy LuLuCoin + Faucet and write env"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts"
	@echo "  test               Run contract tests"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
