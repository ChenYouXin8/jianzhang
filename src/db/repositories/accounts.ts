import type { Account } from '@/types'
import { uid } from '@/utils/id'
import { db } from '../database'

export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>

export async function listAccounts(includeArchived = true): Promise<Account[]> {
  const all = await db.accounts.orderBy('sortOrder').toArray()
  return includeArchived ? all : all.filter((a) => !a.archived)
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id)
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const now = Date.now()
  const account: Account = { ...input, id: uid(), createdAt: now, updatedAt: now }
  await db.accounts.add(account)
  return account
}

export async function updateAccount(id: string, patch: Partial<AccountInput>): Promise<void> {
  await db.accounts.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteAccount(id: string): Promise<void> {
  await db.accounts.delete(id)
}

/** 备份恢复用 */
export async function replaceAllAccounts(accounts: Account[]): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    await db.accounts.clear()
    await db.accounts.bulkAdd(accounts)
  })
}
