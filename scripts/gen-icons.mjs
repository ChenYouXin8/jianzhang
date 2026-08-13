/**
 * 应用图标生成脚本（零依赖）
 * 用 Node 内置 zlib 手写最小 PNG 编码器，绘制「圆角绿底 + 白色硬币（带槽口）」图标。
 * 运行：npm run icons —— 产物输出到 public/icons/
 * 选型原因：不引入 sharp 等重依赖，图标为纯几何图形，逐像素绘制足够精确且可复现。
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/* ---------------- 最小 PNG 编码器（RGBA, 8bit, filter=None） ---------------- */

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(size, pixel) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1)
    raw[row] = 0 // 每行首字节为 filter 类型：0 = None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y)
      const o = row + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------------- 绘制 ---------------- */

const BG = [15, 169, 104] // 主色绿 #0fa968
const COIN = [255, 255, 255]

/** 圆角矩形有向距离场（SDF）：返回值 < 0 表示在图形内部 */
function roundRectSdf(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const mix = (a, b, t) => a + (b - a) * t

function draw(size, { fullBleed }) {
  const c = size / 2
  const bgRect = { cx: c, cy: c, hw: c, hh: c, r: fullBleed ? 0 : size * 0.225 }
  const coinR = size * (fullBleed ? 0.155 : 0.2) // maskable 时缩小进 80% 安全区
  const slot = { cx: c, cy: c, hw: size * 0.3, hh: size * 0.035, r: size * 0.035 }
  return encodePng(size, (x, y) => {
    const covBg = clamp01(0.5 - roundRectSdf(x, y, bgRect.cx, bgRect.cy, bgRect.hw, bgRect.hh, bgRect.r))
    const covCoin = clamp01(0.5 - (Math.hypot(x - c, y - c) - coinR))
    const covSlot = clamp01(0.5 - roundRectSdf(x, y, slot.cx, slot.cy, slot.hw, slot.hh, slot.r))
    const white = covCoin * (1 - covSlot) // 硬币减去槽口
    const alpha = fullBleed ? 255 : Math.round(covBg * 255)
    if (alpha === 0) return [0, 0, 0, 0]
    const t = fullBleed ? white : white * covBg
    return [
      Math.round(mix(BG[0], COIN[0], t)),
      Math.round(mix(BG[1], COIN[1], t)),
      Math.round(mix(BG[2], COIN[2], t)),
      alpha,
    ]
  })
}

/* ---------------- 输出 ---------------- */

mkdirSync(OUT_DIR, { recursive: true })
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true], // maskable：全出血，图形收进安全区
  ['apple-touch-icon.png', 180, true], // iOS 会自行裁圆角，用全出血
]
for (const [name, size, fullBleed] of targets) {
  writeFileSync(join(OUT_DIR, name), draw(size, { fullBleed }))
  console.log(`✓ ${name} (${size}×${size})`)
}
