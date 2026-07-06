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
const scale = ref(1)
const rotation = ref(0)
const tx = ref(0)
const ty = ref(0)
const imgStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
}))
function resetTransform() { scale.value = 1; rotation.value = 0; tx.value = 0; ty.value = 0 }
function zoomIn() { scale.value = Math.min(scale.value + 0.1, 8) }
function zoomOut() { scale.value = Math.max(scale.value - 0.1, 0.1) }
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
function onPointerDown(e: PointerEvent) {
  dragging = true
  startX = e.clientX; startY = e.clientY; baseX = tx.value; baseY = ty.value
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  tx.value = baseX + (e.clientX - startX)
  ty.value = baseY + (e.clientY - startY)
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
onBeforeUnmount(() => { window.removeEventListener('keyup', onKey); if (hideTimer) clearTimeout(hideTimer) })
</script>

<template>
  <ViewerShell :title="current.name" downloadable @close="emit('close')" @download="emit('download', current)">
    <div
      class="img-stage"
      @mousemove="onMouseMove"
      @touchmove="onMouseMove"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <img class="img-el" :src="src" :style="imgStyle" alt="" draggable="false" />

      <div v-if="isMoving" class="img-toolbar">
        <button type="button" class="tb-item" :class="{ disabled: disablePrev }" :title="t('filesViewerPrev')" @click="prev">‹</button>
        <button type="button" class="tb-item" :title="t('filesViewerZoomIn')" @click="zoomIn">＋</button>
        <button type="button" class="tb-item" :title="t('filesViewerRotate')" @click="rotate">⟳</button>
        <button type="button" class="tb-item" :title="t('filesViewerReset')" @click="resetTransform">⤢</button>
        <button type="button" class="tb-item" :title="t('filesViewerZoomOut')" @click="zoomOut">－</button>
        <button type="button" class="tb-item" :class="{ disabled: disableNext }" :title="t('filesViewerNext')" @click="next">›</button>
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
  will-change: transform;
}
.img-toolbar {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgb(49, 49, 54);
}
.tb-item {
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  border-radius: 6px;
}
.tb-item:hover { background: rgba(255, 255, 255, 0.15); }
.tb-item.disabled { opacity: 0.35; pointer-events: none; }
</style>
