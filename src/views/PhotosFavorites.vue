<script setup lang="ts">
// Task 8 (SP7-P3): favorites view -- reuses the PhotosGrid base to render favorited items
// (Task 1's usePhotosFavorites supplies data/actions), wires up zip export + empty state +
// tab filter + lightbox (P2's useLightbox singleton). The shell structure is copied from
// Photos.vue's (timeline view, src/views/Photos.vue) AreaShell/photos-layout/photos-main
// (see task-8-brief.md). Route registration is left to T10.
// Task 9 (SP7-P4 albums) adds: selection-toolbar batch "add to album" and lightbox single-item
// "add to album", following the same pickerOpen/pickerIds + openAlbumPicker(ids) pattern as
// Photos.vue, wired to AlbumPickerDialog (T5).
// Task 10 (SP7-P4 albums, closing out a P3 deferred item): "save as album" -- follows Vue2
// PhotosFavoritesView.vue :21-23 (entry button) / :455-478 (openSaveAlbum/confirmSaveAlbum).
// The naming-modal structure follows the --popup-bg/token usage of PhotosAlbums.vue's (T7)
// new-album modal, trimmed of the source-picker part this task doesn't need. Esc-close uses a
// document-level listener + watch(saveAlbumOpen) add/remove (following the established
// AlbumPickerDialog.vue:60-83 pattern), not a template @keydown.esc.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { matchesTab } from '../photos/util/tabFilter'
import { isConflict } from '../photos/util/httpErrors'
import { topPersons, topPlaces, byYear as byYearOf } from '../photos/util/peopleView'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const fav = usePhotosFavorites()
const albums = usePhotosAlbums()
// Deletion is a global operation (the asset is actually deleted), using the same store/API as
// the timeline view; the favorites store itself has no deleteAssets -- after deleting, it
// relies on fav.fetchFavorites() to explicitly refresh the favorites list so it reflects "this
// one's gone too".
const store = useTimelineStore()
const toast = useToast()
const lb = useLightbox()

// The favorites view defaults to tab='all' (unlike the timeline's default 'photo' -- favorites
// is already a small, hand-picked set, so it shouldn't pre-filter out video/OCR favorites by
// type).
const tab = ref('all')
const density = ref('comfortable')
const selected = ref<Array<string | number>>([])

const isEmpty = computed(() => fav.favoritesLoaded && (fav.favoritesList?.length ?? 0) === 0)

const filteredCount = computed(() =>
  fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value)).length,
)

// Task 15A (SP7-P5, closing out two ledger items): the hero stats' three cards -- follows Vue2
// PhotosFavoritesView.vue :369-385 (byPersonAll/byPlaceAll/byYearAll). The three pure functions
// (peopleView.ts) already each implement Vue2's sort key (count desc / count desc / year
// string desc), so this only does the slice -- Vue2's template slices byPerson/byPlace (which
// are already sliced results from the computed) again in the v-for (:62/:70); the two slice
// counts are the same, so it's a redundant double-trim. Here it's done once, and the render
// result matches Vue2. byYear isn't sliced (Vue2 :378-385's byYear computed is itself the
// untrimmed byYearAll).
const byPerson = computed(() => topPersons(fav.favoritesList ?? []).slice(0, 4))
const byPlace = computed(() => topPlaces(fav.favoritesList ?? []).slice(0, 3))
const byYear = computed(() => byYearOf(fav.favoritesList ?? []))

function toggleSelect(id: string | number) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}
function cancelSelection() { selected.value = [] }

// Task 9 (SP7-P4 albums): the "add to album" entry point (selection-toolbar batch / lightbox
// single item) -- follows the same unified pattern as Photos.vue, wired to AlbumPickerDialog
// (T5). @added clears the selection state; the favorites list itself is unaffected and doesn't
// need a refresh.
const pickerOpen = ref(false)
const pickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  pickerIds.value = ids
  pickerOpen.value = true
}
function onAlbumAdded() {
  selected.value = []
}

// Task 10 (closing out a P3 deferred item): "save as album" -- saves a snapshot of the current
// favorites as a new album.
const saveAlbumOpen = ref(false)
const saveAlbumName = ref('')
const saveAlbumInputRef = ref<HTMLInputElement | null>(null)
// Review Important 1: adds a re-entry guard (following the same pattern as the concurrent T7
// PhotosAlbums.vue's `creating` ref) -- without this guard, quickly double-clicking the
// confirm button fires a second saveAsAlbum before the first await resolves; the first
// succeeds, closes the modal, and shows a success toast, then the second (same name) gets
// rejected with a 409 right after, popping up an "album name already exists" toast outside the
// already-closed modal, with nothing to suppress this extra toast.
const saveAlbumSaving = ref(false)

