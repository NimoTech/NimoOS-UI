<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FileThumb from '../components/FileThumb.vue'
import TimeMachineCrumbs from './TimeMachineCrumbs.vue'
import { dateFmt } from '../util/format'
import { fileExt } from '../util/ext'
import type { FileEntry } from '../stores/files'
import type { DeckPreview } from '../composables/useDeckPreview'

// The card no longer shows its own date/time: the moment lives at the very bottom of the screen
// (owner's call -- one clock on screen, not two), and this header's left slot is where the folder
// path goes instead.
export interface TimeMachineCardItem {
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
}

const props = defineProps<{
  item: TimeMachineCardItem
  state: 'front' | 'behind' | 'past'
  depth: number
  preview?: DeckPreview | null
  /** Virtual path of the folder the time machine was opened on */
  folderLabel?: string
  /** How far the deck has been drilled below it ("" = at that folder) */
  subPath?: string
}>()
const emit = defineEmits<{ (e: 'open-dir', entry: FileEntry): void; (e: 'navigate', subPath: string): void }>()
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

// The card body is the scroll container, and it is the SAME DOM node across a content change
// (walking into a folder, or flipping to another snapshot) -- so without this the new folder
// opens already scrolled to wherever the previous one was left. Keyed on the entries array
// identity: useDeckPreview always hands over a fresh array, never mutates one in place.
const bodyEl = ref<HTMLElement | null>(null)
watch(() => props.preview?.entries, () => { if (bodyEl.value) bodyEl.value.scrollTop = 0 })
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
      <!-- The path sits on the card, in the slot the big clock used to occupy: the card IS that
           folder at that moment, so naming it here says so without a sentence. @click.stop keeps
           a crumb click from reaching the card, whose own click means "enter this snapshot". -->
      <div class="tm-card-where" @click.stop>
        <TimeMachineCrumbs
          v-if="props.folderLabel"
          :root-label="props.folderLabel"
          :sub-path="props.subPath ?? ''"
          @navigate="(sub: string) => emit('navigate', sub)"
        />
      </div>
      <div class="tm-card-meta">
        <span v-if="props.item.label" class="tm-card-label">{{ props.item.label }}</span>
        <span class="tm-card-badge">{{ t(props.item.typeLabelKey) }}</span>
        <span v-if="ready" class="tm-card-count">{{ t('tmItemCount', { n: props.preview!.total }) }}</span>
      </div>
    </div>

    <div ref="bodyEl" class="tm-card-body">
      <div v-if="showGrid && ready && props.preview!.entries.length" class="tm-files">
        <!-- Every cell is a <button>, and file cells are `disabled` (user feedback: "folders in
             the snapshot can't be opened"). Three things fall out of that one choice:
             1) clicking a folder drills the whole deck into it instead of bubbling up to the
                card, whose click means "enter this snapshot" — a folder click used to throw the
                user out of the time machine entirely, which is what "can't be opened" was;
             2) a disabled control dispatches no click at all, so a click on a *file* cell is
                swallowed rather than bubbling up and entering the snapshot by accident;
             3) the overlay's Enter handler skips BUTTON targets (the browser's own default
                action already clicks a focused button), so keyboard Enter on a focused folder
                opens that folder instead of double-firing "enter this snapshot". -->
        <button
          v-for="entry in props.preview!.entries"
          :key="entry.path"
          type="button"
          class="tm-file"
          :class="{ 'is-dir': entry.is_dir }"
          :disabled="!entry.is_dir"
          :aria-label="entry.is_dir ? t('tmOpenFolder', { name: entry.name }) : undefined"
          @click.stop="emit('open-dir', entry)"
        >
          <FileThumb class="tm-file-icon" :entry="entry" />
          <span class="tm-file-name">{{ entry.name }}</span>
          <span class="tm-file-sub">{{ subLine(entry) }}</span>
        </button>
        <div v-if="moreCount > 0" class="tm-file tm-file-more">+{{ moreCount }}</div>
      </div>
      <span v-else-if="showGrid && ready" class="tm-card-note">{{ t('filesEmpty') }}</span>
      <span v-else-if="showGrid && props.preview?.status === 'missing'" class="tm-card-note">{{ t('tmNoFolderAtTime') }}</span>
      <!-- A failed listing used to fall back to "just the card, no error" -- which was fine while
           the card still carried a big clock, but with the clock moved to the bottom of the screen
           that left a blank 540px rectangle (caught in a screenshot). One quiet line, no alarm. -->
      <span v-else-if="showGrid && props.preview?.status === 'failed'" class="tm-card-note">{{ t('tmPreviewUnavailable') }}</span>
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
  /* transform + opacity only. `filter: brightness()` used to be in this list and it is what
     made the flip feel heavy: a filtered element cannot be handed to the compositor as-is, so
     every frame of a 3/4-screen card (plus its large box-shadow) was re-rendered on the CPU.
     Depth is carried by translateZ and opacity alone now, both of which the compositor handles.
     will-change/backface-visibility keep each card on its own layer so the box-shadow is
     painted once and then merely transformed.
     Duration: 320ms. The target was a critically-damped spring feel -- fast, arriving without a
     bounce -- which for a damped oscillator with zeta 0.88 and omega0 17.7 rad/s settles in
     4/(zeta*omega0) = 0.26s and overshoots by exp(-pi*zeta/sqrt(1-zeta^2)) = 0.3%, i.e. not
     visibly at all. cubic-bezier(0.22, 1, 0.36, 1) is the ease-out that tracks it without
     needing a JS spring. The 450ms ease that was here before is the main reason the flip read as
     soft rather than as a page being turned.
     WARNING: TimeMachineOverlay's PREVIEW_SETTLE_MS must stay >= this duration. */
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, opacity;
  backface-visibility: hidden;
}
/* Selected (front) */
.is-front { transform: translate3d(0, 0, 0); z-index: 50; opacity: 1; }
/* Older snapshots recede backwards. Depth is carried by translateZ ALONE, with no scale() here.
   Perspective already shrinks a receding card -- apparent size under a perspective P is
   P/(P+|z|) -- so a scale() on top of it counts the recession twice. That is what this used to
   do (scale 0.94/0.88/0.82/0.76 over the z recession), taking the deepest card to an apparent
   0.64, which reads as "the cards are shrinking" rather than "the cards are further away".
   The z ladder below is solved from the deck's P = 2400 for a target apparent ladder of
   0.93 / 0.87 / 0.815 / 0.766, a gentle recession that still leaves the fourth card legible as
   a card.
   The y offsets are NOT proportional to the apparent scale: a 3/4-screen card is ~640px tall,
   so the ~9%-of-height step that suits a small card would be ~57px and would push the rear
   cards off the top of the window. These stay the screenshot-tuned values.
   Opacity is a flat 1 - 0.2 per step. */
