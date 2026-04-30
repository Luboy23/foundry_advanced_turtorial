SHELL := /bin/bash
.DEFAULT_GOAL := dev
MAKE_CMD := $(shell command -v make)

PROJECT_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
CONTRACTS_DIR := $(PROJECT_DIR)/contracts
FRONTEND_DIR := $(PROJECT_DIR)/frontend
INDEXER_DIR := $(PROJECT_DIR)/services/indexer
SCRIPTS_DIR := $(PROJECT_DIR)/scripts

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
WEB_PORT ?= 3000
INDEXER_PORT ?= 42069
ANVIL_LOG ?= $(PROJECT_DIR)/.anvil.log
INDEXER_LOG ?= $(PROJECT_DIR)/.indexer.log
DEV_SESSION_ENV ?= $(PROJECT_DIR)/.dev-session.env

-include $(PROJECT_DIR)/.env

.PHONY: help dev start anvil ensure-frontend-deps ensure-indexer-deps ensure-indexer-store web indexer deploy build-contracts snapshot-gas test test-contracts test-frontend test-indexer clean stop

help:
	@echo "Targets:"
	@echo "  dev / start         启动 Anvil + deploy + indexer + frontend（端口占用时自动顺延）"
	@echo "  anvil               启动本地 Anvil 节点"
	@echo "  deploy              部署合约并同步前端/索引配置"
	@echo "  build-contracts     编译合约并同步 ABI / runtime config"
	@echo "  snapshot-gas        生成 Foundry gas snapshot"
	@echo "  web                 启动 Next 前端开发服务器"
	@echo "  indexer             启动 Ponder indexer"
	@echo "  test                运行合约 / 前端 / indexer 检查"
	@echo "  clean               清理构建产物与缓存"
	@echo "  stop                停止本地 Anvil / indexer / frontend 进程"

anvil:
	@command -v anvil >/dev/null 2>&1 || { echo "anvil 未安装，请先安装 Foundry。"; exit 1; }
	@set -euo pipefail; \
	if cast chain-id --rpc-url $(RPC_URL) >/dev/null 2>&1; then \
		echo "Anvil 已就绪：$(RPC_URL)"; \
	else \
		echo "启动 Anvil：$(RPC_URL)"; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > "$(ANVIL_LOG)" 2>&1 & \
		sleep 1; \
		cast chain-id --rpc-url $(RPC_URL) >/dev/null 2>&1 || { echo "Anvil 启动失败，请检查 $(ANVIL_LOG)"; exit 1; }; \
	fi

ensure-frontend-deps:
	@cd $(FRONTEND_DIR) && if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi

ensure-indexer-deps:
	@cd $(INDEXER_DIR) && if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi

ensure-indexer-store:
	@$(SCRIPTS_DIR)/ensure-indexer-store.sh "$(INDEXER_DIR)"

web: ensure-frontend-deps
	@cd $(FRONTEND_DIR) && npm run dev -- --hostname 0.0.0.0 --port $(WEB_PORT)

indexer: ensure-indexer-deps ensure-indexer-store
	@cd $(INDEXER_DIR) && PORT=$(INDEXER_PORT) INDEXER_BASE_URL=http://127.0.0.1:$(INDEXER_PORT) npm run dev

build-contracts:
	@cd $(CONTRACTS_DIR) && forge clean >/dev/null && forge build
	@node $(SCRIPTS_DIR)/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --indexer-base-url http://127.0.0.1:$(INDEXER_PORT)

snapshot-gas:
	@cd $(CONTRACTS_DIR) && forge snapshot

deploy:
	@set -e; \
	if ! cast chain-id --rpc-url $(RPC_URL) >/dev/null 2>&1; then \
		echo "检测到本地链未就绪，正在启动 Anvil..."; \
		$(MAKE_CMD) anvil >/dev/null; \
	fi; \
	cd $(CONTRACTS_DIR) && forge clean >/dev/null && forge build >/dev/null; \
	cd $(CONTRACTS_DIR) && RPC_URL=$(RPC_URL) CHAIN_ID=$(CHAIN_ID) forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url $(RPC_URL); \
	node $(SCRIPTS_DIR)/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --indexer-base-url http://127.0.0.1:$(INDEXER_PORT)

dev:
	@set -euo pipefail; \
	node $(SCRIPTS_DIR)/resolve-dev-ports.js \
		--anvil-host $(ANVIL_HOST) \
		--anvil-port $(ANVIL_PORT) \
		--indexer-port $(INDEXER_PORT) \
		--web-port $(WEB_PORT) \
		--write-env-file "$(DEV_SESSION_ENV)"; \
	. "$(DEV_SESSION_ENV)"; \
	echo "本次启动端口：Anvil=$$ANVIL_PORT, Indexer=$$INDEXER_PORT, Next=$$WEB_PORT"; \
	$(MAKE_CMD) ensure-indexer-deps ensure-frontend-deps; \
	$(MAKE_CMD) ensure-indexer-store; \
	$(MAKE_CMD) deploy ANVIL_HOST=$$ANVIL_HOST ANVIL_PORT=$$ANVIL_PORT RPC_URL=$$RPC_URL INDEXER_PORT=$$INDEXER_PORT; \
	cd $(INDEXER_DIR); PORT=$$INDEXER_PORT INDEXER_BASE_URL=http://127.0.0.1:$$INDEXER_PORT npm run dev > "$(INDEXER_LOG)" 2>&1 & INDEXER_PID=$$!; \
	trap 'kill "$$INDEXER_PID" >/dev/null 2>&1 || true' EXIT; \
	echo "Indexer: http://127.0.0.1:$$INDEXER_PORT"; \
	echo "Frontend: http://127.0.0.1:$$WEB_PORT"; \
	cd $(FRONTEND_DIR); npm run dev -- --hostname 0.0.0.0 --port $$WEB_PORT

start: dev

test-contracts:
	@cd $(CONTRACTS_DIR) && forge clean >/dev/null && forge build && forge test

test-frontend: ensure-frontend-deps
	@cd $(FRONTEND_DIR) && npm run lint && npm run typecheck && npm run build

test-indexer: ensure-indexer-deps
	@cd $(INDEXER_DIR) && npm run typecheck

test: test-contracts test-frontend test-indexer

stop:
	@set -euo pipefail; \
	if [ -f "$(DEV_SESSION_ENV)" ]; then \
		. "$(DEV_SESSION_ENV)"; \
	else \
		ANVIL_PORT=$(ANVIL_PORT); WEB_PORT=$(WEB_PORT); INDEXER_PORT=$(INDEXER_PORT); \
	fi; \
	for port in "$$ANVIL_PORT" "$$WEB_PORT" "$$INDEXER_PORT"; do \
		kill $$(lsof -nP -iTCP:$$port -sTCP:LISTEN -t 2>/dev/null) >/dev/null 2>&1 || true; \
	done
	@echo "Stopped local dev processes for 19_CreatorRevenueCenter-On-chain."

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(CONTRACTS_DIR)/broadcast $(CONTRACTS_DIR)/deployments/local.json
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/out
	@rm -rf $(INDEXER_DIR)/node_modules $(INDEXER_DIR)/.ponder
	@rm -f "$(ANVIL_LOG)" "$(INDEXER_LOG)" "$(DEV_SESSION_ENV)"
	@echo "Cleaned build artifacts."
