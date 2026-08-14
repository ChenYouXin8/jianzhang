import type { BackupFile } from '@/services/export'
import { createBackupFile } from '@/services/export'
import { mergeSnapshots, snapshotsDataEqual, type MergeStats } from '@/services/sync'
import {
  basicAuthHeader,
  buildRemoteUrl,
  dirOf,
  hashContent,
  webdavGet,
  webdavMkcol,
  webdavPut,
  type WebDavTarget,
} from '@/services/webdav'
import { decryptSyncFile, encryptSyncFile } from '@/utils/crypto'
import {
  isSyncConfigured,
  loadAutoSync,
  loadSyncBase,
  loadSyncConfig,
  loadSyncPass,
  loadSyncStatus,
  saveSyncBase,
  saveSyncStatus,
  type SyncStatus,
} from '@/services/sync-config'
import type { Account, Budget, Category, Setting, Transaction } from '@/types'

/**
 * 同步编排 —— 把 webdav 传输、加解密、三路合并串成完整流程。
 *
 * 同步收敛规则（一次 performSync 后两端一致）：
 * - 云端无文件 → 上传本地（首次同步）；
 * - 合并结果 == 本地 → 仅上传（云端落后）；
 * - 合并结果 == 云端 → 仅写库（本地落后）；
 * - 两边都落后 → 先上传合并结果，再写库（本次即收敛）；
 * - 合并触发 manual 护栏（删除过多）→ 不做任何自动写操作，交由 UI 让用户选择。
 *
 * 写库（恢复合并结果）通过 deps.restoreLocal 注入，保持本模块可测；
 * settings 合并后同样由 restoreLocal 的调用方落库。
 */

/** 调用方注入：构建本地快照 / 落地合并结果（写库） */
export interface SyncDeps {
  buildLocal: () => Promise<BackupFile>
  restoreLocal: (data: BackupFile) => Promise<void>
}

export type SyncReport =
  | { kind: 'noop'; message: string }
  | { kind: 'pushed'; message: string }
  | { kind: 'merged'; message: string; data: BackupFile; stats: MergeStats }
  | { kind: 'manual'; message: string; data: BackupFile; stats: MergeStats }
  | { kind: 'error'; message: string }
  | { kind: 'skipped'; message: string }

/** 模块级并发锁：自动同步与手动同步互斥，避免写库连锁触发 */
let syncing = false

export function isSyncing(): boolean {
  return syncing
}

function buildTarget(cfg: {
  serverUrl: string
  username: string
  password: string
  remotePath: string
}): WebDavTarget {
  return {
    serverUrl: cfg.serverUrl,
    username: cfg.username,
    password: cfg.password,
    remotePath: cfg.remotePath,
  }
}

async function putEncrypted(
  target: WebDavTarget,
  pass: string,
  snapshot: BackupFile,
): Promise<void> {
  const text = await encryptSyncFile(snapshot, pass)
  await webdavPut(buildRemoteUrl(target), basicAuthHeader(target.username, target.password), text)
}

/** 解密并校验云端文件形状 */
async function parseRemote(text: string, pass: string): Promise<BackupFile> {
  const data = (await decryptSyncFile(text, pass)) as BackupFile
  if (typeof data !== 'object' || data === null || data.app !== 'simple-ledger') {
    throw new Error('云端文件不是简账的同步文件，请检查远程路径')
  }
  return data
}

async function updateStatus(
  patch: Partial<SyncStatus>,
  local: BackupFile,
  remote: BackupFile | null,
): Promise<void> {
  const [prev, localHash, remoteHash] = await Promise.all([
    loadSyncStatus(),
    hashContent(JSON.stringify(local)),
    remote ? hashContent(JSON.stringify(remote)) : Promise.resolve(''),
  ])
  await saveSyncStatus({
    ...prev,
    lastSyncAt: Date.now(),
    lastResult: 'ok',
    lastMessage: patch.lastMessage ?? '',
    lastLocalHash: localHash,
    lastRemoteHash: remoteHash,
  })
}

/**
 * 执行一次完整同步（自动合并）。写库通过 deps.restoreLocal 注入。
 * manual 结果不写库、不动云端，由调用方引导用户选择。
 */
