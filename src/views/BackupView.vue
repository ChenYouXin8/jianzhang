<script setup lang="ts">
import { computed, ref } from 'vue'
import { showConfirmDialog, showSuccessToast } from 'vant'
import { useRouter } from 'vue-router'
import { db } from '@/db/database'
import { replaceAllSettings } from '@/db/repositories/settings'
import { createBackupFile, downloadTextFile, parseBackupFile, transactionsToCSV } from '@/services/export'
import { filterSensitiveSettings } from '@/services/sync-config'
import { useLedgerStore } from '@/stores/ledger'
import { lastMonths, monthLabel } from '@/utils/date'

/**
 * 备份与恢复：JSON 全量备份（含校验）/ CSV 导出 / 清除数据。
 * 备份文件即完整账本：五张表 + 版本号，恢复时整体校验后覆盖，
 * 恢复完成后整页刷新以重建内存状态（恢复是低频操作，简单可靠优先）。
 */
const ledger = useLedgerStore()
const router = useRouter()

/* ---------------- 导出备份 ---------------- */
function exportBackup() {
  const file = createBackupFile({
    accounts: ledger.accounts,
    categories: ledger.categories,
    transactions: ledger.transactions,
    budgets: ledger.budgets,
    settings: [], // settings 由下方补充读取
  })
  // settings 表不在 store 内，直接从仓储读取补全；
  // 排除 sync.* 敏感键（WebDAV 密码 / 加密密码 / 同步状态），避免随备份文件外泄
  db.settings.toArray().then((settings) => {
    const full = { ...file, settings: filterSensitiveSettings(settings) }
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`简账-备份-${date}.json`, JSON.stringify(full, null, 2), 'application/json')
    showSuccessToast('备份已导出')
  })
}

/* ---------------- 导入备份 ---------------- */
const fileInput = ref<HTMLInputElement>()

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const backup = parseBackupFile(JSON.parse(text))
    await showConfirmDialog({
      title: '恢复备份',
      message: `将用备份覆盖当前全部数据：${backup.accounts.length} 个账户、${backup.categories.length} 个分类、${backup.transactions.length} 笔账单。当前数据将被替换，确定继续吗？`,
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
    })
    await ledger.restoreBackup(backup)
    await replaceAllSettings(backup.settings)
    showSuccessToast('恢复成功，正在刷新…')
    setTimeout(() => window.location.reload(), 800)
  } catch (err) {
    showSuccessToast(err instanceof Error ? err.message : '备份文件解析失败')
  }
}

/* ---------------- 导出 CSV ---------------- */
const showMonthPicker = ref(false)
const monthOptions = computed(() => lastMonths(12).map((m) => ({ text: monthLabel(m), value: m })))

function exportCSVAll() {
  const csv = transactionsToCSV(ledger.transactions, ledger.accounts, ledger.categories)
  downloadTextFile('简账-账单-全部.csv', csv, 'text/csv;charset=utf-8')
  showSuccessToast('已导出全部账单')
}

function exportCSVMonth(month: string) {
  const txs = ledger.transactions.filter((t) => t.date.startsWith(month))
  if (!txs.length) {
    showSuccessToast('该月没有账单')
    return
  }
  const csv = transactionsToCSV(txs, ledger.accounts, ledger.categories)
  downloadTextFile(`简账-账单-${month}.csv`, csv, 'text/csv;charset=utf-8')
  showSuccessToast(`已导出 ${monthLabel(month)} 账单`)
}

/* ---------------- 清除数据 ---------------- */
async function clearAll() {
  await showConfirmDialog({
    title: '清除全部数据',
    message: '将删除本机全部账户、分类、账单与预算。此操作不可恢复，建议先导出备份。',
    confirmButtonText: '仍要清除',
    cancelButtonText: '取消',
  })
  await db.transaction(
    'rw',
    [db.accounts, db.categories, db.transactions, db.budgets, db.settings],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.settings.clear(),
      ])
    },
  )
  showSuccessToast('已清除，正在重新初始化…')
  setTimeout(() => window.location.reload(), 800)
}
</script>

<template>
  <main class="backup-page">
    <van-nav-bar title="备份与恢复" left-arrow @click-left="router.back()" />

    <div class="page">
      <van-cell-group inset title="备份">
        <van-cell
          title="导出备份（JSON）"
          label="完整账本：账户 / 分类 / 账单 / 预算 / 设置"
          icon="down"
          is-link
          data-testid="backup-export"
          @click="exportBackup"
        />
        <van-cell
          title="导入备份"
          label="选择之前导出的 JSON 文件恢复账本"
          icon="upgrade"
          is-link
          data-testid="backup-import"
          @click="pickFile"
        />
      </van-cell-group>

      <van-cell-group inset title="导出 CSV（可用 Excel 打开）">
        <van-cell title="导出全部账单" icon="description" is-link data-testid="csv-all" @click="exportCSVAll" />
        <van-cell title="按月份导出" icon="calendar-o" is-link data-testid="csv-month" @click="showMonthPicker = true" />
      </van-cell-group>

      <van-cell-group inset title="危险操作">
        <van-cell
          title="清除全部数据"
          label="删除本机所有数据，建议先导出备份"
          icon="warning-o"
          is-link
          data-testid="clear-all"
          @click="clearAll"
        />
      </van-cell-group>
    </div>

    <input ref="fileInput" type="file" accept="application/json,.json" hidden data-testid="backup-file-input" @change="onFileChange" />

    <van-popup v-model:show="showMonthPicker" position="bottom" round>
      <van-picker
        :columns="monthOptions"
        title="选择月份"
        @confirm="({ selectedOptions }) => { exportCSVMonth(selectedOptions[0]?.value ?? ''); showMonthPicker = false }"
        @cancel="showMonthPicker = false"
      />
    </van-popup>
  </main>
</template>

<style scoped>
.backup-page {
  min-height: 100vh;
  background: var(--color-bg);
}
.backup-page :deep(.van-cell-group) {
  margin-bottom: 12px;
}
</style>
