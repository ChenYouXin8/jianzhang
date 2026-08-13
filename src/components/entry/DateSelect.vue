<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { dayHeaderLabel } from '@/utils/date'

/**
 * 日期选择行：默认今天；弹层日期选择器。
 * 允许预记未来日期（如明天要花的钱）；上限 2099-12-31。
 */
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const show = ref(false)
const maxDate = new Date(2099, 11, 31)

function onConfirm({ selectedValues }: { selectedValues: string[] }) {
  // van-date-picker 的 selectedValues 已是 ['YYYY','MM','DD']（月/日为 01-12 / 01-31）
  emit('update:modelValue', selectedValues.join('-'))
  show.value = false
}

/* ---------- 桌面兼容：列滑动（鼠标拖拽 + 滚轮） ----------
 * Vant 的选择器列只监听 touch 事件，桌面浏览器鼠标拖不动、滚轮无效，
 * 与数字键盘同理。这里把 mouse 的 pointer 拖拽和滚轮转译为合成 touch
 * 事件，桌面端也能流畅滑动选择；触摸设备由 pointerType 过滤，不受影响。
 */
const PICKER_COLUMN_SELECTOR = '.van-picker-column'

let dragging = false
let dragColumn: Element | null = null
let wheelColumn: Element | null = null
let wheelAccum = 0
let wheelTimer: number | undefined

function pickerColumnOf(target: Element | null): Element | null {
  return target ? target.closest(PICKER_COLUMN_SELECTOR) : null
}

/** 把 y 坐标转译为一次 Vant 可识别的 touch 事件（touches/changedTouches 按事件类型填充） */
function synthesizeTouch(col: Element, type: 'touchstart' | 'touchmove' | 'touchend', y: number): void {
  const touch = new Touch({
    identifier: 1,
    target: col,
    clientX: 0,
    clientY: y,
    pageX: 0,
    pageY: y,
    screenX: 0,
    screenY: y,
  })
  const init: TouchEventInit = { bubbles: true, cancelable: true }
  if (type === 'touchend') init.changedTouches = [touch]
  else init.touches = [touch]
  col.dispatchEvent(new TouchEvent(type, init))
}

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType !== 'mouse') return
  const col = pickerColumnOf(e.target as Element | null)
  if (!col) return
  // 记住按下列：指针拖出列边界后 target 会变成其他元素（甚至 html），
  // 后续 move/up 一律派发到按下时的列上
  dragging = true
  dragColumn = col
  synthesizeTouch(col, 'touchstart', e.clientY)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging || !dragColumn) return
  synthesizeTouch(dragColumn, 'touchmove', e.clientY)
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging) return
  dragging = false
  if (dragColumn) synthesizeTouch(dragColumn, 'touchend', e.clientY)
  dragColumn = null
}

/** 滚轮：累计 deltaY 合成 touch 序列，停止 350ms 后收尾（快速滚动自然带 Vant 惯性） */
function onWheel(e: WheelEvent): void {
  const col = pickerColumnOf(e.target as Element | null)
  if (!col) return
  e.preventDefault()
  if (wheelColumn !== col) {
    wheelColumn = col
    wheelAccum = 0
    synthesizeTouch(col, 'touchstart', 0)
  }
  wheelAccum += e.deltaY
  synthesizeTouch(col, 'touchmove', wheelAccum)
  window.clearTimeout(wheelTimer)
  wheelTimer = window.setTimeout(() => {
    if (wheelColumn) synthesizeTouch(wheelColumn, 'touchend', wheelAccum)
    wheelColumn = null
    wheelAccum = 0
  }, 350)
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerUp, true)
  document.addEventListener('wheel', onWheel, { capture: true, passive: false })
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('pointermove', onPointerMove, true)
  document.removeEventListener('pointerup', onPointerUp, true)
  document.removeEventListener('pointercancel', onPointerUp, true)
  document.removeEventListener('wheel', onWheel, { capture: true })
})
</script>

<template>
  <button class="date-select" data-testid="date-select" type="button" @click="show = true">
    <span class="label">日期</span>
    <span class="value">{{ dayHeaderLabel(modelValue) }}</span>
    <van-icon name="calendar-o" class="icon" />
  </button>

  <van-popup v-model:show="show" position="bottom" round>
    <van-date-picker
      :model-value="modelValue.split('-')"
      :min-date="new Date(2000, 0, 1)"
      :max-date="maxDate"
      title="选择日期"
      @confirm="onConfirm"
      @cancel="show = false"
    />
  </van-popup>
</template>

<style scoped>
.date-select {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 0;
}
.label {
  font-size: 14px;
  color: var(--color-text-secondary);
}
.value {
  font-size: 14px;
}
.icon {
  color: var(--color-text-tertiary);
}
</style>
