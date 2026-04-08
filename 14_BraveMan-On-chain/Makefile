SHELL := /bin/bash
.DEFAULT_GOAL := help

PROJECT_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
ANVIL_LOG_FILE ?= $(PROJECT_DIR)/.anvil.log
ANVIL_PID_FILE ?= $(PROJECT_DIR)/.anvil.pid
API_LOG_FILE ?= $(PROJECT_DIR)/.api.log
API_PID_FILE ?= $(PROJECT_DIR)/.api.pid
API_HOST ?= 127.0.0.1
API_PORT ?= 8787
API_BIND ?= $(API_HOST):$(API_PORT)
WEB_PORT ?= 5173
CONTRACTS_DIR := $(PROJECT_DIR)/contracts
FRONTEND_DIR := $(PROJECT_DIR)/frontend
BACKEND_DIR := $(PROJECT_DIR)/backend
SCRIPTS_DIR := $(PROJECT_DIR)/scripts
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
API_SIGNER_PRIVATE_KEY ?= 0x59c6995e998f97a5a0044976f7d3d1b9d7f3c3d4a5f65f0dd5e9c1f9d9c1a111

-include $(PROJECT_DIR)/.env
ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif

.PHONY: help dev deploy export-rules web api build-contracts test test-backend test-frontend anvil restart-anvil restart-api stop clean

help:
	@echo "make dev             # 一键启动：anvil + deploy + api + web"
	@echo "make deploy          # 部署 BraveManGame 并同步前端/后端配置"
	@echo "make export-rules    # 导出前端规则集配置（xtask）"
	@echo "make web             # 启动前端开发服务器"
	@echo "make api             # 启动 Rust API 服务"
	@echo "make build-contracts # 编译合约"
	@echo "make test            # 运行合约测试"
	@echo "make test-backend    # 运行 Rust 测试"
	@echo "make test-frontend   # 运行前端检查"
	@echo "make anvil           # 启动本地链"
	@echo "make stop            # 停止前端 / API / Anvil 开发进程"
	@echo "make clean           # 清理构建产物"

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID)

restart-anvil:
	@set -e; \
	PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then kill $$PIDS || true; fi; \
	rm -f $(ANVIL_PID_FILE); \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	nohup anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 < /dev/null & \
	ANVIL_PID=$$!; \
	echo $$ANVIL_PID > $(ANVIL_PID_FILE); \
	STARTED=0; \
	for i in {1..30}; do \
		if ! kill -0 $$ANVIL_PID >/dev/null 2>&1; then break; fi; \
		if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then STARTED=1; break; fi; \
		sleep 0.2; \
	done; \
	if [ "$$STARTED" -ne 1 ]; then \
		echo "Anvil 启动失败"; \
		tail -n 80 $(ANVIL_LOG_FILE) 2>/dev/null || true; \
		exit 1; \
	fi

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build
	@node $(SCRIPTS_DIR)/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --signer-private-key $(API_SIGNER_PRIVATE_KEY)

deploy:
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then echo "forge 未安装"; exit 1; fi; \
	if ! command -v cast >/dev/null 2>&1; then echo "cast 未安装"; exit 1; fi; \
	if ! cast chain-id --rpc-url $(RPC_URL) >/dev/null 2>&1; then \
		echo "检测到本地链未就绪，正在启动 Anvil..."; \
		$(MAKE) restart-anvil >/dev/null; \
	fi; \
	(cd $(CONTRACTS_DIR) && forge build >/dev/null); \
	INITIAL_OWNER=$$(cast wallet address --private-key $(DEPLOYER_PRIVATE_KEY)); \
	SIGNER_ADDRESS=$$(cast wallet address --private-key $(API_SIGNER_PRIVATE_KEY)); \
	(cd $(CONTRACTS_DIR) && PRIVATE_KEY=$(DEPLOYER_PRIVATE_KEY) API_SIGNER_ADDRESS=$$SIGNER_ADDRESS INITIAL_OWNER=$$INITIAL_OWNER forge script $(DEPLOY_SCRIPT) --broadcast --rpc-url $(RPC_URL)); \
	node $(SCRIPTS_DIR)/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --signer-address $$SIGNER_ADDRESS --signer-private-key $(API_SIGNER_PRIVATE_KEY); \
	$(MAKE) export-rules

export-rules:
	@cd $(BACKEND_DIR) && cargo run -p xtask -- export-config --frontend $(FRONTEND_DIR) >/dev/null

