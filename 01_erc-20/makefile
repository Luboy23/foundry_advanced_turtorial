include contracts/.env

# ------------------------------------------------------------
# Makefile 使用指南
# ------------------------------------------------------------
# 一键启动（推荐）：
#   make
#   make dev
#   make run
#   - 启动 Anvil，等待 RPC 就绪，部署合约，然后启动前端开发服务器。
#
# 分步执行：
#   make anvil        - 启动本地 Anvil 节点（前台阻塞直到停止）。
#   make deploy_anvil - 将 LuLuCoin 部署到已运行的 Anvil。
#   make frontend     - 启动 Next.js 前端开发服务器。
#
# 常用参数覆盖：
#   ANVIL_PORT=9545 make
#   ANVIL_HOST=0.0.0.0 make
#   ANVIL_CHAIN_ID=31337 make
#   ANVIL_RPC_URL=http://127.0.0.1:8545 make
#
# 说明：
# - 会读取 contracts/.env 中的 OWNER_PRIVATE_KEY / OWNER_ADDRESS。
# - dev/run 目标会保持 Anvil 运行，直到前端退出。
# ------------------------------------------------------------

.DEFAULT_GOAL := dev

# 本地 Anvil 默认配置（可用环境变量覆盖）。
ANVIL_HOST ?= 127.0.0.1
ANVIL_PORT ?= 8545
ANVIL_CHAIN_ID ?= 31337
ANVIL_RPC_URL ?= http://$(ANVIL_HOST):$(ANVIL_PORT)
ANVIL_WAIT_ATTEMPTS ?= 40
ANVIL_WAIT_SLEEP ?= 0.25

.PHONY: anvil deploy_anvil frontend dev run

anvil:
	@# 在 contracts 目录启动 Anvil，使用上方 host/port/chain id 配置。
	$(MAKE) -C contracts anvil

deploy_anvil:
	@# 使用 contracts/.env 中的密钥部署 LuLuCoin 到目标 RPC。
	$(MAKE) -C contracts deploy_anvil

frontend:
	@# 启动 Next.js 开发服务器（默认 http://localhost:3000）。
	cd frontend && npm run dev

dev run:
	@# 编排 anvil -> deploy -> frontend，并保持 Anvil 存活。
	@bash -lc 'set -euo pipefail; \
	( $(MAKE) anvil ) & ANVIL_PID=$$!; \
	trap "kill $$ANVIL_PID" EXIT; \
	for i in $$(seq 1 $(ANVIL_WAIT_ATTEMPTS)); do \
	  if curl -s -H "Content-Type: application/json" \
	    --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}" \
	    "$(ANVIL_RPC_URL)" >/dev/null; then \
	    break; \
	  fi; \
	  sleep $(ANVIL_WAIT_SLEEP); \
	done; \
	$(MAKE) deploy_anvil; \
	$(MAKE) frontend'
