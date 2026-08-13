<script setup lang="ts">
import { computed } from 'vue'
import { useLedgerStore } from '@/stores/ledger'
import type { Transaction } from '@/types'
import AmountText from '@/components/common/AmountText.vue'
import CategoryIcon from '@/components/common/CategoryIcon.vue'

/**
 * 账单列表项：
 * - 点按 → 编辑（或管理模式下切换选中）；
 * - 左滑 → 删除（移动端手势；桌面端可用编辑弹层里的删除按钮）；
 * - 转账显示「账户A → 账户B」，不参与收支着色的金额用中性色。
 */
const props = defineProps<{
  tx: Transaction
  selectable?: boolean
  selected?: boolean
}>()
const emit = defineEmits<{ (e: 'click'): void; (e: 'toggle'): void; (e: 'delete'): void }>()

const ledger = useLedgerStore()

const icon = computed(() => {
  if (props.tx.type === 'transfer') return { icon: '🔁', color: '#9aa1ad' }
  const cat = ledger.categories.find((c) => c.id === props.tx.categoryId)
  return { icon: cat?.icon ?? '📦', color: cat?.color ?? '#9aa1ad' }
})

const title = computed(() => {
  const t = props.tx
  if (t.type === 'transfer') {
    const from = ledger.accounts.find((a) => a.id === t.accountId)?.name ?? ''
    const to = ledger.accounts.find((a) => a.id === t.toAccountId)?.name ?? ''
    return `${from} → ${to}`
  }
  return ledger.categories.find((c) => c.id === t.categoryId)?.name ?? '未分类'
})

const meta = computed(() => {
  const t = props.tx
  const account = ledger.accounts.find((a) => a.id === t.accountId)?.name ?? ''
  return [account, t.note].filter(Boolean).join(' · ')
})
</script>

<template>
  <van-swipe-cell>
    <button
      class="tx-item"
      :class="{ selectable }"
      :data-testid="`tx-${tx.id}`"
      type="button"
      @click="selectable ? emit('toggle') : emit('click')"
    >
      <van-checkbox
        v-if="selectable"
        :model-value="selected"
        class="check"
        :aria-label="`选择 ${title}`"
      />
      <CategoryIcon :icon="icon.icon" :color="icon.color" :size="40" />
      <span class="tx-meta">
        <span class="tx-title">{{ title }}</span>
        <span v-if="meta" class="tx-sub">{{ meta }}</span>
      </span>
      <AmountText :cents="tx.amount" :kind="tx.type" :sign="tx.type !== 'transfer'" size="md" />
    </button>
    <template #right>
      <van-button
        square
        type="danger"
        text="删除"
        class="swipe-del"
        :data-testid="`tx-del-${tx.id}`"
        @click="emit('delete')"
      />
    </template>
  </van-swipe-cell>
</template>

<style scoped>
.tx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 60px;
  padding: 10px 12px;
  text-align: left;
  background: var(--color-card);
}
.tx-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.tx-title {
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tx-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 管理模式的复选框为纯视觉件，点按整行切换 */
.check {
  pointer-events: none;
}
.swipe-del {
  height: 100%;
  border-radius: 0 12px 12px 0;
}
</style>
