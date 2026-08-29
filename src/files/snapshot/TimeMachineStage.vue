<script setup lang="ts">
// Vue2-parity Time Machine stage shell. Ported from Vue2
// components/filebrowser/components/TimeMachineStage.vue's own "three always-mounted wrapper
// layers" model (`.tm-stage > .tm-stage__hold > .tm-fwin > <slot>`, each `display: contents`
// while inactive so it never disturbs the slotted real Files layout, and only becomes a real box
// once Time Machine mode is active) — see that file's own header comment
// for the full "why contents, not v-if" argument this file reproduces byte-for-byte.
//
// Scope: the clone/glass decorative backdrop, the scaled-down real window, the Escape exit
// channel, and the z-index tiers later additions' own markup must slot into
// (clone 0 < glass 1 < depth-stack 3 < bottom bar 7 < real window 8 <
// rail 9 < stepper/gear 10). The bottom bar is a
// second exit channel — Escape is the only one wired up initially.
//
// Depth-stack addition: mounts TimeMachineDepthStack.vue at z-tier 3 (see that component's own header
// comment) and extends `onKeydown` with ArrowUp/ArrowDown (ported from Vue2's own stepLater/
// stepEarlier keyboard handler) alongside the existing Escape channel — preempting the later
// "up/down arrow keys" file-list item; that later work should extend `stepLater`/`stepEarlier` below
// (wiring its own visible stepper buttons to them) rather than re-adding the keyboard listener.
//
// Stepper addition: mounts TimeMachineStepper.vue (z-tier 10, its own self-positioned right-edge
// control -- see that component's own header comment) wired to the SAME stepLater/stepEarlier the
// keyboard handler above already calls, plus the bottom action bar (z-tier 7, Vue2's own
// `.tm-bottom-bar`) with its two buttons: Exit calls `browse.exitTimeMachine()` directly (the
// SAME store action Escape already triggers -- two channels, one destination, Vue2 parity); Restore
// selection only EMITS `restore-selection` -- deciding WHAT is selected and actually calling
// `browse.restoreItems(...)` is the restore orchestration's own job (wiring it here directly
// would be premature -- see this file's own template comment on that button).
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
   * gear dialog is a `<b-modal>` layered differently), but this app's own (now-retired) TimeMachineOverlay.vue
   * hit and fixed the exact same class of bug for its own gear dialog (see that file's own
   * onKeydown header comment) — this prop is the explicit,
   * directly-testable half of that same fix, preserved here per that precedent.
   */
  dialogOpen?: boolean
}>(), { dialogOpen: false })

const emit = defineEmits<{
  (e: 'open-settings'): void
  // The bottom bar's Restore selection button only announces
  // intent -- it does not know what is selected inside the (still generically-slotted) real window,
  // nor call `browse.restoreItems(...)` itself. See this file's own header comment ("Stepper
  // addition") and the button's own template comment for the full rationale.
  (e: 'restore-selection'): void
}>()

const { t } = useI18n()
const browse = useSnapshotBrowseStore()
const wallpaper = useWallpaperStore()

const stageRoot = ref<HTMLElement | null>(null)
const fwinEl = ref<HTMLElement | null>(null)
const cloneMount = ref<HTMLElement | null>(null)

// TimeMachineDepthStack.vue's own stage-height measurement
// needs THIS element (`.tm-stage`, the same one Vue2 measures via its own `$refs.stage`), not its
// own `.tm-depth-stack` wrapper — see tmStageRoot.ts's own header comment for why measuring the
// wrapper double-subtracts the bottom-gap constant resolveSlotPose/computeVisibleStripCap already
// subtract themselves.
provideTmStageRoot(stageRoot)

// Reads `tmChromeVisible`, NOT `tmActive` -- Vue2's own
// `<time-machine-stage :active="isTimeMachineChromeVisible">` (FilePanel.vue) drives this whole
// component's chrome off the HELD flag, not the raw mode flag, so the decorative shell (and this
// component's own keyboard/rail/stepper/bottom-bar interactivity, all gated on `active` below)
// stays up through the exit gap until the exit navigation's target has actually landed -- the
// un-shrinking real window never shows a frame of the OLD snapshot listing underneath. See
// snapshotBrowse.ts's own header comment on tmChromeVisible for the full token+timer mechanism.
const active = computed(() => browse.tmChromeVisible)
// Reads tmTravelActive (TimeMachineDepthStack.vue's own
// reveal-gate — armReveal/settle, ported from Vue2's own armReveal/reveal), NOT tmTravel
// (which clears the instant the store's own router.replace resolves, ms before the depth-stack's
// 420-900ms dolly sweep or the target's own preview listing have actually finished — releasing
// the hard-hide on THAT signal revealed the real window mid-animation on essentially every
// switch). See snapshotBrowse.ts's own header comment on tmTravelActive for the full split.
const traveling = computed(() => browse.tmTravelActive)
const fadingOut = ref(false)

