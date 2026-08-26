<!--
  Task 7 (Files Time Machine Vue2-parity line): the Apple-style depth-stack cascade that sits
  behind the real, live window while Time Machine mode is active -- one real, static
  <snapshot-preview-window> per visible dolly slot (Task 2's resolveDollySlots/resolveSlotPose),
  plus a separate `__dim` overlay per strip for the brightness falloff. See timeMachineMath.ts's
  own header comment and TimeMachineStage.vue's own header comment (z-tier chart) for the model
  this ports byte-for-byte from Vue2's TimeMachineStage.vue depth-stack region (Fix Rounds 5-13,
  "single camera-dolly slot model" + GSAP migration -- see that file's own extensive header
  comment for the full history this component's own comments below cite by fix-round name).

  Ownership split (deliberately mirrors Vue2's own module boundary): timeMachineMath.ts owns "what
  pose should slot N have" (pure, DOM-free); timeMachineChoreo.ts (Task 3) owns "how long should
  getting there take, with how much stagger" plus the actual GSAP calls; THIS component owns "which
  slots are visible right now, keyed by which snapshot name" (reactive, DOM-bound) and "when does a
  travel start" (the store's own tmTravel transition -> this component's own watcher, below).

  Poses are applied two different ways, exactly matching Vue2's own Fix Round 13 split:
  - On INSERT (a strip appearing in the DOM for the first time -- initial mount, or a Fix Round 11
    pinned travel endpoint that was not already part of the cascade): the two custom directives
    below (`v-tm-pose`/`v-tm-dim`, Vue3's `mounted` hook -- Vue2's own `inserted` hook under the
    same name) fire exactly once, `gsap.set()`-ing the element straight to its pose with NO
    animation. This is the correct behavior for a brand-new node: it simply appears already sitting
    at wherever it logically belongs (possibly far/dim/off-screen-clipped), the same as any other
    newly-mounted decorative element.
  - On TRAVEL (an already-rendered strip's target slot changing because the selection moved): the
    watcher below builds and plays ONE `playTravelTimeline` covering every currently-rendered
    layer at once (Task 3) -- see `runTravel` below for the full trigger chain.

  Stage-height measurement (Task 7's own addition -- Vue2's own `measureStageHeight`/
  `onWindowResize`/`ResizeObserver`-equivalent, ported as a REAL `ResizeObserver` rather than a
  rAF-throttled `window resize` listener, since New-UI already has a same-shape precedent for this
  exact pattern in FileGridView.vue: guard `typeof ResizeObserver !== 'undefined'`) feeds BOTH
  `resolveSlotPose`'s T(-1) exit-offset formula and `computeVisibleStripCap`'s own strip-count
  ceiling -- see timeMachineMath.ts's own header comments on each for why a stale/unmeasured
  height degrades safely (fixed fallback / uncapped ceiling) rather than clipping everything to
  nothing.

  Fix round (review finding 2): the measured element is the STAGE ROOT (`.tm-stage`,
  TimeMachineStage.vue's own element, injected via tmStageRoot.ts), NOT this component's own
  `.tm-depth-stack` wrapper -- that wrapper's CSS already reserves the bottom 80px band
  (`bottom: 80px`, matching computeVisibleStripCap's own bottomGap constant), so its OWN
  clientHeight is already `stageHeight - 80`; feeding that into functions that subtract 80
  internally themselves double-subtracts it. See tmStageRoot.ts's own header comment for the full
  rationale and why provide/inject (not `offsetParent`) is the mechanism.

  Reveal-gate (Task 7 fix round, review finding 1 -- Vue2's own armReveal/reveal, ported): the
  REAL window's own `.tm-fwin--traveling` hard-hide (TimeMachineStage.vue) must not release just
  because the store's own navigation settled (tmTravel clearing, milliseconds) -- it must wait for
  the travel to actually finish. Deliberately NOT hooked to the GSAP timeline's own onComplete
  (same posture Vue2 takes, see that file's own header comment on this exact point): a plain
  `setTimeout(travelDurationMs(steps))` runs in parallel with the GSAP call, then checks the
  target's own preview promise (`getSnapshotPreview`, Task 4) before calling `browse.settleTravel()`
  -- which flips `tmTravelActive` back off, releasing the real window. A `travelSafetyTimer`
  (Vue2's own TRAVEL_SAFETY_EXTRA_MS, 800ms beyond the travel duration) guarantees a reveal
  regardless of a preview fetch that never appears, never settles, or rejects. A `travelToken`,
  bumped every time a NEW travel is armed, guards `settle()` so a superseded travel's own
  (eventually-firing) timers become safe no-ops rather than clobbering a NEWER travel's still
  in-flight wait -- Vue2's own token guard, ported verbatim in spirit (object-identity-per-call
  replaced with a plain incrementing counter, since JS closures already give each armed travel its
  own captured `{from,to}`, unlike Vue2's single shared `this.travelPinNames`).

  Simplification vs Vue2 (documented, not an oversight): Vue2's own armReveal polls
  (TRAVEL_READY_POLL_MS) because its cache module (snapshotPreviewCache.js) only wraps a promise
  the consumer already built -- there is nothing to look up until the target's own
  `<snapshot-preview-window>` has mounted and registered one. New-UI's own
  `getSnapshotPreview(mount, name, relPath)` (Task 4) both looks up AND fetches atomically, so
  calling it here either returns the SAME in-flight/settled promise the target's own preview
  component already triggered (the common case, since pinning already mounted it), or triggers
  the fetch itself if nothing has yet -- either way, one direct call replaces Vue2's whole
  poll-until-cached loop, no separate TRAVEL_READY_POLL_MS timer needed.

  Vue2 also arms this SAME reveal-gate timer twice per switch (once at click time, in `switchTo`,
  BEFORE the async navigation even starts; a second time, re-arming/restarting it, once the
  `activeSnapshotName` watcher confirms navigation actually landed) -- belt-and-suspenders against
  a SLOW navigation letting the click-time timer fire and reveal a real window that still shows
  stale content. That double-arm is not needed here: this component's own reveal-gate is armed
  ONLY once navigation has already landed (the SAME trigger `runTravel`'s own watcher already
  uses, below) -- there is no click-time timer that could fire early, so there is nothing to
  re-arm against.
-->
<template>
  <div ref="rootEl" class="tm-depth-stack" :style="stackStyle" aria-hidden="true">
    <div
      v-for="slot in dollySlots"
      :key="slot.name"
      class="tm-depth-strip"
      :data-snapshot="slot.name"
      :data-depth="slot.depth"
      v-tm-pose="slot.pose"
      :ref="(el) => setStripRef(slot.name, el as Element | null)"
    >
      <SnapshotPreviewWindow
        :mount="mount"
        :snapshot-name="slot.name"
        :rel-path="relPath"
        :view-mode="viewMode"
        :volume-label="volumeLabel"
      />
      <div
        class="tm-depth-strip__dim"
        v-tm-dim="slot.pose"
        :ref="(el) => setDimRef(slot.name, el as Element | null)"
        aria-hidden="true"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useFilesStore } from '../stores/files'
import { resolveDollySlots, resolveSlotPose, computeVisibleStripCap, TM_WINDOW_SCALE, type SlotPose } from '../util/timeMachineMath'
import { playTravelTimeline, poseToGsapVars, dimGsapVars, travelDurationMs, TRAVEL_SAFETY_EXTRA_MS, type TravelTarget } from '../util/timeMachineChoreo'
import { getSnapshotPreview } from '../util/snapshotPreviewCache'
import { injectTmStageRoot } from './tmStageRoot'
import SnapshotPreviewWindow from './SnapshotPreviewWindow.vue'

defineOptions({ name: 'TimeMachineDepthStack' })

const browse = useSnapshotBrowseStore()
const files = useFilesStore()

// Fix round (review finding 2): the STAGE root (`.tm-stage`), not this component's own
// `.tm-depth-stack` wrapper -- see tmStageRoot.ts's own header comment and this file's own
// header comment for why. `rootEl` (this component's own root) stays -- it is still the correct
// scale/transform-origin host for the cascade itself, just not the measurement source.
const stageRootRef = injectTmStageRoot()
const rootEl = ref<HTMLElement | null>(null)
const stageHeight = ref(0)

// Task 7 addition, resolved here (not in SnapshotPreviewWindow -- see that file's own header
// comment on `volumeLabel`): the volume's user-facing display name, when one exists.
const mount = computed(() => browse.browseInfo?.mount ?? '')
const relPath = computed(() => browse.browseInfo?.relPath ?? '')
const volumeLabel = computed(() => (mount.value ? files.displayNames[mount.value] : undefined))
const viewMode = computed(() => files.viewMode)

const names = computed(() => browse.snapshotList.map((s) => s.name))
const currentIndex = computed(() => {
  const name = browse.currentSnapshotName
  if (!name) return -1
  return names.value.indexOf(name)
})
const visibleStripCap = computed(() => computeVisibleStripCap(stageHeight.value))

// Fix Round 11 (M2-F15, ported, see resolveDollySlots' own header comment): force-includes the
// travel's two endpoints at their own real slot regardless of the normal window, so a distant
// jump has a real "before" DOM node to animate from and a real "after" one to animate to, exactly
// like a single-step switch already did. Set by the `browse.tmTravel` watcher below, cleared by
// `settle()` (the reveal-gate below) once the travel actually lands OR is superseded -- NOT by
// the GSAP timeline's own onComplete (fix round, review finding 3: a superseded travel's timeline
// gets `.kill()`ed, which never fires onComplete, so a completion-driven clear would leak the
// pin until this component remounts).
const pinNames = ref<string[]>([])

const dollySlots = computed(() =>
  resolveDollySlots(names.value, currentIndex.value, visibleStripCap.value, pinNames.value).map((slot) => ({
    ...slot,
    pose: resolveSlotPose(slot.depth, stageHeight.value),
  })),
)

// A resize/late-measurement is NOT a travel -- the only dolly-slot pose that can actually depend
// on `stageHeight` is T(-1)'s own exit offset (resolveSlotPose) -- so an already-rendered slot's
// `gsap.set()`-applied inline style (from its own `v-tm-pose`/`v-tm-dim` `mounted` hook, possibly
// captured back when `stageHeight` was still its unmeasured 0 default -- the FIRST render always
// happens before `onMounted`'s own measurement, see `measureHeight` below) can otherwise go
// quietly stale with no travel ever happening to correct it (a directive's `mounted` hook fires
// exactly ONCE, unlike a bound `:style`, which would have re-applied on every render for free).
// Re-applies (via `gsap.set`, no animation) every CURRENTLY rendered layer's own pose from the
// freshly recomputed `dollySlots` -- a no-op `gsap.set` for any layer whose pose did not actually
// change (Vue2's own syncDollyPosesInstant, ported verbatim).
function syncDollyPosesInstant() {
  dollySlots.value.forEach((slot) => {
    const el = stripRefs.get(slot.name)
    const dim = dimRefs.get(slot.name)
    if (el) gsap.set(el, poseToGsapVars(slot.pose))
    if (dim) gsap.set(dim, dimGsapVars(slot.pose))
  })
}

// Fix round (review finding 2): measures `stageRootRef.value` (the injected `.tm-stage` element),
// NOT `rootEl.value` (this component's own `.tm-depth-stack` wrapper) -- see this file's own
// header comment for why the wrapper's own clientHeight is already reduced by the bottom-gap
// band `resolveSlotPose`/`computeVisibleStripCap` subtract themselves.
function measureHeight() {
  stageHeight.value = stageRootRef.value ? stageRootRef.value.clientHeight : 0
  syncDollyPosesInstant()
}

let resizeObserver: ResizeObserver | null = null

// Fix Round 13 (GSAP migration, ported): one gsap.context() per component instance, opened
// immediately (not in onMounted) so even a strip inserted during THIS component's own initial
// mount patch already has a real context to route its v-tm-pose/v-tm-dim gsap.set() through --
// see the Vue2 authority file's own header comment, Fix Round 13 section, "Cleanup", for why the
// `scope` argument is unnecessary here (every lookup goes through the local ref Maps below, never
// ctx.selector()).
const gsapCtx = gsap.context(() => {})
let travelTimeline: gsap.core.Timeline | null = null

const stripRefs = new Map<string, HTMLElement>()
const dimRefs = new Map<string, HTMLElement>()

function setStripRef(name: string, el: Element | null) {
  if (el) stripRefs.set(name, el as HTMLElement)
  else stripRefs.delete(name)
}
function setDimRef(name: string, el: Element | null) {
  if (el) dimRefs.set(name, el as HTMLElement)
  else dimRefs.delete(name)
}

// Fix Round 13 (GSAP migration, ported): each directive's `mounted` hook (Vue3's name for Vue2's
// `inserted`) fires exactly once, the instant Vue inserts THAT specific node -- gsap.set()-ing it
// straight to the pose bound at insert time, no animation. The ACTUAL travel tween is built
// separately, once per switch, in `runTravel` below.
const vTmPose = {
  mounted(el: HTMLElement, binding: { value: SlotPose }) {
    const vars = poseToGsapVars(binding.value)
    gsapCtx.add(() => gsap.set(el, vars))
  },
}
const vTmDim = {
  mounted(el: HTMLElement, binding: { value: SlotPose }) {
    const vars = dimGsapVars(binding.value)
    gsapCtx.add(() => gsap.set(el, vars))
  },
}

const stackStyle = computed(() => ({ transform: `scale(${TM_WINDOW_SCALE})` }))

// The travel this component is currently waiting to animate, captured the instant the store's own
// tmTravel becomes non-null (see the watcher below) -- BEFORE `browse.currentSnapshotName` has
// actually changed. `runTravel` fires once that name change actually lands (the second watcher
// below), mirroring Vue2's own two-step split ("pin at click time" / "animate once the prop change
// lands", see resolveDollySlots' own header comment on pinNames for why that ordering matters).
let pendingTravel: { from: string, to: string } | null = null

watch(
  () => browse.tmTravel,
  (val) => {
    if (!val || !val.from || !val.to) return
    pinNames.value = Array.from(new Set([...pinNames.value, val.from, val.to]))
    pendingTravel = { from: val.from, to: val.to }
  },
)

watch(
  () => browse.currentSnapshotName,
  (newName) => {
    if (!pendingTravel || newName !== pendingTravel.to) return
    const travel = pendingTravel
    pendingTravel = null
    const fromIdx = names.value.indexOf(travel.from)
    const toIdx = names.value.indexOf(travel.to)
    const steps = fromIdx >= 0 && toIdx >= 0 ? Math.abs(toIdx - fromIdx) || 1 : 1
    // $nextTick equivalent (Vue2's own playDollyTravel): a name that is entering `dollySlots` for
    // the FIRST time on this exact render (a pinned endpoint that was not already part of the
    // cascade) needs its own v-tm-pose/v-tm-dim `mounted` hook to have actually run -- i.e. the DOM
    // patch from the `currentIndex` change above must have landed -- before `stripRefs`/`dimRefs`
    // lookups below can find it.
    nextTick(() => runTravel(steps, travel))
    armReveal(travel, steps)
  },
)

function runTravel(steps: number, travel: { from: string, to: string }) {
  // A strip with no mounted ref (defensive only -- every name in `dollySlots` should have one by
  // the time this runs, per this function's own $nextTick-deferred call site above) is dropped
  // before the cast: `stripRefs`/`dimRefs` store `HTMLElement | undefined`, narrower than
  // `TravelTarget`'s own `Element`/`Element | null | undefined` fields, so TS cannot derive a type
  // predicate for `.filter()` here -- the cast is safe precisely because the filter already
  // guarantees `el` is non-null for every surviving entry.
  const targets = dollySlots.value
    .map((slot) => ({ el: stripRefs.get(slot.name) ?? null, dimEl: dimRefs.get(slot.name) ?? null, pose: slot.pose }))
    .filter((target) => target.el !== null) as TravelTarget[]
  if (travelTimeline) {
    travelTimeline.kill()
    travelTimeline = null
  }
  // Fix round (review finding 1/3): no `onComplete` here any more -- the GSAP timeline's own
  // completion no longer drives anything observable (not the real window's reveal, not pin
  // clearing). See this file's own header comment for why that gate is a SEPARATE, plain-timer
  // mechanism (`armReveal`/`settle` below) rather than hooked to this timeline.
  const build = () => playTravelTimeline(targets, { steps })
  travelTimeline = gsapCtx.add(build)
}

// --- Reveal-gate (Task 7 fix round, review finding 1 -- Vue2's own armReveal/reveal) ------------
// Ported verbatim in mechanism (see this file's own header comment for the full model and the
// one deliberate simplification vs Vue2's own poll-based cache lookup).
// Final review (folded minor #7): TRAVEL_SAFETY_EXTRA_MS now lives in timeMachineChoreo.ts (single
// shared source, same "so the two never drift apart" reasoning EXIT_FADE_MS's own comment there
// already established) -- snapshotBrowse.ts's own switchTo() safety backstop for tmTravelActive
// reuses the identical constant, rather than each maintaining its own copy of "Vue2's own literal,
// same value".

let travelToken = 0
let travelTimer: ReturnType<typeof setTimeout> | null = null
let travelSafetyTimer: ReturnType<typeof setTimeout> | null = null

function clearTravelTimers() {
  if (travelTimer !== null) { clearTimeout(travelTimer); travelTimer = null }
  if (travelSafetyTimer !== null) { clearTimeout(travelSafetyTimer); travelSafetyTimer = null }
}

// The ONE place the reveal actually happens. Guarded by `token`: a reveal armed for an EARLIER
// travel (its preview promise settling late, or its own safety timer) can never clobber a LATER
// travel's own still-in-progress wait, because a newer `armReveal` call already bumped
// `travelToken` and cleared every timer this one could still be holding -- the only way a stale
// callback can still run at all is an already-queued Promise microtask (a timer clear cannot
// cancel that), and this guard is what makes that a safe no-op (Vue2's own `reveal(token)` --
// see this file's own header comment).
function settle(token: number) {
  if (token !== travelToken) return
  clearTravelTimers()
  // Fix round 2 (review finding 3, re-review): resets the WHOLE pin array unconditionally, not
  // just the settling travel's own {from,to} (that was fix round 1's own mistake -- see this
  // function's git history/PR for the filter() version this replaced). pinNames accumulates via
  // Set-union across EVERY travel whose `tmTravel` watcher fired (see that watcher, above), but
  // only the ONE winning travel's settle() ever runs (a superseded travel's own settle() is the
  // token-guard no-op right above) -- filtering only the winner's own pair left every OTHER
  // superseded travel's names stuck in `pinNames` forever. Repro that caught this: s0->s15 lands
  // and pins {s0,s15}; before its gate fires, s15->s29 supersedes and settles filtering only
  // {s15,s29} -- s0 (never part of that pair) stayed pinned 29 slots away permanently. Vue2's own
  // reveal() (TimeMachineStage.vue) resets the array unconditionally too
  // (`this.travelPinNames = []`) -- ported verbatim. A full reset is safe here precisely because
  // settle() only ever fires (past the token guard) for the ONE travel legitimately settling
  // right now, and nothing needs to stay pinned once ANY travel has settled -- the current
  // selection is already covered by dollySlots' own depth-0 slot unconditionally, same reasoning
  // Vue2's own comment there gives.
  pinNames.value = []
  browse.settleTravel()
}

// Arms the reveal for `travel`, bumping `travelToken` so any STILL-pending earlier reveal becomes
// a no-op once its own timer/promise eventually fires. `durationMs` is the SAME
// `travelDurationMs(steps)` the GSAP timeline itself uses (`runTravel`, above) -- deliberately NOT
// collapsed under `prefers-reduced-motion` (Vue2's own explicit choice, ported: "the readiness
// gate is unaffected... never whether the real window waits for the target's own preview to be
// ready" -- only the depth-stack's own visual motion degrades under reduced motion, not this
// timing floor).
function armReveal(travel: { from: string, to: string }, steps: number) {
  travelToken += 1
  const token = travelToken
  clearTravelTimers()
  const durationMs = travelDurationMs(steps)
  // Safety ceiling: reveals unconditionally once durationMs + TRAVEL_SAFETY_EXTRA_MS has passed,
  // regardless of whether the target's own preview promise ever appears, settles, or rejects.
  travelSafetyTimer = setTimeout(() => {
    travelSafetyTimer = null
    settle(token)
  }, durationMs + TRAVEL_SAFETY_EXTRA_MS)
  travelTimer = setTimeout(() => {
    travelTimer = null
    // getSnapshotPreview both looks up AND fetches (see this file's own header comment) -- no
    // separate "not cached yet, poll again shortly" loop needed, unlike Vue2's own armReveal.
    getSnapshotPreview(mount.value, travel.to, relPath.value).then(
      () => settle(token),
      // Deliberately a no-op, not `() => settle(token)` too -- a REJECTED preview fetch does
      // not reveal early on its own; the safety timer above still guarantees "reveal anyway"
      // for it. This handler exists so a rejection never surfaces as an unhandled promise
      // rejection (getSnapshotPreview's own contract never actually rejects, but this stays
      // defensive against that contract changing).
      () => {},
    )
  }, durationMs)
}

onMounted(() => {
  nextTick(() => measureHeight())
  if (typeof ResizeObserver !== 'undefined') {
    // Fix round (review finding 2): observes `stageRootRef.value` (the injected `.tm-stage`
    // element), not this component's own root -- see measureHeight's own comment.
    resizeObserver = new ResizeObserver(() => measureHeight())
    if (stageRootRef.value) resizeObserver.observe(stageRootRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  clearTravelTimers()
  if (travelTimeline) {
    travelTimeline.kill()
    travelTimeline = null
  }
  // Fix Round 13 (GSAP migration, ported): kills every tween/timeline this component ever tracked
  // (both directives' gsap.set() calls and every travel timeline) and restores the touched
  // elements' pre-GSAP inline styles.
  gsapCtx.revert()
})
</script>

<style scoped>
/* Deliberately congruent with `.tm-fwin`'s own scaled geometry (Vue2 parity, M2-F10): same
   right/bottom reserved bands as `.tm-stage__hold--active` (TM_RAIL_WIDTH + TM_STEPPER_BAND =
   280px, timeMachineMath.ts), same window scale/origin -- everything positioned inside inherits
   the real window's own rendered top/right edges for free. `right`/`bottom` stay plain literals
   here (not bound), matching this same file family's own existing precedent
   (TimeMachineStage.vue's `.tm-stage__hold--active`, `padding-right: 280px`) rather than a second
   independent derivation. */
.tm-depth-stack {
  position: absolute;
  top: 0;
  left: 0;
  right: 280px; /* TM_RAIL_WIDTH (220) + TM_STEPPER_BAND (60) */
  bottom: 80px; /* matches computeVisibleStripCap's own bottomGap constant */
  transform-origin: 50% 58%;
  pointer-events: none;
  z-index: 3;
}

/* Full window-sized box hosting one real <snapshot-preview-window> per dolly slot -- this rule
   only carries the shared, slot-INDEPENDENT geometry; transform/z-index are GSAP-driven (see
   v-tm-pose above), never a CSS transition (Fix Round 13 -- GSAP is the only writer). */
.tm-depth-strip {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--tm-panel-bg-solid);
  /* Fix wave A2 (audit-stage.md #5): Vue2's own `.tm-stage__depth-strip` box-shadow is a single
     layer (TimeMachineStage.vue:3042) -- `--card-shadow-hi`'s 3-layer shadow (with an inset
     highlight Vue2 never has on this element) was a substitution error, not an approved token
     reuse; `--tm-depth-shadow` pins the exact Vue2 literal instead (see theme.css's own comment
     on that token for the value, not repeated here to avoid writing a bare color literal in this
     style block). */
  box-shadow: var(--tm-depth-shadow);
  transform-origin: 50% 0%;
  pointer-events: none;
}

/* The per-slot "dimmer with depth" falloff lives on this separate overlay (rather than a `filter`
   on the strip itself) -- a `filter` on a box wrapping a real DOM subtree can force a repaint of
   it on every value change; an overlay's own `opacity` never does (Vue2's own M2-F12 perf
   rationale). Fix wave A2 (audit-stage.md #6): Vue2's own literal is PURE black
   (`.tm-stage__depth-strip__dim`'s own `background`, TimeMachineStage.vue:3081) -- the previous
   `--tm-text` token (a navy-grey ink color, see theme.css) was a substitution error that tinted
   every strip in the receding stack blue-grey instead of neutrally darkening it; `--tm-depth-dim`
   pins the exact Vue2 literal instead (see theme.css's own comment on that token for the value,
   not repeated here to avoid writing a bare color literal in this style block). */
.tm-depth-strip__dim {
  position: absolute;
  inset: 0;
  background: var(--tm-depth-dim);
  pointer-events: none;
}
</style>
