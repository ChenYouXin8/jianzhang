<script setup lang="ts">
/** 空状态：统一引导文案，避免空白页让用户不知所措 */
withDefaults(defineProps<{ description?: string }>(), { description: '暂无数据' })
</script>

<template>
  <div class="empty-state" data-testid="empty-state">
    <van-empty :description="description" image-size="96" />
  </div>
</template>

<style scoped>
.empty-state {
  padding: 32px 0;
}
</style>