// Vue2's own `isEmpty` computed, ported
// verbatim (`TimeMachineStage.vue:1676-1678`, "`!this.loading && this.flatItems.length === 0`") --
// gated on `!tmLoading`, not just an empty list, so the initial in-flight fetch (list still empty,
// nothing wrong) never flashes the empty-state message before the real ticks (or a genuinely empty
// volume) have had a chance to resolve.
const isEmpty = computed(() => !browse.tmLoading && browse.snapshotList.length === 0)

// TM_WINDOW_SCALE (timeMachineMath.ts) is the single source of the 0.82 scale factor — bound via
// :style rather than duplicated as a literal in the style block below, so the two can never drift apart.
const fwinStyle = computed(() => (active.value ? { transform: `scale(${TM_WINDOW_SCALE})` } : undefined))

// Fallback background for the clone layer when capture fails, or on the case of a
// deep-link landing already-active with nothing pre-Time-Machine to have captured — same
// "screenshot vs wallpaper" fallback Vue2's own hasEntryClone/wallpaperImageUrl pair implements.
const fallbackStyle = computed(() => {
  const url = recordUrl(wallpaper.record)
  return url ? { backgroundImage: `url(${url})` } : undefined
})

let pendingClone: Node | null = null
const hasClone = ref(false)

// Clone-backdrop media placeholder DOM-walk, ported byte-for-byte from Vue2's own
// `sanitizeClonedNode`. `cloneNode(true)` never preserves a canvas's drawn bitmap or a video's decoded frame
// -- a cloned `<video>`/`<canvas>` renders blank/broken, not a copy of what was on screen -- so
// this walks the clone and swaps every one for an inert placeholder div (Vue2's own
// `.tm-stage__clone-media-placeholder`, "nobody sees detail under blur(24px)" per that file's own
// comment, so a flat placeholder is strictly better than a broken element showing through). Also
// strips every `id` (root inclusive -- a cloned element must never let
// `document.getElementById` resolve to it) and `name` (so a cloned form control can never
// participate in a real `<form>` submission or a `document.forms` lookup), and marks the whole
// subtree `aria-hidden` + `pointer-events: none` on the clone's own root -- belt-and-braces
// alongside the existing host-level `aria-hidden`/CSS `pointer-events: none` on `.tm-stage__clone`
// itself (see this file's own template and style-block comments), same reasoning Vue2's own comment gives:
// `cloneNode(true)` never copies `addEventListener`-attached handlers anyway, so neither clone can
// ever fire a real click handler regardless of this pointer-events belt-and-braces.
function sanitizeClonedNode(root: Node): Node {
  if (!(root instanceof Element)) return root
  root.removeAttribute('id')
  root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  root.querySelectorAll('[name]').forEach((el) => el.removeAttribute('name'))
  root.querySelectorAll('video, canvas').forEach((el) => {
    const placeholder = document.createElement('div')
    placeholder.className = 'tm-stage__clone-media-placeholder'
    el.parentNode?.replaceChild(placeholder, el)
  })
  root.setAttribute('aria-hidden', 'true')
  if (root instanceof HTMLElement) root.style.pointerEvents = 'none'
  return root
}

