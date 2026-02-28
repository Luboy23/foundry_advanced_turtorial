SHELL := /bin/bash

# 根目录（执行 Makefile 的当前路径）
ROOT_DIR := $(CURDIR)

# 本地 Anvil 节点配置（可通过环境变量覆盖）
ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)

# Anvil 默认测试助记词与私钥（仅本地开发使用）
ANVIL_MNEMONIC ?= test test test test test test test test test test test junk
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# 用于部署合约的私钥（默认沿用 Anvil 第一个账户）
DEPLOY_PRIVATE_KEY ?= $(ANVIL_PRIVATE_KEY)

# Anvil 进程 PID 与日志文件
ANVIL_PID_FILE := $(ROOT_DIR)/.anvil.pid
ANVIL_LOG_FILE := $(ROOT_DIR)/.anvil.log
# 前端环境变量文件（写入合约地址）
FRONTEND_DIR := $(ROOT_DIR)/frontend
ENV_FILE := $(FRONTEND_DIR)/.env.local

# Foundry 合约路径（forge create 的目标）
CONTRACT_PATH := src/FlappyScoreboard.sol:FlappyScoreboard

# 伪目标声明
.PHONY: dev anvil restart-anvil wait-anvil deploy frontend web stop-anvil status sync-contract \
	frontend-install frontend-build frontend-preview frontend-lint help build-contracts test clean

# 一键开发：restart-anvil → deploy → frontend（确保链就绪、写入地址、启动前端）
dev: restart-anvil deploy frontend

# 启动 Anvil（如果已运行则跳过）
anvil:
	@bash -euo pipefail -c '\
	if curl -s -X POST -H "Content-Type: application/json" \
		--data '\''{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'\'' \
		$(RPC_URL) | grep -q '\''"result"'\''; then \
		echo "Anvil already running at $(RPC_URL)."; \
	else \
		if [[ -f "$(ANVIL_PID_FILE)" ]]; then \
			pid=$$(cat "$(ANVIL_PID_FILE)"); \
			if ps -p "$$pid" >/dev/null 2>&1; then \
				echo "Anvil already running (pid $$pid)."; \
			else \
				rm -f "$(ANVIL_PID_FILE)"; \
			fi; \
		fi; \
		if [[ ! -f "$(ANVIL_PID_FILE)" ]]; then \
			echo "Starting anvil..."; \
			nohup anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) \
				--mnemonic "$(ANVIL_MNEMONIC)" > "$(ANVIL_LOG_FILE)" 2>&1 & \
			echo $$! > "$(ANVIL_PID_FILE)"; \
		fi; \
	fi'
	@$(MAKE) wait-anvil

# 强制重启 Anvil：按端口杀进程 → 等待端口释放 → 调用 anvil 启动并探活
restart-anvil:
	@bash -euo pipefail -c '\
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "缺少 lsof 命令，请先安装"; \
		exit 1; \
	fi; \
	PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	rm -f "$(ANVIL_PID_FILE)"; \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.2; \
	done; \
	'
	@$(MAKE) anvil

# 等待 Anvil 就绪（轮询 eth_blockNumber）
wait-anvil:
	@bash -euo pipefail -c '\
	echo "Waiting for anvil at $(RPC_URL)..."; \
	for i in {1..50}; do \
		if curl -s -X POST -H "Content-Type: application/json" \
			--data '\''{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'\'' \
			$(RPC_URL) | grep -q '\''"result"'\''; then \
			echo "Anvil ready."; \
			exit 0; \
		fi; \
		sleep 0.2; \
	done; \
	echo "Anvil not responding at $(RPC_URL)."; \
	exit 1'

# 部署合约并写入前端环境变量（VITE_FLAPPY_SCORE_ADDRESS）
deploy: wait-anvil
	@bash -euo pipefail -c '\
	echo "Deploying FlappyScoreboard..."; \
	cd contracts; \
	addr=$$(forge create --rpc-url $(RPC_URL) --private-key $(DEPLOY_PRIVATE_KEY) --broadcast \
		$(CONTRACT_PATH) | awk '\''/Deployed to:/ {print $$3}'\''); \
	if [[ -z "$$addr" ]]; then \
		echo "Failed to parse deployed address."; \
		exit 1; \
	fi; \
	cd "$(ROOT_DIR)"; \
	env_file="$(ENV_FILE)"; \
	if [[ ! -f "$$env_file" ]]; then \
		touch "$$env_file"; \
	fi; \
	if grep -q '\''^VITE_FLAPPY_SCORE_ADDRESS='\'' "$$env_file"; then \
		sed -i "" "s/^VITE_FLAPPY_SCORE_ADDRESS=.*/VITE_FLAPPY_SCORE_ADDRESS=$$addr/" "$$env_file"; \
	else \
		echo "VITE_FLAPPY_SCORE_ADDRESS=$$addr" >> "$$env_file"; \
	fi; \
	echo "Wrote VITE_FLAPPY_SCORE_ADDRESS to $$env_file"; \
	echo "Deployed to $$addr"; \
	'
	@$(MAKE) sync-contract

# 同步合约 ABI 与地址到前端（写入 components/Web3）
sync-contract:
	@node scripts/sync-contract.js

# 启动前端开发服务器（Vite）
frontend:
	cd $(FRONTEND_DIR) && npm run dev

# 标准化别名
web: frontend

build-contracts:
	@cd contracts && forge build

test:
	@cd contracts && forge test

# 安装前端依赖
frontend-install:
	cd $(FRONTEND_DIR) && npm install

# 前端生产构建
frontend-build:
	cd $(FRONTEND_DIR) && npm run build

# 前端本地预览
frontend-preview:
	cd $(FRONTEND_DIR) && npm run preview

# 前端代码检查
frontend-lint:
	cd $(FRONTEND_DIR) && npm run lint

# 停止 Anvil 并清理 PID 文件
stop-anvil:
	@bash -euo pipefail -c '\
	if [[ -f "$(ANVIL_PID_FILE)" ]]; then \
		pid=$$(cat "$(ANVIL_PID_FILE)"); \
		if ps -p "$$pid" >/dev/null 2>&1; then \
			kill "$$pid"; \
			echo "Stopped anvil (pid $$pid)."; \
		fi; \
		rm -f "$(ANVIL_PID_FILE)"; \
	else \
		echo "No anvil pid file found."; \
	fi'

# 检查 Anvil 是否可响应
status:
	@bash -euo pipefail -c '\
	if curl -s -X POST -H "Content-Type: application/json" \
		--data '\''{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'\'' \
		$(RPC_URL) | grep -q '\''"result"'\''; then \
		echo "Anvil responding at $(RPC_URL)."; \
	else \
		echo "Anvil not responding at $(RPC_URL)."; \
	fi'

clean:
	@rm -rf contracts/cache contracts/out $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite $(ANVIL_PID_FILE) $(ANVIL_LOG_FILE)
	@echo "Cleaned build artifacts."

help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy contract and write frontend env"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts"
	@echo "  test               Run contract tests"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
