<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

/**
 * ECharts 轻量封装（按需引入，tree-shaking 后仅包含折线/饼图）：
 * - option 引用变化时整体重绘（notMerge，避免残留状态）；
 * - ResizeObserver 自适应容器宽度（移动端旋转/折叠屏）；
 * - 卸载时 dispose，防止内存泄漏。
 * 图表规范见 dataviz skill：细标记、2px 间隙、悬浮 tooltip、文本用文字色。
 */
echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(defineProps<{ option: EChartsCoreOption; height?: string }>(), {
  height: '220px',
})

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  chart.setOption(props.option)
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(el.value)
})

watch(
  () => props.option,
  (opt) => chart?.setOption(opt, { notMerge: true }),
)

onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="base-chart" :style="{ height }" data-testid="chart"></div>
</template>

<style scoped>
.base-chart {
  width: 100%;
}
</style>
