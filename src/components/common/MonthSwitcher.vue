<script setup lang="ts">
import { monthLabel } from '@/utils/date'

/** 月份切换器：左右箭头切换，展示 '2026年8月'（账单/统计页共用） */
const props = defineProps<{ month: string }>()
const emit = defineEmits<{ (e: 'update:month', m: string): void }>()

function shift(delta: number): void {
  const [y, m] = props.month.split('-').map(Number)
  // 本地时区构造，避免 UTC 偏移导致跨月计算错误
  const d = new Date(y, m - 1 + delta, 1)
  emit('update:month', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}
</script>

<template>
  <div class="month-switcher" data-testid="month-switcher">
    <button class="arrow tap-target" aria-label="上个月" data-testid="month-prev" @click="shift(-1)">
      <van-icon name="arrow-left" />
    </button>
    <span class="label">{{ monthLabel(month) }}</span>
    <button class="arrow tap-target" aria-label="下个月" data-testid="month-next" @click="shift(1)">
      <van-icon name="arrow" />
    </button>
  </div>
</template>

<style scoped>
.month-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.label {
  min-width: 96px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
}
.arrow {
  color: var(--color-text-secondary);
  border-radius: 50%;
}
.arrow:active {
  background: var(--color-bg);
}
</style>
