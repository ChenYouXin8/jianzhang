<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { showConfirmDialog, showSuccessToast } from 'vant'
import { useRouter } from 'vue-router'
import CategoryIcon from '@/components/common/CategoryIcon.vue'
import { useLedgerStore } from '@/stores/ledger'
import type { Account, AccountType, BalanceDirection } from '@/types'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_OPTIONS, COLOR_PALETTE, EMOJI_CHOICES } from '@/utils/constants'
import { centsToYuan, formatCents, yuanToCents } from '@/utils/money'

/**
 * 账户管理：余额实时聚合展示；支持初始余额、负债方向（信用卡）、
 * 是否计入总资产、图标/颜色自定义；有流水的账户只能归档不能删除。
 */
const ledger = useLedgerStore()
const router = useRouter()

const activeAccounts = computed(() => ledger.accounts.filter((a) => !a.archived))
const archivedAccounts = computed(() => ledger.accounts.filter((a) => a.archived))

/* ---------------- 表单弹层 ---------------- */
interface FormState {
  id: string | null
  name: string
  type: AccountType
  initialBalance: string
  direction: BalanceDirection
  includeInNetWorth: boolean
  icon: string
  color: string
}

const showForm = ref(false)
const showIconPicker = ref(false)
const showTypePicker = ref(false)
const form = reactive<FormState>({
  id: null,
  name: '',
  type: 'cash',
  initialBalance: '',
  direction: 'asset',
  includeInNetWorth: true,
  icon: '💵',
  color: '#0fa968',
})

function openCreate() {
  Object.assign(form, {
    id: null,
    name: '',
    type: 'cash',
    initialBalance: '',
    direction: 'asset',
    includeInNetWorth: true,
    icon: ACCOUNT_TYPES.cash.icon,
    color: ACCOUNT_TYPES.cash.color,
  })
  showForm.value = true
}

function openEdit(a: Account) {
  Object.assign(form, {
    id: a.id,
    name: a.name,
    type: a.type,
    initialBalance: a.initialBalance ? centsToYuan(a.initialBalance) : '',
    direction: a.balanceDirection,
    includeInNetWorth: a.includeInNetWorth,
    icon: a.icon,
    color: a.color,
  })
  showForm.value = true
}

/** 切换账户类型时，负债方向跟随类型默认值 */
function onTypeChange(type: AccountType) {
  form.type = type
  form.direction = ACCOUNT_TYPES[type].defaultDirection
  if (!form.name && !form.id) form.icon = ACCOUNT_TYPES[type].icon
  if (!form.id) form.color = ACCOUNT_TYPES[type].color
}

async function saveForm() {
  if (!form.name.trim()) {
    showSuccessToast('请填写账户名称')
    return
  }
  const initialBalance = form.initialBalance ? (yuanToCents(form.initialBalance) ?? 0) : 0
  const payload = {
    name: form.name.trim(),
    type: form.type,
    currency: 'CNY',
    initialBalance,
    balanceDirection: form.direction,
    includeInNetWorth: form.includeInNetWorth,
    icon: form.icon,
    color: form.color,
    archived: false,
    sortOrder: ledger.accounts.length + 1,
  }
  if (form.id) {
    await ledger.editAccount(form.id, payload)
    showSuccessToast('已保存')
  } else {
    await ledger.addAccount(payload)
    showSuccessToast('已添加')
  }
  showForm.value = false
}

/* ---------------- 删除 / 归档 ---------------- */
async function removeAccount(a: Account) {
  const ok = await ledger.removeAccount(a.id)
  if (ok) {
    showSuccessToast('已删除')
    return
  }
  // 有流水引用：引导归档而非物理删除
  await showConfirmDialog({
    title: '无法删除',
    message: '该账户存在历史账单，不能直接删除。建议归档：归档后不再出现在记账与统计中，历史账单保留。',
    confirmButtonText: '归档',
    cancelButtonText: '取消',
  })
  await ledger.editAccount(a.id, { archived: true })
  showSuccessToast('已归档')
}

async function restoreAccount(a: Account) {
  await ledger.editAccount(a.id, { archived: false })
  showSuccessToast('已恢复')
}

/** 表单内删除：有流水引用时走归档引导 */
async function deleteFromForm() {
  const id = form.id
  if (!id) return
  const account = ledger.accounts.find((a) => a.id === id)
  showForm.value = false
  if (account) await removeAccount(account)
}
</script>

