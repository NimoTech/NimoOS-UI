<script setup lang="ts">
// Lightbox bottom filmstrip — ported from the Vue 2 panel's src/views/Photos/PhotosLightbox.vue
// Template :167-176 (.lb-strip) + methods :249-298 (centerActiveThumb / findCenterThumbIndex /
// updateLocalActiveFromCenter / commitSelection / onStripWheel).
//
// Migration delta:
//  1) Vue2 `$emit('nav', delta)` (relative paging) → this component emit('select', absolute index),
//     parent (T6/T9 PhotoLightbox) receives and calls `lb.goTo(i)`.
//  2) ref_for in v-for unifies to array — each thumbnail shares same ref name (`thumbEls`), Vue3
//     runtime collects to array (order matches v-for), must `Array.isArray` check before use
//     (copied from PhotosGrid.vue `hoverPreviewRef` pattern, P1 rule). Vue2 original used conditional ref
//     (`:ref="p.id===localActiveId ? 'activeThumb' : null"`) capturing only current item; changed to
//     "capture all, access by index" more direct, avoid DOM rerender wait on each index change.
//  3) Current item highlight uses `props.index` (numeric index) vs v-for index `i`, not object reference/id.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ list: Photo[]; index: number }>()
const emit = defineEmits<{ (e: 'select', i: number): void }>()

function thumbnailSrc(id: string | number): string { return service.photos.thumbnailUrl(id, 'small') }

const stripEl = ref<HTMLElement | null>(null)
// ref_for → array (see head delta 2); normalization method same as PhotosGrid.vue hoverPreviewRef.
const thumbEls = ref<HTMLElement[] | HTMLElement | null>(null)

function elAt(i: number): HTMLElement | null {
  const raw = thumbEls.value
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  return arr[i] ?? null
}

// —— Release guard: during scroll animation triggered by centerActiveThumb, wheel timer should not trigger select by mistake ——
// (per Vue2 :249-298 _programmaticScroll)
let programmaticScroll = false
let unlockTimer: ReturnType<typeof setTimeout> | null = null
let selectTimer: ReturnType<typeof setTimeout> | null = null
let lastWheelTime = 0
let centeredIndex = -1

function centerActiveThumb(smooth = true): void {
  const strip = stripEl.value
  const el = elAt(props.index)
  if (!strip || !el) return
  const target = el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2
  programmaticScroll = true
  if (unlockTimer) clearTimeout(unlockTimer)
  unlockTimer = setTimeout(() => { programmaticScroll = false }, smooth ? 500 : 50)
  // jsdom (test environment) does not implement Element.scrollTo — fall back to direct scrollLeft assignment.
  if (typeof strip.scrollTo === 'function') {
    strip.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' } as ScrollToOptions)
  } else {
    strip.scrollLeft = target
  }
}

function findCenterThumbIndex(): number {
  const strip = stripEl.value
  if (!strip || !strip.children.length) return -1
  const center = strip.scrollLeft + strip.clientWidth / 2
  let bestI = -1
  let bestDist = Infinity
  for (let i = 0; i < strip.children.length; i++) {
    const node = strip.children[i] as HTMLElement
    const d = Math.abs(node.offsetLeft + node.clientWidth / 2 - center)
    if (d < bestDist) { bestDist = d; bestI = i }
  }
  return bestI
}

function updateLocalActiveFromCenter(): void {
  const i = findCenterThumbIndex()
  if (i < 0) return
  centeredIndex = i
}

function commitSelection(): void {
  if (programmaticScroll) return
  if (centeredIndex < 0 || centeredIndex === props.index) return
  emit('select', centeredIndex)
}

function onStripWheel(e: WheelEvent): void {
  const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
  if (!delta) return
  e.preventDefault()
  const strip = stripEl.value
  if (!strip) return
  programmaticScroll = false
  lastWheelTime = Date.now()
  strip.scrollLeft += delta
  updateLocalActiveFromCenter()
  if (selectTimer) clearTimeout(selectTimer)
  selectTimer = setTimeout(commitSelection, 140)
}

function onThumbClick(i: number): void {
  emit('select', i)
}

