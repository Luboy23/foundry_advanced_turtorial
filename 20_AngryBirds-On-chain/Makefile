SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
CHAIN_ID ?= 31337
API_BASE_URL ?= http://127.0.0.1:8788/api
ANVIL_LOG_FILE ?= .anvil.log
ANVIL_PID_FILE ?= .anvil.pid
API_HOST ?= 127.0.0.1
API_PORT ?= 8788
API_BIND ?= $(API_HOST):$(API_PORT)
API_LOG_FILE ?= .api.log
API_PID_FILE ?= .api.pid
API_START_TIMEOUT_SECONDS ?= 90
BACKEND_DIR := backend
DEV_DB_DIR ?= .dev-data

-include .env
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ifeq ($(strip $(PRIVATE_KEY)),)
DEPLOYER_PRIVATE_KEY := $(ANVIL_PRIVATE_KEY)
else
DEPLOYER_PRIVATE_KEY := $(PRIVATE_KEY)
endif

ifeq ($(origin DEPLOYMENT_ID),command line)
EFFECTIVE_DEPLOYMENT_ID := $(DEPLOYMENT_ID)
else ifeq ($(origin DEPLOYMENT_ID),environment)
EFFECTIVE_DEPLOYMENT_ID := $(DEPLOYMENT_ID)
else
EFFECTIVE_DEPLOYMENT_ID := local-dev-$(shell date +%Y%m%d%H%M%S)
endif

DEFAULT_DATABASE_URL = sqlite://./$(DEV_DB_DIR)/angrybirds-$(EFFECTIVE_DEPLOYMENT_ID).sqlite

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy
REGISTER_SCRIPT := script/RegisterLevels.s.sol:RegisterLevels

.PHONY: help dev deploy web api restart-api frontend-install build-contracts build-levels build-stages register-levels register-stages test test-frontend test-backend smoke anvil ensure-anvil restart-anvil clean

help:
	@echo "Targets:"
	@echo "  make dev             # anvil + deploy + rust api + web"
	@echo "  make deploy          # deploy contracts and sync ABI/config"
	@echo "  DEPLOYMENT_ID=...    # optional fixed deployment scope for reproducible local runs"
	@echo "  API_START_TIMEOUT_SECONDS=90 # optional Rust API startup wait window for cold builds"
	@echo "  make build-levels    # build canonical level manifest and hashes"
	@echo "  make build-stages    # alias of build-levels"
	@echo "  make register-levels # register level manifest on chain"
	@echo "  make register-stages # alias of register-levels"
	@echo "  make api             # start Rust backend API"
	@echo "  make restart-api     # restart Rust backend API in background"
	@echo "  make web             # start Vite frontend"
	@echo "  make build-contracts # forge build and sync ABI"
	@echo "  make test-backend    # cargo test"
	@echo "  make test-frontend   # frontend lint + typecheck + build + unit"
	@echo "  make test            # forge test + frontend lint/typecheck/build"
	@echo "  make smoke           # deploy + frontend unit + smoke e2e"
	@echo "  make anvil           # start local chain"
	@echo "  make restart-anvil   # restart local chain"
	@echo "  make clean           # clean build artifacts"

dev: restart-anvil deploy restart-api web

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID)

ensure-anvil:
	@set -e; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "lsof is required"; \
		exit 1; \
	fi; \
	if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		echo "Anvil already running on port $(ANVIL_PORT)."; \
	else \
		echo "Starting Anvil..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 & \
		echo $$! > $(ANVIL_PID_FILE); \
		for i in {1..50}; do \
			if lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
			sleep 0.2; \
		done; \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			echo "Anvil failed to start, inspect $(ANVIL_LOG_FILE)"; \
			exit 1; \
		fi; \
	fi

