<script setup lang="ts">
// "Add to Album" picker -- reused by three hosts (timeline batch toolbar / favorites view /
// lightbox top bar). Structure follows the old Vue2 panel's
// src/views/Photos/PhotosTimeline.vue:1040-1065 album selection overlay (scrim + panel + list +
// "+ New Album" row); behavior follows :582-607 (onBatchAlbum/pickAlbum/createAndPickAlbum).
//
// Deliberate, scoped-down deviation from Vue2: Vue2 used window.prompt to collect the new
// album name; this repo has no window.prompt convention and it's a poor experience on narrow
// screens, so this uses an inline input row in the panel instead (Enter to submit / Esc to
// collapse), with the same behavioral semantics.
//
// Key semantic difference from Vue2 (intentional, not an oversight): the failure path does not
// close the panel -- Vue2's createAndPickAlbum only swallows the exception with console.error,
// while this component instead shows a toast with the failure text and keeps the panel open
// (including the new-album input row's content), so the user can see why it failed and retry
// instead of getting silent unresponsiveness.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosAlbums } from '../stores/albums'
import { albumToView } from '../util/albumView'
import { isConflict } from '../util/httpErrors'
import { useToast } from '../../stores/toast'

const props = defineProps<{ open: boolean; assetIds: Array<string | number> }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'added', albumId: string | number, count: number): void
}>()

const { t } = useI18n()
const albums = usePhotosAlbums()
const toast = useToast()

const creating = ref(false)
const newName = ref('')
const newInputRef = ref<HTMLInputElement | null>(null)

// Re-entrance guards. `creating` is only a display flag for "is the input row expanded", not an
// in-flight guard -- two independent async entry points each need their own: `adding` blocks
// pick() (clicking the same album item repeatedly would repeat addAssetsToAlbum), `submitting`
// blocks submitCreate() (repeatedly pressing Enter would repeat createAlbum). Deliberately not
// sharing the same ref -- submitCreate calls pick() internally after success, and if the two
// shared one flag, pick()'s guard would also block that internal call once submitCreate had set
// it (createAlbum would succeed but the immediately following addAssetsToAlbum would be
// skipped, breaking the existing "create then add" flow via its own re-entrance guard). The
// same class of bug has shown up elsewhere too (PhotosAlbums.vue's `creating`,
// PhotosFavorites.vue's `saveAlbumSaving`, both already guarded this way) -- this component is
// simply the last of the four "create new" entry points to get the fix.
const adding = ref(false)
const submitting = ref(false)

// Always normalize id comparisons via String(); never compare object references with ===.
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

const views = computed(() => albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))))
// When assetIds is empty, not only should existing album items be disabled, the "+ New Album"
// entry point must be disabled too -- otherwise createAlbum (which has a persistent side
// effect) would run and actually create an album, but the immediately following pick() would
// get short-circuited by this same canSubmit, leaving the user staring at the still-open input
// row with no feedback.
const canSubmit = computed(() => props.assetIds.length > 0)

function thumb(cover: string | number): string {
  return service.photos.thumbnailUrl(cover, 'small')
}

function close(): void {
  emit('update:open', false)
}

// Esc handling is layered via a document-level listener (not the template's @keydown.esc) -- a
// functional bug: a template-bound keydown depends on real DOM focus landing on the
// overlay/input, but when the user opens the panel from a trigger button outside the panel and
// presses Esc without ever clicking inside it, focus is still on the trigger button, so the
// event never reaches the overlay and the panel can't be closed; after the first Esc collapses
// the input row, the input gets unmounted by v-else and focus falls back to body, so a second
// Esc breaks the same way. Switched to the document-level listening pattern already used by
// PhotosSidebar.vue:22-27 / PhotoLightbox.vue:119-140, attached/detached by watch(open), with
// onUnmounted as a cleanup fallback.
//
// This component is often opened by the lightbox's top-bar "Add to Album" button, and the
// lightbox itself has its own keydown listener on window (PhotoLightbox.vue:144). Native
// keydown bubbles by default (bubbles: true), and the bubble order is document before window --
// without stopPropagation, closing this panel would let the same Esc keypress go on to bubble
// to window and close the lightbox too (the lightbox is explicitly designed not to close itself
// here, per PhotoLightbox.vue:51-52's own comment). Stopping it at the document phase prevents
// it from bubbling on to window.
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (creating.value) cancelCreate()
  else close()
}

// Follows Vue2's onBatchAlbum:584 -- refresh the album list before opening; Vue2 doesn't await
// it so it doesn't block rendering, and this does the same. immediate: true -- a host may keep
// this component permanently mounted and only toggle the open prop, or it may mount it only
// once open is already true; either way the list needs refreshing at the moment it becomes
// visible, not just on the one false→true transition.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void albums.fetchAlbums()
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      creating.value = false
      newName.value = ''
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

