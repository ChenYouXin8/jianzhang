import { describe, expect, it } from 'vitest'
import { computeAccountBalance, computeNetWorth } from '@/services/balance'
import type { Account, Transaction } from '@/types'

function makeAccount(partial: Partial<Account>): Account {
  return {
    id: 'a1',
    name: '账户',
    type: 'cash',
    currency: 'CNY',
    initialBalance: 0,
    balanceDirection: 'asset',
    icon: '💵',
    color: '#000',
    includeInNetWorth: true,
    archived: false,
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

const cash = makeAccount({ id: 'a-cash', initialBalance: 0 })
const debit = makeAccount({ id: 'a-debit', initialBalance: 10000 })
const credit = makeAccount({ id: 'a-credit', balanceDirection: 'liability' })

/** 覆盖五种流水形态：支出 / 收入 / 转出 / 转入 / 信用卡消费与还款 */
const txs: Transaction[] = [
  makeTx({ id: '1', type: 'expense', amount: 500, accountId: 'a-cash' }),
  makeTx({ id: '2', type: 'income', amount: 3000, accountId: 'a-cash' }),
  makeTx({ id: '3', type: 'transfer', amount: 1000, accountId: 'a-cash', toAccountId: 'a-debit' }),
  makeTx({ id: '4', type: 'expense', amount: 200, accountId: 'a-credit' }),
  makeTx({ id: '5', type: 'transfer', amount: 500, accountId: 'a-debit', toAccountId: 'a-credit' }),
]

describe('computeAccountBalance', () => {
  it('资产账户：初始 + 收入 - 支出 + 转入 - 转出', () => {
    expect(computeAccountBalance(cash, txs)).toBe(1500) // 0 - 500 + 3000 - 1000
    expect(computeAccountBalance(debit, txs)).toBe(10500) // 10000 + 1000 - 500
  })

  it('负债账户：余额语义为欠款额（消费 +，还款 -）', () => {
    // 消费 200 → 欠款 +200；还款 500 → 欠款 -500；净 -300 表示溢缴 300
    expect(computeAccountBalance(credit, txs)).toBe(-300)
  })

  it('无流水时余额即初始余额', () => {
    expect(computeAccountBalance(cash, [])).toBe(0)
    expect(computeAccountBalance(debit, [])).toBe(10000)
  })

  it('不相关流水不影响余额', () => {
    const other = makeAccount({ id: 'a-other' })
    expect(computeAccountBalance(other, txs)).toBe(0)
  })
})

describe('computeNetWorth', () => {
  it('净资产 = 资产之和 − 负债之和', () => {
    // 1500 + 10500 - (-300) = 12300
    expect(computeNetWorth([cash, debit, credit], txs)).toBe(12300)
  })

  it('includeInNetWorth=false 的账户被排除', () => {
    const hidden = makeAccount({ id: 'a-hidden', initialBalance: 999900, includeInNetWorth: false })
    expect(computeNetWorth([cash, hidden], txs)).toBe(1500)
  })
})
