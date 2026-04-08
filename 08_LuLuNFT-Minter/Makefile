SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST := 127.0.0.1
ANVIL_PORT := 8545
ANVIL_RPC_URL := http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID := 31337
ANVIL_LOG_FILE := /tmp/anvil-lulu-nft.log

-include .env
DEPLOYER_PRIVATE_KEY ?= $(PRIVATE_KEY)

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy
SYNC_SCRIPT := scripts/sync-contract.js

.PHONY: help dev deploy web frontend-install build-contracts anvil ensure-anvil restart-anvil test clean

help:
	@echo "Targets:"
	@echo "  make dev              Restart anvil, deploy contracts, and run frontend"
	@echo "  make deploy           Deploy NFT + Market and sync runtime config"
	@echo "  make web              Run Next.js dev server"
	@echo "  make build-contracts  Compile contracts and sync ABI"
	@echo "  make test             Run contract tests and frontend typecheck"
	@echo "  make anvil            Start a local anvil chain"
	@echo "  make clean            Remove build artifacts"

build-contracts:
	@forge build --root $(CONTRACTS_DIR)
	@node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT)

ensure-anvil:
	@set -e; \
	if ! command -v nc >/dev/null 2>&1; then \
		echo "缺少 nc 命令，请安装 netcat"; \
		exit 1; \
	fi; \
	if nc -z $(ANVIL_HOST) $(ANVIL_PORT); then \
		echo "Anvil already running on $(ANVIL_HOST):$(ANVIL_PORT)"; \
	else \
		echo "启动 Anvil..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
		for i in {1..50}; do \
			if nc -z $(ANVIL_HOST) $(ANVIL_PORT); then break; fi; \
			sleep 0.2; \
		done; \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT); then \
			echo "Anvil 启动失败，请检查 $(ANVIL_LOG_FILE)"; \
			exit 1; \
		fi; \
	fi

restart-anvil:
	@set -e; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "缺少 lsof 命令，请安装"; \
		exit 1; \
	fi; \
	PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	$(MAKE) ensure-anvil

deploy: ensure-anvil
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	if [ -z "$(DEPLOYER_PRIVATE_KEY)" ]; then \
		echo "未设置 DEPLOYER_PRIVATE_KEY（可在 .env 中配置 PRIVATE_KEY）"; \
		exit 1; \
	fi; \
	(cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY)); \
	node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

web: frontend-install
	@set -e; \
	cd $(FRONTEND_DIR) && npm run dev

frontend-install:
	@set -e; \
	if [ ! -d $(FRONTEND_DIR)/node_modules ]; then \
		( cd $(FRONTEND_DIR) && npm ci --no-audit --no-fund ); \
	fi

dev:
	@$(MAKE) restart-anvil
	@$(MAKE) deploy
	@$(MAKE) web

test: frontend-install
	@forge test --root $(CONTRACTS_DIR)
	@cd $(FRONTEND_DIR) && npm run typecheck

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(CONTRACTS_DIR)/broadcast $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out $(ANVIL_LOG_FILE)
	@echo "Cleaned build artifacts."
