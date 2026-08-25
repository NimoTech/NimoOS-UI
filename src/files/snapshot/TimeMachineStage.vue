<script setup lang="ts">
// Vue2-parity Time Machine stage shell (Task 6 of
// docs/superpowers/sdd/2026-08-25-files-time-machine-vue2-parity). Ported from Vue2
// components/filebrowser/components/TimeMachineStage.vue's own "three always-mounted wrapper
// layers" model (`.tm-stage > .tm-stage__hold > .tm-fwin > <slot>`, each `display: contents`
// while inactive so it never disturbs the slotted real Files layout, and only becomes a real box
// once Time Machine mode is active) — see that file's own header comment, Fix Round 15 section,
// for the full "why contents, not v-if" argument this file reproduces byte-for-byte.
//
// Scope (Task 6 built the shell — Tasks 7-9 build on top of it, do not duplicate their work
// here): the clone/glass decorative backdrop, the scaled-down real window, the Escape exit
// channel, and the z-index tiers every later task's own markup must slot into
// (clone 0 < glass 1 < depth-stack 3 (Task 7, built here) < bottom bar 7 (Task 9) < real window 8 <
// rail 9 (Task 8) < stepper/gear 10 (Task 8/9, gear built here)). The bottom bar is Task 9's own
// second exit channel — Escape is the only one this task wires up.
//
// Task 7 addition: mounts TimeMachineDepthStack.vue at z-tier 3 (see that component's own header
// comment) and extends `onKeydown` with ArrowUp/ArrowDown (ported from Vue2's own stepLater/
// stepEarlier keyboard handler) alongside the existing Escape channel — preempting Task 9's own
// "↑↓键盘" file-list item (task-9-brief.md); Task 9 should extend `stepLater`/`stepEarlier` below
// (wiring its own visible stepper buttons to them) rather than re-adding the keyboard listener.
//
// Task 9 addition: mounts TimeMachineStepper.vue (z-tier 10, its own self-positioned right-edge
// control -- see that component's own header comment) wired to the SAME stepLater/stepEarlier the
// keyboard handler above already calls, plus the bottom action bar (z-tier 7, Vue2's own
// `.tm-bottom-bar`) with its two buttons: Exit calls `browse.exitTimeMachine()` directly (the
// SAME store action Escape already triggers -- two channels, one destination, Vue2 parity); Restore
// selection only EMITS `restore-selection` -- deciding WHAT is selected and actually calling
// `browse.restoreItems(...)` is Task 14's own orchestration (this task's own brief is explicit that
// restore wiring here would be premature -- see this file's own template comment on that button).
//
// Unlike Vue2 (a plain `active` prop threaded down from FilePanel.vue's own isTimeMachineMode),
// this component reads active/travel state straight off the snapshotBrowse store — Files.vue's
// wrap only has to supply the real slot content and forward `open-settings`, nothing else.
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useWallpaperStore, recordUrl } from '../../stores/wallpaper'
import { TM_WINDOW_SCALE, clampStepIndex } from '../util/timeMachineMath'
import { EXIT_FADE_MS } from '../util/timeMachineChoreo'
import { snapshotDayLabel, formatSnapshotClockTime } from '../../storage/util/snapshotView'
import { provideTmStageRoot } from './tmStageRoot'
import TimeMachineDepthStack from './TimeMachineDepthStack.vue'
import TimeMachineRail from './TimeMachineRail.vue'
import TimeMachineStepper from './TimeMachineStepper.vue'

defineOptions({ name: 'TimeMachineStage' })

const props = withDefaults(defineProps<{
  /**
   * Suppresses the Escape-to-exit shortcut while a dialog the caller knows about (Files.vue's own
   * snapshot settings dialog today) is open — Vue2 has no equivalent of this specific prop (its
   * gear dialog is a `<b-modal>` layered differently), but the New-UI colleague's TimeMachineOverlay.vue
   * hit and fixed the exact same class of bug for its own gear dialog (see that file's own
   * onKeydown header comment, "Review fix (Critical, round 1/2)") — this prop is the explicit,
   * directly-testable half of that same fix, preserved here per that precedent.
   */
  dialogOpen?: boolean
}>(), { dialogOpen: false })

const emit = defineEmits<{
  (e: 'open-settings'): void
  // Task 9's own contract for Task 14: the bottom bar's Restore selection button only announces
  // intent -- it does not know what is selected inside the (still generically-slotted) real window,
  // nor call `browse.restoreItems(...)` itself. See this file's own header comment ("Task 9
  // addition") and the button's own template comment for the full rationale.
  (e: 'restore-selection'): void
}>()

