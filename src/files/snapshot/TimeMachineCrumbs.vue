<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

// Path bar for the snapshot card's header, in the same idiom as the files area's own
// Breadcrumb.vue (chevron-separated, click a level to go there). Deliberately NOT that
// component: it carries a FavoriteStar, a reka dropdown, a ResizeObserver measuring loop and
// the --fg/--chip-bg token family, none of which belong on a surface floating in deep space.
// What it shares is the shape, so the gesture transfers.
//
// Scope: the folder the files area is standing in is the crumb's home -- levels ABOVE it are
// shown for orientation but are not navigable, because the time machine was opened against
// that folder (entering a snapshot lands relative to it, and walking above it would silently
// change what "enter" means).
const props = defineProps<{
  /** Virtual path of the folder the time machine was opened on, e.g. "/My disk/Photos" */
  rootLabel: string
  /** How far the deck has been drilled below rootLabel, e.g. "2024/Spring" ("" = at home) */
  subPath: string
}>()
const emit = defineEmits<{ (e: 'navigate', subPath: string): void }>()

const rootParts = computed(() => props.rootLabel.split('/').filter(Boolean))
const subParts = computed(() => props.subPath.split('/').filter(Boolean))

interface Crumb {
  key: string
  label: string
  /** null = orientation only, not navigable (a level above the crumb's home) */
  sub: string | null
  current: boolean
}
const crumbs = computed<Crumb[]>(() => {
  const out: Crumb[] = []
  rootParts.value.forEach((label, i) => {
    const isHome = i === rootParts.value.length - 1
    out.push({ key: `root-${i}-${label}`, label, sub: isHome ? '' : null, current: isHome && !props.subPath })
  })
  let acc = ''
  subParts.value.forEach((label, i) => {
    acc = acc ? `${acc}/${label}` : label
    out.push({ key: `sub-${i}-${label}`, label, sub: acc, current: i === subParts.value.length - 1 })
  })
  return out
})

// Deep paths scroll sideways rather than collapsing behind a "…" menu: the bottom bar has the
// full window width, and a dropdown here would be a third stacked popup layer over the overlay.
// Keep the tail (where you are) in view when the path grows.
const scrollEl = ref<HTMLElement | null>(null)
watch(() => props.subPath, async () => {
  await nextTick()
  const el = scrollEl.value
  if (el) el.scrollLeft = el.scrollWidth
})
</script>

<template>
  <nav ref="scrollEl" class="tm-crumbs">
    <template v-for="(c, i) in crumbs" :key="c.key">
      <span v-if="i > 0" class="tm-crumb-sep" aria-hidden="true">›</span>
      <!-- Where you already are: not a button, so there is no hover promising a jump that
           would do nothing (same call the files breadcrumb made for its last segment). -->
      <span v-if="c.current" class="tm-crumb is-current">{{ c.label }}</span>
      <span v-else-if="c.sub === null" class="tm-crumb is-fixed">{{ c.label }}</span>
      <button v-else type="button" class="tm-crumb" @click="emit('navigate', c.sub)">{{ c.label }}</button>
    </template>
  </nav>
</template>

<style scoped>
.tm-crumbs {
  display: inline-flex; align-items: center; gap: 2px; vertical-align: middle;
  max-width: 100%; min-width: 0; overflow-x: auto;
  scrollbar-width: none; /* the tail is auto-scrolled into view; a scrollbar here would sit on the bar's text */
}
.tm-crumbs::-webkit-scrollbar { display: none; }
.tm-crumb {
  flex: 0 0 auto; padding: 2px 6px; border-radius: 6px; white-space: nowrap;
  border: none; background: none; color: var(--tm-fg-muted); font-size: 14px; font-family: inherit;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
button.tm-crumb { cursor: pointer; }
button.tm-crumb:hover { background: var(--nrm-bg); color: var(--tm-fg); }
/* Levels above the folder the time machine was opened on: orientation only. */
.tm-crumb.is-fixed { opacity: 0.6; }
.tm-crumb.is-current { color: var(--tm-fg); font-weight: 600; }
.tm-crumb-sep { flex: 0 0 auto; color: var(--tm-fg-muted); font-size: 12px; }
</style>
