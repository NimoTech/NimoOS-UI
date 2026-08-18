<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FileThumb from '../components/FileThumb.vue'
import { dateFmt } from '../util/format'
import { fileExt } from '../util/ext'
import type { DeckPreview } from '../composables/useDeckPreview'

export interface TimeMachineCardItem {
  time: string
  dayLabelText: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
}

const props = defineProps<{
  item: TimeMachineCardItem
  state: 'front' | 'behind' | 'past'
  depth: number
  preview?: DeckPreview | null
}>()
const { t } = useI18n()

const ready = computed(() => props.preview?.status === 'ready')
const moreCount = computed(() => {
  const p = props.preview
  return p && p.status === 'ready' ? Math.max(0, p.total - p.entries.length) : 0
})
// Only the front card (and the one just flipped past, currently flying off screen) lays out
// the file grid. The cards behind are hidden by the front one except a top strip, so rendering
// a full screen of thumbnails is pure waste — the deck window holds 5 cards, and one card of
// 36 cells means 180 <img> elements, each firing a real thumbnail request. 'past' is kept so
// the flipped card flies out with its content, instead of the content vanishing first and an
// empty shell flying away.
const showGrid = computed(() => props.state !== 'behind')
// Subtitle: same fields as the files list view (uppercase extension + modified time); folders show no extension
function subLine(entry: { is_dir?: boolean; name: string; date?: string }): string {
  const when = dateFmt(entry.date || '')
  if (entry.is_dir) return when
  const ext = fileExt(entry.name)
  return ext ? `${ext.toUpperCase()} · ${when}` : when
}
</script>

<template>
  <div
    class="tm-card"
    :class="[`is-${props.state}`, `depth-${props.depth}`, `type-${props.item.typeKind}`]"
  >
    <!-- All transforms are decided by class-driven CSS (no inline transform): when the
         selection changes the same DOM nodes only swap classes, so the browser transitions
         smoothly along the declared transitions with no JS animation loop.
         Note: this comment must live inside the root element, not before it — outside, the
         template becomes a multi-root fragment of "comment + div", the component's $el
         resolves to the comment node, and VTU's wrapper.classes() reads an empty array
         (hit in practice; fixed here). -->
    <div class="tm-card-head">
      <div class="tm-card-when">
        <span class="tm-card-day">{{ props.item.dayLabelText }}</span>
        <span class="tm-card-time">{{ props.item.time }}</span>
      </div>
      <div class="tm-card-meta">
        <span v-if="props.item.label" class="tm-card-label">{{ props.item.label }}</span>
        <span class="tm-card-badge">{{ t(props.item.typeLabelKey) }}</span>
        <span v-if="ready" class="tm-card-count">{{ t('tmItemCount', { n: props.preview!.total }) }}</span>
      </div>
    </div>

    <div class="tm-card-body">
      <div v-if="showGrid && ready && props.preview!.entries.length" class="tm-files">
        <div v-for="entry in props.preview!.entries" :key="entry.path" class="tm-file">
          <FileThumb class="tm-file-icon" :entry="entry" />
          <span class="tm-file-name">{{ entry.name }}</span>
          <span class="tm-file-sub">{{ subLine(entry) }}</span>
        </div>
        <div v-if="moreCount > 0" class="tm-file tm-file-more">+{{ moreCount }}</div>
      </div>
      <span v-else-if="showGrid && ready" class="tm-card-note">{{ t('filesEmpty') }}</span>
      <span v-else-if="showGrid && props.preview?.status === 'missing'" class="tm-card-note">{{ t('tmNoFolderAtTime') }}</span>
    </div>
  </div>
</template>

<style scoped>
.tm-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  padding: 22px 26px 26px; border-radius: 20px; cursor: pointer; overflow: hidden;
  color: var(--tm-fg); background: var(--tm-card-bg);
  border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  transform-origin: center top;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s var(--ease), filter 0.4s var(--ease);
}
/* Selected (front) */
.is-front { transform: translate3d(0, 0, 0) scale(1); z-index: 50; opacity: 1; }
/* Older snapshots recede backwards. After the card grew to 3/4 of the screen, the old
   -16/-30/-42px offsets were too small to read as depth on a card hundreds of px tall, so the
   whole set is scaled up; translateZ deepened accordingly (perspective also raised in Deck). */
