import type { BackupFile } from '@/services/export'
import { getSetting, setSetting } from '@/db/repositories/settings'

/**
 * 同步配置与状态 —— 全部持久化在 settings 表（IndexedDB，仅本机）。
 *
 * 敏感说明：
 * - 'sync.config'（含 WebDAV 密码）与 'sync.pass'（加密密码）属于敏感键，
 *   导出备份（JSON 全量备份）时会排除（见 BackupView / export 流程），
 *   避免密码随备份文件外泄；恢复备份时这些键会保留本机现状。
 * - 'sync.base' 是三路合并的基准快照（上次同步的完整账本），
 *   单设备下体积为数 MB，IndexedDB 可承受。
 */

export const SYNC_SETTING_PREFIX = 'sync.'

export const SYNC_SETTING_KEYS = {
  config: 'sync.config',
  pass: 'sync.pass',
  auto: 'sync.auto',
  base: 'sync.base',
  status: 'sync.status',
} as const

export interface SyncConfig {
  /** WebDAV 服务器根地址，如 https://dav.jianguoyun.com/dav/ */
  serverUrl: string
  username: string
  /** WebDAV 密码（坚果云使用「应用密码」） */
  password: string
  /** 远程文件路径（相对服务器根，以 / 开头） */
  remotePath: string
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  serverUrl: 'https://dav.jianguoyun.com/dav/',
  username: '',
  password: '',
  // 坚果云不允许 WebDAV 根目录直接放文件（ObjectNotFound），
  // 必须指向已存在的子文件夹：先在坚果云网页版手动新建「简账」文件夹
  remotePath: '/简账/simple-ledger-sync.json',
}

export interface SyncStatus {
  /** 上次成功同步的时间戳（ms），null = 从未同步 */
  lastSyncAt: number | null
  lastResult: 'ok' | 'error' | null
  lastMessage: string
  /** 上次同步时本地/云端快照的 SHA-256（用于展示「是否有新改动」） */
  lastLocalHash: string
  lastRemoteHash: string
}

export const EMPTY_SYNC_STATUS: SyncStatus = {
  lastSyncAt: null,
  lastResult: null,
  lastMessage: '',
  lastLocalHash: '',
  lastRemoteHash: '',
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  return getSetting(SYNC_SETTING_KEYS.config, DEFAULT_SYNC_CONFIG)
}

export async function saveSyncConfig(cfg: SyncConfig): Promise<void> {
  await setSetting(SYNC_SETTING_KEYS.config, cfg)
}

/** 加密密码：记住时返回字符串，未记住返回空串 */
export async function loadSyncPass(): Promise<string> {
  return getSetting(SYNC_SETTING_KEYS.pass, '')
}

export async function saveSyncPass(pass: string): Promise<void> {
  await setSetting(SYNC_SETTING_KEYS.pass, pass)
}

export async function loadAutoSync(): Promise<boolean> {
  return getSetting(SYNC_SETTING_KEYS.auto, false)
}

export async function saveAutoSync(v: boolean): Promise<void> {
  await setSetting(SYNC_SETTING_KEYS.auto, v)
}

/** 三路合并基准快照；首次同步为 null */
export async function loadSyncBase(): Promise<BackupFile | null> {
  return getSetting<BackupFile | null>(SYNC_SETTING_KEYS.base, null)
}

export async function saveSyncBase(base: BackupFile | null): Promise<void> {
  await setSetting(SYNC_SETTING_KEYS.base, base)
}

export async function loadSyncStatus(): Promise<SyncStatus> {
  return getSetting(SYNC_SETTING_KEYS.status, EMPTY_SYNC_STATUS)
}

export async function saveSyncStatus(status: SyncStatus): Promise<void> {
  await setSetting(SYNC_SETTING_KEYS.status, status)
}

/** 配置是否完整到可以发起同步 */
export function isSyncConfigured(cfg: SyncConfig): boolean {
  return Boolean(cfg.serverUrl.trim() && cfg.username.trim() && cfg.password && cfg.remotePath.trim())
}

/** 备份导出 / 恢复时筛除同步敏感键（保留非 sync 键） */
export function filterSensitiveSettings(rows: Array<{ key: string; value: unknown }>) {
  return rows.filter((r) => !r.key.startsWith(SYNC_SETTING_PREFIX))
}
