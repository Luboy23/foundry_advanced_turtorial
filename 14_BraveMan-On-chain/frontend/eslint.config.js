import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * ESLint 平面配置：
 * - 主体规则覆盖 TS/TSX 源码；
 * - 测试目录额外开放 node/vitest 全局变量；
 * - 忽略构建与测试产物目录，避免无效扫描。
 */
export default defineConfig([
  // 这些目录由构建或测试生成，不参与代码规范检查。
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // 测试环境需要额外注入 node 与 vitest 全局，避免误报未定义变量。
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
])
