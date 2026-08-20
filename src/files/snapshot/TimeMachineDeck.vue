<script setup lang="ts">
import { computed } from 'vue'
import TimeMachineCard from './TimeMachineCard.vue'
import { buildVisibleStack, DECK_WINDOW } from '../util/timeMachineMath'
import type { DeckPreview } from '../composables/useDeckPreview'
import type { FileEntry } from '../stores/files'

// Shape matches FlatSnapshotItem in the T7 overlay (TS structural typing, no mutual import
// needed); declared independently so the deck doesn't depend on the overlay and unit tests can
// build data directly.
export interface DeckItem {
  id?: number | string
  name: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
  time: string
  createdAt: string | number
  flatIndex: number
  dayLabelText: string
}
// time/dayLabelText stay on the item even though the card stopped rendering them: the overlay
// reads them for the moment shown at the bottom of the screen, and the tests identify cards by
// time.

const props = defineProps<{
  items: DeckItem[]
  selectedIndex: number
  previews?: Record<string, DeckPreview>
  folderLabel?: string
  subPath?: string
}>()
const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'enter'): void
  (e: 'open-dir', entry: FileEntry): void
  (e: 'navigate', subPath: string): void
}>()

// Render only the visible window (selected + 4 behind + 2 flipped past), not the whole list:
// a volume can retain hundreds of snapshots, and rendering them all as absolutely positioned
// cards is pure waste. Only the front card actually gets a directory preview passed in (the
// overlay lists one folder, not the whole window), and rear cards draw no grid regardless.
const visible = computed(() => buildVisibleStack(props.items, props.selectedIndex, DECK_WINDOW.depth, DECK_WINDOW.past))
// 🔴 Rendered in stable snapshot order, NOT in buildVisibleStack's front-first order. This is
// what makes the flip animate at all.
//
// buildVisibleStack returns [front, behind…, past…] by design (its callers rely on arr[0] being
// the front card). Rendering that order directly meant the card that had been at the front moved
// from child position 0 to position 5 the moment the selection changed. Vue's keyed diff
// relocates a moved node, and a re-inserted element has no before-change style -- so the browser
// had nothing to transition FROM and snapped straight to the end state. Measured in a real
// browser: the outgoing card's top went from 110px to its final 1045px within one frame, while a
// control element given the identical transform pair via an inline style interpolated normally.
// The whole card flip had never actually animated.
//
// Sorting by the snapshot's own index keeps every surviving card in the same relative order as
// the window slides (nodes only enter and leave at the two ends), so Vue never moves one, and the
// declared transition runs. Paint order is unaffected: each state sets its own z-index.
const rendered = computed(() => [...visible.value].sort((a, b) => a.index - b.index))

function onCardClick(entry: { index: number; state: string }) {
  if (entry.state === 'past') return // cards already flown off screen take no clicks (pointer-events:none has no effect in jsdom; this early return blocks it)
  if (entry.state === 'front') emit('enter') // clicking the card you are looking at = enter, same as real Time Machine
  else emit('select', entry.index)
}

// Only the front card's folders may drill in. Rear cards render no grid at all, and a 'past'
// card is mid-flight with its content still painted -- a click landing on one of its cells
// must not steer the deck into a folder of the snapshot the user just left.
function onOpenDir(entry: { state: string }, dir: FileEntry) {
  if (entry.state !== 'front') return
  emit('open-dir', dir)
}

// Same rule for the breadcrumb in the card header: only the card the user is looking at steers
// the deck. Rear cards hide their header and a 'past' card is mid-flight.
function onNavigate(entry: { state: string }, sub: string) {
  if (entry.state !== 'front') return
  emit('navigate', sub)
}
</script>

<template>
  <div class="tm-deck">
    <div class="tm-deck-inner">
      <TimeMachineCard
        v-for="entry in rendered"
        :key="entry.item.name"
        :item="entry.item"
        :state="entry.state"
        :depth="entry.depth"
        :preview="props.previews?.[entry.item.name] ?? null"
        :folder-label="props.folderLabel"
        :sub-path="props.subPath"
        @click="onCardClick(entry)"
        @open-dir="(dir) => onOpenDir(entry, dir)"
        @navigate="(sub: string) => onNavigate(entry, sub)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Card enlarged to 3/4 of the screen (user-specified). The two min() calls are
   collision-avoidance floors, not "shrinkage":
   width — the rail on the right edge takes 96px and is absolutely positioned (doesn't yield
   in flex); on narrow screens 75vw would run into it;
   height — the bottom bar is a fixed 104px; on short screens 75vh would press onto it.
   On common screens (≥1280×800) both min() calls pick the 75vw/75vh side, i.e. truly 3/4.
   perspective deepened from 1400 to 2400: with bigger cards the near-large/far-small
   distortion scales up too; at the old value the last card was visibly warped. */
.tm-deck {
  position: relative;
  width: min(75vw, calc(100vw - 260px));
  height: min(75vh, calc(100vh - 200px));
  perspective: 2400px;
}
.tm-deck-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
</style>
