SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_PID_FILE ?= .anvil.pid
ANVIL_LOG_FILE ?= .anvil.log

CONTRACTS_DIR := contracts
ZK_DIR := zk
FRONTEND_DIR := frontend
BACKEND_DIR := backend
SYNC_SCRIPT := scripts/sync-contract.js
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy
BACKEND_HOST ?= 127.0.0.1
BACKEND_PORT ?= 8787
BACKEND_DATABASE_URL ?= file:$(abspath $(BACKEND_DIR)/dev.db)
BACKEND_TEST_DATABASE_URL ?= file:$(abspath $(BACKEND_DIR)/test.db)
BACKEND_STORAGE_DIR ?= $(abspath $(BACKEND_DIR)/storage)
BACKEND_ROOT_DIR ?= $(abspath $(BACKEND_DIR))
BACKEND_PID_FILE ?= .backend.pid
BACKEND_LOG_FILE ?= .backend.log
BACKEND_CONTRACT_CONFIG_PATH ?= $(abspath $(FRONTEND_DIR)/public/contract-config.json)

-include .env

ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif

.PHONY: zk-deps frontend-deps backend-deps frontend-backend-types backend-sync-types build-zk test-zk build-contracts ensure-anvil stop-anvil restart-anvil anvil stop-backend reset-backend-state backend-up deploy test clean dev dev-fresh down web backend backend-dev backend-test help

zk-deps:
	@cd $(ZK_DIR) && \
	if [ ! -f package-lock.json ]; then \
		echo "Installing zk dependencies (initial)..."; \
		npm install --no-audit --no-fund; \
	elif [ ! -d node_modules ]; then \
		echo "Installing zk dependencies..."; \
		npm ci --no-audit --no-fund; \
	else \
		echo "ZK dependencies are ready."; \
	fi

frontend-deps:
	@cd $(FRONTEND_DIR) && \
	if [ ! -f package-lock.json ]; then \
		echo "Installing frontend dependencies (initial)..."; \
		npm install --no-audit --no-fund; \
	elif [ ! -d node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		npm ci --no-audit --no-fund; \
	else \
		echo "Frontend dependencies are ready."; \
	fi

backend-deps:
	@cd $(BACKEND_DIR) && \
	if [ ! -f package-lock.json ]; then \
		echo "Installing backend dependencies (initial)..."; \
		npm install --no-audit --no-fund; \
	elif [ ! -d node_modules ]; then \
		echo "Installing backend dependencies..."; \
		npm ci --no-audit --no-fund; \
	else \
		echo "Backend dependencies are ready."; \
	fi

frontend-backend-types: frontend-deps
	@cd $(FRONTEND_DIR) && npm run backend:types

backend-sync-types: frontend-backend-types

build-zk: zk-deps
	@cd $(ZK_DIR) && npm run build

test-zk: build-zk
	@cd $(ZK_DIR) && npm run test

build-contracts: build-zk
	@cd $(CONTRACTS_DIR) && forge build
	@node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

ensure-anvil:
	@set -e; \
	for cmd in anvil nc; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil already running at $(ANVIL_RPC_URL)."; \
	else \
		echo "Starting Anvil on $(ANVIL_RPC_URL)..."; \
		nohup anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 < /dev/null & \
		echo $$! > $(ANVIL_PID_FILE); \
		for i in {1..40}; do \
			if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
			sleep 0.5; \
		done; \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
			echo "Anvil failed to start. Check $(ANVIL_LOG_FILE)"; \
			exit 1; \
		fi; \
	fi

stop-anvil:
	@set -e; \
	command -v lsof >/dev/null 2>&1 || { echo "Missing command: lsof"; exit 1; }; \
	pids=""; \
	if [ -f $(ANVIL_PID_FILE) ]; then \
		pid=$$(cat $(ANVIL_PID_FILE) 2>/dev/null || true); \
		if [ -n "$$pid" ] && kill -0 "$$pid" 2>/dev/null; then \
			pids="$$pids $$pid"; \
		fi; \
	fi; \
	listen_pids=$$(lsof -ti tcp:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$listen_pids" ]; then \
		pids="$$pids $$listen_pids"; \
	fi; \
	pids=$$(printf '%s\n' $$pids | awk 'NF' | sort -u | tr '\n' ' '); \
	if [ -z "$$pids" ]; then \
		echo "No running Anvil detected on port $(ANVIL_PORT)."; \
		rm -f $(ANVIL_PID_FILE); \
		exit 0; \
	fi; \
	echo "Stopping Anvil process(es): $$pids"; \
	kill $$pids 2>/dev/null || true; \
	for i in {1..25}; do \
		remaining=""; \
		for pid in $$pids; do \
			if kill -0 "$$pid" 2>/dev/null; then \
				remaining="$$remaining $$pid"; \
			fi; \
		done; \
		if [ -z "$$remaining" ] && ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.2; \
	done; \
	remaining=""; \
	for pid in $$pids; do \
		if kill -0 "$$pid" 2>/dev/null; then \
			remaining="$$remaining $$pid"; \
		fi; \
	done; \
	if [ -n "$$remaining" ]; then \
		echo "Force killing Anvil process(es): $$remaining"; \
		kill -9 $$remaining 2>/dev/null || true; \
	fi; \
	for i in {1..25}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.2; \
	done; \
	if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		echo "Failed to stop Anvil listener(s) on port $(ANVIL_PORT)."; \
		exit 1; \
	fi; \
	rm -f $(ANVIL_PID_FILE)

restart-anvil:
	@set -e; \
	for cmd in anvil nc; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	$(MAKE) stop-anvil; \
	echo "Starting fresh Anvil on $(ANVIL_RPC_URL)..."; \
	rm -f $(ANVIL_LOG_FILE); \
	nohup anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 < /dev/null & \
	echo $$! > $(ANVIL_PID_FILE); \
	for i in {1..40}; do \
		if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.25; \
	done; \
	if ! kill -0 $$(cat $(ANVIL_PID_FILE)) 2>/dev/null || ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Failed to start Anvil. Check $(ANVIL_LOG_FILE)"; \
		exit 1; \
	fi

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID)

deploy: ensure-anvil build-contracts
	@cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) \
		--broadcast \
		--rpc-url $(ANVIL_RPC_URL) \
		--private-key $(DEPLOYER_PRIVATE_KEY)
	@node $(SYNC_SCRIPT) --rpc-url $(ANVIL_RPC_URL) --chain-id $(CHAIN_ID)

