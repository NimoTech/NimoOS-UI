<script setup lang="ts">
// Task 6 (SP7-P4 albums): "pick photos from library to add to this album" picker — shared by
// T7 (create album on album list page's "pick photos manually") and T8 (add photos button in album
// detail Edit state). Structure per Vue2 NimoOS-UI src/views/Photos/PhotosAlbumLibraryPicker.vue
// (142 lines).
//
// Difference from T5 AlbumPickerDialog.vue (pick albums): T5 adds a known set of assetIds to some
// target album; this component picks photos from the entire library (flattened timeline) to add to a
// known album — data source, existence check, UI structure all differ.
//
// Iron rule: "already in album" checks must String()-normalize before comparing — backend asset ids
// may be numbers, timeline Photo.id is string | number, unnormalized comparison misses matches (Vue2
// :86-89 compares Set(id) values directly, unconcerned with cross-type mismatches; here changed to
// String normalization, matching T2 store's existing iron rule).
//
// Shape deviation logged (same reason as T5, accounting): Vue2 uses window.confirm for "discard
// unsaved picks" second confirmation (:112); this repo has no window.confirm convention, changed to
// inline confirmation bar in panel (discardConfirm state), behavior semantics unchanged — with
// unsaved picks, clicking cancel shows confirmation bar first, real close only after confirming.
//
// ★★★ SP15-P1-T9 · Step 0: generalised away from albums ★★★
// It used to hardcode the album store for both halves of its job — reading which assets are
// already in (`albums.assetsOf(props.albumId)`) and writing the chosen ones back
// (`albums.addAssetsToAlbum`) — plus the success/failure toasts around that write. Moments need
// the same picker against a different collection, so both halves moved out to the caller: the
// caller passes `existingIds` and receives the picked ids on `confirm`. What is left here is the
// picking itself. Vue 2 made this exact change in #79 (ccaccd36, PhotosAlbumLibraryPicker.vue →
// PhotosLibraryPicker.vue).
//
// ✅ Debt paid in SP15-P2a (2026-08-09): this file (previously AlbumLibraryPicker.vue, plus its
// test) is renamed to PhotosLibraryPicker.vue, matching what Vue 2 already did in the same #79
// commit that generalised it. Rename only — every import, test path and the oss manifest were
// updated to follow; props, emits, template and logic are untouched, and the album pages' existing
// tests carry over unchanged as the evidence.
//
// Two shape deviations from Vue 2's #79, both to keep the two album consumers pixel-identical to
// what they render today (the whole point of a refactor step is that nothing visible moves):
//  a) `submitting` is a prop, not local state. Vue 2 kept the busy flag inside the component
//     because it could `await this.$listeners.confirm(...)` — a Vue 2 listener is a plain
//     function and returns the parent's promise. Vue 3's `emit()` discards the handler's return
//     value, so the component cannot know when the parent's write finished; the flag follows the
//     write to the caller. Same rendered result: the button reads "Adding…" and is disabled for
//     exactly as long as the request is in flight.
//  b) `submitLabel` accepts a `(count) => string` as well as a plain string. Vue 2's #79 turned
//     the album button from "Add ({n})" into a static "Add selected", silently dropping the count
//     from a screen that had it. The album pages here keep their count by passing a function;
//     moments pass a plain string, exactly Vue 2's "Add selected".
// Closing on success also moves to the caller for the same reason as (a): the component can no
// longer tell success from failure. Every caller closes on success and leaves the panel open on
// failure — which is Vue 2's observable behaviour, kept intact.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useTimelineStore } from '../stores/timeline'
import { bucketKey } from '../util/timelineBuckets'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{
  open: boolean
  title: string
  /** Ids already in the target collection, String()-normalised by the caller (see the iron rule
   *  above — the caller owns the collection, so it owns the normalisation of its own ids). */
  existingIds: Set<string>
  existingLabel: string
  submitLabel: string | ((count: number) => string)
  submitting?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', ids: Array<string | number>): void
}>()

const { t } = useI18n()
const timeline = useTimelineStore()

// Selected set directly stores the raw ids from flat (same source as flat, types naturally align,
// no normalization needed); submitted as-is to addAssetsToAlbum, no type conversion.
// [T9] The ids are now handed to the caller unconverted instead — whatever type it wants is its
// own business. Both album paths still pass them straight to addAssetsToAlbum, so not one byte
// of the request body changed.
const selected = ref<Set<string | number>>(new Set())
const discardConfirm = ref(false)
// The scrolling list itself — needed to answer "can the user scroll at all?"
// (see fillViewport below). Declared here, ahead of the open-watch that reaches it.
const bodyRef = ref<HTMLElement | null>(null)

