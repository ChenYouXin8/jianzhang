/**
 * 同步文件加密 —— WebCrypto（PBKDF2 派生密钥 + AES-GCM 认证加密）。
 *
 * 为什么加密：同步到 WebDAV（如坚果云）的备份文件包含完整财务数据，
 * 文件放在第三方服务器上，即使传输走 HTTPS，也应保证「文件本身泄露也读不出内容」。
 *
 * 文件格式（单行文本，便于直接 PUT）：
 *   simple-ledger-sync-v1.<base64url 的 JSON 载荷>
 * 载荷结构：{ version, iterations, salt, iv, ciphertext }，均为 base64。
 * salt/iv 随机生成随文件保存；密钥由用户「同步加密密码」经 PBKDF2(SHA-256) 派生，
 * 不同文件 salt 不同 → 同一密码在不同文件上派生出不同密钥，杜绝重放攻击。
 *
 * 注意：本模块在浏览器（globalThis.crypto.subtle）与 Node ≥19（node:crypto.webcrypto）
 * 下均可用，单元测试无需 mock。
 */

/** 文件魔数前缀，用于识别加密同步文件（也用于解密前快速校验） */
export const SYNC_FILE_MAGIC = 'simple-ledger-sync-v1'

/** PBKDF2 迭代次数：OWASP 建议 ≥600k（SHA-256）；低端手机约 0.3~1s，可接受 */
const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12
/** btoa 转换分块大小，避免 String.fromCharCode 参数展开栈溢出 */
const B64_CHUNK = 0x8000

export interface SyncPayload {
  version: 1
  iterations: number
  /** base64 */
  salt: string
  /** base64 */
  iv: string
  /** base64 */
  ciphertext: string
}

/** Uint8Array → base64（分块，兼容大文件） */
export function bufToBase64(buf: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < buf.length; i += B64_CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + B64_CHUNK))
  }
  return btoa(bin)
}

/** base64 → Uint8Array（明确 ArrayBuffer 承载，满足 WebCrypto BufferSource 类型） */
export function base64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 加密任意 JSON 兼容数据，返回带魔数的单行文本；密码为空直接抛错 */
export async function encryptSyncFile(data: unknown, password: string): Promise<string> {
  if (!password) throw new Error('同步加密密码不能为空')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  const payload: SyncPayload = {
    version: 1,
    iterations: PBKDF2_ITERATIONS,
    salt: bufToBase64(salt),
    iv: bufToBase64(iv),
    ciphertext: bufToBase64(ciphertext),
  }
  return `${SYNC_FILE_MAGIC}.${btoa(JSON.stringify(payload))}`
}

/**
 * 解密同步文件文本。
 * @throws 魔数不符 / 密码错误 / 文件损坏（AES-GCM 认证失败）
 */
export async function decryptSyncFile(text: string, password: string): Promise<unknown> {
  if (!password) throw new Error('同步加密密码不能为空')
  const dot = text.indexOf('.')
  if (dot <= 0 || text.slice(0, dot) !== SYNC_FILE_MAGIC) {
    throw new Error('不是简账的加密同步文件')
  }
  let payload: SyncPayload
  try {
    payload = JSON.parse(atob(text.slice(dot + 1))) as SyncPayload
  } catch {
    throw new Error('同步文件格式损坏')
  }
  if (payload.version !== 1 || !payload.salt || !payload.iv || !payload.ciphertext) {
    throw new Error('同步文件格式不受支持')
  }
  const key = await deriveKey(password, base64ToBuf(payload.salt))
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuf(payload.iv) },
      key,
      base64ToBuf(payload.ciphertext),
    )
  } catch {
    throw new Error('解密失败：加密密码不正确或文件已损坏')
  }
  try {
    return JSON.parse(new TextDecoder().decode(plaintext))
  } catch {
    throw new Error('解密后的数据不是有效 JSON')
  }
}
