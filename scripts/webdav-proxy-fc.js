/**
 * 阿里云函数计算（FC）版 WebDAV 代理 —— Node.js HTTP 函数。
 *
 * 为什么需要：Cloudflare 免费版边缘节点在海外，访问国内坚果云 dav.jianguoyun.com
 * 会被网络层拦截（Pages Functions 代理返回 520）；阿里云 FC 部署在国内，
 * 到坚果云畅通。页面（Cloudflare Pages 或任何托管）把同步请求发到本代理，
 * 由 FC 转发给坚果云，并返回 CORS 头允许浏览器跨域。
 *
 * 部署步骤（阿里云控制台）：
 * 1. 函数计算 FC → 创建函数 → 使用「HTTP 函数」模板（Node.js 18 或 20）
 * 2. 粘贴本文件内容（或打包 zip 上传，入口文件 index.js，导出 handler）
 * 3. 环境变量（可选）：WEBDAV_UPSTREAM = https://dav.jianguoyun.com/dav（默认即可）
 * 4. 创建触发器：HTTP 触发器，认证方式选「无需认证」，得到公网地址
 *    https://<函数名>-<uid>-<region>.fcapp.run  （默认域名免备案，可直接用）
 * 5. 浏览器打开该地址验证（出现 404/405 等即服务正常）
 *
 * 简账同步页配置：
 *   服务器地址 = https://<函数名>-<uid>-<region>.fcapp.run/api/webdav/
 *   用户名 / 密码（坚果云应用密码）/ 远程路径照常填写
 *   （本函数会把 /api/webdav 前缀剥掉，剩余路径拼到上游根地址）
 *
 * 免费额度：FC 每月提供免费调用额度，个人记账同步绰绰有余。
 */

const UPSTREAM = process.env.WEBDAV_UPSTREAM || 'https://dav.jianguoyun.com/dav'

/** 浏览器跨域所需的 CORS 响应头（页面在 pages.dev，请求 FC 属跨域，必须返回） */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, Destination, Overwrite, If',
  'Access-Control-Max-Age': '86400',
}

exports.handler = async function handler(req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

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
  const text = await upstreamRes.text()
  res.writeHead(upstreamRes.status, {
    ...CORS_HEADERS,
    'Content-Type': upstreamRes.headers.get('content-type') || 'application/octet-stream',
  })
  res.end(text)
}
