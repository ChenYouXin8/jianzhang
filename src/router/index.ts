import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 路由设计：
 * - 4 个主 Tab 页（meta.tab 控制底部 Tabbar 显隐）+ 4 个二级页（自带导航栏返回）；
 * - 用 hash 模式：静态部署（GitHub Pages/任意静态服务器）无需重写规则，
 *   与 PWA 的 navigateFallback 双保险，刷新/深链不 404。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { tab: true, title: '记账' } },
    { path: '/bills', name: 'bills', component: () => import('@/views/BillsView.vue'), meta: { tab: true, title: '账单' } },
    { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue'), meta: { tab: true, title: '统计' } },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { tab: true, title: '我的' } },
    { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
    { path: '/accounts', name: 'accounts', component: () => import('@/views/AccountsView.vue') },
    { path: '/categories', name: 'categories', component: () => import('@/views/CategoriesView.vue') },
    { path: '/backup', name: 'backup', component: () => import('@/views/BackupView.vue') },
  ],
})

export default router
