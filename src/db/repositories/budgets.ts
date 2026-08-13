import type { Budget } from '@/types'
import { db } from '../database'

/**
 * 预算仓储。主键由「月份 + 分类」确定性生成：
 * 同一 (month, categoryId) 重复保存即覆盖，天然实现 upsert，无需预查询。
 */
function budgetId(month: string, categoryId: string | null): string {
  return `${month}__${categoryId ?? 'total'}`
}

export async function listBudgets(month?: string): Promise<Budget[]> {
  const all = await db.budgets.toArray()
  return month ? all.filter((b) => b.month === month) : all
}

/** 保存/覆盖预算；amount 传 0 表示删除该预算 */
export async function saveBudget(month: string, categoryId: string | null, amount: number): Promise<void> {
  if (amount <= 0) {
    await db.budgets.delete(budgetId(month, categoryId))
    return
  }
  const now = Date.now()
  const existing = await db.budgets.get(budgetId(month, categoryId))
  await db.budgets.put({
    id: budgetId(month, categoryId),
    month,
    categoryId,
    amount,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
}

/** 备份恢复用 */
export async function replaceAllBudgets(budgets: Budget[]): Promise<void> {
  await db.transaction('rw', db.budgets, async () => {
    await db.budgets.clear()
    await db.budgets.bulkAdd(budgets)
  })
}
