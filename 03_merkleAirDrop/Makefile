# 根目录快捷指令说明
# 1) 首次运行前请确保:
#    - 已安装 Foundry 并可直接运行 anvil
#    - 前端已安装依赖: cd frontend && npm install
# 2) 运行:
#    - make start: 启动本地链 → 自动部署合约 → 启动前端
# 3) 退出:
#    - 终端中按 Ctrl+C 结束对应进程

.PHONY: start start-contract start-frontend

# 一键启动: 本地链 + 合约部署 + 前端
start:
	@set -e; \
	for cmd in anvil forge npm nc python3; do \
		command -v "$$cmd" >/dev/null 2>&1 || { echo "Missing command: $$cmd"; exit 1; }; \
	done; \
	if [ ! -f contracts/lib/openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol ]; then \
		echo "Installing OpenZeppelin contracts..."; \
		if [ -f openzeppelin-contracts.zip ]; then \
			echo "Extracting openzeppelin-contracts.zip..."; \
			python3 -c 'import shutil, zipfile; from pathlib import Path; zip_path=Path("openzeppelin-contracts.zip"); lib_dir=Path("contracts/lib"); target=lib_dir/"openzeppelin-contracts"; shutil.rmtree(target) if target.exists() else None; zipfile.ZipFile(zip_path).extractall(lib_dir); candidates=[p for p in lib_dir.iterdir() if p.is_dir() and p.name.startswith("openzeppelin-contracts-")]; \
if not candidates: raise SystemExit("No extracted openzeppelin-contracts-* directory found"); extracted=candidates[0]; shutil.rmtree(target) if target.exists() else None; extracted.rename(target); print(f"Extracted {zip_path} to {target}")'; \
		else \
			rm -rf contracts/lib/openzeppelin-contracts; \
			(cd contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit); \
		fi; \
	fi; \
	if [ ! -f contracts/lib/forge-std/src/Test.sol ]; then \
		echo "Installing forge-std..."; \
		if [ -f forge-std.zip ]; then \
			echo "Extracting forge-std.zip..."; \
			python3 -c 'import shutil, zipfile; from pathlib import Path; zip_path=Path("forge-std.zip"); lib_dir=Path("contracts/lib"); target=lib_dir/"forge-std"; shutil.rmtree(target) if target.exists() else None; zipfile.ZipFile(zip_path).extractall(lib_dir); candidates=[p for p in lib_dir.iterdir() if p.is_dir() and p.name.startswith("forge-std-")]; \
if not candidates: raise SystemExit("No extracted forge-std-* directory found"); extracted=candidates[0]; shutil.rmtree(target) if target.exists() else None; extracted.rename(target); print(f"Extracted {zip_path} to {target}")'; \
		else \
			rm -rf contracts/lib/forge-std; \
			(cd contracts && forge install foundry-rs/forge-std --no-commit); \
		fi; \
	fi; \
	if [ ! -d frontend/node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		(cd frontend && npm install); \
	fi; \
	ANVIL_HOST=127.0.0.1; \
	ANVIL_PORT=8545; \
	ANVIL_URL="http://$${ANVIL_HOST}:$${ANVIL_PORT}"; \
	ANVIL_LOG=".anvil.log"; \
	ANVIL_STARTED=0; \
	if nc -z $${ANVIL_HOST} $${ANVIL_PORT} >/dev/null 2>&1; then \
		echo "Anvil already running at $${ANVIL_URL}"; \
	else \
		echo "Starting Anvil (contracts)..."; \
		(cd contracts && anvil) > $${ANVIL_LOG} 2>&1 & \
		ANVIL_PID=$$!; \
		ANVIL_STARTED=1; \
		trap 'if [ $$ANVIL_STARTED -eq 1 ] && [ -n "$$ANVIL_PID" ]; then kill $$ANVIL_PID 2>/dev/null || true; fi' INT TERM EXIT; \
		echo "Waiting for Anvil..."; \
		i=0; \
		while [ $$i -lt 40 ]; do \
			if nc -z $${ANVIL_HOST} $${ANVIL_PORT} >/dev/null 2>&1; then break; fi; \
			sleep 0.5; \
			i=$$((i+1)); \
		done; \
		if ! nc -z $${ANVIL_HOST} $${ANVIL_PORT} >/dev/null 2>&1; then \
			echo "Anvil failed to start. Check $${ANVIL_LOG}"; \
			exit 1; \
		fi; \
	fi; \
	echo "Building contracts..."; \
	(cd contracts && forge build); \
	echo "Deploying contracts..."; \
	(cd contracts && ETH_RPC_URL=$${ANVIL_URL} make deploy_llc deploy_airdrop mint transfer); \
	echo "Starting frontend..."; \
	cd frontend && npm run dev

# 启动本地合约开发链(Anvil)
start-contract:
	@echo "Starting Anvil (contracts)..."
	@cd contracts && anvil

# 启动前端开发服务器
start-frontend:
	@echo "Starting frontend..."
	@cd frontend && npm run dev
