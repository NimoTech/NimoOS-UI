<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { groupSnapshotsByDay } from '../../storage/util/snapshotView'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { stepSelectedIndex } from '../util/timeMachineMath'
import { useDeckPreview } from '../composables/useDeckPreview'
import type { FileEntry } from '../stores/files'
import TimeMachineBar from './TimeMachineBar.vue'
import TimeMachineDeck from './TimeMachineDeck.vue'
import TimeMachineRail from './TimeMachineRail.vue'

const props = defineProps<{
  volumeUuid: string
  mountPoint: string
  /** Current directory path relative to the volume root; empty string means at the volume root */
  relPath: string
  /** The human-readable path shown at the top (virtual path, with the disk display name) */
  folderLabel: string
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'select', path: string): void; (e: 'open-settings'): void }>()

const { t } = useI18n()
const store = useSnapshotStore()
// Two indices, deliberately. selectedIndex is the card actually at the front right now;
// targetIndex is where the user asked to go. Clicking a tick eight snapshots away used to
// assign the index in one go, so the deck cut straight there and the seven cards in between
// were never seen (user feedback: "flipping several pages just jumps, there is no page-flip
// animation -- I want to really see 10 pages go past"). The stepper below walks selectedIndex
// toward targetIndex one snapshot per tick, so every card in between takes its turn at the
// front and flies out, and the rail highlight travels through the ticks with it.
const selectedIndex = ref(0)
const targetIndex = ref(0)
// Pace: one step per interval, where the interval is the remaining travel budget spread over
// the snapshots still to pass. Remaining shrinks as we go, so the interval grows -- the run
// decelerates into its destination instead of stopping dead. Clamped at both ends: STEP_MAX
// keeps a two-card hop from feeling sluggish, STEP_MIN keeps a hundred-card hop from taking
// ten seconds (at that distance the cards blur past, which is the honest depiction of the
// distance travelled).
// Pace, and why it landed back where it started: 110ms was first reported as too fast in the
// newest-to-earliest direction, so it was slowed to 220ms -- but that judgement was made on a build
// where the flip never animated at all (the cards teleported; see TimeMachineDeck's note on stable
// render order). With the transition actually running, 220ms reads as sluggish and 110ms is right,
// which is where the owner put it back. Don't "fix" this by slowing it again without checking that
// the transition is really interpolating first.
const STEP_BUDGET_MS = 900
const STEP_MIN_MS = 24
const STEP_MAX_MS = 110
let stepTimer: ReturnType<typeof setTimeout> | null = null
function clearStepTimer() {
  if (stepTimer !== null) { clearTimeout(stepTimer); stepTimer = null }
}
function stepInterval(remaining: number): number {
  return Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, STEP_BUDGET_MS / Math.max(remaining, 1)))
}
// Walks one snapshot and schedules the next while there is still ground to cover. targetIndex
// is re-read every tick, so a click (or key repeat) landing mid-run redirects the walk --
// including reversing it -- without stacking a second timer.
function stepOnce() {
  stepTimer = null
  const from = selectedIndex.value
  const to = targetIndex.value
  if (from === to) return
  selectedIndex.value = from + Math.sign(to - from)
  const remaining = Math.abs(targetIndex.value - selectedIndex.value)
  if (remaining > 0) stepTimer = setTimeout(stepOnce, stepInterval(remaining))
}
// Every path that moves the selection goes through here: rail clicks, rail step buttons, arrow
// keys. The first step is taken synchronously so a single-snapshot move stays instant.
function goToIndex(index: number) {
  targetIndex.value = stepSelectedIndex(index, 0, flatItems.value.length)
  clearStepTimer()
  stepOnce()
}
// Used when the walk must not be left half-finished: entering a snapshot has to act on the one
// the user asked for, not on whichever card the animation happens to be passing through.
function flushSteps() {
  clearStepTimer()
  selectedIndex.value = targetIndex.value
}
// Folder the deck has been drilled into, relative to props.relPath (empty = the folder the
// files area is standing in). Clicking a folder on a card walks down here instead of leaving
// the time machine, which is what "folders in the snapshot can't be opened" meant: a folder
// click bubbled up to the card, and a click on the front card means "enter this snapshot".
const subPath = ref('')
// How long after the last selection change the incoming front card may lay out its file grid.
// Mounting up to 200 cells (each an <img> with its own IntersectionObserver) in the same frame
// the transform starts is what made the flip stutter, so the grid waits for the deck to settle.
// Holding an arrow key therefore flips through text-only cards and paints the grid once, after
// the user stops -- the trade the owner explicitly accepted ("when going to the previous one,
// don't load the next one yet").
// ⚠️ Must stay >= TimeMachineCard's .tm-card transform duration (0.45s). A shorter value only
// looks like it works: measured in a real browser at 260ms against the old 450ms transition,
// the grid mounted 190ms before the transform finished, i.e. still inside the animation this is
// meant to keep clear. The flip transition is 0.32s now, so this came down with it.
const PREVIEW_SETTLE_MS = 360
const settledIndex = ref(0)
let settleTimer: ReturnType<typeof setTimeout> | null = null
function clearSettleTimer() {
  if (settleTimer !== null) { clearTimeout(settleTimer); settleTimer = null }
}

