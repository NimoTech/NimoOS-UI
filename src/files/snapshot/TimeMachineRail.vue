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
function onTickHover(e: MouseEvent, flatIndex: number) {
  hoveredIndex.value = flatIndex
  const el = e.currentTarget as HTMLElement
  hoverLabelTop.value = el.offsetTop + el.offsetHeight / 2
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
  /* Top starts below the gear (gear top:16 + ~24px height), bottom hugs the bottom bar's top
     edge — exactly filling the span between the settings button and "enter this snapshot"
     (user feedback: ticks used to be crammed into a small strip at the very top). */
  position: absolute; top: 48px; right: 0; bottom: 76px; width: 96px;
  padding: 4px 20px 4px 0; z-index: 1;
  /* space-between spreads the ticks evenly over the full height instead of packing them at the
     top by content height. When there are too many snapshots to fit it degrades automatically
     (no spare space to distribute) back to normal top-down flow + scrolling, without pushing
     the first tick out of view — the key difference of space-between versus
     center/space-around; do not change to those two. */
  display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 5px;
  /* Per the CSS spec: when one axis is not visible, visible on the other axis is force-computed
     to auto — the previous split overflow-y: auto; overflow-x: visible was a lie, the used
     values were auto on both axes. Changed to an explicit overflow: auto to honestly reflect
     what the browser actually does. During fisheye magnification ticks grow leftward via
     transform-origin: right center (widest 26px*2.2≈57px), and the content-box is 76px wide
     (96 - 20 padding), which leaves enough headroom to avoid clipping here. */
  overflow: auto; scrollbar-width: thin;
}
.tm-rail-day {
  width: 100%; text-align: right; margin-top: 6px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.5px;
  color: var(--tm-fg-muted);
}
.tm-rail-day:first-child { margin-top: 0; }
.tm-tick {
  position: relative; height: 3px; border: none; padding: 0; border-radius: 2px;
  transform-origin: right center; cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s var(--ease);
}
.tm-tick-main { width: 26px; background: var(--tm-rail); }
.tm-tick-sub { width: 18px; background: var(--tm-rail-sub); }
.tm-tick-main.type-manual { background: var(--accent); }
.tm-tick-main.type-preop { background: var(--dem-fg); }
.tm-tick-main.is-selected { height: 4px; background: var(--accent); box-shadow: 0 0 8px var(--accent-soft-2); }
.tm-tick-label {
  position: absolute; right: 34px; white-space: nowrap;
  font-size: 10px; font-weight: 600; color: var(--tm-fg);
  transform: translateY(-50%); pointer-events: none;
}
@media (prefers-reduced-motion: reduce) { .tm-tick { transition: none; } }
</style>
