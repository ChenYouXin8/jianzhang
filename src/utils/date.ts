import dayjs from 'dayjs'

/**
 * 日期工具。业务日期统一为 'YYYY-MM-DD' 字符串，月份统一为 'YYYY-MM'。
 * 用 dayjs 而非原生 Date：解析/格式化一致、避免时区偏移导致「今天」判断出错。
 */

export const DATE_FORMAT = 'YYYY-MM-DD'
export const MONTH_FORMAT = 'YYYY-MM'

export const todayStr = (): string => dayjs().format(DATE_FORMAT)

export const monthOf = (dateStr: string): string => dateStr.slice(0, 7)

export const currentMonth = (): string => dayjs().format(MONTH_FORMAT)

/** '2026-08' → '2026年8月' */
export const monthLabel = (month: string): string => dayjs(month).format('YYYY年M月')

/** '2026-08-13' → '周四' */
export const weekdayLabel = (dateStr: string): string => '周' + '日一二三四五六'[dayjs(dateStr).day()]

/**
 * 账单分组头文案：'2026-08-13' → '今天' / '昨天' / '8月13日'（跨年带年份）
 */
export function dayHeaderLabel(dateStr: string): string {
  const d = dayjs(dateStr)
  const today = dayjs()
  if (d.isSame(today, 'day')) return '今天'
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天'
  if (d.isSame(today.add(1, 'day'), 'day')) return '明天'
  return d.isSame(today, 'year') ? d.format('M月D日') : d.format('YYYY年M月D日')
}

/** 时间戳 → '08-13 21:30'（账单详情/列表辅助信息） */
export const formatDateTime = (ts: number): string => dayjs(ts).format('MM-DD HH:mm')

/** 当前月往前推 n-1 个月（含当月），如 n=6 → ['2026-03', ..., '2026-08'] */
export function lastMonths(n: number, endMonth = currentMonth()): string[] {
  const months: string[] = []
  const m = dayjs(endMonth + '-01')
  for (let i = n - 1; i >= 0; i--) {
    months.push(m.subtract(i, 'month').format(MONTH_FORMAT))
  }
  return months
}

/** 该月天数（趋势图 X 轴用） */
export function daysInMonth(month: string): number {
  return dayjs(month + '-01').daysInMonth()
}
