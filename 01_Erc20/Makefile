SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_OWNER_ADDRESS ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

CONTRACT_PATH := src/LuLuCoin.sol:LuLuCoin
CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
ENV_FILE := $(FRONTEND_DIR)/.env.local
ANVIL_PID_FILE := .anvil.pid
ANVIL_LOG_FILE := .anvil.log

.PHONY: dev ensure-anvil restart-anvil deploy frontend web build-contracts test anvil clean help

ensure-anvil:
	@set -e; \
	for cmd in anvil forge npm nc; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil already running at $(ANVIL_RPC_URL)."; \
	else \
		echo "Starting Anvil on $(ANVIL_RPC_URL)..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
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

restart-anvil:
	@set -e; \
	for cmd in anvil nc lsof; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	pids=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$pids || true; \
	fi; \
	rm -f "$(ANVIL_PID_FILE)"; \
	for i in {1..40}; do \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	echo "Starting Anvil on $(ANVIL_RPC_URL)..."; \
	anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > $(ANVIL_LOG_FILE) 2>&1 & \
	echo $$! > $(ANVIL_PID_FILE); \
	for i in {1..40}; do \
		if nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then break; fi; \
		sleep 0.5; \
	done; \
	if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT) >/dev/null 2>&1; then \
		echo "Anvil failed to start. Check $(ANVIL_LOG_FILE)"; \
		exit 1; \
	fi

deploy: ensure-anvil
	@set -e; \
	echo "Deploying LuLuCoin..."; \
	output=$$(cd $(CONTRACTS_DIR) && forge create \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--private-key "$(ANVIL_PRIVATE_KEY)" \
		--broadcast \
		"$(CONTRACT_PATH)" \
		--constructor-args "$(ANVIL_OWNER_ADDRESS)"); \
	addr=$$(echo "$$output" | awk '/Deployed to:/ {print $$3}' | tail -n 1); \
	if [ -z "$$addr" ]; then \
		echo "$$output"; \
		echo "Failed to parse deployed address."; \
		exit 1; \
	fi; \
	mkdir -p "$(FRONTEND_DIR)"; \
	tmp=$$(mktemp); \
	if [ -f "$(ENV_FILE)" ]; then \
		grep -v '^NEXT_PUBLIC_LULUCOIN_ADDRESS=' "$(ENV_FILE)" > "$$tmp" || true; \
	fi; \
	echo "NEXT_PUBLIC_LULUCOIN_ADDRESS=$$addr" >> "$$tmp"; \
	mv "$$tmp" "$(ENV_FILE)"; \
	echo "Wrote $(ENV_FILE)"

frontend:
	@cd "$(FRONTEND_DIR)" && \
	if [ ! -d node_modules ]; then npm install; fi; \
	npm run dev

dev: restart-anvil deploy frontend

web: frontend

build-contracts:
	@cd "$(CONTRACTS_DIR)" && forge build

test:
	@cd "$(CONTRACTS_DIR)" && forge test

anvil:
	@anvil --host "$(ANVIL_HOST)" --port "$(ANVIL_PORT)"

clean:
	@rm -rf "$(CONTRACTS_DIR)/cache" "$(CONTRACTS_DIR)/out" "$(FRONTEND_DIR)/.next" "$(FRONTEND_DIR)/out" "$(ANVIL_LOG_FILE)" "$(ANVIL_PID_FILE)"
	@echo "Cleaned build artifacts."

help:
	@echo "Targets:"
	@echo "  dev                Start anvil, deploy, and run frontend"
	@echo "  deploy             Deploy LuLuCoin and write frontend env"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts"
	@echo "  test               Run contract tests"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
