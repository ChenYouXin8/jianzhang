import type { Category } from '@/types'
import { uid } from '@/utils/id'
import { db } from '../database'

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>

export async function listCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray()
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const now = Date.now()
  const category: Category = { ...input, id: uid(), createdAt: now, updatedAt: now }
  await db.categories.add(category)
  return category
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<void> {
  await db.categories.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
}

/** 分类被账单引用的数量（删除前校验：有引用则只能禁用） */
export async function countTransactionsByCategory(categoryId: string): Promise<number> {
  return db.transactions.where('categoryId').equals(categoryId).count()
}

/** 备份恢复用 */
export async function replaceAllCategories(categories: Category[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    await db.categories.clear()
    await db.categories.bulkAdd(categories)
  })
}
