import type { Account, Category } from '@/types'
import { COLOR_OTHER } from '@/utils/constants'
import { db } from './database'

/**
 * 首次启动种子数据：内置分类 + 默认账户 + 默认设置。
 * 目标：用户安装后无需任何配置即可记第一笔账（空状态引导的关键）。
 *
 * 分类配色：使用校验过的 5 色调色板（见 utils/constants）：
 * 高频分类（餐饮/交通/购物/居住/娱乐）分配互不相同的色相；
 * 低频分类循环复用——识别主要靠 emoji 图标 + 名称，颜色为辅助编码。
 * 「其他」类固定用中性灰。
 */

/** 内置分类使用固定 id：便于代码与数据中引用，也保证重复执行幂等 */
interface SeedChild {
  id: string
  name: string
  icon: string
}
interface SeedCategory {
  id: string
  name: string
  icon: string
  color: string
  children?: SeedChild[]
}

const EXPENSE_SEED: SeedCategory[] = [
  {
    id: 'c-exp-food',
    name: '餐饮',
    icon: '🍜',
    color: '#e8890c',
    children: [
      { id: 'c-exp-food-1', name: '早餐', icon: '🥟' },
      { id: 'c-exp-food-2', name: '午餐', icon: '🍱' },
      { id: 'c-exp-food-3', name: '晚餐', icon: '🍲' },
      { id: 'c-exp-food-4', name: '外卖', icon: '🥡' },
      { id: 'c-exp-food-5', name: '零食', icon: '🍿' },
      { id: 'c-exp-food-6', name: '饮品', icon: '🧋' },
    ],
  },
  {
    id: 'c-exp-transport',
    name: '交通',
    icon: '🚌',
    color: '#339af0',
    children: [
      { id: 'c-exp-transport-1', name: '公交地铁', icon: '🚇' },
      { id: 'c-exp-transport-2', name: '打车', icon: '🚕' },
      { id: 'c-exp-transport-3', name: '加油', icon: '⛽' },
      { id: 'c-exp-transport-4', name: '停车', icon: '🅿️' },
      { id: 'c-exp-transport-5', name: '火车', icon: '🚄' },
      { id: 'c-exp-transport-6', name: '飞机', icon: '✈️' },
    ],
  },
  {
    id: 'c-exp-shopping',
    name: '购物',
    icon: '🛒',
    color: '#845ef7',
    children: [
      { id: 'c-exp-shopping-1', name: '日用百货', icon: '🧻' },
      { id: 'c-exp-shopping-2', name: '服饰鞋包', icon: '👕' },
      { id: 'c-exp-shopping-3', name: '数码电器', icon: '📷' },
      { id: 'c-exp-shopping-4', name: '美妆护肤', icon: '💄' },
      { id: 'c-exp-shopping-5', name: '超市', icon: '🛍️' },
    ],
  },
  {
    id: 'c-exp-housing',
    name: '居住',
    icon: '🏠',
    color: '#0ca678',
    children: [
      { id: 'c-exp-housing-1', name: '房租', icon: '🏢' },
      { id: 'c-exp-housing-2', name: '水电燃气', icon: '💡' },
      { id: 'c-exp-housing-3', name: '物业', icon: '🧹' },
      { id: 'c-exp-housing-4', name: '家居维修', icon: '🛠️' },
    ],
  },
  {
    id: 'c-exp-fun',
    name: '娱乐',
    icon: '🎮',
    color: '#d6454e',
    children: [
      { id: 'c-exp-fun-1', name: '电影演出', icon: '🎬' },
      { id: 'c-exp-fun-2', name: '游戏', icon: '🎮' },
      { id: 'c-exp-fun-3', name: '运动健身', icon: '🏋️' },
      { id: 'c-exp-fun-4', name: '旅行度假', icon: '🧳' },
    ],
  },
  {
    id: 'c-exp-medical',
    name: '医疗',
    icon: '💊',
    color: '#e8890c',
    children: [
      { id: 'c-exp-medical-1', name: '门诊', icon: '🏥' },
      { id: 'c-exp-medical-2', name: '买药', icon: '💊' },
      { id: 'c-exp-medical-3', name: '体检', icon: '🩺' },
    ],
  },
  {
    id: 'c-exp-education',
    name: '教育',
    icon: '📚',
    color: '#339af0',
    children: [
      { id: 'c-exp-education-1', name: '课程', icon: '📖' },
      { id: 'c-exp-education-2', name: '书籍', icon: '📕' },
      { id: 'c-exp-education-3', name: '学费', icon: '🎓' },
    ],
  },
  {
    id: 'c-exp-social',
    name: '人情',
    icon: '🎁',
    color: '#845ef7',
    children: [
      { id: 'c-exp-social-1', name: '红包', icon: '🧧' },
      { id: 'c-exp-social-2', name: '礼物', icon: '🎁' },
      { id: 'c-exp-social-3', name: '请客', icon: '🍻' },
    ],
  },
  {
    id: 'c-exp-comm',
    name: '通讯',
    icon: '📱',
    color: '#0ca678',
    children: [
      { id: 'c-exp-comm-1', name: '话费', icon: '📞' },
      { id: 'c-exp-comm-2', name: '宽带', icon: '📡' },
    ],
  },
  { id: 'c-exp-other', name: '其他', icon: '📦', color: COLOR_OTHER },
]

