SHELL := /bin/bash

CONTRACTS_DIR := $(CURDIR)/contracts
FRONTEND_DIR := $(CURDIR)/frontend
CONTRACT_PATH := src/BookManagement.sol:BookManagement
FORGE_CREATE_FLAGS ?= --broadcast

ANVIL_RPC_URL ?= http://127.0.0.1:8545
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
CHAIN_ID ?= 31337
WEB_PORT ?= 3000

RPC_URL ?= $(ANVIL_RPC_URL)
PRIVATE_KEY ?= $(ANVIL_PRIVATE_KEY)

.PHONY: help deploy web web-dev web-preview up build-contracts test anvil ensure-anvil restart-anvil clean dev

help:
	@echo "Targets:"
	@echo "  make deploy          Deploy BookManagement"
	@echo "  make web             Run Next.js dev server"
	@echo "  make web-preview     Run Next.js production preview server"
	@echo "  make web-dev         Alias for web"
	@echo "  make dev             Restart anvil, deploy, then run web (fast)"
	@echo "  make up              Alias for dev"
	@echo "  make build-contracts Compile contracts"
	@echo "  make test            Run contract tests"
	@echo "  make anvil           Start local anvil chain"
	@echo "  make clean           Remove build artifacts"

build-contracts:
	@cd "$(CONTRACTS_DIR)" && forge build

test:
	@cd "$(CONTRACTS_DIR)" && forge test

clean:
	@cd "$(CONTRACTS_DIR)" && forge clean
	@rm -rf "$(FRONTEND_DIR)/.next" "$(FRONTEND_DIR)/out"
	@rm -f "$(CURDIR)/.anvil.pid" "$(CURDIR)/.anvil.log"
	@echo "Cleaned forge, frontend, and anvil artifacts."

anvil:
	@anvil --chain-id "$(CHAIN_ID)" --host "$(ANVIL_HOST)" --port "$(ANVIL_PORT)"

ensure-anvil:
	@PORT="$(ANVIL_PORT)"; \
	if lsof -iTCP:"$$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
		echo "Anvil already running on $(ANVIL_HOST):$$PORT"; \
	else \
		echo "Starting anvil on $(ANVIL_HOST):$$PORT (chainId $(CHAIN_ID))..."; \
		nohup anvil --chain-id "$(CHAIN_ID)" --host "$(ANVIL_HOST)" --port "$$PORT" > "$(CURDIR)/.anvil.log" 2>&1 & \
		PID="$$!"; \
		echo "$$PID" > "$(CURDIR)/.anvil.pid"; \
		for i in {1..40}; do \
			if lsof -iTCP:"$$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
				echo "Anvil started (PID $$PID)"; \
				exit 0; \
			fi; \
			sleep 0.25; \
		done; \
		echo "Failed to start anvil. Check $(CURDIR)/.anvil.log"; \
		if [ -s "$(CURDIR)/.anvil.log" ]; then \
			echo "---- .anvil.log (tail) ----"; \
			tail -n 80 "$(CURDIR)/.anvil.log"; \
			echo "----------------------------"; \
		fi; \
		rm -f "$(CURDIR)/.anvil.pid"; \
		exit 1; \
	fi

restart-anvil:
	@if ! command -v lsof >/dev/null 2>&1; then \
		echo "Missing command: lsof"; \
		exit 1; \
	fi
	@pids=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "Stopping anvil on $(ANVIL_HOST):$(ANVIL_PORT)..."; \
		kill $$pids 2>/dev/null || true; \
	fi; \
	if [ -f "$(CURDIR)/.anvil.pid" ]; then \
		kill $$(cat "$(CURDIR)/.anvil.pid") 2>/dev/null || true; \
	fi; \
	rm -f "$(CURDIR)/.anvil.pid"; \
	for i in {1..40}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then break; fi; \
		sleep 0.2; \
	done; \
	$(MAKE) ensure-anvil

deploy:
	@if [ -z "$(RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "RPC_URL and PRIVATE_KEY are required"; \
		exit 1; \
	fi
	@if ! command -v node >/dev/null 2>&1; then \
		echo "Missing command: node (required for ABI sync)"; \
		exit 1; \
	fi
	@echo "Deploying BookManagement..."
	@DEPLOY_LOG=$$(mktemp); \
		cd "$(CONTRACTS_DIR)" && NO_COLOR=1 forge create --rpc-url "$(RPC_URL)" --private-key "$(PRIVATE_KEY)" $(FORGE_CREATE_FLAGS) "$(CONTRACT_PATH)" > $$DEPLOY_LOG 2>&1; \
		STATUS=$$?; \
		if [ $$STATUS -ne 0 ]; then \
			echo "Deploy output:"; \
			cat $$DEPLOY_LOG; \
			rm -f $$DEPLOY_LOG; \
			exit $$STATUS; \
		fi; \
		ADDR=$$(sed -n 's/.*Deployed to: //p' $$DEPLOY_LOG | tail -n1); \
		if [ -z "$$ADDR" ]; then \
			ADDR=$$(grep -Eo '0x[a-fA-F0-9]{40}' $$DEPLOY_LOG | tail -n1); \
		fi; \
		rm -f $$DEPLOY_LOG; \
		if [ -z "$$ADDR" ]; then \
			echo "Deploy succeeded but could not parse address."; \
			exit 1; \
		fi; \
		echo "Deployed to $$ADDR"; \
		if [ -f "$(FRONTEND_DIR)/.env.local" ]; then \
			grep -v '^NEXT_PUBLIC_CONTRACT_ADDRESS=' "$(FRONTEND_DIR)/.env.local" > "$(FRONTEND_DIR)/.env.local.tmp" || true; \
			mv "$(FRONTEND_DIR)/.env.local.tmp" "$(FRONTEND_DIR)/.env.local"; \
		fi; \
		echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$$ADDR" >> "$(FRONTEND_DIR)/.env.local"; \
		echo "Wrote $(FRONTEND_DIR)/.env.local"; \
		node "$(CURDIR)/scripts/sync-abi.mjs";

web:
	@PORT="$(WEB_PORT)"; \
	if command -v lsof >/dev/null 2>&1; then \
		if lsof -iTCP:"$$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			echo "Port $$PORT is in use. Searching for a free port..."; \
			while lsof -iTCP:"$$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; do \
				PORT=$$((PORT + 1)); \
			done; \
			echo "Using frontend port $$PORT"; \
		fi; \
	fi; \
	cd "$(FRONTEND_DIR)" && PORT="$$PORT" npm run dev

web-dev:
	@$(MAKE) web WEB_PORT="$(WEB_PORT)"

web-preview:
	@PORT="$(WEB_PORT)"; \
	if command -v lsof >/dev/null 2>&1; then \
		if lsof -iTCP:"$$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			echo "Port $$PORT is in use. Searching for a free port..."; \
			while lsof -iTCP:"$$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; do \
				PORT=$$((PORT + 1)); \
			done; \
			echo "Using frontend port $$PORT"; \
		fi; \
	fi; \
	cd "$(FRONTEND_DIR)" && PORT="$$PORT" npm run preview

dev:
	@$(MAKE) restart-anvil
	@$(MAKE) deploy
	@$(MAKE) web

up: dev
