SHELL := /bin/bash

PROJECT_GITHUB ?= https://github.com/lllu23/foundry_advanced_turtorial
RPC_URL ?= http://127.0.0.1:8545
CHAIN_ID ?= 31337
PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
POSITION_URI_BASE ?= ipfs://polymarket/{id}.json

CONTRACTS_DIR := contracts
FRONTEND_DIR := frontend
FRONTEND_ENV := $(FRONTEND_DIR)/.env.local
FRONTEND_CONFIG_JSON := $(FRONTEND_DIR)/public/contract-config.json
FRONTEND_ABI_DIR := $(FRONTEND_DIR)/src/abi

.PHONY: help dev deploy web build-contracts test anvil clean restart-anvil ensure-anvil frontend-install

help:
	@echo "make help            # 查看全部命令"
	@echo "make dev             # 一键启动：restart-anvil + deploy + web"
	@echo "make deploy          # 部署 v2 模块合约并同步前端地址/ABI"
	@echo "make web             # 启动前端 Next 开发服务器"
	@echo "make build-contracts # 编译合约"
	@echo "make test            # 运行 Foundry 测试"
	@echo "make anvil           # 启动本地 Anvil"
	@echo "make clean           # 清理构建产物"

anvil:
	@anvil --chain-id $(CHAIN_ID)

ensure-anvil:
	@set -euo pipefail; \
	if ! cast chain-id --rpc-url $(RPC_URL) >/dev/null 2>&1; then \
		echo "[make] anvil 未运行，正在后台启动..."; \
		nohup anvil --chain-id $(CHAIN_ID) > .anvil.log 2>&1 & echo $$! > .anvil.pid; \
		sleep 1; \
	fi

restart-anvil:
	@set -euo pipefail; \
	if [ -f .anvil.pid ]; then \
		kill $$(cat .anvil.pid) >/dev/null 2>&1 || true; \
		rm -f .anvil.pid; \
	fi; \
	pkill -f "anvil --chain-id $(CHAIN_ID)" >/dev/null 2>&1 || true; \
	nohup anvil --chain-id $(CHAIN_ID) > .anvil.log 2>&1 & echo $$! > .anvil.pid; \
	sleep 1

deploy: ensure-anvil
	@set -euo pipefail; \
	command -v forge >/dev/null 2>&1 || { echo "forge not found"; exit 1; }; \
	command -v cast >/dev/null 2>&1 || { echo "cast not found"; exit 1; }; \
	mkdir -p $(FRONTEND_DIR)/public $(FRONTEND_ABI_DIR); \
	deploy_contract() { \
		local target="$$1"; shift || true; \
		local out; \
		out=$$(cd $(CONTRACTS_DIR) && forge create --broadcast --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY) "$$target" "$$@"); \
		local addr; \
		addr=$$(echo "$$out" | awk '/Deployed to:/ {print $$3}'); \
		if [ -z "$$addr" ]; then \
			echo "$$out"; \
			echo "[make] failed to parse deployed address for $$target" >&2; \
			exit 1; \
		fi; \
		echo "$$addr"; \
	}; \
	position_addr=$$(deploy_contract "src/PositionToken.sol:PositionToken" --constructor-args "$(POSITION_URI_BASE)"); \
	collateral_addr=$$(deploy_contract "src/ETHCollateralVault.sol:ETHCollateralVault"); \
	oracle_addr=$$(deploy_contract "src/OracleAdapterMock.sol:OracleAdapterMock"); \
	factory_addr=$$(deploy_contract "src/EventFactory.sol:EventFactory" --constructor-args "$$position_addr" "$$collateral_addr" "$$oracle_addr"); \
	cast send --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY) "$$position_addr" "setCore(address)" "$$factory_addr" >/dev/null; \
	cast send --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY) "$$collateral_addr" "setOperator(address)" "$$factory_addr" >/dev/null; \
	cast send --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY) "$$oracle_addr" "setOperator(address)" "$$factory_addr" >/dev/null; \
	printf "NEXT_PUBLIC_RPC_URL=%s\nNEXT_PUBLIC_CHAIN_ID=%s\nNEXT_PUBLIC_PROJECT_GITHUB=%s\nNEXT_PUBLIC_EVENT_FACTORY_ADDRESS=%s\nNEXT_PUBLIC_POSITION_TOKEN_ADDRESS=%s\nNEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS=%s\nNEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=%s\n" \
	  "$(RPC_URL)" "$(CHAIN_ID)" "$(PROJECT_GITHUB)" "$$factory_addr" "$$position_addr" "$$collateral_addr" "$$oracle_addr" > $(FRONTEND_ENV); \
	printf '{\n  "rpcUrl": "%s",\n  "chainId": %s,\n  "eventFactoryAddress": "%s",\n  "positionTokenAddress": "%s",\n  "ethCollateralVaultAddress": "%s",\n  "oracleAdapterAddress": "%s"\n}\n' \
	  "$(RPC_URL)" "$(CHAIN_ID)" "$$factory_addr" "$$position_addr" "$$collateral_addr" "$$oracle_addr" > $(FRONTEND_CONFIG_JSON); \
	(cd $(CONTRACTS_DIR) && forge inspect src/EventFactory.sol:EventFactory abi --json > ../$(FRONTEND_ABI_DIR)/EventFactory.json); \
	(cd $(CONTRACTS_DIR) && forge inspect src/PositionToken.sol:PositionToken abi --json > ../$(FRONTEND_ABI_DIR)/PositionToken.json); \
	(cd $(CONTRACTS_DIR) && forge inspect src/ETHCollateralVault.sol:ETHCollateralVault abi --json > ../$(FRONTEND_ABI_DIR)/ETHCollateralVault.json); \
	(cd $(CONTRACTS_DIR) && forge inspect src/OracleAdapterMock.sol:OracleAdapterMock abi --json > ../$(FRONTEND_ABI_DIR)/OracleAdapterMock.json); \
	echo "[make] deployed EventFactory: $$factory_addr"; \
	echo "[make] deployed PositionToken: $$position_addr"; \
	echo "[make] deployed ETHCollateralVault: $$collateral_addr"; \
	echo "[make] deployed OracleAdapterMock: $$oracle_addr"

web: frontend-install
	@set -euo pipefail; \
	next_pattern="$(abspath $(FRONTEND_DIR))/node_modules/.bin/next dev"; \
	if pgrep -f "$$next_pattern" >/dev/null 2>&1; then \
		echo "[make] 检测到 frontend 已有 next dev 进程，请先停止旧进程后再重试。"; \
		exit 1; \
	fi; \
	rm -f $(FRONTEND_DIR)/.next/dev/lock; \
	cd $(FRONTEND_DIR) && npm run dev

dev: restart-anvil deploy web

build-contracts:
	@cd $(CONTRACTS_DIR) && forge build

test:
	@cd $(CONTRACTS_DIR) && forge test

clean:
	@cd $(CONTRACTS_DIR) && forge clean
	@rm -rf $(FRONTEND_DIR)/.next
	@rm -f .anvil.pid .anvil.log $(FRONTEND_ENV) $(FRONTEND_CONFIG_JSON)

frontend-install: $(FRONTEND_DIR)/node_modules

$(FRONTEND_DIR)/node_modules: $(FRONTEND_DIR)/package-lock.json
	@cd $(FRONTEND_DIR) && npm install
