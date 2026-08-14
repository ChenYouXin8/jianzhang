import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSyncFile } from '@/utils/crypto'
import type { BackupFile } from '@/services/export'
import type { Account, Transaction } from '@/types'

/* ---------------- mock settings 仓储（内存实现） ---------------- */

const settingStore = vi.hoisted(() => new Map<string, unknown>())

vi.mock('@/db/repositories/settings', () => ({
  getSetting: async <T>(key: string, fallback: T): Promise<T> =>
    settingStore.has(key) ? (settingStore.get(key) as T) : fallback,
  setSetting: async (key: string, value: unknown): Promise<void> => {
    settingStore.set(key, JSON.parse(JSON.stringify(value)))
  },
  replaceAllSettings: async (): Promise<void> => {},
}))

import { performSync, forcePush, forcePull, type SyncDeps } from '@/services/sync-manager'
import { SYNC_SETTING_KEYS, type SyncConfig } from '@/services/sync-config'

/* ---------------- fetch mock（WebDAV 网络层） ---------------- */

const fetchMock = vi.fn()
function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  fetchMock.mockImplementation(impl)
  vi.stubGlobal('fetch', fetchMock)
}

const CONFIG: SyncConfig = {
  serverUrl: 'https://dav.jianguoyun.com/dav/',
  username: 'user',
  password: 'app-pass',
  remotePath: '/简账/simple-ledger-sync.json',
}
const ENC_PASS = 'sync-secret'

function localSnapshot(extra?: { transactions?: Transaction[]; accounts?: Account[] }): BackupFile {
  return {
    app: 'simple-ledger',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: extra?.accounts ?? [{ id: 'a1', name: '现金' } as Account],
    categories: [],
    transactions: extra?.transactions ?? [{ id: 't1', amount: 100, note: '本地', date: '2026-08-01', createdAt: 1, updatedAt: 1 } as Transaction],
    budgets: [],
    settings: [],
  }
}

let restored: BackupFile | null = null
const deps: SyncDeps = {
  buildLocal: async () => localSnapshot(),
  restoreLocal: async (data: BackupFile) => {
    restored = data
  },
}

beforeEach(() => {
  settingStore.clear()
  restored = null
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function seedConfig() {
  settingStore.set(SYNC_SETTING_KEYS.config, CONFIG)
  settingStore.set(SYNC_SETTING_KEYS.pass, ENC_PASS)
}

/* 默认网络桩：MKCOL 201，GET 404，PUT 201 */
function stubNetwork(remoteText?: string | null) {
  stubFetch(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'MKCOL') return new Response('', { status: 201 })
    if (init?.method === 'PUT') return new Response('', { status: 201 })
    // GET
    if (remoteText === undefined) return new Response('', { status: 404 })
    return new Response(remoteText ?? '', { status: 200 })
  })
}

describe('performSync', () => {
  it('未配置完整 → skipped', async () => {
    const r = await performSync(deps)
    expect(r.kind).toBe('skipped')
  })

  it('配置完整但缺加密密码 → skipped', async () => {
    settingStore.set(SYNC_SETTING_KEYS.config, CONFIG)
    const r = await performSync(deps)
    expect(r.kind).toBe('skipped')
  })

  it('首次同步（云端无文件）→ 上传并保存基准', async () => {
    seedConfig()
    stubNetwork()
    const r = await performSync(deps)
    expect(r.kind).toBe('pushed')
    // PUT 被调用且 body 是可解密的加密文件
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(putCall).toBeTruthy()
    expect(settingStore.has(SYNC_SETTING_KEYS.base)).toBe(true)
  })

  it('两端一致 → noop，不做任何写操作', async () => {
    seedConfig()
    const local = localSnapshot()
    const remoteText = await encryptSyncFile(local, ENC_PASS)
    stubNetwork(remoteText)
    const r = await performSync(deps)
    expect(r.kind).toBe('noop')
    expect(restored).toBeNull()
  })

  it('云端新增记录 → 合并写库并上传', async () => {
    seedConfig()
    const local = localSnapshot()
    const remote = localSnapshot({
      transactions: [
        ...(local.transactions as Transaction[]),
        { id: 't2', amount: 200, note: '云端新增', date: '2026-08-02', createdAt: 2, updatedAt: 2 } as Transaction,
      ],
    })
    stubNetwork(await encryptSyncFile(remote, ENC_PASS))
    const r = await performSync(deps)
    expect(r.kind).toBe('merged')
    expect(restored).not.toBeNull()
    expect(restored!.transactions.map((t) => t.id).sort()).toEqual(['t1', 't2'])
    // 上传了合并结果
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true)
  })

  it('加密密码错误 → error 且不写库', async () => {
    seedConfig()
    const remoteText = await encryptSyncFile(localSnapshot(), 'other-pass')
    stubNetwork(remoteText)
    const r = await performSync(deps)
    expect(r.kind).toBe('error')
    expect(restored).toBeNull()
  })

  it('网络失败 → error', async () => {
    seedConfig()
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const r = await performSync(deps)
    expect(r.kind).toBe('error')
  })
})

describe('forcePush / forcePull', () => {
  it('forcePush 覆盖上传并保存基准', async () => {
    seedConfig()
    stubNetwork()
    const r = await forcePush(deps)
    expect(r.kind).toBe('pushed')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true)
  })

  it('forcePull 下载并写库', async () => {
    seedConfig()
    const remoteText = await encryptSyncFile(localSnapshot({ transactions: [] }), ENC_PASS)
    stubNetwork(remoteText)
    const r = await forcePull(deps)
    expect(r.kind).toBe('merged')
    expect(restored).not.toBeNull()
    expect(restored!.transactions).toHaveLength(0)
  })

  it('forcePull 云端无文件 → error', async () => {
    seedConfig()
    stubNetwork() // GET 404
    const r = await forcePull(deps)
    expect(r.kind).toBe('error')
    expect(restored).toBeNull()
  })
})
