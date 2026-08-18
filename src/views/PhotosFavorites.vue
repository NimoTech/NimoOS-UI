<script setup lang="ts">
// Task 8 (SP7-P3): favorites view -- reuses the PhotosGrid base to render favorited items
// (Task 1's usePhotosFavorites supplies data/actions), wires up zip export + empty state +
// tab filter + lightbox (P2's useLightbox singleton). The shell was originally copied from
// Photos.vue's (timeline view, src/views/Photos.vue) AreaShell/photos-layout/photos-main
// (see task-8-brief.md). Route registration is left to T10.
//
// Plan H Task 1 (re-shell): the transitional AreaShell/.photos-layout shell has been swapped
// for Photos.vue/PhotosPeople.vue's own `.photos-root > .app[data-collapsed][data-selecting] >
// PhotosSidebar + main.main > PhotosTopbar + .photos-main` structure (useSidebarCollapse shared
// singleton). AlbumPickerDialog and the save-as-album modal moved from template-root siblings
// of the old AreaShell wrapper to inside `.photos-root` (siblings of `.app`), alongside the
// Plan G AskNimoHost mount. Full detail in task-1-report.md.
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
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotosIcon from '../photos/components/PhotosIcon.vue'
import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useAskNimo } from '../photos/composables/useAskNimo'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { isConflict } from '../photos/util/httpErrors'
import { topPersons, topPlaces, byYear as byYearOf } from '../photos/util/peopleView'
import { groupFavoritesByMonthOrdered } from '../photos/util/groupPhotosByMonth'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
// Task 1 (Plan H re-shell): shared module-singleton collapse state, same composable
// Photos.vue/PhotosPeople.vue's own re-shell tasks already use.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const fav = usePhotosFavorites()
const albums = usePhotosAlbums()
// Deletion is a global operation (the asset is actually deleted), using the same store/API as
// the timeline view; the favorites store itself has no deleteAssets -- after deleting, it
// relies on fav.fetchFavorites() to explicitly refresh the favorites list so it reflects "this
// one's gone too".
const store = useTimelineStore()
const toast = useToast()
const lb = useLightbox()

// Fixed at 'comfortable' -- Vue2 Favorites has no density switcher at all (its own bespoke
// `.lib-grid` markup, not the shared timeline PhotosGrid.vue this view reuses), so there is
// nothing here for a user control to drive; PhotosGrid still needs SOME density value to size
// its fixed column-count lookup, hence the ref stays, just without a UI to change it.
const density = ref('comfortable')
const selected = ref<Array<string | number>>([])

const isEmpty = computed(() => fav.favoritesLoaded && (fav.favoritesList?.length ?? 0) === 0)

// Acceptance Fix-1 (owner finding, Plans G+H): the filter row is All + THREE mutually-exclusive
// dropdowns (People / Places / Years), plus a Sort Recent/Oldest toggle -- follows Vue2
// PhotosFavoritesView.vue's `filter` data() (:329, single string: 'all' | 'p:<name>' |
// 'l:<place>' | 'y:<year>') + `sort` data() (:328). Task 6 had modeled this as an independent
// `placeFilter` ref, which was correct in isolation but doesn't generalize: Vue2's `filter` is
// ONE string across all three facets (selecting a place is mutually exclusive with a person or
// year selection, not an AND of three), so adding People/Years as their own separate refs would
// let a user "stack" e.g. person=Alice AND place=Paris, which Vue2's UI cannot even express.
// Replaced with the same single-string model Vue2 uses.
const filter = ref('all')
const sort = ref<'recent' | 'oldest'>('recent')
const openFilter = ref<'people' | 'places' | 'years' | null>(null)

// byPersonAll/byPlaceAll/byYearAll -- Vue2 :407-424. topPersons/topPlaces/byYearOf
// (peopleView.ts) already implement these exact sort keys (count desc / count desc / year
// string desc) for the hero stat cards (Task 15A) -- reused here unsliced, matching Vue2's own
// byPerson()/byPlace()/byYear() computeds, which slice/pass-through these same "All" arrays
// rather than recomputing independently (:426-428).
const byPersonAll = computed(() => topPersons(fav.favoritesList ?? []))
const byPlaceAll = computed(() => topPlaces(fav.favoritesList ?? []))
// Vue2 byYear() (:428) is simply `return this.byYearAll` -- unsliced, no separate variable
// needed; the hero stat card and the Years dropdown read the very same computed.
const byYear = computed(() => byYearOf(fav.favoritesList ?? []))
const byPerson = computed(() => byPersonAll.value.slice(0, 4))
const byPlace = computed(() => byPlaceAll.value.slice(0, 3))

// Vue2 :436-438's activePersonLabel/activePlaceLabel/activeYearLabel.
const activePersonLabel = computed(() => (filter.value.startsWith('p:') ? filter.value.slice(2) : ''))
const activePlaceLabel = computed(() => (filter.value.startsWith('l:') ? filter.value.slice(2).split(',')[0] ?? '' : ''))
const activeYearLabel = computed(() => (filter.value.startsWith('y:') ? filter.value.slice(2) : ''))

