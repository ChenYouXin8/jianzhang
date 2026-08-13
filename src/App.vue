<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLedgerStore } from '@/stores/ledger'

const route = useRoute()
const ledger = useLedgerStore()

// 主 Tab 页显示底部导航；二级页自带导航栏返回
const showTabbar = computed(() => Boolean(route.meta.tab))

// 应用启动即初始化账本（含首次种子数据）；就绪前不渲染页面，避免空状态闪烁
ledger.init()
</script>

<template>
  <div v-if="ledger.ready" data-testid="app-ready">
    <router-view />
  </div>
  <div v-else class="app-loading">
    <van-loading size="24" />
    <span>正在打开账本…</span>
  </div>

  <van-tabbar
    v-if="showTabbar && ledger.ready"
    route
    active-color="var(--color-primary)"
    inactive-color="var(--color-text-tertiary)"
  >
    <van-tabbar-item replace to="/" icon="home-o">记账</van-tabbar-item>
    <van-tabbar-item replace to="/bills" icon="notes-o">账单</van-tabbar-item>
    <van-tabbar-item replace to="/stats" icon="chart-trending-o">统计</van-tabbar-item>
    <van-tabbar-item replace to="/settings" icon="setting-o">我的</van-tabbar-item>
  </van-tabbar>
</template>
