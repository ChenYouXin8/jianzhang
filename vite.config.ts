/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// Vant 按需引入：模板中使用的组件自动注册并附带样式，减小打包体积
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
      dts: 'src/components.d.ts', // 自动生成的组件类型声明
    }),
    // PWA：本地优先应用，离线可用是核心卖点；registerType 用 autoUpdate 保证静默更新
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '简账 · 个人记账',
        short_name: '简账',
        description: '本地优先、离线可用的个人记账应用',
        lang: 'zh-CN',
        theme_color: '#0fa968',
        background_color: '#f7f8fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 只列出真实存在的资源类型：项目无 .ico/.woff2（字体走系统字体栈）
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // SPA 路由回退（配合 hash 路由双保险）
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 单元测试配置：纯函数测试用 node 环境即可，速度最快
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
