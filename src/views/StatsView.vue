<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseChart from '@/components/chart/BaseChart.vue'
import AmountText from '@/components/common/AmountText.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MonthSwitcher from '@/components/common/MonthSwitcher.vue'
import BudgetCard from '@/components/stats/BudgetCard.vue'
import CategoryRankList from '@/components/stats/CategoryRankList.vue'
import { buildMonthlyTrend } from '@/services/stats'
import { useLedgerStore } from '@/stores/ledger'
import { currentMonth, lastMonths } from '@/utils/date'
import { formatCents } from '@/utils/money'
import type { EChartsCoreOption } from 'echarts/core'

/**
 * 统计页：月度总览 + 近 6 月趋势 + 分类占比（环形图 + 排行）+ 预算。
 * 图表规范（dataviz）：
 * - 收支双色 #0fa968/#ed5b2d 已通过色觉校验；分类色使用校验过的 5 色调色板；
 * - 文字一律文字色，颜色只出现在标记上；悬浮 tooltip；排行列表充当图例与表格视图。
 */
const ledger = useLedgerStore()
const month = ref(currentMonth())

const summary = computed(() => ledger.summaryOf(month.value))

/* ---------------- 近 6 月趋势（折线） ---------------- */
const trendMonths = computed(() => lastMonths(6, month.value))
const trendData = computed(() => buildMonthlyTrend(ledger.transactions, trendMonths.value))
const hasTrend = computed(() => trendData.value.some((p) => p.expense > 0 || p.income > 0))

