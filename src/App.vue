<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/db/database'
import { replaceAllSettings } from '@/db/repositories/settings'
import type { BackupFile } from '@/services/export'
import { filterSensitiveSettings } from '@/services/sync-config'
import { buildLocalSnapshot, runAutoSync, type SyncDeps } from '@/services/sync-manager'
import { useLedgerStore } from '@/stores/ledger'

const route = useRoute()
const ledger = useLedgerStore()

// 主 Tab 页显示底部导航；二级页自带导航栏返回
const showTabbar = computed(() => Boolean(route.meta.tab))

// 应用启动即初始化账本（含首次种子数据）；就绪前不渲染页面，避免空状态闪烁
ledger.init()

/* ---------------- WebDAV 自动同步 ----------------
 * 依赖注入同步所需的「构建本地快照 / 落地合并结果（写库）」。
 * 触发时机：
 * 1. 启动就绪后延迟拉取一次（新设备/换机场景自动恢复云端数据）；
 * 2. 每次数据写操作（记账/改账/删账等，ledger.version 递增）后防抖自动同步。
 * 未开启自动同步 / 未配置服务器时 runAutoSync 内部直接跳过，无副作用。 */
const syncDeps: SyncDeps = {
  buildLocal: async () =>
    buildLocalSnapshot({
      accounts: ledger.accounts,
      categories: ledger.categories,
      transactions: ledger.transactions,
      budgets: ledger.budgets,
      // 排除 sync.* 敏感键（WebDAV 密码 / 加密密码），不进入云端文件与合并结果
      settings: filterSensitiveSettings(await db.settings.toArray()),
    }),
  restoreLocal: async (data: BackupFile) => {
    await ledger.restoreBackup({
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
      budgets: data.budgets,
    })
    await replaceAllSettings(data.settings)
  },
}

let autoSyncTimer: ReturnType<typeof setTimeout> | undefined
function scheduleAutoSync(delayMs = 5000) {
  if (autoSyncTimer) clearTimeout(autoSyncTimer)
  autoSyncTimer = setTimeout(() => {
    void runAutoSync(syncDeps)
  }, delayMs)
}

// 启动就绪后延迟拉取一次（自动同步关闭时 runAutoSync 无操作）
let bootSynced = false
watch(
  () => ledger.ready,
  (ready) => {
    if (ready && !bootSynced) {
      bootSynced = true
      scheduleAutoSync(3000)
    }
  },
)

// 写操作后防抖自动同步；跳过 init() 那次 version 变更（其就绪事件由上面处理）
let initVersionSeen = false
watch(
  () => ledger.version,
  () => {
    if (!ledger.ready) return
    if (!initVersionSeen) {
      initVersionSeen = true
      return
    }
    scheduleAutoSync()
  },
  { flush: 'post' },
)
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
