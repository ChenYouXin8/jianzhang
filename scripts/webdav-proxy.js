/**
 * WebDAV CORS 代理 —— Cloudflare Worker。
 *
 * 用途：少数 WebDAV 服务器不返回 Access-Control-Allow-* 头（浏览器直连会被
 * CORS 预检拦截，如部分自建/旧版服务器；坚果云官方 dav.jianguoyun.com
 * 支持跨域直连，一般无需本代理）。部署后将「服务器地址」填 Worker 地址即可。
 *
 * 部署步骤：
 * 1. 登录 Cloudflare → Workers & Pages → Create → Worker，粘贴本文件；
 * 2. 设置环境变量 WEBDAV_UPSTREAM = 目标服务器根地址（如 https://dav.jianguoyun.com/dav/）；
 * 3. 保存并部署，得到 https://<your-worker>.workers.dev；
 * 4. 简账「WebDAV 同步」页的服务器地址填该 Worker 地址，用户名/密码照填。
 *
 * 代理只透传请求，不改动数据；凭据由浏览器直接发往 Worker（HTTPS），
 * Worker 透传 Authorization 头给上游，不会落盘。
 */

const UPSTREAM = (typeof WEBDAV_UPSTREAM !== 'undefined' && WEBDAV_UPSTREAM) || ''

/** 允许跨域来源：默认全开（Basic Auth 由用户浏览器持有）；可收紧为具体域名 */
const CORS_ORIGIN = '*'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, Destination, Overwrite, If',
    'Access-Control-Expose-Headers': 'ETag, Content-Length',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request: Request, env: { WEBDAV_UPSTREAM?: string }): Promise<Response> {
    const upstream = env.WEBDAV_UPSTREAM || UPSTREAM
    if (!upstream) {
      return new Response('WebDAV proxy: missing WEBDAV_UPSTREAM binding', { status: 500 })
    }

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    // 把 Worker 路径（/dav/... 或 /...）拼到上游根地址
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/dav/, '')
    const target = new URL(upstream.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, ''))
    const headers = new Headers(request.headers)
    headers.delete('host')

    const upstreamRes = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    })

    const res = new Response(upstreamRes.body, { status: upstreamRes.status, headers: upstreamRes.headers })
    for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v)
    return res
  },
}
