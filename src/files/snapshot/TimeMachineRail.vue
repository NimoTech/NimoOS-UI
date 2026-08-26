<script setup lang="ts">
// Task 8 (Files Time Machine Vue2-parity line): the right-edge fisheye tick rail. Wholesale
// replacement of the colleague's own orphaned TimeMachineRail.vue (nothing imported it since
// Task 6 deleted TimeMachineOverlay.vue/TimeMachineDeck.vue) -- see task-8-report.md for the full
// rewrite rationale. Ported from Vue2's `.tm-rail` region in
// NimoOS-UI/src/components/filebrowser/components/TimeMachineStage.vue: day-grouped snapshot
// ticks, continuous cursor-driven fisheye magnification (rAF-throttled), a resting-state time
// label on every tick, a selected-tick accent line, and a 5-bar pulsing skeleton while loading.
//
// Fix wave A2 (audit-stage.md #12, priority list items 1/2/7/16): re-read the whole Vue2
// `.tm-tick` template+style block to correct three compounding mistakes the earlier build made:
//
// 1. Vue2's per-tick time label (`.tm-tick__label`) is ALWAYS rendered at rest, right inside the
//    tick `<button>` itself, alongside the badge and the line (badge, label, line, in that DOM
//    order, right-aligned via `justify-content: flex-end` on the button) -- NOT a hover-only
//    floating sibling of `.tm-rail`. The earlier build's `hoveredItem`/`hoverLabelTop` machinery
//    (a single floating `<span>` positioned against whichever tick was last hovered) is gone
//    entirely; hover color changes are now pure CSS (`:hover`), matching Vue2's own
//    `.tm-tick:hover .tm-tick__label { color: #fff }` mechanism exactly, and there is nothing left
//    for `onTickHover`/`itemByName`/`hoveredName` to do, so they are deleted rather than kept as
//    dead code.
// 2. Vue2's fisheye magnification (`transform: scale(...)`, template line 1408) scales the WHOLE
//    button uniformly -- line, label, and badge together -- not just a bar via `scaleX`. Now that
//    the label lives inside the button being scaled, `scaleStyle` below returns a uniform
//    `scale(...)` (not `scaleX(...)`) so the label visibly grows/shrinks with the line exactly as
//    it does in Vue2.
// 3. `.tm-tick` itself is now `width: 100%` (a full-width flex row, Vue2's own literal shape) with
//    the line rendered as its `::after` (kept from the earlier build, still a valid flex item) --
//    the PER-STATE bar width (26/34/40px) that used to live on the button itself now lives on
//    `::after` instead, since the button's own width is no longer the bar's width.
//
// Interface (this task's own binding contract, not a Vue2 deviation): props are `{ snapshots,
// current, loading }` (the RAW snapshot list + the selected snapshot's NAME) -- this component
// owns its own day-grouping (via storage/util/snapshotView's groupSnapshotsByDay, the same helper
// the storage-area timeline already uses) rather than trusting a caller to have already built it.
// `select` emits the snapshot's NAME (Vue2's own `switchTo(item.name)` convention), wired straight
// to `browse.switchTo` by TimeMachineStage.vue.
//
// Decorative sub-ticks between consecutive main (real snapshot) ticks are NOT a Vue2 behavior --
// Vue2 renders exactly one button per snapshot, nothing between them. They are carried over from
// the colleague's own design (mockup #va's "sparse form" -- see buildRailNodes's own former header
// comment in timeMachineMath.ts, now pruned) purely for visual tick density on a rail that can
// otherwise look sparse with few snapshots; this component rebuilds that same node-interleaving
// itself (keyed by snapshot NAME now, not a numeric flatIndex), rather than depending on
// timeMachineMath.ts's own now-dead buildRailNodes/computeFisheyeScales exports (pruned in this
// same task -- see task-8-report.md for the grep confirming nothing else referenced them). This
// remains an intentional, owner-flagged-in-code deviation (audit-stage.md priority list item 15) --
// not something this wave removes.
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
// rule at all -- auto and preop are visually identical to each other in Vue2 (plain
// --tm-rail-tick line, no badge). So "per-type tick coloring" here means: the `type-<kind>` class is still
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
  scales.value = {}
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

