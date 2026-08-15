<script setup lang="ts">
// P6a-T8 (SP7-P6a places/map main view): PlacesZoomBar.vue — map left-side vertical zoom slider.
// Ported segment-by-segment from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:952-970
// (template), :666-692 (zoombarSetFromEvent / onZoombarDown|Move|Up drag conversion + pointer
// capture), photos-places.scss:234-284 (styling).
//
// This component doesn't hold scale state — only consumes zoomFrac derived from T7's usePlacesView,
// drag/button results all emit to T11 container which wires them to zoomBy/setScale/reset. onDown/
// onMove/onUp use e.currentTarget directly to get the track element (same as Vue2 :677/:686's
// setPointerCapture/releasePointerCapture read), no extra template ref — the listener is bound on
// .zb-track itself, e.currentTarget equals Vue2's `this.$refs.zoomTrack`, just two ways to read the
// same element, not a behavior change.
//
// Deviations logged (color tokens):
//  1. Vue2 `.zb-btn:hover`/`.zb-track` background is `rgba(var(--ink), 0.08/0.12)` — this repo
//     lacks `--ink` as an RGB triple token, adding two precisely-named tokens (`--zb-hover-bg`/
//     `--zb-track-bg`, see theme.css/THEMING.md). Alpha exactly replicates Vue2's 0.08/0.12; RGB
//     sources from this repo's `--fg`'s real decomposed value, not copying Vue2 light theme's
//     `--ink` of `(35,37,43)` — that's only what Vue2's comment called "AI --text-primary
//     approximation", not a design-precise value. Same-type base color swap precedent in theme.css's
//     `--pin-cluster-stroke`.
//  2. `.zb-thumb`'s `background: #fff` and box-shadow's second layer `rgba(0,0,0,0.4)` — Vue2's
//     light/dark themes never changed these values. Former marked theme-exception (handle fixed white,
//     common slider handle convention); latter adds theme-invariant token `--zb-thumb-shadow` (same
//     value in both theme blocks, precedent `--place-current-trip`).
//  3. `.map-zoombar`'s `background: var(--float-bg)` is new token, precisely replicating Vue2
//     photos.scss:49/84 literal (this repo previously lacked equivalent "floating toolbar bg" token);
//     `border: 1px solid var(--line)` changed per mapping table to `var(--card-border)`.
import { useI18n } from 'vue-i18n'
import { MAX_SCALE } from '../util/placesMap'

defineProps<{
  zoomFrac: number
  /** T10 map theme's accent color, fed to --accent local override — part of D5 map theme, doesn't violate token iron rule. */
  dotColor: string
}>()

const emit = defineEmits<{
  (e: 'zoom-by', factor: number): void
  (e: 'set-scale', scale: number): void
  (e: 'reset'): void
}>()

const { t } = useI18n()

// Vue2 :674-679/:684-691's _zoomDrag.
let dragging = false

// Vue2 :666-673. t = clamp((clientY - rect.top) / rect.height, 0, 1);
// scale = MAX_SCALE - t * (MAX_SCALE - 1) — top (t=0) = MAX_SCALE, bottom (t=1) = 1.
function setFromEvent(e: PointerEvent): void {
  const track = e.currentTarget as HTMLElement
  const rect = track.getBoundingClientRect()
  // Review M4: Vue2 lacks this guard, but rect.height === 0 (track not laid out/hidden) makes
  // the division below produce NaN, which propagates to usePlacesView's view.scale/tx/ty fields;
  // in applyZoom `clamped === old` never short-circuits because NaN !== NaN, so writing proceeds;
  // reset() goes through animateView interpolation, every step from NaN start is still NaN — even
  // reset button can't recover, only remounting helps. Early return here intercepts this
  // unrecoverable state, prevents NaN from ever reaching view.
  if (!rect.height) return
  const tFrac = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  emit('set-scale', MAX_SCALE - tFrac * (MAX_SCALE - 1))
}

function onDown(e: PointerEvent): void {
  dragging = true
  setFromEvent(e)
  const track = e.currentTarget as HTMLElement & { setPointerCapture?: (id: number) => void }
  if (track.setPointerCapture)
    track.setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent): void {
  if (dragging)
    setFromEvent(e)
}

// Vue2 :684-691. releasePointerCapture wrapped in try/catch — lost pointerup leaks capture.
function onUp(e: PointerEvent): void {
  dragging = false
  const track = e.currentTarget as HTMLElement & { releasePointerCapture?: (id: number) => void }
  if (track.releasePointerCapture) {
    try {
      track.releasePointerCapture(e.pointerId)
    }
    catch {
      /* noop */
    }
  }
}

function zoomIn(): void {
  emit('zoom-by', 1.5)
}
function zoomOut(): void {
  emit('zoom-by', 1 / 1.5)
}
function resetView(): void {
  emit('reset')
}
</script>

<template>
  <div class="map-zoombar" :style="{ '--accent': dotColor }">
    <button class="zb-btn" :title="t('photosPlacesZoomIn')" @click="zoomIn">
      +
    </button>
    <div
      class="zb-track"
      @pointerdown="onDown" @pointermove="onMove"
      @pointerup="onUp" @pointercancel="onUp"
    >
      <div class="zb-fill" :style="{ height: `${zoomFrac * 100}%` }" />
      <div class="zb-thumb" :style="{ bottom: `${zoomFrac * 100}%` }" />
    </div>
    <button class="zb-btn" :title="t('photosPlacesZoomOut')" @click="zoomOut">
      −
    </button>
    <button class="zb-btn zb-reset" :title="t('photosPlacesResetView')" @click="resetView">
      ⤢
    </button>
  </div>
</template>

<style scoped>
.map-zoombar {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 99px;
}
.map-zoombar .zb-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 16px;
  font-weight: 300;
  border-radius: 50%;
  transition: background 0.2s, color 0.2s;
}
.map-zoombar .zb-btn:hover { background: var(--zb-hover-bg); color: var(--fg); }
.map-zoombar .zb-reset { font-size: 12px; }
.map-zoombar .zb-track {
  position: relative;
  width: 6px;
  height: 120px;
  margin: 2px 0;
  border-radius: 99px;
  background: var(--zb-track-bg);
  cursor: pointer;
  touch-action: none;
}
.map-zoombar .zb-fill {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  border-radius: 99px;
  background: var(--accent, #8950F2);
  pointer-events: none;
}
.map-zoombar .zb-thumb {
  position: absolute;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  margin-bottom: -7px;
  border-radius: 50%;
  /* theme-exception: handle fixed white, theme-independent — Vue2's light/dark never changed this,
     common slider handle convention. */
  background: #fff;
  box-shadow: 0 0 0 3px var(--accent, #8950F2), 0 1px 4px var(--zb-thumb-shadow);
  pointer-events: none;
}
</style>