const { t } = useI18n()
const browse = useSnapshotBrowseStore()
const wallpaper = useWallpaperStore()

const stageRoot = ref<HTMLElement | null>(null)
const fwinEl = ref<HTMLElement | null>(null)
const cloneMount = ref<HTMLElement | null>(null)

// Task 7 fix round (review finding 2): TimeMachineDepthStack.vue's own stage-height measurement
// needs THIS element (`.tm-stage`, the same one Vue2 measures via its own `$refs.stage`), not its
// own `.tm-depth-stack` wrapper — see tmStageRoot.ts's own header comment for why measuring the
// wrapper double-subtracts the bottom-gap constant resolveSlotPose/computeVisibleStripCap already
// subtract themselves.
provideTmStageRoot(stageRoot)

const active = computed(() => browse.tmActive)
// Task 7 fix round (review finding 1): reads tmTravelActive (TimeMachineDepthStack.vue's own
// reveal-gate — armReveal/settle, ported from Vue2's own armReveal/reveal), NOT tmTravel
// (which clears the instant the store's own router.replace resolves, ms before the depth-stack's
// 420-900ms dolly sweep or the target's own preview listing have actually finished — releasing
// the hard-hide on THAT signal revealed the real window mid-animation on essentially every
// switch). See snapshotBrowse.ts's own header comment on tmTravelActive for the full split.
const traveling = computed(() => browse.tmTravelActive)
const fadingOut = ref(false)

// TM_WINDOW_SCALE (timeMachineMath.ts) is the single source of the 0.82 scale factor — bound via
// :style rather than duplicated as a literal in the style block below, so the two can never drift apart.
const fwinStyle = computed(() => (active.value ? { transform: `scale(${TM_WINDOW_SCALE})` } : undefined))

// Fallback background for the clone layer when capture fails, or on the (Task 10+) case of a
// deep-link landing already-active with nothing pre-Time-Machine to have captured — same
// "screenshot vs wallpaper" fallback Vue2's own hasEntryClone/wallpaperImageUrl pair implements.
const fallbackStyle = computed(() => {
  const url = recordUrl(wallpaper.record)
  return url ? { backgroundImage: `url(${url})` } : undefined
})

let pendingClone: Node | null = null
const hasClone = ref(false)

function captureClone() {
  pendingClone = null
  hasClone.value = false
  const el = fwinEl.value
  if (!el) return
  try {
    pendingClone = el.cloneNode(true)
    hasClone.value = true
  } catch (e) {
    // Defensive only — cloneNode(true) practically never throws, but a capture failure must
    // degrade to the wallpaper fallback, never crash the entry into Time Machine mode.
    console.warn('[time-machine-stage] entry clone capture failed, falling back to wallpaper', (e as Error)?.message)
    pendingClone = null
    hasClone.value = false
  }
}
// Runs one render tick after captureClone(): the `.tm-stage__clone` host element itself only
// exists once Vue has rendered the `v-if="active || fadingOut"` block below, which happens AFTER
// the synchronous capture above (see the `active` watcher's own comment for why capture itself
// cannot wait that long).
function mountClone() {
  const host = cloneMount.value
  if (!host) return
  host.replaceChildren()
  if (pendingClone) host.appendChild(pendingClone)
}
function destroyClone() {
  cloneMount.value?.replaceChildren()
  pendingClone = null
  hasClone.value = false
}

// Task 7 addition (preempting Task 9's own "↑↓键盘" line item -- see this file's own header
// comment/task-9-brief.md's file list; flagged for T9 in the Task 7 report so it extends this
// rather than re-adding it): the SAME switchTo funnel a tick click / stepper click will use (Tasks
// 8/9) -- Vue2's stepEarlier/stepLater, ported. `clampStepIndex` (Task 2) fuses "can I step" and
// "what's the next index" into one call; `browse.snapshotList` is newest-first (T6), so a HIGHER
// index is an OLDER snapshot -- delta +1 is Vue2's own "earlier", delta -1 is "later" (index 0).
function currentSnapshotIndex(): number {
  const name = browse.currentSnapshotName
  if (!name) return -1
  return browse.snapshotList.findIndex((s) => s.name === name)
}
function stepLater() {
  const next = clampStepIndex(currentSnapshotIndex(), -1, browse.snapshotList.length)
  if (next !== null) browse.switchTo(browse.snapshotList[next].name)
}
function stepEarlier() {
  const next = clampStepIndex(currentSnapshotIndex(), 1, browse.snapshotList.length)
  if (next !== null) browse.switchTo(browse.snapshotList[next].name)
}

