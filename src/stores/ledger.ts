import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createAccount as createAccountRepo,
  deleteAccount as deleteAccountRepo,
  listAccounts,
  updateAccount as updateAccountRepo,
  type AccountInput,
} from '@/db/repositories/accounts'
import {
  createCategory as createCategoryRepo,
  deleteCategory as deleteCategoryRepo,
  listCategories,
  updateCategory as updateCategoryRepo,
  type CategoryInput,
} from '@/db/repositories/categories'
import {
  deleteBudget as deleteBudgetRepo,
  listBudgets,
  saveBudget as saveBudgetRepo,
} from '@/db/repositories/budgets'
import {
  createTransaction as createTransactionRepo,
  deleteTransactions,
  deleteTransaction as deleteTransactionRepo,
  listAllTransactions,
  updateTransaction as updateTransactionRepo,
  type TransactionInput,
  type TransactionPatch,
} from '@/db/repositories/transactions'
import { seedIfEmpty } from '@/db/seed'
import { computeAccountBalance, computeNetWorth } from '@/services/balance'
import { buildBudgetOverview, type BudgetOverview } from '@/services/budget'
import { buildMonthlySummary, type MonthlySummary } from '@/services/stats'
import type { Account, Budget, Category, Transaction } from '@/types'

/**
 * 账本中心 store —— 唯一的数据源。
 *
 * 设计决策：
 * 1. 启动时全量载入内存（万级账单 ≈ 数 MB，IndexedDB 读取为几十毫秒），
 *    所有派生数据（余额/月度汇总/预算）由纯函数实时计算，保证强一致；
 * 2. 派生结果按「写版本号」memo：任何写操作 version++ 即整体失效，
 *    比逐字段依赖追踪简单且不会漏失效；
 * 3. 所有写操作先落库再改内存，UI 永远展示已持久化的数据。
 */
