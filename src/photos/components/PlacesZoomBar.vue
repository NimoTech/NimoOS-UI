<script setup lang="ts">
// PlacesZoomBar.vue — the map's left-side vertical zoom slider.
// Ported section-by-section from Vue2 src/views/Photos/PhotosPlacesView.vue:952-970
// (template), :666-692 (zoombarSetFromEvent / onZoombarDown|Move|Up drag conversion and
// pointer capture), photos-places.scss:234-284 (styles).
//
// This component holds no scale state of its own — it only consumes the zoomFrac derived by
// the gesture composable, and always emits drag/button results to the container, which wires
// them to zoomBy/setScale/reset. onDown/onMove/onUp use e.currentTarget directly to get the
// track element (matching how Vue2 reads it at :677/:686 for
// setPointerCapture/releasePointerCapture), without a separate template ref — since the
// listeners themselves are bound on .zb-track, e.currentTarget is always equal to Vue2's
// `this.$refs.zoomTrack`; it's just two ways of getting the same element, not a behavior
// change.
//
// Shadowing cleanup: this component's entire `<style scoped>`
// block has been deleted. Every rule it carried was a byte-for-byte or same-resolved-value
// duplicate of `src/photos/styles/vue2-parity/photos-places.scss:234-284` (`.map-zoombar`
// family) — the old rationale below (kept for history) mapped Vue2's local
// `rgba(var(--ink), α)` idiom onto three new global theme.css tokens (`--zb-hover-bg`/
// `--zb-track-bg`/`--zb-thumb-shadow`) because "this repo has no --ink RGB-triple token" — but
// that's only true of the *global* token set. `.photos-root` (photos.scss:53/88) already
// defines a local `--ink` for exactly this purpose, and parity's own `.zb-btn:hover`/
// `.zb-track`/`.zb-thumb` rules already consume it directly. Since this component always
// renders inside `.photos-root`, the scoped rules were shadowing parity's correct local-token
// values with global-token values via `[data-v-xxxx]` specificity — same bug pattern as
// PhotosFilterChip.vue's own earlier fix. `.map-zoombar`'s own background/border and
// `.zb-fill`/`.zb-thumb`'s accent-driven parts already used shared or identical literals, so
// nothing here was salvageable as a real deviation; deleting the block lets parity govern
// 100% of `.map-zoombar`. `--zb-hover-bg`/`--zb-track-bg`/`--zb-thumb-shadow` in theme.css were
// unused by any component at the time (grep-confirmed) — left in place then, since that pass's
// scope was the four component files, not theme.css pruning; the noted follow-up has since
// happened: a later pass deleted all three token definitions
// from theme.css as confirmed dead.
//
// Historical rationale (superseded, kept only so the "why was this token created" question
// doesn't need re-litigating from theme.css alone):
//  1. Vue2's `.zb-btn:hover`/`.zb-track` background is `rgba(var(--ink), 0.08/0.12)` — alpha
//     copied exactly from Vue2's 0.08/0.12; RGB instead took this repo's `--fg`'s real
//     decomposed value.
//  2. `.zb-thumb`'s `background: #fff` and the second box-shadow layer `rgba(0,0,0,0.4)` — these
//     two values never changed across Vue2's two themes (theme-invariant).
//  3. `.map-zoombar`'s `background: var(--float-bg)` — `--float-bg` had actually already been
//     defined in photos.scss's `.photos-root` local token table; it was never "missing from this
//     repo".
//
// A later perf pass: `dotColor` used to feed the root
// element's `--accent` via `:style="{ '--accent': dotColor }"` — a template binding, which ties
// every colour pick to this component's own render effect (reading a prop in the template ties
// it to that effect). Vue2's own applyMapVars() (PhotosPlacesView.vue :419-433) wrote to BOTH
// `$refs.svg` and `$refs.zoombar` imperatively for exactly this reason; this component's half of
// that same mechanism is ported here — `rootRef` + a `watch()` (a separate reactive effect from
// the render effect) + `style.setProperty`, so `dotColor` changes no longer re-render this
// component's own template at all, only repaint via CSS custom property inheritance.
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAX_SCALE } from '../util/placesMap'

const props = defineProps<{
  zoomFrac: number
  /** The map theme's accent color, fed into a local --accent override — part of the map
   *  theme, not a violation of the token hard rule. */
  dotColor: string
}>()

const rootRef = ref<HTMLElement | null>(null)
function applyAccent(color: string): void {
  rootRef.value?.style.setProperty('--accent', color)
}
onMounted(() => applyAccent(props.dotColor))
watch(() => props.dotColor, applyAccent)

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
  // Vue2 has no such guard, but rect.height === 0 (the track hasn't been laid out yet, or is
  // hidden) would make the division below produce NaN, which then propagates into
  // usePlacesView's view.scale/tx/ty fields; in applyZoom, `clamped === old` never
  // short-circuits (NaN !== NaN is always true), so the write happens unconditionally;
  // reset() goes through animateView's interpolation, and every step computed from a NaN
  // starting point is still NaN — even the reset button can't recover from it, only
  // remounting the component can. This early return here blocks that unrecoverable state, so
  // NaN never gets a chance to be written into view.
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

// Vue2 :684-691. releasePointerCapture is wrapped in try/catch — a lost pointerup would leak
// the capture.
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
  <div ref="rootRef" class="map-zoombar">
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

<!-- No <style scoped> block: every rule this component needs is governed by
     src/photos/styles/vue2-parity/photos-places.scss:234-284 (`.map-zoombar` family),
     which this component's root DOM always renders under `.photos-root` (re-skin
     doctrine: component <style scoped> near zero — see PhotosSelectionToolbar.vue /
     PhotosFilterChip.vue for the same pattern). See the script-block comment above
     for what used to live here and why it was deleted rather than kept as a survivor. -->
