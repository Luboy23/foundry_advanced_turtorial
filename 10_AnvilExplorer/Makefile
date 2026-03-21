SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST := 127.0.0.1
ANVIL_PORT := 8545
ANVIL_LOG ?= /tmp/anvil-explorer.log
FRONTEND_DIR := frontend
INDEXER_DIR := services/indexer
INDEXER_LOG ?= /tmp/anvil-explorer-indexer.log

.PHONY: help dev start web anvil indexer deploy build-contracts test clean check-frontend check-indexer

help: ## 列出可用命令
	@echo "Targets:"
	@echo "  dev / start         启动 Anvil + Indexer + 前端"
	@echo "  web                 启动前端开发服务器"
	@echo "  anvil               启动本地 Anvil 节点"
	@echo "  indexer             启动本地索引服务"
	@echo "  clean               清理前端构建产物"
	@echo "  deploy              预留：无合约可部署"
	@echo "  build-contracts     预留：无合约可编译"
	@echo "  test                前端 + indexer typecheck"

anvil: ## 启动本地 Anvil 节点
	@command -v anvil >/dev/null 2>&1 || { echo "anvil 未安装，请先安装 Foundry。"; exit 1; }
	@python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.3); result=s.connect_ex(("$(ANVIL_HOST)", $(ANVIL_PORT))); s.close(); sys.exit(0 if result==0 else 1)' || ( \
		echo "启动 Anvil..." && \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > "$(ANVIL_LOG)" 2>&1 & \
		sleep 1 \
	)

web: ## 启动前端开发服务器
	@if [ ! -d $(FRONTEND_DIR)/node_modules ]; then \
		cd $(FRONTEND_DIR) && npm install; \
	fi
	@cd $(FRONTEND_DIR) && npm run dev

indexer: ## 启动本地索引服务
	@if [ ! -d $(INDEXER_DIR)/node_modules ]; then \
		cd $(INDEXER_DIR) && npm install; \
	fi
	@cd $(INDEXER_DIR) && npm run dev

dev: anvil ## 一键启动：Anvil + Indexer + 前端
	@if [ ! -d $(INDEXER_DIR)/node_modules ]; then \
		cd $(INDEXER_DIR) && npm install; \
	fi
	@set -euo pipefail; \
	cd $(INDEXER_DIR); npm run dev > "$(INDEXER_LOG)" 2>&1 & INDEXER_PID=$$!; \
	trap 'kill "$$INDEXER_PID" >/dev/null 2>&1 || true' EXIT; \
	cd ../../$(FRONTEND_DIR); npm run dev

start: dev ## 别名：一键启动

deploy: ## 预留：无合约可部署
	@echo "No contracts to deploy in 10_AnvilExplorer."

build-contracts: ## 预留：无合约可编译
	@echo "No contracts to build in 10_AnvilExplorer."

check-frontend: ## 前端质量基线
	@cd $(FRONTEND_DIR) && npm run lint && npm run typecheck && npm run test && npm run build

check-indexer: ## indexer 质量基线
	@cd $(INDEXER_DIR) && npm run typecheck

test: check-frontend check-indexer ## 别名：前端+indexer 回归

clean: ## 清理前端构建产物
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/out
	@rm -rf $(INDEXER_DIR)/node_modules $(INDEXER_DIR)/dist
	@rm -rf .data
	@rm -f "$(ANVIL_LOG)" "$(INDEXER_LOG)"
