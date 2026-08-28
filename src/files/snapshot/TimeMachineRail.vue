<script setup lang="ts">
// The right-edge fisheye tick rail. Wholesale
// replacement of a previous, orphaned TimeMachineRail.vue (nothing imported it since
// TimeMachineOverlay.vue/TimeMachineDeck.vue were deleted). Ported from Vue2's `.tm-rail` region in
// the Vue 2 panel's src/components/filebrowser/components/TimeMachineStage.vue: day-grouped snapshot
// ticks, continuous cursor-driven fisheye magnification (rAF-throttled), a resting-state time
// label on every tick, a selected-tick accent line, and a 5-bar pulsing skeleton while loading.
//
// Re-read the whole Vue2
// `.tm-tick` template+style block to correct three compounding mistakes an earlier build made:
//
// 1. Vue2's per-tick time label (`.tm-tick__label`) is ALWAYS rendered at rest, right inside the
//    tick `<button>` itself, alongside the badge and the line (badge, label, line, in that DOM
//    order, right-aligned via `justify-content: flex-end` on the button) -- NOT a hover-only
//    floating sibling of `.tm-rail`. The earlier build's `hoveredItem`/`hoverLabelTop` machinery
//    (a single floating `<span>` positioned against whichever tick was last hovered) is gone
//    entirely; hover color changes are now pure CSS (`:hover`), matching Vue2's own
//    `.tm-tick:hover .tm-tick__label { color: #fff }` mechanism exactly.
//    THE FIXED-EXTENT RAIL REDESIGN BELOW SUPERSEDES THIS POINT: "always rendered at
//    rest" no longer holds unconditionally once the rail stopped scrolling -- see that section for
//    the full override.
// 2. Vue2's fisheye magnification (`transform: scale(...)`, template line 1408) scales the WHOLE
//    button uniformly -- line, label, and badge together -- not just a bar via `scaleX`. Now that
//    the label lives inside the button being scaled, `tickStyle` below still returns a uniform
//    `scale(...)` (not `scaleX(...)`) so the label visibly grows/shrinks with the line exactly as
//    it does in Vue2 -- the fixed-extent rail redesign below adds a `translateY(...)` alongside it, Vue2 has no
//    such displacement at all.
// 3. `.tm-tick` itself is `width: 100%` (a full-width flex row, Vue2's own literal shape) with the
//    line rendered as its `::after` (kept from the earlier build, still a valid flex item) -- the
//    PER-STATE bar width (26/34/40px) lives on `::after` itself, since the button's own width is
//    no longer the bar's width.
//
// Interface (this component's own binding contract, not a Vue2 deviation): props are `{ snapshots,
// current, loading }` (the RAW snapshot list + the selected snapshot's NAME) -- this component
// owns its own day-grouping (via storage/util/snapshotView's groupSnapshotsByDay, the same helper
// the storage-area timeline already uses) rather than trusting a caller to have already built it.
// `select` emits the snapshot's NAME (Vue2's own `switchTo(item.name)` convention), wired straight
// to `browse.switchTo` by TimeMachineStage.vue.
//
// Decorative sub-ticks between consecutive main (real snapshot) ticks are NOT a Vue2 behavior --
// Vue2 renders exactly one button per snapshot, nothing between them. They are carried over from
// an earlier mockup's "sparse form" design purely for visual tick density on a rail that can
// otherwise look sparse with few snapshots; this component rebuilds that same node-interleaving
// itself (keyed by snapshot NAME now, not a numeric flatIndex), rather than depending on
// timeMachineMath.ts's own now-dead buildRailNodes/computeFisheyeScales exports (both pruned, since
// nothing else referenced them). This
// remains an intentional, deliberate deviation from Vue2 --
// not something this redesign removes.
//
// The exact bug this component's own data-attribute split guards against (ported verbatim from
// a review-caught fix, kept because it is a real, previously-shipped defect,
// not a hypothetical): if sub-ticks carried the SAME identity attribute as the main tick they
// anchor to, updateFisheye()'s DOM-order "later write wins" map-building would let a sub-tick's
// rect (a few px below its anchor) silently clobber the anchor's own correctly-measured entry.
// Main ticks own `data-flat-index="<name>"` (the tick's own identity, and the ONLY thing
// updateFisheye() queries for); sub-ticks own a DIFFERENT attribute, `data-anchor-index="<name>"`
// (not queried for fisheye computation at all -- they simply read the same map entry their anchor
// already wrote, via tickStyle(), so they move/scale in visual lock-step with it without ever
// writing to it themselves).
//
// An earlier version of this component dropped two literal Vue2 `.tm-
// tick` visuals -- hover brightening and manual-type coloring -- reasoning that no approved token
// covered them. That's backwards; the token rule is to ADD a token when a Vue2 literal has
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
//
// --- Fixed-extent rail, no scroll -----------------------------------------------------
// Owner design change that OVERRIDES Vue2's own scroll-based rail model --
// Vue2's `.tm-rail` grows past its own box and lets
// the page/its own overflow scroll once there are enough snapshots; this app's rail is now a FIXED
// [top, bottom] band that NEVER scrolls, however many snapshots exist:
//
// 1. FIXED VERTICAL EXTENT: `top` sits below the gear button's own box (TimeMachineStage.vue's
//    `.tm-stage__gear`) plus a real clearance gap -- see this file's own style-block comment on
//    `.tm-rail` for the exact arithmetic and the source-pin test
//    (timeMachineDepthStackGeometryParity.test.ts) that keeps the two numbers from drifting apart.
//    `bottom` matches the SAME 80px reserved band `.tm-stage__bottom-bar`/`.tm-depth-stack` already
//    use (Vue2's own `$tm-bottom-gap`) -- the previous, unrelated `64px` literal here is gone.
//    `overflow-y: auto`/`scrollbar-width: thin` are removed outright (`overflow: visible` instead,
//    see that same style comment for why a small amount of edge overflow from the fisheye's own
//    BOUNDED displacement -- see fisheyeDisplacement's own header comment in timeMachineMath.ts --
//    is an accepted, expected edge case, not something worth clipping). The old `watch(() =>
//    props.current, ...)` `scrollIntoView` effect is deleted entirely, along with its old
//    test coverage (TimeMachineRail.test.ts) -- there is no scroll position left to correct; every
//    tick has a real resting slot inside the fixed band by construction (point 2 below), so the
//    selected tick is always already on screen.
// 2. ALL SNAPSHOTS MAP INTO THE FIXED EXTENT: `.tm-rail-track`'s own `justify-content:
//    space-between` (was `center`) spreads every rendered node (day headers, main ticks, sub-ticks)
//    evenly across the track's own full fixed height -- a plain CSS flex rule, no JS measurement
//    needed for this half of the requirement (same "let the browser do the layout math" posture
//    this file's own header comment already praises FileGridView.vue's `auto-fill` mechanism for
//    elsewhere in this app). Day-group ordering (newest day first, newest item first within a day,
//    `groupSnapshotsByDay`'s own contract) is unchanged -- `nodes` below still builds the SAME
//    ordered list, only the CONTAINER's own distribution rule changed.
// 3. FISHEYE DISPLACEMENT (the classic Apple/macOS-dock magnification kernel): with enough
//    snapshots, resting ticks packed into the fixed band can end up sitting very close together --
//    a nearby tick that only SCALES in place (Vue2's own, sole behavior) still visually collides
//    with its neighbors once it grows. `fisheyeDisplacement` (timeMachineMath.ts, this redesign's own
//    addition -- see its own header comment for the full kernel derivation: a signed, zero-sum-ish
//    "push near / compress far, both within radius, nothing beyond it" kernel, provably symmetric
//    and order-preserving) now returns a per-tick `{ offset, scale }` pair; `tickStyle` below
//    applies BOTH via one `transform: translateY(...) scale(...)`, still transform-only (GPU-cheap,
//    the same rAF-throttled `updateFisheye`/`onMouseMove` mechanism as before, mouse-leave still
//    resets the whole map to `{}`).
// 4. LABEL DENSITY (Apple/macOS-dock behavior): SUPERSEDES this file's own point 1 above ("always
//    rendered at rest") -- a fixed band with enough snapshots packed into it has no room to show
//    every tick's own HH:MM label without them visually overlapping, the exact thing "always
//    visible" could get away with while the rail could still grow/scroll. Day anchor labels are
//    UNCHANGED (always visible -- there is always room for the much sparser day headers). Per-tick
//    labels now go through `shouldShowTickLabel` (timeMachineMath.ts): visible when the rail is
//    roomy enough at rest (>= `TM_RAIL_LABEL_MIN_GAP` between consecutive main ticks, or the band
//    has not been measured yet -- fails open, same posture `resolveSlotPose`/`computeVisibleStripCap`
//    already take for "unmeasured") OR the tick is the CURRENT SELECTION (kept unconditionally --
//    the owner never asked for the selected tick's label to ever
//    disappear) OR the tick sits inside the fisheye's own magnified zone right now (`scale > 1` --
//    the whole point of the magnified region is to reveal detail a crowded rest state hides). The
//    hovered tick is, by construction, the one nearest the cursor -- almost always already inside
//    that magnified zone, so its label is already showing by the time `:hover`'s own existing color
//    rule (`--tm-rail-tick-hover`, unchanged) kicks in to visually emphasize it; no separate
//    "hovered" state needed on top of the fisheye-zone rule.
// 5. Keyboard/step/click semantics are UNCHANGED by this redesign: clicking a tick still emits
//    `select`; up/down stepping stays owned by TimeMachineStage.vue, unaffected by any of the
//    above. The loading skeleton (`.tm-tick-skeleton`) sits inside the SAME `.tm-rail`/
//    `.tm-rail-track` fixed band, so it is automatically bounded by this redesign's own geometry
//    without needing its own edit.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { groupSnapshotsByDay, type SnapshotDayGroup, type SnapshotItemView } from '../../storage/util/snapshotView'
import { fisheyeDisplacement, shouldShowTickLabel, type FisheyeDisplacement } from '../util/timeMachineMath'
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

