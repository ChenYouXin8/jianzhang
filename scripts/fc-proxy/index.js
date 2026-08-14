/**
 * 阿里云函数计算 FC 3.0 —— Web 函数版 WebDAV 代理（Node.js 20）。
 *
 * 为什么需要：坚果云不让浏览器直接跨域访问，且 Cloudflare 海外边缘连不上
 * 国内坚果云（520）；本函数部署在阿里云（国内节点），转发请求给坚果云，
 * 并返回 CORS 头让浏览器跨域放行。
 *
 * 创建步骤（阿里云控制台）：
 * 1. 函数计算 FC → 创建函数 → 类型选「Web 函数」→ 运行时 Node.js 20
 * 2. 代码上传方式：「通过 ZIP 包上传代码」，上传本文件打成的 zip（入口 index.js）
 * 3. 启动命令填：node index.js ；监听端口填：9000（默认即可）
 * 4. 创建后：函数详情 → 触发器 → 创建触发器 → HTTP 触发器 → 认证选「无需认证」
 *    得到公网地址 https://<函数名>-<uid>-<region>.fcapp.run （免备案）
 * 5. 简账同步页「服务器地址」填该地址 + /api/webdav/，其余照常。
 */

const http = require('http')

const UPSTREAM = process.env.WEBDAV_UPSTREAM || 'https://dav.jianguoyun.com/dav'

/** 浏览器跨域所需 CORS 响应头（页面在 pages.dev，请求本函数属跨域，必须返回） */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, Destination, Overwrite, If',
  'Access-Control-Max-Age': '86400',
}

http
  .createServer(async (req, res) => {
    try {
      // CORS 预检
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS)
        res.end()
        return
      }

      // 去掉 /api/webdav 前缀，剩余路径拼到上游根地址（URL 保留百分号编码，中文安全）
      const path = (req.url || '/').replace(/^\/api\/webdav/, '')
      const target = UPSTREAM.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '')

      const headers = {}
      for (const key of ['authorization', 'content-type', 'depth']) {
        const value = req.headers[key]
        if (value) headers[key] = value
      }

      // 读取请求体（PUT 上传）
      let body
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await new Promise((resolve, reject) => {
          const chunks = []
          req.on('data', (c) => chunks.push(c))
          req.on('end', () => resolve(Buffer.concat(chunks)))
          req.on('error', reject)
        })
      }

      const upstreamRes = await fetch(target, { method: req.method, headers, body })
      const buf = Buffer.from(await upstreamRes.arrayBuffer())
      res.writeHead(upstreamRes.status, {
        ...CORS_HEADERS,
        'Content-Type': upstreamRes.headers.get('content-type') || 'application/octet-stream',
      })
      res.end(buf)
    } catch (err) {
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('webdav proxy error: ' + (err instanceof Error ? err.message : String(err)))
    }
  })
  .listen(9000)