// Per Vue2 flat computed (:73-85): flatten all months' photos, sort by takenAt descending.
// Timeline already has allPhotos flattened computed (timeline.ts:61), reuse it and sort, don't
// rewrite flatten logic.
const flat = computed<Photo[]>(() => {
  const out = timeline.allPhotos.slice()
  out.sort((a, b) => {
    const ta = a.takenAt ? Date.parse(String(a.takenAt)) : 0
    const tb = b.takenAt ? Date.parse(String(b.takenAt)) : 0
    return tb - ta
  })
  return out
})

// Iron rule: Set value comparison with String normalization — album asset ids and timeline photo
// ids may have different types.
// [T9] Only the consuming half of that normalisation is still here; the producing half (String()
// while building the Set) moved to whoever owns the target collection. Each caller's test asserts
// its own half — a numeric album asset id has to reach this component as '5'.
function isExisting(p: Photo): boolean {
  return props.existingIds.has(String(p.id))
}

// submitLabel may be a function of the selected count (both album paths: "Add (2)") or a fixed
// string (moments: "Add selected") — see deviation (b) in the file header.
const submitText = computed(() =>
  typeof props.submitLabel === 'function' ? props.submitLabel(selected.value.size) : props.submitLabel,
)
function isSelected(p: Photo): boolean {
  return selected.value.has(p.id)
}
function thumb(id: string | number): string {
  return service.photos.thumbnailUrl(id, 'small')
}

function toggle(p: Photo): void {
  if (isExisting(p)) return
  const next = new Set(selected.value)
  if (next.has(p.id)) next.delete(p.id)
  else next.add(p.id)
  selected.value = next
}

function closeNow(): void {
  emit('update:open', false)
}

// Click cancel / click overlay: with unsaved picks → show confirmation bar first; no picks → close immediately.
function attemptClose(): void {
  if (selected.value.size > 0) {
    discardConfirm.value = true
  } else {
    closeNow()
  }
}
function cancelDiscard(): void {
  discardConfirm.value = false
}
function confirmDiscard(): void {
  discardConfirm.value = false
  closeNow()
}

// Esc layering, document-level listening (not template @keydown.esc) — same pattern as T5
// AlbumPickerDialog.vue and PhotoLightbox.vue:119-139: template-bound keydown relies on real DOM
// focus; when user opens from trigger button and presses Esc without clicking inside the panel,
// the event doesn't reach elements inside. When confirmation bar expands, Esc only collapses it
// (doesn't force close the panel — discarding picks requires explicit confirmation button click,
// matching attemptClose's safety semantics).
//
// Final review mandatory 1 (unified defense): this component isn't currently mounted in lightbox
// layers, but the risk of "document bubbles up closing panel, native keydown bubbles to window" is
// identical to AlbumPickerDialog.vue — if a future host opens it stacked above a lightbox (the
// pattern will eventually appear), it would mistakenly close the lightbox too. Adding stopPropagation
// here preemptively, not waiting to step on it first.
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (discardConfirm.value) {
    cancelDiscard()
    return
  }
  attemptClose()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selected.value = new Set()
      discardConfirm.value = false
      // Task 8b (owner ruling): in bucket mode `months` arriving does not mean any photos are in
      // hand yet — this grid reads timeline.allPhotos (via `flat` above), so without this the
      // picker would open on an empty grid even though the directory says the library isn't empty.
      // Load the newest few months up front; fetchNewestBuckets is a no-op outside bucket mode, so
      // legacy behaviour is unchanged. Scrolling to the bottom (onListScroll below) pages in earlier
      // months as the user asks for them.
      //
      // fetchNewestBuckets must wait for fetchTimeline to resolve first when the latter is needed —
      // firing both in parallel would read bucketMode before the probe that sets it has had a chance
      // to run, silently no-op'ing on every fresh mount.
      const needsTimeline = timeline.months.length === 0
      void (async () => {
        if (needsTimeline) await timeline.fetchTimeline()
        await timeline.fetchNewestBuckets(3)
        // Whole-branch review fix (minor 12): paging used to happen ONLY on a `scroll` event, so a
        // library whose three newest months fit inside the panel never fired one and every earlier
        // month was unreachable — the picker looked like the library ended three months ago. If the
        // list does not overflow there is nothing for the user to scroll, so keep pulling months in
        // until it does (or until the library runs out).
        await fillViewport()
      })()
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

