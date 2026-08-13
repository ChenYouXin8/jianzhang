import { describe, expect, it } from 'vitest'
import { createBackupFile, parseBackupFile, transactionsToCSV } from '@/services/export'
import type { Account, Category, Transaction } from '@/types'

const accounts: Account[] = [
  { id: 'a1', name: '现金', type: 'cash', currency: 'CNY', initialBalance: 0, balanceDirection: 'asset', icon: '💵', color: '#000', includeInNetWorth: true, archived: false, sortOrder: 1, createdAt: 0, updatedAt: 0 },
]
const categories: Category[] = [
  { id: 'c1', type: 'expense', name: '餐饮', icon: '🍜', color: '#000', parentId: null, enabled: true, isSystem: true, sortOrder: 1, createdAt: 0, updatedAt: 0 },
  { id: 'c1-1', type: 'expense', name: '早餐, 加蛋', icon: '🥟', color: '#000', parentId: 'c1', enabled: true, isSystem: true, sortOrder: 2, createdAt: 0, updatedAt: 0 },
]
const txs: Transaction[] = [
  { id: 't1', type: 'expense', amount: 1999, accountId: 'a1', categoryId: 'c1-1', date: '2026-08-13', note: '备注含"引号"与,逗号', createdAt: 1, updatedAt: 1 },
  { id: 't2', type: 'transfer', amount: 50000, accountId: 'a1', toAccountId: 'a2', date: '2026-08-12', note: '', createdAt: 2, updatedAt: 2 },
]

describe('transactionsToCSV', () => {
  const csv = transactionsToCSV(txs, accounts, categories)

  it('带 BOM 且含表头（Excel 兼容）', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('日期,类型,金额(元),一级分类,二级分类,账户,转入账户,备注')
  })

  it('金额以元两位小数输出', () => {
    expect(csv).toContain('19.99')
    expect(csv).toContain('500.00')
  })

  it('二级分类展开为一级/二级两列（含逗号时按 RFC 4180 加引号）', () => {
    expect(csv).toContain('餐饮,"早餐, 加蛋"')
  })

  it('含逗号/引号的备注按 RFC 4180 转义', () => {
    expect(csv).toContain('"备注含""引号""与,逗号"')
  })

  it('类型输出中文标签', () => {
    expect(csv).toContain('支出')
    expect(csv).toContain('转账')
  })
})

describe('备份文件往返', () => {
  const data = { accounts, categories, transactions: txs, budgets: [], settings: [] }

  it('导出 → 解析保持一致', () => {
    const file = createBackupFile(data)
    expect(file.app).toBe('simple-ledger')
    expect(file.version).toBe(1)
    const parsed = parseBackupFile(JSON.parse(JSON.stringify(file)))
    expect(parsed.transactions).toHaveLength(2)
    expect(parsed.accounts[0].name).toBe('现金')
  })

  it('拒绝非简账文件', () => {
    expect(() => parseBackupFile({ app: 'other', accounts: [], categories: [], transactions: [], budgets: [], settings: [] })).toThrow('不是简账的备份文件')
  })

  it('拒绝字段缺失', () => {
    expect(() => parseBackupFile({ app: 'simple-ledger' })).toThrow('缺少字段')
  })

  it('拒绝非对象', () => {
    expect(() => parseBackupFile(null)).toThrow()
    expect(() => parseBackupFile('str')).toThrow()
  })
})
