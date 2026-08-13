/**
 * 领域类型定义 —— 全应用唯一的数据契约来源。
 * 金额字段一律为「分」的整数（详见 utils/money.ts 的选型说明）。
 */

/** 交易类型：支出 / 收入 / 转账（转账无分类，见 schema 设计文档） */
export type TxType = 'expense' | 'income' | 'transfer'

/** 账户类型：覆盖常见资金载体 */
export type AccountType = 'cash' | 'debit' | 'credit' | 'ewallet' | 'investment' | 'other'

/**
 * 余额方向：
 * - asset：资产账户，余额 = 初始 + 收入 + 转入 - 支出 - 转出
 * - liability：负债账户（信用卡），余额语义为「欠款额」，符号取反
 */
export type BalanceDirection = 'asset' | 'liability'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** 币种，ISO 4217 代码；MVP 仅 CNY，字段为多币种预留 */
  currency: string
  /** 初始余额（分）。负债账户填初始欠款额 */
  initialBalance: number
  balanceDirection: BalanceDirection
  /** 图标 emoji */
  icon: string
  color: string
  /** 是否计入总资产（净资产）统计 */
  includeInNetWorth: boolean
  /** 归档后不参与记账与统计，但保留历史数据 */
  archived: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/** 分类：type 限定其使用场景；parentId 非空即为二级分类 */
export interface Category {
  id: string
  type: 'expense' | 'income'
  name: string
  icon: string
  color: string
  parentId: string | null
  enabled: boolean
  /** 内置分类不可删除，仅可禁用 */
  isSystem: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/** 账单（核心表）。转账为单条记录：accountId 转出 → toAccountId 转入 */
export interface Transaction {
  id: string
  type: TxType
  /** 金额（分），恒为正数 */
  amount: number
  /** 收支账户；转账时为转出账户 */
  accountId: string
  /** 仅转账：转入账户 */
  toAccountId?: string
  /** 仅收支：分类 id */
  categoryId?: string
  /** 记账日期 'YYYY-MM-DD'（业务日期，非创建时间） */
  date: string
  note: string
  createdAt: number
  updatedAt: number
}

/** 预算：按「月 + 一级分类」为一行；categoryId 为 null 表示该月总预算 */
export interface Budget {
  id: string
  /** 'YYYY-MM' */
  month: string
  categoryId: string | null
  /** 预算金额（分） */
  amount: number
  createdAt: number
  updatedAt: number
}

/** 键值设置：记住上次记账选项、应用锁等（见 db/seed.ts 的初始化项） */
export interface Setting {
  key: string
  value: unknown
}