export async function performSync(deps: SyncDeps): Promise<SyncReport> {
  if (syncing) return { kind: 'skipped', message: '同步正在进行中，已跳过本次请求' }
  syncing = true
  try {
    const [cfg, pass, base] = await Promise.all([loadSyncConfig(), loadSyncPass(), loadSyncBase()])
    if (!isSyncConfigured(cfg)) return { kind: 'skipped', message: '尚未配置完整的 WebDAV 服务器信息' }
    if (!pass) return { kind: 'skipped', message: '请先设置同步加密密码' }
    const target = buildTarget(cfg)
    const local = await deps.buildLocal()

    // 幂等建目录 + 下载
    const auth = basicAuthHeader(target.username, target.password)
    const url = buildRemoteUrl(target)
    try {
      await webdavMkcol(dirOf(url), auth)
    } catch {
      /* 目录创建失败不阻塞：PUT/GET 会给出更精确的错误 */
    }
    const remoteText = await webdavGet(url, auth)
    if (remoteText === null) {
      // 首次同步：直接上传本地
      await putEncrypted(target, pass, local)
      await updateStatus({ lastMessage: '首次同步：已上传到云端' }, local, local)
      await saveSyncBase(local)
      return { kind: 'pushed', message: '首次同步完成，已上传到云端' }
    }

    let remote: BackupFile
    try {
      remote = await parseRemote(remoteText, pass)
    } catch (err) {
      return {
        kind: 'error',
        message: err instanceof Error ? err.message : '云端文件解密失败',
      }
    }

    const outcome = mergeSnapshots(base, local, remote)
    if (outcome.manual) {
      return {
        kind: 'manual',
        message: `云端与本地删除改动过大（本地删除 ${outcome.stats.localTombstones} 条、云端删除 ${outcome.stats.remoteTombstones} 条），请手动选择以哪边为准`,
        data: outcome.data,
        stats: outcome.stats,
      }
    }

    const merged = outcome.data
    const localSame = snapshotsDataEqual(local, merged)
    const remoteSame = snapshotsDataEqual(remote, merged)

    if (localSame && remoteSame) {
      return { kind: 'noop', message: '两端数据一致，无需同步' }
    }

    // 先上传合并结果，再写库 —— 本次同步后云端与本地（写库后）收敛
    await putEncrypted(target, pass, merged)
    await updateStatus(
      { lastMessage: `已合并（冲突 ${outcome.stats.conflicts} 条，本地删 ${outcome.stats.localTombstones}，云端删 ${outcome.stats.remoteTombstones}）` },
      merged,
      merged,
    )
    if (localSame) {
      await saveSyncBase(merged)
      return { kind: 'pushed', message: '已同步到云端' }
    }
    await deps.restoreLocal(merged)
    await saveSyncBase(merged)
    return {
      kind: 'merged',
      message: `已合并两端数据并同步（冲突 ${outcome.stats.conflicts} 条）`,
      data: merged,
      stats: outcome.stats,
    }
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : '同步失败',
    }
  } finally {
    syncing = false
  }
}

/** 强制以本地为准：加密上传本地快照并更新基准 */
export async function forcePush(deps: SyncDeps): Promise<SyncReport> {
  if (syncing) return { kind: 'skipped', message: '同步正在进行中，请稍后再试' }
  syncing = true
  try {
    const [cfg, pass] = await Promise.all([loadSyncConfig(), loadSyncPass()])
    if (!isSyncConfigured(cfg)) return { kind: 'skipped', message: '尚未配置完整的 WebDAV 服务器信息' }
    if (!pass) return { kind: 'skipped', message: '请先设置同步加密密码' }
    const target = buildTarget(cfg)
    const local = await deps.buildLocal()
    const auth = basicAuthHeader(target.username, target.password)
    await webdavMkcol(dirOf(buildRemoteUrl(target)), auth)
    await putEncrypted(target, pass, local)
    await updateStatus({ lastMessage: '已强制上传（以本机为准）' }, local, local)
    await saveSyncBase(local)
    return { kind: 'pushed', message: '已强制上传，云端已替换为本机数据' }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : '上传失败' }
  } finally {
    syncing = false
  }
}

/** 强制以云端为准：下载解密并写库，替换本地 */
export async function forcePull(deps: SyncDeps): Promise<SyncReport> {
  if (syncing) return { kind: 'skipped', message: '同步正在进行中，请稍后再试' }
  syncing = true
  try {
    const [cfg, pass] = await Promise.all([loadSyncConfig(), loadSyncPass()])
    if (!isSyncConfigured(cfg)) return { kind: 'skipped', message: '尚未配置完整的 WebDAV 服务器信息' }
    if (!pass) return { kind: 'skipped', message: '请先设置同步加密密码' }
    const target = buildTarget(cfg)
    const auth = basicAuthHeader(target.username, target.password)
    const text = await webdavGet(buildRemoteUrl(target), auth)
    if (text === null) return { kind: 'error', message: '云端还没有同步文件，请先上传' }
    const remote = await parseRemote(text, pass)
    await deps.restoreLocal(remote)
    await saveSyncBase(remote)
    const local = await deps.buildLocal()
    await updateStatus({ lastMessage: '已强制下载（以云端为准）' }, local, remote)
    return { kind: 'merged', message: '已强制下载，本机数据已替换为云端数据', data: remote, stats: { localTombstones: 0, remoteTombstones: 0, conflicts: 0, baseRows: 0 } }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : '下载失败' }
  } finally {
    syncing = false
  }
}

/**
 * 自动同步入口：仅当开启自动同步且配置完整时执行。
 * 供 App.vue 在启动与每次写操作后调用（调用方负责防抖）。
 */
export async function runAutoSync(deps: SyncDeps): Promise<SyncReport> {
  const [auto, cfg] = await Promise.all([loadAutoSync(), loadSyncConfig()])
  if (!auto) return { kind: 'skipped', message: '自动同步未开启' }
  if (!isSyncConfigured(cfg)) return { kind: 'skipped', message: 'WebDAV 尚未配置' }
  return performSync(deps)
}

/** 构建本地快照（从 store 数据 + settings 表），供调用方注入 buildLocal */
export function buildLocalSnapshot(data: {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  settings: Setting[]
}): BackupFile {
  return createBackupFile(data)
}
