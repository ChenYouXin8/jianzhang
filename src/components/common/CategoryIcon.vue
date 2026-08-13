<script setup lang="ts">
/**
 * 分类/账户图标：emoji 置于「分类色 12% 透明度」的圆底上。
 * 选 emoji 的原因：跨平台渲染一致、零依赖、可读性强；
 * 若后期换图标库，只需替换本组件的 emoji 渲染层。
 */
withDefaults(
  defineProps<{
    icon: string
    color: string
    size?: number
  }>(),
  { size: 40 },
)
</script>

<template>
  <span
    class="cat-icon"
    aria-hidden="true"
    :style="{
      backgroundColor: color + '1f',
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.5)}px`,
    }"
    >{{ icon }}</span
  >
</template>

<style scoped>
.cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  line-height: 1;
}
</style>
