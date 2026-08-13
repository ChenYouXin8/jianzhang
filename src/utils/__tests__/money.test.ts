import { describe, expect, it } from 'vitest'
import { centsToYuan, formatCents, percent, yuanToCents } from '@/utils/money'

describe('yuanToCents：元字符串 → 分（整数，无浮点误差）', () => {
  it('整数元', () => {
    expect(yuanToCents('123')).toBe(12300)
  })
  it('一位小数', () => {
    expect(yuanToCents('19.9')).toBe(1990)
  })
  it('两位小数（浮点陷阱 19.99）', () => {
    expect(yuanToCents('19.99')).toBe(1999)
  })
  it('0.05 小数前导零', () => {
    expect(yuanToCents('0.05')).toBe(5)
  })
  it('007.50 整数前导零', () => {
    expect(yuanToCents('007.50')).toBe(750)
  })
  it('0 元', () => {
    expect(yuanToCents('0')).toBe(0)
  })
  it('容忍首尾空格', () => {
    expect(yuanToCents(' 1.2 ')).toBe(120)
  })
  it('上限内', () => {
    expect(yuanToCents('999999999')).toBe(99999999900)
  })
  it('超上限拒绝', () => {
    expect(yuanToCents('1000000000')).toBeNull()
  })
  it('拒绝空串', () => {
    expect(yuanToCents('')).toBeNull()
  })
  it('拒绝非法字符', () => {
    expect(yuanToCents('abc')).toBeNull()
  })
  it('拒绝负数', () => {
    expect(yuanToCents('-5')).toBeNull()
  })
  it('拒绝多于两位小数', () => {
    expect(yuanToCents('1.234')).toBeNull()
  })
  it('拒绝孤立小数点', () => {
    expect(yuanToCents('.5')).toBeNull()
  })
  it('拒绝结尾小数点（UI 保存前应剔除）', () => {
    expect(yuanToCents('1.')).toBeNull()
  })
})

describe('centsToYuan：分 → 元字符串', () => {
  it('常规', () => {
    expect(centsToYuan(1999)).toBe('19.99')
  })
  it('零', () => {
    expect(centsToYuan(0)).toBe('0.00')
  })
  it('负数补零', () => {
    expect(centsToYuan(-5)).toBe('-0.05')
  })
  it('大额', () => {
    expect(centsToYuan(100000)).toBe('1000.00')
  })
})

describe('formatCents：千分位展示', () => {
  it('千分位分组', () => {
    expect(formatCents(1234567)).toBe('¥12,345.67')
  })
  it('负号在货币符号前', () => {
    expect(formatCents(-1234567)).toBe('-¥12,345.67')
  })
  it('sign 模式（收入场景显示 +）', () => {
    expect(formatCents(500, { sign: true })).toBe('+¥5.00')
  })
  it('不带货币符号', () => {
    expect(formatCents(500, { symbol: false })).toBe('5.00')
  })
  it('零', () => {
    expect(formatCents(0)).toBe('¥0.00')
  })
})

describe('percent：整数运算百分比（1 位小数）', () => {
  it('四舍五入到 1 位小数', () => {
    expect(percent(1, 3)).toBe(33.3)
  })
  it('分母为 0 返回 0（防 NaN）', () => {
    expect(percent(5, 0)).toBe(0)
  })
  it('可超过 100（超支场景）', () => {
    expect(percent(5, 2)).toBe(250)
  })
  it('恰好 100', () => {
    expect(percent(100, 100)).toBe(100)
  })
})
