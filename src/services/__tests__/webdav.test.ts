import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  basicAuthHeader,
  buildRemoteUrl,
  dirOf,
  fnv1a64,
  hashContent,
  testConnection,
  webdavGet,
  webdavMkcol,
  webdavPropfind,
  webdavPut,
} from '@/services/webdav'

const fetchMock = vi.fn()

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  fetchMock.mockImplementation(impl)
  vi.stubGlobal('fetch', fetchMock)
}

describe('URL 拼接与认证', () => {
  it('base 补尾斜杠 + 中文路径逐段编码', () => {
    expect(
      buildRemoteUrl({
        serverUrl: 'https://dav.jianguoyun.com/dav',
        username: 'u',
        password: 'p',
        remotePath: '/简账/simple-ledger-sync.json',
      }),
    ).toBe('https://dav.jianguoyun.com/dav/%E7%AE%80%E8%B4%A6/simple-ledger-sync.json')
  })

  it('路径含空格也安全编码', () => {
    expect(
      buildRemoteUrl({
        serverUrl: 'https://x.dev/dav/',
        username: 'u',
        password: 'p',
        remotePath: '/a b/c.json',
      }),
    ).toBe('https://x.dev/dav/a%20b/c.json')
  })

  it('dirOf 返回父目录', () => {
    expect(dirOf('https://x.dev/dav/简账/a.json')).toBe('https://x.dev/dav/%E7%AE%80%E8%B4%A6')
  })

  it('Basic 头对中文用户名 UTF-8 安全', () => {
    const header = basicAuthHeader('用户@jianguoyun.com', 'secret')
    const bytes = Uint8Array.from(atob(header.slice('Basic '.length)), (c) => c.charCodeAt(0))
    expect(new TextDecoder().decode(bytes)).toBe('用户@jianguoyun.com:secret')
  })
})

describe('hashContent', () => {
  it('同内容哈希稳定、不同内容不同', async () => {
    const a = await hashContent('hello')
    expect(a).toBe(await hashContent('hello'))
    expect(a).not.toBe(await hashContent('hello!'))
    expect(a).toMatch(/^[0-9a-f]{64}$/) // SHA-256
  })

  it('FNV-1a 回退实现：空串已知值 + 稳定性', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325')
    expect(fnv1a64('abc')).toBe(fnv1a64('abc'))
    expect(fnv1a64('abc')).not.toBe(fnv1a64('abd'))
  })
})

describe('webdavGet', () => {
  it('200 → 返回文本', async () => {
    stubFetch(async () => new Response('{"app":"simple-ledger"}', { status: 200 }))
    expect(await webdavGet('https://x.dev/a.json', 'Basic x')).toBe('{"app":"simple-ledger"}')
  })

  it('404 → null（文件不存在）', async () => {
    stubFetch(async () => new Response('', { status: 404 }))
    expect(await webdavGet('https://x.dev/a.json', 'Basic x')).toBeNull()
  })

  it('401 → 认证失败文案', async () => {
    stubFetch(async () => new Response('', { status: 401 }))
    await expect(webdavGet('https://x.dev/a.json', 'Basic x')).rejects.toThrow('认证失败')
  })

  it('网络拒绝 → CORS 友好文案', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(webdavGet('https://x.dev/a.json', 'Basic x')).rejects.toThrow('CORS')
  })
})

describe('webdavPut', () => {
  it('201 → 成功', async () => {
    const called: Array<{ url: string; method: string; headers: HeadersInit }> = []
    stubFetch(async (url, init) => {
      called.push({ url, method: init?.method ?? '', headers: init?.headers as HeadersInit })
      return new Response('', { status: 201 })
    })
    await expect(webdavPut('https://x.dev/a.json', 'Basic x', '{}')).resolves.toBeUndefined()
    expect(called[0].method).toBe('PUT')
    expect(called[0].headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('409/404 → 远程目录不存在指引文案', async () => {
    stubFetch(async () => new Response('', { status: 409 }))
    await expect(webdavPut('https://x.dev/a.json', 'Basic x', '{}')).rejects.toThrow('改为 /simple-ledger-sync.json')
    stubFetch(async () => new Response('', { status: 404 }))
    await expect(webdavPut('https://x.dev/a.json', 'Basic x', '{}')).rejects.toThrow('改为 /simple-ledger-sync.json')
  })
})

describe('webdavMkcol', () => {
  it('逐级创建，已存在（405/409）继续', async () => {
    const urls: string[] = []
    stubFetch(async (url) => {
      urls.push(url)
      return new Response('', { status: url.endsWith('简账') ? 201 : 405 })
    })
    await webdavMkcol('https://x.dev/dav/简账', 'Basic x')
    expect(urls).toEqual(['https://x.dev/dav', 'https://x.dev/dav/%E7%AE%80%E8%B4%A6'])
  })

  it('其他错误码抛出', async () => {
    stubFetch(async () => new Response('', { status: 507 }))
    await expect(webdavMkcol('https://x.dev/a', 'Basic x')).rejects.toThrow('创建目录失败')
  })
})

describe('testConnection', () => {
  const target = {
    serverUrl: 'https://dav.jianguoyun.com/dav/',
    username: 'u',
    password: 'p',
    remotePath: '/简账/simple-ledger-sync.json',
  }

  it('文件存在（GET 200）→ 连接成功且已存在', async () => {
    stubFetch(async () => new Response('{}', { status: 200 }))
    const r = await testConnection(target)
    expect(r.ok).toBe(true)
    expect(r.message).toContain('已存在')
    expect(r.remoteExists).toBe(true)
  })

  it('文件不存在（GET 404）→ 连接成功但文件未建', async () => {
    stubFetch(async () => new Response('', { status: 404 }))
    const r = await testConnection(target)
    expect(r.ok).toBe(true)
    expect(r.remoteExists).toBe(false)
  })

  it('认证失败 → ok=false 且带文案', async () => {
    stubFetch(async () => new Response('', { status: 401 }))
    const r = await testConnection(target)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('认证失败')
  })

  it('网络错误 → ok=false 且带文案', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })
    const r = await testConnection(target)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('CORS')
  })
})

describe('webdavPropfind', () => {
  it('返回状态码', async () => {
    stubFetch(async () => new Response('', { status: 207 }))
    expect(await webdavPropfind('https://x.dev/a.json', 'Basic x')).toBe(207)
  })
})
