<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { showConfirmDialog, showSuccessToast } from 'vant'
import { useRouter } from 'vue-router'
import AmountText from '@/components/common/AmountText.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MonthSwitcher from '@/components/common/MonthSwitcher.vue'
import FilterPopup from '@/components/bills/FilterPopup.vue'
import { emptyFilters, type BillFilters } from '@/components/bills/filters'
import TransactionEditSheet from '@/components/bills/TransactionEditSheet.vue'
import TransactionItem from '@/components/bills/TransactionItem.vue'
import { downloadTextFile, transactionsToCSV } from '@/services/export'
import { groupByDay } from '@/services/stats'
import { useLedgerStore } from '@/stores/ledger'
import type { Transaction } from '@/types'
import { currentMonth, dayHeaderLabel, weekdayLabel } from '@/utils/date'

/**
 * 账单页：按日分组 + 月切换 + 搜索/筛选/管理/导出。
 * 分组与汇总全部来自 services 纯函数；筛选在内存完成（万级数据毫秒级）。
 */
const ledger = useLedgerStore()
const router = useRouter()

const month = ref(currentMonth())
const filters = reactive<BillFilters>(emptyFilters())
const showFilter = ref(false)

/** 应用筛选弹层结果（保持 reactive 引用不变，合并赋值） */
function applyFilters(f: BillFilters) {
  Object.assign(filters, f)
}

/* ---------------- 有效时间范围 ---------------- */
const range = computed(() => {
  if (filters.range === 'custom' && filters.from && filters.to) {
    return { from: filters.from, to: filters.to }
  }
  if (filters.range === '3m') {
    const [y, m] = month.value.split('-').map(Number)
    const d = new Date(y, m - 3, 1)
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    return { from, to: `${month.value}-31` }
  }
  return { from: `${month.value}-01`, to: `${month.value}-31` }
})

/* ---------------- 筛选（一级分类会命中其全部二级分类） ---------------- */
const filteredTxs = computed(() => {
  const { from, to } = range.value
  const childIds = new Set(
    filters.categoryId
      ? ledger.categories.filter((c) => c.parentId === filters.categoryId).map((c) => c.id)
      : [],
  )
  return ledger.transactions.filter((t) => {
    if (t.date < from || t.date > to) return false
    if (filters.type && t.type !== filters.type) return false
    if (filters.categoryId && t.categoryId !== filters.categoryId && !childIds.has(t.categoryId ?? '')) {
      return false
    }
    if (
      filters.accountId &&
      t.accountId !== filters.accountId &&
      t.toAccountId !== filters.accountId
    ) {
      return false
    }
    return true
  })
})

/* ---------------- 分组与增量渲染 ---------------- */
const groups = computed(() => groupByDay(filteredTxs.value))
const visibleCount = ref(15)
const loading = ref(false)
const visibleGroups = computed(() => groups.value.slice(0, visibleCount.value))

function onLoad() {
  loading.value = true
  // 模拟异步加载，让 van-list 正确管理状态
  setTimeout(() => {
    visibleCount.value = Math.min(visibleCount.value + 15, groups.value.length)
    loading.value = false
  }, 120)
}

const rangeSummary = computed(() => {
  let income = 0
  let expense = 0
  for (const t of filteredTxs.value) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, count: filteredTxs.value.length }
})

/* ---------------- 编辑 / 删除 ---------------- */
const editingTx = ref<Transaction | null>(null)
const showEdit = ref(false)

function openEdit(t: Transaction) {
  editingTx.value = t
  showEdit.value = true
}

async function confirmDelete(t: Transaction) {
  await showConfirmDialog({ title: '删除账单', message: '删除后不可恢复，确定删除这笔账单吗？' })
  await ledger.removeTransaction(t.id)
  showSuccessToast('已删除')
}

/* ---------------- 批量管理 ---------------- */
const manageMode = ref(false)
const selectedIds = ref(new Set<string>())

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  selectedIds.value =
    selectedIds.value.size === filteredTxs.value.length
      ? new Set()
      : new Set(filteredTxs.value.map((t) => t.id))
}

async function batchDelete() {
  await showConfirmDialog({
    title: '批量删除',
    message: `确定删除选中的 ${selectedIds.value.size} 笔账单吗？删除后不可恢复。`,
  })
  await ledger.removeTransactions([...selectedIds.value])
  selectedIds.value = new Set()
  manageMode.value = false
  showSuccessToast('已删除')
}

