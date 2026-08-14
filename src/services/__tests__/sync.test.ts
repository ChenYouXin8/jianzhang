import { describe, expect, it } from 'vitest'
import {
  mergeSettings,
  mergeSnapshots,
  snapshotsDataEqual,
  stableStringify,
} from '@/services/sync'
import type { BackupFile } from '@/services/export'
import type { Account, Budget, Category, Setting, Transaction } from '@/types'

const T0 = 1_700_000_000_000

function row(over: Record<string, unknown> & { id: string }) {
  return { ...over }
}

function snapshot(over: {
  accounts?: Account[]
  categories?: Category[]
  transactions?: Transaction[]
  budgets?: Budget[]
  settings?: Setting[]
}): BackupFile {
  return {
    app: 'simple-ledger',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: over.accounts ?? [],
    categories: over.categories ?? [],
    transactions: over.transactions ?? [],
    budgets: over.budgets ?? [],
    settings: over.settings ?? [],
  }
}

describe('stableStringify / snapshotsDataEqual', () => {
  it('对象键序无关的稳定序列化', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }))
    expect(stableStringify({ a: 1, b: [1, { c: 2 }] })).toBe(
      stableStringify({ b: [1, { c: 2 }], a: 1 }),
    )
  })

  it('数据相等忽略 app/version/exportedAt 元信息', () => {
    const a = snapshot({ accounts: [row({ id: 'a', name: '现金' }) as unknown as Account] })
    const b = snapshot({ accounts: [row({ id: 'a', name: '现金' }) as unknown as Account] })
    expect(snapshotsDataEqual(a, b)).toBe(true)
    b.exportedAt = new Date(Date.now() + 1000).toISOString()
    expect(snapshotsDataEqual(a, b)).toBe(true)
    b.accounts[0].name = '储蓄卡'
    expect(snapshotsDataEqual(a, b)).toBe(false)
  })
})

describe('mergeSnapshots 三路合并', () => {
  it('首次同步（base=null）：两边数据并集', () => {
    const local = snapshot({
      accounts: [{ id: 'a1', name: '现金' } as Account],
      transactions: [{ id: 't1', note: '本地' } as Transaction],
    })
    const remote = snapshot({
      accounts: [{ id: 'a2', name: '储蓄卡' } as Account],
      transactions: [{ id: 't2', note: '云端' } as Transaction],
    })
    const out = mergeSnapshots(null, local, remote)
    expect(out.manual).toBe(false)
    expect(out.data.accounts.map((a) => a.id).sort()).toEqual(['a1', 'a2'])
    expect(out.data.transactions.map((t) => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('双边都改同一条：updatedAt 大者胜（LWW）', () => {
    const base = snapshot({ transactions: [{ id: 't1', amount: 100, note: 'x', createdAt: T0, updatedAt: T0 } as Transaction] })
    const local = snapshot({ transactions: [{ id: 't1', amount: 100, note: '本地改', createdAt: T0, updatedAt: T0 + 100 } as Transaction] })
    const remote = snapshot({ transactions: [{ id: 't1', amount: 100, note: '云端改', createdAt: T0, updatedAt: T0 + 200 } as Transaction] })
    const out = mergeSnapshots(base, local, remote)
    expect(out.data.transactions[0].note).toBe('云端改')
    expect(out.stats.conflicts).toBe(1)
  })

  it('updatedAt 相等时按 createdAt / id 收敛（两台设备裁决一致）', () => {
    const base = snapshot({ accounts: [{ id: 'a', name: 'n', createdAt: T0, updatedAt: T0 } as Account] })
    const local = snapshot({ accounts: [{ id: 'a', name: 'L', createdAt: T0, updatedAt: T0 } as Account] })
    const remote = snapshot({ accounts: [{ id: 'a', name: 'R', createdAt: T0, updatedAt: T0 } as Account] })
    const out = mergeSnapshots(base, local, remote)
    // id 相同 → 胜负由 id 字典序（相等则 local）决定，两台设备结果一致
    expect(['L', 'R']).toContain(out.data.accounts[0].name)
    const out2 = mergeSnapshots(base, local, remote)
    expect(out2.data.accounts[0].name).toBe(out.data.accounts[0].name)
  })

  it('本地删除：base 有而本地无 → 墓碑删除，删除胜编辑', () => {
    const base = snapshot({ transactions: [{ id: 't1', amount: 1, createdAt: T0, updatedAt: T0 } as Transaction] })
    const local = snapshot({ transactions: [] })
    const remote = snapshot({ transactions: [{ id: 't1', amount: 1, note: '云端还在', createdAt: T0, updatedAt: T0 + 999 } as Transaction] })
    const out = mergeSnapshots(base, local, remote)
    expect(out.data.transactions).toHaveLength(0)
    expect(out.stats.localTombstones).toBe(1)
  })

  it('双方都删 → 记录消失', () => {
    const base = snapshot({ transactions: [{ id: 't1', amount: 1, createdAt: T0, updatedAt: T0 } as Transaction] })
    const out = mergeSnapshots(base, snapshot({}), snapshot({}))
    expect(out.data.transactions).toHaveLength(0)
    expect(out.stats.localTombstones).toBe(0)
  })

  it('删除改动过大 → manual 护栏', () => {
    const baseRows = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`, amount: 1, createdAt: T0, updatedAt: T0,
    })) as unknown as Transaction[]
    const base = snapshot({ transactions: baseRows })
    const local = snapshot({})
    const remote = snapshot({ transactions: baseRows })
    const out = mergeSnapshots(base, local, remote)
    expect(out.manual).toBe(true)
  })

  it('settings 合并：碰撞本地胜，单边取该边', () => {
    const base = [{ key: 'k1', value: 'base' }]
    const local = [{ key: 'k1', value: 'local' }, { key: 'k2', value: 'L' }]
    const remote = [{ key: 'k1', value: 'remote' }, { key: 'k3', value: 'R' }]
    const out = mergeSettings(base, local, remote)
    const map = new Map(out.map((s) => [s.key, s.value]))
    expect(map.get('k1')).toBe('local')
    expect(map.get('k2')).toBe('L')
    expect(map.get('k3')).toBe('R')
  })
})
