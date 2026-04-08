SHELL := /bin/bash
.DEFAULT_GOAL := dev

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
SCRIPTS_DIR := scripts
CONTRACTS_ENV := $(CONTRACTS_DIR)/.env
CONTRACTS_ENV_EXAMPLE := $(CONTRACTS_DIR)/.env.example

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_CHAIN_ID ?= 31337
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_OWNER_ADDRESS ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ANVIL_PID_FILE := .anvil.pid
ANVIL_LOG_FILE := .anvil.log

.PHONY: dev ensure-anvil restart-anvil deploy web build-contracts test anvil clean help

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
	if [ ! -f "$(CONTRACTS_ENV)" ]; then \
		cp "$(CONTRACTS_ENV_EXAMPLE)" "$(CONTRACTS_ENV)"; \
	fi; \
	cd "$(CONTRACTS_DIR)"; \
	OWNER_PRIVATE_KEY="$(ANVIL_PRIVATE_KEY)" OWNER_ADDRESS="$(ANVIL_OWNER_ADDRESS)" \
		forge script script/DeployLuLuCoin.s.sol:DeployLuLuCoin \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--broadcast; \
	'
	@node "$(SCRIPTS_DIR)/sync-contract.js" --rpc-url "$(ANVIL_RPC_URL)" --chain-id "$(ANVIL_CHAIN_ID)"

web:
	@cd "$(FRONTEND_DIR)" && \
	if [ ! -d node_modules ]; then npm install; fi; \
	npm run dev

dev: restart-anvil deploy web

build-contracts:
	@cd "$(CONTRACTS_DIR)" && forge build && cd .. && node "$(SCRIPTS_DIR)/sync-contract.js"

test:
	@cd "$(CONTRACTS_DIR)" && forge test
	@cd "$(FRONTEND_DIR)" && if [ ! -d node_modules ]; then npm install; fi; npm run typecheck

anvil:
	@anvil --host "$(ANVIL_HOST)" --port "$(ANVIL_PORT)"

clean:
	@rm -rf "$(CONTRACTS_DIR)/cache" "$(CONTRACTS_DIR)/out" "$(FRONTEND_DIR)/.next" "$(FRONTEND_DIR)/out" "$(ANVIL_LOG_FILE)" "$(ANVIL_PID_FILE)"
	@echo "Cleaned build artifacts."

help:
	@echo "Targets:"
	@echo "  dev                Restart anvil, deploy contracts, and run frontend"
	@echo "  deploy             Deploy LuLuCoin via forge script and sync frontend config"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts and refresh synced ABI/config"
	@echo "  test               Run contract tests and frontend typecheck"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
