<script setup lang="ts">
import CategoryIcon from '@/components/common/CategoryIcon.vue'
import AmountText from '@/components/common/AmountText.vue'
import type { CategoryStat } from '@/services/stats'

/**
 * 分类排行列表：图表旁的「表格视图」（无障碍与精确读数）。
 * 文字一律用文字色，颜色只出现在图标与比例条上——身份不依赖颜色。
 */
defineProps<{
  stats: CategoryStat[]
  kind: 'expense' | 'income'
}>()
</script>

<template>
  <ol class="rank-list" :data-testid="`rank-${kind}`">
    <li v-for="(s, i) in stats" :key="s.categoryId" class="rank-item">
      <span class="rank-no num">{{ i + 1 }}</span>
      <CategoryIcon :icon="s.icon" :color="s.color" :size="32" />
      <span class="rank-body">
        <span class="rank-top">
          <span class="rank-name">{{ s.name }}</span>
          <AmountText :cents="s.amount" :kind="kind" size="sm" />
        </span>
        <span class="rank-bar-track">
          <span
            class="rank-bar"
            :style="{ width: `${Math.min(s.percent, 100)}%`, backgroundColor: s.color }"
          />
        </span>
        <span class="rank-meta num">{{ s.percent }}% · {{ s.count }} 笔</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}
.rank-no {
  width: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.rank-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rank-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.rank-name {
  font-size: 14px;
}
.rank-bar-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-bg);
  overflow: hidden;
}
.rank-bar {
  display: block;
  height: 100%;
  border-radius: 2px;
  opacity: 0.85;
}
.rank-meta {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
