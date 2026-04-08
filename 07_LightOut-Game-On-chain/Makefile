SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST := 127.0.0.1
ANVIL_PORT := 8545
ANVIL_RPC_URL := http://127.0.0.1:8545
-include contracts/.env
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif
CONTRACTS_DIR := contracts
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy
SYNC_SCRIPT := scripts/sync-contract.js
CHAIN_ID := 31337
ANVIL_LOG_FILE := /tmp/anvil.log

.PHONY: dev deploy web frontend-install build-contracts test anvil ensure-anvil restart-anvil clean help

dev: restart-anvil deploy web

restart-anvil:
	@set -e; \
	for cmd in anvil nc lsof; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "缺少 $$cmd 命令，请先安装"; exit 1; }; \
	done; \
	PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	echo "启动 Anvil..."; \
	anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
	for i in {1..50}; do \
		if nc -z $(ANVIL_HOST) $(ANVIL_PORT); then break; fi; \
		sleep 0.2; \
	done; \
	if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT); then \
		echo "Anvil 启动失败，请检查 $(ANVIL_LOG_FILE)"; \
		exit 1; \
	fi

ensure-anvil:
	@set -e; \
	for cmd in anvil nc; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "缺少 $$cmd 命令，请先安装"; exit 1; }; \
	done; \
	if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil already running on $(ANVIL_HOST):$(ANVIL_PORT)."; \
	else \
		echo "启动 Anvil..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
		for i in {1..50}; do \
			if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
			sleep 0.2; \
		done; \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
			echo "Anvil 启动失败，请检查 $(ANVIL_LOG_FILE)"; \
			exit 1; \
		fi; \
	fi

deploy: ensure-anvil
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	if [ -z "$(DEPLOYER_PRIVATE_KEY)" ]; then \
		echo "未设置 DEPLOYER_PRIVATE_KEY（建议在 contracts/.env 中配置 PRIVATE_KEY）"; \
		exit 1; \
	fi; \
	echo "部署合约..."; \
	(cd "$(CONTRACTS_DIR)" && forge script $(DEPLOY_SCRIPT) --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY)); \
	node "$(SYNC_SCRIPT)" --rpc-url "$(ANVIL_RPC_URL)" --chain-id "$(CHAIN_ID)"

web: frontend-install
	@cd frontend; \
	npm run dev

frontend-install:
	@if [ ! -d frontend/node_modules ]; then \
		( cd frontend && npm ci --no-audit --no-fund ); \
	fi

build-contracts:
	@cd contracts && forge build
	@node "$(SYNC_SCRIPT)" --rpc-url "$(ANVIL_RPC_URL)" --chain-id "$(CHAIN_ID)"

test: frontend-install
	@cd contracts && forge test
	@cd frontend && npm run typecheck

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT)

clean:
	@rm -rf contracts/cache contracts/out frontend/.next frontend/out $(ANVIL_LOG_FILE)
	@echo "Cleaned build artifacts."

help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy contract and sync frontend runtime config"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts and sync ABI"
	@echo "  test               Run contract tests and frontend typecheck"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
