/**
 * WebDAV 客户端（浏览器直连，原生 fetch，零依赖）。
 *
 * CORS 说明：部分 WebDAV 服务器（如坚果云 dav.jianguoyun.com）不返回
 * Access-Control-Allow-* 头，浏览器直连会被预检拦截。解决方式是把
 * scripts/webdav-proxy.js 部署为 Cloudflare Worker，应用里把服务器地址
 * 填成 Worker 地址即可 —— 本模块无需区分，服务器地址对用户透明。
 *
 * 约定：remotePath 以 '/' 开头（如 /简账/simple-ledger-sync.json），
 * serverUrl 为目录形式（如 https://dav.jianguoyun.com/dav/）。
 */

export interface WebDavTarget {
  serverUrl: string
  username: string
  password: string
  remotePath: string
}

/** 带 HTTP 状态码的 WebDAV 错误；message 为中文可直接展示 */
export class WebDavError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

/** URL 拼接：base 补尾斜杠，路径逐段 encodeURI（中文/空格安全），保留前导 '/' */
export function buildRemoteUrl(target: WebDavTarget): string {
  const base = target.serverUrl.endsWith('/') ? target.serverUrl : `${target.serverUrl}/`
  const segments = target.remotePath
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
  return `${base}${segments.join('/')}`
}

/** 远程文件的父目录 URL（MKCOL 建目录用） */
export function dirOf(url: string): string {
  const u = new URL(url)
  const i = u.pathname.lastIndexOf('/')
  u.pathname = i <= 0 ? '/' : u.pathname.slice(0, i)
  return u.toString()
}

/** UTF-8 安全 Basic 头（btoa 不能直接处理中文用户名） */
export function basicAuthHeader(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `Basic ${btoa(bin)}`
}

/** 内容哈希：优先 SHA-256；纯 http 部署无 crypto.subtle 时回退 FNV-1a 64 */
export async function hashContent(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined') {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return fnv1a64(text)
}

/** FNV-1a 64 位哈希（16 位 hex）——纯 http 部署的回退实现 */
export function fnv1a64(text: string): string {
  let h = 0xcbf29ce484222325n
  for (const ch of text) {
    h ^= BigInt(ch.codePointAt(0)!)
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

const TIMEOUT_MS = 15000

/** 统一请求包装：超时 + 网络/CORS 错误转中文文案 */
async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new WebDavError('连接超时，请检查网络')
    }
    throw new WebDavError('网络错误或服务器拒绝跨域请求（CORS）')
  }
}

function throwOnAuth(res: Response): void {
  if (res.status === 401) {
    throw new WebDavError('认证失败：请检查用户名与 App 密码（如服务器有跳转请改用最终地址）', 401)
  }
}

/** GET 文件内容；404 → null（远端文件不存在） */
export async function webdavGet(url: string, auth: string): Promise<string | null> {
  const res = await request(url, { method: 'GET', headers: { Authorization: auth } })
  throwOnAuth(res)
  if (res.status === 404) return null
  if (!res.ok) throw new WebDavError(`下载失败（HTTP ${res.status}）`, res.status)
  return res.text()
}

/** PUT 上传文本文件 */
export async function webdavPut(url: string, auth: string, body: string): Promise<void> {
  const res = await request(url, {
    method: 'PUT',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body,
  })
  throwOnAuth(res)
  if (res.status === 409) {
    throw new WebDavError(
      '远程目录不存在或创建失败：请在坚果云网页版手动新建「简账」文件夹后重试（或修改远程路径）',
      409,
    )
  }
  if (!res.ok) throw new WebDavError(`上传失败（HTTP ${res.status}）`, res.status)
}

/** MKCOL 递归建目录：逐级创建；405/409/301 视为已存在继续 */
export async function webdavMkcol(dirUrl: string, auth: string): Promise<void> {
  const u = new URL(dirUrl)
  const segments = u.pathname.split('/').filter(Boolean)
  let prefix = `${u.protocol}//${u.host}`
  for (const seg of segments) {
    prefix += `/${seg}`
    const res = await request(prefix, { method: 'MKCOL', headers: { Authorization: auth } })
    throwOnAuth(res)
    if (!res.ok && ![405, 409, 301, 302].includes(res.status)) {
      throw new WebDavError(`创建目录失败（HTTP ${res.status}）`, res.status)
    }
  }
}

/** PROPFIND depth-0，返回状态码（207/200 = 资源存在） */
export async function webdavPropfind(url: string, auth: string): Promise<number> {
  const res = await request(url, {
    method: 'PROPFIND',
    headers: { Authorization: auth, Depth: '0' },
  })
  throwOnAuth(res)
  return res.status
}

/** 测试连接：确保父目录存在（幂等）后探测文件；任何错误转为可展示文案 */
export async function testConnection(
  target: WebDavTarget,
): Promise<{ ok: boolean; message: string; remoteExists: boolean }> {
  try {
    const url = buildRemoteUrl(target)
    const auth = basicAuthHeader(target.username, target.password)
    await webdavMkcol(dirOf(url), auth)
    const status = await webdavPropfind(url, auth)
    const exists = status === 207 || status === 200
    return {
      ok: true,
      message: exists ? '连接成功，远程文件已存在' : '连接成功，远程文件尚不存在',
      remoteExists: exists,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof WebDavError ? err.message : '连接失败',
      remoteExists: false,
    }
  }
}
