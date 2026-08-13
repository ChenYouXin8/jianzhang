<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { showConfirmDialog, showSuccessToast } from 'vant'
import { useLedgerStore } from '@/stores/ledger'
import type { Transaction } from '@/types'
import { centsToYuan, yuanToCents } from '@/utils/money'
import AccountSelect from '@/components/entry/AccountSelect.vue'
import CategoryGrid from '@/components/entry/CategoryGrid.vue'
import DateSelect from '@/components/entry/DateSelect.vue'

/**
 * 账单编辑弹层：点列表项打开。
 * 设计决策：类型不可改（改类型 = 不同性质的账，删除重记更安全），
 * 金额/日期/账户/分类/备注可改；转账可改转出/转入账户。
 */
const props = defineProps<{ show: boolean; tx: Transaction | null }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'deleted'): void }>()

const ledger = useLedgerStore()

const amountStr = ref('')
const categoryId = ref('')
const accountId = ref('')
const toAccountId = ref('')
const date = ref('')
const note = ref('')
const showNote = ref(false)

// 打开时用账单数据预填
watch(
  () => props.show,
  (v) => {
    if (!v || !props.tx) return
    const t = props.tx
    amountStr.value = centsToYuan(t.amount)
    categoryId.value = t.categoryId ?? ''
    accountId.value = t.accountId
    toAccountId.value = t.toAccountId ?? ''
    date.value = t.date
    note.value = t.note
    showNote.value = Boolean(t.note)
  },
)

const tx = computed(() => props.tx)
const topList = computed(() => ledger.topCategoriesOf(tx.value?.type === 'income' ? 'income' : 'expense'))
const selectedCategory = computed(() => ledger.categories.find((c) => c.id === categoryId.value))
const selectedTop = computed(() => {
  const cat = selectedCategory.value
  if (!cat) return undefined
  return cat.parentId ? ledger.categories.find((c) => c.id === cat.parentId) : cat
})
const children = computed(() => (selectedTop.value ? ledger.childrenOf(selectedTop.value.id) : []))

const canSave = computed(() => {
  const cents = yuanToCents(amountStr.value)
  if (!cents || cents <= 0) return false
  if (tx.value?.type === 'transfer') {
    return Boolean(accountId.value && toAccountId.value && accountId.value !== toAccountId.value)
  }
  return Boolean(accountId.value && categoryId.value)
})

async function save() {
  if (!tx.value || !canSave.value) return
  await ledger.editTransaction(tx.value.id, {
    amount: yuanToCents(amountStr.value)!,
    accountId: accountId.value,
    toAccountId: tx.value.type === 'transfer' ? toAccountId.value : undefined,
    categoryId: tx.value.type === 'transfer' ? undefined : categoryId.value,
    date: date.value,
    note: note.value.trim(),
  })
  showSuccessToast('已保存')
  emit('update:show', false)
}

async function remove() {
  if (!tx.value) return
  await showConfirmDialog({ title: '删除账单', message: '删除后不可恢复，确定删除这笔账单吗？' })
  await ledger.removeTransaction(tx.value.id)
  showSuccessToast('已删除')
  emit('update:show', false)
  emit('deleted')
}
</script>

<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ maxHeight: '86vh' }"
    @update:show="emit('update:show', $event)"
  >
    <div v-if="tx" class="edit-sheet" data-testid="edit-sheet">
      <h3 class="title">编辑账单</h3>

      <!-- 金额 -->
      <div class="amount-row">
        <input
          v-model="amountStr"
          class="amount-input num"
          data-testid="edit-amount"
          inputmode="decimal"
          placeholder="0.00"
          @input="amountStr = amountStr.replace(/[^\d.]/g, '').slice(0, 12)"
        />
      </div>

      <!-- 分类 / 转账账户对 -->
      <template v-if="tx.type !== 'transfer'">
        <CategoryGrid
          :categories="topList"
          :selected-top-id="selectedTop?.id"
          :children="children"
          :selected-id="categoryId"
          @select="categoryId = $event"
        />
      </template>
      <template v-else>
        <div class="transfer-accounts">
          <AccountSelect v-model="accountId" label="转出账户" />
          <div class="transfer-arrow"><van-icon name="arrow-down" /></div>
          <AccountSelect v-model="toAccountId" label="转入账户" />
        </div>
      </template>

      <div class="meta-row">
        <AccountSelect v-if="tx.type !== 'transfer'" v-model="accountId" label="账户" />
        <DateSelect v-model="date" />
      </div>
      <input v-model="note" class="note-input" data-testid="edit-note" placeholder="备注（50 字内）" maxlength="50" />

      <div class="actions">
        <van-button plain type="danger" size="small" data-testid="edit-delete" @click="remove">
          删除
        </van-button>
        <van-button type="primary" size="small" :disabled="!canSave" data-testid="edit-save" @click="save">
          保存
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.edit-sheet {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
}
.title {
  margin: 0 0 4px;
  font-size: 16px;
  text-align: center;
}
.amount-row {
  text-align: center;
  padding: 8px 0;
}
.amount-input {
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
}
.transfer-accounts {
  padding: 0 8px;
}
.transfer-arrow {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 14px;
}
.meta-row {
  display: flex;
  gap: 12px;
  border-top: 1px solid var(--color-border);
}
.meta-row > * {
  flex: 1;
}
.note-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  background: var(--color-bg);
}
.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
}
</style>
