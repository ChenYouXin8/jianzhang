<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useLedgerStore } from '@/stores/ledger'
import type { TxType } from '@/types'
import { TX_TYPE_LABELS } from '@/utils/constants'
import { emptyFilters, type BillFilters } from './filters'

/**
 * 账单筛选弹层：类型 / 一级分类 / 账户 / 时间范围。
 * 采用「草稿 + 确定」模式：取消不会污染已生效的筛选条件。
 * 一级分类筛选会命中其全部二级分类（与统计口径一致）。
 */

const props = defineProps<{ modelValue: boolean; filters: BillFilters }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'apply', f: BillFilters): void }>()

const ledger = useLedgerStore()
const draft = reactive<BillFilters>(emptyFilters())

watch(
  () => props.modelValue,
  (v) => {
    if (v) Object.assign(draft, props.filters)
  },
)

/* 各选项弹层显隐 */
const showType = ref(false)
const showCategory = ref(false)
const showAccount = ref(false)
const showRange = ref(false)
const showFrom = ref(false)
const showTo = ref(false)

const typeOptions = computed(() => [
  { text: '全部类型', value: '' },
  ...(['expense', 'income', 'transfer'] as TxType[]).map((v) => ({
    text: TX_TYPE_LABELS[v],
    value: v,
  })),
])
const categoryOptions = computed(() => [
  { text: '全部分类', value: '' },
  ...ledger.categories
    .filter((c) => !c.parentId && c.enabled)
    .map((c) => ({ text: c.name, value: c.id })),
])
const accountOptions = computed(() => [
  { text: '全部账户', value: '' },
  ...ledger.accounts.map((a) => ({ text: a.name, value: a.id })),
])
const rangeOptions = [
  { text: '本月', value: 'month' },
  { text: '近 3 月', value: '3m' },
  { text: '自定义', value: 'custom' },
]

const typeLabel = computed(() => typeOptions.value.find((o) => o.value === draft.type)?.text ?? '全部类型')
const categoryLabel = computed(
  () => categoryOptions.value.find((o) => o.value === draft.categoryId)?.text ?? '全部分类',
)
const accountLabel = computed(
  () => accountOptions.value.find((o) => o.value === draft.accountId)?.text ?? '全部账户',
)
const rangeLabel = computed(() => rangeOptions.find((o) => o.value === draft.range)?.text ?? '本月')

function apply() {
  emit('apply', { ...draft })
  emit('update:modelValue', false)
}
function reset() {
  Object.assign(draft, emptyFilters())
}
</script>

<template>
  <van-popup
    :show="modelValue"
    position="bottom"
    round
    @update:show="emit('update:modelValue', $event)"
  >
    <div class="filter-popup" data-testid="filter-popup">
      <h3 class="title">筛选</h3>

      <van-field
        :model-value="typeLabel"
        readonly
        is-link
        label="类型"
        data-testid="filter-type"
        @click="showType = true"
      />
      <van-field
        :model-value="categoryLabel"
        readonly
        is-link
        label="分类"
        data-testid="filter-category"
        @click="showCategory = true"
      />
      <van-field
        :model-value="accountLabel"
        readonly
        is-link
        label="账户"
        data-testid="filter-account"
        @click="showAccount = true"
      />
      <van-field
        :model-value="rangeLabel"
        readonly
        is-link
        label="时间"
        data-testid="filter-range"
        @click="showRange = true"
      />
      <div v-if="draft.range === 'custom'" class="custom-range">
        <van-field
          :model-value="draft.from || '开始日期'"
          readonly
          is-link
          label="从"
          data-testid="filter-from"
          @click="showFrom = true"
        />
        <van-field
          :model-value="draft.to || '结束日期'"
          readonly
          is-link
          label="到"
          data-testid="filter-to"
          @click="showTo = true"
        />
      </div>

      <div class="actions">
        <van-button plain size="small" @click="reset">重置</van-button>
        <van-button type="primary" size="small" data-testid="filter-apply" @click="apply">
          确定
        </van-button>
      </div>
    </div>

    <van-popup v-model:show="showType" position="bottom" round>
      <van-picker
        :columns="typeOptions"
        @confirm="({ selectedOptions }) => { draft.type = selectedOptions[0]?.value ?? ''; showType = false }"
        @cancel="showType = false"
      />
    </van-popup>
    <van-popup v-model:show="showCategory" position="bottom" round>
      <van-picker
        :columns="categoryOptions"
        @confirm="({ selectedOptions }) => { draft.categoryId = selectedOptions[0]?.value ?? ''; showCategory = false }"
        @cancel="showCategory = false"
      />
    </van-popup>
    <van-popup v-model:show="showAccount" position="bottom" round>
      <van-picker
        :columns="accountOptions"
        @confirm="({ selectedOptions }) => { draft.accountId = selectedOptions[0]?.value ?? ''; showAccount = false }"
        @cancel="showAccount = false"
      />
    </van-popup>
    <van-popup v-model:show="showRange" position="bottom" round>
      <van-picker
        :columns="rangeOptions"
        @confirm="({ selectedOptions }) => { draft.range = (selectedOptions[0]?.value ?? 'month') as BillFilters['range']; showRange = false }"
        @cancel="showRange = false"
      />
    </van-popup>
    <van-popup v-model:show="showFrom" position="bottom" round>
      <van-date-picker
        :model-value="(draft.from || '2020-01-01').split('-')"
        :min-date="new Date(2000, 0, 1)"
        :max-date="new Date()"
        title="开始日期"
        @confirm="({ selectedValues }) => { draft.from = selectedValues.join('-'); showFrom = false }"
        @cancel="showFrom = false"
      />
    </van-popup>
    <van-popup v-model:show="showTo" position="bottom" round>
      <van-date-picker
        :model-value="(draft.to || '2020-01-01').split('-')"
        :min-date="new Date(2000, 0, 1)"
        :max-date="new Date()"
        title="结束日期"
        @confirm="({ selectedValues }) => { draft.to = selectedValues.join('-'); showTo = false }"
        @cancel="showTo = false"
      />
    </van-popup>
  </van-popup>
</template>

<style scoped>
.filter-popup {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  min-width: 320px;
}
.title {
  margin: 0 0 8px;
  font-size: 16px;
  text-align: center;
}
.custom-range {
  margin-top: 8px;
  border-top: 1px dashed var(--color-border);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