.is-behind.depth-1 { transform: translate3d(0, -34px, -180px) rotateX(2deg); z-index: 40; opacity: 0.8; }
.is-behind.depth-2 { transform: translate3d(0, -62px, -360px) rotateX(4deg); z-index: 30; opacity: 0.6; }
.is-behind.depth-3 { transform: translate3d(0, -86px, -545px) rotateX(6deg); z-index: 20; opacity: 0.4; }
.is-behind.depth-4 { transform: translate3d(0, -106px, -735px) rotateX(8deg); z-index: 10; opacity: 0.2; }
/* Snapshots already flipped past (newer ones) fly toward the viewer and off the bottom of the
   screen: coming at the viewer (z), dropping away (y), tipping back (rotateX) and growing as it
   nears the eye (scale).
   WARNING: it stays FULLY OPAQUE. Owner's call, and it is what makes this read as a page turn
   at all: with a fade
   the outgoing card dissolved instead of leaving, and (the other half of the same report) going
   back toward the newest snapshot faded a card in out of nothing instead of flying the previous
   page back in. Opaque in both directions means the same travel is visible whichever way the
   deck is turned.
   Since it is no longer hidden by opacity 0, the travel has to genuinely clear the viewport:
   100vh, from a deck whose top edge sits ~80px down, with transform-origin: center top so that
   scale(1.3) does not drag the top edge back up. 62vh was enough while the card was invisible;
   it is not now. Measured in a real browser, not eyeballed. */
.is-past { transform: translate3d(0, 100vh, 300px) rotateX(-20deg) scale(1.3); opacity: 1; z-index: 60; pointer-events: none; }

/* ── Card header: date/time on the left, note/type/item count on the right ─────────────
   Placed at the top of the card (not centered like the small-card layout) for two reasons:
   the grid must fill the remaining space, and the cards behind only expose a top strip —
   putting the time in that strip makes the deck read as "a stack of times" for free. */
.tm-card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding-bottom: 14px; margin-bottom: 16px;
  border-bottom: 1px solid var(--tm-card-divider);
}
/* Rear cards expose only a few dozen px at the top, and the header lands exactly in that strip,
   so what showed through was half a line of cut-off text, looking like a rendering artifact
   rather than "a stack of cards". Rear cards fade the whole header out, leaving just the card
   face and border; moving to the front fades it back along this transition.
   pointer-events must go with the opacity: the exposed strip is still hittable, and the header
   now holds a breadcrumb -- without this there would be invisible clickable crumbs up there. */
.is-behind .tm-card-head { opacity: 0; pointer-events: none; transition: opacity 0.3s var(--ease); }
.tm-card-where { display: flex; align-items: center; min-width: 0; }
.tm-card-meta { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 0 0 auto; }
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
   selection box, favorite star, or context menu — folders can be opened to look further
   down; everything else waits until you enter the snapshot. */
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
  border: none; background: none; color: inherit; font: inherit; text-align: center;
  transition: background 0.15s var(--ease);
}
/* Folders are the only interactive cells; files stay inert (disabled), so they must not look
   dimmed or clickable just because they are <button>s. */
.tm-file:disabled { opacity: 1; cursor: default; }
.tm-file.is-dir { cursor: pointer; }
.tm-file.is-dir:hover { background: var(--nrm-bg); }
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