// Task 9 addition: the visible stepper's own `:disabled` state, pure-function derived from the
// SAME clampStepIndex call stepLater/stepEarlier themselves guard with above -- exactly the "one
// notion of can-I-step, not three" posture Task 7's own report flagged for this task (its own
// keyboard handler re-derives the same thing inline rather than reading these, since it predates
// them; both paths agree because both ultimately call clampStepIndex with the same arguments).
const canStepLater = computed(() => clampStepIndex(currentSnapshotIndex(), -1, browse.snapshotList.length) !== null)
const canStepEarlier = computed(() => clampStepIndex(currentSnapshotIndex(), 1, browse.snapshotList.length) !== null)

// Stepper's centered humanized moment, e.g. "Today 14:30" -- Vue2's own `selectedMomentText`
// (took over the role the old bottom-bar center date used to have, M2-F7 point 6). Built from the
// SAME two pure helpers (storage/util/snapshotView.ts) the storage-area timeline and
// TimeMachineRail.vue's own per-tick time labels already use, applied directly to the current
// selection's own `created_at` rather than re-deriving it from a full groupSnapshotsByDay() pass
// (this only ever needs ONE item's day/time, not the whole grouped list).
const currentSnapshotItem = computed(() => browse.snapshotList.find((s) => s.name === browse.currentSnapshotName) ?? null)
const stepperLabel = computed(() => {
  const item = currentSnapshotItem.value
  if (!item) return ''
  const day = snapshotDayLabel(item.created_at)
  const dayText = day.i18nKey ? t(day.i18nKey) : day.text
  return `${dayText} ${formatSnapshotClockTime(item.created_at)}`
})

// Escape is one of exactly two exit channels (the other, the bottom-bar Exit button, is Task 9's
// own addition) — see this file's own header comment. Two guards, same posture as
// TimeMachineOverlay.vue's own onKeydown: an explicit caller-supplied `dialogOpen` flag for the
// one dialog Files.vue already knows about, PLUS a generic "the event's own target is not inside
// this stage" check that also covers any OTHER Teleported dialog (rename/conflict/etc.) stacked
// above it without needing a dedicated prop wired through for each one. ArrowUp/ArrowDown (Task 7
// addition) share the SAME two guards -- a dialog stacked above the stage (e.g. a text input
// inside it) must not have its own arrow-key navigation hijacked by snapshot stepping underneath.
// Fix round (2026-07, Vue2 user report, ported): ArrowUp -> stepLater (next MORE RECENT), ArrowDown
// -> stepEarlier (next OLDER) -- see stepLater/stepEarlier's own comment for the index direction.
function onKeydown(e: KeyboardEvent) {
  const isEscape = e.code === 'Escape' || e.key === 'Escape'
  const isArrowUp = e.code === 'ArrowUp'
  const isArrowDown = e.code === 'ArrowDown'
  if (!isEscape && !isArrowUp && !isArrowDown) return
  if (props.dialogOpen) return
  const target = e.target
  // Critical fix (final review C1): document.body/documentElement are exempted from the
  // containment check -- they are the browser's own default focus target (after clicking a file
  // row/glass/blank space, or simply never having received focus at all, e.g. right after Task
  // 10's deep-link auto-enter), NOT a Teleported dialog stacked above the stage. The un-exempted
  // check below treated them identically to a real Teleported dialog (neither is ever a
  // descendant of `.tm-stage`) and swallowed Esc/ArrowUp/ArrowDown on the single most common
  // focus state. Genuinely Teleported content (rename/conflict/settings dialogs, all mounted as
  // siblings of the stage under document.body) is still caught: it is an Element, not body/
  // documentElement, and not contained by stageRoot.
  if (
    target instanceof Element
    && target !== document.body
    && target !== document.documentElement
    && stageRoot.value
    && !stageRoot.value.contains(target)
  ) return
  e.preventDefault()
  if (isEscape) { browse.exitTimeMachine(); return }
  if (isArrowUp) stepLater()
  else stepEarlier()
}

let fadeOutTimer: ReturnType<typeof setTimeout> | null = null

