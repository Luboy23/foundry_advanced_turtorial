SHELL := /bin/bash

ANVIL_RPC_URL ?= http://127.0.0.1:8545
CHAIN_ID ?= 31337
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_LOG ?= /tmp/anvil-2048.log

CONTRACT_DIR := contracts
FRONTEND_DIR := frontend
SYNC_SCRIPT := scripts/sync-contract.js
DEPLOY_SCRIPT := script/Deploy.s.sol:Deploy

.PHONY: dev deploy anvil restart-anvil reset-anvil help web frontend-install build-contracts test clean

anvil:
	@python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.3); result=s.connect_ex(("127.0.0.1", 8545)); s.close(); sys.exit(0 if result==0 else 1)' || ( \
		echo "Starting Anvil..." && \
		anvil > "$(ANVIL_LOG)" 2>&1 & \
		sleep 1 \
	)

restart-anvil:
	@if ! command -v lsof >/dev/null 2>&1; then \
		echo "Missing command: lsof"; \
		exit 1; \
	fi
	@pids=$$(lsof -ti tcp:8545 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping Anvil on port 8545..."; \
		kill $$pids 2>/dev/null || true; \
	fi; \
	for i in {1..40}; do \
		if ! lsof -iTCP:8545 -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	$(MAKE) anvil

deploy: anvil
	@echo "Deploying contract to $(ANVIL_RPC_URL)..."
	@cd "$(CONTRACT_DIR)" && forge script "$(DEPLOY_SCRIPT)" \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--private-key "$(ANVIL_PRIVATE_KEY)" \
		--broadcast
	@node "$(SYNC_SCRIPT)" --rpc-url "$(ANVIL_RPC_URL)" --chain-id "$(CHAIN_ID)"

dev: restart-anvil deploy frontend-install
	@cd "$(FRONTEND_DIR)" && \
	npm run dev

web: frontend-install
	@cd "$(FRONTEND_DIR)" && \
	npm run dev

frontend-install:
	@cd "$(FRONTEND_DIR)" && \
	if [ ! -d node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		npm ci --no-audit --no-fund; \
	fi

build-contracts:
	@cd "$(CONTRACT_DIR)" && forge build
	@node "$(SYNC_SCRIPT)" --rpc-url "$(ANVIL_RPC_URL)" --chain-id "$(CHAIN_ID)"

test: frontend-install
	@cd "$(CONTRACT_DIR)" && forge test
	@cd "$(FRONTEND_DIR)" && npm run typecheck

clean:
	@rm -rf "$(CONTRACT_DIR)/cache" "$(CONTRACT_DIR)/out" "$(FRONTEND_DIR)/.next" "$(FRONTEND_DIR)/out" "$(ANVIL_LOG)"
	@echo "Cleaned build artifacts."

reset-anvil:
	@echo "Stopping Anvil and clearing local chain state..." ; \
	pkill -f "anvil" >/dev/null 2>&1 || true ; \
	rm -f "$(ANVIL_LOG)" ; \
	echo "Done. Restart with: make dev"

help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy contract and sync runtime config/ABI"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts and sync ABI"
	@echo "  test               Run contract tests and frontend typecheck"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