restart-api:
	@set -e; \
	if [ -f $(API_PID_FILE) ]; then kill $$(cat $(API_PID_FILE)) >/dev/null 2>&1 || true; fi; \
	PIDS=$$(lsof -ti tcp:$(API_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then kill $$PIDS >/dev/null 2>&1 || true; fi; \
	rm -f $(API_PID_FILE); \
	(cd $(BACKEND_DIR) && cargo build -p braveman-api >/dev/null); \
	nohup /bin/bash -lc 'cd "$(BACKEND_DIR)" && BRAVEMAN_SIGNER_PRIVATE_KEY="$(API_SIGNER_PRIVATE_KEY)" BRAVEMAN_API_BIND="$(API_BIND)" exec ./target/debug/braveman-api' > $(API_LOG_FILE) 2>&1 < /dev/null & \
	API_PID=$$!; \
	echo $$API_PID > $(API_PID_FILE); \
	STARTED=0; \
	for i in {1..30}; do \
		if ! kill -0 $$API_PID >/dev/null 2>&1; then break; fi; \
		if lsof -iTCP:$(API_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then STARTED=1; break; fi; \
		sleep 0.2; \
	done; \
	if [ "$$STARTED" -ne 1 ]; then \
		echo "API 启动失败"; \
		tail -n 120 $(API_LOG_FILE) 2>/dev/null || true; \
		exit 1; \
	fi; \
	HEALTH_JSON=$$(curl -sS http://127.0.0.1:$(API_PORT)/api/health || true); \
	case "$$HEALTH_JSON" in \
		*'"ok":true'*) ;; \
		*) \
			echo "API 健康检查未通过: $$HEALTH_JSON"; \
			tail -n 120 $(API_LOG_FILE) 2>/dev/null || true; \
			exit 1; \
			;; \
	esac

api:
	@cd $(BACKEND_DIR) && cargo build -p braveman-api >/dev/null && BRAVEMAN_SIGNER_PRIVATE_KEY=$(API_SIGNER_PRIVATE_KEY) BRAVEMAN_API_BIND=$(API_BIND) ./target/debug/braveman-api

web:
	@set -e; \
	PIDS=$$(ps -ef | awk -v pat="$(FRONTEND_DIR)/node_modules/.bin/vite" 'index($$0, pat) && $$0 !~ /awk/ {print $$2}'); \
	if [ -n "$$PIDS" ]; then kill $$PIDS >/dev/null 2>&1 || true; fi; \
	PIDS=$$(lsof -ti tcp:$(WEB_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then kill $$PIDS >/dev/null 2>&1 || true; fi; \
	rm -rf $(FRONTEND_DIR)/node_modules/.vite; \
	cd $(FRONTEND_DIR) && npm install && npm run dev -- --host 0.0.0.0 --port $(WEB_PORT) --strictPort --force

dev: restart-anvil deploy restart-api web

stop:
	@set -euo pipefail; \
	stopped=0; \
	stop_pid_file() { \
		local label="$$1"; \
		local pid_file="$$2"; \
		local pattern="$$3"; \
		if [ -f "$$pid_file" ]; then \
			local pid; \
			pid=$$(cat "$$pid_file" 2>/dev/null || true); \
			if [ -n "$$pid" ]; then \
				local cmd; \
				cmd=$$(ps -p "$$pid" -o command= 2>/dev/null || true); \
				if [[ -n "$$cmd" && "$$cmd" == *"$$pattern"* ]]; then \
					kill "$$pid" >/dev/null 2>&1 || true; \
					echo "Stopped $$label (pid $$pid)"; \
					stopped=1; \
				fi; \
			fi; \
			rm -f "$$pid_file"; \
		fi; \
	}; \
	stop_port_match() { \
		local label="$$1"; \
		local port="$$2"; \
		local pattern="$$3"; \
		local pids; \
		pids=$$(lsof -ti tcp:$$port 2>/dev/null || true); \
		if [ -z "$$pids" ]; then \
			return; \
		fi; \
		for pid in $$pids; do \
			local cmd; \
			cmd=$$(ps -p "$$pid" -o command= 2>/dev/null || true); \
			if [[ -n "$$cmd" && "$$cmd" == *"$$pattern"* ]]; then \
				kill "$$pid" >/dev/null 2>&1 || true; \
				echo "Stopped $$label (pid $$pid, port $$port)"; \
				stopped=1; \
			fi; \
		done; \
	}; \
	stop_cmd_match() { \
		local label="$$1"; \
		local pattern="$$2"; \
		local pids; \
		pids=$$(ps -ef | awk -v pat="$$pattern" 'index($$0, pat) && $$0 !~ /awk/ {print $$2}'); \
		if [ -z "$$pids" ]; then \
			return; \
		fi; \
		for pid in $$pids; do \
			kill "$$pid" >/dev/null 2>&1 || true; \
			echo "Stopped $$label (pid $$pid)"; \
			stopped=1; \
		done; \
	}; \
	stop_pid_file "Anvil" "$(ANVIL_PID_FILE)" "anvil"; \
	stop_pid_file "API" "$(API_PID_FILE)" "braveman-api"; \
	stop_port_match "frontend" "$(WEB_PORT)" "$(FRONTEND_DIR)"; \
	stop_cmd_match "frontend" "$(FRONTEND_DIR)/node_modules/.bin/vite"; \
	stop_port_match "API" "$(API_PORT)" "braveman-api"; \
	stop_port_match "Anvil" "$(ANVIL_PORT)" "anvil"; \
	if [ "$$stopped" -eq 0 ]; then \
		echo "No BraveMan dev processes were running."; \
	fi

test:
	@cd $(CONTRACTS_DIR) && forge test

test-backend:
	@cd $(BACKEND_DIR) && cargo test

test-frontend:
	@cd $(FRONTEND_DIR) && npm install && npm run lint && npm run test && npm run build

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/test-results $(FRONTEND_DIR)/node_modules $(BACKEND_DIR)/target $(BACKEND_DIR)/braveman.sqlite $(ANVIL_LOG_FILE) $(ANVIL_PID_FILE) $(API_LOG_FILE) $(API_PID_FILE)
	@echo "Cleaned build artifacts."
