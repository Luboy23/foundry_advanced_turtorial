# 使用 bash，便于在 recipe 中使用 for/brace 等语法
SHELL := /bin/bash

# Anvil 本地链参数（端口、RPC、部署私钥、进程与日志文件）
ANVIL_PORT ?= 8545
ANVIL_CHAIN_ID ?= 31337
ANVIL_RPC_URL ?= http://127.0.0.1:$(ANVIL_PORT)
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_PID_FILE ?= .anvil.pid
ANVIL_LOG_FILE ?= .anvil.log

# 项目目录与前端配置输出文件
CONTRACTS_DIR ?= contracts
FRONTEND_DIR ?= frontend
ENV_FILE ?= $(FRONTEND_DIR)/.env.local
PUBLIC_CONFIG ?= $(FRONTEND_DIR)/public/contract-config.json
LEGACY_PUBLIC_CONFIG ?= $(FRONTEND_DIR)/public/scoreboard.json

.PHONY: anvil down restart-anvil deploy env frontend frontend-install dev up help web build-contracts test clean

# 启动本地 Anvil；若已运行则直接复用已有进程
anvil:
	@if [ -f "$(ANVIL_PID_FILE)" ] && kill -0 $$(cat $(ANVIL_PID_FILE)) 2>/dev/null; then \
		echo "anvil already running (pid $$(cat $(ANVIL_PID_FILE)))"; \
	else \
		echo "Starting anvil on port $(ANVIL_PORT)..."; \
		anvil --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
		echo $$! > $(ANVIL_PID_FILE); \
		sleep 1; \
	fi

# 重启本地 Anvil：按端口清理旧进程，再重新拉起
restart-anvil:
	# 检查端口探测依赖命令是否可用
	@if ! command -v lsof >/dev/null 2>&1; then \
		echo "Missing command: lsof"; \
		exit 1; \
	fi
	# 按端口查找并停止旧进程，避免残留节点占用 8545
	@pids=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping anvil on port $(ANVIL_PORT)..."; \
		kill $$pids 2>/dev/null || true; \
	fi; \
	rm -f $(ANVIL_PID_FILE); \
	# 轮询等待端口释放，再调用 anvil target 启动新节点
	for i in {1..40}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	$(MAKE) anvil

# 按 PID 文件停止 Anvil（仅停止当前项目拉起的节点）
down:
	@if [ -f "$(ANVIL_PID_FILE)" ]; then \
		kill $$(cat $(ANVIL_PID_FILE)) 2>/dev/null || true; \
		rm -f $(ANVIL_PID_FILE); \
		echo "Stopped anvil"; \
	else \
		echo "No anvil pid file found"; \
	fi

# 一键部署合约并同步前端配置（会触发 contracts 编译）
deploy: anvil
	@echo "Deploying scoreboard contract..."
	@cd $(CONTRACTS_DIR) && forge build
	# 先把 forge script 的 json 输出落盘，失败时可配合 DEBUG=1 排查
	@tmp=$$(mktemp); \
	(cd $(CONTRACTS_DIR) && forge script script/DeploySnakeScoreboard.s.sol:DeploySnakeScoreboard \
		--rpc-url $(ANVIL_RPC_URL) \
		--private-key $(ANVIL_PRIVATE_KEY) \
		--broadcast --json > $$tmp); \
	node scripts/sync-contract.js --rpc-url $(ANVIL_RPC_URL) --chain-id $(ANVIL_CHAIN_ID); \
	address=$$(node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync('$(PUBLIC_CONFIG)','utf8'));process.stdout.write(d.scoreboardAddress||d.address||'');}catch(e){}"); \
	if [ -z "$$address" ]; then \
		echo "Failed to parse deployed address from sync output."; \
		echo "Tip: re-run with: make deploy DEBUG=1"; \
		if [ "$(DEBUG)" = "1" ]; then cat "$$tmp"; fi; \
		rm -f $$tmp; \
		exit 1; \
	fi; \
	echo "Deployed at $$address"; \
	rm -f $$tmp

# 手动写入前端 env 与 runtime 配置（会覆盖现有 .env.local / scoreboard.json）
env:
	@if [ -z "$(ADDRESS)" ]; then \
		echo "ADDRESS is required. Example: make env ADDRESS=0x..."; \
		exit 1; \
	fi
	@mkdir -p $(FRONTEND_DIR)
	@echo "NEXT_PUBLIC_ANVIL_RPC_URL=$(ANVIL_RPC_URL)" > $(ENV_FILE)
	@echo "NEXT_PUBLIC_RPC_URL=$(ANVIL_RPC_URL)" >> $(ENV_FILE)
	@echo "NEXT_PUBLIC_CHAIN_ID=$(ANVIL_CHAIN_ID)" >> $(ENV_FILE)
	@echo "NEXT_PUBLIC_SCOREBOARD_ADDRESS=$(ADDRESS)" >> $(ENV_FILE)
	@echo "Wrote $(ENV_FILE)"
	@mkdir -p $(FRONTEND_DIR)/public
	@printf '{\n  "scoreboardAddress": "%s",\n  "rpcUrl": "%s",\n  "chainId": %s\n}\n' "$(ADDRESS)" "$(ANVIL_RPC_URL)" "$(ANVIL_CHAIN_ID)" > $(PUBLIC_CONFIG)
	@echo "Wrote $(PUBLIC_CONFIG)"
	@printf '{\n  "address": "%s",\n  "rpcUrl": "%s"\n}\n' "$(ADDRESS)" "$(ANVIL_RPC_URL)" > $(LEGACY_PUBLIC_CONFIG)
	@echo "Wrote $(LEGACY_PUBLIC_CONFIG)"

# 启动前端开发服务器（首次自动 npm install）
frontend: frontend-install
	@cd $(FRONTEND_DIR) && \
	npm run dev

# 前端启动别名：与 frontend target 行为一致
web: frontend

# 仅构建合约（不部署）
build-contracts:
	@cd $(CONTRACTS_DIR) && forge build && cd .. && node scripts/sync-contract.js --rpc-url $(ANVIL_RPC_URL) --chain-id $(ANVIL_CHAIN_ID)

# 运行 Foundry 合约测试
frontend-install:
	@cd $(FRONTEND_DIR) && \
	if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi

test: frontend-install
	@cd $(CONTRACTS_DIR) && forge test
	@cd $(FRONTEND_DIR) && npm run typecheck

# 清理合约与前端构建产物、Anvil PID/日志
clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out $(ANVIL_PID_FILE) $(ANVIL_LOG_FILE)
	@echo "Cleaned build artifacts."

# 本地开发主入口：重启链 -> 部署 -> 启动前端
dev: restart-anvil deploy frontend

# 兼容别名：历史脚本仍可使用 make up
up: dev
	@echo "Tip: use 'make dev' (alias preserved)."

# 输出可用命令说明
help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy scoreboard contract and sync contract-config.json"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts"
	@echo "  test               Run contract tests"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
