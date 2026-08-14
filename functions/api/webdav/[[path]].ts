/**
 * Cloudflare Pages Functions —— WebDAV 同源代理。
 *
 * 解决浏览器直连 WebDAV 服务器被 CORS 预检拦截的问题（如坚果云 dav.jianguoyun.com
 * 对浏览器跨域请求返回拒绝）。原理：把请求变成与页面同源的 /api/webdav/* 请求，
 * 由 Cloudflare 云端执行转发到上游 WebDAV 服务器，浏览器不再涉及跨域。
 *
 * 用法（部署本仓库到 Cloudflare Pages 后自动生效，无需额外配置）：
 *   「WebDAV 同步」页的服务器地址填：https://<你的域名>/api/webdav/
 *   远程路径、用户名、密码照常填写（路径仍以 / 开头，如 /简账/simple-ledger-sync.json）。
 *
 * 上游地址默认坚果云，可在 Pages 项目 Settings → Environment variables 里
 * 添加 WEBDAV_UPSTREAM 覆盖（如 Nextcloud 的 https://example.com/remote.php/dav）。
 *
 * 注意：只转发必要请求头（Authorization / Content-Type / Depth），避免把浏览器
 * 的 sec-fetch-* / accept-language 等头带给上游引发兼容问题；任何转发异常返回
 * 502 + 具体错误信息（而非 Cloudflare 裸 520），便于排查。
 */

interface Env {
  WEBDAV_UPSTREAM?: string
}

interface ProxyContext {
  request: Request
  env: Env
}

export const onRequest = async (context: ProxyContext): Promise<Response> => {
  const upstream = (context.env.WEBDAV_UPSTREAM ?? 'https://dav.jianguoyun.com/dav').replace(/\/+$/, '')
  const url = new URL(context.request.url)
  // 去掉 /api/webdav 前缀，把剩余路径拼到上游根地址（pathname 保留百分号编码，中文安全）
  const path = url.pathname.replace(/^\/api\/webdav/, '')
  const target = `${upstream}/${path.replace(/^\/+/, '')}`

  const headers = new Headers()
  for (const key of ['Authorization', 'Content-Type', 'Depth'] as const) {
    const value = context.request.headers.get(key)
    if (value) headers.set(key, value)
  }

  try {
    const res = await fetch(target, {
      method: context.request.method,
      headers,
      body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
      redirect: 'follow',
    })
    // 透传上游响应（同源请求，无需 CORS 头）
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`webdav proxy error: ${msg}`, { status: 502 })
  }
}