async function pick(albumId: string | number): Promise<void> {
  if (!canSubmit.value || adding.value) return
  adding.value = true
  const view = views.value.find((v) => sameId(v.id, albumId))
  const name = view?.title ?? t('photosAlbumUntitled')
  const count = props.assetIds.length
  try {
    await albums.addAssetsToAlbum(albumId, props.assetIds)
    emit('added', albumId, count)
    toast.show(t('photosAlbumAddedToast', { count, name }))
    close()
  } catch {
    toast.show(t('photosAlbumAddFailed'))
    // Keep the panel open -- do not call close().
  } finally {
    adding.value = false
  }
}

function startCreate(): void {
  creating.value = true
  newName.value = ''
  void nextTick(() => newInputRef.value?.focus())
}

function cancelCreate(): void {
  creating.value = false
}

async function submitCreate(): Promise<void> {
  const name = newName.value.trim()
  if (!name || submitting.value) return
  submitting.value = true
  try {
    const created = await albums.createAlbum(name)
    await pick(created.id as string | number)
    // A successful pick() closes the panel itself; if pick() fails internally
    // (addAssetsToAlbum throws), pick() has already shown the failure toast and kept the panel
    // open -- no need to handle that again here, since the create itself succeeded. pick() uses
    // its own independent `adding` guard, unaffected by `submitting` already being set here, so
    // both real network calls still happen as normal.
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
    // Keep the panel open, and keep the input row's content (don't clear newName).
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="album-picker-overlay"
    data-test="album-picker-overlay"
    @click.self="close"
  >
    <div class="album-picker-panel">
      <div class="album-picker-head">
        <span class="album-picker-title-text">{{ t('photosAddToAlbumTitle') }}</span>
        <button type="button" class="album-picker-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <div class="album-picker-body">
        <div v-if="views.length === 0" class="album-picker-empty" data-test="album-picker-empty">
          {{ t('photosAddToAlbumEmpty') }}
        </div>

        <button
          v-for="v in views"
          :key="v.id"
          type="button"
          class="album-picker-item"
          data-test="album-picker-item"
          :disabled="!canSubmit"
          @click="pick(v.id)"
        >
          <span v-if="v.cover" class="album-picker-cover">
            <img :src="thumb(v.cover)" alt="">
          </span>
          <span v-else class="album-picker-cover album-picker-cover-empty" data-test="album-picker-cover-empty"></span>
          <span class="album-picker-info">
            <span class="album-picker-item-title">{{ v.title }}</span>
            <span class="album-picker-item-count">{{ t('photosItemsCount', { count: v.count }) }}</span>
          </span>
        </button>

        <button
          v-if="!creating"
          type="button"
          class="album-picker-item album-picker-new"
          data-test="album-picker-new"
          :disabled="!canSubmit"
          @click="startCreate"
        >
          {{ t('photosAddToAlbumNew') }}
        </button>
        <div v-else class="album-picker-new-row">
          <input
            ref="newInputRef"
            v-model="newName"
            type="text"
            class="album-picker-new-input"
            data-test="album-picker-new-input"
            @keydown.enter="submitCreate"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* overlay/panel/head/body/item(+:hover)/new/empty are named byte-for-byte the same as the
   already-imported global parity stylesheet
   (src/photos/styles/vue2-parity/photos.scss:1043-1074 `.photos-root .album-picker-*`) --
   those rules were removed entirely here and left for parity to own, rather than being
   redeclared locally (otherwise both places setting the same property, once scoped specificity
   is tied, would come down to load order and produce an invisible pixel drift -- a mistake
   already hit once while cleaning up the albums dialogs). Only selectors parity doesn't cover
   at all are kept below, each with its own comment explaining why. */

/* Note: parity's own `.photos-root .album-picker-panel`
   (vue2-parity/photos.scss:1160-1161, `width: 280px; max-height: 360px;`) is byte-transcribed
   from Vue2's real dialog -- a plain `window.prompt`-era text list, no cover thumbnails. This
   box turned out too small now that this component renders real 40px cover thumbnails + a
   title/count two-line layout (this component's own, documented structural addition over
   Vue2, see the next comment below). This is a deliberate DEVIATION from parity's pixel value
   here -- not a transcription bug -- enlarging the panel and making it viewport-responsive.

   Sizing formula: `width: min(520px, 90vw)` reads comfortably on a wide monitor (capped at 520px
   so the album list doesn't stretch into an awkwardly wide single column) while still fitting a
   narrow window with a 5vw margin on each side; `max-height: min(640px, 80vh)` leaves headroom
   above/below the dialog on both a tall desktop viewport and a short one -- `.album-picker-body`'s
   existing `overflow-y: auto; flex: 1` (parity, untouched below) keeps a long album list
   scrolling internally rather than growing the dialog past this cap.

   Specificity note: this selector is a plain, single-class `.album-picker-panel`, which under
   `<style scoped>` compiles to `.album-picker-panel[data-v-xxxx]` -- 0-2-0, the SAME specificity
   as parity's two-class `.photos-root .album-picker-panel`. Per this whole file's own established
   convention (this component's scoped `<style>` registers AFTER the parity stylesheet in every
   host page's import order, see this file's other retirement comments), a genuine specificity tie
   is won by whichever rule loads later -- so this local override reliably wins over parity's
   small value instead of losing to it. */
.album-picker-panel {
  width: min(520px, 90vw);
  max-height: min(640px, 80vh);
}

/* Structural addition (not covered by parity): this component's album items carry a cover
   thumbnail plus a title/count two-column layout, and use a native <button> for clickable
   semantics (Vue2's version is a plain text <div>, building albums via window.prompt with no
   cover/count sub-structure) -- only the flex layout and button appearance reset, two things
   parity doesn't touch at all, are kept here; padding/font-size/color/cursor/transition are
   still provided by parity's .album-picker-item and not redeclared. */
.album-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
}
/* disabled state has no counterpart rule in parity (Vue2 has no such state) -- this is a
   New-UI addition guarding against an empty assetIds state. */
.album-picker-item:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

/* Header close button: Vue2 uses the site-wide generic .icon-btn (photos.scss:229-237, a 32px
   circle + photos-icon component); this repo's dialogs (MergeReviewDialog.vue's `.mrd-close`,
   ClusterActionDialog.vue's `.cad-close`, PhotosAlbums.vue's New Album dialog's
   `.albums-modal-close`) consistently use a smaller, dedicated 24px close-button class instead
   of reusing .icon-btn -- this continues that existing local pattern, and parity has no
   corresponding selector to compare against. */
.album-picker-close {
  width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--text-2); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.album-picker-close:hover { background: var(--surface-3); color: var(--text-1); }

/* Title text (the `.album-picker-title-text` span in the template):
   font-size/font-weight still has no local rule -- parity's .album-picker-head is already a
   flex container with font-size:13px;font-weight:600 (space-between naturally separates the
   title from the close button on either end), so adding a local override here would silently
   turn 13px into 14.5px and create a pixel drift.

   This corrects an earlier assumption about `color` -- the reasoning that "removing the local
   rule and falling back to the inherited ambient color matches Vue2's behavior" turns out to be
   wrong: this component mounts as a **sibling** of `.app` (`.photos-root > .app` and
   `.photos-root > AlbumPickerDialog` are siblings, see PhotosSearch.vue and other host page
   templates), not inside the `.app` subtree -- and `.photos-root .app` is the only ancestor in
   this repo that explicitly sets `color: var(--text-1)` (Photos-private, flips with is-light)
   (photos.scss:104-116). Mounted outside `.app`, this dialog's inheritance chain skips right
   past it and lands on the global `body { color: var(--fg) }` in src/styles/theme.css --
   that's a **global** token that only follows the site-wide `[data-theme]`, not the
   Photos-private `.photos-root.is-light` toggle. In the common combination of "Photos set to
   light while the rest of the site is dark", `--fg` sits at its dark-default pure-white value,
   so the title ends up as white text on a light panel -- invisible. This is the same root cause
   as an earlier fix in the Places tab and the lightbox, showing up here as its third
   occurrence in the album dialogs. A local `color` rule is added, pinned to the Photos-private
   `--text-1` (matching parity's .album-picker-item title color, visually consistent with list
   row titles), so it no longer relies on inheritance. The class name is kept as a structural
   marker. */
.album-picker-title-text { color: var(--text-1); }

/* Cover thumbnail / empty placeholder -- Vue2's window.prompt flow has no cover display at
   all; this is a feature this component adds on its own (a deliberate, documented deviation),
   with no corresponding selector in parity. */
.album-picker-cover {
  flex: 0 0 auto; width: 40px; height: 40px; border-radius: 8px; overflow: hidden;
  border: 1px solid var(--line); background: var(--surface-2);
}
.album-picker-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.album-picker-cover-empty { background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); }

/* Title + count two-column info area -- same as above, parity's plain-text item has no such
   sub-structure. */
.album-picker-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.album-picker-item-title { font-size: 13px; font-weight: 500; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.album-picker-item-count { font-size: 11px; color: var(--text-2); }

/* .album-picker-new's color is now owned by parity (`color: var(--accent-hi)`); the previous
   font-size/font-weight override was removed along with it -- Vue2's "+ New Album" row already
   shares the same font weight as a regular album item, it isn't bold emphasis, so removing the
   override matches Vue2. */

/* Inline new-album input row -- a deliberate deviation from Vue2 (Vue2 uses window.prompt,
   this repo uses an inline input row in the panel instead), so parity naturally has no
   corresponding selector. */
.album-picker-new-row { padding: 8px; }
.album-picker-new-input {
  width: 100%; height: 34px; padding: 0 10px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--surface-2); color: var(--text-1);
  font: inherit; font-size: 13px;
}
.album-picker-new-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
