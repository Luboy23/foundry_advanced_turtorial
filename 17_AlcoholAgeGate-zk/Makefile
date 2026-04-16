SHELL := /bin/bash
.DEFAULT_GOAL := help

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_PID_FILE ?= .anvil.pid
ANVIL_LOG_FILE ?= .anvil.log

CONTRACTS_DIR := contracts
ZK_DIR := zk
FRONTEND_DIR := frontend
SYNC_SCRIPT := scripts/sync-contract.js
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy

-include .env

ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif

.PHONY: zk-deps frontend-install build-zk test-zk build-contracts ensure-anvil restart-anvil anvil deploy test clean dev web help

zk-deps:
	@cd $(ZK_DIR) && \
	if [ ! -f package-lock.json ]; then \
		echo "Installing zk dependencies (initial)..."; \
		npm install --no-audit --no-fund; \
	elif [ ! -d node_modules ]; then \
		echo "Installing zk dependencies..."; \
		npm ci --no-audit --no-fund; \
	else \
		echo "ZK dependencies are ready."; \
	fi

frontend-install:
	@cd $(FRONTEND_DIR) && \
	if [ ! -f package-lock.json ]; then \
		echo "Installing frontend dependencies (initial)..."; \
		npm install --no-audit --no-fund; \
	elif [ ! -d node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		npm ci --no-audit --no-fund; \
	else \
		echo "Frontend dependencies are ready."; \
	fi

build-zk: zk-deps
	@cd $(ZK_DIR) && npm run build

test-zk: build-zk
	@cd $(ZK_DIR) && npm run test

build-contracts: build-zk
	@cd $(CONTRACTS_DIR) && forge build
	@node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

ensure-anvil:
	@set -e; \
	for cmd in anvil nc; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil already running at $(ANVIL_RPC_URL)."; \
	else \
		echo "Starting Anvil on $(ANVIL_RPC_URL)..."; \
		nohup anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 < /dev/null & \
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
	command -v lsof >/dev/null 2>&1 || { echo "Missing command: lsof"; exit 1; }; \
	pids=$$(lsof -ti tcp:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping Anvil listener(s) on port $(ANVIL_PORT): $$pids"; \
		kill $$pids 2>/dev/null || true; \
	fi; \
	rm -f $(ANVIL_PID_FILE); \
	for i in {1..30}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	echo "Starting fresh Anvil on $(ANVIL_RPC_URL)..."; \
	nohup anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 < /dev/null & \
	echo $$! > $(ANVIL_PID_FILE); \
	sleep 1; \
	if ! kill -0 $$(cat $(ANVIL_PID_FILE)) 2>/dev/null; then \
		echo "Failed to start Anvil. Check $(ANVIL_LOG_FILE)"; \
		exit 1; \
	fi

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID)

deploy: ensure-anvil build-contracts
	@cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) \
		--broadcast \
		--rpc-url $(ANVIL_RPC_URL) \
		--private-key $(DEPLOYER_PRIVATE_KEY)
	@node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

test: build-contracts test-zk frontend-install
	@cd $(CONTRACTS_DIR) && forge test
	@cd $(FRONTEND_DIR) && npm run check && npm run build:ci

web: frontend-install
	@cd $(FRONTEND_DIR) && npm run dev

dev: restart-anvil deploy web

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(CONTRACTS_DIR)/broadcast
	@rm -f $(CONTRACTS_DIR)/src/AlcoholAgeProofVerifier.sol $(CONTRACTS_DIR)/src/Verifier.sol $(CONTRACTS_DIR)/test/generated/SampleAlcoholAgeFixture.sol
	@rm -rf $(ZK_DIR)/build $(ZK_DIR)/data/generated/*
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/coverage
	@rm -f $(FRONTEND_DIR)/public/contract-config.json $(FRONTEND_DIR)/abi/*.json $(FRONTEND_DIR)/public/examples/*.json $(FRONTEND_DIR)/public/zk/* $(FRONTEND_DIR)/.env.local
	@rm -rf $(FRONTEND_DIR)/server-data/credentials
	@rm -f $(ANVIL_PID_FILE) $(ANVIL_LOG_FILE)
	@mkdir -p $(FRONTEND_DIR)/public/examples $(FRONTEND_DIR)/public/zk $(FRONTEND_DIR)/abi $(FRONTEND_DIR)/server-data/credentials
	@touch $(FRONTEND_DIR)/public/examples/.gitkeep $(FRONTEND_DIR)/public/zk/.gitkeep $(FRONTEND_DIR)/abi/.gitkeep
	@touch $(FRONTEND_DIR)/server-data/credentials/.gitkeep
	@touch $(ZK_DIR)/data/generated/.gitkeep
	@echo "Cleaned build artifacts."

help:
	@echo "Targets:"
	@echo "  build-zk         Build the alcohol age proof circuit, verifier, and sample data"
	@echo "  test-zk          Run zk success/failure tests"
	@echo "  build-contracts  Build zk artifacts, compile Foundry contracts, and sync frontend assets"
	@echo "  deploy           Ensure anvil, deploy contracts, and sync frontend ABI/config/artifacts"
	@echo "  test             Run zk tests, forge tests, frontend check, and frontend production build"
	@echo "  web              Start the formal Next frontend"
	@echo "  dev              Restart anvil, deploy contracts, sync frontend assets, and start the frontend"
	@echo "  clean            Remove generated artifacts"