stop-backend:
	@set -e; \
	command -v lsof >/dev/null 2>&1 || { echo "Missing command: lsof"; exit 1; }; \
	pids=""; \
	if [ -f $(BACKEND_PID_FILE) ]; then \
		pid=$$(cat $(BACKEND_PID_FILE) 2>/dev/null || true); \
		if [ -n "$$pid" ] && kill -0 "$$pid" 2>/dev/null; then \
			pids="$$pids $$pid"; \
		fi; \
	fi; \
	listen_pids=$$(lsof -ti tcp:$(BACKEND_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$listen_pids" ]; then \
		pids="$$pids $$listen_pids"; \
	fi; \
	pids=$$(printf '%s\n' $$pids | awk 'NF' | sort -u | tr '\n' ' '); \
	if [ -z "$$pids" ]; then \
		echo "No running backend detected on port $(BACKEND_PORT)."; \
		rm -f $(BACKEND_PID_FILE); \
		exit 0; \
	fi; \
	echo "Stopping backend process(es): $$pids"; \
	kill $$pids 2>/dev/null || true; \
	for i in {1..25}; do \
		remaining=""; \
		for pid in $$pids; do \
			if kill -0 "$$pid" 2>/dev/null; then \
				remaining="$$remaining $$pid"; \
			fi; \
		done; \
		if [ -z "$$remaining" ] && ! lsof -iTCP:$(BACKEND_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.2; \
	done; \
	remaining=""; \
	for pid in $$pids; do \
		if kill -0 "$$pid" 2>/dev/null; then \
			remaining="$$remaining $$pid"; \
		fi; \
	done; \
	if [ -n "$$remaining" ]; then \
		echo "Force killing backend process(es): $$remaining"; \
		kill -9 $$remaining 2>/dev/null || true; \
	fi; \
	rm -f $(BACKEND_PID_FILE)

reset-backend-state:
	@rm -rf $(BACKEND_STORAGE_DIR)
	@rm -f $(BACKEND_DIR)/dev.db $(BACKEND_DIR)/dev.db-journal $(BACKEND_DIR)/dev.db-shm $(BACKEND_DIR)/dev.db-wal
	@rm -f $(BACKEND_DIR)/prisma/dev.db $(BACKEND_DIR)/prisma/dev.db-journal $(BACKEND_DIR)/prisma/dev.db-shm $(BACKEND_DIR)/prisma/dev.db-wal

backend-up: frontend-deps backend-deps
	@set -e; \
	$(MAKE) stop-backend; \
	rm -f $(BACKEND_LOG_FILE); \
	(cd $(BACKEND_DIR) && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) \
	BACKEND_HOST=$(BACKEND_HOST) \
	BACKEND_PORT=$(BACKEND_PORT) \
	BACKEND_DATABASE_URL=$(BACKEND_DATABASE_URL) \
	BACKEND_STORAGE_DIR=$(BACKEND_STORAGE_DIR) \
	BACKEND_CHAIN_RPC_URL=$(ANVIL_RPC_URL) \
	BACKEND_CHAIN_ID=$(CHAIN_ID) \
	BACKEND_CONTRACT_CONFIG_PATH=$(BACKEND_CONTRACT_CONFIG_PATH) \
	npm run prisma:generate && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) \
	BACKEND_HOST=$(BACKEND_HOST) \
	BACKEND_PORT=$(BACKEND_PORT) \
	BACKEND_DATABASE_URL=$(BACKEND_DATABASE_URL) \
	BACKEND_STORAGE_DIR=$(BACKEND_STORAGE_DIR) \
	BACKEND_CHAIN_RPC_URL=$(ANVIL_RPC_URL) \
	BACKEND_CHAIN_ID=$(CHAIN_ID) \
	BACKEND_CONTRACT_CONFIG_PATH=$(BACKEND_CONTRACT_CONFIG_PATH) \
	npm run db:init && \
	npm run build); \
	nohup env \
		BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) \
		BACKEND_HOST=$(BACKEND_HOST) \
		BACKEND_PORT=$(BACKEND_PORT) \
		BACKEND_DATABASE_URL=$(BACKEND_DATABASE_URL) \
		BACKEND_STORAGE_DIR=$(BACKEND_STORAGE_DIR) \
		BACKEND_CHAIN_RPC_URL=$(ANVIL_RPC_URL) \
		BACKEND_CHAIN_ID=$(CHAIN_ID) \
		BACKEND_CONTRACT_CONFIG_PATH=$(BACKEND_CONTRACT_CONFIG_PATH) \
		node $(BACKEND_DIR)/dist/main.js > $(BACKEND_LOG_FILE) 2>&1 < /dev/null & \
	echo $$! > $(BACKEND_PID_FILE); \
	for i in {1..40}; do \
		if curl -sS http://$(BACKEND_HOST):$(BACKEND_PORT)/api/health >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.5; \
	done; \
	if ! curl -sS http://$(BACKEND_HOST):$(BACKEND_PORT)/api/health >/dev/null 2>&1; then \
		echo "NestJS backend failed to start. Check $(BACKEND_LOG_FILE)"; \
		exit 1; \
	fi