// Task 8b (owner ruling, second half): in bucket mode this grid only ever holds the already-loaded
// buckets. Scrolling near the bottom fetches the next unloaded dated bucket so the user can keep
// paging back through the library instead of the whole thing being pulled down at once. `loadingMore`
// caps it to one in-flight bucket load at a time — fetchBucket already dedupes per key, but without
// this guard one scroll gesture could kick off requests for a dozen different buckets before the
// first one lands.
let loadingMore = false
// Returns false when there was nothing to page in (no unloaded dated bucket left,
// or a load is already in flight), so callers can stop asking.
async function pageInNextBucket(): Promise<boolean> {
  if (loadingMore) return false
  const next = timeline.buckets.find(
    (b) => !(b.year === 0 && b.month === 0) && !timeline.bucketAssets.has(bucketKey(b)),
  )
  if (!next) return false
  loadingMore = true
  try {
    await timeline.fetchBucket(bucketKey(next))
  } finally {
    loadingMore = false
  }
  return true
}

async function onListScroll(e: Event): Promise<void> {
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) return
  await pageInNextBucket()
}

// A panel that cannot scroll gives the user no way to ask for more (minor 12).
// Capped so a run of months that add no tiles (all-video months on a photo-only
// list, an empty bucket) cannot turn into an unbounded walk back through the
// library — the user can still scroll for the rest.
const MAX_AUTO_FILL_PAGES = 10
async function fillViewport(): Promise<void> {
  for (let i = 0; i < MAX_AUTO_FILL_PAGES; i++) {
    await nextTick()
    const el = bodyRef.value
    if (!el) return
    // Not laid out (clientHeight 0 — a closed/hidden panel, and everything in
    // jsdom): whether it overflows is unknowable, so decide nothing.
    if (el.clientHeight === 0) return
    if (el.scrollHeight > el.clientHeight) return // scrollable now: the user drives
    if (!(await pageInNextBucket())) return // nothing left to page in
  }
}

// Handing over the picked ids is where this component's job ends: the write, success and failure
// toasts, and closing all belong to the caller (see the Step 0 note in the file header). Neither
// `selected` nor `open` is touched here — on a failed write the caller leaves the panel up, and the
// user's selection is still in it, ready to resubmit.
function confirmAdd(): void {
  if (selected.value.size === 0 || props.submitting) return
  emit('confirm', Array.from(selected.value))
}
</script>