// Grouping reuses the SP6-P5 accepted groupSnapshotsByDay (not rewritten), then flattens into
// a list with flatIndex: the deck, keyboard stepping, and rail all work on this cross-day flat
// index. label.i18nKey is already this repo's key name ('snapToday' / 'snapYesterday', see
// snapshotDayLabel in storage/util/snapshotView.ts), so just t() it — same as
// storage/components/SnapshotTimeline.vue. Do not add another 'Today'/'Yesterday' mapping
// layer (those are two different value sets; mapping would always compare false and always
// collapse to "yesterday").
const groups = computed(() => {
  let i = 0
  return groupSnapshotsByDay(store.snapshots).map((g) => ({
    dayKey: g.dayKey,
    labelText: g.label.i18nKey ? t(g.label.i18nKey) : (g.label.text ?? ''),
    items: g.items.map((item) => ({ ...item, flatIndex: i++ })),
  }))
})
const flatItems = computed(() => groups.value.flatMap((g) => g.items.map((it) => ({ ...it, dayLabelText: g.labelText }))))
const selectedItem = computed(() => flatItems.value[selectedIndex.value] ?? null)
// Which way the deck can still be walked. The list is newest-first, so the newest snapshot is at
// index 0 (the top of the rail) and "earlier" means a larger index. Read off targetIndex, not
// selectedIndex: while a walk is in flight the buttons must reflect where it is heading, or the
// one you are holding greys out under the cursor before the deck gets there.
const canNewer = computed(() => targetIndex.value > 0)
const canEarlier = computed(() => targetIndex.value < flatItems.value.length - 1)
const momentText = computed(() => (selectedItem.value ? `${selectedItem.value.dayLabelText} ${selectedItem.value.time}` : ''))
// The directory every card previews: the files area's folder plus however far the user has
// drilled down inside the cards.
const effRelPath = computed(() => {
  if (!subPath.value) return props.relPath
  return props.relPath ? `${props.relPath}/${subPath.value}` : subPath.value
})

