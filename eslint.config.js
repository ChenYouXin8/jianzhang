import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'node_modules/**', 'src/components.d.ts', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  // Node 脚本（图标生成等）：使用 Node 全局变量
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // 单文件组件文件名不强求多词（如 HomeView.vue 已满足，但个别单组件文件不强制）
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // 必须放最后：关闭与 Prettier 冲突的格式类规则
  prettierConfig,
)