// How many MAIN (real snapshot) ticks are on the rail right now -- the label-density
// threshold (shouldShowTickLabel) cares about the spacing between REAL ticks, not the decorative
// sub-ticks/day headers interleaved between them.
const mainCount = computed(() => nodes.value.reduce((n, node) => n + (node.type === 'main' ? 1 : 0), 0))

const fisheye = ref<Record<string, FisheyeDisplacement>>({})
const railEl = ref<HTMLElement | null>(null)
const trackEl = ref<HTMLElement | null>(null)
let rafHandle: number | null = null
let pendingY = 0

// The track's own measured content-box height, feeding shouldShowTickLabel's own
// "is the rail roomy enough at rest" check. Same ResizeObserver-guarded pattern
// TimeMachineDepthStack.vue's own stageHeight measurement already uses (guard `typeof
// ResizeObserver !== 'undefined'` -- jsdom has no ResizeObserver, so this stays at its own `0`
// default there, which shouldShowTickLabel's own "unmeasured -- fail open" contract already
// degrades gracefully from, see that function's own comment).
const bandHeight = ref(0)
let resizeObserver: ResizeObserver | null = null
function measureBand() {
  bandHeight.value = trackEl.value ? trackEl.value.clientHeight : 0
}

// Continuous magnification+displacement driven by cursor distance. A burst of mousemove events
// within one frame schedules only one recompute (rAF coalescing), and the callback uses the latest
// cursor Y -- pure CSS :hover can only do discrete steps, not a continuous function. Ported from
// Vue2's own onTickMouseMove/updateTickScales (same rAF-coalescing shape); this redesign extends the
// per-tick result from a bare scale number to a `{ offset, scale }` pair (fisheyeDisplacement).
function onMouseMove(e: MouseEvent) {
  pendingY = e.clientY
  if (rafHandle !== null) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    updateFisheye(pendingY)
  })
}