// Only the front card's folder listing is fetched. It used to be the whole deck window
// (front + 4 behind + 2 past), i.e. up to 7 directory listings per selection change, of which
// at most two were ever rendered -- rear cards deliberately draw no grid. The rest was
// bandwidth and main-thread work spent during the very animation the user reported as not
// smooth. Stepping back to an already-seen snapshot is still instant: useDeckPreview caches by
// snapshot name and only drops the cache when the directory itself changes.
//
// It follows targetIndex, not selectedIndex: a ten-snapshot walk passes nine cards the user
// never asked to look at, and listing each of them would put ten requests on the wire during
// the animation. A short debounce collapses a burst of clicks/key-repeats into one request for
// wherever the user actually ended up. It is deliberately much shorter than the grid's settle
// delay, so the listing is usually already in hand by the time the deck stops walking --
// including for enterSnapshot's "does this folder exist in that snapshot" check, which reads
// this same map. (Hammering "enter" within PREVIEW_FETCH_DEBOUNCE_MS of a flip still finds no
// entry and falls back to composing the sub-path, exactly as it did before this whole change.)
const PREVIEW_FETCH_DEBOUNCE_MS = 120
const fetchIndex = ref(0)
let fetchTimer: ReturnType<typeof setTimeout> | null = null
function clearFetchTimer() {
  if (fetchTimer !== null) { clearTimeout(fetchTimer); fetchTimer = null }
}
watch(targetIndex, (index) => {
  clearFetchTimer()
  fetchTimer = setTimeout(() => { fetchTimer = null; fetchIndex.value = index }, PREVIEW_FETCH_DEBOUNCE_MS)
})
const previewNames = computed(() => {
  const item = flatItems.value[fetchIndex.value]
  return item ? [item.name] : []
})
const { previews, ensure } = useDeckPreview({
  mountPoint: () => props.mountPoint,
  relPath: () => effRelPath.value,
  visibleNames: () => previewNames.value,
})
// What the deck is allowed to render. While a flip is still settling, the incoming front card's
// preview is withheld so it stays a text-only card for the duration of the transform; the card
// flying out keeps its own grid (continuity), and the grid appears once the deck stops.
const deckPreviews = computed(() => {
  const name = selectedItem.value?.name
  if (!name || settledIndex.value === selectedIndex.value) return previews.value
  const out = { ...previews.value }
  delete out[name]
  return out
})

async function load() {
  if (!props.volumeUuid) return
  await store.loadSnapshots(props.volumeUuid)
  // Every (re)load returns to the newest snapshot — the old index may not point to the same snapshot in the new list
  clearSettleTimer()
  clearStepTimer()
  clearFetchTimer()
  selectedIndex.value = 0
  targetIndex.value = 0
  settledIndex.value = 0
  fetchIndex.value = 0
}
defineExpose({ reload: load })

let entering = false
async function enterSnapshot() {
  // Finish any walk still in flight first, so "enter" acts on the snapshot the user aimed at
  // rather than the one the deck is currently passing through.
  flushSteps()
  if (!props.mountPoint || !selectedItem.value || entering) return
  const item = selectedItem.value
  const rel = effRelPath.value
  const root = snapshotBrowsePath(props.mountPoint, item.name)
  // ⚠️ Deliberate correction over Vue2 (spec §4 item 1): Vue2's enterSnapshot only jumps to
  // the snapshot root -- a user opening Time Machine at /Photos/2024 got dumped back at the
  // volume root and had to click back down level by level. The card shows the current folder
  // at that moment, so entering should naturally land on the same relative path.
  if (!rel) { emit('select', root); return }
  // Only compose the sub-path for a listing that actually came back. If the folder is not in this
  // snapshot, composing it anyway makes files.load fall into its catch and degrade the result to
  // "empty folder" -- the user then concludes this snapshot backed nothing up, which is a lie.
  // Landing at the snapshot root is honest in every unconfirmed case, and it is the only safe
  // default available: the listing endpoint cannot tell "was not there" from "could not be read"
  // (see useDeckPreview). The previous version redirected only on an explicit 'missing', which on
  // this backend never happened.
  //
  // The answer has to be awaited rather than read optimistically: listings are debounced and only
  // the target snapshot is ever listed, so "flip one card, immediately hit enter" genuinely arrives
  // here with nothing known yet. ensure() reuses the cache or an already-running request, so the
  // common case (the listing landed while the deck was still walking) does not wait at all.
  let status = previews.value[item.name]?.status
  if (status !== 'ready' && status !== 'missing') {
    entering = true
    try { status = (await ensure(item.name)).status } finally { entering = false }
    // The selection or the drilled path may have moved while we waited; navigating to what the
    // user has since aimed away from would be worse than not navigating at all.
    if (selectedItem.value?.name !== item.name || effRelPath.value !== rel) return
  }
  emit('select', status === 'ready' ? `${root}/${rel}` : root)
}

