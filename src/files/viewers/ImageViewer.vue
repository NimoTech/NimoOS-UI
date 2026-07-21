<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import ViewerShell from './ViewerShell.vue'
import { filterImages, imageIndex } from './imageNav'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()

const items = filterImages(props.list.length ? props.list : [props.item])
const index = ref(imageIndex(items, props.item))
const current = computed(() => items[index.value] ?? props.item)
const src = computed(() => service.file.fileUrl(current.value.path))

// —— 变换状态(自实现 缩放/旋转/平移,取代 viewerjs inline)——
const scale = ref(1) // 交互增量倍数(落盘后归 1)
const committedZoom = ref(1) // 已落盘总倍数;有效倍数 = committedZoom × scale
const committedW = ref<number | null>(null)
const committedH = ref<number | null>(null)
const suppressTransition = ref(false)
const rotation = ref(0)
const tx = ref(0)
const ty = ref(0)
const imgEl = ref<HTMLImageElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const imgStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  ...(committedW.value !== null && committedH.value !== null
    ? { width: `${committedW.value}px`, height: `${committedH.value}px`, maxWidth: 'none', maxHeight: 'none' }
    : {}),
  ...(suppressTransition.value ? { transition: 'none' } : {}),
}))

// —— 停手落盘:缩放停止 150ms 后把倍数烙进布局尺寸,强制按最终倍数重画 ——
// 合成器快路径拉伸缓存瓷砖会在砖缝处露 1px 细线(瓦线);重画路径逐砖从原图采样,
// 无缝且比拉伸态更锐。交互中仍走 transform 快路径保流畅,缝只可能一闪而过。
const COMMIT_DELAY = 150
let commitTimer: ReturnType<typeof setTimeout> | null = null
let suppressTimer: ReturnType<typeof setTimeout> | null = null
function scheduleCommit() {
  if (commitTimer) clearTimeout(commitTimer)
  commitTimer = setTimeout(commitZoom, COMMIT_DELAY)
}
function commitZoom() {
  commitTimer = null
  const el = imgEl.value
  if (!el || scale.value === 1) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (!w || !h) return // 图未加载完(布局尺寸为 0),跳过本次落盘
  committedW.value = Math.round(w * scale.value)
  committedH.value = Math.round(h * scale.value)
  committedZoom.value *= scale.value
  scale.value = 1
  // 落盘帧 scale N→1 会被 transition 动画化而宽高瞬变 —— 暂禁过渡,过渡时长后恢复
  suppressTransition.value = true
  if (suppressTimer) clearTimeout(suppressTimer)
  suppressTimer = setTimeout(() => { suppressTransition.value = false; suppressTimer = null }, 50)
}

function resetTransform() {
  if (commitTimer) { clearTimeout(commitTimer); commitTimer = null }
  scale.value = 1; committedZoom.value = 1
  committedW.value = null; committedH.value = null
  rotation.value = 0; tx.value = 0; ty.value = 0
}
function setZoom(effective: number) {
  const clamped = Math.min(Math.max(effective, 0.1), 8)
  scale.value = clamped / committedZoom.value
  scheduleCommit()
}
function zoomIn() { setZoom(committedZoom.value * scale.value + 0.1) }
function zoomOut() { setZoom(committedZoom.value * scale.value - 0.1) }
function rotate() { rotation.value += 90 }
function onWheel(e: WheelEvent) { e.deltaY < 0 ? zoomIn() : zoomOut() }

// 换图(翻页)时复位变换
watch(index, resetTransform)

// —— 拖拽平移 ——
let dragging = false
let startX = 0
let startY = 0
let baseX = 0
let baseY = 0

// 平移夹边界:图片任何时候至少留 PAN_KEEP px 在可视区内,拖不丢。
// 无布局信息(图未加载/测试环境)时不夹。
const PAN_KEEP = 48
function clampPan() {
  const stage = stageEl.value
  const el = imgEl.value
  if (!stage || !el) return
  const W = stage.clientWidth
  const H = stage.clientHeight
  let w = el.offsetWidth * scale.value
  let h = el.offsetHeight * scale.value
  if (!W || !H || !w || !h) return
  if (rotation.value % 180 !== 0) [w, h] = [h, w] // 旋转 90/270°:可视宽高互换
  const mx = (W + w) / 2 - Math.min(PAN_KEEP, w / 2)
  const my = (H + h) / 2 - Math.min(PAN_KEEP, h / 2)
  tx.value = Math.min(Math.max(tx.value, -mx), mx)
  ty.value = Math.min(Math.max(ty.value, -my), my)
}