function openSaveAlbum(): void {
  // Follows Vue2 openSaveAlbum:455-459 -- re-fills the default every time it's opened (not
  // fixed once in data() on first use).
  saveAlbumName.value = t('photosFavSaveAlbumDefault', { year: new Date().getFullYear() })
  saveAlbumOpen.value = true
  void nextTick(() => { saveAlbumInputRef.value?.focus() })
}
function closeSaveAlbum(): void {
  saveAlbumOpen.value = false
}
// Review fix (Important 1, Task 11 follow-up): before this task, favoritesList WAS the
// whole set, so building assetIds straight from it was correct. Now the page loads at most
// FAVORITES_PAGE_SIZE rows, so a user with more favorites than that who never pressed
// "load more" would get an album silently truncated to the first page — the exact
// silent-truncation defect Task 11 exists to remove, recreated in this modal. Page the rest
// in before saving so the count the user agreed to is the count they get. Progress is
// detected by list-length growth (a successful page always either appends rows or reaches
// exhaustion; a failed page does neither), so a stuck cursor is caught without the store
// exposing its private offset.
async function loadRemainingFavoritesForSave(): Promise<boolean> {
  while (!fav.favoritesExhausted) {
    const before = fav.favoritesList?.length ?? 0
    await fav.loadMoreFavorites()
    const after = fav.favoritesList?.length ?? 0
    if (after === before && !fav.favoritesExhausted) return false // stuck: the page failed
  }
  return true
}

async function confirmSaveAlbum(): Promise<void> {
  const name = saveAlbumName.value.trim()
  if (!name || saveAlbumSaving.value) return
  saveAlbumSaving.value = true
  try {
    if (!fav.favoritesExhausted) {
      const loadedAll = await loadRemainingFavoritesForSave()
      if (!loadedAll) {
        // Same failure copy the rest of this view already uses — do not create a
        // knowingly-partial album, and leave the modal open so the user can retry.
        toast.show(t('photosFavSaveFailed'))
        return
      }
    }
    // Follows Vue2 :467: `this.favorites.map(p => p.id)` -- favorites === favoritesList.
    const assetIds = fav.favoritesList?.map((p) => p.id) ?? []
    await albums.saveAsAlbum(name, assetIds)
    // Only the success branch closes the modal (follows Vue2 :461-478; neither failure branch
    // closes it, see catch below).
    saveAlbumOpen.value = false
    toast.show(t('photosFavSavedToast', { name, count: assetIds.length }))
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosFavSaveFailed'))
    // Modal stays open, input content is preserved -- do not clear saveAlbumName, do not close.
  } finally {
    saveAlbumSaving.value = false
  }
}

// Esc layering, document-level listener (not a template @keydown.esc) -- follows the T5
// AlbumPickerDialog.vue:60-83 established pattern: watch(saveAlbumOpen) is responsible for
// attaching/detaching the listener, onUnmounted is the fallback cleanup.
function onSaveAlbumKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  closeSaveAlbum()
}
watch(saveAlbumOpen, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', onSaveAlbumKeydown)
  else document.removeEventListener('keydown', onSaveAlbumKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onSaveAlbumKeydown))

// Once PhotosGrid has a non-empty selected, onTileClick internally switches into the "keep
// selecting" branch instead of "open photo" -- without a matching selection toolbar, ticking
// one checkbox would lock the whole grid's click behaviour into selection mode with no way
// out (Review Finding 1, filling this in to match the Photos.vue:59-66 batch-delete precedent
// -- not a new feature surface, just giving the selected/toggle-select already wired to
// PhotosGrid a UI with an exit).
async function onBatchDelete(ids: Array<string | number>) {
  const count = await store.deleteAssets(ids.map(String))
  toast.show(t('photosDeletedToast', { count }), 4000)
  selected.value = []
  await fav.fetchFavorites()
}

function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // The paging set = the tab-filtered favorites set (matches what's shown, and uses the same
  // data source/predicate as the PhotosToolbar count below).
  const filtered = fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}

