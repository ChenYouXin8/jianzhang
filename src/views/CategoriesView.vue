<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { showConfirmDialog, showSuccessToast } from 'vant'
import { useRouter } from 'vue-router'
import CategoryIcon from '@/components/common/CategoryIcon.vue'
import { useLedgerStore } from '@/stores/ledger'
import type { Category } from '@/types'
import { COLOR_OTHER, COLOR_PALETTE, EMOJI_CHOICES } from '@/utils/constants'

/**
 * 分类管理：支出/收入两个 Tab，两级分类。
 * - 内置分类（isSystem）不可删除，仅可禁用；
 * - 有账单引用的分类不可删除，仅可禁用（口径与账户归档一致）；
 * - 排序：进入排序模式后用 ↑↓ 交换相邻同级分类的 sortOrder。
 */
const ledger = useLedgerStore()
const router = useRouter()

const tab = ref<'expense' | 'income'>('expense')
const sortMode = ref(false)
const showForm = ref(false)
const showIconPicker = ref(false)
const showParentPicker = ref(false)

const topList = computed(() => ledger.categories.filter((c) => c.type === tab.value && !c.parentId))
const childrenOf = (parentId: string) =>
  ledger.categories.filter((c) => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)

/* ---------------- 禁用 / 删除 ---------------- */
async function toggleEnabled(c: Category) {
  await ledger.editCategory(c.id, { enabled: !c.enabled })
}

async function removeCategory(c: Category) {
  if (c.isSystem) {
    showSuccessToast('内置分类不可删除，可禁用')
    return
  }
  if (ledger.categoryUsage(c.id) > 0) {
    await showConfirmDialog({
      title: '无法删除',
      message: '该分类已被账单使用，不能删除。建议禁用：禁用后不再出现在记账选择中，历史账单保留。',
      confirmButtonText: '禁用',
      cancelButtonText: '取消',
    })
    await ledger.editCategory(c.id, { enabled: false })
    showSuccessToast('已禁用')
    return
  }
  await showConfirmDialog({ title: '删除分类', message: `确定删除「${c.name}」吗？` })
  await ledger.removeCategory(c.id)
  showSuccessToast('已删除')
}

