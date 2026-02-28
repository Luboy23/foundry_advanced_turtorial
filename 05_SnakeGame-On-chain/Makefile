SHELL := /bin/bash

ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://127.0.0.1:$(ANVIL_PORT)
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_PID_FILE ?= .anvil.pid
ANVIL_LOG_FILE ?= .anvil.log

CONTRACTS_DIR ?= contracts
FRONTEND_DIR ?= frontend
ENV_FILE ?= $(FRONTEND_DIR)/.env.local
PUBLIC_CONFIG ?= $(FRONTEND_DIR)/public/scoreboard.json

.PHONY: anvil down restart-anvil deploy env frontend dev up help web build-contracts test clean

anvil:
	@if [ -f "$(ANVIL_PID_FILE)" ] && kill -0 $$(cat $(ANVIL_PID_FILE)) 2>/dev/null; then \
		echo "anvil already running (pid $$(cat $(ANVIL_PID_FILE)))"; \
	else \
		echo "Starting anvil on port $(ANVIL_PORT)..."; \
		anvil --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
		echo $$! > $(ANVIL_PID_FILE); \
		sleep 1; \
	fi

restart-anvil:
	@if ! command -v lsof >/dev/null 2>&1; then \
		echo "Missing command: lsof"; \
		exit 1; \
	fi
	@pids=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping anvil on port $(ANVIL_PORT)..."; \
		kill $$pids 2>/dev/null || true; \
	fi; \
	rm -f $(ANVIL_PID_FILE); \
	for i in {1..40}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	$(MAKE) anvil

down:
	@if [ -f "$(ANVIL_PID_FILE)" ]; then \
		kill $$(cat $(ANVIL_PID_FILE)) 2>/dev/null || true; \
		rm -f $(ANVIL_PID_FILE); \
		echo "Stopped anvil"; \
	else \
		echo "No anvil pid file found"; \
	fi

deploy: anvil
	@echo "Deploying scoreboard contract..."
	@cd $(CONTRACTS_DIR) && forge build
	@tmp=$$(mktemp); \
	(cd $(CONTRACTS_DIR) && forge script script/DeploySnakeScoreboard.s.sol \
		--rpc-url $(ANVIL_RPC_URL) \
		--private-key $(ANVIL_PRIVATE_KEY) \
		--broadcast --json > $$tmp); \
	node scripts/sync-contract.js; \
	address=$$(node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync('$(PUBLIC_CONFIG)','utf8'));process.stdout.write(d.address||'');}catch(e){}"); \
	if [ -z "$$address" ]; then \
		echo "Failed to parse deployed address from sync output."; \
		echo "Tip: re-run with: make deploy DEBUG=1"; \
		if [ "$(DEBUG)" = "1" ]; then cat "$$tmp"; fi; \
		rm -f $$tmp; \
		exit 1; \
	fi; \
	echo "Deployed at $$address"; \
	rm -f $$tmp

env:
	@if [ -z "$(ADDRESS)" ]; then \
		echo "ADDRESS is required. Example: make env ADDRESS=0x..."; \
		exit 1; \
	fi
	@mkdir -p $(FRONTEND_DIR)
	@echo "NEXT_PUBLIC_ANVIL_RPC_URL=$(ANVIL_RPC_URL)" > $(ENV_FILE)
	@echo "NEXT_PUBLIC_SCOREBOARD_ADDRESS=$(ADDRESS)" >> $(ENV_FILE)
	@echo "Wrote $(ENV_FILE)"
	@mkdir -p $(FRONTEND_DIR)/public
	@printf '{\n  "address": "%s",\n  "rpcUrl": "%s"\n}\n' "$(ADDRESS)" "$(ANVIL_RPC_URL)" > $(PUBLIC_CONFIG)
	@echo "Wrote $(PUBLIC_CONFIG)"

frontend:
	@cd $(FRONTEND_DIR) && \
	if [ ! -d node_modules ]; then npm install; fi; \
	npm run dev

# 标准化别名
web: frontend

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build

test:
	@cd $(CONTRACTS_DIR) && forge test

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out $(ANVIL_PID_FILE) $(ANVIL_LOG_FILE)
	@echo "Cleaned build artifacts."
dev: restart-anvil deploy frontend

up: dev
	@echo "Tip: use 'make dev' (alias preserved)."

help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy scoreboard contract and write env"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts"
	@echo "  test               Run contract tests"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
