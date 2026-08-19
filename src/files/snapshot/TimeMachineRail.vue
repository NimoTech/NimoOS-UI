<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildRailNodes, computeFisheyeScales } from '../util/timeMachineMath'

export interface RailItem { flatIndex: number; time: string; typeKind: 'auto' | 'manual' | 'preop' }
export interface RailGroup { dayKey: string; labelText: string; items: RailItem[] }

const props = defineProps<{ groups: RailGroup[]; selectedIndex: number }>()
const emit = defineEmits<{ (e: 'select', index: number): void }>()
const { t } = useI18n()

const nodes = computed(() => buildRailNodes(props.groups))
const itemByIndex = computed(() => {
  const map: Record<number, RailItem> = {}
  for (const g of props.groups) for (const it of g.items) map[it.flatIndex] = it
  return map
})

const scales = ref<Record<number, number>>({})
const hoveredIndex = ref<number | null>(null)
// Vertical position (px) of the floating label relative to .tm-rail — computed once at
// mouseenter, not recomputed in the fisheye rAF loop; the label must not jitter with the cursor.
const hoverLabelTop = ref(0)
const railEl = ref<HTMLElement | null>(null)
let rafHandle: number | null = null
let pendingY = 0

// Continuous magnification driven by cursor distance. A burst of mousemove events within one
// frame schedules only one recompute (rAF coalescing), and the callback uses the latest cursor
// Y — pure CSS :hover can only do discrete steps, not a continuous function.
function onMouseMove(e: MouseEvent) {
  pendingY = e.clientY
  if (rafHandle !== null) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    updateScales(pendingY)
  })
}

function updateScales(cursorY: number) {
  const root = railEl.value
  if (!root) return
  // Select only [data-flat-index] (the main tick's own index) — sub-ticks deliberately use a
  // different attribute name (data-anchor-index) and are excluded from this query. Real bug
  // found in review: sub-ticks used to also carry data-flat-index="the anchored main tick's
  // index", colliding with the main tick's index; DOM order is main → sub → sub → nextMain…,
  // and the line below writes in DOM order with "later writes overwrite earlier ones", so
  // nearly every main tick stored the scale computed from its own last sub-tick (sub-ticks sit
  // a few px below the main tick, so the main tick's fisheye peak was systematically too small).
  // Sub-ticks still render via scaleStyle(anchorIndex) reading the same map — since the key is
  // the same and the value now comes only from the main tick itself, sub-ticks scale in sync
  // with their anchored main tick; visuals are unchanged but the value source is now correct.
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flat-index]'))
  const indices = els.map((el) => Number(el.dataset.flatIndex))
  const centers = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
  const out = computeFisheyeScales(centers, cursorY)
  const map: Record<number, number> = {}
  indices.forEach((idx, i) => { map[idx] = out[i] })
  scales.value = map
}

function onMouseLeave() {
  hoveredIndex.value = null
  scales.value = {}
}

// Main and sub ticks share this one handler: sub-ticks pass the anchorIndex they snap to, so
// the floating label naturally shows the time of "the main tick this sub-tick belongs to",
// consistent with the click-snap target.
//
// The offset is measured from the rects rather than from offsetTop: the ticks now live in
// .tm-rail-track (its own scroll container) while the label is a child of .tm-rail, so
// offsetTop would ignore the track's scrollTop and the label would drift once the rail
// scrolls. Rect math is scroll-correct by construction.
function onTickHover(e: MouseEvent, flatIndex: number) {
  hoveredIndex.value = flatIndex
  const root = railEl.value
  if (!root) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  hoverLabelTop.value = r.top - rootRect.top + r.height / 2
}

onUnmounted(() => { if (rafHandle !== null) cancelAnimationFrame(rafHandle) })

