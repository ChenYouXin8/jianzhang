import Dexie, { type Table } from 'dexie'
import type { Account, Budget, Category, Setting, Transaction } from '@/types'

/**
 * IndexedDB 数据库定义（Dexie 4 封装）。
 *
 * 选型原因：
 * - 本地优先、离线可用是产品核心诉求，IndexedDB 是浏览器端唯一可靠的大容量持久化方案；
 * - 相比 SQLite-WASM 少 ~1MB 运行时、无异步初始化负担；
 * - 万级账单数据下，索引查询与内存聚合均为毫秒级（见 services/ 纯函数层）。
 *
 * 索引设计原则：只建查询真正用到的索引（每个索引都增加写入成本与存储体积）。
 */
class LedgerDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  budgets!: Table<Budget, string>
  settings!: Table<Setting, string>

  constructor() {
    super('simple-ledger')
    this.version(1).stores({
      accounts: 'id, archived, sortOrder',
      categories: 'id, type, parentId, enabled, sortOrder',
      // date：月度范围查询（列表/统计主查询）；[date+createdAt]：同日内按创建时间排序；
      // accountId/toAccountId：账户流水与余额聚合；categoryId：分类筛选
      transactions: 'id, date, type, accountId, toAccountId, categoryId, createdAt, [date+createdAt]',
      budgets: 'id, month, [month+categoryId]',
      settings: 'key',
    })
  }
}

/** 全局单例，仓储层统一经由它访问 */
export const db = new LedgerDB()