test: build-contracts test-zk frontend-deps
	@cd $(CONTRACTS_DIR) && forge test
	@cd $(FRONTEND_DIR) && npm run check && npm run test

web: frontend-deps
	@cd $(FRONTEND_DIR) && npm run dev

backend:
	@$(MAKE) backend-deps
	@cd $(BACKEND_DIR) && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) \
	BACKEND_HOST=$(BACKEND_HOST) \
	BACKEND_PORT=$(BACKEND_PORT) \
	BACKEND_DATABASE_URL=$(BACKEND_DATABASE_URL) \
	BACKEND_STORAGE_DIR=$(BACKEND_STORAGE_DIR) \
	BACKEND_CHAIN_RPC_URL=$(ANVIL_RPC_URL) \
	BACKEND_CHAIN_ID=$(CHAIN_ID) \
	BACKEND_CONTRACT_CONFIG_PATH=$(BACKEND_CONTRACT_CONFIG_PATH) \
	npm run prisma:generate && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) \
	BACKEND_HOST=$(BACKEND_HOST) \
	BACKEND_PORT=$(BACKEND_PORT) \
	BACKEND_DATABASE_URL=$(BACKEND_DATABASE_URL) \
	BACKEND_STORAGE_DIR=$(BACKEND_STORAGE_DIR) \
	BACKEND_CHAIN_RPC_URL=$(ANVIL_RPC_URL) \
	BACKEND_CHAIN_ID=$(CHAIN_ID) \
	BACKEND_CONTRACT_CONFIG_PATH=$(BACKEND_CONTRACT_CONFIG_PATH) \
	npm run db:init && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) \
	BACKEND_HOST=$(BACKEND_HOST) \
	BACKEND_PORT=$(BACKEND_PORT) \
	BACKEND_DATABASE_URL=$(BACKEND_DATABASE_URL) \
	BACKEND_STORAGE_DIR=$(BACKEND_STORAGE_DIR) \
	BACKEND_CHAIN_RPC_URL=$(ANVIL_RPC_URL) \
	BACKEND_CHAIN_ID=$(CHAIN_ID) \
	BACKEND_CONTRACT_CONFIG_PATH=$(BACKEND_CONTRACT_CONFIG_PATH) \
		npm run dev

