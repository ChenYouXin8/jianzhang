<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { showSuccessToast } from 'vant'
import { useLedgerStore } from '@/stores/ledger'
import { useUiStore } from '@/stores/ui'
import type { TxType } from '@/types'
import { TX_TYPE_LABELS } from '@/utils/constants'
import { todayStr } from '@/utils/date'
import { yuanToCents } from '@/utils/money'
import AccountSelect from './AccountSelect.vue'
import CategoryGrid from './CategoryGrid.vue'
import DateSelect from './DateSelect.vue'

/**
 * 快速记账面板 —— 「3 秒记账」的核心：
 * 1. 打开即记：类型/账户/分类都有智能默认，无需任何先置操作；
 * 2. 金额走 Vant 数字键盘（含小数点），输入护栏只放行合法金额；
 * 3. 保存后自动记住「上次使用」，下次更快；金额/备注清空，便于连续记账。
 */
const ledger = useLedgerStore()
const ui = useUiStore()

const emit = defineEmits<{ (e: 'saved'): void }>()

/* ---------------- 表单状态 ---------------- */
const TYPES: TxType[] = ['expense', 'income', 'transfer']
const type = ref<TxType>('expense')
const amountStr = ref('') // 键盘输入的原始字符串，保存时才转「分」
const categoryId = ref('')
const accountId = ref('')
const toAccountId = ref('')
const date = ref(todayStr())
const note = ref('')
const showKeyboard = ref(false)
const showNote = ref(false)

/* ---------------- 分类派生 ---------------- */
const topList = computed(() =>
  ledger.topCategoriesOf(type.value === 'income' ? 'income' : 'expense'),
)
const selectedCategory = computed(() => ledger.categories.find((c) => c.id === categoryId.value))
const selectedTop = computed(() => {
  const cat = selectedCategory.value
  if (!cat) return undefined
  return cat.parentId ? ledger.categories.find((c) => c.id === cat.parentId) : cat
})
const children = computed(() =>
  selectedTop.value ? ledger.childrenOf(selectedTop.value.id) : [],
)

/* ---------------- 默认值与「上次使用」记忆 ---------------- */
watch(
  type,
  (t) => {
    if (t === 'transfer') return
    const remembered = ui.last.categoryByType?.[t]
    const valid = remembered && ledger.categories.some((c) => c.id === remembered)
    categoryId.value = valid ? remembered : (ledger.topCategoriesOf(t)[0]?.id ?? '')
  },
  { immediate: true },
)
watch(
  () => ui.last.accountId,
  (id) => {
    accountId.value = id
  },
  { immediate: true },
)

/* 复记预填：最近记录 / 账单列表触发（stores/ui.requestPrefill） */
watch(
  () => ui.draftSeq,
  () => {
    const d = ui.draft
    if (!d) return
    if (d.type) type.value = d.type
    if (d.amount !== undefined) amountStr.value = d.amount
    if (d.categoryId) categoryId.value = d.categoryId
    if (d.accountId) accountId.value = d.accountId
    if (d.toAccountId) toAccountId.value = d.toAccountId
    if (d.date) date.value = d.date
    if (d.note !== undefined) {
      note.value = d.note
      showNote.value = Boolean(d.note)
    }
    ui.clearDraft()
  },
)

/* ---------------- 金额输入 ---------------- */
const amountDisplay = computed(() => {
  if (!amountStr.value) return '0.00'
  return amountStr.value.replace(/\.$/, '') // '12.' 展示为 '12'
})
const amountEmpty = computed(() => !amountStr.value)

/** 数字键盘直通值护栏：只保留 ≤9 位整数 + ≤2 位小数 + 唯一小数点 */
function onAmountInput(val: string) {
  const s = val.replace(/[^\d.]/g, '')
  const [intPart, ...rest] = s.split('.')
  const frac = rest.join('').slice(0, 2)
  amountStr.value = rest.length ? `${intPart.slice(0, 9)}.${frac}` : intPart.slice(0, 9)
}

/* ---------- 桌面兼容：鼠标点击 → 合成 touch ----------
 * Vant 数字键盘只监听 touch 事件，桌面浏览器鼠标点击不产生 touch，
 * 导致键盘按键点了没反应。这里把按键上的 click 翻译为 touchstart/touchend。
 * 移动端不受影响：真实触摸的 touchend 里 Vant 会 preventDefault，
 * 浏览器不再合成 click，因此不会重复触发。 */
const KEY_WRAPPER_SELECTOR = '.van-number-keyboard .van-key__wrapper'

function onKeyClickCompat(ev: MouseEvent) {
  const target = ev.target as Element | null
  if (!target) return
  const key = target.closest(KEY_WRAPPER_SELECTOR)
  if (!key) return
  const touch = new Touch({
    identifier: Date.now(),
    target: key,
    clientX: ev.clientX,
    clientY: ev.clientY,
    pageX: ev.pageX,
    pageY: ev.pageY,
    screenX: ev.screenX,
    screenY: ev.screenY,
  })
  key.dispatchEvent(
    new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }),
  )
  key.dispatchEvent(
    new TouchEvent('touchend', { touches: [], changedTouches: [touch], bubbles: true, cancelable: true }),
  )
  ev.preventDefault()
}

onMounted(() => document.addEventListener('click', onKeyClickCompat, true))
onUnmounted(() => document.removeEventListener('click', onKeyClickCompat, true))