// Walking the deck. stepSelection is shared by the rail's two step buttons and the arrow keys,
// so both clamp at the ends the same way. It steps from the TARGET, not from the card on
// screen: holding an arrow key must queue up ten snapshots of travel, not keep re-aiming one
// step ahead of a deck that is still catching up.
function stepSelection(delta: number) {
  goToIndex(stepSelectedIndex(targetIndex.value, delta, flatItems.value.length))
}
function openDir(entry: FileEntry) {
  if (!entry?.name) return
  subPath.value = subPath.value ? `${subPath.value}/${entry.name}` : entry.name
}
function goUp() {
  if (!subPath.value) return
  const cut = subPath.value.lastIndexOf('/')
  subPath.value = cut === -1 ? '' : subPath.value.slice(0, cut)
}
// The breadcrumb hands back the sub-path to stand at ('' = the folder the files area is on).
function goToSubPath(sub: string) {
  subPath.value = sub
}

// Review fix (Critical, round 1): this handler is attached to document (arrow keys/Esc/Enter
// must arrive no matter which child of the overlay holds focus), but that means any dialog
// stacked above it — typically the gear settings dialog (reka-ui DialogContent, Teleported to
// document.body, not a DOM descendant of .tm-overlay) — bubbles its keys here too: Esc closes
// the settings dialog AND the time machine, Enter in the note field becomes "enter snapshot",
// and arrow keys adjusting an input also step the selected snapshot behind it. Two guards
// together (either alone is insufficient):
// 1) event source (e.target) is not inside the overlay root — covers the whole "another
//    dialog stacked on top" class, since reka-ui popup content is always Teleported out and
//    is naturally not a descendant of rootEl;
// 2) event source is a native input control (INPUT/TEXTAREA) — defensive fallback, so even if
//    the overlay grows its own inputs later, arrows/Enter won't be swallowed here.
// These two checks run only when e.target is a real Element: in the sibling tests'
// `document.dispatchEvent(...)` style, target is document itself (not an Element); such
// synthetic events carry no "which element it landed on" info, so they pass straight through
// to the original logic — not in conflict with real browsers, where a keydown target is
// always a concrete element (never document).
//
// Review re-check (Critical, round 2): with the two guards attached to **keyup**, they still
// leak. Timing measured with a real reka dialog probe —
//   keydown: reka's DismissableLayer (vueuse onKeyStroke listens on keydown by default)
//            closes the settings dialog right then and returns focus to .tm-overlay
//            (FocusScope restoreFocus on unmount).
//   keyup:   when the same physical keystroke's keyup arrives, e.target has already become
//            rootEl itself (focus was returned in the previous step) — guard 1
//            (rootEl.contains(target)) and guard 2 (not INPUT) both pass for this new target,
//            so we closed the time machine too.
// Root fix: move the listener entirely from keyup to keydown. At keydown time the event
// source is still the settings dialog's own DialogContent (Teleported to body, not a rootEl
// descendant), so guard 1 correctly blocks it; reka's own keydown listener handles Escape
// after us (document receives the bubble before window), closing only its own dialog, and
// there is no second "late" keyup to drag us closed as well.
//
// Also handles a pre-existing hazard the re-check named: with focus on a bottom-bar button
// (cancel/enter), pressing Enter makes the browser fire the key's default action (clicking
// that button) as part of keydown — if the Enter branch here still ran enterSnapshot(), it
// would fire once alongside the button's own @click handler (e.g. Enter while the "cancel"
// button is focused would emit close AND select). BUTTON elements already respond to Enter
// themselves, so for BUTTON targets we simply don't handle Enter and let the native click do
// the one thing; Escape/arrows are unaffected (they don't trigger a button's native click).
function onKeydown(e: KeyboardEvent) {
  const target = e.target
  if (target instanceof Element) {
    if (!rootEl.value || !rootEl.value.contains(target)) return
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  }
  const code = e.code || e.key
  if (code === 'Escape') { emit('close'); return }
  // ↑/↓ move the highlight the way the rail runs: up the rail is a newer snapshot (smaller
  // index, the list is newest-first), down is an earlier one. This deliberately drops the
  // "real Time Machine's ↑ rewinds into the past" convention that was followed here before --
  // with the rail visible on screen and its two step buttons pointing the same way, an arrow
  // key that moved the highlight against its own direction was simply wrong (owner's call).
  if (code === 'ArrowUp') { stepSelection(-1); return }
  if (code === 'ArrowDown') { stepSelection(1); return }
  // Backspace mirrors the bottom bar's "back to parent folder"; a no-op when the deck has not
  // been drilled into anything. The INPUT/TEXTAREA guard above already keeps it from stealing
  // backspace from a text field.
  if (code === 'Backspace') { goUp(); return }
  if (code === 'Enter') {
    if (target instanceof Element && target.tagName === 'BUTTON') return // focused button: native click already does the right thing; don't trigger twice
    enterSnapshot()
  }
}