backend-test:
	@$(MAKE) frontend-deps
	@$(MAKE) backend-deps
	@rm -f $(BACKEND_DIR)/test.db $(BACKEND_DIR)/test.db-journal $(BACKEND_DIR)/test.db-shm $(BACKEND_DIR)/test.db-wal
	@cd $(BACKEND_DIR) && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) BACKEND_DATABASE_URL=$(BACKEND_TEST_DATABASE_URL) npm run prisma:generate && \
	BACKEND_ROOT_DIR=$(BACKEND_ROOT_DIR) BACKEND_DATABASE_URL=$(BACKEND_TEST_DATABASE_URL) npm run db:init && \
	npm run test && \
	npm run typecheck
	@rm -f $(BACKEND_DIR)/test.db $(BACKEND_DIR)/test.db-journal $(BACKEND_DIR)/test.db-shm $(BACKEND_DIR)/test.db-wal

backend-dev: backend

dev: restart-anvil deploy backend-up backend-sync-types web

dev-fresh: restart-anvil deploy reset-backend-state backend-up backend-sync-types web

down:
	@$(MAKE) stop-backend
	@$(MAKE) stop-anvil

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(CONTRACTS_DIR)/broadcast
	@rm -f $(CONTRACTS_DIR)/src/UniversityCutoffProofVerifier.sol $(CONTRACTS_DIR)/src/Verifier.sol $(CONTRACTS_DIR)/test/generated/SampleAdmissionFixture.sol $(CONTRACTS_DIR)/test/generated/SampleExamFixture.sol
	@rm -rf $(ZK_DIR)/build $(ZK_DIR)/data/generated/*
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/coverage
	@rm -rf $(BACKEND_DIR)/dist $(BACKEND_DIR)/target $(BACKEND_DIR)/storage
	@rm -f $(BACKEND_DIR)/dev.db $(BACKEND_DIR)/dev.db-journal $(BACKEND_DIR)/dev.db-shm $(BACKEND_DIR)/dev.db-wal $(BACKEND_DIR)/test.db $(BACKEND_DIR)/test.db-journal $(BACKEND_DIR)/test.db-shm $(BACKEND_DIR)/test.db-wal $(BACKEND_DIR)/prisma/dev.db $(BACKEND_DIR)/prisma/dev.db-journal $(BACKEND_DIR)/prisma/dev.db-shm $(BACKEND_DIR)/prisma/dev.db-wal $(BACKEND_DIR)/prisma/test.db $(BACKEND_DIR)/prisma/test.db-journal $(BACKEND_DIR)/prisma/test.db-shm $(BACKEND_DIR)/prisma/test.db-wal
	@rm -f $(FRONTEND_DIR)/public/contract-config.json $(FRONTEND_DIR)/abi/*.json $(FRONTEND_DIR)/public/examples/*.json $(FRONTEND_DIR)/public/zk/*
	@rm -f $(ANVIL_PID_FILE) $(ANVIL_LOG_FILE) $(BACKEND_PID_FILE) $(BACKEND_LOG_FILE)
	@touch $(ZK_DIR)/data/generated/.gitkeep $(FRONTEND_DIR)/public/.gitkeep $(FRONTEND_DIR)/abi/.gitkeep $(FRONTEND_DIR)/public/examples/.gitkeep $(FRONTEND_DIR)/public/zk/.gitkeep
	@echo "Cleaned build artifacts."

help:
	@echo "Targets:"
	@echo "  build-zk         Build the gaokao admission circuit, verifier, and sample admission data"
	@echo "  test-zk          Run zk proof success/failure checks"
	@echo "  build-contracts  Build zk artifacts, compile Foundry contracts, sync ABI/config"
	@echo "  deploy           Ensure anvil, deploy contracts, register demo roles, sync config"
	@echo "  test             Run zk tests, forge tests, frontend check, and frontend vitest"
	@echo "  dev              Force-stop any existing Anvil, deploy contracts, reuse backend/dev.db, start NestJS, sync OpenAPI types, then start the frontend"
	@echo "  dev-fresh        Force-stop any existing Anvil, deploy contracts, reset backend/dev.db and storage, then start the full stack"
	@echo "  web              Start the formal Next admission frontend"
	@echo "  backend          Start the NestJS backend in foreground"
	@echo "  backend-up       Start the NestJS backend in background"
	@echo "  reset-backend-state  Remove local SQLite db and backend storage for a fresh demo state"
	@echo "  backend-test     Run NestJS backend tests and typecheck on a temporary SQLite database"
	@echo "  backend-sync-types  Generate frontend backend API types from OpenAPI"
	@echo "  frontend-backend-types  Generate frontend backend API types from OpenAPI"
	@echo "  down             Stop backend and anvil"
	@echo "  clean            Remove generated artifacts"
