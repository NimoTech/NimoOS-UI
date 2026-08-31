<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { browserCanDisplayImage } from '../util/browserCanDisplayImage'
import { mapOcrBoxesToRects } from './util/ocrHighlight'

const props = defineProps<{
  assetId: string | number
  mimeType: string
  ocrLines?: Array<{ box: number[] }>
}>()

// Formats the browser can't natively decode (HEIC/TIFF/RAW etc.) fall back to the already-transcoded
// large thumbnail (following Vue2 PhotosLightbox's imageSrc)
const src = computed(() =>
  browserCanDisplayImage(props.mimeType)
    ? service.photos.originalUrl(props.assetId)
    : service.photos.thumbnailUrl(props.assetId, 'large'),
)

// —— Transform state (copied from files/viewers/ImageViewer.vue's zoom/rotate/pan skeleton) ——
const scale = ref(1) // interactive incremental factor (resets to 1 once committed)
const committedZoom = ref(1) // total committed factor; effective factor = committedZoom × scale
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

// —— Commit on settle: 150ms after zooming stops, bake the factor into the layout size and force a redraw at the final factor ——
// The compositor's fast-path stretches cached tiles, which shows a 1px hairline at tile seams;
// the redraw path samples each tile fresh from the source image, so it's seamless and sharper than
// the stretched state. Interaction still takes the fast transform path to stay smooth; the seam can only flash briefly.
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
  if (!w || !h) return // image hasn't finished loading (layout size is 0) -- skip this commit
  committedW.value = Math.round(w * scale.value)
  committedH.value = Math.round(h * scale.value)
  committedZoom.value *= scale.value
  scale.value = 1
  // The commit frame's scale N→1 would otherwise get animated by the transition while width/height jump instantly -- suppress the transition, then restore it after the transition duration
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
// Note: the bottom zoom toolbar (both themes) is removed
// below -- rotate() loses its only UI entry point along with it (acceptable since
// zoom was the one feature explicitly named for preservation). Kept live and reachable, not
// deleted -- still exposed via defineExpose for any future programmatic/keyboard trigger.
function rotate() { rotation.value += 90 }
function onWheel(e: WheelEvent) { e.deltaY < 0 ? zoomIn() : zoomOut() }
// Double-click companion gesture (cheap addition alongside wheel-zoom, which
// already covers "zoom in/out must remain reachable" without any button). Toggles between the
// current effective zoom and a fixed 2x, reusing the exact same setZoom/resetTransform mechanics
// the (now-removed) toolbar buttons drove.
function onDblClick() {
  if (committedZoom.value * scale.value > 1.01) resetTransform()
  else setZoom(2)
}

// Reset transform + recompute OCR overlay when the image changes (single image, no internal index, switches by assetId)
watch(() => props.assetId, () => { resetTransform(); recomputeOcrRects() })

// —— Drag to pan ——
let dragging = false
let startX = 0
let startY = 0
let baseX = 0
let baseY = 0

// Pan clamping: at all times keep at least PAN_KEEP px of the image inside the viewport, so it can't be dragged away entirely.
// Skip clamping when layout info is unavailable (image not loaded / test environment).
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
  if (rotation.value % 180 !== 0) [w, h] = [h, w] // rotated 90/270°: visual width/height swap
  const mx = (W + w) / 2 - Math.min(PAN_KEEP, w / 2)
  const my = (H + h) / 2 - Math.min(PAN_KEEP, h / 2)
  tx.value = Math.min(Math.max(tx.value, -mx), mx)
  ty.value = Math.min(Math.max(ty.value, -my), my)
}

function onPointerDown(e: PointerEvent) {
  dragging = true
  startX = e.clientX; startY = e.clientY; baseX = tx.value; baseY = ty.value
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  // Releasing outside the window can lose the pointerup event, leaving dragging stuck true and the image "stuck" to the pointer -- self-heals as soon as the button is detected released
  if (e.pointerType === 'mouse' && e.buttons === 0) { dragging = false; return }
  tx.value = baseX + (e.clientX - startX)
  ty.value = baseY + (e.clientY - startY)
  clampPan()
}
function onPointerUp() { dragging = false }

