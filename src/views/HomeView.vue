<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import CategoryIcon from '@/components/common/CategoryIcon.vue'
import AmountText from '@/components/common/AmountText.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import QuickEntryPanel from '@/components/entry/QuickEntryPanel.vue'
import { useLedgerStore } from '@/stores/ledger'
import { useUiStore } from '@/stores/ui'
import type { Transaction } from '@/types'
import { TX_TYPE_LABELS } from '@/utils/constants'
import { currentMonth, todayStr } from '@/utils/date'
import { centsToYuan, formatCents } from '@/utils/money'

/**
 * 首页 = 资产概览 + 快速记账面板 + 最近记录（一键复记）。
 * 「打开即记」：面板即首屏主体，无需任何前置点击。
 */
const ledger = useLedgerStore()
const ui = useUiStore()
const router = useRouter()

const month = currentMonth()
const summary = computed(() => ledger.summaryOf(month))
const recent = computed(() =>
  [...ledger.transactions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
)

/** 复记：金额/分类/账户原样带入，日期改为今天（复记 = 记一笔新的） */
function replay(t: Transaction) {
  ui.requestPrefill({
    type: t.type,
    amount: centsToYuan(t.amount),
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    categoryId: t.categoryId,
    date: todayStr(),
    note: '',
  })
  // 面板可能不在视口内，预填后滚到顶部让用户看到结果
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

// 复记触发时同样滚动到顶部
watch(
  () => ui.draftSeq,
  () => nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })),
)

function recentLabel(t: Transaction): string {
  const cat = t.categoryId ? ledger.categories.find((c) => c.id === t.categoryId) : undefined
  const account = ledger.accounts.find((a) => a.id === t.accountId)
  if (t.type === 'transfer') {
    const to = ledger.accounts.find((a) => a.id === t.toAccountId)
    return `${account?.name ?? ''} → ${to?.name ?? ''}`
  }
  return `${cat?.name ?? ''} · ${account?.name ?? ''}`
}
</script>

<template>
  <main class="page home">
    <!-- 资产概览 -->
    <section class="overview card" aria-label="资产概览">
      <div class="net-worth">
        <span class="net-label">净资产</span>
        <span class="net-value num">{{ formatCents(ledger.netWorth) }}</span>
      </div>
      <div class="month-summary">
        <div class="sum-item">
          <span class="sum-label">本月收入</span>
          <AmountText :cents="summary.income" kind="income" size="md" />
        </div>
        <div class="sum-item">
          <span class="sum-label">本月支出</span>
          <AmountText :cents="summary.expense" kind="expense" size="md" />
        </div>
        <div class="sum-item">
          <span class="sum-label">本月结余</span>
          <AmountText :cents="summary.balance" :kind="summary.balance >= 0 ? 'income' : 'expense'" size="md" />
        </div>
      </div>
    </section>

    <!-- 快速记账（首屏主体） -->
    <QuickEntryPanel />

    <!-- 最近记录：一键复记 -->
    <section class="recent" aria-label="最近记录">
      <div class="recent-header">
        <span class="recent-title">最近记录</span>
        <button class="recent-more" @click="router.push('/bills')">全部账单 ›</button>
      </div>
      <EmptyState v-if="!recent.length" description="记下第一笔，从这里开始" />
      <div v-else class="recent-list card">
        <button
          v-for="t in recent"
          :key="t.id"
          class="recent-item"
          :data-testid="`recent-${t.id}`"
          @click="replay(t)"
        >
          <CategoryIcon
            :icon="t.type === 'transfer' ? '🔁' : ledger.categories.find((c) => c.id === t.categoryId)?.icon ?? '📦'"
            :color="ledger.categories.find((c) => c.id === t.categoryId)?.color ?? '#9aa1ad'"
            :size="36"
          />
          <span class="recent-meta">
            <span class="recent-name">{{ recentLabel(t) }}</span>
            <span class="recent-type">{{ TX_TYPE_LABELS[t.type] }} · {{ t.date.slice(5) }}</span>
          </span>
          <AmountText
            :cents="t.amount"
            :kind="t.type"
            :sign="t.type !== 'transfer'"
            size="sm"
          />
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
}

/* 资产概览 */
.overview {
  padding: 16px;
}
.net-worth {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.net-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.net-value {
  font-size: 28px;
  font-weight: 700;
}
.month-summary {
  display: flex;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.sum-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sum-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 最近记录 */
.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 2px;
}
.recent-title {
  font-size: 15px;
  font-weight: 600;
}
.recent-more {
  font-size: 13px;
  color: var(--color-text-secondary);
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.recent-list {
  padding: 0 12px;
}
.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 0;
  text-align: left;
}
.recent-item + .recent-item {
  border-top: 1px solid var(--color-border);
}
.recent-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.recent-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.recent-type {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
