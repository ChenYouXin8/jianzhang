import { describe, expect, it } from 'vitest'
import { decryptSyncFile, encryptSyncFile, SYNC_FILE_MAGIC } from '@/utils/crypto'

const SAMPLE = {
  app: 'simple-ledger',
  version: 1,
  exportedAt: '2026-08-14T00:00:00.000Z',
  accounts: [{ id: 'a-1', name: '现金' }],
  categories: [],
  transactions: [{ id: 't-1', note: '午餐 🍜' }],
  budgets: [],
  settings: [],
}

describe('crypto 加密 / 解密', () => {
  it('加密后可解密还原（含中文 / emoji）', async () => {
    const text = await encryptSyncFile(SAMPLE, 'my-pass-123')
    expect(text.startsWith(SYNC_FILE_MAGIC + '.')).toBe(true)
    const restored = (await decryptSyncFile(text, 'my-pass-123')) as typeof SAMPLE
    expect(restored).toEqual(SAMPLE)
  })

  it('同一数据两次加密密文不同（随机 salt/iv），但都能解密', async () => {
    const a = await encryptSyncFile(SAMPLE, 'pass')
    const b = await encryptSyncFile(SAMPLE, 'pass')
    expect(a).not.toBe(b)
    expect(await decryptSyncFile(a, 'pass')).toEqual(SAMPLE)
    expect(await decryptSyncFile(b, 'pass')).toEqual(SAMPLE)
  })

  it('错误密码解密抛「密码不正确」', async () => {
    const text = await encryptSyncFile(SAMPLE, 'right-pass')
    await expect(decryptSyncFile(text, 'wrong-pass')).rejects.toThrow('密码不正确')
  })

  it('空密码加密 / 解密均拒绝', async () => {
    await expect(encryptSyncFile(SAMPLE, '')).rejects.toThrow('不能为空')
    await expect(decryptSyncFile('x.y', '')).rejects.toThrow('不能为空')
  })

  it('非同步文件魔数抛「不是简账」', async () => {
    await expect(decryptSyncFile('hello.world', 'pass')).rejects.toThrow('不是简账')
  })

  it('内容被篡改（密文损坏）抛解密失败', async () => {
    const text = await encryptSyncFile(SAMPLE, 'pass')
    const corrupted = text.slice(0, -4) + 'AAAA'
    await expect(decryptSyncFile(corrupted, 'pass')).rejects.toThrow()
  })
})
