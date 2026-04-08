SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST := 127.0.0.1
ANVIL_PORT := 8545
ANVIL_LOG ?= /tmp/anvil-explorer.log
FRONTEND_DIR := frontend
INDEXER_DIR := services/indexer
INDEXER_LOG ?= /tmp/anvil-explorer-indexer.log

.PHONY: help dev start web anvil indexer api stop deploy build-contracts test test-frontend test-backend clean check-frontend check-indexer ensure-frontend-deps ensure-indexer-deps

help: ## 列出可用命令
	@echo "Targets:"
	@echo "  dev / start         启动 Anvil + Indexer + 前端"
	@echo "  web                 启动前端开发服务器"
	@echo "  anvil               启动本地 Anvil 节点"
	@echo "  indexer / api       启动本地索引服务"
	@echo "  stop                停止本地 Anvil / Indexer / 前端开发进程"
	@echo "  clean               清理前端构建产物"
	@echo "  deploy              预留：服务型项目无业务合约"
	@echo "  build-contracts     预留：服务型项目无业务合约"
	@echo "  test                前端 + indexer 回归入口"
	@echo "  test-frontend       前端 lint + typecheck + test + build"
	@echo "  test-backend        indexer lint + typecheck + health smoke"

anvil: ## 启动本地 Anvil 节点
	@command -v anvil >/dev/null 2>&1 || { echo "anvil 未安装，请先安装 Foundry。"; exit 1; }
	@python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.3); result=s.connect_ex(("$(ANVIL_HOST)", $(ANVIL_PORT))); s.close(); sys.exit(0 if result==0 else 1)' || ( \
		echo "启动 Anvil..." && \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > "$(ANVIL_LOG)" 2>&1 & \
		sleep 1 \
	)

web: ensure-frontend-deps ## 启动前端开发服务器
	@cd $(FRONTEND_DIR) && npm run dev

indexer: ensure-indexer-deps ## 启动本地索引服务
	@cd $(INDEXER_DIR) && npm run dev

api: indexer ## 别名：服务型项目对外统一使用 api 入口

dev: anvil ensure-indexer-deps ensure-frontend-deps ## 一键启动：Anvil + Indexer + 前端
	@set -euo pipefail; \
	cd $(INDEXER_DIR); npm run dev > "$(INDEXER_LOG)" 2>&1 & INDEXER_PID=$$!; \
	trap 'kill "$$INDEXER_PID" >/dev/null 2>&1 || true' EXIT; \
	cd ../../$(FRONTEND_DIR); npm run dev

start: dev ## 别名：一键启动

deploy: ## 预留：无合约可部署
	@echo "No contracts to deploy in 10_AnvilExplorer (service-only project)."

build-contracts: ## 预留：无合约可编译
	@echo "No contracts to build in 10_AnvilExplorer (service-only project)."

ensure-frontend-deps:
	@cd $(FRONTEND_DIR) && \
	if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi

ensure-indexer-deps:
	@cd $(INDEXER_DIR) && \
	if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi

check-frontend: ensure-frontend-deps ## 前端质量基线
	@cd $(FRONTEND_DIR) && npm run lint && npm run typecheck && npm run test && npm run build

check-indexer: ensure-indexer-deps ## indexer 质量基线
	@cd $(INDEXER_DIR) && npm run lint && npm run typecheck && npm run test:health

test-frontend: check-frontend ## 前端回归入口

test-backend: check-indexer ## 后端回归入口

test: test-frontend test-backend ## 别名：前端+indexer 回归

stop: ## 停止本地开发进程
	@PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then kill $$PIDS >/dev/null 2>&1 || true; fi
	@PIDS=$$(lsof -ti tcp:8787 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then kill $$PIDS >/dev/null 2>&1 || true; fi
	@PIDS=$$(ps -ef | awk -v pat="$(FRONTEND_DIR)/node_modules/.bin/next dev" 'index($$0, pat) && $$0 !~ /awk/ {print $$2}'); \
	if [ -n "$$PIDS" ]; then kill $$PIDS >/dev/null 2>&1 || true; fi
	@echo "Stopped local dev processes for 10_AnvilExplorer."

clean: ## 清理前端构建产物
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/out
	@rm -rf $(INDEXER_DIR)/node_modules $(INDEXER_DIR)/dist
	@rm -rf .data
	@rm -f "$(ANVIL_LOG)" "$(INDEXER_LOG)"
