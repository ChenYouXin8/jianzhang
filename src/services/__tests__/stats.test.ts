import { describe, expect, it } from 'vitest'
import {
  aggregateByCategory,
  buildDailyTrend,
  buildMonthlySummary,
  buildMonthlyTrend,
  groupByDay,
} from '@/services/stats'
import type { Category, Transaction } from '@/types'

function makeCategory(partial: Partial<Category>): Category {
  return {
    id: 'c1',
    type: 'expense',
    name: '分类',
    icon: '📦',
    color: '#888',
    parentId: null,
    enabled: true,
    isSystem: false,
    sortOrder: 1,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

function makeTx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    type: 'expense',
    amount: 100,
    accountId: 'a1',
    date: '2026-08-01',
    note: '',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

const categories: Category[] = [
  makeCategory({ id: 'c-food', name: '餐饮', icon: '🍜', color: '#f59f00' }),
  makeCategory({ id: 'c-food-1', name: '早餐', parentId: 'c-food' }),
  makeCategory({ id: 'c-food-2', name: '午餐', parentId: 'c-food' }),
  makeCategory({ id: 'c-transport', name: '交通', icon: '🚌', color: '#339af0' }),
  makeCategory({ id: 'c-salary', type: 'income', name: '工资', icon: '💼', color: '#0ca678' }),
]

const txs: Transaction[] = [
  makeTx({ id: '1', amount: 1000, categoryId: 'c-food-1', date: '2026-08-01', createdAt: 1 }),
  makeTx({ id: '2', amount: 3000, categoryId: 'c-food', date: '2026-08-02', createdAt: 2 }),
  makeTx({ id: '3', amount: 2000, categoryId: 'c-food-2', date: '2026-08-03', createdAt: 3 }),
  makeTx({ id: '4', amount: 5000, categoryId: 'c-transport', date: '2026-08-04', createdAt: 4 }),
  makeTx({ id: '5', type: 'income', amount: 100000, categoryId: 'c-salary', date: '2026-08-05', createdAt: 5 }),
  makeTx({ id: '6', type: 'transfer', amount: 99999, accountId: 'a1', toAccountId: 'a2', date: '2026-08-06', createdAt: 6 }),
  makeTx({ id: '7', amount: 100, categoryId: 'c-food', date: '2026-07-31', createdAt: 7 }),
]

describe('buildMonthlySummary', () => {
  const summary = buildMonthlySummary(txs, categories, '2026-08')

  it('收支总额：转账不计入，跨月不计入', () => {
    expect(summary.income).toBe(100000)
    expect(summary.expense).toBe(11000)
    expect(summary.balance).toBe(89000)
  })

  it('分类聚合：二级归入一级，按金额降序', () => {
    expect(summary.expenseByCategory[0]).toMatchObject({ categoryId: 'c-food', amount: 6000 })
    expect(summary.expenseByCategory[1]).toMatchObject({ categoryId: 'c-transport', amount: 5000 })
  })

  it('占比保留 1 位小数', () => {
    expect(summary.expenseByCategory[0].percent).toBe(54.5) // 6000/11000
    expect(summary.expenseByCategory[1].percent).toBe(45.5)
  })

  it('收入侧同样聚合', () => {
    expect(summary.incomeByCategory).toHaveLength(1)
    expect(summary.incomeByCategory[0]).toMatchObject({ categoryId: 'c-salary', amount: 100000, percent: 100 })
  })
})

describe('buildDailyTrend', () => {
  const daily = buildDailyTrend(txs, '2026-08')

  it('补全整月 31 天', () => {
    expect(daily).toHaveLength(31)
    expect(daily[0].date).toBe('2026-08-01')
    expect(daily[30].date).toBe('2026-08-31')
  })

  it('每日收支正确；转账当日收支为 0', () => {
    expect(daily[0]).toMatchObject({ expense: 1000, income: 0 })
    expect(daily[4]).toMatchObject({ expense: 0, income: 100000 })
    expect(daily[5]).toMatchObject({ expense: 0, income: 0 })
  })
})

describe('buildMonthlyTrend', () => {
  it('按给定月份序列汇总', () => {
    const trend = buildMonthlyTrend(txs, ['2026-07', '2026-08'])
    expect(trend[0]).toMatchObject({ month: '2026-07', expense: 100, income: 0 })
    expect(trend[1]).toMatchObject({ month: '2026-08', expense: 11000, income: 100000 })
  })
})

describe('groupByDay', () => {
  it('按日期倒序分组，日内按创建时间倒序', () => {
    const groups = groupByDay(txs)
    expect(groups[0].date).toBe('2026-08-06')
    expect(groups[1].date).toBe('2026-08-05')
    // 08-04 组只有 id 4；08-03 组只有 id 3
    expect(groups[2].date).toBe('2026-08-04')
    expect(groups[2].txs.map((t) => t.id)).toEqual(['4'])
    const day03 = groups.find((g) => g.date === '2026-08-03')!
    expect(day03.txs.map((t) => t.id)).toEqual(['3'])
    expect(day03.expense).toBe(2000)
  })

  it('转账不计入日收支小计', () => {
    const day06 = groupByDay(txs).find((g) => g.date === '2026-08-06')!
    expect(day06.expense).toBe(0)
    expect(day06.income).toBe(0)
    expect(day06.txs).toHaveLength(1)
  })
})

describe('aggregateByCategory 边界', () => {
  it('空数据返回空数组且不报错', () => {
    expect(aggregateByCategory([], categories, 'expense')).toEqual([])
  })

  it('未知分类归入「未分类」', () => {
    const orphan = makeTx({ id: 'x', amount: 500, categoryId: 'c-gone' })
    const stats = aggregateByCategory([orphan], categories, 'expense')
    expect(stats[0]).toMatchObject({ name: '未分类', amount: 500, percent: 100 })
  })
})

describe('buildMonthlySummary 边界', () => {
  it('空数据返回零值结构', () => {
    const s = buildMonthlySummary([], categories, '2026-08')
    expect(s).toMatchObject({ income: 0, expense: 0, balance: 0 })
    expect(s.expenseByCategory).toEqual([])
    expect(s.daily).toHaveLength(31)
  })
})
