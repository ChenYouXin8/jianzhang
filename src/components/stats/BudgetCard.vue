<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { showSuccessToast } from 'vant'
import AmountText from '@/components/common/AmountText.vue'
import { useLedgerStore } from '@/stores/ledger'
import { centsToYuan, formatCents, yuanToCents } from '@/utils/money'

/**
 * 预算卡：总预算 + 各一级分类预算进度，超支醒目提示。
 * 状态色规范：正常绿 / ≥80% 琥珀警示 / 超支红 —— 且始终配文字（绝不只靠颜色）。
 */
const props = defineProps<{ month: string }>()

const ledger = useLedgerStore()
const overview = computed(() => ledger.budgetOf(props.month))

const showSetup = ref(false)
const setupDraft = reactive<Record<string, string>>({})

function openSetup() {
  setupDraft.total = overview.value.total ? centsToYuan(overview.value.total.amount) : ''
  for (const b of overview.value.byCategory) {
    setupDraft[b.categoryId ?? ''] = centsToYuan(b.amount)
  }
  showSetup.value = true
}

async function saveSetup() {
  // 有值的行保存；清空且有原预算的行删除（saveBudget amount=0 即删除）
  const existingIds = new Set(overview.value.byCategory.map((b) => b.categoryId))
  const tasks: Promise<void>[] = []
  for (const [categoryId, val] of Object.entries(setupDraft)) {
    const cents = val ? yuanToCents(val) : null
    if (!cents && !existingIds.has(categoryId || null)) continue
    tasks.push(
      ledger.saveBudget(props.month, categoryId === 'total' ? null : categoryId, cents ?? 0),
    )
  }
  await Promise.all(tasks)
  showSetup.value = false
  showSuccessToast('预算已保存')
}

function barColor(percent: number, over: boolean): string {
  if (over) return 'var(--color-expense)'
  if (percent >= 80) return '#e8890c' // 琥珀：接近上限警示
  return 'var(--color-primary)'
}
</script>

<template>
  <section class="budget-card card" aria-label="预算">
    <header class="budget-header">
      <h3 class="budget-title">预算</h3>
      <button class="setup-btn" data-testid="budget-setup" @click="openSetup">
        {{ overview.total ? '调整' : '设置预算' }}
      </button>
    </header>

    <template v-if="overview.total">
      <div class="total-row">
        <span class="total-label">总预算</span>
        <span class="total-nums num">
          <AmountText
            :cents="overview.total.spent"
            :kind="overview.total.over ? 'expense' : 'neutral'"
            size="sm"
          />
          <span class="sep"> / </span>
          <span class="num">{{ formatCents(overview.total.amount) }}</span>
        </span>
      </div>
      <van-progress
        :percentage="Math.min(overview.total.percent, 100)"
        :color="barColor(overview.total.percent, overview.total.over)"
        :show-pivot="false"
        stroke-width="6"
        data-testid="budget-total-bar"
      />
      <div class="total-meta num">
        <span :class="{ over: overview.total.over }" data-testid="budget-total-meta">
          {{ overview.total.percent }}%
          <template v-if="overview.total.over">
            · 超支 {{ formatCents(-overview.total.remaining) }}
          </template>
          <template v-else> · 剩余 {{ formatCents(overview.total.remaining) }}</template>
        </span>
      </div>
    </template>
    <p v-else class="budget-empty">还没有设置预算。设置后可按月监控支出，超支自动提醒。</p>

    <div v-if="overview.byCategory.length" class="cat-budgets" data-testid="budget-categories">
      <div v-for="b in overview.byCategory" :key="b.budgetId" class="cat-budget-row">
        <span class="cat-name">{{ b.name }}</span>
        <span class="cat-nums num">
          {{ formatCents(b.spent, { symbol: false }) }} / {{ formatCents(b.amount) }}
        </span>
        <van-progress
          :percentage="Math.min(b.percent, 100)"
          :color="barColor(b.percent, b.over)"
          :show-pivot="false"
          stroke-width="4"
        />
        <span class="cat-percent num" :class="{ over: b.over }">
          {{ b.percent }}%{{ b.over ? ` · 超支 ${formatCents(-b.remaining)}` : '' }}
        </span>
      </div>
    </div>

    <!-- 预算设置弹层 -->
    <van-popup v-model:show="showSetup" position="bottom" round>
      <div class="setup-panel" data-testid="budget-setup-panel">
        <h3 class="setup-title">{{ month }} 预算（元）</h3>
        <van-field
          v-model="setupDraft.total"
          type="digit"
          label="总预算"
          placeholder="不限"
          data-testid="budget-input-total"
        />
        <van-field
          v-for="cat in ledger.topCategoriesOf('expense')"
          :key="cat.id"
          v-model="setupDraft[cat.id]"
          type="digit"
          :label="cat.name"
          placeholder="不限"
        />
        <van-button block type="primary" data-testid="budget-save" @click="saveSetup">
          保存
        </van-button>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.budget-card {
  padding: 16px;
}
.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.budget-title {
  margin: 0;
  font-size: 15px;
}
.setup-btn {
  color: var(--color-primary-deep);
  font-size: 13px;
  min-height: 44px;
  padding: 0 8px;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 10px 0 6px;
}
.total-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.sep {
  color: var(--color-text-tertiary);
  margin: 0 4px;
}
.total-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.total-meta .over,
.cat-percent.over {
  color: var(--color-expense-deep);
}
.budget-empty {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--color-text-tertiary);
}
.cat-budgets {
  margin-top: 12px;
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cat-budget-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cat-name {
  font-size: 13px;
}
.cat-nums {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.cat-percent {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.setup-panel {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  max-height: 80vh;
  overflow-y: auto;
}
.setup-title {
  margin: 0 0 8px;
  font-size: 15px;
  text-align: center;
}
</style>
