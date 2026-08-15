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

// HEIC/TIFF/RAW 等浏览器无法原生解码的格式回退到已转码的大图缩略图(照 Vue2 PhotosLightbox imageSrc)
const src = computed(() =>
  browserCanDisplayImage(props.mimeType)
    ? service.photos.originalUrl(props.assetId)
    : service.photos.thumbnailUrl(props.assetId, 'large'),
)

// —— 变换状态(照抄 files/viewers/ImageViewer.vue 的 缩放/旋转/平移骨架)——
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

// 换图时复位变换 + 重算 OCR 覆盖层(单图无内部 index,按 assetId 换图)
watch(() => props.assetId, () => { resetTransform(); recomputeOcrRects() })

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

// —— 工具栏 5s 无操作自动隐藏(忠于 files ImageViewer)——
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove() {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isMoving.value = false; hideTimer = null }, 5000)
}

// —— OCR 覆盖层:rects 与 <img> 共享同一变换(见 .ocr-overlay 的 :style="imgStyle"),
// 缩放/平移/旋转时随图片同步移动;.img-wrap 只是让 overlay 与 img 共享定位原点的
// 壳(img 是其唯一内容,原点对齐),因此不必再叠加 offsetLeft/offsetTop。——
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
      <!-- Plan F Task 3: `class="img-el"` keeps its name (the zoom family's own hook -- net
           addition over Vue2, kept per controller ruling 4) and gains parity's anchor
           `.lb-photo` alongside it (Vue2 PhotosLightbox.vue:38-45 `<img class="lb-photo">`,
           parity photos.scss:593-598). Both classes coexist: `.img-el` still drives the zoom/
           pan transform + cursor rules above, `.lb-photo` is the anchor Task 4/5 will target
           once this renders under `.photos-root`'s real parity CSS. -->
      <img
        ref="imgEl"
        class="img-el lb-photo"
        :src="src"
        :style="imgStyle"
        alt=""
        draggable="false"
        @load="recomputeOcrRects"
      />
      <!-- Plan F Task 3: renamed from the invented `.ocr-overlay`/`.ocr-hit` to parity's real
           anchors `.lb-ocr-overlay`/`.lb-ocr-hit` (Vue2 PhotosLightbox.vue:46-53, parity
           photos.scss:604-618). Task 4 adds the `lb-ocr-pulse` entrance animation to
           `.lb-ocr-hit`; this task only re-shapes the class names. -->
      <div v-if="ocrRects.length" class="lb-ocr-overlay" :style="imgStyle">
        <div
          v-for="(r, i) in ocrRects"
          :key="i"
          class="lb-ocr-hit"
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
  /* 舞台内禁止选区:选区可绕过 draggable=false 触发原生拖放(幽灵图+禁止光标) */
  user-select: none;
  /* 棋盘格透明底(忠于 files ImageViewer) */
  background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 16 16'%3E%3Cpath fill='%23ccc' d='M8 6.5A1.5 1.5 0 1 0 8 9.5A1.5 1.5 0 1 0 8 6.5z' fill-opacity='0.1'/%3E%3C/svg%3E");
  background-repeat: repeat;
}
.img-stage:active { cursor: grabbing; }
/* .img-wrap 只按 img 的渲染尺寸收缩包裹(shrink-to-fit),使 .ocr-overlay(绝对定位、
   inset:0)的原点与 img 完全重合 —— img 是其唯一参与布局的内容,故 OCR 矩形无需
   再叠加 offsetLeft/offsetTop 换算。 */
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
  /* 勿加 will-change: transform —— 大图被固定成合成层后,缩放只拉伸旧瓦片不重绘,
     瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */
}
/* overlay 绑定与 img 完全相同的 imgStyle(transform 一致),二者共享同一未变换前的
   包围盒(均为 .img-wrap 的 inset:0),因此缩放/平移/旋转时视觉上严丝合缝同步移动。
   Plan F Task 3: renamed from `.ocr-overlay`/`.ocr-hit` to parity's anchors
   `.lb-ocr-overlay`/`.lb-ocr-hit` (see template comment). */
.lb-ocr-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
/* Plan F Task 4: byte-exact per Vue2 (photos.scss:500-510) + parity's own scoped copy
   (`.photos-root .lb-ocr-hit`, photos.scss:616-622) -- these values replace the earlier
   accent-token approximation now that this task brought the real Vue2 numbers into scope.
   `border` dropped entirely (Vue2 has none; the earlier `--accent` border was this component's
   own invention, superseded below by the two-layer box-shadow ring, which IS how Vue2 draws the
   outline). Interim-scoping note: parity's own rule is `.photos-root`-scoped and doesn't reach
   this component yet (Task 5's job), but the `lb-ocr-pulse` keyframes it references are a bare,
   top-level construct -- keyframes can't be selector-scoped -- already loaded on every host page
   (see PhotoLightbox.vue's `.lightbox` animation comment for the same reasoning), so referencing
   it here by name is safe today; only the surrounding property values needed local duplication.
   theme-exception: this highlighter color is a fixed, skin-invariant literal in Vue2 itself (one
   rule, no light/dark split) -- not a themeable app surface, so a literal value is correct here
   rather than `var(--token)`, same precedent as PhotoFilmstrip.vue's `.thumb-vid` chrome badge. */
.lb-ocr-hit {
  position: absolute;
  box-sizing: border-box;
  border-radius: 4px;
  /* theme-exception: see the full explanation in this rule's header comment above -- fixed,
     skin-invariant highlighter literal, not a themeable surface. */
  background: rgba(255, 214, 10, 0.30); box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.85), 0 0 12px rgba(255, 214, 10, 0.55);
  animation: lb-ocr-pulse 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) both;
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