// Vue2 :353-360's filtered computed -- a single active facet, never a combination of two.
const filtered = computed(() => {
  const base = fav.favoritesList ?? []
  const f = filter.value
  if (f === 'all') return base
  if (f.startsWith('p:')) {
    const n = f.slice(2)
    return base.filter((p) => (p.faces ?? []).map(String).includes(n))
  }
  if (f.startsWith('l:')) {
    const v = f.slice(2)
    return base.filter((p) => (p.place ?? '') === v)
  }
  if (f.startsWith('y:')) {
    const v = f.slice(2)
    return base.filter((p) => String(p.takenAt ?? '').startsWith(v))
  }
  return base
})

// Vue2 :361-374's sorted computed -- items with no takenAt (unknown date) all sink to the
// end, exempt from normal time-based sorting, regardless of sort direction.
const sortedFiltered = computed(() => {
  const arr = [...filtered.value]
  arr.sort((a, b) => {
    const ta = a.takenAt != null ? String(a.takenAt) : ''
    const tb = b.takenAt != null ? String(b.takenAt) : ''
    if (!ta && !tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return sort.value === 'recent' ? tb.localeCompare(ta) : ta.localeCompare(tb)
  })
  return arr
})

// Vue2 :375-390's grouped computed -- groupFavoritesByMonthOrdered groups AFTER sorting and
// preserves `sortedFiltered`'s own order (see that function's own header comment), so toggling
// Sort re-orders the month groups themselves, not just each month's internal tile order.
const filteredMonths = computed(() => groupFavoritesByMonthOrdered(sortedFiltered.value))

function toggleOpenFilter(name: 'people' | 'places' | 'years'): void {
  openFilter.value = openFilter.value === name ? null : name
}
function selectPerson(name: string): void {
  filter.value = 'p:' + name
  openFilter.value = null
}
function selectPlace(place: string): void {
  filter.value = 'l:' + place
  openFilter.value = null
}
function selectYear(year: string): void {
  filter.value = 'y:' + year
  openFilter.value = null
}
// Vue2's "All" chip and each dropdown's own "Clear filter" item all do the same
// `filter = 'all'; openFilter = null` (:115/:134/:160/:186) -- unified into one function.
function clearFilter(): void {
  filter.value = 'all'
  openFilter.value = null
}

const filterBarRef = ref<HTMLElement | null>(null)
function onFilterDocumentClick(e: MouseEvent): void {
  if (openFilter.value && filterBarRef.value && !filterBarRef.value.contains(e.target as Node)) {
    openFilter.value = null
  }
}
onMounted(() => document.addEventListener('mousedown', onFilterDocumentClick))

// Task 15A (SP7-P5, closing out two ledger items): the hero stats' three cards -- follows Vue2
// PhotosFavoritesView.vue :369-385 (byPersonAll/byPlaceAll/byYearAll). Acceptance Fix-1 moved
// byPerson/byPlace/byYear up next to byPersonAll/byPlaceAll/byYearAll above (the People/Places/
// Years dropdowns' option sources) since Vue2 :426-428 defines them as slices/pass-throughs of
// those same "All" computeds, not independent re-derivations -- kept as one source of truth.

// Task 3 (Plan H): hero sub-line -- photoCount/videoCount have no server-side per-type
// aggregate (only favoritesTotal, from favIds.size, is exact), so these stay derived from
// the loaded page. In the common case (<=500 favorites) favoritesList IS the full set, so
// photoCount+videoCount naturally equals favoritesTotal -- no visible inconsistency. Past
// that page size the existing fav-loaded-hint discloses the partial-load state. The hero
// itself only renders in the v-else (loaded, non-empty) branch below (F-10), so it never
// competes with the topbar's exact total on the error/empty branches either.
const heroPhotoCount = computed(() => (fav.favoritesList ?? []).filter((p) => !p.isVideo).length)
const heroVideoCount = computed(() => (fav.favoritesList ?? []).filter((p) => p.isVideo).length)
// Review fix: derive from the existing `byYear` computed (Vue2's own formula chain, string
// year-prefix via `String(takenAt).slice(0,4)` -- see peopleView.ts's byYear) instead of
// re-parsing takenAt with `new Date(...).getFullYear()`. Date.getFullYear() reads the
// *local* timezone, so an asset near a year boundary (e.g. 2025-12-31T23:00 UTC in UTC+2)
// could disagree with the By-year stat card below, which is built from this same `byYear`
// computed -- re-deriving independently risked exactly that divergence for the same asset.
// byYear is sorted year-string descending (Vue2 :423's `b[0].localeCompare(a[0])`), so
// byYear[0] is the newest year and the last entry is the oldest -- matches Vue2 :429-433's
// `yearSpan` (`${ys[ys.length-1]}–${ys[0]}` over the same descending-sorted array).
const heroYearSpan = computed(() => {
  const ys = byYear.value
  if (!ys.length) return ''
  if (ys.length === 1) return ys[0][0]
  return `${ys[ys.length - 1][0]}–${ys[0][0]}`
})

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
onUnmounted(() => {
  document.removeEventListener('keydown', onSaveAlbumKeydown)
  stopSlideTimer()
  document.removeEventListener('keydown', onSlideKey)
  document.removeEventListener('mousedown', onFilterDocumentClick)
})

// Once PhotosGrid has a non-empty selected, onTileClick internally switches into the "keep
// selecting" branch instead of "open photo" -- without a matching selection toolbar, ticking
// one checkbox would lock the whole grid's click behaviour into selection mode with no way
// out (Review Finding 1, filling this in to match the Photos.vue:59-66 batch-delete precedent
// -- not a new feature surface, just giving the selected/toggle-select already wired to
// PhotosGrid a UI with an exit).
// Owner-acceptance Fix-3 (delete-chain diagnosis): store.deleteAssets already reports the
// ACTUAL success count (per-id try/catch in timeline.ts), but this toast used to quote it
// unconditionally as if `count === total` always held -- with 0 actually deleted it would
// have shown "0 item(s) moved to Recently Deleted" as a plain success toast, the exact
// swallow-and-lie shape the diagnosis flagged for the sibling Trash view. Same three-way
// branch as PhotosTrash.vue's deleteSelected()/onLightboxDelete: full / partial / zero.
async function onBatchDelete(ids: Array<string | number>) {
  const total = ids.length
  const count = await store.deleteAssets(ids.map(String))
  if (count === total) {
    toast.show(t('photosDeletedToast', { count }), 4000)
  } else if (count > 0) {
    toast.show(t('photosDeletedPartialToast', { ok: count, fail: total - count }), 4000)
  } else {
    toast.show(t('photosTrashDeleteFailed'), 4000)
  }
  selected.value = []
  await fav.fetchFavorites()
}

function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // Acceptance Fix-1: no more tab filter to also apply -- the paging set is just the
  // person/place/year-filtered, sorted, grouped favorites (matches Vue2's own flatList,
  // :404: `this.grouped.flatMap(g => g.photos)`).
  const list = filteredMonths.value.flatMap((m) => m.photos)
  lb.openAt(photo, list, startMs)
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

// Owner-acceptance Fix-3 (delete-chain diagnosis): a single-item delete only has two possible
// outcomes (1 or 0 actually deleted) -- this used to show the success toast unconditionally
// regardless of what store.deleteAssets actually reported, same swallow-and-lie shape as
// onBatchDelete above.
async function onLightboxDelete(id: string | number) {
  // The lightbox already closes itself when the user confirms deletion (PhotoLightbox.vue
  // doDelete), so no need to close it again here.
  const count = await store.deleteAssets([String(id)])
  if (count > 0) {
    toast.show(t('photosDeletedToast', { count: 1 }), 4000)
  } else {
    toast.show(t('photosTrashDeleteFailed'), 4000)
  }
  void fav.fetchFavorites()
}

onMounted(() => {
  void fav.reconcileFavIds()
  void fav.fetchFavorites()
  void fav.fetchTopFavorites()
})

// Task 4 (Plan H): pinned card click opens the lightbox against the SAME filtered paging set
// as the grid below (not just the 5-card strip) -- matches Vue2's own @click passing the full
// grouped-by-month favorites list, not top5.
function onOpenPinned(photo: Photo): void {
  const list = filteredMonths.value.flatMap((m) => m.photos)
  lb.openAt(photo, list, 0)
}

// Task 5 (Plan H): real slideshow (not the known-dead album-detail Slideshow stub) -- follows
// Vue2 PhotosFavoritesView.vue:469-501.
const slideOpen = ref(false)
const slideIdx = ref(0)
const slidePlaying = ref(true)
const slideInterval = ref(4000)
let slideTimer: ReturnType<typeof setTimeout> | undefined

// Vue2 :439's slidePhotos: `return this.sorted.length ? this.sorted : this.favorites` -- the
// filtered+sorted set when non-empty, else the FULL unfiltered/unsorted favorites list (not
// filteredMonths flattened). Acceptance Fix-1: there is no more tab filter, so this branch is
// reachable only if a person/place/year selection somehow yields zero photos -- which can't
// happen in practice since the three dropdowns' own options are derived from the same
// favorites list (byPersonAll/byPlaceAll/byYearAll), so any selectable value always matches at
// least one photo. Kept anyway: it's Vue2's own defensive fallback, not dead weight added here.
const slidePhotos = computed(() => {
  const s = sortedFiltered.value
  return s.length ? s : (fav.favoritesList ?? [])
})
const slidePhoto = computed(() => slidePhotos.value[slideIdx.value] ?? null)

function stopSlideTimer(): void {
  clearTimeout(slideTimer)
  slideTimer = undefined
}
function startSlideTimer(): void {
  stopSlideTimer()
  if (!slidePlaying.value || !slideOpen.value) return
  slideTimer = setTimeout(() => slideNext(), slideInterval.value)
}
function openSlideshow(): void {
  if (!slidePhotos.value.length) return
  slideIdx.value = 0
  slidePlaying.value = true
  slideOpen.value = true
  startSlideTimer()
  document.addEventListener('keydown', onSlideKey)
}
function closeSlideshow(): void {
  slideOpen.value = false
  stopSlideTimer()
  document.removeEventListener('keydown', onSlideKey)
}
function slideNext(): void {
  if (!slidePhotos.value.length) return
  slideIdx.value = (slideIdx.value + 1) % slidePhotos.value.length
  startSlideTimer()
}
function slidePrev(): void {
  if (!slidePhotos.value.length) return
  slideIdx.value = (slideIdx.value - 1 + slidePhotos.value.length) % slidePhotos.value.length
  startSlideTimer()
}
function toggleSlidePlay(): void {
  slidePlaying.value = !slidePlaying.value
  startSlideTimer()
}
function setSlideSpeed(ms: number): void {
  slideInterval.value = ms
  if (slidePlaying.value) startSlideTimer()
}
function onSlideKey(e: KeyboardEvent): void {
  if (!slideOpen.value) return
  if (e.key === 'Escape') { e.preventDefault(); closeSlideshow() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); slideNext() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); slidePrev() }
  else if (e.key === ' ') { e.preventDefault(); toggleSlidePlay() }
}
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <!-- data-selecting mirrors Photos.vue:363's binding verbatim (selected is the same
         Array<string|number> ref shape there): parity photos.scss:488's tile-checkbox rule
         (`.app[data-selecting="true"] .tile-checkbox { opacity: 1 }`) needs this to fire once
         a selection starts. -->
    <div class="app" :data-collapsed="collapsed" :data-selecting="selected.length > 0">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="t('photosFavTitle')"
          :sub="t('photosFavCount', { count: fav.favoritesTotal })"
          :show-search="false"
          show-ask-nimo
          @toggle-collapse="onToggleCollapse"
          @ask-nimo="useAskNimo().openDrawer()"
        />
        <div class="photos-main">
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
            <!-- Task 3 (Plan H): the hero stats header -- follows Vue2 PhotosFavoritesView.vue's
                 .lib-hero (:4-45), matched against the new-UI's shared .lib-hero* parity CSS
                 (photos.scss ~1231-1267) instead of the old bespoke .fav-header. F-10: only
                 rendered on this v-else (loaded, non-empty) branch, sharing the same
                 "has data to show" precondition as the topbar's exact total -- on the
                 error/empty branches above the hero simply doesn't exist, rather than showing
                 all-zero sub-counts. F-11: .lib-hero-actions carries the Export/Save-as-Album
                 buttons that used to live in the deleted .fav-header (Task 5 will insert a
                 Slideshow button at the front of this same container, matching Vue2's
                 Slideshow -> Save as Album -> Export order). Review fix: `data-tint="fav"` only
                 sits on .lib-hero-icon (Vue2 :5's only tint usage) -- .lib-hero itself never
                 carried it in Vue2 or in parity CSS, so it was dead weight, dropped. -->
            <div class="lib-hero" data-test="fav-hero">
              <div class="lib-hero-icon" data-tint="fav">
                <PhotosIcon name="star" :size="24" class="fav-hero-star-icon" />
              </div>
              <div style="flex:1">
                <h1 class="lib-hero-title">{{ t('photosFavTitle') }}</h1>
                <!-- Review fix: Vue2 :11-13 bolds ONLY the raw number/year-span, not the
                     trailing noun -- `<b>{{ photoCount }}</b> {{ $t('photos_count') }}`. Split
                     into count + noun-only i18n keys so <b> wraps just the number here too. -->
                <div class="lib-hero-sub">
                  <b>{{ heroPhotoCount }}</b> {{ t('photosFavHeroPhotosNoun') }}
                  &middot; <b>{{ heroVideoCount }}</b> {{ t('photosFavHeroVideosNoun') }}
                  <template v-if="heroYearSpan"> &middot; <b>{{ heroYearSpan }}</b></template>
                  &middot; <span data-test="fav-hero-badge" class="fav-hero-star-label">&#9733; {{ t('photosFavHeroKeptForever') }}</span>
                </div>
              </div>
              <div class="lib-hero-actions">
                <!-- Task 5 (Plan H): the real slideshow entry -- F-11: Vue2 order is
                     Slideshow -> Save as Album -> Export, so this is inserted as the FIRST
                     child of the already-landed (Task 3) .lib-hero-actions container. Vue2
                     :18-19 also carries a leading play icon, matching the other two buttons'
                     own leading icon (album/download, :size=13) below. -->
                <button
                  type="button" class="btn" data-test="fav-slideshow-btn"
                  :disabled="!fav.favoritesList?.length" @click="openSlideshow"
                ><PhotosIcon name="play" :size="13" /> {{ t('photosFavSlideshow') }}</button>
                <!-- Review fix: restores Vue2 :21/:26's leading icon inside each button
                     (album/download, :size=13) -- dropped by mistake in the first pass. -->
                <button type="button" class="btn" data-test="fav-save-album-btn" :disabled="!(fav.favoritesList?.length)" @click="openSaveAlbum">
                  <PhotosIcon name="album" :size="13" /> {{ t('photosFavSaveAlbum') }}
                </button>
                <!-- R-3: gains data-test="fav-export-btn" -- this button had no anchor before (only
                     the save-album button did), leaving the 3 existing .fav-export text-selector
                     assertions with nowhere to migrate to. Export's dropdown-menu (Vue2's
                     .fav-export-menu on click) is a separately ledgered gap, out of this task's
                     scope -- onExport still fires the direct zip export as before. -->
                <button type="button" class="btn" data-test="fav-export-btn" :disabled="!(fav.favoritesList?.length)" @click="onExport">
                  <PhotosIcon name="download" :size="13" /> {{ t('photosFavExport') }}
                </button>
              </div>
            </div>

            <!-- Task 4 (Plan H): pinned-highlights strip -- server-ranked top 5 (GET
                 /favorites/top, fav.fetchTopFavorites), rendered in this v-else (loaded,
                 non-empty) branch alongside the hero (F-10). Follows Vue2
                 PhotosFavoritesView.vue:86-102 verbatim; F-1: thumbnailUrl's size param is the
                 string enum 'large', not a pixel number like Vue2's thumbUrl(p.id, 800). -->
            <div v-if="fav.topFavoritesLoaded && fav.topFavorites.length" class="fav-top-strip" data-test="fav-pinned-strip">
              <div class="fav-top-head">
                <h3>{{ t('photosFavPinnedTitle') }}</h3>
                <span class="sub">{{ t('photosFavPinnedSub') }}</span>
              </div>
              <div class="fav-top-grid">
                <div
                  v-for="(p, i) in fav.topFavorites" :key="p.id" class="fav-top-card" data-test="fav-pinned-card"
                  @click="onOpenPinned(p)"
                >
                  <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                  <span class="fav-rank">{{ i + 1 }}</span>
                  <div class="fav-meta">
                    <div class="fav-meta-title">{{ p.title || p.date }}</div>
                    <div class="fav-meta-sub">{{ p.date }}<template v-if="p.place"> &middot; {{ p.place }}</template></div>
                  </div>
                </div>
              </div>
            </div>

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

            <!-- Acceptance Fix-1 (owner finding, Plans G+H): the filter row -- follows Vue2
                 PhotosFavoritesView.vue :112-203 verbatim: an "All <count>" chip + THREE
                 mutually-exclusive dropdowns (People / Places / Years, each disabled when its
                 own option list is empty), a flex spacer, then a Sort Recent/Oldest segmented
                 toggle. No media-type tab chips, no density switcher, no right-edge timeline
                 scrubber -- Vue2 Favorites has none of the three (PhotosGrid's `show-scrubber`
                 below is set to false to match). Global mousedown-to-close for whichever
                 dropdown is open is wired via filterBarRef + onFilterDocumentClick (onMounted
                 above), covering the whole row (Vue2 :113 `ref="filterBar"` sits on this same
                 `.lib-filters` div, not on each dropdown individually). -->
            <div class="lib-filters" ref="filterBarRef">
              <button
                type="button" class="lib-chip" data-test="fav-filter-all-btn"
                :data-active="filter === 'all'" @click="clearFilter"
              >
                {{ t('photosFavFilterAll') }} <span class="ct">{{ fav.favoritesTotal }}</span>
              </button>

              <!-- People dropdown -- Vue2 :119-143's byPersonAll (peopleView.ts's topPersons,
                   count desc) + filtered's `p:<name>` branch (exact match against `p.faces`). -->
              <div class="fav-filter-wrap">
                <button
                  type="button" class="lib-chip" data-test="fav-filter-people-btn"
                  :data-active="filter.startsWith('p:')" :disabled="!byPersonAll.length"
                  @click.stop="toggleOpenFilter('people')"
                >
                  <PhotosIcon name="person" :size="11" />
                  {{ activePersonLabel || t('photosFavFilterPeople') }}
                  <span v-if="byPersonAll.length" class="ct">{{ byPersonAll.length }}</span>
                  <PhotosIcon name="chevD" :size="9" style="margin-left:2px;opacity:0.75" />
                </button>
                <transition name="fav-menu">
                  <div v-if="openFilter === 'people'" class="fav-filter-menu" @click.stop>
                    <button v-if="filter.startsWith('p:')" type="button" class="fav-filter-item is-clear" @click="clearFilter">
                      {{ t('photosFavFilterClear') }}
                    </button>
                    <button
                      v-for="[name, count] in byPersonAll" :key="'p-' + name" type="button"
                      class="fav-filter-item has-text-full-04" :data-active="filter === ('p:' + name)"
                      @click="selectPerson(name)"
                    >
                      <span class="fav-filter-label">{{ name }}</span>
                      <span class="ct">{{ count }}</span>
                    </button>
                  </div>
                </transition>
              </div>

              <!-- Places dropdown -- Vue2 :412-416's byPlaceAll (group the loaded page by exact
                   `place` string, sort by count desc) + :353-360's filtered (exact string match
                   against `l:<place>`). -->
              <div class="fav-filter-wrap">
                <button
                  type="button" class="lib-chip" data-test="fav-filter-places-btn"
                  :data-active="filter.startsWith('l:')" :disabled="!byPlaceAll.length"
                  @click.stop="toggleOpenFilter('places')"
                >
                  <PhotosIcon name="map" :size="11" />
                  {{ activePlaceLabel || t('photosFavFilterPlaces') }}
                  <span v-if="byPlaceAll.length" class="ct">{{ byPlaceAll.length }}</span>
                  <!-- Review fix (Task 6): Vue2 :126/:152 trails the count badge with a small
                       down-chevron (raw `<svg width="9" height="9" viewBox="0 0 12 12">` +
                       `<path d="M3 4.5l3 3 3-3" stroke-width="1.5">`). PhotosIcon's existing
                       `chevD` branch (`d="m6 9 6 6 6-6"` in a 24-viewBox) is the exact same
                       chevron-down shape at 2x scale, reused for all three dropdowns here
                       (Vue2 :177's Years chevron is identical markup, :150's Places likewise). -->
                  <PhotosIcon name="chevD" :size="9" style="margin-left:2px;opacity:0.75" />
                </button>
                <transition name="fav-menu">
                  <div v-if="openFilter === 'places'" class="fav-filter-menu" @click.stop>
                    <button v-if="filter.startsWith('l:')" type="button" class="fav-filter-item is-clear" @click="clearFilter">
                      {{ t('photosFavFilterClear') }}
                    </button>
                    <button
                      v-for="[place, count] in byPlaceAll" :key="'l-' + place" type="button"
                      class="fav-filter-item has-text-full-04" :data-active="filter === ('l:' + place)"
                      @click="selectPlace(place)"
                    >
                      <span class="fav-filter-label">{{ place.split(',')[0] }}</span>
                      <span class="ct">{{ count }}</span>
                    </button>
                  </div>
                </transition>
              </div>

              <!-- Years dropdown -- Vue2 :417-424's byYearAll (peopleView.ts's byYear, year
                   string desc) + filtered's `y:<year>` branch (`takenAt` string-prefix match). -->
              <div class="fav-filter-wrap">
                <button
                  type="button" class="lib-chip" data-test="fav-filter-years-btn"
                  :data-active="filter.startsWith('y:')" :disabled="!byYear.length"
                  @click.stop="toggleOpenFilter('years')"
                >
                  <PhotosIcon name="clock" :size="11" />
                  {{ activeYearLabel || t('photosFavFilterYears') }}
                  <span v-if="byYear.length" class="ct">{{ byYear.length }}</span>
                  <PhotosIcon name="chevD" :size="9" style="margin-left:2px;opacity:0.75" />
                </button>
                <transition name="fav-menu">
                  <div v-if="openFilter === 'years'" class="fav-filter-menu" @click.stop>
                    <button v-if="filter.startsWith('y:')" type="button" class="fav-filter-item is-clear" @click="clearFilter">
                      {{ t('photosFavFilterClear') }}
                    </button>
                    <button
                      v-for="[year, count] in byYear" :key="'y-' + year" type="button"
                      class="fav-filter-item has-text-full-04" :data-active="filter === ('y:' + year)"
                      @click="selectYear(year)"
                    >
                      <span class="fav-filter-label">{{ year }}</span>
                      <span class="ct">{{ count }}</span>
                    </button>
                  </div>
                </transition>
              </div>

              <div style="flex:1"></div>
              <div class="lib-sort">
                <span class="lib-sort-label">{{ t('photosFavSort') }}</span>
                <button type="button" data-test="fav-sort-recent" :data-active="sort === 'recent'" @click="sort = 'recent'">{{ t('photosFavSortRecent') }}</button>
                <button type="button" data-test="fav-sort-oldest" :data-active="sort === 'oldest'" @click="sort = 'oldest'">{{ t('photosFavSortOldest') }}</button>
              </div>
            </div>
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
                @ask-nimo="useAskNimo().openWith(t('photosGridAskNimoRecap', { count: selected.length }))"
              />
              <!-- Acceptance Fix-1: Vue2 Favorites has no right-edge timeline scrubber at all
                   (see PhotosGrid.vue's `showScrubber` prop comment) -- `tab="all"` is now a
                   fixed literal, not a reactive ref, since there is no tab-filter UI left to
                   drive it. -->
              <PhotosGrid
                :months="filteredMonths" tab="all" :density="density" :selected="selected"
                :show-scrubber="false"
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
        </div>
      </main>
    </div>

    <!-- Task 1: re-homed inside .photos-root (used to be a template-root sibling of the old
         AreaShell wrapper). -->
    <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />

    <!-- Acceptance Fix-2 (owner finding, screenshot-verified): re-skinned onto Vue2
         PhotosFavoritesView.vue's own `.fav-modal*` class family (:275-306) -- parity photos.scss
         already carried these rules byte-exact (transcribed but unused until now), so landing the
         template on the same class names is the whole fix; no new CSS needed beyond the Vue2->Vue3
         transition-class shim below. The old bespoke `.favsave-*` family (wrong title, no icon
         tile, no field label, purple CTA, heavier blur/scrim) is retired, not kept alongside. -->
    <transition name="fav-modal">
      <div
        v-if="saveAlbumOpen"
        class="fav-modal-scrim"
        data-test="fav-savealbum-modal"
        @click.self="closeSaveAlbum"
      >
        <div class="fav-modal">
          <div class="fav-modal-head">
            <div class="fav-modal-icon"><PhotosIcon name="album" :size="15" color="white" /></div>
            <div style="flex:1">
              <!-- Vue2 :282 reuses the exact same `$t('Save as Album')` string as the hero
                   button (:22) -- both now read the same `photosFavSaveAlbum` key. -->
              <div class="fav-modal-title">{{ t('photosFavSaveAlbum') }}</div>
              <!-- Review Important 2: adds Vue2 :267-268's dynamic subtitle. Task 11 review fix:
                   use the exact total, not the loaded-page length — the number shown here is what
                   confirmSaveAlbum now actually pages in and saves. -->
              <div class="fav-modal-sub" data-test="fav-savealbum-sub">
                {{ t('photosFavSaveAlbumSub', { count: fav.favoritesTotal }) }}
              </div>
            </div>
            <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeSaveAlbum">
              <PhotosIcon name="x" :size="15" />
            </button>
          </div>
          <div class="fav-modal-body">
            <!-- Vue2 :288-293's field label + placeholder, previously missing entirely. -->
            <label class="fav-modal-field">
              <span class="fav-modal-label">{{ t('photosAlbumNameLabel') }}</span>
              <input
                ref="saveAlbumInputRef"
                v-model="saveAlbumName"
                :placeholder="t('photosFavSaveAlbumPlaceholder')"
                class="fav-modal-input"
                data-test="fav-savealbum-input"
                @keydown.enter.prevent="confirmSaveAlbum"
              >
            </label>
            <!-- Review Important 2: adds Vue2 :279-281's static footnote (the album is a snapshot
                 and doesn't stay in sync with later favorites changes). -->
            <div class="fav-modal-note" data-test="fav-savealbum-note">{{ t('photosFavSaveAlbumNote') }}</div>
          </div>
          <div class="fav-modal-foot">
            <button type="button" class="fav-btn-ghost" @click="closeSaveAlbum">{{ t('photosCancel') }}</button>
            <button
              type="button"
              class="fav-btn-primary"
              data-test="fav-savealbum-confirm"
              :disabled="!saveAlbumName.trim() || saveAlbumSaving"
              @click="confirmSaveAlbum"
            >
              <PhotosIcon name="album" :size="12" color="white" /> {{ t('photosAlbumCreate') }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Task 5 (Plan H): slideshow overlay -- follows Vue2 PhotosFavoritesView.vue:237-273
         verbatim (crossfade full-image render, no count cap, progress bar via a CSS animation
         keyed to slideIdx/slidePlaying/slideInterval so it restarts on every advance/pause/speed
         change). F-1: thumbnailUrl's size param is the string enum 'large', not a pixel number
         like Vue2's thumbUrl(p.id, 800). -->
    <transition name="fav-slide">
      <div v-if="slideOpen" class="fav-slideshow" @click.self="closeSlideshow">
        <div
          v-for="(p, i) in slidePhotos" :key="p.id" class="fav-slide-img-wrap"
          :style="{ opacity: i === slideIdx ? 1 : 0, transform: i === slideIdx ? 'scale(1)' : 'scale(1.05)' }"
        >
          <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="">
        </div>
        <div v-if="slidePhoto" class="fav-slide-caption">
          <div class="fav-slide-title">{{ slidePhoto.title }}</div>
          <div class="fav-slide-meta">{{ slidePhoto.date }}<template v-if="slidePhoto.place"> &middot; {{ slidePhoto.place }}</template></div>
        </div>
        <!-- Review fix (Important 2): Vue2 :246-254 uses PhotosIcon glyphs here (x/chevL/chevR),
             not text-entity characters -- swapped in verbatim. -->
        <button type="button" class="fav-slide-close" :title="t('photosFavSlideClose')" @click="closeSlideshow">
          <PhotosIcon name="x" :size="18" />
        </button>
        <button type="button" class="fav-slide-nav fav-slide-nav-l" :title="t('photosFavSlidePrev')" @click="slidePrev">
          <PhotosIcon name="chevL" :size="22" />
        </button>
        <button type="button" class="fav-slide-nav fav-slide-nav-r" :title="t('photosFavSlideNext')" @click="slideNext">
          <PhotosIcon name="chevR" :size="22" />
        </button>
        <div class="fav-slide-controls" @click.stop>
          <!-- Review fix (Minor 4): adds Vue2 :256's title. -->
          <button type="button" class="fav-slide-ctrl" :title="t('photosFavSlidePlayPause')" @click="toggleSlidePlay">
            <PhotosIcon :name="slidePlaying ? 'pause' : 'play'" :size="14" />
          </button>
          <div class="fav-slide-progress">
            <div
              :key="slideIdx + '-' + slidePlaying + '-' + slideInterval"
              class="fav-slide-progress-bar"
              :style="{ animationDuration: slideInterval + 'ms', animationPlayState: slidePlaying ? 'running' : 'paused' }"
            ></div>
          </div>
          <div class="fav-slide-count" data-test="fav-slide-count">{{ slideIdx + 1 }} / {{ slidePhotos.length }}</div>
          <div class="fav-slide-sep"></div>
          <span class="fav-slide-speed-label">{{ t('photosFavSlideSpeed') }}</span>
          <button type="button" class="fav-slide-speed" :data-active="slideInterval === 2000" @click="setSlideSpeed(2000)">{{ t('photosFavSlideFast') }}</button>
          <button type="button" class="fav-slide-speed" :data-active="slideInterval === 4000" @click="setSlideSpeed(4000)">{{ t('photosFavSlideNormal') }}</button>
          <button type="button" class="fav-slide-speed" :data-active="slideInterval === 7000" @click="setSlideSpeed(7000)">{{ t('photosFavSlideSlow') }}</button>
        </div>
      </div>
    </transition>

    <!-- PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade tie that F8-r4 guarded against. -->
    <PhotoLightbox
      @delete="onLightboxDelete"
      @toggle-fav="() => {}"
      @add-to-album="(id) => openAlbumPicker([id])"
    />
    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body"
         shape as PhotosToastHost (not present on this view) -- Photos has no shared shell to
         mount this once at. -->
    <AskNimoHost />
  </div>
</template>

<style scoped>
/* Task 1 (Plan H re-shell): this page now mounts the shared `.app` CSS Grid shell
   (Photos.vue/PhotosPeople.vue's own re-shell precedent) instead of the old flex-row
   `.photos-layout` + unpinned `.sidebar` transitional rules -- both deleted, the `.app` grid's
   own column track now owns the sidebar width and the height cap. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

/* Task 3 (Plan H): theme-exception precedent -- this repo's existing var(--star-fg, #ffd60a)
   fallback convention (PersonHero.vue/PhotosGrid.vue/PersonAvatar.vue) -- a fixed golden star
   color that stays the same across themes, expressed via a CSS custom-property reference with
   a literal fallback rather than a bare hex literal (F-07). */
.fav-hero-star-icon { color: var(--star-fg, #ffd60a); }
.fav-hero-star-label { color: var(--star-fg, #ffd60a); }

.fav-load-more { display: flex; justify-content: center; padding: 16px 0; }
.fav-load-more .bar-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Task 3 review handoff (Minor-4): .fav-stats/.fav-stat-card/.fav-stat-bar's own scoped copy
   used to live here, shadowing parity photos.scss:1804-1845's grid layout/tokens with a
   value-divergent flex layout -- deleted so parity governs; .fav-stat-sub (the "in {year}"
   caption) has no parity counterpart (Vue2 uses an inline style, not a class) and stays, values
   aligned exactly to Vue2 PhotosFavoritesView.vue :77's inline style
   (`font-size:11px;color:var(--text-3);font-weight:400`). Fix wave (post-final-review): the
   old --fg-muted mapping rationale predates this view's Plan H re-shell into `.photos-root`'s
   scope -- --fg-muted resolves fine (it's a real global New-UI token), but it's the wrong
   shade for pixel parity: Vue2's inline style literally names --text-3, and photos.scss's
   `.photos-root`/`.photos-root.is-light` blocks define a photos-private --text-3 with its own
   distinct value, not merely an alias for the global --fg-muted. Corrected to the real token.
   Review fix already dropped this file's own extra `margin-left: 4px`, which Vue2's inline
   style does not have. */
.fav-stat-sub { font-size: 11px; color: var(--text-3); font-weight: 400; }

/* Acceptance Fix-2: the save-as-album naming modal's own bespoke `.favsave-*` rules (purple CTA,
   --popup-bg card, heavier blur scrim) are retired -- the template now uses Vue2
   PhotosFavoritesView.vue's own `.fav-modal*` class names, and parity photos.scss already
   carries every one of those rules byte-exact (unscoped, imported globally via
   `../photos/styles/vue2-parity`), so nothing needs duplicating here. Only the Vue2->Vue3
   transition-class spelling gap needs a page-local shim (same convention as PhotosTrash.vue's
   `.trash-modal-enter-from` / PhotosAlbumDetail.vue's `.lb-confirm-enter-from`): Vue3 renders the
   bare `-enter` as `-enter-from` instead, `-leave-to` is unchanged and already covered by
   parity's own `.fav-modal-enter`/`.fav-modal-leave-to` rule. */
.fav-modal-enter-from { opacity: 0; }
.fav-modal-enter-from .fav-modal { transform: translateY(8px) scale(0.98); opacity: 0; }

/* Task 3 review handoff (Minor-4): .empty-state/-title/-desc's own scoped copy (a coin-flip
   specificity tie with parity photos.scss:1196-1205) used to live here -- deleted, parity
   governs. .empty-state .bar-btn has no parity counterpart (parity's own retry-style button is
   .empty-state-btn, a different class this view doesn't use) and stays as a load-bearing
   survivor: it matches the same rule already present in PhotosAlbums.vue/PhotosPlaceAssets.vue's
   own empty/failure states, keeping the title/desc-to-button gap consistent across views. */
.empty-state .bar-btn { margin-top: 10px; }

/* Task 1: mobile column-collapse, copied from Photos.vue:466-468 specifically (not from
   PhotosPeople.vue, which has no .app scoped rule at all) -- a New-UI-only mobile
   enhancement, no Vue2/parity source (F-21). */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