/* ---------------- 导出 CSV ---------------- */
function exportCSV() {
  const txs = filteredTxs.value
  if (!txs.length) {
    showSuccessToast('当前范围内没有账单可导出')
    return
  }
  const csv = transactionsToCSV(txs, ledger.accounts, ledger.categories)
  const { from, to } = range.value
  downloadTextFile(`简账-账单-${from}-${to}.csv`, csv, 'text/csv;charset=utf-8')
}
</script>

<template>
  <main class="page bills">
    <!-- 头部：月切换 + 汇总 + 操作 -->
    <section class="bills-header card" data-testid="bills-header">
      <MonthSwitcher v-model:month="month" />
      <div class="summary num" data-testid="bills-summary">
        <span class="sum-income">收 <AmountText :cents="rangeSummary.income" kind="income" size="sm" /></span>
        <span class="sum-expense">支 <AmountText :cents="rangeSummary.expense" kind="expense" size="sm" /></span>
        <span class="sum-count">{{ rangeSummary.count }} 笔</span>
      </div>
      <div class="actions">
        <button class="action tap-target" data-testid="btn-search" @click="router.push('/search')">
          <van-icon name="search" /><span>搜索</span>
        </button>
        <button class="action tap-target" data-testid="btn-filter" @click="showFilter = true">
          <van-icon name="filter-o" /><span>筛选</span>
        </button>
        <button
          class="action tap-target"
          :class="{ on: manageMode }"
          data-testid="btn-manage"
          @click="manageMode = !manageMode"
        >
          <van-icon name="orders-o" /><span>{{ manageMode ? '完成' : '管理' }}</span>
        </button>
        <button class="action tap-target" data-testid="btn-export" @click="exportCSV">
          <van-icon name="down" /><span>导出</span>
        </button>
      </div>
    </section>

    <!-- 分组列表 -->
    <EmptyState
      v-if="!groups.length"
      :description="filters.categoryId || filters.accountId || filters.type || filters.range !== 'month' ? '没有符合筛选条件的账单' : '本月还没有账单，去记一笔吧'"
    />
    <van-list
      v-else
      v-model:loading="loading"
      :finished="visibleCount >= groups.length"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <section v-for="g in visibleGroups" :key="g.date" class="day-group card" :data-testid="`day-${g.date}`">
        <header class="day-header">
          <span class="day-label">{{ dayHeaderLabel(g.date) }}</span>
          <span class="day-week">{{ weekdayLabel(g.date) }}</span>
          <span class="day-sum num">
            <span v-if="g.income">收 {{ (g.income / 100).toFixed(2) }}</span>
            <span v-if="g.expense">支 {{ (g.expense / 100).toFixed(2) }}</span>
          </span>
        </header>
        <TransactionItem
          v-for="t in g.txs"
          :key="t.id"
          :tx="t"
          :selectable="manageMode"
          :selected="selectedIds.has(t.id)"
          @click="openEdit(t)"
          @toggle="toggleSelect(t.id)"
          @delete="confirmDelete(t)"
        />
      </section>
    </van-list>

    <!-- 批量操作栏 -->
    <div v-if="manageMode" class="manage-bar" data-testid="manage-bar">
      <button class="tap-target" data-testid="manage-select-all" @click="toggleSelectAll">
        全选
      </button>
      <button
        class="tap-target del"
        :disabled="!selectedIds.size"
        data-testid="manage-delete"
        @click="batchDelete"
      >
        删除{{ selectedIds.size ? `（${selectedIds.size}）` : '' }}
      </button>
    </div>

    <!-- 筛选 / 编辑弹层 -->
    <FilterPopup v-model="showFilter" :filters="filters" @apply="applyFilters" />
    <TransactionEditSheet v-model:show="showEdit" :tx="editingTx" />
  </main>
</template>

<style scoped>
.bills {
  padding-top: 16px;
}
.bills-header {
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.summary {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.actions {
  display: flex;
  justify-content: space-around;
  margin-top: 8px;
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
}
.action {
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.action.on {
  color: var(--color-primary-deep);
}

.day-group {
  margin-top: 12px;
  overflow: hidden;
}
.day-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 12px 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-card);
}
.day-label {
  font-weight: 600;
  color: var(--color-text);
}
.day-week {
  font-size: 12px;
}
.day-sum {
  margin-left: auto;
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.manage-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(50px + env(safe-area-inset-bottom));
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--color-card);
  border-top: 1px solid var(--color-border);
  z-index: 20;
  font-size: 14px;
}
.manage-bar .del {
  color: var(--color-expense-deep);
}
.manage-bar .del:disabled {
  color: var(--color-text-tertiary);
}
</style>