// —— OCR overlay: the rects share the same transform as the <img> (see .ocr-overlay's :style="imgStyle"),
// so they move in sync with the image on zoom/pan/rotate; .img-wrap is just a shell that lets the
// overlay and the img share the same positioning origin (img is its only content, origins align),
// so there's no need to add offsetLeft/offsetTop on top. ——
const ocrRects = ref<Array<{ left: number; top: number; width: number; height: number }>>([])
function recomputeOcrRects() {
  const el = imgEl.value
  if (!el) { ocrRects.value = []; return }
  ocrRects.value = mapOcrBoxesToRects(props.ocrLines ?? [], el.clientWidth, el.clientHeight, el.naturalWidth, el.naturalHeight)
}
watch(() => props.ocrLines, recomputeOcrRects)

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  recomputeOcrRects()
  if (typeof ResizeObserver !== 'undefined' && imgEl.value) {
    resizeObserver = new ResizeObserver(recomputeOcrRects)
    resizeObserver.observe(imgEl.value)
  }
})
onBeforeUnmount(() => {
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
    @wheel.prevent="onWheel"
    @dblclick="onDblClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerUp"
    @dragstart.prevent
  >
    <div class="img-wrap">
      <!-- `class="img-el"` keeps its name (the zoom family's own hook -- net
           addition over Vue2, intentionally kept) and gains parity's anchor
           `.lb-photo` alongside it (Vue2 PhotosLightbox.vue:38-45 `<img class="lb-photo">`,
           parity photos.scss:593-598). Both classes coexist: `.img-el` still drives the zoom/
           pan transform + cursor rules above, `.lb-photo` is the anchor later work will target
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
      <!-- Renamed from the invented `.ocr-overlay`/`.ocr-hit` to parity's real
           anchors `.lb-ocr-overlay`/`.lb-ocr-hit` (Vue2 PhotosLightbox.vue:46-53, parity
           photos.scss:604-618). A later change adds the `lb-ocr-pulse` entrance animation to
           `.lb-ocr-hit`; this change only re-shapes the class names. -->
      <div v-if="ocrRects.length" class="lb-ocr-overlay" :style="imgStyle">
        <div
          v-for="(r, i) in ocrRects"
          :key="i"
          class="lb-ocr-hit"
          :style="{ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }"
        />
      </div>
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
  /* Disallow text selection inside the stage: a selection can bypass draggable=false and trigger the native drag-and-drop (ghost image + no-drop cursor) */
  user-select: none;
  /* Checkerboard transparent background (faithful to files' ImageViewer) */
  background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 16 16'%3E%3Cpath fill='%23ccc' d='M8 6.5A1.5 1.5 0 1 0 8 9.5A1.5 1.5 0 1 0 8 6.5z' fill-opacity='0.1'/%3E%3C/svg%3E");
  background-repeat: repeat;
}
.img-stage:active { cursor: grabbing; }
/* .img-wrap only shrink-wraps to the img's rendered size (shrink-to-fit), so that
   .ocr-overlay's (absolutely positioned, inset: 0) origin exactly coincides with img's --
   img is the only content participating in layout, so OCR rects never need an extra
   offsetLeft/offsetTop conversion.

   Containing-block analysis -- why `max-width: 100%;
   max-height: 100%;` MUST stay here even though the identically-named pair was just deleted from
   `.img-el` below: this wrap is a shrink-to-fit box (`display: inline-flex`, no explicit
   width/height of its own) sitting between `.img-stage` (a definite, 100%-sized box -- this
   component's own root) and the `<img class="img-el lb-photo">`. Percentages on a descendant
   always resolve against its own containing block, i.e. THIS element, not `.img-stage` directly --
   so for the img's `.lb-photo` max-width (now solely parity's `calc(100% - 80px)`, no local
   competitor after the deletion below) to mean "80px in from `.img-stage`'s edge" rather than
   something computed relative to an already shrink-wrapped, content-dependent box, this wrapper's
   OWN percentage basis has to be a plain, unconstrained pass-through of `.img-stage`'s real size --
   which is exactly what an unqualified `100%` here provides (it is never the binding constraint in
   practice: the img's own max-width already caps the rendered size below `.img-stage`'s, so this
   wrapper's shrink-to-fit width always lands under its own 100% cap and never gets clamped by it).
   Deleting this rule instead of `.img-el`'s would reopen exactly the same problem one layer up (an
   `.img-wrap` with no size cap at all lets an oversized photo's wrap balloon past `.img-stage`,
   independent of whatever max-width the img itself declares) -- so this is the "sizing
   pass-through" layer, kept deliberately, while `.img-el` below carries none of its own. */
.img-wrap {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  max-height: 100%;
}
/* `max-width: 100%; max-height: 100%;` used to live here too --
   at equal specificity with parity's own `.photos-root .lb-photo` (also targeting this exact
   <img>, since it carries both classes, see the comment above) and, being injected after
   the parity stylesheet on every host page, this local copy always won the tie, silently
   overriding parity's `calc(100% - 80px)`/`calc(100% - 24px)` arrow clearance with a flush 100%.
   Deleted outright -- parity's `.lb-photo` rule is now the only max-width/max-height declaration
   reaching this element, no tie left to win (see `.img-wrap`'s own comment above for why ITS
   pass-through `100%` has to stay so the percentage still resolves against `.img-stage`). */
.img-el {
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transition: transform 0.05s linear;
  /* Don't add will-change: transform -- once a large image is pinned as its own compositor layer,
     zooming only stretches the old tiles instead of repainting, and the tile seams show up as thin
     white grid lines on the photo (confirmed with real-device screenshots); removing it makes
     zooming trigger a repaint instead, which is seamless. */
}
/* `.lb-ocr-overlay`/`.lb-ocr-hit` are retired -- both were byte-exact duplicates
   of parity's own `.photos-root .lb-ocr-overlay`/`.photos-root .lb-ocr-hit` (photos.scss:612-
   626), property-for-property (including the `lb-ocr-pulse` keyframe reference, a bare top-level
   construct that was already reachable from this component regardless of nesting -- see
   PhotoLightbox.vue's own retirement note for the same reasoning about `lb-in`). Now that this
   component actually renders inside `.photos-root`, parity's copies alone govern; keeping the
   local duplicates would only be the identical same-specificity tie flagged across this whole
   file family. */
/* Note: `.img-toolbar`/`.tb-item` (the Zoom in/Zoom out/
   Rotate/Reset button row) are removed outright, both themes -- this floating box was
   flagged as visual clutter that also read as unreadably dark-on-light in the
   light theme (it never had a light-mode variant of its own, only global dark-glass tokens). Zoom
   remains reachable via wheel (onWheel, pre-existing) and the new double-click toggle (onDblClick,
   this same file's script) -- see that function's own comment for what replaces the buttons. */
</style>
