import type { TxType } from '@/types'

/** 账单筛选条件（BillsView 与 FilterPopup 共享的类型契约） */
export interface BillFilters {
  type: TxType | ''
  /** 一级分类 id（会命中其全部二级分类） */
  categoryId: string
  accountId: string
  range: 'month' | '3m' | 'custom'
  from: string
  to: string
}

export const emptyFilters = (): BillFilters => ({
  type: '',
  categoryId: '',
  accountId: '',
  range: 'month',
  from: '',
  to: '',
})
