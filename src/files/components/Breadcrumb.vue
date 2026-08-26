<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem,
} from 'reka-ui'
import FavoriteStar from './FavoriteStar.vue'
import { collapseCrumbs, maxCollapsible, type CrumbSeg } from '../util/breadcrumbCollapse'

const props = defineProps<{
  virtualPath: string
  currentRealPath: string
  // Fix wave D (D1, owner acceptance 2026-08-26): snapshots are read-only, and Vue2 gates the
  // favorite-star affordance off while browsing one (GirdView.vue's own `isInSnapshot` computed --
  // "never while browsing a snapshot", see that file's header comment). The caller passes
  // `browse.isSnapshotView` here (not `tmActive`: plain snapshot browsing without Time Machine
  // chrome up still counts). This also restores front/back parity with SnapshotPreviewWindow.vue,
  // whose own header comment documents that its hand-copied breadcrumb deliberately omits
  // `<FavoriteStar>` entirely -- the promoted depth-0 layer never had a star to match against.
  hideFavorite?: boolean
}>()
const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()

const segments = computed<CrumbSeg[]>(() => {
  const parts = props.virtualPath.replace(/^\/+/, '').split('/').filter(Boolean)
  const segs: CrumbSeg[] = []
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    segs.push({ label: p, vpath: acc })
  }
  return segs
})
const lastName = computed(() => (segments.value.length ? segments.value[segments.value.length - 1].label : ''))

// ── Two-line cap ───────────────────────────────────────────────────────────
// A deep path used to wrap into as many rows as it liked and push the whole
// listing down. The cap is measured, not a "more than N levels" guess: how many
// levels fit depends on the container width and on how long the labels are, so
// we render, measure, and hide one more middle level until it fits.
const navEl = ref<HTMLElement | null>(null)
const collapseCount = ref(0)
// How many trailing levels are protected. Normally 2 (current folder + its
// parent); on a container too narrow to fit even that, we give the parent up
// rather than let the current folder be the row that gets clipped away.
const keepTail = ref(2)
// Hard ceiling in px, published to CSS. Until the first successful measurement
// it stays null and no cap is applied — clipping a breadcrumb we have not
// measured yet would hide levels for no reason (this is also the jsdom case,
// where every layout metric reads 0).
const maxHeightPx = ref<number | null>(null)

const items = computed(() => collapseCrumbs(segments.value, collapseCount.value, keepTail.value))

// Guards for the async measuring loop: `epoch` retires a run whose input is
// already stale, `running` keeps the ResizeObserver from reacting to the width
// changes our own collapsing causes.
let epoch = 0
let running = 0
let lastWidth = -1

/** Height of one crumb row plus the wrap gap, read from layout rather than hard-coded. */
function rowMetrics(nav: HTMLElement): { row: number; gap: number } {
  const cs = getComputedStyle(nav)
  const gap = parseFloat(cs.rowGap) || 0
  const first = nav.querySelector<HTMLElement>('.crumb')
  const row = first?.offsetHeight || parseFloat(cs.lineHeight) || 0
  return { row, gap }
}

async function remeasure(): Promise<void> {
  const nav = navEl.value
  if (!nav) return
  const mine = ++epoch
  running++
  try {
    // Start from "nothing hidden" so a widened container gives levels back.
    collapseCount.value = 0
    keepTail.value = 2
    await nextTick()
    if (mine !== epoch) return
    const { row, gap } = rowMetrics(nav)
    if (!row) {
      // Not laid out (detached, display:none, or a non-rendering environment):
      // no measurement means no cap and no collapsing.
      maxHeightPx.value = null
      return
    }
    const limit = row * 2 + gap
    maxHeightPx.value = limit
    // 1px of slack: sub-pixel row heights round up and would otherwise look like
    // a third line forever.
    const overflows = () => nav.scrollHeight > limit + 1
    for (const tail of [2, 1]) {
      if (keepTail.value !== tail) {
        keepTail.value = tail
        await nextTick()
        if (mine !== epoch) return
      }
      const ceiling = maxCollapsible(segments.value.length, tail)
      while (collapseCount.value < ceiling && overflows()) {
        collapseCount.value++
        await nextTick()
        if (mine !== epoch) return
      }
      if (!overflows()) break
    }
  } finally {
    running--
  }
}

let ro: ResizeObserver | null = null
onMounted(() => {
  // Observe the parent, not the breadcrumb itself: collapsing changes our own
  // width, and observing that would feed the loop back into itself.
  const target = navEl.value?.parentElement ?? navEl.value
  if (target && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      if (running) return
      const w = entries[0]?.contentRect.width ?? -1
      if (Math.abs(w - lastWidth) < 0.5) return
      lastWidth = w
      void remeasure()
    })
    ro.observe(target)
  }
  void remeasure()
})
onBeforeUnmount(() => { ro?.disconnect(); ro = null })

