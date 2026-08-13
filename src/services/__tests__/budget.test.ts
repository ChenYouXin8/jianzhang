import { describe, expect, it } from 'vitest'
import { buildBudgetOverview } from '@/services/budget'
import type { Budget, Category, Transaction } from '@/types'

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
  { id: 'c-food', type: 'expense', name: '餐饮', icon: '🍜', color: '#f59f00', parentId: null, enabled: true, isSystem: true, sortOrder: 1, createdAt: 0, updatedAt: 0 },
  { id: 'c-food-1', type: 'expense', name: '早餐', icon: '🥟', color: '#f59f00', parentId: 'c-food', enabled: true, isSystem: true, sortOrder: 2, createdAt: 0, updatedAt: 0 },
  { id: 'c-food-2', type: 'expense', name: '午餐', icon: '🍱', color: '#f59f00', parentId: 'c-food', enabled: true, isSystem: true, sortOrder: 3, createdAt: 0, updatedAt: 0 },
  { id: 'c-transport', type: 'expense', name: '交通', icon: '🚌', color: '#339af0', parentId: null, enabled: true, isSystem: true, sortOrder: 4, createdAt: 0, updatedAt: 0 },
]

const txs: Transaction[] = [
  makeTx({ id: '1', amount: 1000, categoryId: 'c-food-1' }),
  makeTx({ id: '2', amount: 2000, categoryId: 'c-food-2' }),
  makeTx({ id: '3', amount: 3000, categoryId: 'c-food' }),
  makeTx({ id: '4', amount: 5000, categoryId: 'c-transport' }),
  makeTx({ id: '5', type: 'income', amount: 90000, categoryId: 'c-inc' }),
  makeTx({ id: '6', type: 'transfer', amount: 88888, accountId: 'a1', toAccountId: 'a2' }),
  makeTx({ id: '7', amount: 99999, categoryId: 'c-food', date: '2026-07-31' }),
]

function budget(partial: Partial<Budget>): Budget {
  return {
    id: 'b1',
    month: '2026-08',
    categoryId: null,
    amount: 10000,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

const budgets: Budget[] = [
  budget({ id: 'b-total', amount: 10000 }),
  budget({ id: 'b-food', categoryId: 'c-food', amount: 5000 }),
  budget({ id: 'b-transport', categoryId: 'c-transport', amount: 10000 }),
  budget({ id: 'b-last', month: '2026-07', amount: 100 }),
]

describe('buildBudgetOverview', () => {
  const overview = buildBudgetOverview(txs, categories, budgets, '2026-08')

  it('总支出：不含收入与转账，不含跨月', () => {
    expect(overview.totalSpent).toBe(11000)
  })

  it('总预算：超支判定、剩余为负、使用率可超 100', () => {
    expect(overview.total).toMatchObject({ amount: 10000, spent: 11000, percent: 110, remaining: -1000, over: true })
  })

  it('分类预算：二级支出归入一级', () => {
    const food = overview.byCategory.find((b) => b.categoryId === 'c-food')!
    expect(food.spent).toBe(6000) // 1000 + 2000 + 3000
    expect(food).toMatchObject({ percent: 120, over: true })
  })

  it('未超支的分类', () => {
    const transport = overview.byCategory.find((b) => b.categoryId === 'c-transport')!
    expect(transport).toMatchObject({ spent: 5000, percent: 50, remaining: 5000, over: false })
  })

  it('其他月份的预算被过滤', () => {
    expect(overview.byCategory.some((b) => b.budgetId === 'b-last')).toBe(false)
  })
})

describe('buildBudgetOverview 边界', () => {
  it('无预算时 total 为 null、列表为空', () => {
    const overview = buildBudgetOverview(txs, categories, [], '2026-08')
    expect(overview.total).toBeNull()
    expect(overview.byCategory).toEqual([])
    expect(overview.totalSpent).toBe(11000)
  })
})
