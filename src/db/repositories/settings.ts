import { db } from '../database'

/** 读取设置；返回默认值兜底 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return (row?.value as T | undefined) ?? fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  // 关键：Pinia store 中 ref 的值是 Vue reactive 代理，IndexedDB 无法结构化克隆代理
  // （DataCloneError），必须先序列化转回普通对象。设置值均为 JSON 兼容数据，无损。
  await db.settings.put({ key, value: JSON.parse(JSON.stringify(value)) })
}

/** 备份恢复用 */
export async function replaceAllSettings(rows: Array<{ key: string; value: unknown }>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await db.settings.clear()
    await db.settings.bulkAdd(rows)
  })
}