function onPointerDown(e: PointerEvent) {
  // 工具栏按钮的 pointerdown 会冒泡到舞台;若在此 setPointerCapture,指针被舞台
  // 捕获后 click 不再派发给按钮,整排工具栏点击失效 —— 起于工具栏的按下直接放行。
  if ((e.target as HTMLElement).closest('.img-toolbar')) return
  dragging = true
  startX = e.clientX; startY = e.clientY; baseX = tx.value; baseY = ty.value
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  // 窗口外松手时 pointerup 可能丢失,dragging 卡 true,图片会"粘"在指针上 —— 按键已松即自愈
  if (e.pointerType === 'mouse' && e.buttons === 0) { dragging = false; return }
  tx.value = baseX + (e.clientX - startX)
  ty.value = baseY + (e.clientY - startY)
  clampPan()
}
function onPointerUp() { dragging = false }

// —— 翻页 ——
const disablePrev = computed(() => index.value === 0)
const disableNext = computed(() => index.value === items.length - 1)
function prev() { if (index.value > 0) index.value-- }
function next() { if (index.value < items.length - 1) index.value++ }

// —— 工具栏 5s 无操作自动隐藏(忠于 Vue2)——
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove() {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isMoving.value = false; hideTimer = null }, 5000)
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'ArrowRight') next()
  else if (e.code === 'ArrowLeft') prev()
}
onMounted(() => { window.addEventListener('keyup', onKey); onMouseMove() })
onBeforeUnmount(() => {
  window.removeEventListener('keyup', onKey)
  if (hideTimer) clearTimeout(hideTimer)
  if (commitTimer) clearTimeout(commitTimer)
  if (suppressTimer) clearTimeout(suppressTimer)
})
</script>

<template>
  <ViewerShell :title="current.name" downloadable @close="emit('close')" @download="emit('download', current)">
    <div
      ref="stageEl"
      class="img-stage"
      @mousemove="onMouseMove"
      @touchmove="onMouseMove"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
      @dragstart.prevent
    >
      <img ref="imgEl" class="img-el" :src="src" :style="imgStyle" alt="" draggable="false" />

      <div v-if="isMoving" class="img-toolbar">
        <button type="button" class="tb-item" :class="{ disabled: disablePrev }" @click="prev">{{ t('filesViewerPrev') }}</button>
        <button type="button" class="tb-item" @click="zoomIn">{{ t('filesViewerZoomIn') }}</button>
        <button type="button" class="tb-item" @click="rotate">{{ t('filesViewerRotate') }}</button>
        <button type="button" class="tb-item" @click="resetTransform">{{ t('filesViewerReset') }}</button>
        <button type="button" class="tb-item" @click="zoomOut">{{ t('filesViewerZoomOut') }}</button>
        <button type="button" class="tb-item" :class="{ disabled: disableNext }" @click="next">{{ t('filesViewerNext') }}</button>
      </div>
    </div>
  </ViewerShell>
</template>

<style scoped>
.img-stage {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
  /* 舞台内禁止选区:选区可绕过 draggable=false 触发原生拖放(幽灵图+禁止光标) */
  user-select: none;
  /* 棋盘格透明底(忠于 Vue2) */
  background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 16 16'%3E%3Cpath fill='%23ccc' d='M8 6.5A1.5 1.5 0 1 0 8 9.5A1.5 1.5 0 1 0 8 6.5z' fill-opacity='0.1'/%3E%3C/svg%3E");
  background-repeat: repeat;
}
.img-stage:active { cursor: grabbing; }
.img-el {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transition: transform 0.05s linear;
  /* 勿加 will-change: transform —— 大图被固定成合成层后,缩放只拉伸旧瓦片不重绘,
     瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */
}
.img-toolbar {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--popup-bg);
  backdrop-filter: var(--blur);
}
.tb-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 6px;
}
.tb-item:hover { background: var(--tool-bg-hi); }
.tb-item.disabled { opacity: 0.35; pointer-events: none; }
</style>
