import type { Transaction, TxType } from '@/types'
import { todayStr } from '@/utils/date'
import { uid } from '@/utils/id'
import { db } from '../database'

/** 创建账单的入参（校验在 UI 层完成，这里只做默认值兜底） */
export interface TransactionInput {
  type: TxType
  /** 金额（分），恒为正 */
  amount: number
  accountId: string
  /** 仅转账 */
  toAccountId?: string
  /** 仅收支 */
  categoryId?: string
  date?: string
  note?: string
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const now = Date.now()
  const tx: Transaction = {
    id: uid(),
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    categoryId: input.categoryId,
    date: input.date ?? todayStr(),
    note: input.note?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(tx)
  return tx
}

export type TransactionPatch = Partial<
  Pick<Transaction, 'amount' | 'categoryId' | 'accountId' | 'toAccountId' | 'date' | 'note' | 'type'>
>

export async function updateTransaction(id: string, patch: TransactionPatch): Promise<void> {
  await db.transactions.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id)
}

/** 批量删除（账单管理页的批量操作） */
export async function deleteTransactions(ids: string[]): Promise<void> {
  await db.transactions.bulkDelete(ids)
}

export interface TransactionQuery {
  /** 'YYYY-MM-DD'，含边界 */
  from?: string
  to?: string
  type?: TxType
  /** 匹配收支账户，或转账的转出/转入任一账户 */
  accountId?: string
  categoryId?: string
}

/**
 * 账单查询：日期范围走索引（主查询路径），其余条件在内存过滤。
 * 万级数据下「月度范围 + 内存过滤」为毫秒级；关键词搜索需要分类/账户名，
 * 由 store 层在拿到结果后二次过滤。
 */
export async function queryTransactions(q: TransactionQuery): Promise<Transaction[]> {
  let txs: Transaction[]
  if (q.from && q.to) {
    txs = await db.transactions.where('date').between(q.from, q.to, true, true).toArray()
  } else if (q.from) {
    txs = await db.transactions.where('date').aboveOrEqual(q.from).toArray()
  } else if (q.to) {
    txs = await db.transactions.where('date').belowOrEqual(q.to).toArray()
  } else {
    txs = await db.transactions.orderBy('[date+createdAt]').reverse().toArray()
  }
  return txs.filter((t) => {
    if (q.type && t.type !== q.type) return false
    if (q.categoryId && t.categoryId !== q.categoryId) return false
    if (q.accountId && t.accountId !== q.accountId && t.toAccountId !== q.accountId) return false
    return true
  })
}

export async function listAllTransactions(): Promise<Transaction[]> {
  return db.transactions.toArray()
}

/** 备份恢复用：清空后批量写入 */
export async function replaceAllTransactions(txs: Transaction[]): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.clear()
    await db.transactions.bulkAdd(txs)
  })
}

/** 某账户是否被账单引用（删除账户前校验） */
export async function countByAccount(accountId: string): Promise<number> {
  return db.transactions.where('accountId').equals(accountId).count()
}
