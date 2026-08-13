<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import TransactionEditSheet from '@/components/bills/TransactionEditSheet.vue'
import TransactionItem from '@/components/bills/TransactionItem.vue'
import { groupByDay } from '@/services/stats'
import { useLedgerStore } from '@/stores/ledger'
import type { Transaction } from '@/types'
import { dayHeaderLabel } from '@/utils/date'

/**
 * 搜索页：关键词命中「备注 / 分类名（含一级）/ 账户名」。
 * 结果按日分组展示，点结果直接编辑。
 */
const ledger = useLedgerStore()
const router = useRouter()
const keyword = ref('')

const results = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return []
  const catNames = new Map(
    ledger.categories.map((c) => [c.id, c.name.toLowerCase()]),
  )
  const accNames = new Map(ledger.accounts.map((a) => [a.id, a.name.toLowerCase()]))
  return ledger.transactions.filter((t) => {
    if (t.note.toLowerCase().includes(kw)) return true
    const catName = t.categoryId ? (catNames.get(t.categoryId) ?? '') : ''
    if (catName.includes(kw)) return true
    if ((accNames.get(t.accountId) ?? '').includes(kw)) return true
    if (t.toAccountId && (accNames.get(t.toAccountId) ?? '').includes(kw)) return true
    return false
  })
})
const groups = computed(() => groupByDay(results.value))
const hasKeyword = computed(() => Boolean(keyword.value.trim()))

const editingTx = ref<Transaction | null>(null)
const showEdit = ref(false)

function openEdit(t: Transaction) {
  editingTx.value = t
  showEdit.value = true
}
</script>

<template>
  <main class="search-page">
    <van-nav-bar
      title="搜索"
      left-arrow
      @click-left="router.back()"
    />
    <div class="search-box">
      <van-search
        v-model="keyword"
        placeholder="搜备注、分类、账户"
        autofocus
        data-testid="search-input"
      />
    </div>

    <EmptyState v-if="hasKeyword && !results.length" description="没有找到相关账单" />
    <EmptyState v-else-if="!hasKeyword" description="输入关键词开始搜索" />

    <div v-else class="results page">
      <section v-for="g in groups" :key="g.date" class="day-group card">
        <header class="day-header">{{ dayHeaderLabel(g.date) }}</header>
        <TransactionItem v-for="t in g.txs" :key="t.id" :tx="t" @click="openEdit(t)" />
      </section>
    </div>

    <TransactionEditSheet v-model:show="showEdit" :tx="editingTx" />
  </main>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  background: var(--color-bg);
}
.search-box {
  background: var(--color-card);
  padding: 0 8px 4px;
}
.results {
  padding-top: 8px;
}
.day-group {
  margin-top: 12px;
  overflow: hidden;
}
.day-header {
  padding: 10px 12px 6px;
  font-size: 13px;
  font-weight: 600;
}
</style>
