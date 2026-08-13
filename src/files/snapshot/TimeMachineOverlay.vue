<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { groupSnapshotsByDay } from '../../storage/util/snapshotView'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { buildVisibleStack, stepSelectedIndex, DECK_WINDOW } from '../util/timeMachineMath'
import { useDeckPreview } from '../composables/useDeckPreview'
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
const selectedIndex = ref(0)

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
const momentText = computed(() => (selectedItem.value ? `${selectedItem.value.dayLabelText} ${selectedItem.value.time}` : ''))

// Fetch previews only for the cards in the deck window (cards show "what this folder looked
// like at that moment") — this uses the same buildVisibleStack as TimeMachineDeck's internal
// visible-window rendering, and the window sizes must match — both read DECK_WINDOW from
// timeMachineMath.ts instead of separate literals (review fix, Important).
const visibleNames = computed(() =>
  buildVisibleStack(flatItems.value, selectedIndex.value, DECK_WINDOW.depth, DECK_WINDOW.past).map((e) => e.item.name))
const { previews } = useDeckPreview({
  mountPoint: () => props.mountPoint,
  relPath: () => props.relPath,
  visibleNames: () => visibleNames.value,
})

async function load() {
  if (!props.volumeUuid) return
  await store.loadSnapshots(props.volumeUuid)
  // Every (re)load returns to the newest snapshot — the old index may not point to the same snapshot in the new list
  selectedIndex.value = 0
}
defineExpose({ reload: load })

function enterSnapshot() {
  if (!props.mountPoint || !selectedItem.value) return
  const root = snapshotBrowsePath(props.mountPoint, selectedItem.value.name)
  // ⚠️ Deliberate correction over Vue2 (spec §4 item 1): Vue2's enterSnapshot only jumps to
  // the snapshot root — a user opening Time Machine at /Photos/2024 got dumped back at the
  // volume root and had to click back down level by level. The card shows the current folder
  // at that moment, so entering should naturally land on the same relative path.
  // Review fix (Important, spec §2.3): when the snapshot simply doesn't contain this directory
  // (useDeckPreview's directory fetch 404s → status:'missing', and the card is already showing
  // "this folder didn't exist yet"), entering is still allowed but lands at the snapshot
  // root — otherwise we'd compose a nonexistent subpath, files.load's catch would silently
  // degrade it to an "empty folder", and the user would wrongly conclude this snapshot backed
  // up nothing.
  const missing = previews.value[selectedItem.value.name]?.status === 'missing'
  emit('select', !missing && props.relPath ? `${root}/${props.relPath}` : root)
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
  // Same as real Time Machine: ↑ goes toward the past (larger index, list is newest-first), ↓ back toward now
  if (code === 'ArrowUp') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, 1, flatItems.value.length); return }
  if (code === 'ArrowDown') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, -1, flatItems.value.length); return }
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
  previouslyFocused?.focus?.()
})
watch(() => props.volumeUuid, () => { load() })
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
        :previews="previews"
        @select="(i: number) => (selectedIndex = i)"
        @enter="enterSnapshot"
      />
      <TimeMachineRail :groups="groups" :selected-index="selectedIndex" @select="(i: number) => (selectedIndex = i)" />
    </template>

    <TimeMachineBar
      :moment-text="momentText"
      :folder-text="t('tmViewingFolder', { path: props.folderLabel })"
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
     them here (right 96 = rail width, bottom 76 = bar height). 8px left at the top as
     headroom for rear cards receding upward. */
  padding: 8px 96px 76px 0;
  background: var(--tm-bg); color: var(--tm-fg);
  outline: none; /* programmatic focus (tabindex="-1"); no focus ring needed — the overlay itself is not a clickable control */
}
.tm-gear {
  position: absolute; top: 16px; right: 24px; z-index: 2;
  border: none; background: none; color: var(--tm-fg-muted);
  font-size: 20px; line-height: 1; cursor: pointer;
  transition: color 0.2s var(--ease);
}
/* Hover only brightens, no rotation (user feedback: a spinning gear is too jumpy). */
.tm-gear:hover { color: var(--tm-fg); }
.tm-empty { text-align: center; }
.tm-empty-title { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
.tm-empty-sub { font-size: 13px; color: var(--tm-fg-muted); margin: 0; }
/* The skeleton's size must track TimeMachineDeck's .tm-deck (same set of min() calls): if
   they diverge, the moment the list finishes loading the deck "explodes" from a small square
   to 3/4 screen, like a flash. */
.tm-skeleton { position: relative; width: min(75vw, calc(100vw - 260px)); height: min(75vh, calc(100vh - 190px)); }
.tm-skeleton-card {
  position: absolute; inset: 0; border-radius: 20px;
  background: var(--tm-card-bg); border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  opacity: 0.6;
}
</style>
