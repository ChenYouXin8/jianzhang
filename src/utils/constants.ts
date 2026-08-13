import type { AccountType, BalanceDirection, TxType } from '@/types'

/** 交易类型中文标签 */
export const TX_TYPE_LABELS: Record<TxType, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
}

export interface AccountTypeMeta {
  label: string
  icon: string
  color: string
  /** 新建账户时的默认余额方向：信用卡为负债 */
  defaultDirection: BalanceDirection
}

/** 账户类型元信息（图标用 emoji：跨平台渲染一致、零依赖，可替换为图标库） */
export const ACCOUNT_TYPES: Record<AccountType, AccountTypeMeta> = {
  cash: { label: '现金', icon: '💵', color: '#0fa968', defaultDirection: 'asset' },
  debit: { label: '储蓄卡', icon: '💳', color: '#339af0', defaultDirection: 'asset' },
  credit: { label: '信用卡', icon: '💳', color: '#845ef7', defaultDirection: 'liability' },
  ewallet: { label: '电子钱包', icon: '📲', color: '#f59f00', defaultDirection: 'asset' },
  investment: { label: '投资账户', icon: '📈', color: '#e64980', defaultDirection: 'asset' },
  other: { label: '其他', icon: '🏦', color: '#868e96', defaultDirection: 'asset' },
}

export const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).map(([value, meta]) => ({
  value: value as AccountType,
  ...meta,
}))

/**
 * 分类可选色板 —— 已通过 dataviz 六项校验（light 模式、全对比较）：
 * 亮度带 / 色度下限 / 正常视觉区分度全部 PASS，CVD 区分度在合法区间内
 * （图表侧配合：2px 分段间隙 + 直接标签 + 排行列表做次级编码）。
 * 固定顺序使用，不循环生成新色。
 */
export const COLOR_PALETTE = ['#e8890c', '#339af0', '#845ef7', '#0ca678', '#d6454e']

/** 「其他」专用中性灰：语义固定，不参与调色板轮换 */
export const COLOR_OTHER = '#9aa1ad'

/** 图标选择器的 emoji 候选集 */
export const EMOJI_CHOICES = [
  '🍜', '🍚', '🍱', '🥟', '🍲', '🍿', '🧋', '☕', '🍺', '🍎',
  '🚌', '🚕', '🚇', '⛽', '🅿️', '🚄', '✈️', '🚲',
  '🛒', '👕', '💄', '📷', '🧻', '🛍️',
  '🏠', '💡', '🔥', '🧹', '🛠️',
  '🎮', '🎬', '⚽', '🧳', '🎵', '🏋️', '🎨',
  '💊', '🏥', '🩺',
  '📚', '📖', '🎓', '✏️',
  '🧧', '🎁', '🍻', '💐',
  '📱', '📞', '📡',
  '💼', '🏦', '💰', '💹', '📊', '📈', '🪙', '💎',
  '🐱', '🐶', '🌱', '📦',
]

/** 预算周期文案 */
export const BUDGET_PERIOD_LABELS = { monthly: '每月', yearly: '每年' } as const