// After index changes from external source (arrow click/keyboard/thumbnail click), smoothly center that thumbnail;
// if wheel event happened within 140ms, treat as "user manually scrolled it out", skip smooth animation again (per Vue2 fromWheel check).
watch(() => props.index, () => {
  const fromWheel = Date.now() - lastWheelTime < 600
  centerActiveThumb(!fromWheel)
})

onMounted(() => {
  // Vue2 param alignment: Vue2
  // mounted() calls `centerActiveThumb()` with no argument -- i.e. the default `smooth = true`
  // (Vue2 PhotosLightbox.vue mounted():279-282) -- so every lightbox open smooth-scrolls the
  // strip to the active thumbnail. This previously passed `false` (instant) here with no
  // documented reason; corrected to match (no arg = same default as the function signature
  // above, `smooth = true`).
  centerActiveThumb()
  stripEl.value?.addEventListener('wheel', onStripWheel, { passive: false })
})
onBeforeUnmount(() => {
  stripEl.value?.removeEventListener('wheel', onStripWheel)
  if (unlockTimer) clearTimeout(unlockTimer)
  if (selectTimer) clearTimeout(selectTimer)
})
</script>

<template>
  <div ref="stripEl" class="lb-strip">
    <div
      v-for="(p, i) in list"
      :key="p.id"
      ref="thumbEls"
      class="lb-thumb"
      :data-active="i === index"
      @click="onThumbClick(i)"
    >
      <img :src="thumbnailSrc(p.id)" alt="" loading="lazy" />
      <div v-if="p.isVideo" class="thumb-vid">
        <span class="vid-play">▶</span>
        <span v-if="p.duration">{{ p.duration }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* `.lb-strip`'s `grid-area`/`display`/`gap`/`padding`/`background`/`border-top`/
   `overflow-x` are retired -- an earlier fix had already brought every one of these to byte-exact
   parity values (parity photos.scss:648-654 `.photos-root .lb-strip`; `calc(50% - 28px)` is
   `centerActiveThumb()`'s own load-bearing centering math, unchanged, just no longer duplicated
   locally), so keeping the local copies was pure duplication once this component actually nests
   inside `.photos-root` and the `--lb-chrome`/`--line` tokens resolve for real (their fallback
   literals are dropped along with the rest -- see PhotoLightbox.vue's retirement note for why
   duplicated properties, not just fallback literals, needed to go: this component's own scoped
   style registers AFTER parity's stylesheet in every host page's import order, so a surviving
   duplicate would keep outvoting parity on every tie). Only the two properties parity's own
   `.lb-strip` doesn't declare survive: `overflow-y: hidden` and `scrollbar-width: none`
   (Firefox's scrollbar-hiding property; parity's own `::-webkit-scrollbar` rule below only
   covers WebKit). */
.lb-strip {
  overflow-y: hidden;
  scrollbar-width: none;
}
/* `::-webkit-scrollbar` retired -- parity's own `.photos-root .lb-strip::-webkit-scrollbar`
   (`height: 0`) achieves the identical "no visible scrollbar" outcome by a different property;
   no need for both. */

/* The whole `.lb-thumb` family (base/`:hover`/`[data-active="true"]`/`img`) is
   retired -- parity's own `.photos-root .lb-thumb` family (photos.scss:656-684) is a full,
   richer replacement (56px thumbs, not 64px -- `.lb-strip`'s `calc(50% - 28px)` centering math
   above assumes parity's own 56px/2=28px, so the local 64px size was already stale the moment
   an earlier fix byte-matched the strip's own padding; an outline+scale-pop active state instead of
   a border-color swap; `will-change`/richer transitions). Nothing here survives that parity
   doesn't already implement more completely. */

.thumb-vid {
  position: absolute;
  right: 3px;
  bottom: 3px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  border-radius: 999px;
  font-size: 8px;
  /* theme-exception: persistent badge on thumbnail needs contrast on any photo, theme-independent
     (same precedent as PhotosGrid.vue .tile-vid / VideoHoverPreview.vue chrome) */
  background: rgba(0, 0, 0, 0.55); color: #fff;
}
.vid-play { font-size: 6px; }
</style>
