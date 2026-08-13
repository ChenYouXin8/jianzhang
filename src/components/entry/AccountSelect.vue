<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLedgerStore } from '@/stores/ledger'
import { formatCents } from '@/utils/money'
import CategoryIcon from '@/components/common/CategoryIcon.vue'

/** 账户选择行：点击弹出选择器，选项带实时余额（余额由纯函数聚合，不落库） */
const props = withDefaults(defineProps<{ modelValue: string; label?: string }>(), {
  label: '账户',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const ledger = useLedgerStore()
const show = ref(false)
const account = computed(() => ledger.accounts.find((a) => a.id === props.modelValue))

const columns = computed(() =>
  ledger.activeAccounts.map((a) => ({
    text: `${a.name}（余额 ${formatCents(ledger.balanceOf(a.id))}）`,
    value: a.id,
  })),
)

function onConfirm({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) {
  const first = selectedOptions[0]?.value
  if (first) emit('update:modelValue', first)
  show.value = false
}
</script>

<template>
  <button
    class="account-select"
    :data-testid="`account-select-${label}`"
    type="button"
    @click="show = true"
  >
    <span class="label">{{ label }}</span>
    <span v-if="account" class="value">
      <CategoryIcon :icon="account.icon" :color="account.color" :size="20" />
      <span class="name">{{ account.name }}</span>
    </span>
    <span v-else class="value placeholder">选择账户</span>
    <van-icon name="arrow" class="chevron" />
  </button>

  <van-popup v-model:show="show" position="bottom" round>
    <van-picker :columns="columns" title="选择账户" @confirm="onConfirm" @cancel="show = false" />
  </van-popup>
</template>

<style scoped>
.account-select {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 0;
  text-align: left;
}
.label {
  font-size: 14px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
.value {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.placeholder {
  color: var(--color-text-tertiary);
}
.chevron {
  color: var(--color-text-tertiary);
  font-size: 12px;
}
</style>