// flush:'sync' is deliberate (not the Composition API's default 'pre'): captureClone() MUST run
// before Vue's own render effect applies `tm-fwin--active`'s scale-down to fwinEl, or the clone
// would capture the ALREADY-shrunk window instead of the real pre-Time-Machine page.
//
// Verified empirically (review round 1 follow-up), not just asserted: Vue 3's scheduler already
// flushes pre-flush watcher callbacks before any component's own render job in the SAME batch
// (that ordering is structural to 'pre', not a coincidence of effect-creation order) — so, for
// this exact call site, flipping this option to the Composition API's default 'pre' does NOT
// reproduce the bug (confirmed red/green both ways, see TimeMachineStage.test.ts's own comment on
// its capture-timing test). The genuine regression is deferring the capture call itself past the
// render — e.g. `nextTick(() => captureClone())` instead of a bare `captureClone()` — which DOES
// turn that test red (confirmed the same way). 'sync' is kept anyway as the more conservative,
// scheduler-detail-independent choice (it runs inline with whatever set browse.tmActive, with no
// dependency on 'pre'-queue-before-render-job being true in whatever Vue version/config this ever
// runs under) — the actual correctness invariant this whole watcher exists to protect is
// "captureClone() itself runs synchronously, not deferred", not the specific `flush` option.
// Mirrors Vue2's own `watch: { active(val) {...} }` in spirit (Vue2 TimeMachineStage.vue's own
// header comment cites the same watcher-before-render concern), even though Vue3's mechanism for
// guaranteeing it differs from Vue2's id-ordered watcher queue.
watch(
  () => browse.tmActive,
  (isActive) => {
    if (isActive) {
      captureClone()
      nextTick(() => mountClone())
      window.addEventListener('keydown', onKeydown)
      if (fadeOutTimer !== null) { clearTimeout(fadeOutTimer); fadeOutTimer = null }
      fadingOut.value = false
    } else {
      // Every LIVE side effect stops immediately (Vue2 parity) — only the purely decorative
      // shell (glass/clone/gear, via `v-if="active || fadingOut"`) is held a beat longer, for a
      // 220ms crossfade rather than a hard cut.
      window.removeEventListener('keydown', onKeydown)
      fadingOut.value = true
      if (fadeOutTimer !== null) clearTimeout(fadeOutTimer)
      fadeOutTimer = setTimeout(() => {
        fadeOutTimer = null
        fadingOut.value = false
        destroyClone()
      }, EXIT_FADE_MS)
    }
  },
  { flush: 'sync' },
)

onMounted(() => {
  // Mirrors the `active` watcher's own setup for the (Task 10+) case of mounting already-active
  // (a watcher only fires on a change, never on the initial value) — Vue2's own `mounted()` hook
  // has the identical mirror for the same reason.
  if (browse.tmActive) window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (fadeOutTimer !== null) { clearTimeout(fadeOutTimer); fadeOutTimer = null }
  destroyClone()
})
</script>