// The rail scrolls once the snapshots outgrow its height, and the deck/bottom
// bar were the only things following the selection -- pressing up/down past the
// visible range moved everything except the rail, which looked frozen.
//
// `block: 'nearest'` so an already-visible tick is left exactly where it is;
// anything else would yank the whole rail on every keypress.
watch(() => props.selectedIndex, async (index) => {
  await nextTick()
  const root = railEl.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-flat-index="${index}"]`)
  el?.scrollIntoView({ block: 'nearest' })
})

function scaleStyle(flatIndex: number) {
  const s = scales.value[flatIndex]
  return s ? { transform: `scaleX(${s})` } : undefined
}

const hoveredItem = computed(() => (hoveredIndex.value !== null ? itemByIndex.value[hoveredIndex.value] : null))
</script>

<template>
  <div ref="railEl" class="tm-rail" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <div class="tm-rail-track">
      <template v-for="node in nodes" :key="node.key">
        <div v-if="node.type === 'day'" class="tm-rail-day">{{ node.label }}</div>

        <button
          v-else-if="node.type === 'main'"
          type="button"
          class="tm-tick tm-tick-main"
          :class="[`type-${itemByIndex[node.flatIndex!]?.typeKind}`, { 'is-selected': node.flatIndex === props.selectedIndex }]"
          :data-flat-index="node.flatIndex"
          :style="scaleStyle(node.flatIndex!)"
          :aria-label="t('tmRailJumpTo', { time: itemByIndex[node.flatIndex!]?.time })"
          @mouseenter="onTickHover($event, node.flatIndex!)"
          @click="emit('select', node.flatIndex!)"
        ></button>

        <!-- Decorative sub-tick: not independently selectable (not a button; keyboard/screen
             readers skip it). Clicking it snaps to its owning main tick (anchorIndex). Note: this
             deliberately uses data-anchor-index and must not be changed back to data-flat-index —
             that would collide with the main tick's index; see the comment in updateScales(). -->
        <div
          v-else
          class="tm-tick tm-tick-sub"
          aria-hidden="true"
          :data-anchor-index="node.anchorIndex"
          :style="scaleStyle(node.anchorIndex!)"
          @mouseenter="onTickHover($event, node.anchorIndex!)"
          @click="emit('select', node.anchorIndex!)"
        ></div>
      </template>
    </div>

    <!-- The hover label deliberately lives at the .tm-rail level rather than as a child of the
         tick button: ticks use scaleX for continuous fisheye magnification, and a child label
         would be horizontally squashed by the parent transform. Compensating would require a
         reverse scaleX(1/parentScale) layer and threading the scale value down — extra coupling
         that easily miscomputes on intermediate frames while the scale changes. Moved out here
         as an absolutely positioned sibling rendered at the hovered item's position, it is not
         in the scaled element's subtree, so that transform cannot affect it —
         no numeric compensation needed; it structurally cannot be stretched. -->
    <span v-if="hoveredItem" class="tm-tick-label" :style="{ top: `${hoverLabelTop}px` }">{{ hoveredItem.time }}</span>
  </div>
</template>

<style scoped>
.tm-rail {
  /* Top starts below the gear, bottom hugs the bottom bar's top edge — exactly filling the
     span between the settings button and "enter this snapshot" (user feedback: ticks used to
     be crammed into a small strip at the very top). */
  position: absolute; top: 56px; right: 0; bottom: 104px; width: 96px;
  padding: 0 20px 0 0; z-index: 1;
  display: flex; flex-direction: column; align-items: flex-end;
  /* .tm-rail itself must NOT scroll: the hover label is positioned against it. Scrolling belongs
     to .tm-rail-track. The step buttons that used to be pinned at its two ends now live beside
     the card (see TimeMachineOverlay's .tm-deck-nav) -- they belong to the deck they move. */
}
.tm-rail-track {
  align-self: stretch; flex: 1 1 auto; min-height: 0;
  /* space-between spreads the ticks evenly over the full height instead of packing them at the
     top by content height. When there are too many snapshots to fit it degrades automatically
     (no spare space to distribute) back to normal top-down flow + scrolling, without pushing
     the first tick out of view — the key difference of space-between versus
     center/space-around; do not change to those two. */
  display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 2px;
  /* Per the CSS spec: when one axis is not visible, visible on the other axis is force-computed
     to auto — a split overflow-y: auto; overflow-x: visible would be a lie, the used values are
     auto on both axes. Explicit overflow: auto reflects what the browser actually does.
     During fisheye magnification ticks grow leftward via transform-origin: right center
     (widest 26px*2.2≈57px), and the content-box is 76px wide (96 - 20 padding), which leaves
     enough headroom to avoid clipping here. */
  overflow: auto; scrollbar-width: thin;
}
.tm-rail-day {
  width: 100%; text-align: right; margin-top: 6px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.5px;
  color: var(--tm-fg-muted);
}
.tm-rail-day:first-child { margin-top: 0; }
/* A tick is a 16px-tall transparent hit box with a 3px bar painted by ::after (user feedback:
   "that button on the right is very hard to hit"). It used to BE the 3px bar, i.e. a 26x3 px
   target with a 5px gap — and the fisheye only scales X, so the magnified tick under the
   cursor stayed 3px tall to the pointer no matter how wide it looked.
   The hit box height is deliberately constant across states: selection now only changes
   ::after, so no tick ever shifts by a pixel when the selection moves, and the fisheye
   distances stay stable while hovering. */
.tm-tick {
  position: relative; height: 16px; padding: 0; border: none; background: none;
  display: flex; align-items: center;
  transform-origin: right center; cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tm-tick::after {
  content: ''; display: block; width: 100%; height: 3px; border-radius: 2px;
  background: var(--tick-color);
  transition: height 0.15s var(--ease), background 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.tm-tick-main { width: 26px; --tick-color: var(--tm-rail); }
.tm-tick-sub { width: 18px; --tick-color: var(--tm-rail-sub); }
.tm-tick-main.type-manual { --tick-color: var(--accent); }
.tm-tick-main.type-preop { --tick-color: var(--dem-fg); }
.tm-tick-main.is-selected { --tick-color: var(--accent); }
.tm-tick-main.is-selected::after { height: 5px; box-shadow: 0 0 8px var(--accent-soft-2); }
.tm-tick-label {
  position: absolute; right: 34px; white-space: nowrap;
  font-size: 10px; font-weight: 600; color: var(--tm-fg);
  transform: translateY(-50%); pointer-events: none;
}
@media (prefers-reduced-motion: reduce) { .tm-tick, .tm-tick::after { transition: none; } }
</style>
