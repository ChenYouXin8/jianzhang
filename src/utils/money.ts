/**
 * 金额工具 —— 全应用统一以「分」为单位的整数存储与计算。
 *
 * 选型原因（关键决策）：
 * 1. JS 浮点无法精确表示十进制小数（0.1 + 0.2 = 0.30000000000000004），
 *    记账数据绝不允许出现 19.99 * 100 = 1998.9999... 这类误差；
 * 2. 整数分在 IndexedDB 中存储、求和、与预算比较都是精确的；
 * 3. 转换只在 UI 边界进行，且用字符串运算而非乘除，杜绝二次误差。
 */

export const CENTS_PER_YUAN = 100

/** 金额输入上限：9 位整数（近 10 亿元），超出拒绝，防止溢出与误触 */
export const MAX_AMOUNT_YUAN = 999_999_999

/** 元（字符串，用户输入）→ 分（整数）。仅接受最多两位小数；非法输入返回 null。 */
export function yuanToCents(input: string): number | null {
  const s = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [intPart, fracPart = ''] = s.split('.')
  if (intPart.length > 9) return null
  // 纯字符串运算：整数部分直接放大、小数部分补齐两位，全程无浮点乘法
  const frac = (fracPart + '00').slice(0, 2)
  return Number(intPart) * CENTS_PER_YUAN + Number(frac)
}

/** 分 → 元字符串（CSV 导出、输入框回显用），如 12345 → '123.45'，-50 → '-0.50' */
export function centsToYuan(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const intPart = Math.floor(abs / CENTS_PER_YUAN)
  const frac = String(abs % CENTS_PER_YUAN).padStart(2, '0')
  return `${sign}${intPart}.${frac}`
}

export interface FormatOptions {
  /** 非负金额显示 '+'（收入场景） */
  sign?: boolean
  /** 是否带 ¥ 符号 */
  symbol?: boolean
}

/** 分 → 千分位展示字符串，如 1234567 → '¥12,345.67' */
export function formatCents(cents: number, opts: FormatOptions = {}): string {
  const { sign = false, symbol = true } = opts
  const neg = cents < 0
  const yuan = centsToYuan(Math.abs(cents))
  const [intPart, frac] = yuan.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const prefix = neg ? '-' : sign ? '+' : ''
  return `${prefix}${symbol ? '¥' : ''}${grouped}.${frac}`
}

/**
 * 百分比（整数运算，返回保留 1 位小数的数值，如 33.3 表示 33.3%）。
 * 分母为 0 时返回 0，避免 NaN 进入 UI。
 */
export function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator * 1000) / denominator) / 10
}
