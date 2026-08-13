import type { Account, Transaction } from '@/types'

/**
 * 账户余额计算 —— 纯函数，不落库。
 *
 * 关键决策：余额不单独存字段，而是「初始余额 + Σ流水」实时聚合。
 * 原因：余额与账单不一致是记账软件第一大坑；单一数据源（账单）下，
 * 余额永远可重算、可校验。万级数据的内存聚合为毫秒级，性能无忧。
 *
 * 负债账户（信用卡）的余额语义为「欠款额」：
 * 支出使欠款增加（余额 +），还款（转账转入）使欠款减少（余额 -）。
 */

export function computeAccountBalance(account: Account, txs: Transaction[]): number {
  let delta = 0
  for (const t of txs) {
    if (t.type === 'transfer') {
      if (t.accountId === account.id) delta -= t.amount // 转出
      else if (t.toAccountId === account.id) delta += t.amount // 转入
    } else if (t.accountId === account.id) {
      delta += t.type === 'income' ? t.amount : -t.amount
    }
  }
  const signed = account.balanceDirection === 'liability' ? -delta : delta
  return account.initialBalance + signed
}

/**
 * 净资产 = Σ资产账户余额 − Σ负债账户余额。
 * 负债账户余额为「欠款额」，计入净资产时取负。
 */
export function computeNetWorth(accounts: Account[], txs: Transaction[]): number {
  return accounts.reduce((sum, a) => {
    if (!a.includeInNetWorth) return sum
    const bal = computeAccountBalance(a, txs)
    return sum + (a.balanceDirection === 'liability' ? -bal : bal)
  }, 0)
}

/** 所有账户余额汇总表（账户管理页展示用），返回 id → 余额 */
export function computeAllBalances(accounts: Account[], txs: Transaction[]): Map<string, number> {
  return new Map(accounts.map((a) => [a.id, computeAccountBalance(a, txs)]))
}
