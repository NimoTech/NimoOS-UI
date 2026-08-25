<script setup lang="ts">
// Task 8 (Files Time Machine Vue2-parity line): the right-edge fisheye tick rail. Wholesale
// replacement of the colleague's own orphaned TimeMachineRail.vue (nothing imported it since
// Task 6 deleted TimeMachineOverlay.vue/TimeMachineDeck.vue) -- see task-8-report.md for the full
// rewrite rationale. Ported from Vue2's `.tm-rail` region in
// NimoOS-UI/src/components/filebrowser/components/TimeMachineStage.vue: day-grouped snapshot
// ticks, continuous cursor-driven fisheye magnification (rAF-throttled), a hover time label, a
// selected-tick accent line, and a 5-bar pulsing skeleton while loading.
//
// Interface change vs the colleague's own version (this task's own binding contract, not a Vue2
// deviation): props are now `{ snapshots, current, loading }` (the RAW snapshot list + the
// selected snapshot's NAME), not colleague's own pre-grouped `{ groups, selectedIndex }` -- this
// component now owns its own day-grouping (via storage/util/snapshotView's groupSnapshotsByDay,
// the same helper the storage-area timeline already uses) rather than trusting a caller to have
// already built it. `select` emits the snapshot's NAME (Vue2's own `switchTo(item.name)`
// convention), not colleague's own numeric flatIndex -- TimeMachineStage.vue wires it straight to
// `browse.switchTo`.
//
// Decorative sub-ticks between consecutive main (real snapshot) ticks are NOT a Vue2 behavior --
// Vue2 renders exactly one button per snapshot, nothing between them. They are carried over from
// the colleague's own design (mockup #va's "sparse form" -- see buildRailNodes's own former header
// comment in timeMachineMath.ts, now pruned) purely for visual tick density on a rail that can
// otherwise look sparse with few snapshots; this component rebuilds that same node-interleaving
// itself (keyed by snapshot NAME now, not a numeric flatIndex), rather than depending on
// timeMachineMath.ts's own now-dead buildRailNodes/computeFisheyeScales exports (pruned in this
// same task -- see task-8-report.md for the grep confirming nothing else referenced them).
//
// The exact bug this component's own data-attribute split guards against (ported verbatim from
// the colleague's own review-caught fix, kept because it is a real, previously-shipped defect,
// not a hypothetical): if sub-ticks carried the SAME identity attribute as the main tick they
// anchor to, updateScales()'s DOM-order "later write wins" map-building would let a sub-tick's
// rect (a few px below its anchor) silently clobber the anchor's own correctly-measured scale.
// Main ticks own `data-flat-index="<name>"` (the tick's own identity, and the ONLY thing
// updateScales() queries for); sub-ticks own a DIFFERENT attribute, `data-anchor-index="<name>"`
// (not queried for scale computation at all -- they simply read the same map entry their anchor
// already wrote, via scaleStyle(), so they scale in visual lock-step with it without ever writing
// to it themselves).
//
// Fix round (controller ruling): the initial version of this task dropped two literal Vue2 `.tm-
// tick` visuals -- hover brightening and manual-type coloring -- reasoning that no approved token
// covered them. Ruling: that's backwards; the token rule is to ADD a token when a Vue2 literal has
// no match, never to drop the visual. Both are restored here, pixel-pinned via two new tokens
// (`--tm-rail-tick-hover`/`--tm-rail-tick-manual`, theme.css). One correction made in the same
// pass, verified by re-reading the whole Vue2 `.tm-tick` CSS block: Vue2 does NOT recolor the
// tick's own LINE by type -- `tm-tick--auto`/`tm-tick--preop`/`tm-tick--manual` are all rendered
// (every tick gets one), but only `.tm-tick--selected` and `.tm-tick__badge` (shown only for
// typeKind === 'manual', a SEPARATE element next to the line, not the line itself) carry any CSS
// rule at all -- auto and preop are visually identical to each other in Vue2 (plain --tm-rail
// line, no badge). So "per-type tick coloring" here means: the `type-<kind>` class is still
// applied to every main tick (matching Vue2's own `tm-tick--<kind>` on every tick), but only
// `type-manual` has an associated CSS rule (the badge's own color) -- `type-auto`/`type-preop`
// exist purely as hooks, unstyled, exactly as they are in Vue2's own source.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { groupSnapshotsByDay, type SnapshotDayGroup, type SnapshotItemView } from '../../storage/util/snapshotView'
import { fisheyeScale } from '../util/timeMachineMath'
import type { SnapshotVM } from '../stores/snapshotBrowse'

