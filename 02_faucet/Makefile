# =========================
# 项目根目录 Makefile（使用教学）
# =========================
# 你可以在项目根目录直接执行以下命令：
#
# 1) 一键启动（合约部署 + 前端开发服务器）
#    make start
#
# 2) 仅启动前端开发服务器（推荐开发时使用）
#    make            # 默认目标，等同于 make run
#    make run
#    make dev
#
# 3) 仅执行合约端命令（委托给 contracts/makefile）
#    make deploy_lulucoin
#    make deploy_faucet
#    make mint
#    make approve_faucet
#    make deposit
#    make drip
#
# 注意事项：
# - 合约端命令会进入 contracts 目录执行，依赖 contracts/.env 中的配置。
# - contracts/.env 通常需要包含私钥、地址、RPC（如 ETH_RPC_URL）等变量。
# - 前端命令在 frontend 目录执行；首次会自动 npm install。

FRONTEND_DIR := frontend
CONTRACTS_DIR := contracts

# 默认目标（直接执行 make 等同于 make run）
.DEFAULT_GOAL := run

# 伪目标声明（避免与同名文件冲突）
.PHONY: run dev start frontend-dev frontend-install frontend-build frontend-start frontend-lint clean-frontend \
	contracts-setup help \
	deploy_lulucoin deploy_faucet mint balance_of_owner approve_faucet drip deposit balance_of_faucet balance_of_user

# =========================
# 前端相关
# =========================

# 依赖目录作为“是否已安装”的标记；package 变更时会重新安装
frontend/node_modules: $(FRONTEND_DIR)/package.json $(FRONTEND_DIR)/package-lock.json
	cd $(FRONTEND_DIR) && npm install

# 手动触发前端依赖安装
frontend-install: frontend/node_modules

# 启动前端开发服务器（Next.js dev）
frontend-dev: frontend/node_modules
	cd $(FRONTEND_DIR) && npm run dev

# 默认入口：启动前端开发服务器
run: frontend-dev

# dev 与 run 等价，便于记忆
dev: frontend-dev

# 构建前端生产包
frontend-build: frontend/node_modules
	cd $(FRONTEND_DIR) && npm run build

# 启动前端生产服务器（需先 build）
frontend-start: frontend-build
	cd $(FRONTEND_DIR) && npm run start

# 前端代码检查
frontend-lint: frontend/node_modules
	cd $(FRONTEND_DIR) && npm run lint

# 删除前端依赖（如需重装）
clean-frontend:
	rm -rf $(FRONTEND_DIR)/node_modules

# =========================
# 合约相关（委托到 contracts/makefile）
# =========================

# 一次性执行合约端常见初始化流程：
# 1) 部署 LuLuCoin
# 2) 部署 Faucet
# 3) 铸币
# 4) 授权 Faucet
# 5) 向 Faucet 存入代币
contracts-setup:
	$(MAKE) -C $(CONTRACTS_DIR) deploy_lulucoin
	$(MAKE) -C $(CONTRACTS_DIR) deploy_faucet
	$(MAKE) -C $(CONTRACTS_DIR) mint
	$(MAKE) -C $(CONTRACTS_DIR) approve_faucet
	$(MAKE) -C $(CONTRACTS_DIR) deposit

# 一键启动：先执行合约初始化，再启动前端开发服务器
start:
	$(MAKE) contracts-setup
	$(MAKE) frontend-dev

# 以下命令直接转发给 contracts/makefile 执行
# 用途：无需进入 contracts 目录即可完成部署/交互
# 例：make deploy_lulucoin / make drip / make balance_of_owner
deploy_lulucoin deploy_faucet mint balance_of_owner approve_faucet drip deposit balance_of_faucet balance_of_user:
	$(MAKE) -C $(CONTRACTS_DIR) $@

# =========================
# 帮助说明
# =========================
help:
	@echo "Targets:"
	@echo "  run/dev            Start frontend dev server (default)"
	@echo "  start              Run contract setup then start frontend dev server"
	@echo "  contracts-setup    Deploy + mint + approve + deposit via contracts makefile"
	@echo "  frontend-install   Install frontend dependencies"
	@echo "  frontend-build     Build frontend for production"
	@echo "  frontend-start     Start production frontend (after build)"
	@echo "  frontend-lint      Run frontend lint"
	@echo "  clean-frontend     Remove frontend node_modules"
	@echo "  deploy_lulucoin    Deploy LuLuCoin via contracts makefile"
	@echo "  deploy_faucet      Deploy LLCFaucet via contracts makefile"
	@echo "  mint               Mint tokens via contracts makefile"
	@echo "  approve_faucet     Approve faucet via contracts makefile"
	@echo "  deposit            Deposit to faucet via contracts makefile"
	@echo "  drip               Drip tokens via contracts makefile"
	@echo "  balance_of_owner   Query owner balance via contracts makefile"
	@echo "  balance_of_faucet  Query faucet balance via contracts makefile"
	@echo "  balance_of_user    Query user balance via contracts makefile"
