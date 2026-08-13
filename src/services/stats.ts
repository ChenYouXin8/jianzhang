import type { Category, Transaction } from '@/types'
import { daysInMonth } from '@/utils/date'
import { percent } from '@/utils/money'

/**
 * 统计聚合 —— 全部为纯函数：(数据, 参数) → 结果，无副作用。
 * 这样单元测试无需 IndexedDB，且同一份数据可被列表/报表/预算复用。
 * 转账一律不参与收支统计（资金在账户间流动，不产生收入或支出）。
 */

export interface CategoryStat {
  categoryId: string
  name: string
  icon: string
  color: string
  /** 金额（分） */
  amount: number
  count: number
  /** 占比（1 位小数百分比数值，如 33.3 = 33.3%） */
  percent: number
}

export interface DailyPoint {
  date: string
  expense: number
  income: number
}

export interface MonthPoint {
  month: string
  expense: number
  income: number
}

export interface MonthlySummary {
  month: string
  income: number
  expense: number
  balance: number
  expenseByCategory: CategoryStat[]
  incomeByCategory: CategoryStat[]
  daily: DailyPoint[]
}

export interface DayGroup {
  date: string
  txs: Transaction[]
  expense: number
  income: number
}

/** 按一级分类聚合（二级分类的交易归入其父级，报表按一级分类展示） */
export function aggregateByCategory(
  txs: Transaction[],
  categories: Category[],
  type: 'expense' | 'income',
): CategoryStat[] {
  const catMap = new Map(categories.filter((c) => c.type === type).map((c) => [c.id, c]))
  const acc = new Map<string, { amount: number; count: number }>()

  for (const t of txs) {
    if (t.type !== type || !t.categoryId) continue
    // 二级分类 → 一级分类归并
    const topId = catMap.get(t.categoryId)?.parentId ?? t.categoryId
    const cur = acc.get(topId) ?? { amount: 0, count: 0 }
    cur.amount += t.amount
    cur.count += 1
    acc.set(topId, cur)
  }

  const total = [...acc.values()].reduce((s, v) => s + v.amount, 0)
  return [...acc.entries()]
    .map(([topId, v]) => {
      const cat = catMap.get(topId)
      return {
        categoryId: topId,
        name: cat?.name ?? '未分类',
        icon: cat?.icon ?? '📦',
        color: cat?.color ?? '#868e96',
        amount: v.amount,
        count: v.count,
        percent: percent(v.amount, total),
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

/** 该月每日收支（补全整月所有天，趋势图 X 轴稳定） */
export function buildDailyTrend(txs: Transaction[], month: string): DailyPoint[] {
  const days = daysInMonth(month)
  const map = new Map<string, DailyPoint>()
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    map.set(date, { date, expense: 0, income: 0 })
  }
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue
    const p = map.get(t.date)
    if (!p) continue
    if (t.type === 'expense') p.expense += t.amount
    else if (t.type === 'income') p.income += t.amount
  }
  return [...map.values()]
}

/** 月度总览（首页摘要 / 统计页主卡共用） */
export function buildMonthlySummary(
  txs: Transaction[],
  categories: Category[],
  month: string,
): MonthlySummary {
  const inMonth = txs.filter((t) => t.date.startsWith(month))
  let income = 0
  let expense = 0
  for (const t of inMonth) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return {
    month,
    income,
    expense,
    balance: income - expense,
    expenseByCategory: aggregateByCategory(inMonth, categories, 'expense'),
    incomeByCategory: aggregateByCategory(inMonth, categories, 'income'),
    daily: buildDailyTrend(inMonth, month),
  }
}

/** 近 n 个月收支趋势（months 数组由 utils/date.lastMonths 生成，含当月） */
export function buildMonthlyTrend(txs: Transaction[], months: string[]): MonthPoint[] {
  return months.map((m) => {
    let expense = 0
    let income = 0
    for (const t of txs) {
      if (!t.date.startsWith(m)) continue
      if (t.type === 'expense') expense += t.amount
      else if (t.type === 'income') income += t.amount
    }
    return { month: m, expense, income }
  })
}

/** 账单列表按日分组（倒序；同日内按创建时间倒序） */
export function groupByDay(txs: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>()
  for (const t of txs) {
    const list = map.get(t.date)
    if (list) list.push(t)
    else map.set(t.date, [t])
  }
  return [...map.entries()]
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
      let expense = 0
      let income = 0
      for (const t of sorted) {
        if (t.type === 'expense') expense += t.amount
        else if (t.type === 'income') income += t.amount
      }
      return { date, txs: sorted, expense, income }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}