// Task 9 (P8a, closing out a P3 leftover item): when fetchFavorites fails, favoritesLoaded
// stays false (see favorites.ts's comment, deliberately unchanged); under the old
// implementation isEmpty was therefore always false, falling into the v-else below and
// rendering an empty grid with no failure indication at all. Adds a loadError branch (see the
// template, prioritized ahead of isEmpty) + this retry entry point, which directly re-invokes
// the same fetch.
// Review Important 1 correction: a local retrying guard -- fetchFavorites only clears
// loadError on success (see favorites.ts's same-batch correction comment), so the button
// itself no longer gets immediate feedback from a "cleared state"; this ref adds that feedback
// (disabled), while also plugging the gap where double-clicking retry fires two concurrent
// fetches.
const retryingFavorites = ref(false)
async function retryFavorites(): Promise<void> {
  if (retryingFavorites.value) return
  retryingFavorites.value = true
  try {
    await fav.fetchFavorites()
  } finally {
    retryingFavorites.value = false
  }
}

function onExport() {
  fav.exportZip()
  toast.show(t('photosFavExporting'), 4000)
}

async function onLightboxDelete(id: string | number) {
  // The lightbox already closes itself when the user confirms deletion (PhotoLightbox.vue
  // doDelete), so no need to close it again here.
  await store.deleteAssets([String(id)])
  toast.show(t('photosDeletedToast', { count: 1 }), 4000)
  void fav.fetchFavorites()
}

onMounted(() => {
  void fav.reconcileFavIds()
  void fav.fetchFavorites()
})
</script>