<template>
  <div
    v-if="open"
    class="picker-scrim"
    data-test="lib-picker-overlay"
    @click.self="attemptClose"
  >
    <div class="picker-modal">
      <div class="picker-head">
        <div class="picker-head-text">
          <div class="picker-title">{{ title }}</div>
          <div class="picker-sub">{{ t('photosSelectedCount', { count: selected.size }) }}</div>
        </div>
        <button
          type="button"
          class="picker-close"
          data-test="lib-picker-close"
          :aria-label="t('photosCancel')"
          @click="attemptClose"
        >&#215;</button>
      </div>

      <div ref="bodyRef" class="picker-body" @scroll="onListScroll">
        <div v-if="flat.length === 0" class="picker-empty" data-test="lib-picker-empty">
          {{ t('photosAlbumPickerEmpty') }}
        </div>
        <div v-else class="picker-grid">
          <div
            v-for="p in flat"
            :key="p.id"
            class="picker-tile"
            data-test="lib-picker-tile"
            :data-asset-id="p.id"
            :data-selected="isSelected(p)"
            :data-disabled="isExisting(p)"
            @click="toggle(p)"
          >
            <img :src="thumb(p.id)" alt="">
            <div v-if="isExisting(p)" class="picker-already" data-test="lib-picker-already">
              <span class="picker-already-icon">&#10003;</span>
              <span>{{ existingLabel }}</span>
            </div>
            <div v-else-if="isSelected(p)" class="picker-tile-check" data-test="lib-picker-selected-check">&#10003;</div>
          </div>
        </div>
      </div>

      <div v-if="!discardConfirm" class="picker-foot">
        <button type="button" class="albums-btn-ghost" data-test="lib-picker-cancel" @click="attemptClose">
          {{ t('photosCancel') }}
        </button>
        <button
          type="button"
          class="albums-btn-cta"
          data-test="lib-picker-add"
          :disabled="selected.size === 0 || submitting"
          @click="confirmAdd"
        >
          {{ submitting ? t('photosAlbumPickerAdding') : submitText }}
        </button>
      </div>
      <div v-else class="picker-discard" data-test="lib-picker-discard-bar">
        <div class="picker-discard-text">{{ t('photosAlbumPickerDiscard') }}</div>
        <div class="picker-discard-actions">
          <button type="button" class="albums-btn-ghost" data-test="lib-picker-discard-cancel" @click="cancelDiscard">
            {{ t('photosCancel') }}
          </button>
          <button type="button" class="albums-btn-cta" data-test="lib-picker-discard-confirm" @click="confirmDiscard">
            {{ t('photosAlbumPickerDiscardConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Task 7 (the two-picker class-name rework): scrim/modal/head/title/sub/body/empty/grid/tile
   (+[data-selected]/[data-disabled]/the nested img)/tile-check/foot are character-for-character
   the same names as the already-imported global parity stylesheet
   (src/photos/styles/vue2-parity/photos.scss:4277-4341, `.picker-*`, bare top-level selectors
   with no `.photos-root` prefix — these are Vue2-native class names, and
   class-collision-guard.test.ts pins them to zero cross-area collisions) — every local duplicate
   is deleted and parity takes over directly. The two footer buttons likewise reuse parity's
   existing `.albums-btn-ghost`/`.albums-btn-cta` (Vue2's own source, PhotosLibraryPicker.vue
   :40/:42, uses exactly those two classes, and PhotosAlbums.vue's New Album dialog set the same
   reuse precedent), instead of each maintaining an equivalent ghost/cta button style. */

/* Header text container — Vue2 uses an unclassed div with inline style="flex:1;min-width:0"
   (:6), so parity naturally has no matching selector; the class name here exists purely for
   readability and the rule itself is unchanged. */
.picker-head-text { flex: 1 1 auto; min-width: 0; }

/* Header X close button — Vue2 uses the site-wide .icon-btn plus the photos-icon component
   (:10-12); this repo's dialogs consistently use a smaller 24px dedicated close-button class
   instead of reusing .icon-btn (the same idiom as AlbumPickerDialog.vue's
   `.album-picker-close`, MergeReviewDialog.vue's `.mrd-close` and ClusterActionDialog.vue's
   `.cad-close`), and parity has no selector to compare against. */
.picker-close {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.picker-close:hover { background: var(--surface-3); color: var(--text-1); }

/* The <img> inside a tile no longer carries a class of its own — parity's .picker-tile has a
   nested `img { … }` (SCSS compiles it to `.picker-tile img`) that already applies to any img
   child, matching Vue2's own bare <img> (:28, likewise unclassed). The "already in this album"
   dimming is handed to parity's .picker-tile[data-disabled="true"] { opacity: .4;
   pointer-events: none } as well (it applies to the whole tile, including the badge overlay
   below), instead of locally dimming only the img — which matches what Vue2 actually renders (the
   whole tile dims together) and removes the img-only is-dimmed local rule. */

/* The "already in this album" marker — both Vue2 (:29-31) and parity (.picker-tile-existing)
   render only an 18px circular badge in the top-right corner, with the explanatory text
   coming from a native title attribute on hover. This component deliberately extends that:
   the existingLabel copy stays visible at all times (not hover-only) and covers the whole
   tile — behaviour an existing test locks down (PhotosLibraryPicker.test.ts asserts
   tile.text() contains the existingLabel string), so it must not be narrowed back to
   parity's icon-only badge. That is why parity's `.picker-tile-existing` name is not reused
   (different semantics and size, and sharing the name would fight parity's rule); the
   non-clashing `.picker-already` family keeps the original visuals instead. */
/* Fix-2 item 6 (owner acceptance, 2026-08-13): `color` used to be `var(--text-1)` -- a
   *parity*-scoped token that correctly flips dark under `.photos-root.is-light`, sitting on
   `--overlay-bg`, a *global* token that stays a dark tint in both of New-UI's own themes
   (theme.css:274/408, both a translucent dark fill, deliberately invariant since a
   tile-covering scrim needs to read against unpredictable photo pixels underneath, not the
   app's own theme). In photos light mode the pairing was dark-on-dark: the background stayed
   dark (correctly) but the text went dark too (incorrectly, chasing the private is-light flip
   the background doesn't follow). Pinned to a literal light value instead, matching this
   repo's own established convention for exactly this shape (thumbnail-overlay text needs
   constant contrast regardless of theme -- the same call PhotosTrash.vue's
   `.tile-fav`/`.tile-vid` badges and PhotosSmartViewDetail.vue's `.sv-toast` already make,
   each with their own theme-exception comment). */
.picker-already {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: var(--overlay-bg);
  color: #fff; /* theme-exception: overlays unpredictable photo pixels, same as --overlay-bg above */
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  padding: 0 4px;
}
.picker-already-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  /* Vue2's checkmark is color="white" — changed to --on-accent (the semantic token for a
     readable foreground atop a solid accent fill) rather than hardcoding a colour literal. */
  color: var(--on-accent);
  font-size: 11px;
  line-height: 1;
}

/* .picker-tile-check (the top-right check badge in the selected state) has the same name and the
   same meaning as parity's .picker-tile-check (Vue2 :32-34 uses that very class) — the local
   override is deleted; position, size and background colour all come from parity. */

.picker-discard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--line);
  flex: 0 0 auto;
}
.picker-discard-text { font-size: 12.5px; color: var(--text-1); flex: 1 1 auto; min-width: 0; }
.picker-discard-actions { display: flex; gap: 8px; flex: 0 0 auto; }
</style>