.is-behind.depth-1 { transform: translate3d(0, -34px, -110px) rotateX(2deg) scale(0.94); z-index: 40; opacity: 0.86; filter: brightness(0.86); }
.is-behind.depth-2 { transform: translate3d(0, -62px, -220px) rotateX(4deg) scale(0.88); z-index: 30; opacity: 0.7; filter: brightness(0.7); }
.is-behind.depth-3 { transform: translate3d(0, -86px, -330px) rotateX(6deg) scale(0.82); z-index: 20; opacity: 0.52; filter: brightness(0.56); }
.is-behind.depth-4 { transform: translate3d(0, -106px, -440px) rotateX(8deg) scale(0.76); z-index: 10; opacity: 0.34; filter: brightness(0.44); }
/* Snapshots already flipped past (newer ones) fly toward the viewer, off the bottom of the
   screen — the reference draft's isPast branch. Offset switched to vh: the card is already
   3/4 screen tall, a fixed 300px cannot leave the viewport and would leave a half-retreated
   ghost behind the bottom bar. */
.is-past { transform: translate3d(0, 62vh, 300px) rotateX(-20deg) scale(1.3); opacity: 0; z-index: 60; pointer-events: none; }

/* ── Card header: date/time on the left, note/type/item count on the right ─────────────
   Placed at the top of the card (not centered like the small-card layout) for two reasons:
   the grid must fill the remaining space, and the cards behind only expose a top strip —
   putting the time in that strip makes the deck read as "a stack of times" for free. */
.tm-card-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding-bottom: 14px; margin-bottom: 16px;
  border-bottom: 1px solid var(--tm-card-divider);
}
/* Rear cards expose only a few dozen px at the top, and the header lands exactly in that
   strip — what shows is a 34px large time number cut in half (confirmed by screenshot),
   looking like a rendering artifact rather than "a stack of cards". Rear cards fade the whole
   header out, leaving just the card face and border; moving to the front fades it back along
   this transition. */
.is-behind .tm-card-head { opacity: 0; transition: opacity 0.3s var(--ease); }
.tm-card-when { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.tm-card-meta { display: flex; align-items: center; gap: 10px; min-width: 0; }

.tm-card-day { font-size: 13px; color: var(--tm-fg-muted); }
.tm-card-time { font-size: 34px; font-weight: 600; line-height: 1.05; }
.tm-card-label {
  font-size: 13px; color: var(--tm-fg-muted); max-width: 260px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-card-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.6px; white-space: nowrap;
  padding: 3px 9px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg);
}
.type-manual .tm-card-badge { background: var(--accent-soft); color: var(--accent-text); }
.type-preop .tm-card-badge { background: var(--dem-bg); color: var(--dem-fg); }
/* Type only tints the front card's border (same three-color system as the rail and the storage-area timeline) */
.is-front.type-manual { border-color: var(--accent-soft-bd); }
.is-front.type-preop { border-color: var(--dem-bd); }
.tm-card-count { font-size: 12px; color: var(--tm-fg-muted); white-space: nowrap; }

/* ── Card body: what this folder contained at that moment ─────────────────────────────
   Column width/gaps/icon size/font size copied from files/components/FileGridView.vue +
   FileTile.vue, so it looks like "the files area moved into the card". The only differences:
   colors use the --tm-* family (the card is a surface in deep space), and there is no
   selection box, favorite star, or context menu — the card is a preview; interaction comes
   after entering the snapshot. */
/* With many files the wheel must scroll (user feedback). Scrollbar only on the front card:
   rear cards render no grid and past cards are flying out — neither should swallow wheel
   events. min-height:0 is the prerequisite for a flex child to get a scrollbar
   (the default min-height:auto is stretched by content, so overflow never triggers). */
.tm-card-body { flex: 1 1 auto; min-height: 0; overflow: hidden; }
.is-front .tm-card-body { overflow-y: auto; scrollbar-width: thin; }
.tm-files {
  /* Columns slightly wider than the files area's 120px: the subtitle here adds the extension
     ("JPG · 7月20日 22:15"), which at 120px truncates to "JPG · 7月20…" and the time becomes
     unreadable — confirmed by screenshot. */
  display: grid; grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 14px; align-content: start;
}
.tm-file {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px; border-radius: 16px; min-width: 0;
}
.tm-file-icon { width: 64px; height: 64px; flex: 0 0 auto; }
.tm-file-name {
  font-size: 13px; text-align: center; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-file-sub {
  font-size: 11px; color: var(--tm-fg-muted); max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-file-more {
  justify-content: center; font-size: 15px; font-weight: 600;
  color: var(--tm-fg-muted); background: var(--nrm-bg); min-height: 64px;
}
.tm-card-note { display: block; padding-top: 8px; font-size: 13px; color: var(--tm-fg-muted); }
@media (prefers-reduced-motion: reduce) { .tm-card { transition: none; } }
</style>