<template>
  <div ref="stageRoot" class="tm-stage" :class="{ 'tm-stage--active': active }" :style="{ '--tm-exit-fade-ms': `${EXIT_FADE_MS}ms` }">
    <template v-if="active || fadingOut">
      <div
        ref="cloneMount"
        class="tm-stage__clone"
        :class="{ 'tm-stage__fade-exit': fadingOut }"
        :style="hasClone ? undefined : fallbackStyle"
        aria-hidden="true"
      ></div>
      <div class="tm-stage__glass" :class="{ 'tm-stage__fade-exit': fadingOut }" aria-hidden="true"></div>
      <!-- z-tier 3 (Task 7): the Apple-style depth-stack cascade -- see TimeMachineDepthStack.vue's
           own header comment for the full slot/travel model. `tm-stage__fade-exit` is a fallthrough
           class (lands on the component's own root, same mechanism the clone/glass layers above
           already rely on for their own scoped rule to apply across the component boundary). -->
      <TimeMachineDepthStack :class="{ 'tm-stage__fade-exit': fadingOut }" />
    </template>

    <div class="tm-stage__hold" :class="{ 'tm-stage__hold--active': active }">
      <div ref="fwinEl" class="tm-fwin" :class="{ 'tm-fwin--active': active, 'tm-fwin--traveling': traveling }" :style="fwinStyle">
        <slot />
      </div>
    </div>

    <template v-if="active || fadingOut">
      <!-- Right-edge fisheye tick rail (Task 8, z-tier 9) -- its own template gate, like the gear
           button below, rather than folded into the clone/glass/depth-stack block above (that
           block is background decoration, always pointer-events:none; the rail, like the gear, is
           interactive). Wired straight to the store (same props-less-from-Files.vue convention
           TimeMachineDepthStack.vue's own header comment already established), not threaded
           through props: snapshots/current/loading come straight off `browse`, and `select` calls
           `browse.switchTo` directly -- the SAME funnel the keyboard stepper (Task 7) and the
           bottom-bar stepper (Task 9) also go through. -->
      <TimeMachineRail
        :class="{ 'tm-stage__fade-exit': fadingOut }"
        :snapshots="browse.snapshotList"
        :current="browse.currentSnapshotName"
        :loading="browse.tmLoading"
        @select="(name) => browse.switchTo(name)"
      />

      <!-- Gear button (z-tier 10, same tier the vertical stepper below occupies): the one piece of
           the top-right/right-edge chrome group that belongs to no later task by name, so it is
           built here rather than left as a dead `open-settings` emit with no trigger. -->
      <button
        type="button"
        class="tm-stage__gear"
        :class="{ 'tm-stage__fade-exit': fadingOut }"
        :aria-label="t('tmSettings')"
        :title="t('tmSettings')"
        @click="emit('open-settings')"
      >⚙</button>

      <!-- Vertical stepper (Task 9, z-tier 10) -- self-positioned, see TimeMachineStepper.vue's own
           header/<style> comments for the exact edge-hugging geometry this ports from Vue2. Wired
           to the SAME stepLater/stepEarlier the keyboard handler (Task 7, top of this file) already
           calls -- not re-implemented here, per that task's own explicit hand-off note. -->
      <TimeMachineStepper
        :class="{ 'tm-stage__fade-exit': fadingOut }"
        :label="stepperLabel"
        :can-later="canStepLater"
        :can-earlier="canStepEarlier"
        @later="stepLater"
        @earlier="stepEarlier"
      />

      <!-- Bottom action bar (Vue2's own `.tm-bottom-bar`, z-tier 7): Exit calls
           `browse.exitTimeMachine()` directly -- the SAME store action Escape already triggers, two
           reachable channels converging on one destination, Vue2 parity (that file's own header
           comment, "Fix Round 7" section). Restore selection deliberately does NOT call
           `browse.restoreItems(...)` here -- this component has no notion of what is currently
           selected inside the generically-slotted real window; it only emits `restore-selection`
           and leaves assembling the entry list + calling the store action to Task 14's own
           orchestration (see this file's own header comment, "Task 9 addition"). `:disabled` mirrors
           Vue2's own `:disabled="restoring"` -- the store's `restoring` flag is already shared
           across every existing restore entry point (banner / selection toolbar / context menu), so
           this button correctly greys out while any of THOSE has a restore in flight, even before
           Task 14 gives it its own trigger. -->
      <div class="tm-stage__bottom-bar" :class="{ 'tm-stage__fade-exit': fadingOut }">
        <button type="button" class="tm-stage__bar-btn tm-stage__bar-btn--exit" @click="browse.exitTimeMachine()">{{ t('tmExit') }}</button>
        <button
          type="button"
          class="tm-stage__bar-btn tm-stage__bar-btn--restore"
          :disabled="browse.restoring"
          @click="emit('restore-selection')"
        >{{ t('tmRestoreSelection') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The three wrapper layers stay `display: contents` (structurally invisible, zero layout effect)
   until Time Machine mode is active — Vue2 parity (TimeMachineStage.vue's own Fix Round 15,
   "three always-mounted wrapper layers"): the slotted real Files content must remain a direct
   flex participant of whatever it was a child of before this component existed. */
.tm-stage { display: contents; }
.tm-stage--active {
  display: block;
  position: fixed;
  inset: 0;
  /* 900: above everything in the Files area (repo-wide files max is 240 — see marquee-box/
     FileContextMenu) but below this app's shared Dialog/AlertDialog/PromptDialog tier
     (z-index: 1000 overlay / 1001 content). SnapshotSettingsModal (and the still-to-come
     RestoreDestinationModal) render through that same 1000/1001 tier; FileConflictDialog
     (Task 12) claims its own higher 1050/1051 tier so it stacks on top of either one when
     opened from within them — see that file's own header comment. Either way "stage below
     every dialog" holds regardless of which one is open on top of it. */
  z-index: 900;
  overflow: hidden;
}

.tm-stage__hold { display: contents; }
.tm-stage__hold--active {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 8;
  /* Reserves the rail (Task 7, TM_RAIL_WIDTH=220px) + stepper (Task 8, TM_STEPPER_BAND=60px) band
     on the right edge — Vue2's $tm-right-gutter byte-for-byte (timeMachineMath.ts's own header
     comment cites the same two constants) — so the floating window's box structurally cannot
     extend under either control once they land, for any viewport width. */
  padding-right: 280px;
  pointer-events: none;
}
.tm-fwin { display: contents; }
.tm-fwin--active {
  width: 100%;
  height: 100%;
  transform-origin: 50% 58%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--card-shadow-hi);
  background: var(--tm-panel-bg-solid);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  /* Final review (Important 4): SnapshotActionBar.vue (rendered inside the default slot below,
     from Files.vue) floats itself via `position: absolute; bottom: 50px; left: 50%` -- Vue2's own
     fix for the identical component (`_filebrowser.scss`, ".tm-fwin--active { position: relative
     }" comment) makes this box its containing block, so the floating bar is always anchored 50px
     above THIS window's own bottom edge (clipped correctly by `overflow: hidden` above) rather
     than escaping to whatever ancestor happens to be positioned further up the tree. */
  position: relative;
}
/* Hard, untransitioned cut — the exact opposite of everything else in this file, which either
   never transitions decoration at all or fades over --tm-exit-fade-ms. A switch between two
   snapshots (Tasks 7-9's own dolly-travel choreography) hides the real window for its duration;
   revealing it mid-transition would show a half-navigated, visually jarring frame. */
.tm-fwin--traveling {
  opacity: 0 !important;
  transition: none !important;
}

.tm-stage__clone {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  /* Base surface tone under blur(24px) so there is never a visible seam where the cloned
     content's own box model doesn't fully cover it (Vue2's own hardcoded white, tokenized here). */
  background-color: var(--tm-panel-bg-solid);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
}
.tm-stage__glass {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: var(--tm-glass-bg);
  backdrop-filter: var(--tm-glass-blur);
  -webkit-backdrop-filter: var(--tm-glass-blur);
}

.tm-stage__gear {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 10;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--tm-rail-text-dim);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s var(--ease), background 0.2s var(--ease);
}
.tm-stage__gear:hover { color: var(--tm-rail-text); background: var(--tm-ghost-hover-bg); }

/* Bottom action bar -- Vue2 parity byte-for-byte (`.tm-bottom-bar`, TimeMachineStage.vue). 80px
   height is Vue2's own `$tm-bottom-gap` literal (the same 80 timeMachineMath.ts's own
   VISIBLE_STRIP_BOTTOM_GAP pins for the depth-stack's own bottom-clearance geometry -- two
   independent readers of the one Vue2 constant, not a coincidence). z-index 7 is Vue2's own literal
   (below `.tm-stage__hold--active`'s 8, but that wrapper's own `pointer-events: none` -- see this
   file's own `.tm-stage__hold--active` <style> comment -- lets clicks pass through its empty area
   down to this bar without needing any z-index gymnastics). */
.tm-stage__bottom-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80px;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--tm-bar-scrim);
}
.tm-stage__bar-btn {
  border: none;
  border-radius: 980px;
  padding: 8px 18px;
  font-size: 13px;
  color: var(--tm-chrome-text);
  cursor: pointer;
  transition: background 0.15s var(--ease), opacity 0.15s var(--ease);
}
.tm-stage__bar-btn--exit {
  background: var(--tm-bottom-bar-exit-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.tm-stage__bar-btn--exit:hover { background: var(--tm-bottom-bar-exit-hover-bg); }
.tm-stage__bar-btn--restore { background: var(--tm-accent); }
.tm-stage__bar-btn--restore:hover:not(:disabled) { background: var(--tm-accent-hover); }
.tm-stage__bar-btn--restore:disabled { opacity: 0.5; cursor: default; }

/* Pure CSS, 220ms (EXIT_FADE_MS, bound above as --tm-exit-fade-ms so this can never drift from
   the shared constant timeMachineChoreo.ts exports) — applied only to the decorative shell
   (clone/glass/gear), never to the real window itself (which drops instantly, see the `active`
   watcher's own comment on "every live side effect stops immediately"). */
.tm-stage__fade-exit { animation: tm-stage-fade-exit var(--tm-exit-fade-ms) ease forwards; }
@keyframes tm-stage-fade-exit {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>
