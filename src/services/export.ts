import type { Account, Budget, Category, Setting, Transaction } from '@/types'
import { TX_TYPE_LABELS } from '@/utils/constants'
import { centsToYuan } from '@/utils/money'

/**
 * 数据导出：
 * 1. CSV —— 账单明细，带 UTF-8 BOM 保证 Excel 直接打开不乱码；
 * 2. 备份文件 —— JSON，含全部五张表 + 版本号，恢复时整体校验后覆盖。
 */

/** CSV 单元格转义：含逗号/引号/换行时用引号包裹，内部引号翻倍（RFC 4180） */
function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** 账单明细 → CSV 文本。金额以元输出（两位小数），符合 Excel 使用习惯 */
export function transactionsToCSV(
  txs: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]))
  const categoryNames = new Map(categories.map((c) => [c.id, c]))
  const header = ['日期', '类型', '金额(元)', '一级分类', '二级分类', '账户', '转入账户', '备注']
  const rows = txs
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.createdAt - a.createdAt))
    .map((t) => {
      const cat = t.categoryId ? categoryNames.get(t.categoryId) : undefined
      const topName = cat?.parentId ? (categoryNames.get(cat.parentId)?.name ?? '') : (cat?.name ?? '')
      return [
        t.date,
        TX_TYPE_LABELS[t.type],
        centsToYuan(t.amount),
        topName,
        cat?.parentId ? (cat.name ?? '') : '',
        accountNames.get(t.accountId) ?? '',
        t.toAccountId ? (accountNames.get(t.toAccountId) ?? '') : '',
        t.note,
      ]
    })
  return '﻿' + [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

/* ---------------- 备份 / 恢复 ---------------- */

export interface BackupFile {
  app: 'simple-ledger'
  /** 备份格式版本，恢复时据此做迁移 */
  version: number
  /** ISO 时间戳 */
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  settings: Setting[]
}

export interface BackupData {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  settings: Setting[]
}

export function createBackupFile(data: BackupData): BackupFile {
  return { app: 'simple-ledger', version: 1, exportedAt: new Date().toISOString(), ...data }
}

/** 校验并解析备份文件；任何字段缺失/类型错误都抛错，防止脏数据覆盖现有账本 */
export function parseBackupFile(raw: unknown): BackupFile {
  if (typeof raw !== 'object' || raw === null) throw new Error('备份文件格式不正确')
  const obj = raw as Record<string, unknown>
  if (obj.app !== 'simple-ledger') throw new Error('不是简账的备份文件')
  const requiredArrays = ['accounts', 'categories', 'transactions', 'budgets', 'settings'] as const
  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) throw new Error(`备份文件缺少字段：${key}`)
  }
  return obj as unknown as BackupFile
}

/** 触发浏览器下载（备份 JSON / CSV 共用） */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