<template>
  <AreaShell :title="t('photosFavTitle')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="fav-header">
          <button
            type="button"
            class="fav-export"
            :disabled="!(fav.favoritesList?.length)"
            @click="onExport"
          >{{ t('photosFavExport') }}</button>
          <button
            type="button"
            class="fav-save-album"
            data-test="fav-save-album-btn"
            :disabled="!(fav.favoritesList?.length)"
            @click="openSaveAlbum"
          >{{ t('photosFavSaveAlbum') }}</button>
          <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesTotal }) }}</span>
        </div>

        <!-- Task 9 (closing out a P3 leftover item): the failure state is prioritized ahead of
             the empty state -- once loadError is true, it must not fall into the (previously
             always-false) isEmpty branch and render an empty grid with no indication at all. -->
        <div v-if="fav.loadError" class="empty-state" data-test="fav-load-error">
          <div class="empty-state-title">{{ t('photosFavoritesLoadFailed') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="fav-retry"
            :disabled="retryingFavorites"
            @click="retryFavorites"
          >{{ t('photosRetry') }}</button>
        </div>
        <div v-else-if="isEmpty" class="empty-state" data-test="fav-empty">
          <div class="empty-state-title">{{ t('photosFavEmptyTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosFavEmptyHint') }}</div>
        </div>
        <template v-else>
          <!-- Task 11 (SP15-P3): the hero stats and facet dropdowns below are all derived from
               fav.favoritesList, which is only the pages fetched so far while pagination is
               still catching up — say so out loud instead of silently under-reporting. -->
          <div v-if="!fav.favoritesExhausted" class="fav-loaded-hint" data-test="fav-loaded-hint">
            {{ t('photosLoadedSubsetHint', { n: fav.favoritesList?.length ?? 0 }) }}
          </div>
          <!-- Task 15A: the hero stats' three cards -- follows Vue2 PhotosFavoritesView.vue:56-84,
               only rendered on the non-empty branch (Vue2's v-if/v-else at :47-53/:54 routes the
               empty state through a different branch entirely, where the three cards don't render). -->
          <div class="fav-stats">
            <div class="fav-stat-card">
              <div class="label">{{ t('photosFavStatTopPerson') }}</div>
              <div class="value">{{ byPerson[0] ? byPerson[0][0] : '—' }}</div>
              <div class="meta">{{ byPerson[0] ? t('photosPeoplePhotosCount', { n: byPerson[0][1] }) : t('photosFavNoFaces') }}</div>
              <div class="fav-stat-bar">
                <span v-for="(p, i) in byPerson" :key="p[0]" :data-hi="i === 0 || undefined"></span>
              </div>
            </div>
            <div class="fav-stat-card">
              <div class="label">{{ t('photosFavStatTopPlace') }}</div>
              <div class="value">{{ byPlace[0] ? byPlace[0][0].split(',')[0] : '—' }}</div>
              <div class="meta">{{ byPlace[0] ? t('photosPeoplePhotosCount', { n: byPlace[0][1] }) : '' }}</div>
              <div class="fav-stat-bar">
                <span v-for="(p, i) in byPlace" :key="p[0]" :data-hi="i === 0 || undefined"></span>
              </div>
            </div>
            <div class="fav-stat-card">
              <div class="label">{{ t('photosFavStatByYear') }}</div>
              <div class="value">
                {{ byYear[0] ? byYear[0][1] : 0 }}
                <span class="fav-stat-sub">{{ t('photosFavStatInYear', { year: byYear[0] ? byYear[0][0] : '—' }) }}</span>
              </div>
              <div class="meta">{{ t('photosFavStatYearsTotal', { n: byYear.length }) }}</div>
              <div class="fav-stat-bar">
                <span v-for="(y, i) in byYear" :key="y[0]" :data-hi="i === 0 || undefined"></span>
              </div>
            </div>
          </div>

          <PhotosToolbar
            :tab="tab" :density="density" :count="filteredCount"
            @update:tab="tab = $event" @update:density="density = $event"
          />
          <!-- Task 7 (D19, ported alongside Photos.vue's same move): the floating
               selectbar mounts INSIDE the grid slot (already `position: relative`, see this
               file's style block below) so its absolute top:50px anchors to the grid area, same
               as Vue2 and same as Photos.vue's timeline view. -->
          <div class="photos-grid-slot">
            <PhotosSelectionToolbar
              v-if="selected.length"
              :count="selected.length"
              @clear="cancelSelection"
              @delete="onBatchDelete([...selected])"
              @add-to-album="openAlbumPicker([...selected])"
            />
            <PhotosGrid
              :months="fav.favoritesMonths" :tab="tab" :density="density" :selected="selected"
              @open="onOpenTile"
              @toggle-select="toggleSelect"
            />
          </div>
          <!-- Task 11: the backend caps a single request at 500 rows now (NimoOS-Photos#54),
               so anything past the first page only shows up once this is clicked. -->
          <div v-if="!fav.favoritesExhausted" class="fav-load-more">
            <button
              type="button"
              class="bar-btn"
              data-test="fav-load-more"
              :disabled="fav.loadingMore"
              @click="fav.loadMoreFavorites()"
            >{{ t('photosLoadMore') }}</button>
          </div>
        </template>
      </main>
    </div>
  </AreaShell>
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />

  <div
    v-if="saveAlbumOpen"
    class="favsave-scrim"
    data-test="fav-savealbum-modal"
    @click.self="closeSaveAlbum"
  >
    <div class="favsave-modal">
      <div class="favsave-head">
        <div class="favsave-head-text">
          <div class="favsave-title">{{ t('photosFavSaveAlbumTitle') }}</div>
          <!-- Review Important 2: adds Vue2 :267-268's dynamic subtitle (structure follows the
               concurrent T7 PhotosAlbums.vue:269 .albums-modal-sub).
               Task 11 review fix: use the exact total, not the loaded-page length — the
               number shown here is what confirmSaveAlbum now actually pages in and saves. -->
          <div class="favsave-sub" data-test="fav-savealbum-sub">
            {{ t('photosFavSaveAlbumSub', { count: fav.favoritesTotal }) }}
          </div>
        </div>
        <button type="button" class="favsave-close" :aria-label="t('photosCancel')" @click="closeSaveAlbum">&#215;</button>
      </div>
      <input
        ref="saveAlbumInputRef"
        v-model="saveAlbumName"
        class="favsave-input"
        data-test="fav-savealbum-input"
        @keydown.enter.prevent="confirmSaveAlbum"
      >
      <!-- Review Important 2: adds Vue2 :279-281's static footnote (the album is a snapshot and
           doesn't stay in sync with later favorites changes). -->
      <div class="favsave-note" data-test="fav-savealbum-note">{{ t('photosFavSaveAlbumNote') }}</div>
      <div class="favsave-foot">
        <button type="button" class="favsave-btn-ghost" @click="closeSaveAlbum">{{ t('photosCancel') }}</button>
        <button
          type="button"
          class="favsave-btn-cta"
          data-test="fav-savealbum-confirm"
          :disabled="!saveAlbumName.trim() || saveAlbumSaving"
          @click="confirmSaveAlbum"
        >{{ t('photosAlbumCreate') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fix round 1 (controller-adjudicated, task-3-report.md Disclosure 1): this page still
   uses the old flex-row `.photos-layout` shell (its own re-skin task hasn't landed yet), but
   its root now carries `.photos-root` so the shared PhotosSidebar's Vue2 `.sidebar` root gets
   the parity look. Parity scss deliberately sets no width on `.sidebar` itself (real
   pixel-parity width comes from the `.app` CSS Grid column Task 3 gave Photos.vue) — pin it
   here so the sidebar doesn't collapse to its shrink-to-fit content width in this page's
   flex row. Transitional: drop this rule once this page gets its own `.app` grid re-skin. */
.sidebar { flex: 0 0 var(--sidebar-w); align-self: stretch; overflow-y: auto; }

/* height (not min-height): this screen has a hard cap, only the inner scroll container
   scrolls -- a same-source fix; see the comment at the same rule in src/views/Photos.vue for
   the rationale. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

.fav-header { display: flex; align-items: center; gap: 12px; padding: 4px 4px 8px; }
.fav-count { color: var(--fg-muted); font-size: 13px; }

/* Task 11 (SP15-P3): same small-muted-text treatment as .fav-count above (--fg-muted, 13px) —
   no new color, just a differently-positioned instance of the same token usage. */
.fav-loaded-hint { color: var(--fg-muted); font-size: 13px; margin-bottom: 10px; }
.fav-load-more { display: flex; justify-content: center; padding: 16px 0; }
.fav-load-more .bar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.fav-export {
  padding: 6px 14px; border-radius: var(--chip-radius); border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font-size: 13px; cursor: pointer;
}
.fav-export:hover:not(:disabled) { background: var(--chip-bg-hi); }
.fav-export:disabled { color: var(--fg-muted); cursor: not-allowed; opacity: 0.6; }

.fav-save-album {
  padding: 6px 14px; border-radius: var(--chip-radius); border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font-size: 13px; cursor: pointer;
}
.fav-save-album:hover:not(:disabled) { background: var(--chip-bg-hi); }
.fav-save-album:disabled { color: var(--fg-muted); cursor: not-allowed; opacity: 0.6; }

/* Task 15A: the hero stats' three cards -- follows Vue2 PhotosFavoritesView.vue:56-84's
   .fav-stats/.fav-stat-card/.label/.value/.meta/.fav-stat-bar structure, all colors go through
   theme tokens (--card-bg/--card-border/--fg/--fg-muted/--accent/--divider, confirmed defined
   in both themes). */
.fav-stats { display: flex; gap: 12px; margin-bottom: 14px; }
.fav-stat-card {
  flex: 1 1 0; min-width: 0; padding: 14px 16px; border-radius: 14px;
  background: var(--card-bg); border: 1px solid var(--card-border);
}
.fav-stat-card .label { font-size: 12px; color: var(--fg-muted); margin-bottom: 4px; }
.fav-stat-card .value { font-size: 20px; font-weight: 600; color: var(--fg); line-height: 1.2; }
.fav-stat-sub { font-size: 11px; color: var(--fg-muted); font-weight: 400; margin-left: 4px; }
.fav-stat-card .meta { font-size: 12px; color: var(--fg-muted); min-height: 15px; margin-top: 2px; }
.fav-stat-bar { display: flex; gap: 3px; margin-top: 10px; }
.fav-stat-bar span { flex: 1 1 0; height: 4px; border-radius: 2px; background: var(--divider); }
.fav-stat-bar span[data-hi='true'] { background: var(--accent); }

/* Save-as-album naming modal -- structure follows PhotosAlbums.vue's (T7) new-album modal
   (hard-won P2/P3 lesson: the background must use --popup-bg, not --card-bg -- in the dark
   theme --card-bg is near-transparent, and stacking it on a dark background lets things show
   through). */
.favsave-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 32px 20px;
}
.favsave-modal {
  width: min(400px, 100%); background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 20px 22px 18px;
}
.favsave-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.favsave-head-text { flex: 1 1 auto; min-width: 0; }
.favsave-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.favsave-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.favsave-close {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.favsave-close:hover { background: var(--chip-bg-hi); color: var(--fg); }
.favsave-input {
  width: 100%; height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13.5px;
}
.favsave-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.favsave-note { font-size: 11.5px; color: var(--fg-muted); margin-top: 10px; line-height: 1.5; }
.favsave-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.favsave-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.favsave-btn-ghost:hover { background: var(--chip-bg-hi); }
.favsave-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.favsave-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }
/* Review take-along: aligns the spacing with PhotosAlbumDetail.vue's matching failure state
   (that file's .empty-state .bar-btn already has this rule), otherwise the two failure
   screens look inconsistent. */
.empty-state .bar-btn { margin-top: 10px; }

/* <=768px: the sidebar has collapsed into a drawer (PhotosSidebar.is-drawer is taken out of
   document flow), layout becomes single-column */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
