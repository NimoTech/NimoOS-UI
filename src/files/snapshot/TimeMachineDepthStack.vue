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
  exact pattern in FileGridView.vue: guard `typeof ResizeObserver !== 'undefined'`, observe this
  component's own root -- which, like Vue2's `.tm-stage__depth-stack`, is deliberately transformed
  to match `.tm-fwin`'s own scaled geometry, so its OWN `clientHeight` before that transform is
  applied is the correct "real window box height" `resolveSlotPose`'s own `stageHeight` param and
  `computeVisibleStripCap` both expect) feeds BOTH `resolveSlotPose`'s T(-1) exit-offset formula
  and `computeVisibleStripCap`'s own strip-count ceiling -- see timeMachineMath.ts's own header
  comments on each for why a stale/unmeasured height degrades safely (fixed fallback / uncapped
  ceiling) rather than clipping everything to nothing.
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
import { playTravelTimeline, poseToGsapVars, dimGsapVars, type TravelTarget } from '../util/timeMachineChoreo'
import SnapshotPreviewWindow from './SnapshotPreviewWindow.vue'

defineOptions({ name: 'TimeMachineDepthStack' })

const browse = useSnapshotBrowseStore()
const files = useFilesStore()

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
// like a single-step switch already did. Set by the `browse.tmTravel` watcher below, cleared once
// `runTravel`'s own GSAP timeline actually completes.
const pinNames = ref<string[]>([])

const dollySlots = computed(() =>
  resolveDollySlots(names.value, currentIndex.value, visibleStripCap.value, pinNames.value).map((slot) => ({
    ...slot,
    pose: resolveSlotPose(slot.depth, stageHeight.value),
  })),
)

function measureHeight() {
  stageHeight.value = rootEl.value ? rootEl.value.clientHeight : 0
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
  const build = () =>
    playTravelTimeline(targets, {
      steps,
      onComplete: () => {
        pinNames.value = pinNames.value.filter((n) => n !== travel.from && n !== travel.to)
      },
    })
  travelTimeline = gsapCtx.add(build)
}

onMounted(() => {
  nextTick(() => measureHeight())
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureHeight())
    if (rootEl.value) resizeObserver.observe(rootEl.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
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
  box-shadow: var(--card-shadow-hi);
  transform-origin: 50% 0%;
  pointer-events: none;
}

/* The per-slot "dimmer with depth" falloff lives on this separate overlay (rather than a `filter`
   on the strip itself) -- a `filter` on a box wrapping a real DOM subtree can force a repaint of
   it on every value change; an overlay's own `opacity` never does (Vue2's own M2-F12 perf
   rationale). `--tm-text` (the darkest token in the approved Task 1 palette, see tmTokens.test.ts)
   stands in for Vue2's own hardcoded near-black scrim color -- both are opacity-scaled overlays
   meant to read the same in either theme, matching every other --tm-* token's own "same value in
   both themes" rule; there is no dedicated tm-scrim token in the Task 1 list, and this task is not
   authorized to add one. */
.tm-depth-strip__dim {
  position: absolute;
  inset: 0;
  background: var(--tm-text);
  pointer-events: none;
}
</style>