/* ---------------- 保存 ---------------- */
const canSave = computed(() => {
  const cents = yuanToCents(amountStr.value)
  if (!cents || cents <= 0) return false
  if (!accountId.value) return false
  if (type.value === 'transfer') {
    return Boolean(toAccountId.value && toAccountId.value !== accountId.value)
  }
  return Boolean(categoryId.value)
})

async function save() {
  if (!canSave.value) return
  await ledger.addTransaction({
    type: type.value,
    amount: yuanToCents(amountStr.value)!,
    accountId: accountId.value,
    toAccountId: type.value === 'transfer' ? toAccountId.value : undefined,
    categoryId: type.value === 'transfer' ? undefined : categoryId.value,
    date: date.value,
    note: note.value.trim(),
  })
  // 记住「上次使用」：类型 / 账户 / 该类型分类
  await ui.rememberLast({
    type: type.value,
    accountId: accountId.value,
    categoryByType:
      type.value === 'transfer'
        ? ui.last.categoryByType
        : { ...ui.last.categoryByType, [type.value]: categoryId.value },
  })
  // 重置金额与备注；分类/账户保留，符合连续记账习惯
  amountStr.value = ''
  note.value = ''
  showNote.value = false
  showSuccessToast('已记账')
  emit('saved')
}
</script>

<template>
  <section class="quick-entry card" data-testid="quick-entry" aria-label="快速记账">
    <!-- 类型切换 -->
    <div class="type-tabs" role="tablist">
      <button
        v-for="t in TYPES"
        :key="t"
        role="tab"
        :aria-selected="type === t"
        class="type-tab"
        :class="{ active: type === t }"
        :data-testid="`type-${t}`"
        @click="type = t"
      >
        {{ TX_TYPE_LABELS[t] }}
      </button>
    </div>

    <!-- 金额（点按唤起数字键盘） -->
    <button
      class="amount-display num"
      data-testid="amount-input"
      aria-label="金额输入"
      @click="showKeyboard = true"
    >
      <span class="symbol">¥</span>
      <span class="digits" :class="{ empty: amountEmpty }">{{ amountDisplay }}</span>
    </button>

    <!-- 分类网格（转账时为 转出 → 转入 账户对） -->
    <template v-if="type !== 'transfer'">
      <CategoryGrid
        :categories="topList"
        :selected-top-id="selectedTop?.id"
        :children="children"
        :selected-id="categoryId"
        @select="categoryId = $event"
      />
    </template>
    <template v-else>
      <div class="transfer-accounts" data-testid="transfer-accounts">
        <AccountSelect v-model="accountId" label="转出账户" />
        <div class="transfer-arrow"><van-icon name="arrow-down" /></div>
        <AccountSelect v-model="toAccountId" label="转入账户" />
      </div>
    </template>

    <!-- 账户 / 日期 / 备注 -->
    <div class="meta-row">
      <AccountSelect v-if="type !== 'transfer'" v-model="accountId" label="账户" />
      <DateSelect v-model="date" />
      <button
        class="note-toggle"
        :class="{ on: showNote }"
        data-testid="note-toggle"
        @click="showNote = !showNote"
      >
        备注
      </button>
    </div>
    <input
      v-if="showNote"
      v-model="note"
      class="note-input"
      data-testid="note-input"
      placeholder="写点备注…（50 字内）"
      maxlength="50"
    />

    <!-- 保存 -->
    <button class="save-btn num" :disabled="!canSave" data-testid="save-btn" @click="save">
      保存
    </button>

    <!-- 数字键盘 -->
    <van-number-keyboard
      :model-value="amountStr"
      :show="showKeyboard"
      theme="custom"
      extra-key="."
      :maxlength="12"
      close-button-text="完成"
      data-testid="number-keyboard"
      @update:model-value="onAmountInput"
      @update:show="showKeyboard = $event"
      @close="showKeyboard = false"
    />
  </section>
</template>

<style scoped>
.quick-entry {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 类型切换 */
.type-tabs {
  display: flex;
  background: var(--color-bg);
  border-radius: 10px;
  padding: 3px;
}
.type-tab {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-secondary);
  min-height: 34px;
}
.type-tab.active {
  background: var(--color-card);
  color: var(--color-text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
}
/* 类型语义色提示：激活项下方小圆点 */
.type-tab.active::after {
  content: '';
  display: block;
  width: 12px;
  height: 3px;
  border-radius: 2px;
  margin: 2px auto 0;
}
.type-tab[data-testid='type-income'].active::after {
  background: var(--color-primary);
}
.type-tab[data-testid='type-expense'].active::after {
  background: var(--color-expense);
}
.type-tab[data-testid='type-transfer'].active::after {
  background: var(--color-text-tertiary);
}

/* 金额展示 */
.amount-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  padding: 14px 0 6px;
  min-height: 44px;
}
.symbol {
  font-size: 20px;
  color: var(--color-text-secondary);
}
.digits {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.digits.empty {
  color: var(--color-text-tertiary);
}

/* 转账 */
.transfer-accounts {
  padding: 0 8px;
}
.transfer-arrow {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 14px;
}

/* 元信息行 */
.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--color-border);
}
.meta-row > * {
  flex: 1;
}
.note-toggle {
  min-height: 44px;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: left;
}
.note-toggle.on {
  color: var(--color-primary-deep);
}
.note-input {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  background: var(--color-bg);
}
.note-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

/* 保存按钮 */
.save-btn {
  margin-top: 4px;
  padding: 13px 0;
  border-radius: 12px;
  background: var(--color-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  min-height: 48px;
}
.save-btn:disabled {
  opacity: 0.4;
}
.save-btn:not(:disabled):active {
  opacity: 0.85;
}
</style>