defineOptions({ name: 'TimeMachineRail' })

const props = defineProps<{
  snapshots: SnapshotVM[]
  current: string | null
  loading: boolean
}>()
const emit = defineEmits<{ (e: 'select', name: string): void }>()

const { t } = useI18n()

interface RailNode {
  type: 'day' | 'main' | 'sub'
  key: string
  /** Day label text, when type === 'day' */
  label?: string
  /** The snapshot this tick represents, when type === 'main' */
  item?: SnapshotItemView
  /** The main tick's own name this sub-tick snaps/scales to, when type === 'sub' */
  anchorName?: string
}

// How many decorative filler ticks sit between two consecutive real (main) ticks -- see this
// file's own header comment for why this exists at all (not a Vue2 behavior).
const SUB_PER_GAP = 2

const dayGroups = computed<SnapshotDayGroup[]>(() => groupSnapshotsByDay(props.snapshots || []))

const itemByName = computed(() => {
  const map: Record<string, SnapshotItemView> = {}
  for (const g of dayGroups.value) for (const it of g.items) map[it.name] = it
  return map
})

// Flattens the already-day-grouped, newest-first snapshot list into one render-order node list,
// then interleaves SUB_PER_GAP decorative sub-ticks between every pair of consecutive main ticks
// (never before the first or after the last -- there is nothing to interpolate "toward" there).
const nodes = computed<RailNode[]>(() => {
  const out: RailNode[] = []
  const mainAt: number[] = []
  for (const g of dayGroups.value) {
    out.push({ type: 'day', key: `day-${g.dayKey}`, label: g.label.i18nKey ? t(g.label.i18nKey) : g.label.text })
    for (const item of g.items) {
      out.push({ type: 'main', key: `main-${item.name}`, item })
      mainAt.push(out.length - 1)
    }
  }
  if (SUB_PER_GAP <= 0 || mainAt.length < 2) return out
  // Insert back-to-front so earlier splice indices stay valid as the array grows.
  const withSubs = [...out]
  for (let i = mainAt.length - 2; i >= 0; i--) {
    const anchor = withSubs[mainAt[i]].item as SnapshotItemView
    const subs: RailNode[] = Array.from({ length: SUB_PER_GAP }, (_, j) => (
      { type: 'sub' as const, key: `sub-${anchor.name}-${j}`, anchorName: anchor.name }
    ))
    withSubs.splice(mainAt[i] + 1, 0, ...subs)
  }
  return withSubs
})

const scales = ref<Record<string, number>>({})
const hoveredName = ref<string | null>(null)
// Vertical position (px) of the floating label relative to .tm-rail — computed once at
// mouseenter, not recomputed in the fisheye rAF loop; the label must not jitter with the cursor.
const hoverLabelTop = ref(0)
const railEl = ref<HTMLElement | null>(null)
let rafHandle: number | null = null
let pendingY = 0

// Continuous magnification driven by cursor distance. A burst of mousemove events within one
// frame schedules only one recompute (rAF coalescing), and the callback uses the latest cursor
// Y — pure CSS :hover can only do discrete steps, not a continuous function. Ported from Vue2's
// own onTickMouseMove/updateTickScales (same rAF-coalescing shape).
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
  // Only [data-flat-index] (a main tick's own identity) -- see this file's own header comment for
  // why sub-ticks (data-anchor-index) are deliberately excluded from this query.
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flat-index]'))
  const names = els.map((el) => el.dataset.flatIndex as string)
  const centers = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
  const map: Record<string, number> = {}
  names.forEach((name, i) => { map[name] = fisheyeScale(centers[i] - cursorY) })
  scales.value = map
}

function onMouseLeave() {
  hoveredName.value = null
  scales.value = {}
}

// Main and sub ticks share this one handler: sub-ticks pass the anchorName they snap to, so the
// floating label naturally shows the time of "the main tick this sub-tick belongs to", consistent
// with the click-snap target.
//
// The offset is measured from the rects rather than from offsetTop: the ticks live in
// .tm-rail-track (its own scroll container) while the label is a child of .tm-rail, so offsetTop
// would ignore the track's scrollTop and the label would drift once the rail scrolls. Rect math is
// scroll-correct by construction.
function onTickHover(e: MouseEvent, name: string) {
  hoveredName.value = name
  const root = railEl.value
  if (!root) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  hoverLabelTop.value = r.top - rootRect.top + r.height / 2
}