const rootEl = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  load()
  document.addEventListener('keydown', onKeydown)
  // The full-screen overlay takes over the viewport, so focus must come along — otherwise a
  // keyboard user's Tab would wander through the invisible files area underneath. Returned on
  // unmount, back to the button that opened it.
  previouslyFocused = document.activeElement as HTMLElement | null
  rootEl.value?.focus()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearSettleTimer()
  clearStepTimer()
  clearFetchTimer()
  previouslyFocused?.focus?.()
})
// Restart the settle countdown on every selection change: holding an arrow key keeps pushing it
// out, so the grid is laid out once, after the last flip, not once per snapshot passed.
watch(selectedIndex, (index) => {
  clearSettleTimer()
  settleTimer = setTimeout(() => { settleTimer = null; settledIndex.value = index }, PREVIEW_SETTLE_MS)
})
watch(() => props.volumeUuid, () => { subPath.value = ''; load() })
// The files area navigating under an open overlay would leave the drilled sub-path pointing at
// a folder of the previous directory.
watch(() => props.relPath, () => { subPath.value = '' })
</script>

<template>
  <div ref="rootEl" class="tm-overlay" role="dialog" aria-modal="true" tabindex="-1" :aria-label="t('tmEntry')">
    <button class="tm-gear" :aria-label="t('tmSettings')" @click="emit('open-settings')">⚙</button>

    <div v-if="store.listLoading" class="tm-skeleton" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="tm-skeleton-card" :style="{ transform: `translateY(${(n - 1) * -30}px) scale(${1 - (n - 1) * 0.06})` }"></div>
    </div>

    <div v-else-if="flatItems.length === 0" class="tm-empty">
      <p class="tm-empty-title">{{ t('snapNoneYet') }}</p>
      <p class="tm-empty-sub">{{ t('snapEmptyHint') }}</p>
    </div>

    <template v-else>
      <TimeMachineDeck
        :items="flatItems"
        :selected-index="selectedIndex"
        :previews="deckPreviews"
        :folder-label="props.folderLabel"
        :sub-path="subPath"
        @select="goToIndex"
        @enter="enterSnapshot"
        @open-dir="openDir"
        @navigate="goToSubPath"
      />
      <!-- Step buttons, alongside the card rather than at the two ends of the tick rail (owner's
           call: they belong to the deck they move, not to the far edge of the screen). Laid out as
           a flex sibling of the deck so they stay glued to its right edge and vertically centred
           at any window size; the negative right margin cancels their own width out of the flex
           row so the deck itself stays exactly where it was centred before.
           ∧ walks up the rail (newer), ∨ down it (earlier) -- the arrow points where the
           highlight goes. Each disables at its own end of the list. -->
      <div class="tm-deck-nav">
        <button
          type="button" class="tm-deck-step" :disabled="!canNewer"
          :aria-label="t('tmStepNewer')" :title="t('tmStepNewer')"
          @click="stepSelection(-1)"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6" /></svg>
        </button>
        <button
          type="button" class="tm-deck-step" :disabled="!canEarlier"
          :aria-label="t('tmStepEarlier')" :title="t('tmStepEarlier')"
          @click="stepSelection(1)"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <TimeMachineRail :groups="groups" :selected-index="selectedIndex" @select="goToIndex" />
    </template>

    <TimeMachineBar
      :moment-text="momentText"
      :can-enter="!!selectedItem"
      @cancel="emit('close')"
      @enter="enterSnapshot"
    />
  </div>
