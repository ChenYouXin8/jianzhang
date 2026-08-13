<script setup lang="ts">
import type { Category } from '@/types'
import CategoryIcon from '@/components/common/CategoryIcon.vue'

/**
 * 分类选择网格：一级分类 5 列展示；选中含子分类的一级后，
 * 网格下方出现二级分类横向 chip 行（点一级选该一级，点 chip 选二级）。
 */
defineProps<{
  categories: Category[]
  selectedTopId?: string
  children: Category[]
  selectedId: string
}>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()
</script>

<template>
  <div class="category-grid" data-testid="category-grid">
    <button
      v-for="c in categories"
      :key="c.id"
      class="cat-cell"
      :class="{ active: c.id === selectedTopId }"
      :data-testid="`category-${c.id}`"
      @click="emit('select', c.id)"
    >
      <CategoryIcon :icon="c.icon" :color="c.color" :size="44" />
      <span class="name">{{ c.name }}</span>
    </button>

    <div v-if="children.length" class="children-row" data-testid="children-row">
      <button
        v-for="ch in children"
        :key="ch.id"
        class="child-chip"
        :class="{ active: ch.id === selectedId }"
        :data-testid="`child-${ch.id}`"
        @click="emit('select', ch.id)"
      >
        {{ ch.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-grid {
  padding: 4px 8px;
}
.cat-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 20%;
  padding: 8px 0;
  border-radius: 12px;
}
.cat-cell.active {
  background: var(--color-primary-soft);
}
.name {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.cat-cell.active .name {
  color: var(--color-primary-deep);
  font-weight: 600;
}
.children-row {
  display: flex;
  gap: 8px;
  padding: 4px 0 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.child-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-bg);
  font-size: 13px;
  color: var(--color-text-secondary);
  min-height: 32px;
}
.child-chip.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 500;
}
</style>