export const useLedgerStore = defineStore('ledger', () => {
  const ready = ref(false)
  const accounts = ref<Account[]>([])
  const categories = ref<Category[]>([])
  const transactions = ref<Transaction[]>([])
  const budgets = ref<Budget[]>([])

  /** 写版本号：任何数据变更 +1，派生缓存据此失效 */
  const version = ref(0)

  /* ---------------- 分类派生数据 ---------------- */

  const activeAccounts = computed(() =>
    accounts.value.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder),
  )
  const enabledCategories = computed(() => categories.value.filter((c) => c.enabled))

  function topCategoriesOf(type: 'expense' | 'income'): Category[] {
    return enabledCategories.value
      .filter((c) => c.type === type && !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
  function childrenOf(parentId: string): Category[] {
    return enabledCategories.value
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  /* ---------------- 余额（按账户 memo） ---------------- */

  const balanceCache = new Map<string, { v: number; value: number }>()
  function balanceOf(accountId: string): number {
    const hit = balanceCache.get(accountId)
    if (hit && hit.v === version.value) return hit.value
    const account = accounts.value.find((a) => a.id === accountId)
    if (!account) return 0
    const value = computeAccountBalance(account, transactions.value)
    balanceCache.set(accountId, { v: version.value, value })
    return value
  }
  const netWorth = computed(() => computeNetWorth(accounts.value, transactions.value))

  /* ---------------- 月度汇总 / 预算（按月 memo） ---------------- */

  const summaryCache = new Map<string, { v: number; value: MonthlySummary }>()
  function summaryOf(month: string): MonthlySummary {
    const hit = summaryCache.get(month)
    if (hit && hit.v === version.value) return hit.value
    const value = buildMonthlySummary(transactions.value, categories.value, month)
    summaryCache.set(month, { v: version.value, value })
    return value
  }

  const budgetCache = new Map<string, { v: number; value: BudgetOverview }>()
  function budgetOf(month: string): BudgetOverview {
    const hit = budgetCache.get(month)
    if (hit && hit.v === version.value) return hit.value
    const value = buildBudgetOverview(transactions.value, categories.value, budgets.value, month)
    budgetCache.set(month, { v: version.value, value })
    return value
  }

  /* ---------------- 初始化 ---------------- */

  async function init(): Promise<void> {
    await seedIfEmpty()
    const [a, c, t, b] = await Promise.all([
      listAccounts(),
      listCategories(),
      listAllTransactions(),
      listBudgets(),
    ])
    accounts.value = a
    categories.value = c
    transactions.value = t
    budgets.value = b
    version.value++
    ready.value = true
  }

  /* ---------------- 账单 ---------------- */

  async function addTransaction(input: TransactionInput): Promise<Transaction> {
    const tx = await createTransactionRepo(input)
    transactions.value.push(tx)
    version.value++
    return tx
  }

  async function editTransaction(id: string, patch: TransactionPatch): Promise<void> {
    await updateTransactionRepo(id, patch)
    const idx = transactions.value.findIndex((t) => t.id === id)
    if (idx >= 0) {
      transactions.value[idx] = { ...transactions.value[idx], ...patch, updatedAt: Date.now() }
      version.value++
    }
  }

  async function removeTransaction(id: string): Promise<void> {
    await deleteTransactionRepo(id)
    transactions.value = transactions.value.filter((t) => t.id !== id)
    version.value++
  }

  async function removeTransactions(ids: string[]): Promise<void> {
    await deleteTransactions(ids)
    const set = new Set(ids)
    transactions.value = transactions.value.filter((t) => !set.has(t.id))
    version.value++
  }

  /* ---------------- 账户 ---------------- */

  async function addAccount(input: AccountInput): Promise<Account> {
    const account = await createAccountRepo(input)
    accounts.value.push(account)
    version.value++
    return account
  }

  async function editAccount(id: string, patch: Partial<AccountInput>): Promise<void> {
    await updateAccountRepo(id, patch)
    const idx = accounts.value.findIndex((a) => a.id === id)
    if (idx >= 0) {
      accounts.value[idx] = { ...accounts.value[idx], ...patch, updatedAt: Date.now() }
      version.value++
    }
  }

  /**
   * 删除账户：有流水引用的账户不允许物理删除（会破坏历史账单），
   * 返回 false 提示调用方改走「归档」。无引用时物理删除。
   */
  async function removeAccount(id: string): Promise<boolean> {
    const referenced = transactions.value.some((t) => t.accountId === id || t.toAccountId === id)
    if (referenced) return false
    await deleteAccountRepo(id)
    accounts.value = accounts.value.filter((a) => a.id !== id)
    version.value++
    return true
  }

  /* ---------------- 分类 ---------------- */

  async function addCategory(input: CategoryInput): Promise<Category> {
    const category = await createCategoryRepo(input)
    categories.value.push(category)
    version.value++
    return category
  }

  async function editCategory(id: string, patch: Partial<CategoryInput>): Promise<void> {
    await updateCategoryRepo(id, patch)
    const idx = categories.value.findIndex((c) => c.id === id)
    if (idx >= 0) {
      categories.value[idx] = { ...categories.value[idx], ...patch, updatedAt: Date.now() }
      version.value++
    }
  }

  /** 分类被账单引用的数量（>0 时只允许禁用，不允许删除） */
  function categoryUsage(categoryId: string): number {
    return transactions.value.filter((t) => t.categoryId === categoryId).length
  }

  async function removeCategory(id: string): Promise<boolean> {
    if (categoryUsage(id) > 0) return false
    await deleteCategoryRepo(id)
    categories.value = categories.value.filter((c) => c.id !== id)
    version.value++
    return true
  }

  /* ---------------- 预算 ---------------- */

  async function saveBudget(month: string, categoryId: string | null, amount: number): Promise<void> {
    await saveBudgetRepo(month, categoryId, amount)
    budgets.value = await listBudgets()
    version.value++
  }

  async function removeBudget(id: string): Promise<void> {
    await deleteBudgetRepo(id)
    budgets.value = budgets.value.filter((b) => b.id !== id)
    version.value++
  }

  /* ---------------- 备份恢复 ---------------- */

  async function restoreBackup(data: {
    accounts: Account[]
    categories: Category[]
    transactions: Transaction[]
    budgets: Budget[]
  }): Promise<void> {
    const { replaceAllAccounts } = await import('@/db/repositories/accounts')
    const { replaceAllCategories } = await import('@/db/repositories/categories')
    const { replaceAllTransactions } = await import('@/db/repositories/transactions')
    const { replaceAllBudgets } = await import('@/db/repositories/budgets')
    await replaceAllAccounts(data.accounts)
    await replaceAllCategories(data.categories)
    await replaceAllTransactions(data.transactions)
    await replaceAllBudgets(data.budgets)
    accounts.value = data.accounts
    categories.value = data.categories
    transactions.value = data.transactions
    budgets.value = data.budgets
    version.value++
  }

  return {
    ready,
    accounts,
    categories,
    transactions,
    budgets,
    version,
    activeAccounts,
    enabledCategories,
    topCategoriesOf,
    childrenOf,
    balanceOf,
    netWorth,
    summaryOf,
    budgetOf,
    init,
    addTransaction,
    editTransaction,
    removeTransaction,
    removeTransactions,
    addAccount,
    editAccount,
    removeAccount,
    addCategory,
    editCategory,
    categoryUsage,
    removeCategory,
    saveBudget,
    removeBudget,
    restoreBackup,
  }
})
