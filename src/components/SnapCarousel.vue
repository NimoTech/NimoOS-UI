<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ ariaLabel?: string }>()
const { t } = useI18n()

const viewport = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(true)

/** Endpoint detection: 1px tolerance at each end (sub-pixel slack from smooth scrolling) */
function recalc() {
  const el = viewport.value
  if (!el) return
  atStart.value = el.scrollLeft <= 1
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}
function page(dir: 1 | -1) {
  const el = viewport.value
  if (!el) return
  el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: 'smooth' })
  // Optimistic update: paging in one direction necessarily leaves the opposite endpoint — no need
  // to wait for the smooth scroll's scroll event to unlock the opposite button.
  // The real endpoint state keeps getting corrected by @scroll -> recalc() (see the listener below);
  // here we only handle "the side we just left".
  if (dir > 0) atStart.value = false
  else atEnd.value = false
}

let ro: ResizeObserver | undefined
let mo: MutationObserver | undefined
// Capture the element reference at mount time rather than re-reading viewport.value in
// onUnmounted — during Vue's unmount flow the template ref may already be nulled before the
// onUnmounted callback runs.
let viewportEl: HTMLElement | null = null
onMounted(() => {
  recalc()
  viewportEl = viewport.value
  if (!viewportEl) return
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(recalc)
    ro.observe(viewportEl)
  }
  // ResizeObserver only measures the viewport's own box; detail-page screenshots are
  // <img loading="lazy"> with only a fixed height, so scrollWidth≈0 at mount, and after decoding
  // the content widens while the viewport box stays the same — recalc never re-fires on its own.
  // Two fallback paths catch "content changed, not container changed":
  //  1) MutationObserver (childList+subtree): recalculate when slot content is added/removed.
  //  2) Capture-phase load listener: img load events don't bubble, but the capture phase delivers
  //     them from the viewport downward.
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(recalc)
    mo.observe(viewportEl, { childList: true, subtree: true })
  }
  viewportEl.addEventListener('load', recalc, true)
})
onUnmounted(() => {
  ro?.disconnect()
  mo?.disconnect()
  viewportEl?.removeEventListener('load', recalc, true)
})
</script>

<template>
  <div class="snap-carousel" :aria-label="ariaLabel">
    <button class="snap-btn snap-prev" type="button" :disabled="atStart" :aria-label="t('carouselPrev')" @click="page(-1)">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div ref="viewport" class="snap-viewport" @scroll.passive="recalc">
      <slot />
    </div>
    <button class="snap-btn snap-next" type="button" :disabled="atEnd" :aria-label="t('carouselNext')" @click="page(1)">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M9 4 L17 12 L9 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* Paging buttons = legacy swiper style: large round buttons overlaid on both sides of the carousel, vertically centered, with the SVG arrow centered as a vector (no reliance on glyph baselines) */
.snap-carousel { position: relative; min-width: 0; }
.snap-viewport {
  display: flex; gap: 14px; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none; /* The paging buttons provide the scrolling affordance; hide the native bar */
}
.snap-viewport::-webkit-scrollbar { display: none; }
.snap-viewport > :slotted(*) { scroll-snap-align: start; flex: 0 0 auto; }
.snap-btn {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;
  width: 40px; height: 40px; padding: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--fg);
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 50%;
  box-shadow: var(--card-shadow); backdrop-filter: var(--blur);
  transition: opacity 0.2s var(--ease);
}
.snap-prev { left: 6px; }
.snap-next { right: 6px; }
.snap-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
/* At an endpoint the whole button disappears (same as swiper); with less than one screen of content neither side shows */
.snap-btn:disabled { opacity: 0; pointer-events: none; cursor: default; }
@media (prefers-reduced-motion: reduce) { .snap-btn { transition: none; } }
</style>
