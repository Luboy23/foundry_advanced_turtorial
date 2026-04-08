SHELL := /bin/bash

PROJECT_GITHUB ?= https://github.com/lllu23/foundry_advanced_turtorial
RPC_URL ?= http://127.0.0.1:8545
CHAIN_ID ?= 31337
PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
POSITION_URI_BASE ?= ipfs://polymarket/{id}.json

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
FRONTEND_ENV := $(FRONTEND_DIR)/.env.local
FRONTEND_CONFIG_JSON := $(FRONTEND_DIR)/public/contract-config.json
FRONTEND_ABI_DIR := $(FRONTEND_DIR)/src/abi
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy
SYNC_SCRIPT := scripts/sync-contract.js

.PHONY: help dev deploy web build-contracts test anvil clean restart-anvil ensure-anvil frontend-install

help:
	@echo "make help            # 查看全部命令"
	@echo "make dev             # 一键启动：restart-anvil + deploy + web"
	@echo "make deploy          # 部署 v2 模块合约并同步前端地址/ABI"
	@echo "make web             # 启动前端 Next 开发服务器"
	@echo "make build-contracts # 编译合约"
	@echo "make test            # 运行 Foundry 测试"
	@echo "make anvil           # 启动本地 Anvil"
	@echo "make clean           # 清理构建产物"

anvil:
	@anvil --chain-id $(CHAIN_ID)

ensure-anvil:
	@set -euo pipefail; \
	if ! cast chain-id --rpc-url $(RPC_URL) >/dev/null 2>&1; then \
		echo "[make] anvil 未运行，正在后台启动..."; \
		nohup anvil --chain-id $(CHAIN_ID) > .anvil.log 2>&1 & echo $$! > .anvil.pid; \
		sleep 1; \
	fi

restart-anvil:
	@set -euo pipefail; \
	if [ -f .anvil.pid ]; then \
		kill $$(cat .anvil.pid) >/dev/null 2>&1 || true; \
		rm -f .anvil.pid; \
	fi; \
	pkill -f "anvil --chain-id $(CHAIN_ID)" >/dev/null 2>&1 || true; \
	nohup anvil --chain-id $(CHAIN_ID) > .anvil.log 2>&1 & echo $$! > .anvil.pid; \
	sleep 1

deploy: ensure-anvil
	@set -euo pipefail; \
	command -v forge >/dev/null 2>&1 || { echo "forge not found"; exit 1; }; \
	(cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) --sig "run(string)" "$(POSITION_URI_BASE)" --broadcast --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY)); \
	node $(SYNC_SCRIPT) --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --project-github "$(PROJECT_GITHUB)"

web: frontend-install
	@set -euo pipefail; \
	next_pattern="$(abspath $(FRONTEND_DIR))/node_modules/.bin/next dev"; \
	if pgrep -f "$$next_pattern" >/dev/null 2>&1; then \
		echo "[make] 检测到 frontend 已有 next dev 进程，请先停止旧进程后再重试。"; \
		exit 1; \
	fi; \
	rm -f $(FRONTEND_DIR)/.next/dev/lock; \
	cd $(FRONTEND_DIR) && npm run dev

dev: restart-anvil deploy web

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build
	@node $(SYNC_SCRIPT) --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --project-github "$(PROJECT_GITHUB)"

test: frontend-install
	@cd $(CONTRACTS_DIR) && forge test
	@cd $(FRONTEND_DIR) && npm run typecheck

clean:
	@cd $(CONTRACTS_DIR) && forge clean
	@rm -rf $(FRONTEND_DIR)/.next
	@rm -f .anvil.pid .anvil.log $(FRONTEND_ENV) $(FRONTEND_CONFIG_JSON)

frontend-install: $(FRONTEND_DIR)/node_modules

$(FRONTEND_DIR)/node_modules: $(FRONTEND_DIR)/package-lock.json
	@cd $(FRONTEND_DIR) && npm ci --no-audit --no-fund
