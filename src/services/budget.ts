import type { Budget, Category, Transaction } from '@/types'
import { percent } from '@/utils/money'

/**
 * 预算进度计算 —— 纯函数。
 * 预算模型：按月 + 一级分类设置；categoryId 为 null 表示该月总预算。
 * 分类预算的口径：该一级分类下所有二级分类的支出之和。
 */

export interface BudgetProgress {
  budgetId: string
  categoryId: string | null
  name: string
  icon?: string
  color?: string
  /** 预算额（分） */
  amount: number
  /** 已花费（分） */
  spent: number
  /** 使用率（可超过 100，1 位小数） */
  percent: number
  /** 剩余（分），负数即超支额 */
  remaining: number
  over: boolean
}

export interface BudgetOverview {
  /** 当月总支出（无论是否设置预算，展示口径需要） */
  totalSpent: number
  total: BudgetProgress | null
  byCategory: BudgetProgress[]
}

function toProgress(b: Budget, spent: number, name: string, icon?: string, color?: string): BudgetProgress {
  return {
    budgetId: b.id,
    categoryId: b.categoryId,
    name,
    icon,
    color,
    amount: b.amount,
    spent,
    percent: percent(spent, b.amount),
    remaining: b.amount - spent,
    over: spent > b.amount,
  }
}

export function buildBudgetOverview(
  txs: Transaction[],
  categories: Category[],
  budgets: Budget[],
  month: string,
): BudgetOverview {
  const monthBudgets = budgets.filter((b) => b.month === month)

  // 当月各一级分类支出（二级归入一级，与 stats.aggregateByCategory 口径一致）
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const spentByTop = new Map<string, number>()
  let totalSpent = 0
  for (const t of txs) {
    if (!t.date.startsWith(month) || t.type !== 'expense') continue
    totalSpent += t.amount
    if (!t.categoryId) continue
    const topId = catMap.get(t.categoryId)?.parentId ?? t.categoryId
    spentByTop.set(topId, (spentByTop.get(topId) ?? 0) + t.amount)
  }

  const totalBudget = monthBudgets.find((b) => b.categoryId === null)
  const byCategory = monthBudgets
    .filter((b) => b.categoryId !== null)
    .map((b) => {
      const cat = catMap.get(b.categoryId as string)
      const spent = spentByTop.get(b.categoryId as string) ?? 0
      return toProgress(b, spent, cat?.name ?? '未知分类', cat?.icon, cat?.color)
    })

  return {
    totalSpent,
    total: totalBudget ? toProgress(totalBudget, totalSpent, '总预算') : null,
    byCategory,
  }
}
