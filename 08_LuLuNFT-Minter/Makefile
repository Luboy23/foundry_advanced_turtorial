SHELL := /bin/bash
.DEFAULT_GOAL := dev

ANVIL_HOST := 127.0.0.1
ANVIL_PORT := 8545
ANVIL_RPC_URL := http://$(ANVIL_HOST):$(ANVIL_PORT)

-include .env
DEPLOYER_PRIVATE_KEY ?= $(PRIVATE_KEY)

# 合约路径（基于 --root contracts，所以从 src/ 开始）
NFT_CONTRACT := src/MyNFT.sol:MyNFT
MARKET_CONTRACT := src/FixedPriceMarket.sol:FixedPriceMarket

NFT_NAME ?= LuLuNFT
NFT_SYMBOL ?= LULU

ENV_FILE := frontend/.env.local

.PHONY: help dev deploy web build-contracts anvil test clean

help:
	@echo "Targets:"
	@echo "  make dev            Start anvil, deploy NFT, run frontend"
	@echo "  make deploy         Deploy NFT + Market and write frontend env"
	@echo "  make web            Run Next.js dev server"
	@echo "  make build-contracts  Compile contracts"
	@echo "  make test           Run contract tests"
	@echo "  make anvil          Start a local anvil chain"
	@echo "  make clean          Remove build artifacts"

build-contracts:
	@forge build --root contracts

anvil:
	@anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT)

deploy:
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	if [ -z "$(DEPLOYER_PRIVATE_KEY)" ]; then \
		echo "未设置 DEPLOYER_PRIVATE_KEY（可在 .env 中配置 PRIVATE_KEY）"; \
		exit 1; \
	fi; \
	echo "部署 NFT 合约..."; \
	NFT_OUTPUT=$$(forge create --root contracts --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) $(NFT_CONTRACT) --constructor-args "$(NFT_NAME)" "$(NFT_SYMBOL)"); \
	NFT_ADDRESS=$$(echo "$$NFT_OUTPUT" | awk '/Deployed to:/ {print $$3}'); \
	if [ -z "$$NFT_ADDRESS" ]; then \
		echo "解析 NFT 合约地址失败"; \
		echo "$$NFT_OUTPUT"; \
		exit 1; \
	fi; \
	echo "部署 Market 合约..."; \
	MARKET_OUTPUT=$$(forge create --root contracts --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) $(MARKET_CONTRACT) --constructor-args "$$NFT_ADDRESS"); \
	MARKET_ADDRESS=$$(echo "$$MARKET_OUTPUT" | awk '/Deployed to:/ {print $$3}'); \
	if [ -z "$$MARKET_ADDRESS" ]; then \
		echo "解析 Market 合约地址失败"; \
		echo "$$MARKET_OUTPUT"; \
		exit 1; \
	fi; \
	tmp=$$(mktemp); \
	if [ -f $(ENV_FILE) ]; then \
		grep -v -e '^NEXT_PUBLIC_NFT_ADDRESS=' -e '^NEXT_PUBLIC_RPC_URL=' -e '^NEXT_PUBLIC_MARKET_ADDRESS=' $(ENV_FILE) > $$tmp || true; \
	fi; \
	echo "NEXT_PUBLIC_RPC_URL=$(ANVIL_RPC_URL)" >> $$tmp; \
	echo "NEXT_PUBLIC_NFT_ADDRESS=$$NFT_ADDRESS" >> $$tmp; \
	echo "NEXT_PUBLIC_MARKET_ADDRESS=$$MARKET_ADDRESS" >> $$tmp; \
	mv $$tmp $(ENV_FILE); \
	echo "NFT 合约地址: $$NFT_ADDRESS"; \
	echo "Market 合约地址: $$MARKET_ADDRESS"

web:
	@set -e; \
	if [ ! -d frontend/node_modules ]; then \
		( cd frontend && npm install ); \
	fi; \
	cd frontend; \
	npm run dev