watch(segments, () => { void remeasure() })

/** Accessible name for the "…" trigger — the hidden levels themselves, so no new copy to translate. */
function hiddenLabel(hidden: CrumbSeg[]): string {
  return hidden.map((s) => s.label).join(' / ')
}
</script>

<template>
  <nav ref="navEl" class="breadcrumb" :style="maxHeightPx !== null ? { maxHeight: maxHeightPx + 'px' } : undefined">
    <template v-for="(item, i) in items" :key="item.kind === 'ellipsis' ? '…' : item.seg.vpath">
      <span v-if="i > 0" class="crumb-sep">›</span>
      <DropdownMenuRoot v-if="item.kind === 'ellipsis'">
        <DropdownMenuTrigger class="crumb crumb-more" :aria-label="hiddenLabel(item.hidden)" :title="hiddenLabel(item.hidden)">…</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <!-- Reuse the non-scoped context-menu styling (ui/ContextMenu.vue): portalled
               content leaves the scope attribute behind, so scoped rules would drop out. -->
          <DropdownMenuContent class="ui-ctx-content" :side-offset="4" align="start">
            <DropdownMenuItem
              v-for="h in item.hidden"
              :key="h.vpath"
              class="ui-ctx-item crumb-more-item"
              @select="emit('navigate', h.vpath)"
            >
              {{ h.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <!-- The last segment is where you already are: it used to be a live button
           that navigated to the current directory, with hover feedback promising
           something would happen. -->
      <span v-else-if="i === items.length - 1" class="crumb current">{{ item.seg.label }}</span>
      <button v-else class="crumb" @click="emit('navigate', item.seg.vpath)">{{ item.seg.label }}</button>
    </template>
    <FavoriteStar v-if="!props.hideFavorite && currentRealPath && lastName" class="crumb-star" :path="props.currentRealPath" :name="lastName" />
    <!-- Fix wave B (B2, owner acceptance 2026-08-26): an optional trailing slot, rendered as the
         LAST item in this same flex-wrap row -- so whatever the caller puts here (Files.vue's own
         "Snapshot · Read-only" chip) hugs the breadcrumb's actual rendered content, the same way
         Vue2's FilePanel.vue puts its own `.tm-snap-chip` inside the SAME flex row as
         `<file-breadcrumb>` (`#bread-container`, `margin-left: 10px`). This component's own root
         `.breadcrumb` deliberately grows to fill its parent (`flex: 1 1 auto`, see this file's own
         style-block comment below) for the two-line-collapse measuring loop above -- a SIBLING element
         outside this <nav> would sit after that grown (invisible-padding) box, at the far right of
         whatever container it shares, not hugging the crumbs at all (the exact bug this slot
         fixes). Putting the caller's content INSIDE this flex row sidesteps that entirely: it is
         positioned right after the last real child here, regardless of how much of the row's own
         width this component's `flex: 1 1 auto` claims. -->
    <slot name="trailing" />
  </nav>
</template>

<style scoped>
/* flex:1 1 auto keeps our width a function of the topbar, not of our own content —
   otherwise collapsing would shrink the box the ResizeObserver is watching.
   overflow:hidden is the backstop for the frame before the measuring loop settles
   and for a single label too long to ever fit. */
/* Fix wave E (E2, owner acceptance 2026-08-26): gap is `var(--tm-crumb-gap)` -- shared with
   SnapshotPreviewWindow.vue's own hand-copied replica (theme.css's own comment on that token
   block explains why this LIVE component, not just the TM-specific ones, also draws from it). */
.breadcrumb { display: flex; align-items: center; gap: var(--tm-crumb-gap); flex: 1 1 auto; flex-wrap: wrap; min-width: 0; overflow: hidden; }
/* A single label wider than the whole breadcrumb would wrap by word into a row the
   two-line cap then clips. Truncate it instead — one shortened crumb beats a
   missing one. min-width:0 is defence only, not the thing that makes the ellipsis
   work: a flex item's automatic minimum size applies only while its overflow is
   visible (CSS Flexbox L1 §4.5), and overflow:hidden below already opts out. Keep
   it so the truncation survives someone later relaxing that overflow. */
.crumb { background: none; border: none; color: var(--fg-muted); font-size: var(--tm-crumb-font-size); padding: var(--tm-crumb-padding); border-radius: 6px; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button.crumb { cursor: pointer; }
button.crumb:hover { background: var(--chip-bg); color: var(--fg); }
.crumb.current { color: var(--fg); font-weight: 600; }
.crumb-more { font-weight: 600; line-height: 1; }
.crumb-more[data-state='open'] { background: var(--chip-bg); color: var(--fg); }
.crumb-sep { color: var(--fg-muted, #9aa4bf); font-size: var(--tm-crumb-sep-font-size); }
.crumb-star { margin-left: 4px; }
</style>