// Fix wave A2 (audit-stage.md #12, priority list item 2): uniform `scale(...)`, not `scaleX(...)`
// -- Vue2's own `transform: scale(...)` (template line 1408) grows the WHOLE tick (line + label +
// badge together), not just a bar. Applied to the whole `<button>`/`<div>`, same as before.
function scaleStyle(name: string | undefined) {
  if (!name) return undefined
  const s = scales.value[name]
  return s ? { transform: `scale(${s})` } : undefined
}
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

        <!-- Fix wave A2 (audit-stage.md #12, priority list item 1): badge + label are now real
             children of the button, ALWAYS rendered (not hover-gated) -- Vue2's own
             `.tm-tick__badge`/`.tm-tick__label` markup order (badge, label, line), right-aligned
             by the button's own `justify-content: flex-end` (see the style block below). -->
        <button
          v-else-if="node.type === 'main'"
          type="button"
          class="tm-tick tm-tick-main"
          :class="[`type-${node.item!.typeKind}`, { 'is-selected': node.item!.name === props.current }]"
          :data-flat-index="node.item!.name"
          :style="scaleStyle(node.item!.name)"
          :aria-label="t('tmRailJumpTo', { time: node.item!.time })"
          @click="emit('select', node.item!.name)"
        >
          <span v-if="node.item!.typeKind === 'manual'" class="tm-tick-badge" aria-hidden="true">
            ● {{ t('snapTypeManual') }}<template v-if="node.item!.label"> · {{ node.item!.label }}</template>
          </span>
          <span class="tm-tick-label">{{ node.item!.time }}</span>
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
          @click="emit('select', node.anchorName!)"
        ></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 220px (TM_RAIL_WIDTH, timeMachineMath.ts) fixed right-edge band -- Vue2 parity byte-for-byte
   (`.tm-rail`'s own width). `.tm-stage__hold--active` already reserves this band (plus the
   stepper's own 60px) via padding-right, so the floating window's box cannot extend under this
   rail at any viewport width. `.tm-rail` itself must NOT scroll — the ticks live in
   `.tm-rail-track` alone, which owns the scroll container. */
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
     Fix wave A2 (audit-stage.md #12, priority list item 7): `justify-content: center` (Vue2's own
     literal, TimeMachineStage.vue:3384) -- vertically centers the WHOLE tick stack as one group
     within the rail's available height. `space-between` (the previous value) instead spread ticks
     across the full available height whenever there were fewer than fit, a visibly different
     layout for the common case of a snapshot count that doesn't already fill the rail. Degrades
     automatically with too many ticks to fit (no spare space to distribute) back to normal
     top-down flow plus scrolling, without ever pushing the first tick out of view. */
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 24px 12px 24px 70px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}
/* Skeleton bars are literal fixed px widths (unlike the real ticks above, which are full-width
   flex rows) -- `align-items: flex-end` right-aligns them against the rail's own edge, Vue2's own
   `.tm-rail--loading` literal (TimeMachineStage.vue:3396-3398, `justify-content: center` inherited
   unchanged from the base rule above). */
.tm-rail-track--loading { align-items: flex-end; }

/* Fix wave A2 (audit-stage.md #12, priority list item 16): Vue2's own literal margin
   (`10px 4px 4px 0`, TimeMachineStage.vue:3420) and text-shadow (`--tm-rail-text-shadow`, new
   token, see theme.css) -- the port previously lost the 4px right/bottom margins and added a
   font-weight Vue2 never sets (day labels are plain 400 weight in Vue2, inherited, not declared). */
.tm-rail-day {
  width: 100%;
  text-align: right;
  margin: 10px 4px 4px 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tm-rail-text-dim);
  text-shadow: var(--tm-rail-text-shadow);
}
.tm-rail-day:first-child { margin-top: 0; }

/* Fix wave A2 (audit-stage.md #12, priority list items 1/2/16): full-width flex row (Vue2's own
   literal shape, `.tm-tick { display:flex; align-items:center; justify-content:flex-end; gap:8px;
   width:100% }`, TimeMachineStage.vue:3425-3436) hosting badge/label/line as real flex children
   (right-aligned, growing leftward) -- not a bare hit-box bar any more. Transition duration/easing
   ported literally (`transform 0.18s ease`, 3436) -- plain `ease`, not `var(--ease)`'s custom
   cubic-bezier curve, and 0.18s (not 0.12s) -- the port's own bouncy overshoot easing was a
   substitution error, not a Vue2 behavior. */
.tm-tick {
  position: relative;
  width: 100%;
  padding: 3px 0;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  transform-origin: right center;
  cursor: pointer;
  transition: transform 0.18s ease;
}
/* The line itself -- still a flex item via `::after` (kept from the earlier build, valid inside a
   flex parent), now sized per-state on ITSELF rather than on the button (the button is full-width
   now, so its own width is no longer the bar's width). `transition: all 0.18s` is Vue2's own
   literal (`.tm-tick__line`, 3450) -- no easing keyword declared there, so the browser default
   (`ease`) applies, unchanged from before. */
.tm-tick::after {
  content: '';
  display: block;
  height: 2px;
  border-radius: 2px;
  transition: all 0.18s;
}
.tm-tick-main::after { width: 26px; background: var(--tm-rail-tick); }
.tm-tick-sub::after { width: 18px; background: var(--tm-rail-tick-sub); }