function updateFisheye(cursorY: number) {
  const root = railEl.value
  if (!root) return
  // Only [data-flat-index] (a main tick's own identity) -- see this file's own header comment for
  // why sub-ticks (data-anchor-index) are deliberately excluded from this query. Document order ==
  // top-to-bottom render order == ascending Y here (`nodes` is newest-first top-to-bottom, and the
  // track is a plain top-down flex column), matching fisheyeDisplacement's own "centers sorted
  // ascending" precondition (see that function's own header comment).
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flat-index]'))
  const names = els.map((el) => el.dataset.flatIndex as string)
  const centers = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
  const results = fisheyeDisplacement(centers, cursorY)
  const map: Record<string, FisheyeDisplacement> = {}
  names.forEach((name, i) => { map[name] = results[i] })
  fisheye.value = map
}

function onMouseLeave() {
  fisheye.value = {}
}

onMounted(() => {
  measureBand()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureBand())
    if (trackEl.value) resizeObserver.observe(trackEl.value)
  }
})
onUnmounted(() => {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle)
  resizeObserver?.disconnect()
  resizeObserver = null
})

// Uniform `scale(...)`, not `scaleX(...)`
// -- Vue2's own `transform: scale(...)` (template line 1408) grows the WHOLE tick (line + label +
// badge together), not just a bar. This redesign also applies the SAME entry's own `offset` as a
// `translateY(...)` ahead of the scale -- see this file's own header comment, point 3, for the
// kernel this comes from. Returns undefined (no inline transform at all) until the mouse has
// actually moved over the rail at least once (`fisheye.value[name]` unset) -- unchanged behavior
// from before this wave, `onMouseLeave` still resets the whole map so this reverts identically.
function tickStyle(name: string | undefined) {
  if (!name) return undefined
  const fx = fisheye.value[name]
  if (!fx) return undefined
  return { transform: `translateY(${fx.offset}px) scale(${fx.scale})` }
}