const trendOption = computed<EChartsCoreOption>(() => ({
  grid: { left: 8, right: 12, top: 16, bottom: 0, containLabel: true },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (v: unknown) =>
      `¥${(Number(v) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trendMonths.value.map((m) => `${Number(m.slice(5))}月`),
    axisLine: { lineStyle: { color: '#eef0f4' } },
    axisTick: { show: false },
    axisLabel: { color: '#9aa1ad', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      color: '#9aa1ad',
      fontSize: 11,
      formatter: (v: number) => (v >= 10000 ? `${Math.round(v / 10000 * 10) / 10}万` : String(v)),
    },
    splitLine: { lineStyle: { color: '#eef0f4' } },
  },
  series: [
    {
      name: '收入',
      type: 'line',
      smooth: true,
      data: trendData.value.map((p) => p.income / 100),
      lineStyle: { width: 2, color: '#0fa968' },
      itemStyle: { color: '#0fa968' },
      symbolSize: 6,
      showSymbol: false,
    },
    {
      name: '支出',
      type: 'line',
      smooth: true,
      data: trendData.value.map((p) => p.expense / 100),
      lineStyle: { width: 2, color: '#ed5b2d' },
      itemStyle: { color: '#ed5b2d' },
      symbolSize: 6,
      showSymbol: false,
    },
  ],
}))

/* ---------------- 分类占比（环形图，仅在有数据时渲染） ---------------- */
interface DonutSlice {
  name: string
  color: string
  amount: number
  percent: number
}

function donutOption(stats: DonutSlice[], totalCents: number, title: string): EChartsCoreOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; percent: number; value: number }) =>
        `${p.name} ¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} · ${p.percent}%`,
    },
    title: {
      text: title,
      subtext: formatCents(totalCents),
      left: 'center',
      top: '38%',
      textStyle: { color: '#6b7280', fontSize: 12, fontWeight: 400 },
      subtextStyle: { color: '#1f2329', fontSize: 15, fontWeight: 600 },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '50%'],
        minShowLabelAngle: 25, // 只给大扇区直接标注，小扇区交给排行列表
        itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 3 },
        label: { color: '#6b7280', fontSize: 11, formatter: '{b} {d}%' },
        labelLine: { length: 10, length2: 6, lineStyle: { color: '#d3d7df' } },
        data: stats.map((s) => ({ name: s.name, value: s.amount / 100, itemStyle: { color: s.color } })),
      },
    ],
  }
}

/** 环形图最多 5 个扇区 + 「其他」归并，避免扇区过多不可读 */
const expenseDonut = computed(() => {
  const stats = summary.value.expenseByCategory
  if (!stats.length) return { stats: [] as typeof stats, total: 0 }
  const top = stats.slice(0, 5)
  const restAmount = stats.slice(5).reduce((s, v) => s + v.amount, 0)
  const restPercent = stats.slice(5).reduce((s, v) => s + v.percent, 0)
  return {
    stats: restAmount
      ? [...top, { name: '其他', color: '#9aa1ad', amount: restAmount, percent: restPercent }]
      : top,
    total: summary.value.expense,
  }
})
const expenseDonutOption = computed(() =>
  donutOption(
    expenseDonut.value.stats.map((s) => ({ name: s.name, color: s.color, amount: s.amount, percent: s.percent })),
    expenseDonut.value.total,
    '总支出',
  ),
)

const incomeDonut = computed(() => {
  const stats = summary.value.incomeByCategory
  if (!stats.length) return { stats: [] as typeof stats, total: 0 }
  const top = stats.slice(0, 5)
  const restAmount = stats.slice(5).reduce((s, v) => s + v.amount, 0)
  const restPercent = stats.slice(5).reduce((s, v) => s + v.percent, 0)
  return {
    stats: restAmount
      ? [...top, { name: '其他', color: '#9aa1ad', amount: restAmount, percent: restPercent }]
      : top,
    total: summary.value.income,
  }
})
const incomeDonutOption = computed(() =>
  donutOption(
    incomeDonut.value.stats.map((s) => ({ name: s.name, color: s.color, amount: s.amount, percent: s.percent })),
    incomeDonut.value.total,
    '总收入',
  ),
)
</script>

<template>
  <main class="page stats">
    <section class="stats-header card">
      <MonthSwitcher v-model:month="month" />
      <div class="overview num">
        <div class="ov-item">
          <span class="ov-label">收入</span>
          <AmountText :cents="summary.income" kind="income" size="lg" />
        </div>
        <div class="ov-item">
          <span class="ov-label">支出</span>
          <AmountText :cents="summary.expense" kind="expense" size="lg" />
        </div>
        <div class="ov-item">
          <span class="ov-label">结余</span>
          <AmountText :cents="summary.balance" :kind="summary.balance >= 0 ? 'income' : 'expense'" size="lg" />
        </div>
      </div>
    </section>

    <!-- 近 6 月趋势 -->
    <section class="chart-card card" aria-label="近6月收支趋势">
      <div class="chart-head">
        <h3 class="chart-title">收支趋势</h3>
        <div class="legend" aria-hidden="true">
          <span class="legend-item"><i class="dot" style="background: #0fa968" />收入</span>
          <span class="legend-item"><i class="dot" style="background: #ed5b2d" />支出</span>
        </div>
      </div>
      <BaseChart v-if="hasTrend" :option="trendOption" height="200px" />
      <EmptyState v-else description="暂无数据，记几笔账就能看到趋势" />
    </section>

    <!-- 支出构成 -->
    <section class="chart-card card" aria-label="支出分类占比">
      <h3 class="chart-title">支出构成</h3>
      <BaseChart v-if="expenseDonut.stats.length" :option="expenseDonutOption" height="220px" />
      <EmptyState v-else description="本月暂无支出" />
      <CategoryRankList v-if="summary.expenseByCategory.length" :stats="summary.expenseByCategory" kind="expense" />
    </section>

    <!-- 收入构成 -->
    <section class="chart-card card" aria-label="收入分类占比">
      <h3 class="chart-title">收入构成</h3>
      <BaseChart v-if="incomeDonut.stats.length" :option="incomeDonutOption" height="220px" />
      <EmptyState v-else description="本月暂无收入" />
      <CategoryRankList v-if="summary.incomeByCategory.length" :stats="summary.incomeByCategory" kind="income" />
    </section>

    <!-- 预算 -->
    <BudgetCard :month="month" />
  </main>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
}
.stats-header {
  padding: 12px 16px;
}
.overview {
  display: flex;
  margin-top: 10px;
}
.ov-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ov-item + .ov-item {
  border-left: 1px solid var(--color-border);
}
.ov-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.chart-card {
  padding: 16px;
}
.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chart-title {
  margin: 0 0 8px;
  font-size: 15px;
}
.legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
</style>