<template>
  <main class="accounts-page">
    <van-nav-bar title="账户管理" left-arrow @click-left="router.back()" />

    <div class="page">
      <div v-if="activeAccounts.length" class="account-list card" data-testid="account-list">
        <button
          v-for="a in activeAccounts"
          :key="a.id"
          class="account-row"
          :data-testid="`account-${a.id}`"
          @click="openEdit(a)"
        >
          <CategoryIcon :icon="a.icon" :color="a.color" :size="40" />
          <span class="account-meta">
            <span class="account-name">
              {{ a.name }}
              <van-tag v-if="a.balanceDirection === 'liability'" type="warning" plain>负债</van-tag>
            </span>
            <span class="account-type">{{ ACCOUNT_TYPES[a.type].label }}</span>
          </span>
          <span class="account-balance num">
            {{ formatCents(ledger.balanceOf(a.id)) }}
            <span v-if="a.balanceDirection === 'liability'" class="owe-label">
              {{ ledger.balanceOf(a.id) >= 0 ? '欠款' : '溢缴' }}
            </span>
          </span>
          <van-icon name="arrow" class="chevron" />
        </button>
      </div>

      <button class="add-btn tap-target" data-testid="account-add" @click="openCreate">
        <van-icon name="plus" /> 添加账户
      </button>

      <section v-if="archivedAccounts.length" class="archived">
        <h3 class="archived-title">已归档</h3>
        <div class="card">
          <button
            v-for="a in archivedAccounts"
            :key="a.id"
            class="account-row"
            :data-testid="`archived-${a.id}`"
            @click="restoreAccount(a)"
          >
            <CategoryIcon :icon="a.icon" :color="a.color" :size="32" />
            <span class="account-name">{{ a.name }}</span>
            <span class="restore-label">恢复</span>
          </button>
        </div>
      </section>
    </div>

    <!-- 账户表单弹层 -->
    <van-popup v-model:show="showForm" position="bottom" round>
      <div class="form-panel" data-testid="account-form">
        <h3 class="form-title">{{ form.id ? '编辑账户' : '添加账户' }}</h3>

        <van-field v-model="form.name" label="名称" placeholder="如：工资卡" data-testid="account-name" />
        <van-field
          :model-value="ACCOUNT_TYPES[form.type].label"
          readonly
          is-link
          label="类型"
          data-testid="account-type"
          @click="showTypePicker = true"
        />
        <van-field
          v-model="form.initialBalance"
          type="digit"
          label="初始余额"
          placeholder="0.00"
          data-testid="account-balance-input"
        />
        <van-cell title="负债账户" label="余额表示欠款（如信用卡）">
          <template #right-icon>
            <van-switch
              :model-value="form.direction === 'liability'"
              size="20"
              @update:model-value="form.direction = $event ? 'liability' : 'asset'"
            />
          </template>
        </van-cell>
        <van-cell title="计入总资产">
          <template #right-icon>
            <van-switch v-model="form.includeInNetWorth" size="20" />
          </template>
        </van-cell>
        <van-field
          :model-value="form.icon"
          readonly
          is-link
          label="图标"
          data-testid="account-icon"
          @click="showIconPicker = true"
        />
        <div class="color-row">
          <span class="color-label">颜色</span>
          <button
            v-for="c in [...COLOR_PALETTE, '#9aa1ad']"
            :key="c"
            class="swatch"
            :class="{ active: form.color === c }"
            :style="{ backgroundColor: c }"
            :aria-label="`颜色 ${c}`"
            @click="form.color = c"
          />
        </div>

        <div class="form-actions">
          <van-button
            v-if="form.id"
            plain
            type="danger"
            size="small"
            data-testid="account-delete"
            @click="deleteFromForm"
          >
            删除
          </van-button>
          <van-button type="primary" size="small" data-testid="account-save" @click="saveForm">
            保存
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 类型 / 图标选择 -->
    <van-popup v-model:show="showTypePicker" position="bottom" round>
      <van-picker
        :columns="ACCOUNT_TYPE_OPTIONS.map((o) => ({ text: `${o.icon} ${o.label}`, value: o.value }))"
        @confirm="({ selectedOptions }) => { onTypeChange(selectedOptions[0]?.value as AccountType); showTypePicker = false }"
        @cancel="showTypePicker = false"
      />
    </van-popup>
    <van-popup v-model:show="showIconPicker" position="bottom" round>
      <div class="emoji-panel">
        <button
          v-for="e in EMOJI_CHOICES"
          :key="e"
          class="emoji-cell"
          :class="{ active: form.icon === e }"
          @click="form.icon = e; showIconPicker = false"
        >
          {{ e }}
        </button>
      </div>
    </van-popup>
  </main>
</template>

<style scoped>
.accounts-page {
  min-height: 100vh;
  background: var(--color-bg);
}
.account-list {
  padding: 0 12px;
}
.account-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 62px;
  padding: 10px 0;
  text-align: left;
}
.account-row + .account-row {
  border-top: 1px solid var(--color-border);
}
.account-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.account-name {
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.account-type {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.account-balance {
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}
.owe-label {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-tertiary);
}
.chevron {
  color: var(--color-text-tertiary);
  font-size: 12px;
}
.add-btn {
  width: 100%;
  margin-top: 12px;
  padding: 12px 0;
  border-radius: 12px;
  background: var(--color-card);
  color: var(--color-primary-deep);
  font-size: 14px;
  gap: 4px;
}
.archived {
  margin-top: 16px;
}
.archived-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.restore-label {
  margin-left: auto;
  font-size: 13px;
  color: var(--color-primary-deep);
}
.form-panel {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  max-height: 85vh;
  overflow-y: auto;
}
.form-title {
  margin: 0 0 8px;
  font-size: 16px;
  text-align: center;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
}
.color-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
}
.swatch.active {
  border-color: var(--color-text);
}
.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
}
.emoji-panel {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
}
.emoji-cell {
  font-size: 22px;
  padding: 6px;
  border-radius: 8px;
}
.emoji-cell.active {
  background: var(--color-primary-soft);
}
</style>