// Whether a MAIN tick's own per-tick HH:MM label should render right now -- see this
// file's own header comment, point 4, and shouldShowTickLabel's own comment (timeMachineMath.ts)
// for the full rule (roomy-at-rest OR selected OR inside the fisheye's own magnified zone).
function showLabel(item: SnapshotItemView): boolean {
  return shouldShowTickLabel({
    mainCount: mainCount.value,
    bandHeight: bandHeight.value,
    isSelected: item.name === props.current,
    scale: fisheye.value[item.name]?.scale ?? 1,
  })
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

    <div v-else ref="trackEl" class="tm-rail-track">
      <template v-for="node in nodes" :key="node.key">
        <div v-if="node.type === 'day'" class="tm-rail-day">{{ node.label }}</div>

        <!-- Badge + label are real
             children of the button (Vue2's own `.tm-tick__badge`/`.tm-tick__label` markup order --
             badge, label, line -- right-aligned by the button's own `justify-content: flex-end`,
             see the style block below). Per the label-density rule above (point 4), the label itself is now gated by
             `showLabel()` -- see this file's own header comment for the full rule; it is no longer
             unconditional. -->
        <button
          v-else-if="node.type === 'main'"
          type="button"
          class="tm-tick tm-tick-main"
          :class="[`type-${node.item!.typeKind}`, { 'is-selected': node.item!.name === props.current }]"
          :data-flat-index="node.item!.name"
          :style="tickStyle(node.item!.name)"
          :aria-label="t('tmRailJumpTo', { time: node.item!.time })"
          @click="emit('select', node.item!.name)"
        >
          <span v-if="node.item!.typeKind === 'manual'" class="tm-tick-badge" aria-hidden="true">
            ● {{ t('snapTypeManual') }}<template v-if="node.item!.label"> · {{ node.item!.label }}</template>
          </span>
          <span v-if="showLabel(node.item!)" class="tm-tick-label">{{ node.item!.time }}</span>
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
          :style="tickStyle(node.anchorName)"
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
   rail at any viewport width.
   `top`/`bottom` are new -- this file's own
   header comment, point 1, has the full rationale for WHY the rail is now a fixed band at all;
   this comment has the geometry ARITHMETIC. `top: 68px` clears TimeMachineStage.vue's own
   `.tm-stage__gear` box (`top: 20px` + `padding: 8px` top/bottom + the 20px icon = a 36px-tall
   button, bottom edge at 20+36=56px) plus a 12px clearance gap (this codebase's own established
   "real breathing room" magnitude -- timeMachineMath.ts's own VISIBLE_STRIP_MARGIN uses the same
   12px for an analogous "keep clear of an edge" purpose) = 56 + 12 = 68px. `bottom: 80px` (was an
   unrelated, mismatched `64px` literal) now matches the SAME reserved band
   `.tm-stage__bottom-bar`'s own height and `.tm-depth-stack`'s own `bottom` already use (Vue2's own
   `$tm-bottom-gap`) -- see timeMachineDepthStackGeometryParity.test.ts for the source-pin test
   keeping both of these numbers from silently drifting apart from the files they derive from.
   `overflow: visible` (was `overflow-y: auto` on the track below, `.tm-rail` itself never scrolled)
   -- this redesign removes scrolling entirely; a small amount of edge overflow from the fisheye's own
   BOUNDED displacement (fisheyeDisplacement, timeMachineMath.ts) is an accepted, expected edge
   case near the very top/bottom of the band, not something worth clipping (clipping a magnified
   tick's own glow/label mid-effect would look worse than a few stray px past the nominal edge). */
.tm-rail {
  position: absolute;
  top: 68px;
  right: 0;
  bottom: 80px;
  width: 220px;
  z-index: 9;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  overflow: visible;
}
.tm-rail-track {
  align-self: stretch;
  flex: 1 1 auto;
  min-height: 0;
  /* 12/70 left/right-ish padding (Vue2 literal): the 70px left buffer gives fisheye-magnified
     ticks (which grow leftward via transform-origin: right center) real room before the box edge
     clips them.
     `justify-content: space-between` (was `center`) -- spreads
     EVERY rendered node (day headers, main ticks, sub-ticks) evenly across the track's own full
     fixed height, a plain CSS flex rule doing "distribute the day-grouped ticks across the [fixed]
     band" with no JS measurement needed (this file's own header comment has the full rationale).
     `overflow: visible` (was `overflow-y: auto`/`overflow-x: hidden`/`scrollbar-width: thin`) --
     see `.tm-rail`'s own comment above for why nothing here scrolls or clips any more. */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2px;
  padding: 24px 12px 24px 70px;
  overflow: visible;
}
/* Skeleton bars are literal fixed px widths (unlike the real ticks above, which are full-width
   flex rows) -- `align-items: flex-end` right-aligns them against the rail's own edge, Vue2's own
   `.tm-rail--loading` literal (TimeMachineStage.vue:3396-3398, `justify-content: center` inherited
   unchanged from the base rule above). */
.tm-rail-track--loading { align-items: flex-end; }

/* Vue2's own literal margin
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

/* Full-width flex row (Vue2's own
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
   height/color/glow, sourced verbatim into --tm-accent/--tm-accent-glow).
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
   hover, 26 -> 34), restored here; the exact literal value is pinned by
   `--tm-rail-tick-hover` in theme.css (see that token's own comment there, not repeated here to
   avoid writing a bare color literal in this style block). Sub-ticks have no Vue2 counterpart to
   pin a width delta from, so only their color brightens, not their width. Vue2 does the same color
   brightening on the SELECTED tick too (its `:hover` rule has no exception for `--selected`) --
   unchanged here for the same reason. Pure CSS now (previously required a JS-driven
   `hoveredName`/floating-label mechanism since the label lived outside the button; now that it's
   a real child, `:hover` alone reaches it, matching Vue2's own mechanism exactly). This redesign
   is also the whole "hovered tick's label emphasized" requirement -- see this file's own
   header comment, point 4, for why no separate hover-specific label-visibility rule was needed
   (a hovered tick is, by construction, inside the fisheye's own magnified zone already). */
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

/* Loading skeleton: Vue2's own literal
   widths (`.tm-tick-skeleton:nth-child(N) { width: 55%/70%/42%/62%/48% }` of the rail's own 138px
   content box, TimeMachineStage.vue:3405-3409 -- 220-12-70 padding), converted to the equivalent
   literal px (~76/97/58/86/66px) since this component's own box isn't the exact same 138px
   reference (structural, non-color value -- fine as a literal, matching this file's own existing
   convention). Spacing is Vue2's own literal per-bar `margin: 9px 0` (3401, NOT a flex `gap` --
   `.tm-rail-track`'s inherited `gap: 2px`, unchanged from the non-loading track, still applies on
   top, matching Vue2's own combined total rather than a rounded approximation).
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
