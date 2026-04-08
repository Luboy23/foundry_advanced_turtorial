import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

// 基于当前文件位置回溯到项目根目录，确保命令执行路径稳定。
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDir, '../../../..')

/**
 * 统一执行外部命令。
 * 使用 inherit 透传日志，便于 CI/本地排查部署或链启动失败。
 */
const run = (command) => {
  execSync(command, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  })
}

export default async function globalSetup() {
  // 前置步骤 1：重启 Anvil，确保端口状态和链快照可预测。
  run('make restart-anvil')
  // 前置步骤 2：重新部署并同步前端合约配置，避免旧地址污染 e2e。
  run('make deploy')
}