dev:
	@set -e; \
	if ! command -v anvil >/dev/null 2>&1; then \
		echo "anvil 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	if ! command -v nc >/dev/null 2>&1; then \
		echo "缺少 nc 命令，请安装 netcat"; \
		exit 1; \
	fi; \
	if ! command -v lsof >/dev/null 2>&1; then \
		echo "缺少 lsof 命令，请安装"; \
		exit 1; \
	fi; \
	if [ -z "$(DEPLOYER_PRIVATE_KEY)" ]; then \
		echo "未设置 DEPLOYER_PRIVATE_KEY（可在 .env 中配置 PRIVATE_KEY）"; \
		exit 1; \
	fi; \
	PIDS=$$(lsof -ti tcp:$(ANVIL_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping Anvil on port $(ANVIL_PORT)..."; \
		kill $$PIDS || true; \
	fi; \
	for i in {1..50}; do \
		if ! lsof -iTCP:$(ANVIL_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			break; \
		fi; \
		sleep 0.2; \
	done; \
	if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT); then \
		echo "启动 Anvil..."; \
		anvil --host $(ANVIL_HOST) --port $(ANVIL_PORT) > /tmp/anvil.log 2>&1 & \
		ANVIL_PID=$$!; \
		STARTED_ANVIL=1; \
		for i in {1..50}; do \
			if nc -z $(ANVIL_HOST) $(ANVIL_PORT); then \
				break; \
			fi; \
			sleep 0.2; \
		done; \
		if ! nc -z $(ANVIL_HOST) $(ANVIL_PORT); then \
			echo "Anvil 启动失败"; \
			exit 1; \
		fi; \
	fi; \
	echo "部署 NFT 合约..."; \
	NFT_OUTPUT=$$(forge create --root contracts --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) $(NFT_CONTRACT) --constructor-args "$(NFT_NAME)" "$(NFT_SYMBOL)"); \
	NFT_ADDRESS=$$(echo "$$NFT_OUTPUT" | awk '/Deployed to:/ {print $$3}'); \
	if [ -z "$$NFT_ADDRESS" ]; then \
		echo "解析 NFT 合约地址失败"; \
		echo "$$NFT_OUTPUT"; \
		exit 1; \
	fi; \
	echo "部署 Market 合约..."; \
	MARKET_OUTPUT=$$(forge create --root contracts --broadcast --rpc-url $(ANVIL_RPC_URL) --private-key $(DEPLOYER_PRIVATE_KEY) $(MARKET_CONTRACT) --constructor-args "$$NFT_ADDRESS"); \
	MARKET_ADDRESS=$$(echo "$$MARKET_OUTPUT" | awk '/Deployed to:/ {print $$3}'); \
	if [ -z "$$MARKET_ADDRESS" ]; then \
		echo "解析 Market 合约地址失败"; \
		echo "$$MARKET_OUTPUT"; \
		exit 1; \
	fi; \
	tmp=$$(mktemp); \
	if [ -f $(ENV_FILE) ]; then \
		grep -v -e '^NEXT_PUBLIC_NFT_ADDRESS=' -e '^NEXT_PUBLIC_RPC_URL=' -e '^NEXT_PUBLIC_MARKET_ADDRESS=' $(ENV_FILE) > $$tmp || true; \
	fi; \
	echo "NEXT_PUBLIC_RPC_URL=$(ANVIL_RPC_URL)" >> $$tmp; \
	echo "NEXT_PUBLIC_NFT_ADDRESS=$$NFT_ADDRESS" >> $$tmp; \
	echo "NEXT_PUBLIC_MARKET_ADDRESS=$$MARKET_ADDRESS" >> $$tmp; \
	mv $$tmp $(ENV_FILE); \
	echo "NFT 合约地址: $$NFT_ADDRESS"; \
	echo "Market 合约地址: $$MARKET_ADDRESS"; \
	if [ ! -d frontend/node_modules ]; then \
		( cd frontend && npm install ); \
	fi; \
	echo "启动前端..."; \
	if [ "$$STARTED_ANVIL" = "1" ]; then \
		trap 'kill $$ANVIL_PID' EXIT; \
	fi; \
	cd frontend; \
	npm run dev

test:
	@set -e; \
	if ! command -v forge >/dev/null 2>&1; then \
		echo "forge 未安装，请先安装 Foundry"; \
		exit 1; \
	fi; \
	forge test --root contracts

clean:
	@rm -rf contracts/cache contracts/out frontend/.next frontend/out /tmp/anvil.log
	@echo "Cleaned build artifacts."