const INCOME_SEED: SeedCategory[] = [
  {
    id: 'c-inc-salary',
    name: '工资',
    icon: '💼',
    color: '#0ca678',
    children: [
      { id: 'c-inc-salary-1', name: '月薪', icon: '🏦' },
      { id: 'c-inc-salary-2', name: '奖金', icon: '🏆' },
      { id: 'c-inc-salary-3', name: '报销', icon: '🧾' },
    ],
  },
  {
    id: 'c-inc-invest',
    name: '理财',
    icon: '📈',
    color: '#339af0',
    children: [
      { id: 'c-inc-invest-1', name: '利息', icon: '💹' },
      { id: 'c-inc-invest-2', name: '基金', icon: '📊' },
      { id: 'c-inc-invest-3', name: '股票', icon: '📈' },
      { id: 'c-inc-invest-4', name: '分红', icon: '💰' },
    ],
  },
  { id: 'c-inc-parttime', name: '兼职', icon: '💻', color: '#845ef7' },
  { id: 'c-inc-redpacket', name: '红包', icon: '🧧', color: '#d6454e' },
  { id: 'c-inc-refund', name: '退款', icon: '↩️', color: '#e8890c' },
  { id: 'c-inc-other', name: '其他收入', icon: '💰', color: COLOR_OTHER },
]

function buildCategories(): Category[] {
  const now = Date.now()
  const list: Category[] = []
  const push = (
    type: 'expense' | 'income',
    seed: SeedCategory,
    parentId: string | null,
    sortOrder: number,
  ) => {
    list.push({
      id: seed.id,
      type,
      name: seed.name,
      icon: seed.icon,
      color: seed.color,
      parentId,
      enabled: true,
      isSystem: true,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
  }
  for (const [i, seed] of EXPENSE_SEED.entries()) {
    push('expense', seed, null, (i + 1) * 10)
    for (const [j, child] of (seed.children ?? []).entries()) {
      // 子分类继承父分类颜色，保证一级聚合图表色彩一致
      push('expense', { ...child, color: seed.color }, seed.id, (i + 1) * 10 + j + 1)
    }
  }
  for (const [i, seed] of INCOME_SEED.entries()) {
    push('income', seed, null, (i + 1) * 10)
    for (const [j, child] of (seed.children ?? []).entries()) {
      push('income', { ...child, color: seed.color }, seed.id, (i + 1) * 10 + j + 1)
    }
  }
  return list
}

function buildAccounts(): Account[] {
  const now = Date.now()
  const base = {
    currency: 'CNY',
    initialBalance: 0,
    includeInNetWorth: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  return [
    { id: 'a-cash', name: '现金', type: 'cash', balanceDirection: 'asset', icon: '💵', color: '#0fa968', sortOrder: 1, ...base },
    { id: 'a-debit', name: '储蓄卡', type: 'debit', balanceDirection: 'asset', icon: '💳', color: '#339af0', sortOrder: 2, ...base },
    { id: 'a-credit', name: '信用卡', type: 'credit', balanceDirection: 'liability', icon: '💳', color: '#845ef7', sortOrder: 3, ...base },
  ]
}

/** 快速记账面板的默认选项（每记一笔后自动更新为「上次使用」） */
export const DEFAULT_QUICK_ENTRY = {
  type: 'expense' as const,
  accountId: 'a-cash',
  categoryByType: { expense: 'c-exp-food', income: 'c-inc-salary' },
}

/**
 * 首次启动初始化：空库时写入种子数据；设置项幂等写入。
 * 在应用 ready 前调用一次（见 stores/ledger.ts 的 init()）。
 */
export async function seedIfEmpty(): Promise<void> {
  const [catCount, accCount] = await Promise.all([db.categories.count(), db.accounts.count()])
  if (catCount === 0) await db.categories.bulkAdd(buildCategories())
  if (accCount === 0) await db.accounts.bulkAdd(buildAccounts())
  const quickEntry = await db.settings.get('quickEntry')
  if (!quickEntry) await db.settings.put({ key: 'quickEntry', value: DEFAULT_QUICK_ENTRY })
}
