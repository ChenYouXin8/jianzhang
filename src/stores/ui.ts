import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_QUICK_ENTRY } from '@/db/seed'
import { getSetting, setSetting } from '@/db/repositories/settings'
import type { TxType } from '@/types'

/** 「复记」预填草稿：从最近记录/账单列表点击触发 */
export interface QuickEntryDraft {
  type?: TxType
  amount?: string
  accountId?: string
  toAccountId?: string
  categoryId?: string
  date?: string
  note?: string
}

interface QuickEntryMemory {
  type: TxType
  accountId: string
  categoryByType: Partial<Record<'expense' | 'income', string>>
}

/**
 * UI 状态 store：跨页面轻量状态与「上次使用」持久化记忆。
 * 业务数据一律在 ledger store，这里不放任何账本数据。
 */
export const useUiStore = defineStore('ui', () => {
  /** 快速记账「上次使用」：账户与各类型分类，写进 settings 表持久化 */
  const last = ref<QuickEntryMemory>({ ...DEFAULT_QUICK_ENTRY })

  async function initMemory(): Promise<void> {
    last.value = await getSetting('quickEntry', DEFAULT_QUICK_ENTRY)
  }

  async function rememberLast(patch: Partial<QuickEntryMemory>): Promise<void> {
    last.value = { ...last.value, ...patch }
    await setSetting('quickEntry', last.value)
  }

  /** 复记草稿：seq 每次 +1，面板 watch seq 后消费草稿 */
  const draft = ref<QuickEntryDraft | null>(null)
  const draftSeq = ref(0)

  function requestPrefill(d: QuickEntryDraft): void {
    draft.value = d
    draftSeq.value++
  }

  function clearDraft(): void {
    draft.value = null
  }

  return { last, initMemory, rememberLast, draft, draftSeq, requestPrefill, clearDraft }
})
