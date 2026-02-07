// ESLint 配置：用于前端代码规范与 React Hooks 检查。
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // 忽略构建产物
  { ignores: ['dist'] },
  {
    // 仅校验 JS/JSX 文件
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      // 语法与全局变量配置
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      // React Hooks 与热更新规则
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // 合并官方推荐规则
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // 允许以大写/下划线开头的未使用变量（常用于常量）
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // 仅导出组件有利于 React Fast Refresh
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