</template>

<style scoped>
.tm-overlay {
  /* z-index 900: above everything in the files area (repo-wide files max is 240) but
     **below** Dialog.vue's 1000/1001 — so the T11 gear settings dialog naturally stacks above
     the time machine with no z-index override needed. The Vue2 version set the wheel to 4000
     and then tried to lift the dialog to 4500, hitting the trap where `::v-deep .modal`
     compiles to a descendant selector that can't match the teleported root node (see the
     Fix Round 1 comment in Vue2 SnapshotSettingsModal.vue). Here we avoid creating that
     problem in the first place. */
  position: fixed; inset: 0; z-index: 900; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  /* With the deck grown to 3/4 screen it must center within the area left after subtracting
     the bottom bar and the rail, or it gets covered by them. Both are absolutely positioned
     and don't participate in flex layout, so padding of matching width/height stands in for
     them here (right 96 = rail width, bottom 104 = bar height). 8px at the top is headroom for
     the rear cards, which recede upward past the deck's own edge. */
  padding: 8px 96px 104px 0;
  background: var(--tm-bg); color: var(--tm-fg);
  outline: none; /* programmatic focus (tabindex="-1"); no focus ring needed — the overlay itself is not a clickable control */
}
.tm-gear {
  /* 40x40 box around a 20px glyph: as a bare glyph this was a ~20px target with no padding, in
     the same "too small to hit" class as the rail ticks. The glyph stays optically where it was
     (the box grew around it), and the rail below starts at top:56 to clear it. */
  position: absolute; top: 8px; right: 16px; z-index: 2;
  width: 40px; height: 40px; display: grid; place-items: center; padding: 0;
  border: none; border-radius: 50%; background: none; color: var(--tm-fg-muted);
  font-size: 20px; line-height: 1; cursor: pointer;
  transition: color 0.2s var(--ease), background 0.2s var(--ease);
}
/* Hover only brightens, no rotation (user feedback: a spinning gear is too jumpy). */
.tm-gear:hover { color: var(--tm-fg); background: var(--nrm-bg); }
/* Step buttons pinned to the deck's right edge. 34px is a real pointing target; the ticks on
   the far right are deliberately narrow, these are not. */
.tm-deck-nav {
  flex: 0 0 auto; display: flex; flex-direction: column; gap: 10px; z-index: 2;
  margin-left: 14px;
  /* Cancels this column out of the flex row's width so the deck stays centred exactly where it
     was before these buttons existed (34px wide + 14px gap). */
  margin-right: -48px;
}
.tm-deck-step {
  display: grid; place-items: center; width: 34px; height: 34px; padding: 0;
  border: 1px solid var(--tm-card-bd); border-radius: 50%;
  background: var(--tm-card-bg); color: var(--tm-fg); cursor: pointer;
  transition: opacity 0.15s var(--ease), border-color 0.15s var(--ease), color 0.15s var(--ease);
}
.tm-deck-step:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.tm-deck-step:disabled { opacity: 0.3; cursor: default; }
.tm-empty { text-align: center; }
.tm-empty-title { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
.tm-empty-sub { font-size: 13px; color: var(--tm-fg-muted); margin: 0; }
/* The skeleton's size must track TimeMachineDeck's .tm-deck (same set of min() calls): if
   they diverge, the moment the list finishes loading the deck "explodes" from a small square
   to 3/4 screen, like a flash. */
.tm-skeleton { position: relative; width: min(75vw, calc(100vw - 260px)); height: min(75vh, calc(100vh - 200px)); }
.tm-skeleton-card {
  position: absolute; inset: 0; border-radius: 20px;
  background: var(--tm-card-bg); border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  opacity: 0.6;
}
</style>
