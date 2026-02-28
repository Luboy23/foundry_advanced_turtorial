SHELL := /bin/bash
.DEFAULT_GOAL := dev

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
CONTRACTS_ENV := $(CONTRACTS_DIR)/.env
CONTRACTS_ENV_EXAMPLE := $(CONTRACTS_DIR)/.env.example
ENV_FILE := $(FRONTEND_DIR)/.env.local

ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
ANVIL_PID_FILE := .anvil.pid
ANVIL_LOG_FILE := .anvil.log

ANVIL_OWNER_SK ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_OWNER_PK ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

.PHONY: dev ensure-anvil restart-anvil generate-merkle deploy frontend web build-contracts test anvil clean help

ensure-anvil:
	@set -e; \
	for cmd in anvil forge npm nc node; do \
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

generate-merkle:
	@bash -euo pipefail -c '\
	update_env() { \
		file="$$1"; key="$$2"; value="$$3"; \
		tmp=$$(mktemp); \
		if [ -f "$$file" ]; then \
			grep -v "^$$key=" "$$file" > "$$tmp" || true; \
		fi; \
		echo "$$key=$$value" >> "$$tmp"; \
		mv "$$tmp" "$$file"; \
	}; \
	if [ ! -f "$(CONTRACTS_ENV)" ]; then \
		cp "$(CONTRACTS_ENV_EXAMPLE)" "$(CONTRACTS_ENV)"; \
	fi; \
	if [ ! -d "$(CONTRACTS_DIR)/node_modules" ]; then \
		(cd "$(CONTRACTS_DIR)" && npm install); \
	fi; \
	output=$$(cd "$(CONTRACTS_DIR)" && node script/generate_anvil_merkle.js); \
	root=$$(echo "$$output" | sed -n "s/^Merkle Root:[[:space:]]*//p"); \
	proof1=$$(echo "$$output" | sed -n "s/^User1 Merkle Proof:[[:space:]]*//p"); \
	proof2=$$(echo "$$output" | sed -n "s/^User2 Merkle Proof:[[:space:]]*//p"); \
	proof3=$$(echo "$$output" | sed -n "s/^User3 Merkle Proof:[[:space:]]*//p"); \
	if [ -z "$$root" ]; then \
		echo "$$output"; \
		echo "Failed to parse Merkle Root."; \
		exit 1; \
	fi; \
	update_env "$(CONTRACTS_ENV)" MERKLE_ROOT "$$root"; \
	update_env "$(CONTRACTS_ENV)" USER1_PROOF "$$proof1"; \
	update_env "$(CONTRACTS_ENV)" USER2_PROOF "$$proof2"; \
	update_env "$(CONTRACTS_ENV)" USER3_PROOF "$$proof3"; \
	echo "Updated Merkle data in $(CONTRACTS_ENV)"; \
	'

deploy: ensure-anvil generate-merkle
	@bash -euo pipefail -c '\
	update_env() { \
		file="$$1"; key="$$2"; value="$$3"; \
		tmp=$$(mktemp); \
		if [ -f "$$file" ]; then \
			grep -v "^$$key=" "$$file" > "$$tmp" || true; \
		fi; \
		echo "$$key=$$value" >> "$$tmp"; \
		mv "$$tmp" "$$file"; \
	}; \
	OWNER_SK=$$(grep "^OWNER_SK=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	OWNER_PK=$$(grep "^OWNER_PK=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	MERKLE_ROOT=$$(grep "^MERKLE_ROOT=" "$(CONTRACTS_ENV)" | cut -d= -f2-); \
	if [ -z "$$OWNER_SK" ]; then OWNER_SK="$(ANVIL_OWNER_SK)"; fi; \
	if [ -z "$$OWNER_PK" ]; then OWNER_PK="$(ANVIL_OWNER_PK)"; fi; \
	if [ -z "$$MERKLE_ROOT" ]; then echo "Missing MERKLE_ROOT in $(CONTRACTS_ENV)"; exit 1; fi; \
	echo "Deploying LuLuCoin..."; \
	out=$$(cd "$(CONTRACTS_DIR)" && forge create \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--private-key "$$OWNER_SK" \
		--broadcast \
		src/LuLuCoin.sol:LuLuCoin \
		--constructor-args "$$OWNER_PK"); \
	llc=$$(echo "$$out" | sed -n "s/.*Deployed to: //p" | head -n 1); \
	if [ -z "$$llc" ]; then echo "$$out"; exit 1; fi; \
	update_env "$(CONTRACTS_ENV)" LLC_CONTRACT "$$llc"; \
	echo "Deploying AirDrop..."; \
	out=$$(cd "$(CONTRACTS_DIR)" && forge create \
		--rpc-url "$(ANVIL_RPC_URL)" \
		--private-key "$$OWNER_SK" \
		--broadcast \
		src/LLCAirDrop.sol:LLCAirDrop \
		--constructor-args "$$MERKLE_ROOT" "$$llc"); \
	airdrop=$$(echo "$$out" | sed -n "s/.*Deployed to: //p" | head -n 1); \
	if [ -z "$$airdrop" ]; then echo "$$out"; exit 1; fi; \
	update_env "$(CONTRACTS_ENV)" AIRDROP_CONTRACT "$$airdrop"; \
	update_env "$(ENV_FILE)" NEXT_PUBLIC_AIRDROP_ADDRESS "$$airdrop"; \
	echo "Minting / transferring tokens..."; \
	$(MAKE) -C "$(CONTRACTS_DIR)" ETH_RPC_URL="$(ANVIL_RPC_URL)" mint transfer; \
	echo "Wrote $(ENV_FILE)"; \
	echo "LuLuCoin: $$llc"; \
	echo "AirDrop: $$airdrop"; \
	'

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
	@echo "  deploy             Deploy LuLuCoin + AirDrop and write env"
	@echo "  web                Run frontend dev server"
	@echo "  build-contracts    Compile contracts"
	@echo "  test               Run contract tests"
	@echo "  anvil              Start local anvil node"
	@echo "  clean              Remove build artifacts"