restart-anvil:
	@set -e; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "lsof is required"; \
		exit 1; \
	fi; \
	PIDS=$$(lsof -tiTCP:$(ANVIL_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	rm -f $(ANVIL_PID_FILE); \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	echo "Starting Anvil..."; \
	anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) --chain-id $(CHAIN_ID) > $(ANVIL_LOG_FILE) 2>&1 & \
	echo $$! > $(ANVIL_PID_FILE); \
	sleep 1

deploy: ensure-anvil build-levels
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge is required"; \
		exit 1; \
	fi; \
	echo "Building contracts..."; \
	(cd $(CONTRACTS_DIR) && forge build >/dev/null); \
	echo "Deploying contracts..."; \
	(cd $(CONTRACTS_DIR) && forge script $(DEPLOY_SCRIPT) --broadcast --rpc-url $(RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) --sig "run(string)" "$(EFFECTIVE_DEPLOYMENT_ID)"); \
	echo "Syncing runtime config after deploy..."; \
	node scripts/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --deployment-id "$(EFFECTIVE_DEPLOYMENT_ID)" --api-base-url $(API_BASE_URL); \
	echo "Registering levels..."; \
	$(MAKE) register-levels RPC_URL=$(RPC_URL) CHAIN_ID=$(CHAIN_ID) DEPLOYMENT_ID="$(EFFECTIVE_DEPLOYMENT_ID)" DEPLOYER_PRIVATE_KEY=$(DEPLOYER_PRIVATE_KEY); \
	echo "Syncing frontend ABI and runtime config..."; \
	node scripts/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --deployment-id "$(EFFECTIVE_DEPLOYMENT_ID)" --api-base-url $(API_BASE_URL)

build-levels:
	@node scripts/build-level-manifest.js

build-stages: build-levels

register-levels:
	@set -e; \
	REGISTRY_ADDRESS=$$(node -e "const fs=require('fs');const path=require('path');const target=path.join(process.cwd(),'frontend','public','contract-config.json');const config=JSON.parse(fs.readFileSync(target,'utf8'));process.stdout.write(config.angryBirdsLevelCatalogAddress||'');"); \
	if [ -z "$$REGISTRY_ADDRESS" ] || [ "$$REGISTRY_ADDRESS" = "0x0000000000000000000000000000000000000000" ]; then \
		echo "Level catalog address not found. Run make deploy first."; \
		exit 1; \
	fi; \
	(cd $(CONTRACTS_DIR) && forge script $(REGISTER_SCRIPT) --broadcast --rpc-url $(RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) --sig "run(address)" $$REGISTRY_ADDRESS)

register-stages: register-levels

api:
	@set -e; \
	mkdir -p $(DEV_DB_DIR); \
	if [ -z "$(strip $(ANGRY_BIRDS_DATABASE_URL))" ] && [ -f "$(DEV_DB_DIR)/angrybirds-.sqlite" ]; then \
		echo "Ignoring legacy dev database $(DEV_DB_DIR)/angrybirds-.sqlite"; \
	fi; \
	ANGRY_BIRDS_API_BIND=$(API_BIND) \
	ANGRY_BIRDS_DATABASE_URL=$${ANGRY_BIRDS_DATABASE_URL:-$(DEFAULT_DATABASE_URL)} \
	ANGRY_BIRDS_RPC_URL=$${ANGRY_BIRDS_RPC_URL:-$(RPC_URL)} \
	ANGRY_BIRDS_CHAIN_ID=$${ANGRY_BIRDS_CHAIN_ID:-$(CHAIN_ID)} \
	ANGRY_BIRDS_DEPLOYMENT_ID=$${ANGRY_BIRDS_DEPLOYMENT_ID:-$(EFFECTIVE_DEPLOYMENT_ID)} \
	ANGRY_BIRDS_RELAYER_PRIVATE_KEY=$${ANGRY_BIRDS_RELAYER_PRIVATE_KEY:-$(DEPLOYER_PRIVATE_KEY)} \
	ANGRY_BIRDS_VERIFIER_PRIVATE_KEY=$${ANGRY_BIRDS_VERIFIER_PRIVATE_KEY:-$(DEPLOYER_PRIVATE_KEY)} \
	ANGRY_BIRDS_SESSION_TTL_SECONDS=$${ANGRY_BIRDS_SESSION_TTL_SECONDS:-7200} \
	ANGRY_BIRDS_SESSION_MAX_RUNS=$${ANGRY_BIRDS_SESSION_MAX_RUNS:-10} \
	ANGRY_BIRDS_MAX_BATCH_RUNS=$${ANGRY_BIRDS_MAX_BATCH_RUNS:-8} \
	ANGRY_BIRDS_AUTO_FINALIZE_IDLE_SECONDS=$${ANGRY_BIRDS_AUTO_FINALIZE_IDLE_SECONDS:-45} \
	ANGRY_BIRDS_INDEXER_POLL_INTERVAL_MS=$${ANGRY_BIRDS_INDEXER_POLL_INTERVAL_MS:-3000} \
	ANGRY_BIRDS_INDEXER_CONFIRMATIONS=$${ANGRY_BIRDS_INDEXER_CONFIRMATIONS:-0} \
	ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS=$${ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS:-$$(node -e "const fs=require('fs');const path=require('path');const target=path.join(process.cwd(),'frontend','public','contract-config.json');const config=JSON.parse(fs.readFileSync(target,'utf8'));process.stdout.write(config.angryBirdsLevelCatalogAddress||'');")} \
	ANGRY_BIRDS_SCOREBOARD_ADDRESS=$${ANGRY_BIRDS_SCOREBOARD_ADDRESS:-$$(node -e "const fs=require('fs');const path=require('path');const target=path.join(process.cwd(),'frontend','public','contract-config.json');const config=JSON.parse(fs.readFileSync(target,'utf8'));process.stdout.write(config.angryBirdsScoreboardAddress||'');")} \
	cargo run --manifest-path $(BACKEND_DIR)/Cargo.toml -p angrybirds-api

restart-api:
	@set -e; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "lsof is required"; \
		exit 1; \
	fi; \
	PIDS=$$(lsof -tiTCP:$(API_PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping API on port $(API_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	rm -f $(API_PID_FILE); \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(API_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	if lsof -iTCP:$(API_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		echo "API port $(API_PORT) is still busy. Stop the stale process, then retry make restart-api."; \
		exit 1; \
	fi; \
	echo "Starting Rust API..."; \
	mkdir -p $(DEV_DB_DIR); \
	if [ -z "$(strip $(ANGRY_BIRDS_DATABASE_URL))" ] && [ -f "$(DEV_DB_DIR)/angrybirds-.sqlite" ]; then \
		echo "Ignoring legacy dev database $(DEV_DB_DIR)/angrybirds-.sqlite"; \
	fi; \
	ANGRY_BIRDS_API_BIND=$(API_BIND) \
	ANGRY_BIRDS_DATABASE_URL=$${ANGRY_BIRDS_DATABASE_URL:-$(DEFAULT_DATABASE_URL)} \
	ANGRY_BIRDS_RPC_URL=$${ANGRY_BIRDS_RPC_URL:-$(RPC_URL)} \
	ANGRY_BIRDS_CHAIN_ID=$${ANGRY_BIRDS_CHAIN_ID:-$(CHAIN_ID)} \
	ANGRY_BIRDS_DEPLOYMENT_ID=$${ANGRY_BIRDS_DEPLOYMENT_ID:-$(EFFECTIVE_DEPLOYMENT_ID)} \
	ANGRY_BIRDS_RELAYER_PRIVATE_KEY=$${ANGRY_BIRDS_RELAYER_PRIVATE_KEY:-$(DEPLOYER_PRIVATE_KEY)} \
	ANGRY_BIRDS_VERIFIER_PRIVATE_KEY=$${ANGRY_BIRDS_VERIFIER_PRIVATE_KEY:-$(DEPLOYER_PRIVATE_KEY)} \
	ANGRY_BIRDS_SESSION_TTL_SECONDS=$${ANGRY_BIRDS_SESSION_TTL_SECONDS:-7200} \
	ANGRY_BIRDS_SESSION_MAX_RUNS=$${ANGRY_BIRDS_SESSION_MAX_RUNS:-10} \
	ANGRY_BIRDS_MAX_BATCH_RUNS=$${ANGRY_BIRDS_MAX_BATCH_RUNS:-8} \
	ANGRY_BIRDS_AUTO_FINALIZE_IDLE_SECONDS=$${ANGRY_BIRDS_AUTO_FINALIZE_IDLE_SECONDS:-45} \
	ANGRY_BIRDS_INDEXER_POLL_INTERVAL_MS=$${ANGRY_BIRDS_INDEXER_POLL_INTERVAL_MS:-3000} \
	ANGRY_BIRDS_INDEXER_CONFIRMATIONS=$${ANGRY_BIRDS_INDEXER_CONFIRMATIONS:-0} \
	ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS=$${ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS:-$$(node -e "const fs=require('fs');const path=require('path');const target=path.join(process.cwd(),'frontend','public','contract-config.json');const config=JSON.parse(fs.readFileSync(target,'utf8'));process.stdout.write(config.angryBirdsLevelCatalogAddress||'');")} \
	ANGRY_BIRDS_SCOREBOARD_ADDRESS=$${ANGRY_BIRDS_SCOREBOARD_ADDRESS:-$$(node -e "const fs=require('fs');const path=require('path');const target=path.join(process.cwd(),'frontend','public','contract-config.json');const config=JSON.parse(fs.readFileSync(target,'utf8'));process.stdout.write(config.angryBirdsScoreboardAddress||'');")} \
	cargo run --manifest-path $(BACKEND_DIR)/Cargo.toml -p angrybirds-api > $(API_LOG_FILE) 2>&1 & \
	API_PID=$$!; \
	echo $$API_PID > $(API_PID_FILE); \
	MAX_POLLS=$$(( $(API_START_TIMEOUT_SECONDS) * 5 )); \
	STARTED=0; \
	for ((i = 0; i < $$MAX_POLLS; i++)); do \
		if lsof -iTCP:$(API_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		if ! kill -0 $$API_PID >/dev/null 2>&1; then \
			echo "Rust API exited before binding port $(API_PORT), inspect $(API_LOG_FILE)"; \
			tail -n 80 $(API_LOG_FILE) 2>/dev/null || true; \
			exit 1; \
		fi; \
		sleep 0.2; \
	done; \
	if lsof -iTCP:$(API_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		STARTED=1; \
	fi; \
	if [ $$STARTED -ne 1 ]; then \
		echo "Rust API is still starting after $(API_START_TIMEOUT_SECONDS)s, inspect $(API_LOG_FILE)"; \
		tail -n 80 $(API_LOG_FILE) 2>/dev/null || true; \
		exit 1; \
	fi

web: frontend-install
	@cd $(FRONTEND_DIR) && npm run dev

frontend-install:
	@cd $(FRONTEND_DIR) && \
	if [ ! -d node_modules ]; then npm install --no-audit --no-fund; fi

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build
	@node scripts/sync-contract.js --rpc-url $(RPC_URL) --chain-id $(CHAIN_ID) --deployment-id "$(EFFECTIVE_DEPLOYMENT_ID)" --api-base-url $(API_BASE_URL)

test-backend:
	@cargo test --manifest-path $(BACKEND_DIR)/Cargo.toml

test-frontend: frontend-install build-levels
	@cd $(FRONTEND_DIR) && npm run lint && npm run typecheck && npm run build && npm run test:unit

test: frontend-install build-levels
	@cd $(CONTRACTS_DIR) && forge test
	@cargo test --manifest-path $(BACKEND_DIR)/Cargo.toml
	@cd $(FRONTEND_DIR) && npm run lint && npm run typecheck && npm run build && npm run test:unit

smoke: frontend-install
	@$(MAKE) deploy
	@cd $(FRONTEND_DIR) && npm run test:unit && npm run test:e2e:smoke

clean:
	@rm -rf $(CONTRACTS_DIR)/cache $(CONTRACTS_DIR)/out $(FRONTEND_DIR)/dist $(ANVIL_LOG_FILE) $(ANVIL_PID_FILE)
	@echo "Cleaned build artifacts."
