SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
ANVIL_LOG_FILE ?= .anvil.log
ANVIL_PID_FILE ?= .anvil.pid

-include .env
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy

.PHONY: help dev deploy web frontend-install build-contracts test anvil ensure-anvil restart-anvil clean

help:
	@echo "Targets:"
	@echo "  make dev             # 一键启动：anvil + deploy + web"
	@echo "  make deploy          # 部署并同步前端地址/ABI"
	@echo "  make web             # 启动前端开发服务"
	@echo "  make build-contracts # 编译合约"
	@echo "  make test            # 运行合约测试"
	@echo "  make anvil           # 启动本地链"
	@echo "  make restart-anvil   # 重启本地链"
	@echo "  make clean           # 清理产物"

dev: restart-anvil deploy web

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID)

ensure-anvil:
	@set -e; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "缺少 lsof 命令，请先安装"; \
		exit 1; \
	fi; \
	if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		echo "Anvil already running on port $(ANVIL_PORT)."; \
	else \
		echo "Starting Anvil..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 & \
		echo $$! > $(ANVIL_PID_FILE); \
		for i in {1..50}; do \
			if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
			sleep 0.2; \
		done; \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			echo "Anvil 启动失败，请检查 $(ANVIL_LOG_FILE)"; \
			exit 1; \
		fi; \
	fi

restart-anvil:
	@set -e; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "缺少 lsof 命令，请先安装"; \
		exit 1; \
	fi; \
	PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	rm -f $(ANVIL_PID_FILE); \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	echo "Starting Anvil..."; \
	anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 & \
	echo $$! > $(ANVIL_PID_FILE); \
	sleep 1

deploy: ensure-anvil
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	if [ -z "$(DEPLOYER_PRIVATE_KEY)" ]; then \
		echo "未设置部署私钥（可在 .env 配置 PRIVATE_KEY）"; \
		exit 1; \
	fi; \
	echo "Building contracts..."; \
	(cd $(CONTRACTS_DIR) && forge build >/dev/null); \
	echo "Deploying StoneFallScoreboard..."; \
	(cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) --broadcast --rpc-url $(RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY)); \
	echo "Syncing frontend config..."; \
	node scripts/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID)

web: frontend-install
	@cd $(FRONTEND_DIR) && npm run dev

frontend-install:
	@cd $(FRONTEND_DIR) && \
	if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build
	@node scripts/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID)

test: frontend-install
	@cd $(CONTRACTS_DIR) && forge test
	@cd $(FRONTEND_DIR) && npm run lint && npm run typecheck && npm run test && npm run build

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/test-results $(ANVIL_LOG_FILE) $(ANVIL_PID_FILE)
	@echo "Cleaned build artifacts."
