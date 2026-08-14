<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { browserCanDisplayImage } from '../util/browserCanDisplayImage'
import { mapOcrBoxesToRects } from './util/ocrHighlight'

const props = defineProps<{
  assetId: string | number
  mimeType: string
  ocrLines?: Array<{ box: number[] }>
}>()
const { t } = useI18n()

// HEIC/TIFF/RAW and other formats browsers can't natively decode fall back to transcoded large thumbnail (per Vue2 PhotosLightbox imageSrc)
const src = computed(() =>
  browserCanDisplayImage(props.mimeType)
    ? service.photos.originalUrl(props.assetId)
    : service.photos.thumbnailUrl(props.assetId, 'large'),
)

// —— Transform state (exact skeleton from files/viewers/ImageViewer.vue zoom/rotate/pan) ——
const scale = ref(1) // Interactive incremental multiplier (resets to 1 after commit)
const committedZoom = ref(1) // Total committed multiplier; effective multiplier = committedZoom × scale
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

// —— Commit on release: 150ms after zoom stops, burn multiplier into layout size, force redraw at final multiplier ——
// Compositor fast path stretches cached tiles, exposes 1px seams at tile edges (tile lines); redraw path samples each tile from source,
// seamless and sharper than stretched. Interaction still uses transform fast path for smoothness, seam only flickers briefly.
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
  if (!w || !h) return // Image not fully loaded (layout size is 0), skip this commit
  committedW.value = Math.round(w * scale.value)
  committedH.value = Math.round(h * scale.value)
  committedZoom.value *= scale.value
  scale.value = 1
  // Commit frame scale N→1 gets animated by transition causing width/height to snap — suppress transition, restore after duration
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

// Reset transform on image change + recompute OCR overlay (single image has no internal index, keyed by assetId)
watch(() => props.assetId, () => { resetTransform(); recomputeOcrRects() })

// —— Drag to pan ——
let dragging = false
let startX = 0
let startY = 0
let baseX = 0
let baseY = 0

// Pan clamping: image always keeps at least PAN_KEEP px visible in viewport, can't drag off completely.
// No clamping when no layout info (image not loaded / test environment).
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
  if (rotation.value % 180 !== 0) [w, h] = [h, w] // Rotated 90/270°: swap visible width and height
  const mx = (W + w) / 2 - Math.min(PAN_KEEP, w / 2)
  const my = (H + h) / 2 - Math.min(PAN_KEEP, h / 2)
  tx.value = Math.min(Math.max(tx.value, -mx), mx)
  ty.value = Math.min(Math.max(ty.value, -my), my)
}

function onPointerDown(e: PointerEvent) {
  // Toolbar button pointerdown bubbles to stage; if setPointerCapture here, after pointer captured by stage
  // click no longer dispatches to button, whole toolbar becomes unclickable — release pointerdown from toolbar directly.
  if ((e.target as HTMLElement).closest('.img-toolbar')) return
  dragging = true
  startX = e.clientX; startY = e.clientY; baseX = tx.value; baseY = ty.value
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  // Release outside window, pointerup might be lost, dragging stuck true, image "sticks" to pointer — clears when buttons released
  if (e.pointerType === 'mouse' && e.buttons === 0) { dragging = false; return }
  tx.value = baseX + (e.clientX - startX)
  ty.value = baseY + (e.clientY - startY)
  clampPan()
}
function onPointerUp() { dragging = false }

// —— Toolbar auto-hide after 5s idle (faithful to files ImageViewer) ——
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove() {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isMoving.value = false; hideTimer = null }, 5000)
}

// —— OCR overlay: rects share same transform as <img> (see .ocr-overlay :style="imgStyle"),
// move in sync with image during zoom/pan/rotate; .img-wrap is just shell sharing positioning origin between overlay and img
// (img is its only content, origins aligned), so no need to add offsetLeft/offsetTop. ——
const ocrRects = ref<Array<{ left: number; top: number; width: number; height: number }>>([])
function recomputeOcrRects() {
  const el = imgEl.value
  if (!el) { ocrRects.value = []; return }
  ocrRects.value = mapOcrBoxesToRects(props.ocrLines ?? [], el.clientWidth, el.clientHeight, el.naturalWidth, el.naturalHeight)
}
watch(() => props.ocrLines, recomputeOcrRects)

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  onMouseMove()
  recomputeOcrRects()
  if (typeof ResizeObserver !== 'undefined' && imgEl.value) {
    resizeObserver = new ResizeObserver(recomputeOcrRects)
    resizeObserver.observe(imgEl.value)
  }
})
onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  if (commitTimer) clearTimeout(commitTimer)
  if (suppressTimer) clearTimeout(suppressTimer)
  resizeObserver?.disconnect()
})

defineExpose({ zoomIn, zoomOut, rotate, resetTransform })
</script>

<template>
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
    <div class="img-wrap">
      <img
        ref="imgEl"
        class="img-el"
        :src="src"
        :style="imgStyle"
        alt=""
        draggable="false"
        @load="recomputeOcrRects"
      />
      <div v-if="ocrRects.length" class="ocr-overlay" :style="imgStyle">
        <div
          v-for="(r, i) in ocrRects"
          :key="i"
          class="ocr-hit"
          :style="{ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }"
        />
      </div>
    </div>

    <div v-if="isMoving" class="img-toolbar">
      <button type="button" class="tb-item" @click="zoomIn">{{ t('photosZoomIn') }}</button>
      <button type="button" class="tb-item" @click="zoomOut">{{ t('photosZoomOut') }}</button>
      <button type="button" class="tb-item" @click="rotate">{{ t('photosRotate') }}</button>
      <button type="button" class="tb-item" @click="resetTransform">{{ t('photosReset') }}</button>
    </div>
  </div>
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
  /* No selection in stage: selection can bypass draggable=false triggering native drag (ghost image + forbidden cursor) */
  user-select: none;
  /* Checkerboard transparent background (faithful to files ImageViewer) */
  background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 16 16'%3E%3Cpath fill='%23ccc' d='M8 6.5A1.5 1.5 0 1 0 8 9.5A1.5 1.5 0 1 0 8 6.5z' fill-opacity='0.1'/%3E%3C/svg%3E");
  background-repeat: repeat;
}
.img-stage:active { cursor: grabbing; }
/* .img-wrap shrinks to fit img's rendered size, aligns .ocr-overlay (absolute, inset:0) origin
   exactly with img — img is its only layout-participating content, so OCR rectangles don't need
   additional offsetLeft/offsetTop conversion. */
.img-wrap {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  max-height: 100%;
}
.img-el {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transition: transform 0.05s linear;
  /* Do not add will-change: transform — once large image becomes composite layer, zoom only stretches old tiles without redraw,
     tile seams show as white grid lines on photo (verified by real device screenshot); without it zoom triggers redraw, seamless. */
}
/* Overlay binds exact same imgStyle as img (transform identical), both share same pre-transform bounding box
   (both .img-wrap's inset:0), so during zoom/pan/rotate they move in perfect visual sync. */
.ocr-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.ocr-hit {
  position: absolute;
  border: 1.5px solid var(--accent);
  border-radius: 3px;
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent-soft-bd);
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
  box-shadow: var(--media-overlay-shadow);
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
</style>
