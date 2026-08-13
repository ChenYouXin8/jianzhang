<script setup lang="ts">
import { computed } from 'vue'
import { formatCents } from '@/utils/money'

/**
 * 金额文本：全应用统一的金额展示组件。
 * - 数字等宽（tabular-nums）保证列表/汇总对齐；
 * - 颜色按语义：支出橙红 / 收入绿 / 转账与中性用正文色；
 * - 正文级数字用深色变体（--color-*-deep），白底对比度达 AA。
 */
const props = withDefaults(
  defineProps<{
    cents: number
    kind?: 'expense' | 'income' | 'transfer' | 'neutral'
    sign?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { kind: 'neutral', sign: false, size: 'md' },
)

const text = computed(() => formatCents(props.cents, { sign: props.sign }))
const color = computed(() => {
  switch (props.kind) {
    case 'expense':
      return 'var(--color-expense-deep)'
    case 'income':
      return 'var(--color-primary-deep)'
    default:
      return 'var(--color-text)'
  }
})
</script>

<template>
  <span class="amount num" :class="`size-${size}`" :style="{ color }" data-testid="amount-text">{{
    text
  }}</span>
</template>

<style scoped>
.amount {
  font-weight: 600;
  line-height: 1.2;
}
.size-sm {
  font-size: 13px;
}
.size-md {
  font-size: 15px;
}
.size-lg {
  font-size: 22px;
}
</style>
