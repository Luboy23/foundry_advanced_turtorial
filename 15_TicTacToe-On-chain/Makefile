SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_PID_FILE ?= .anvil.pid
ANVIL_LOG_FILE ?= .anvil.log

-include .env
ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif

CONTRACTS_DIR ?= contracts
FRONTEND_DIR ?= frontend
SYNC_SCRIPT ?= scripts/sync-contract.js
DEPLOY_SCRIPT ?= script/Deploy.s.sol:Deploy

.PHONY: anvil down restart-anvil deploy env frontend frontend-deps repair-frontend dev up help web build-contracts test clean

anvil:
	@if [ -f "$(ANVIL_PID_FILE)" ] && kill -0 $$(cat $(ANVIL_PID_FILE)) 2>/dev/null; then \
		echo "anvil already running (pid $$(cat $(ANVIL_PID_FILE)))"; \
	else \
		echo "Starting anvil on $(ANVIL_RPC_URL)..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 & \
		echo $$! > $(ANVIL_PID_FILE); \
		sleep 1; \
	fi

restart-anvil:
	@if ! command -v lsof >/dev/null 2>&1; then \
		echo "Missing command: lsof"; \
		exit 1; \
	fi
	@if [ -f "$(ANVIL_PID_FILE)" ]; then \
		pid_from_file=$$(cat $(ANVIL_PID_FILE) 2>/dev/null || true); \
		if [ -n "$$pid_from_file" ] && kill -0 $$pid_from_file 2>/dev/null; then \
			echo "Stopping anvil from pid file ($$pid_from_file)..."; \
			kill $$pid_from_file 2>/dev/null || true; \
		fi; \
	fi
	@pids=$$(lsof -ti tcp:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping existing listener(s) on port $(ANVIL_PORT): $$pids"; \
		kill $$pids 2>/dev/null || true; \
	fi
	@for i in {1..30}; do \
		pids=$$(lsof -ti tcp:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
		if [ -z "$$pids" ]; then break; fi; \
		sleep 0.2; \
	done
	@pids=$$(lsof -ti tcp:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Force killing stubborn listener(s) on port $(ANVIL_PORT): $$pids"; \
		kill -9 $$pids 2>/dev/null || true; \
	fi
	@for i in {1..20}; do \
		pids=$$(lsof -ti tcp:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
		if [ -z "$$pids" ]; then break; fi; \
		sleep 0.2; \
	done
	@if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		echo "Failed to free port $(ANVIL_PORT). Please stop the process manually and retry."; \
		exit 1; \
	fi
	@rm -f $(ANVIL_PID_FILE)
	@echo "Starting fresh anvil on $(ANVIL_RPC_URL)..."
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 & \
	echo $$! > $(ANVIL_PID_FILE); \
	sleep 1; \
	if ! kill -0 $$(cat $(ANVIL_PID_FILE)) 2>/dev/null; then \
		echo "Failed to start anvil. See $(ANVIL_LOG_FILE)"; \
		exit 1; \
	fi; \
	echo "anvil restarted (pid $$(cat $(ANVIL_PID_FILE)))"

down:
	@if [ -f "$(ANVIL_PID_FILE)" ]; then \
		kill $$(cat $(ANVIL_PID_FILE)) 2>/dev/null || true; \
		rm -f $(ANVIL_PID_FILE); \
		echo "Stopped anvil"; \
	else \
		echo "No anvil pid file found"; \
	fi

deploy: anvil
	@echo "Building contracts..."
	@cd $(CONTRACTS_DIR) && forge build >/dev/null
	@echo "Deploying TicTacToe stack..."
	@cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY)
	@node $(SYNC_SCRIPT) \
		--rpc-url $(ANVIL_RPC_URL) \
		--chain-id $(CHAIN_ID)

env:
	@ttt_address="$(TICTACTOE_ADDRESS)"; \
	if [ -z "$$ttt_address" ]; then ttt_address="$(ADDRESS)"; fi; \
	factory_address="$(SESSION_FACTORY_ADDRESS)"; \
	if [ -z "$$factory_address" ]; then factory_address="$(FACTORY_ADDRESS)"; fi; \
	if [ -z "$$ttt_address" ] || [ -z "$$factory_address" ]; then \
		echo "Usage: make env TICTACTOE_ADDRESS=0x... SESSION_FACTORY_ADDRESS=0x..."; \
		echo "Alias: make env ADDRESS=0x... FACTORY_ADDRESS=0x..."; \
		exit 1; \
	fi; \
	node $(SYNC_SCRIPT) \
		--tictactoe-address $$ttt_address \
		--session-factory-address $$factory_address \
		--rpc-url $(ANVIL_RPC_URL) \
		--chain-id $(CHAIN_ID)

frontend-deps:
	@cd $(FRONTEND_DIR) && \
	if [ ! -d node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		npm ci --no-audit --no-fund; \
	fi; \
	if [ ! -x node_modules/.bin/tsc ]; then \
		echo "TypeScript binary missing after dependency install."; \
		echo "Please inspect: ls -la $(FRONTEND_DIR)/node_modules/.bin"; \
		exit 1; \
	else \
		echo "Frontend dependencies are ready."; \
	fi

repair-frontend:
	@cd $(FRONTEND_DIR) && \
	echo "Repairing frontend dependencies from scratch..."; \
	rm -rf node_modules package-lock.json; \
	npm cache clean --force || true; \
	npm install; \
	if [ ! -x node_modules/.bin/next ]; then \
		echo "repair-frontend failed: next binary still missing."; \
		exit 1; \
	fi; \
	echo "Repair complete."

frontend: frontend-deps
	@cd $(FRONTEND_DIR) && \
	npm run dev

web: frontend

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build
	@node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

test:
	@cd $(CONTRACTS_DIR) && forge test
	@$(MAKE) frontend-deps
	@cd $(FRONTEND_DIR) && npm run typecheck

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(CONTRACTS_DIR)/broadcast $(FRONTEND_DIR)/.next $(ANVIL_PID_FILE) $(ANVIL_LOG_FILE)
	@echo "Cleaned build artifacts."

dev: restart-anvil deploy frontend

up: dev
	@echo "Tip: use 'make dev' (alias preserved)."

help:
	@echo "Targets:"
	@echo "  dev                Restart anvil, deploy, and run frontend"
	@echo "  up                 Alias of dev"
	@echo "  deploy             Deploy TicTacToe + SessionFactory and sync config"
	@echo "  frontend-deps      Ensure frontend dependencies are healthy"
	@echo "  repair-frontend    Force clean reinstall frontend dependencies"
	@echo "  frontend           Run frontend dev server"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts and sync ABI"
	@echo "  test               Run contract tests and frontend typecheck"
	@echo "  anvil              Start local anvil node"
	@echo "  restart-anvil      Restart anvil on configured port"
	@echo "  down               Stop anvil via .anvil.pid"
	@echo "  env                Manually sync frontend env/runtime config"
	@echo "  clean              Remove build artifacts and anvil files"