function captureClone() {
  pendingClone = null
  hasClone.value = false
  const el = fwinEl.value
  if (!el) return
  try {
    pendingClone = sanitizeClonedNode(el.cloneNode(true))
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

// Preempts the later "up/down arrow keys" line item -- see this file's own header
// comment; the later stepper/rail work should extend this rather than re-adding it. The SAME
// switchTo funnel a tick click / stepper click will use -- Vue2's stepEarlier/stepLater, ported.
// `clampStepIndex` fuses "can I step" and
// "what's the next index" into one call; `browse.snapshotList` is newest-first, so a HIGHER
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

// The visible stepper's own `:disabled` state, pure-function derived from the
// SAME clampStepIndex call stepLater/stepEarlier themselves guard with above -- exactly the "one
// notion of can-I-step, not three" posture this component aims for (its own
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

// Escape is one of exactly two exit channels (the other is the bottom-bar Exit button)
// — see this file's own header comment. Two guards, same posture as
// TimeMachineOverlay.vue's own onKeydown: an explicit caller-supplied `dialogOpen` flag for the
// one dialog Files.vue already knows about, PLUS a generic "the event's own target is not inside
// this stage" check that also covers any OTHER Teleported dialog (rename/conflict/etc.) stacked
// above it without needing a dedicated prop wired through for each one. ArrowUp/ArrowDown
// share the SAME two guards -- a dialog stacked above the stage (e.g. a text input
// inside it) must not have its own arrow-key navigation hijacked by snapshot stepping underneath.
// Ported from a Vue2 user report: ArrowUp -> stepLater (next MORE RECENT), ArrowDown
// -> stepEarlier (next OLDER) -- see stepLater/stepEarlier's own comment for the index direction.
function onKeydown(e: KeyboardEvent) {
  const isEscape = e.code === 'Escape' || e.key === 'Escape'
  const isArrowUp = e.code === 'ArrowUp'
  const isArrowDown = e.code === 'ArrowDown'
  if (!isEscape && !isArrowUp && !isArrowDown) return
  if (props.dialogOpen) return
  const target = e.target
  // document.body/documentElement are exempted from the
  // containment check -- they are the browser's own default focus target (after clicking a file
  // row/glass/blank space, or simply never having received focus at all, e.g. right after the
  // deep-link auto-enter path), NOT a Teleported dialog stacked above the stage. The un-exempted
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
// Verified empirically, not just asserted: Vue 3's scheduler already
// flushes pre-flush watcher callbacks before any component's own render job in the SAME batch
// (that ordering is structural to 'pre', not a coincidence of effect-creation order) — so, for
// this exact call site, flipping this option to the Composition API's default 'pre' does NOT
// reproduce the bug (confirmed red/green both ways, see TimeMachineStage.test.ts's own comment on
// its capture-timing test). The genuine regression is deferring the capture call itself past the
// render — e.g. `nextTick(() => captureClone())` instead of a bare `captureClone()` — which DOES
// turn that test red (confirmed the same way). 'sync' is kept anyway as the more conservative,
// scheduler-detail-independent choice (it runs inline with whatever set browse.tmChromeVisible, with no
// dependency on 'pre'-queue-before-render-job being true in whatever Vue version/config this ever
// runs under) — the actual correctness invariant this whole watcher exists to protect is
// "captureClone() itself runs synchronously, not deferred", not the specific `flush` option.
// Mirrors Vue2's own `watch: { active(val) {...} }` in spirit (Vue2 TimeMachineStage.vue's own
// header comment cites the same watcher-before-render concern), even though Vue3's mechanism for
// guaranteeing it differs from Vue2's id-ordered watcher queue.
//
// Watches `tmChromeVisible`, NOT `tmActive` -- Vue2's own
// `active` prop IS `isTimeMachineChromeVisible`, so this component's own `active`-driven watcher
// was always keyed to the held flag, never the raw mode flag. Keeping this watcher on tmActive
// while the `active` computed above reads tmChromeVisible would desync the two: the keydown
// listener/fadingOut crossfade would tear down the instant tmActive drops, mid-exit-hold, while
// the template's own decorative shell (gated on `active || fadingOut`) is still trying to stay up
// -- fadingOut would win the race and destroy the clone/hide the shell out from under a hold that
// has not actually settled yet.
watch(
  () => browse.tmChromeVisible,
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
  // Mirrors the `active` watcher's own setup for the case of mounting already-active
  // (a watcher only fires on a change, never on the initial value) — Vue2's own `mounted()` hook
  // has the identical mirror for the same reason.
  if (browse.tmChromeVisible) window.addEventListener('keydown', onKeydown)
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
      <!-- z-tier 3: the Apple-style depth-stack cascade -- see TimeMachineDepthStack.vue's
           own header comment for the full slot/travel model. `tm-stage__fade-exit` is a fallthrough
           class (lands on the component's own root, same mechanism the clone/glass layers above
           already rely on for their own scoped rule to apply across the component boundary). -->
      <TimeMachineDepthStack :class="{ 'tm-stage__fade-exit': fadingOut }" />
    </template>

    <div class="tm-stage__hold" :class="{ 'tm-stage__hold--active': active }">
      <div
        ref="fwinEl"
        class="tm-fwin"
        :class="{ 'tm-fwin--active': active, 'tm-fwin--traveling': traveling, 'tm-fwin--empty': active && isEmpty }"
        :style="fwinStyle"
      >
        <slot />
      </div>
    </div>

    <template v-if="active || fadingOut">
      <!-- Right-edge fisheye tick rail (z-tier 9) vs the empty-state message: Vue2 parity --
           `v-else-if="flatItems.length === 0"` shows the rail
           ONLY once there is something to show it for (loading OR a non-empty list); a genuinely
           empty volume shows the centered "No snapshots yet" message instead, in the SAME slot the
           rail would otherwise occupy (TimeMachineStage.vue:1385-1388). The rail component itself
           still owns its own internal loading-skeleton-vs-real-ticks split (its own `loading` prop)
           -- this level only decides "rail region at all" vs "empty message instead". -->
      <TimeMachineRail
        v-if="browse.tmLoading || browse.snapshotList.length > 0"
        :class="{ 'tm-stage__fade-exit': fadingOut }"
        :snapshots="browse.snapshotList"
        :current="browse.currentSnapshotName"
        :loading="browse.tmLoading"
        @select="(name) => browse.switchTo(name)"
      />
      <div v-else class="tm-stage__empty" :class="{ 'tm-stage__fade-exit': fadingOut }">
        <p class="tm-stage__empty-title">{{ t('snapNoneYet') }}</p>
        <p class="tm-stage__empty-sub">{{ t('snapEmptyHint') }}</p>
      </div>

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
      >
        <!-- Vue2's own gear is MDI
             `cog-outline` (`<b-icon icon="cog-outline">`, TimeMachineStage.vue:1330) -- ported as a
             hand-inlined SVG reproducing that exact MDI path, house convention for chrome-icon SVGs
             in this app (see SnapshotActionBar.vue's own header comment on hand-inlining
             ThemeToggle.vue/HomeTopbar.vue-style, and ThemeToggle.vue's own `.ic` class for the
             same "class + explicit width/height in its style block" shape this follows below) -- replacing
             the previous plain Unicode `⚙`, a visibly different glyph shape/weight/stroke. -->
        <svg class="tm-stage__gear-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,12.97L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.03 19.05,18.95L16.56,17.94C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.61L12.75,4H11.25Z" />
        </svg>
      </button>

      <!-- Vertical stepper (z-tier 10) -- self-positioned, see TimeMachineStepper.vue's own
           header and style-block comments for the exact edge-hugging geometry this ports from Vue2. Wired
           to the SAME stepLater/stepEarlier the keyboard handler (top of this file) already
           calls -- not re-implemented here, by design. -->
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
           reachable channels converging on one destination, Vue2 parity. Restore selection deliberately does NOT call
           `browse.restoreItems(...)` here -- this component has no notion of what is currently
           selected inside the generically-slotted real window; it only emits `restore-selection`
           and leaves assembling the entry list + calling the store action to the restore
           orchestration (see this file's own header comment, "Stepper addition"). `:disabled` mirrors
           Vue2's own `:disabled="restoring"` -- the store's `restoring` flag is already shared
           across every existing restore entry point (banner / selection toolbar / context menu), so
           this button correctly greys out while any of THOSE has a restore in flight, even before
           the restore orchestration gives it its own trigger. -->
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
   until Time Machine mode is active — Vue2 parity (TimeMachineStage.vue's own
   "three always-mounted wrapper layers" model): the slotted real Files content must remain a direct
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
     claims its own higher 1050/1051 tier so it stacks on top of either one when
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
  /* Reserves the rail (TM_RAIL_WIDTH=220px) + stepper (TM_STEPPER_BAND=60px) band
     on the right edge — Vue2's $tm-right-gutter byte-for-byte (timeMachineMath.ts's own header
     comment cites the same two constants) — so the floating window's box structurally cannot
     extend under either control once they land, for any viewport width. */
  padding-right: 280px;
  /* Vue2's own `$tm-bottom-gap` literal
     (`.tm-stage__hold--active { padding-bottom: $tm-bottom-gap }`, TimeMachineStage.vue:3152) --
     matches the SAME 80px literal `.tm-stage__bar-btn`'s own `.tm-stage__bottom-bar` height uses
     below, and `TimeMachineDepthStack.vue`'s own `bottom: 80px` -- reserves the bottom band inside
     the window wrapper's own content box so the real window's content never sits under the bottom
     action bar (was previously reserving only the right gutter, never the bottom one). */
  padding-bottom: 80px;
  pointer-events: none;
}
.tm-fwin { display: contents; }
.tm-fwin--active {
  width: 100%;
  height: 100%;
  transform-origin: 50% 58%;
  border-radius: 12px;
  overflow: hidden;
  /* Vue2's own `.tm-fwin--active` box-shadow
     is a single layer (TimeMachineStage.vue:3198) -- same substitution error as the depth strips
     (`--card-shadow-hi`'s 3-layer shadow with an inset highlight Vue2 never has), on the single
     most prominent element on screen (see theme.css's own comment on `--tm-fwin-shadow` for the
     exact value, not repeated here to avoid writing a bare color literal in this style block). */
  box-shadow: var(--tm-fwin-shadow);
  /* This used to
     be `var(--tm-panel-bg-solid)` -- TM's own chrome token, pinned to plain opaque white in BOTH
     themes (Vue2's window styling was authored for a light-only app). The slotted content is the REAL
     Files window (breadcrumb/listing/etc.), which paints its own text in New-UI's OWN theme
     tokens (`--fg` etc, light in dark theme) -- forcing a permanently-white pane underneath it
     made every label white-on-white in dark theme. "Identical in both
     themes" governs the TM CHROME (glass/rail/stepper/bars/white-glass modals) only -- the real
     window (this element) and the preview windows' content (SnapshotPreviewWindow.vue,
     TimeMachineDepthStack.vue's own `.tm-depth-strip`) are "real windows of THIS app" and must
     follow New-UI's own theme, same as the Files view does outside Time Machine mode. `--panel-bg-
     solid` (the GLOBAL, non-`tm-` token, theme.css) is the app's own existing "fully opaque panel
     that must occlude what is behind it" token -- dark gradient in dark theme, white in light
     theme -- already load-bearing for exactly this "opaque regardless of theme" need elsewhere
     (see the opaque-surface token's own consumer-whitelist test, extended for this fix). */
  background: var(--panel-bg-solid);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  /* SnapshotActionBar.vue (rendered inside the default slot below,
     from Files.vue) floats itself via `position: absolute; bottom: 50px; left: 50%` -- Vue2's own
     fix for the identical component (`_filebrowser.scss`, ".tm-fwin--active { position: relative
     }" comment) makes this box its containing block, so the floating bar is always anchored 50px
     above THIS window's own bottom edge (clipped correctly by `overflow: hidden` above) rather
     than escaping to whatever ancestor happens to be positioned further up the tree. */
  position: relative;
}
/* Hard, untransitioned cut — the exact opposite of everything else in this file, which either
   never transitions decoration at all or fades over --tm-exit-fade-ms. A switch between two
   snapshots (the dolly-travel choreography) hides the real window for its duration;
   revealing it mid-transition would show a half-navigated, visually jarring frame. */
.tm-fwin--traveling {
  opacity: 0 !important;
  transition: none !important;
}
/* A volume with ZERO snapshots -- the
   always-mounted real window (wrapping the default slot) would otherwise keep painting the LIVE
   directory dressed as a read-only snapshot window behind the "No snapshots yet" message below.
   Same hard, untransitioned idiom as `--traveling` above (Vue2's own `.tm-fwin--empty`,
   TimeMachineStage.vue:3242-3246) -- deliberately its own modifier, not a persistent value on
   `.tm-fwin`/`.tm-fwin--active`. */
.tm-fwin--empty {
  opacity: 0 !important;
  pointer-events: none;
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
/* Vue2 parity byte-for-byte
   (`.tm-stage__clone-media-placeholder`, TimeMachineStage.vue:2936-2940) -- the stand-in box
   `sanitizeClonedNode` (see this file's own script-block comment) swaps in for every cloned
   video/canvas element, in place of the dead black box either would otherwise render as. */
.tm-stage__clone-media-placeholder {
  width: 100%;
  height: 100%;
  background: var(--tm-clone-media-placeholder-bg);
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

/* Vue2's own `.tm-stage__gear-tooltip`/
   `.tm-stage__gear` pair (TimeMachineStage.vue:3253-3263) -- position 20px/24px (not 8px/16px),
   no fixed circular hit box (Vue2 sizes purely off the icon's own intrinsic box; `padding: 8px`
   here keeps a reasonable touch target without inventing a filled circle Vue2 never has), resting
   color pinned by `--tm-gear-text` (new token, see theme.css's own comment for the exact Vue2
   literal), hover color pure white (reuses the existing `--tm-chrome-text`, the SAME literal
   Vue2's own hover color is), hover `rotate(45deg)` (the signature "gear turns" animation,
   previously entirely absent), and NO hover background (Vue2 never has one -- the port's own
   `--tm-ghost-hover-bg` fill was a bolted-on addition, removed). Transition/easing ported
   literally (`transform 0.2s ease, color 0.2s ease`, 3261) -- `background` dropped from the
   transition list since there is no longer a background to transition. */
.tm-stage__gear {
  position: absolute;
  top: 20px;
  right: 24px;
  z-index: 10;
  padding: 8px;
  border: none;
  background: none;
  color: var(--tm-gear-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease;
}
.tm-stage__gear:hover { color: var(--tm-chrome-text); transform: rotate(45deg); }
/* The inline MDI cog-outline SVG's own intrinsic box -- 20px matches this button's
   previous `font-size: 20px` (the Unicode glyph's own rendered size before this port). */
.tm-stage__gear-icon { width: 20px; height: 20px; }

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
}
.tm-stage__bar-btn--exit {
  background: var(--tm-bottom-bar-exit-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  /* Vue2's own `&__exit` rule
     (TimeMachineStage.vue:3502-3512) declares NO transition at all -- its hover is an instant,
     untransitioned snap. The port previously inherited a 0.15s transition from the shared
     `.tm-stage__bar-btn` rule that Vue2 never has here; left undeclared now, matching Vue2. */
}
.tm-stage__bar-btn--exit:hover { background: var(--tm-bottom-bar-exit-hover-bg); }
.tm-stage__bar-btn--restore {
  background: var(--tm-accent);
  /* Vue2's own literal
     (`background 0.15s ease, opacity 0.15s ease`, 3521) -- plain `ease`, not `var(--ease)`'s
     custom cubic-bezier curve (a port-only substitution `.tm-stepper__btn`'s own transition made
     too, see TimeMachineStepper.vue). Scoped to `--restore` only now that `--exit` has none. */
  transition: background 0.15s ease, opacity 0.15s ease;
}
.tm-stage__bar-btn--restore:hover:not(:disabled) { background: var(--tm-accent-hover); }
.tm-stage__bar-btn--restore:disabled { opacity: 0.5; cursor: default; }

/* Vue2 parity byte-for-byte
   (TimeMachineStage.vue:3339-3356) -- centered focal message filling the space the (now hidden,
   `.tm-fwin--empty` above) live window used to occupy while a volume has zero snapshots.
   `pointer-events: none` so this full-stage overlay never swallows clicks meant for the bottom bar
   (z-index 7, below this) or the gear/stepper (z-index 10, above); z-index 9 matches the rail's own
   tier it replaces in that same template slot. */
.tm-stage__empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9;
  text-align: center;
  pointer-events: none;
}
.tm-stage__empty-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--tm-empty-title);
  text-shadow: var(--tm-rail-text-shadow);
}
.tm-stage__empty-sub {
  font-size: 13px;
  color: var(--tm-empty-sub);
  text-shadow: var(--tm-rail-text-shadow);
}

/* Pure CSS, 220ms (EXIT_FADE_MS, bound above as --tm-exit-fade-ms so this can never drift from
   the shared constant timeMachineChoreo.ts exports) — applied only to the decorative shell
   (clone/glass/gear), never to the real window itself (which drops instantly, see the `active`
   watcher's own comment on "every live side effect stops immediately"). */
.tm-stage__fade-exit { animation: tm-stage-fade-exit var(--tm-exit-fade-ms) ease forwards; }
@keyframes tm-stage-fade-exit {
  from { opacity: 1; }
  to { opacity: 0; }
}
/* Vue2's own reduced-motion override
   (`transition: none`, TimeMachineStage.vue:3119-3127) collapses this exit fade to an instant cut
   rather than an animated one -- ported here as `animation: none` (this port's own mechanism is a
   keyframe animation, not a transition) PLUS an explicit `opacity: 0` so the element still actually
   disappears instantly instead of being stranded at its un-animated `from { opacity: 1 }` state. */
@media (prefers-reduced-motion: reduce) {
  .tm-stage__fade-exit { animation: none; opacity: 0; }
}
</style>