/* ---------------- 排序（同级交换 sortOrder） ---------------- */
function siblingsOf(c: Category): Category[] {
  return ledger.categories
    .filter((s) => s.parentId === c.parentId && s.type === c.type)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

async function move(c: Category, dir: -1 | 1) {
  const siblings = siblingsOf(c)
  const idx = siblings.findIndex((s) => s.id === c.id)
  const target = siblings[idx + dir]
  if (!target) return
  await ledger.editCategory(c.id, { sortOrder: target.sortOrder })
  await ledger.editCategory(target.id, { sortOrder: c.sortOrder })
}

/* ---------------- 表单 ---------------- */
interface FormState {
  id: string | null
  type: 'expense' | 'income'
  name: string
  icon: string
  color: string
  parentId: string
}

const form = reactive<FormState>({
  id: null,
  type: 'expense',
  name: '',
  icon: '📦',
  color: COLOR_PALETTE[0],
  parentId: '',
})

const parentOptions = computed(() => [
  { text: '一级分类', value: '' },
  ...topList.value.map((c) => ({ text: c.name, value: c.id })),
])
const parentLabel = computed(
  () => parentOptions.value.find((o) => o.value === form.parentId)?.text ?? '一级分类',
)

function openCreate(type: 'expense' | 'income', parentId = '') {
  Object.assign(form, { id: null, type, name: '', icon: '📦', color: COLOR_PALETTE[0], parentId })
  showForm.value = true
}

function openEdit(c: Category) {
  Object.assign(form, {
    id: c.id,
    type: c.type,
    name: c.name,
    icon: c.icon,
    color: c.color,
    parentId: c.parentId ?? '',
  })
  showForm.value = true
}

async function saveForm() {
  if (!form.name.trim()) {
    showSuccessToast('请填写分类名称')
    return
  }
  const payload = {
    type: form.type,
    name: form.name.trim(),
    icon: form.icon,
    color: form.color,
    parentId: form.parentId || null,
    enabled: true,
    isSystem: false,
    sortOrder: form.id
      ? (ledger.categories.find((c) => c.id === form.id)?.sortOrder ?? 1)
      : ledger.categories.length + 1,
  }
  if (form.id) {
    await ledger.editCategory(form.id, payload)
    showSuccessToast('已保存')
  } else {
    await ledger.addCategory(payload)
    showSuccessToast('已添加')
  }
  showForm.value = false
}
</script>

<template>
  <main class="categories-page">
    <van-nav-bar title="分类管理" left-arrow @click-left="router.back()">
      <template #right>
        <span class="nav-action" data-testid="sort-toggle" @click="sortMode = !sortMode">
          {{ sortMode ? '完成' : '排序' }}
        </span>
      </template>
    </van-nav-bar>

    <van-tabs v-model:active="tab">
      <van-tab title="支出" name="expense" />
      <van-tab title="收入" name="income" />
    </van-tabs>

    <div class="page cat-list">
      <section v-for="top in topList" :key="top.id" class="cat-group card">
        <header class="cat-top">
          <CategoryIcon :icon="top.icon" :color="top.color" :size="36" />
          <span class="cat-name">{{ top.name }}</span>
          <span v-if="!top.enabled" class="disabled-tag">已禁用</span>
          <span class="cat-actions">
            <button
              v-if="sortMode"
              class="move-btn tap-target"
              :aria-label="`${top.name}上移`"
              @click="move(top, -1)"
            >
              ↑
            </button>
            <button
              v-if="sortMode"
              class="move-btn tap-target"
              :aria-label="`${top.name}下移`"
              @click="move(top, 1)"
            >
              ↓
            </button>
            <van-switch :model-value="top.enabled" size="18" @update:model-value="toggleEnabled(top)" />
            <button class="icon-btn tap-target" aria-label="编辑" @click="openEdit(top)">
              <van-icon name="edit" />
            </button>
            <button
              v-if="!top.isSystem"
              class="icon-btn tap-target danger"
              aria-label="删除"
              @click="removeCategory(top)"
            >
              <van-icon name="delete-o" />
            </button>
          </span>
        </header>

        <div v-if="top.enabled && childrenOf(top.id).length" class="cat-children">
          <div v-for="child in childrenOf(top.id)" :key="child.id" class="child-row">
            <span class="child-icon">{{ child.icon }}</span>
            <span class="cat-name" :class="{ dim: !child.enabled }">{{ child.name }}</span>
            <span class="cat-actions">
              <button
                v-if="sortMode"
                class="move-btn tap-target"
                :aria-label="`${child.name}上移`"
                @click="move(child, -1)"
              >
                ↑
              </button>
              <button
                v-if="sortMode"
                class="move-btn tap-target"
                :aria-label="`${child.name}下移`"
                @click="move(child, 1)"
              >
                ↓
              </button>
              <van-switch :model-value="child.enabled" size="18" @update:model-value="toggleEnabled(child)" />
              <button class="icon-btn tap-target" aria-label="编辑" @click="openEdit(child)">
                <van-icon name="edit" />
              </button>
              <button
                v-if="!child.isSystem"
                class="icon-btn tap-target danger"
                aria-label="删除"
                @click="removeCategory(child)"
              >
                <van-icon name="delete-o" />
              </button>
            </span>
          </div>
        </div>
        <button v-if="!sortMode" class="add-child" data-testid="add-child" @click="openCreate(tab, top.id)">
          + 添加二级分类
        </button>
      </section>

      <button v-if="!sortMode" class="add-btn tap-target" data-testid="category-add" @click="openCreate(tab)">
        <van-icon name="plus" /> 添加一级分类
      </button>
    </div>

    <!-- 分类表单弹层 -->
    <van-popup v-model:show="showForm" position="bottom" round>
      <div class="form-panel" data-testid="category-form">
        <h3 class="form-title">{{ form.id ? '编辑分类' : '添加分类' }}</h3>
        <van-field v-model="form.name" label="名称" placeholder="分类名称" data-testid="category-name" />
        <van-field
          :model-value="parentLabel"
          readonly
          is-link
          label="所属"
          data-testid="category-parent"
          @click="showParentPicker = true"
        />
        <van-field
          :model-value="form.icon"
          readonly
          is-link
          label="图标"
          data-testid="category-icon"
          @click="showIconPicker = true"
        />
        <div class="color-row">
          <span class="color-label">颜色</span>
          <button
            v-for="c in [...COLOR_PALETTE, COLOR_OTHER]"
            :key="c"
            class="swatch"
            :class="{ active: form.color === c }"
            :style="{ backgroundColor: c }"
            :aria-label="`颜色 ${c}`"
            @click="form.color = c"
          />
        </div>
        <van-button block type="primary" data-testid="category-save" @click="saveForm">保存</van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showParentPicker" position="bottom" round>
      <van-picker
        :columns="parentOptions"
        @confirm="({ selectedOptions }) => { form.parentId = selectedOptions[0]?.value ?? ''; showParentPicker = false }"
        @cancel="showParentPicker = false"
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
.categories-page {
  min-height: 100vh;
  background: var(--color-bg);
}
.nav-action {
  font-size: 14px;
  color: var(--color-primary-deep);
  padding: 8px;
}
.cat-list {
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cat-group {
  padding: 0 12px;
}
.cat-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
}
.cat-name {
  font-size: 14px;
  flex: 1;
  min-width: 0;
}
.cat-name.dim {
  color: var(--color-text-tertiary);
}
.disabled-tag {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.cat-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.icon-btn {
  color: var(--color-text-secondary);
  font-size: 16px;
  border-radius: 50%;
  width: 32px;
  height: 32px;
}
.icon-btn.danger {
  color: var(--color-expense);
}
.move-btn {
  font-size: 14px;
  color: var(--color-primary-deep);
  border-radius: 8px;
}
.cat-children {
  border-top: 1px solid var(--color-border);
  padding: 4px 0 4px 12px;
}
.child-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.child-icon {
  font-size: 16px;
}
.add-child {
  display: block;
  width: 100%;
  padding: 8px 0 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  text-align: left;
  padding-left: 12px;
}
.add-btn {
  width: 100%;
  padding: 12px 0;
  border-radius: 12px;
  background: var(--color-card);
  color: var(--color-primary-deep);
  font-size: 14px;
  gap: 4px;
}
.form-panel {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
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