onUnmounted(() => { if (rafHandle !== null) cancelAnimationFrame(rafHandle) })

// The rail scrolls once the snapshots outgrow its height -- pressing up/down (or clicking a tick
// off-screen) past the visible range must not leave the rail looking frozen while the deck/bottom
// bar follow along. `block: 'nearest'` so an already-visible tick is left exactly where it is;
// anything else would yank the whole rail on every selection change.
watch(() => props.current, async (name) => {
  if (!name) return
  await nextTick()
  const root = railEl.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-flat-index="${name}"]`)
  el?.scrollIntoView({ block: 'nearest' })
})

function scaleStyle(name: string | undefined) {
  if (!name) return undefined
  const s = scales.value[name]
  return s ? { transform: `scaleX(${s})` } : undefined
}

const hoveredItem = computed(() => (hoveredName.value ? itemByName.value[hoveredName.value] ?? null : null))
</script>

<template>
  <div ref="railEl" class="tm-rail" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <!-- Loading affordance: a handful of pulsing placeholder ticks in the same rail slot the real
         ticks will occupy once the snapshot list fetch resolves, rather than a blank rail or a
         layout jump — Vue2 parity (its own tm-rail--loading skeleton). Purely decorative
         (aria-hidden), never clickable. -->
    <div v-if="loading" class="tm-rail-track tm-rail-track--loading" aria-hidden="true">
      <div v-for="n in 5" :key="`tick-skeleton-${n}`" class="tm-tick-skeleton" :style="{ animationDelay: `${n * 0.12}s` }"></div>
    </div>

    <div v-else class="tm-rail-track">
      <template v-for="node in nodes" :key="node.key">
        <div v-if="node.type === 'day'" class="tm-rail-day">{{ node.label }}</div>

        <button
          v-else-if="node.type === 'main'"
          type="button"
          class="tm-tick tm-tick-main"
          :class="[`type-${node.item!.typeKind}`, { 'is-selected': node.item!.name === props.current }]"
          :data-flat-index="node.item!.name"
          :style="scaleStyle(node.item!.name)"
          :aria-label="t('tmRailJumpTo', { time: node.item!.time })"
          @mouseenter="onTickHover($event, node.item!.name)"
          @click="emit('select', node.item!.name)"
        >
          <!-- Manual-snapshot badge -- Vue2 parity (`.tm-tick__badge`, shown only for
               typeKind === 'manual', with an optional user label appended). auto/preop render no
               badge at all in Vue2, so none is rendered here either -- see this file's own header
               comment (fix round) for the full account of what "per-type coloring" does and does
               not mean in the real Vue2 source. -->
          <span v-if="node.item!.typeKind === 'manual'" class="tm-tick-badge" aria-hidden="true">
            ● {{ t('snapTypeManual') }}<template v-if="node.item!.label"> · {{ node.item!.label }}</template>
          </span>
        </button>

        <!-- Decorative sub-tick: not independently selectable (not a button; keyboard/screen
             readers skip it). Clicking it snaps to its owning main tick (anchorName). Must not
             carry data-flat-index — see this file's own header comment for the exact bug that
             collision used to cause. -->
        <div
          v-else
          class="tm-tick tm-tick-sub"
          aria-hidden="true"
          :data-anchor-index="node.anchorName"
          :style="scaleStyle(node.anchorName)"
          @mouseenter="onTickHover($event, node.anchorName!)"
          @click="emit('select', node.anchorName!)"
        ></div>
      </template>
    </div>

    <!-- The hover label deliberately lives at the .tm-rail level rather than as a child of the
         tick button: ticks use scaleX for continuous fisheye magnification, and a child label
         would be horizontally squashed by the parent transform. Rendered as an absolutely
         positioned sibling at the hovered item's own position, it structurally cannot be
         stretched by that transform — no reverse-scale compensation needed. -->
    <span v-if="hoveredItem" class="tm-tick-label" :style="{ top: `${hoverLabelTop}px` }">{{ hoveredItem.time }}</span>
  </div>
</template>

<style scoped>
/* 220px (TM_RAIL_WIDTH, timeMachineMath.ts) fixed right-edge band -- Vue2 parity byte-for-byte
   (`.tm-rail`'s own width). `.tm-stage__hold--active` already reserves this band (plus the
   stepper's own 60px) via padding-right, so the floating window's box cannot extend under this
   rail at any viewport width. `.tm-rail` itself must NOT scroll — the hover label is positioned
   against it; scrolling belongs to `.tm-rail-track` alone. */
.tm-rail {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 64px;
  width: 220px;
  z-index: 9;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.tm-rail-track {
  align-self: stretch;
  flex: 1 1 auto;
  min-height: 0;
  /* 24/12/70 padding (Vue2 literal): the 70px left buffer gives fisheye-magnified ticks (which
     grow leftward via transform-origin: right center) real room before the box edge clips them.
     space-between spreads ticks evenly over the full height when they fit; with too many to fit
     it degrades automatically (no spare space to distribute) back to normal top-down flow plus
     scrolling, without ever pushing the first tick out of view. */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2px;
  padding: 24px 12px 24px 70px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}
.tm-rail-track--loading { align-items: flex-end; justify-content: center; gap: 12px; }

.tm-rail-day {
  width: 100%;
  text-align: right;
  margin-top: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tm-rail-text-dim);
}
.tm-rail-day:first-child { margin-top: 0; }

/* A tick is a 16px-tall transparent hit box with a bar painted by ::after — a small usability
   improvement over Vue2's own raw thin-line hit target, not a Vue2 behavior. The hit box height
   stays constant across states (selection only changes ::after), so no tick ever shifts by a
   pixel when the selection moves, and fisheye distances stay stable while hovering. */
.tm-tick {
  position: relative;
  height: 16px;
  padding: 0;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  transform-origin: right center;
  cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tm-tick::after {
  content: '';
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 2px;
  background: var(--tick-color);
  transition: height 0.15s var(--ease), background 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.tm-tick-main { width: 26px; --tick-color: var(--tm-rail); }
.tm-tick-sub { width: 18px; --tick-color: var(--tm-rail-sub); }
/* Selected accent line — Vue2 parity (`.tm-tick--selected .tm-tick__line`'s own literal color +
   glow, both sourced verbatim into --tm-accent/--tm-accent-glow, see task-1-report.md). */
.tm-tick-main.is-selected { --tick-color: var(--tm-accent); }
.tm-tick-main.is-selected::after { height: 3px; box-shadow: 0 0 8px var(--tm-accent-glow); }

/* Hover brightening — Vue2 parity (`.tm-tick:hover .tm-tick__line`'s own literal background
   color and width), restored per controller ruling; the exact literal value is pinned by
   `--tm-rail-tick-hover` in theme.css (see that token's own comment there, not repeated here to
   avoid writing a bare color literal in this style block). The +8px resting-width growth on
   hover is Vue2's own literal delta for the main tick (26 -> 34); sub-ticks have no Vue2
   counterpart to pin a delta from, so only their color brightens, not their width. Vue2 does the
   same color brightening on the SELECTED tick too (its `:hover` rule has no exception for
   `--selected`) -- unchanged here for the same reason. */
.tm-tick-main:hover { width: 34px; }
.tm-tick-main:hover::after,
.tm-tick-sub:hover::after {
  background: var(--tm-rail-tick-hover);
}

.tm-tick-badge {
  position: absolute;
  right: 100%;
  margin-right: 6px;
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: 10px;
  color: var(--tm-rail-tick-manual);
  pointer-events: none;
}

.tm-tick-label {
  position: absolute;
  right: 34px;
  white-space: nowrap;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  /* Only ever rendered while a tick is being hovered (see the template's own `v-if="hoveredItem"`)
     -- so it always shows Vue2's own hover-brightened label color, never the resting one. */
  color: var(--tm-rail-tick-hover);
  transform: translateY(-50%);
  pointer-events: none;
}

/* Loading skeleton: reuses the sub-tick's own faint color (there is no dedicated skeleton token in
   the approved Task 1 set, and this task is not authorized to add one for a purely decorative
   loading placeholder). */
.tm-tick-skeleton {
  height: 2px;
  border-radius: 2px;
  background: var(--tm-rail-sub);
  animation: tm-rail-skeleton-pulse 1.1s ease-in-out infinite;
}
.tm-tick-skeleton:nth-child(1) { width: 22px; }
.tm-tick-skeleton:nth-child(2) { width: 28px; }
.tm-tick-skeleton:nth-child(3) { width: 17px; }
.tm-tick-skeleton:nth-child(4) { width: 25px; }
.tm-tick-skeleton:nth-child(5) { width: 19px; }
@keyframes tm-rail-skeleton-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.75; }
}

@media (prefers-reduced-motion: reduce) { .tm-tick, .tm-tick::after { transition: none; } }
</style>
