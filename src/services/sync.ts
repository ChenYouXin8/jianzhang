/**
 * 快照式三路合并（纯函数，无 DB / store 依赖，node 环境可测）。
 *
 * 同步模型：云端一个 JSON 文件（形状 = BackupFile，见 services/export.ts），
 * 每台设备在 settings 表存上次同步的完整快照（sync.base）作为比较基准。
 * 合并规则：
 * - 记录按 id 并集；同一 id 两边都改 → updatedAt 大者胜（相等 → createdAt → id 字典序，
 *   保证两台设备各自计算的胜者一致，收敛不打架）；
 * - 删除检测：base 里有而某边没有 = 该边删除（墓碑，同步时推导，无需侵入删除路径），
 *   删除胜编辑；
 * - 护栏：总墓碑数 >50 或 >20% base 行数 → 转手动处理（manual=true）；
 * - settings 表按 key 合并，碰撞本地胜（设备偏好不覆盖）。
 */
import type { BackupFile } from '@/services/export'
import type { Setting } from '@/types'

/** 参与合并的数据表（settings 单独处理） */
const DATA_TABLES = ['accounts', 'categories', 'transactions', 'budgets'] as const

type Row = { id: string; createdAt?: number; updatedAt?: number }

export interface MergeStats {
  localTombstones: number
  remoteTombstones: number
  /** 两边都改过且内容不同、需按 LWW 裁决的记录数 */
  conflicts: number
  baseRows: number
}

export interface MergeOutcome {
  data: BackupFile
  /** true = 改动过大需用户手动选择，data 不可直接采用 */
  manual: boolean
  stats: MergeStats
}

/** 键序无关的稳定序列化（对象键排序），用于快照相等比较 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** 快照数据相等比较（忽略 app/version/exportedAt 元信息） */
export function snapshotsDataEqual(a: BackupFile, b: BackupFile): boolean {
  return DATA_TABLES.every((k) => stableStringify(a[k]) === stableStringify(b[k])) &&
    stableStringify(a.settings) === stableStringify(b.settings)
}

/** 行级胜负：updatedAt 大者胜；相等 → createdAt 大者胜；再相等 → id 字典序大者胜（收敛） */
function rowWinner(local: Row, remote: Row): Row {
  const t = (r: Row) => r.updatedAt ?? 0
  if (t(local) !== t(remote)) return t(local) > t(remote) ? local : remote
  const c = (r: Row) => r.createdAt ?? 0
  if (c(local) !== c(remote)) return c(local) > c(remote) ? local : remote
  return local.id >= remote.id ? local : remote
}

/** settings 按 key 合并：碰撞本地胜；仅单边有则取该边；base 有而双边都无 → 删除 */
export function mergeSettings(baseRows: Setting[], localRows: Setting[], remoteRows: Setting[]): Setting[] {
  const base = new Map(baseRows.map((s) => [s.key, s]))
  const local = new Map(localRows.map((s) => [s.key, s]))
  const remote = new Map(remoteRows.map((s) => [s.key, s]))
  const keys = new Set([...base.keys(), ...local.keys(), ...remote.keys()])
  const out: Setting[] = []
  for (const key of keys) {
    const hasL = local.has(key)
    const hasR = remote.has(key)
    if (hasL && hasR) out.push(local.get(key)!)
    else if (hasL) out.push(local.get(key)!)
    else if (hasR) out.push(remote.get(key)!)
    // base 有而双边都无 → 跳过（删除）
  }
  return out
}

/** 三路合并（base 可为 null = 首次同步，等价于并集） */
export function mergeSnapshots(base: BackupFile | null, local: BackupFile, remote: BackupFile): MergeOutcome {
  const merged: Partial<Record<(typeof DATA_TABLES)[number], Row[]>> = {}
  let localTombstones = 0
  let remoteTombstones = 0
  let conflicts = 0

  for (const table of DATA_TABLES) {
    const b = base ? new Map((base[table] as Row[]).map((r) => [r.id, r])) : new Map<string, Row>()
    const l = new Map((local[table] as Row[]).map((r) => [r.id, r]))
    const r = new Map((remote[table] as Row[]).map((r) => [r.id, r]))
    const ids = new Set([...b.keys(), ...l.keys(), ...r.keys()])
    const rows: Row[] = []
    for (const id of ids) {
      const inB = b.has(id)
      const inL = l.has(id)
      const inR = r.has(id)
      if (inB && !inL && !inR) continue // 双方都删了
      if (inB && inL && !inR) {
        remoteTombstones++ // 远端删除（base 有、本地有、远端无），删除胜编辑
        continue
      }
      if (inB && !inL && inR) {
        localTombstones++ // 本地删除（base 有、本地无、远端有），删除胜编辑
        continue
      }
      if (inB && inL && inR) {
        const lv = l.get(id)!
        const rv = r.get(id)!
        if (stableStringify(lv) !== stableStringify(rv)) conflicts++
        rows.push(rowWinner(lv, rv))
      } else if (inL) {
        rows.push(l.get(id)!) // 本地新增
      } else {
        rows.push(r.get(id)!) // 远端新增
      }
    }
    merged[table] = rows
  }

  const baseRows = base ? DATA_TABLES.reduce((n, t) => n + (base[t] as Row[]).length, 0) : 0
  const total = localTombstones + remoteTombstones
  const manual = total > 50 || (baseRows > 0 && total > 0.2 * baseRows)

  return {
    data: {
      app: 'simple-ledger',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...merged,
      settings: mergeSettings(base?.settings ?? [], local.settings, remote.settings),
    } as BackupFile,
    manual,
    stats: { localTombstones, remoteTombstones, conflicts, baseRows },
  }
}