/* Selected accent line — Vue2 parity (`.tm-tick--selected .tm-tick__line`'s own literal width/
   height/color/glow, sourced verbatim into --tm-accent/--tm-accent-glow, see task-1-report.md).
   `width: 40px` is Vue2's own literal resting width for a selected tick (visibly wider than the
   26px default); it still loses to `.tm-tick-main:hover`'s own 34px below on hover, because that
   rule is declared LATER in this file and both selectors carry equal specificity (two classes)
   -- same "hover wins the tie" outcome Vue2's own cascade produces. Glow blur is 10px, Vue2's own
   literal (not 8px). Label color/weight ported alongside (`.tm-tick--selected .tm-tick__label`,
   3466) -- reuses `--tm-rail-tick-hover`, the SAME literal Vue2 pins for this rule (see that
   token's own comment in theme.css for the exact value, not repeated here to avoid writing a bare
   color literal in this style block). */
.tm-tick-main.is-selected::after { background: var(--tm-accent); width: 40px; height: 3px; box-shadow: 0 0 10px var(--tm-accent-glow); }
.tm-tick-main.is-selected .tm-tick-label { color: var(--tm-rail-tick-hover); font-weight: 700; }

/* Hover brightening — Vue2 parity (`.tm-tick:hover .tm-tick__line`/`.tm-tick:hover
   .tm-tick__label`'s own literal colors and the main tick's own +8px resting-width growth on
   hover, 26 -> 34), restored per controller ruling; the exact literal value is pinned by
   `--tm-rail-tick-hover` in theme.css (see that token's own comment there, not repeated here to
   avoid writing a bare color literal in this style block). Sub-ticks have no Vue2 counterpart to
   pin a width delta from, so only their color brightens, not their width. Vue2 does the same color
   brightening on the SELECTED tick too (its `:hover` rule has no exception for `--selected`) --
   unchanged here for the same reason. Pure CSS now (previously required a JS-driven
   `hoveredName`/floating-label mechanism since the label lived outside the button; now that it's
   a real child, `:hover` alone reaches it, matching Vue2's own mechanism exactly). */
.tm-tick-main:hover::after { width: 34px; }
.tm-tick:hover::after { background: var(--tm-rail-tick-hover); }
.tm-tick:hover .tm-tick-label { color: var(--tm-rail-tick-hover); }

.tm-tick-label {
  font-size: 11.5px;
  color: var(--tm-rail-text);
  font-variant-numeric: tabular-nums;
  text-shadow: var(--tm-rail-text-shadow);
  transition: color 0.18s;
  white-space: nowrap;
}

.tm-tick-badge {
  font-size: 10px;
  color: var(--tm-rail-tick-manual);
  text-shadow: var(--tm-rail-text-shadow);
  white-space: nowrap;
  pointer-events: none;
}

/* Loading skeleton: fix wave A2 (audit-stage.md #11, priority list item 10) -- Vue2's own literal
   widths (`.tm-tick-skeleton:nth-child(N) { width: 55%/70%/42%/62%/48% }` of the rail's own 138px
   content box, TimeMachineStage.vue:3405-3409 -- 220-12-70 padding), converted to the equivalent
   literal px (~76/97/58/86/66px) since this component's own box isn't the exact same 138px
   reference (structural, non-color value -- fine as a literal, matching this file's own existing
   convention). Spacing is Vue2's own literal per-bar `margin: 9px 0` (3401, NOT a flex `gap` --
   `.tm-rail-track`'s inherited `gap: 2px`, unchanged from the non-loading track, still applies on
   top, matching Vue2's own combined total rather than the audit's own rounded approximation).
   Color is `--tm-rail-skeleton` (new token, 0.28 alpha) -- distinct from `--tm-rail-tick-sub`
   (0.2 alpha), which the earlier build incorrectly reused here; Vue2 pins a different alpha for
   the loading placeholder than for any real tick. */
.tm-tick-skeleton {
  height: 2px;
  margin: 9px 0;
  border-radius: 2px;
  background: var(--tm-rail-skeleton);
  animation: tm-rail-skeleton-pulse 1.1s ease-in-out infinite;
}
.tm-tick-skeleton:nth-child(1) { width: 76px; }
.tm-tick-skeleton:nth-child(2) { width: 97px; }
.tm-tick-skeleton:nth-child(3) { width: 58px; }
.tm-tick-skeleton:nth-child(4) { width: 86px; }
.tm-tick-skeleton:nth-child(5) { width: 66px; }
@keyframes tm-rail-skeleton-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.75; }
}

@media (prefers-reduced-motion: reduce) { .tm-tick, .tm-tick::after { transition: none; } }
</style>
