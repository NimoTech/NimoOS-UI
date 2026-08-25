<script setup lang="ts">
// Vue2-parity Time Machine stage shell (Task 6 of
// docs/superpowers/sdd/2026-08-25-files-time-machine-vue2-parity). Ported from Vue2
// components/filebrowser/components/TimeMachineStage.vue's own "three always-mounted wrapper
// layers" model (`.tm-stage > .tm-stage__hold > .tm-fwin > <slot>`, each `display: contents`
// while inactive so it never disturbs the slotted real Files layout, and only becomes a real box
// once Time Machine mode is active) — see that file's own header comment, Fix Round 15 section,
// for the full "why contents, not v-if" argument this file reproduces byte-for-byte.
//
// Scope (Task 6 only — Tasks 7-9 build on top of this same shell, do not duplicate their work
// here): the clone/glass decorative backdrop, the scaled-down real window, the Escape exit
// channel, and the z-index tiers every later task's own markup must slot into
// (clone 0 < glass 1 < depth-stack 3 (Task 7) < bottom bar 7 (Task 9) < real window 8 <
// rail 9 (Task 7) < stepper/gear 10 (Task 8, gear built here)). The bottom bar is Task 9's own
// second exit channel — Escape is the only one this task wires up.
//
// Unlike Vue2 (a plain `active` prop threaded down from FilePanel.vue's own isTimeMachineMode),
// this component reads active/travel state straight off the snapshotBrowse store — Files.vue's
// wrap only has to supply the real slot content and forward `open-settings`, nothing else.
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useWallpaperStore, recordUrl } from '../../stores/wallpaper'
import { TM_WINDOW_SCALE } from '../util/timeMachineMath'
import { EXIT_FADE_MS } from '../util/timeMachineChoreo'

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

const emit = defineEmits<{ (e: 'open-settings'): void }>()

const { t } = useI18n()
const browse = useSnapshotBrowseStore()
const wallpaper = useWallpaperStore()

const stageRoot = ref<HTMLElement | null>(null)
const fwinEl = ref<HTMLElement | null>(null)
const cloneMount = ref<HTMLElement | null>(null)

const active = computed(() => browse.tmActive)
const traveling = computed(() => browse.tmTravel !== null)
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

// Escape is one of exactly two exit channels (the other, the bottom-bar Exit button, is Task 9's
// own addition) — see this file's own header comment. Two guards, same posture as
// TimeMachineOverlay.vue's own onKeydown: an explicit caller-supplied `dialogOpen` flag for the
// one dialog Files.vue already knows about, PLUS a generic "the event's own target is not inside
// this stage" check that also covers any OTHER Teleported dialog (rename/conflict/etc.) stacked
// above it without needing a dedicated prop wired through for each one.
function onKeydown(e: KeyboardEvent) {
  if (e.code !== 'Escape' && e.key !== 'Escape') return
  if (props.dialogOpen) return
  const target = e.target
  if (target instanceof Element && stageRoot.value && !stageRoot.value.contains(target)) return
  e.preventDefault()
  browse.exitTimeMachine()
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
    </template>

    <div class="tm-stage__hold" :class="{ 'tm-stage__hold--active': active }">
      <div ref="fwinEl" class="tm-fwin" :class="{ 'tm-fwin--active': active, 'tm-fwin--traveling': traveling }" :style="fwinStyle">
        <slot />
      </div>
    </div>

    <template v-if="active || fadingOut">
      <!-- Gear button (z-tier 10, same tier the vertical stepper — Task 8 — will occupy): the one
           piece of the top-right/right-edge chrome group that belongs to no later task by name,
           so it is built here rather than left as a dead `open-settings` emit with no trigger. -->
      <button
        type="button"
        class="tm-stage__gear"
        :class="{ 'tm-stage__fade-exit': fadingOut }"
        :aria-label="t('tmSettings')"
        :title="t('tmSettings')"
        @click="emit('open-settings')"
      >⚙</button>
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
     (z-index: 1000 overlay / 1001 content) — settings, restore-destination, and file-conflict
     dialogs all render through those same three shared components today (grepped: New-UI has no
     distinct tier between them yet), so "stage below every dialog" holds regardless of which one
     is open on top of it. */
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
