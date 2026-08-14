<script setup lang="ts">
import { computed } from 'vue'
import TimeMachineCard from './TimeMachineCard.vue'
import { buildVisibleStack, DECK_WINDOW } from '../util/timeMachineMath'
import type { DeckPreview } from '../composables/useDeckPreview'

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

const props = defineProps<{ items: DeckItem[]; selectedIndex: number; previews?: Record<string, DeckPreview> }>()
const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'enter'): void }>()

// Render only the visible window (selected + 4 behind + 2 flipped past), not the whole list:
// a volume can retain hundreds of snapshots, and rendering them all as absolutely positioned
// cards is pure waste. The window size must match the one TimeMachineOverlay uses to fetch
// previews (otherwise the front card gets no thumbnails) — both read DECK_WINDOW instead of
// keeping separate literals (review fix, Important: changing the window size in one place
// would silently miss the other, with no error and no red test).
const visible = computed(() => buildVisibleStack(props.items, props.selectedIndex, DECK_WINDOW.depth, DECK_WINDOW.past))

function onCardClick(entry: { index: number; state: string }) {
  if (entry.state === 'past') return // cards already flown off screen take no clicks (pointer-events:none has no effect in jsdom; this early return blocks it)
  if (entry.state === 'front') emit('enter') // clicking the card you are looking at = enter, same as real Time Machine
  else emit('select', entry.index)
}
</script>

<template>
  <div class="tm-deck">
    <div class="tm-deck-inner">
      <TimeMachineCard
        v-for="entry in visible"
        :key="entry.item.name"
        :item="entry.item"
        :state="entry.state"
        :depth="entry.depth"
        :preview="props.previews?.[entry.item.name] ?? null"
        @click="onCardClick(entry)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Card enlarged to 3/4 of the screen (user-specified). The two min() calls are
   collision-avoidance floors, not "shrinkage":
   width — the rail on the right edge takes 96px and is absolutely positioned (doesn't yield
   in flex); on narrow screens 75vw would run into it;
   height — the bottom bar is a fixed 76px plus the path line at the top-left; on short
   screens 75vh would press onto the bottom bar.
   On common screens (≥1280×800) both min() calls pick the 75vw/75vh side, i.e. truly 3/4.
   perspective deepened from 1400 to 2400: with bigger cards the near-large/far-small
   distortion scales up too; at the old value the last card was visibly warped. */
.tm-deck {
  position: relative;
  width: min(75vw, calc(100vw - 260px));
  height: min(75vh, calc(100vh - 190px));
  perspective: 2400px;
}
.tm-deck-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
</style>
