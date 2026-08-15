<script setup lang="ts">
// Task 8 (SP7-P4 albums): the album detail view -- the biggest single item this period.
// Structure/sequencing ported section-by-section from Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumDetail.vue (419 lines): hero (cover/rename/edit toggle/⋯ menu
// delete) + toolbar (bulk remove/add photos, or sort+density) + a hand-drawn grid (drag reorder/
// cover star/multi-select) + delete confirm modal + PhotosLibraryPicker (T6, add photos) +
// PhotoLightbox (P2, view/delete). Route /photos/albums/:id registration is left for T11. Drops
// Slideshow (Vue2's own version only ever popped a "coming soon" toast) and Ask Nimo (deferred
// to SP8).
//
// ★ SP15-P2c Task 3 supersedes the two structures named above. The cover hero and the toolbar
// band are both gone; the page now wears the same skeleton as PhotosSmartViewDetail.vue --
// .sv-detail-bar, then .sv-detail-layout splitting into a scrolling .sv-detail-main (header +
// action row + photo grid) and the .sv-detail-side rail. Edit mode's two buttons moved to a
// floating .sv-select-bar at the bottom. Target: 33b05636:src/views/Photos/PhotosAlbumDetail.vue.
//
// Hard rules (implemented item by item, registered in inline comments below):
//  1) route.params.id is always a string; albumId uniformly goes through
//     String(route.params.id), and every store call
//     (fetchAlbumAssets/renameAlbum/setAlbumCover/removeAssetsFromAlbum/deleteAlbum/
//     reorderAlbumAssets) passes this normalized string -- the T2 store itself already
//     compares via String(key), so passing a string is always safe and there's no need to
//     guess the backend id's real type here.
//  2) Cover check: isCover(p) = String(p.id) === String(album.cover) (album.cover may be a
//     number).
//  3) selected is a Set<string> (String-normalized).
//  4) No object-reference === anywhere in this file.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import AlbumConvertToSmartDialog from '../photos/components/AlbumConvertToSmartDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosAlbums } from '../photos/stores/albums'
import type { SmartView } from '../photos/stores/smartViews'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import { useAlbumDragSort } from '../photos/composables/useAlbumDragSort'
import { useFixedMenuPosition } from '../photos/composables/useFixedMenuPosition'
import { albumToView, sortAlbumPhotos } from '../photos/util/albumView'
import { isConflict } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

type SortBy = 'manual' | 'taken' | 'added'

const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
const route = useRoute()
const router = useRouter()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const settings = usePhotosSettingsStore()
const toast = useToast()
const lb = useLightbox()

// T6: this repo's locale ids (`zh_cn`/`en_us`) are not valid BCP-47 tags -- handing one to
// toLocaleString/toLocaleDateString bare throws a RangeError. Same form as
// PhotosMomentDetail.vue's own localeTag.
const localeTag = computed(() => locale.value.replace('_', '-'))

// Hard rule 1: route.params.id is always a string -- normalized in this one place, and every
// downstream store call uses it.
const albumId = computed(() => String(route.params.id))

// ── Local state (named per the brief's structure checklist) ──
const edit = ref(false)
const selected = ref<Set<string>>(new Set())
const sortBy = ref<SortBy>('manual')
const density = ref<'comfortable' | 'compact'>('comfortable')
const titleEditing = ref(false)
const titleDraft = ref('')
const titleCommitting = ref(false)
const menuOpen = ref(false)
const sortMenuOpen = ref(false)
const confirmDelete = ref(false)
// Final review Minor 6: without disabling the button while a "remove selected" request is in
// flight, double-clicking fires two concurrent DELETE rounds for the same batch of ids -- the
// second round would roll back from a snapshot taken after the first removal, restoring the
// wrong snapshot on failure. Same reentrancy guard as the established pattern in T7
// PhotosAlbums.vue's `creating` / AlbumPickerDialog.vue's `submitting`/`adding`.
const removing = ref(false)
const pickerOpen = ref(false)
// Task 9 (SP7-P4 albums): the lightbox's "Add to album" -> adds to some *other* album (not this
// one) -- named distinctly from PhotosLibraryPicker's pickerOpen above (this album's "Add
// photos"), to avoid a same-named ref conflating two different panels.
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
// Adds to some other album, not this one -- no fetchAlbumAssets refresh needed (per the brief).
// This empty function is a placeholder only, kept for readability consistency with the
// same-named wiring in Photos.vue/PhotosFavorites.vue.
function onAlbumPickerAdded(): void {}

const titleInputRef = ref<HTMLInputElement | null>(null)
const morePopRef = ref<HTMLElement | null>(null)
// Task 5: the composable only takes the trigger button's rect, not the click-outside wrapper's --
// morePopRef stays the click-outside container (onDocMousedown below), moreBtnRef is new and
// exists solely to hand the button element to useFixedMenuPosition. Neither replaces the other.
const moreBtnRef = ref<HTMLElement | null>(null)
const sortMenuRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

// Task 5 (T1): pins the more menu to the viewport via the trigger button's rect, so it no longer
// clips against .sv-detail-side's own overflow-y:auto once the menu grew to five entries.
const { menuStyle } = useFixedMenuPosition(menuOpen, moreBtnRef)

// ── Derived data ──
// album being null has two sub-cases (distinguished in the template): albumsLoaded===false ->
// not loaded yet, render the skeleton; albumsLoaded===true but still null -> the album genuinely
// doesn't exist (a New-UI gap-fill; Vue2's in-page state never produces this case -- noted for
// the record).
const album = computed(() => {
  const raw = albums.albumById(albumId.value)
  return raw ? albumToView(raw, t('photosAlbumUntitled')) : null
})
const notFound = computed(() => albums.albumsLoaded && album.value === null)

// Vue2 :224-242 (photos computed) -- sorting is provided by T1's sortAlbumPhotos; this just
// wires up the data source.
const photos = computed<Photo[]>(() => sortAlbumPhotos(albums.assetsOf(albumId.value), sortBy.value))
const isLoadingPhotos = computed(() => albums.isLoadingAssets(albumId.value))
const isAlbumEmpty = computed(() => !isLoadingPhotos.value && photos.value.length === 0)

// SP15-P2c Task 3: `coverBgImage` is gone with the cover hero it painted. The
// `--album-cover-fallback` token it referenced stays in theme.css -- PhotosAlbums.vue's
// .album-cover-fallback is still a consumer (grep-verified before the deletion).

// T6: stats rail — the four cells the smart-view detail page has always had.
const DASH = '—'

// Vue2 :251-253: reuse the human-readable span the list already formats (formatAlbumSpan,
// same call already backing album.dateRange), not a second formatter.
const spanLabel = computed(() => album.value?.dateRange || DASH)

// Vue2 :260-262. videoCount is not omitempty on the wire (albumToView reads
// `Number(a.videoCount ?? 0)`), so 0 is a real answer, not missing data.
const videoCountLabel = computed(() => (album.value?.videoCount ?? 0).toLocaleString(localeTag.value))

// Vue2 :263-271. Vue2 replaced its own "Recently added" cell with this one in the final review
// round: that cell also read createdAt, so it duplicated this one and, on an old album, read as
// though new photos had just arrived.
const createdLabel = computed(() => {
  const raw = album.value?.createdAt
  if (!raw) return DASH
  const d = new Date(raw)
  if (isNaN(d.getTime())) return DASH
  return d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
})

// By-month histogram: verbatim port of PhotosMomentDetail.vue's own monthBuckets/distMax/
// distStyle (same Vue2 source, already through a whole-branch review), with allAssets.value
// swapped for this page's photos.value.
interface MonthBucket { key: string; count: number; label: string }
const monthBuckets = computed<MonthBucket[]>(() => {
  if (!photos.value.length) return []
  const map = new Map<string, number>()
  for (const p of photos.value) {
    if (!p.takenAt) continue
    const d = new Date(p.takenAt)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1)
        .toLocaleDateString(localeTag.value, { month: 'short', year: 'numeric' })
      return { key, count, label }
    })
})
const distMax = computed(() => Math.max(1, ...monthBuckets.value.map((b) => b.count)))
function distStyle(b: MonthBucket, i: number): { height: string; opacity: number } {
  const n = Math.max(1, monthBuckets.value.length - 1)
  return { height: `${(b.count / distMax.value) * 100}%`, opacity: 0.4 + (i / n) * 0.5 }
}

// Task 4 (Vue2 :570-579). About·Time span — prefer the human-readable span the album list
// already formats (spanLabel/album.dateRange); when that's the placeholder, derive it from the
// currently-loaded members' takenAt (min/max), same locale-aware fmt as createdLabel. DASH only
// when neither source has anything.
const timeSpanLabel = computed(() => {
  if (spanLabel.value !== DASH) return spanLabel.value
  const times = photos.value
    .map((p) => (p.takenAt ? new Date(p.takenAt) : null))
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
  if (!times.length) return DASH
  const fmt = (d: Date) => d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
  const min = new Date(Math.min(...times.map((d) => d.getTime())))
  const max = new Date(Math.max(...times.map((d) => d.getTime())))
  const a = fmt(min)
  const b = fmt(max)
  return a === b ? a : `${a} – ${b}`
})

// Task 4 (Vue2 :588-599). About·Place — assetToPhoto already resolves each loaded member's
// `place` (placeName, or a coordinate-derived country fallback), so this aggregates by
// frequency locally instead of issuing a separate request.
interface PlaceCount { name: string; count: number }
const placesAgg = computed<PlaceCount[]>(() => {
  const freq = new Map<string, number>()
  for (const p of photos.value) {
    if (!p.place) continue
    freq.set(p.place, (freq.get(p.place) ?? 0) + 1)
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
})
// Vue2 :601-607. Top three by frequency joined with " · ", "+N" for whatever is left over.
const placesLabel = computed(() => {
  if (!placesAgg.value.length) return DASH
  const top = placesAgg.value.slice(0, 3).map((p) => p.name)
  const rest = placesAgg.value.length - top.length
  return rest > 0 ? `${top.join(' · ')} +${rest}` : top.join(' · ')
})
// Vue2 :609-613. Hover hint: every place with its count. Empty string (not DASH) when there is
// nothing to hint at — driven by the same `placesAgg.value.length` gate as placesLabel above, so
// the two can never drift out of sync (one shared source, not two placeholder literals).
const placesTitle = computed(() =>
  placesAgg.value.length ? placesAgg.value.map((p) => `${p.name} (${p.count})`).join(' · ') : '',
)

function isCover(p: Photo): boolean {
  // Hard rule 2: value comparison, regardless of which side is a string and which is a number.
  return String(p.id) === String(album.value?.cover)
}
function isSelected(p: Photo): boolean {
  return selected.value.has(String(p.id))
}
function thumbnailUrl(id: string | number, size: string): string {
  return service.photos.thumbnailUrl(id, size)
}

const sortOptions = computed(() => [
  { id: 'manual' as SortBy, label: t('photosAlbumSortManual') },
  { id: 'taken' as SortBy, label: t('photosAlbumSortTaken') },
  { id: 'added' as SortBy, label: t('photosAlbumSortAdded') },
])
const currentSortLabel = computed(() => sortOptions.value.find((s) => s.id === sortBy.value)?.label ?? '')

// The edit-mode bottom bar's hint. Whole-branch review, Important 3: this used to reuse
// tileHintTitle's keys, so the bar advertised "★ to set cover" -- an affordance the bar does not
// offer (only a tile does). The target keeps the two deliberately distinct: the bar reads
// "Click to select · Drag to reorder" / "Click to select" (33b05636 PhotosAlbumDetail.vue:330),
// the "★ to set cover" halves live only in tileTitle() (:799-800). The plain branch reuses
// photosSvClickToSelect, the exact key the smart-view page's own bar already uses.
const editHintText = computed(() => {
  if (selected.value.size > 0) return t('photosSelectedCount', { count: selected.value.size })
  return sortBy.value === 'manual' ? t('photosAlbumHintSelectDrag') : t('photosSvClickToSelect')
})
const tileHintTitle = computed(() => {
  if (!edit.value) return ''
  return sortBy.value === 'manual' ? t('photosAlbumHintSelectDragCover') : t('photosAlbumHintSelectCover')
})

// ── T4 drag-reorder wiring ──
const drag = useAlbumDragSort({
  container: gridRef,
  enabled: () => edit.value && sortBy.value === 'manual',
  onOrder: (ids) => {
    albums.reorderAlbumAssets(albumId.value, ids).catch((e) => {
      console.error('[album-detail] reorder', e)
      toast.show(t('photosAlbumOrderFailed'))
    })
  },
})

// ── Tile interactions ──
function toggleSelect(p: Photo): void {
  const key = String(p.id)
  if (selected.value.has(key)) selected.value.delete(key)
  else selected.value.add(key)
}

// Drag guard (following Vue2 :380-384's `_dragging`) -- must come first, or the click that ends
// a drag would wrongly trigger select/open-lightbox.
function onTileClick(p: Photo): void {
  if (drag.isDragging()) return
  if (edit.value) toggleSelect(p)
  else lb.openAt(p, photos.value, 0)
}

async function setCover(p: Photo): Promise<void> {
  try {
    await albums.setAlbumCover(albumId.value, p.id)
    toast.show(t('photosAlbumCoverUpdatedToast'))
  } catch (e) {
    console.error('[album-detail] setCover', e)
    toast.show(t('photosAlbumCoverFailed'))
  }
}

// ── Hero: title editing ──
function startTitleEdit(): void {
  titleDraft.value = album.value?.title ?? ''
  titleEditing.value = true
  void nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
function cancelTitleEdit(): void {
  titleEditing.value = false
}
async function commitTitle(): Promise<void> {
  if (titleCommitting.value) return
  const v = titleDraft.value.trim()
  const original = album.value?.title ?? ''
  if (!v || v === original) {
    titleEditing.value = false
    return
  }
  titleCommitting.value = true
  try {
    await albums.renameAlbum(albumId.value, v)
    toast.show(t('photosAlbumRenamedToast'))
  } catch (e) {
    // On failure the store never writes back locally (T2's renameAlbum only calls
    // updateAlbumLocal after success), so the album.title computed naturally keeps its
    // original value -- no extra code needed to "restore the title".
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumRenameFailed'))
  } finally {
    titleCommitting.value = false
    titleEditing.value = false
  }
}

// Minor fix: same named-function style as PhotosAlbums.vue:85-87, moving the navigation call
// out of an inline template expression -- an inline `@click="router.push(...)"` in the template
// leaves the returned promise hanging off the event handler unattended; when navigation is
// cancelled/duplicated the rejection goes uncaught (a known vue-router pitfall that logs an
// unhandled-rejection to the console), so `void` is added here to explicitly mark "don't care
// about its resolve/reject".
function goToAlbumsList(): void {
  void router.push('/photos/albums')
}

// Task 9 (P8a, closing out a P4 leftover): when fetchAlbums fails, albumsLoaded stays false (see
// the albums.ts comment -- deliberate, not a bug), so under the old implementation
// `!album && !albums.albumsLoaded` was therefore permanently true -> stuck on the skeleton
// forever. Adds a loadError branch (see the template, gated ahead of the skeleton branch) plus
// this retry entry point, which just re-invokes the same fetch.
// Review Important 1 fix: a local `retrying` guard -- fetchAlbums only clears loadError on
// success (see the same review's comment in albums.ts), so the button itself no longer needs to
// rely on "clearing the error state" for immediate user feedback; this ref supplies that
// feedback (disabled), while also incidentally blocking a double-click from firing two
// concurrent fetches.
const retryingAlbums = ref(false)
async function retryAlbums(): Promise<void> {
  if (retryingAlbums.value) return
  retryingAlbums.value = true
  try {
    await albums.fetchAlbums()
  } finally {
    retryingAlbums.value = false
  }
}

// ── Hero: edit mode / ⋯ menu ──
function toggleEditMode(): void {
  edit.value = !edit.value
  if (!edit.value) selected.value.clear()
  // Whole-branch review, Important 1 -- the same defect PhotosSmartViewDetail.vue:toggleEdit
  // already fixed, kept in step here. Keyboard-activating this button (Space/Enter on a focused
  // element) fires a `click` but no `mousedown` -- the event onDocMousedown listens for to close
  // the sort menu. Without this, entering edit mode that way leaves `sortMenuOpen` true while the
  // template unmounts the sort capsule (`v-if="!edit"`), and the popup springs back the moment
  // edit mode is left again, with no visible trigger for it. Sort has no meaning in edit mode
  // either way, so closing it unconditionally here -- entering or leaving -- is safe.
  sortMenuOpen.value = false
}
function askConfirmDelete(): void {
  menuOpen.value = false
  confirmDelete.value = true
}

// Task 5 (Vue2 :708-730 duplicateAlbum). Thin page-level wrapper around the store's own
// duplicateAlbum (T2): close the menu, delegate name/asset-id computation and the re-entry guard
// to the store, and translate its outcome into a toast. Unlike this page's other guarded writes
// (removing/pickerAdding), there is no local busy ref here -- the store's `duplicateBusy` throws
// on re-entry rather than resolving quietly (T2's own comment explains why: unlike its smart-view
// sibling, this one must resolve to a value on the success path). The catch below discriminates
// that expected rejection from a real failure by reading `albums.duplicateBusy` at the moment the
// rejection is observed: the store's own `finally` always clears the flag before a genuine
// failure rethrows, so it can only still read true here for the synchronous re-entrant throw.
async function duplicateAlbum(): Promise<void> {
  menuOpen.value = false
  const name = album.value?.title ?? ''
  try {
    await albums.duplicateAlbum(albumId.value)
    // Target's own success copy (33b05636:PhotosAlbumDetail.vue:713-716) -- identical wording to
    // the smart-view sidebar's own duplicate toast, hence the shared key.
    toast.show(t('photosSvDuplicatedNameOpenCopy', { name }))
  } catch (e) {
    if (albums.duplicateBusy) return // a second click while the first is still in flight -- not a failure
    console.error('[album-detail] duplicateAlbum', e)
    // Target reuses the same "name already exists" copy the rename path shows for its own 409.
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosSvDuplicateFailed'))
  }
}

// Task 5 (Vue2 :736-743 runExportZip). GET+token navigation -- exportAlbumZipUrl (T2) is
// JWT-exempt via the query token, same shape as favorites.ts's own exportZip, so a plain
// navigation is enough here. Not the fetch+blob dance PhotosSmartViewDetail.vue's downloadZip
// uses: that endpoint is POST-only and not JWT-exempt, a different backend contract entirely --
// the target confirms this page's own contract is the simple GET one (:736-738's literal
// `window.location.href = photosService.exportAlbumZipUrl(...)`).
function downloadZip(): void {
  menuOpen.value = false
  window.location.href = service.photos.exportAlbumZipUrl(albumId.value)
  const n = album.value?.count ?? 0
  toast.show(t('photosSvPreparingZipNPhotos', { n: n.toLocaleString(localeTag.value) }))
}

// T6: same criterion as the Albums page's smart-view-create gating (Vue2 :226-229 threads it
// down as a prop; here both pages read the one settings store directly instead).
const smartViewDisabled = computed(() => settings.aiFeatures.smartview === false)

// T7 mounts the dialog this stub opens; the body lands there together with the write it makes.
const convertOpen = ref(false)
function openConvertModal(): void {
  if (smartViewDisabled.value) return
  menuOpen.value = false
  convertOpen.value = true
}

// Vue2 :721-743 closes the album detail, refetches both lists, then opens the new smart
// view's detail. Here the navigation does all of that: the source album no longer exists
// server-side, and the destination route loads the new smart view itself. No refetch, no
// nextTick dance -- Vue2 needed those because two mergeQuery calls in one tick raced over the
// same query snapshot, and New-UI has no query-based deep link here at all.
function onConverted(sv: SmartView): void {
  void router.push('/photos/smart-views/' + sv.id)
}

// ── Toolbar: bulk remove ──
async function removeSelected(): Promise<void> {
  if (!selected.value.size || removing.value) return
  removing.value = true
  const ids = Array.from(selected.value)
  try {
    await albums.removeAssetsFromAlbum(albumId.value, ids)
    selected.value.clear()
    toast.show(t('photosAlbumRemovedToast', { count: ids.length }))
  } catch (e) {
    console.error('[album-detail] removeSelected', e)
    toast.show(t('photosAlbumRemoveFailed'))
  } finally {
    removing.value = false
  }
}

// ── Delete album (the only action with a second confirmation) ──
async function doDelete(): Promise<void> {
  confirmDelete.value = false
  const name = album.value?.title ?? ''
  try {
    await albums.deleteAlbum(albumId.value)
    toast.show(t('photosAlbumDeletedToast', { name }))
    void router.push('/photos/albums')
  } catch (e) {
    console.error('[album-detail] deleteAlbum', e)
    toast.show(t('photosAlbumDeleteFailed'))
  }
}

// ── Sort dropdown ──
function pickSort(s: SortBy): void {
  sortBy.value = s
  sortMenuOpen.value = false
}

// ── PhotosLibraryPicker (T6) wiring ──
// SP15-P1-T9 · Step 0: with the component generalised, the write, the success/failure toasts and
// closing the panel belong to the caller (the component only picks photos). Behaviour is
// unchanged from before the refactor: the same addAssetsToAlbum, the same photosAlbumAddedToast
// (album name + count), the same photosAlbumAddFailed, closing on success only (a failure leaves
// the panel up so the user can retry), and the fetchAlbumAssets refresh that hung off `@added`.
//
// The String() here is load-bearing, not decoration: album assets come back from the API with
// numeric ids while timeline photos carry string ids, so without it the picker would stop
// recognising a single already-in photo. Asserted in this page's own test with a numeric fixture.
const pickerExistingIds = computed(
  () => new Set(albums.assetsOf(albumId.value).map((p) => String(p.id))),
)
// The label carries the selected count, so the caller passes a function rather than a fixed
// string (see deviation b in the component's header).
function pickerSubmitLabel(count: number): string {
  return t('photosAlbumPickerAdd', { count })
}
const pickerAdding = ref(false)
// Fix round 2 (coordinator review, Important): onPickerConfirm used to read `albumId.value`
// fresh at call time. If the picker was left open while the route's id moved to a *different,
// real* album, a confirm arriving after that point would silently write into the newly-viewed
// album instead of the one the user actually picked photos for. `pickerAlbumId` snapshots the id
// the moment the picker opens (see `openPicker()` below) so the write always targets the album
// the picker was opened for, never whatever `route.params.id` happens to be when the confirm
// resolves. The id watcher additionally closes the dialog (`pickerOpen.value = false`) on every
// id change, so in real usage the confirm button is gone by then anyway (PhotosLibraryPicker.vue
// gates its whole template on `v-if="open"`) — the snapshot is what keeps a synthetic/in-flight
// confirm harmless too, without having to block on `pickerOpen` itself (which is also flipped by
// unrelated tests that exercise this handler directly, without ever opening the dialog).
const pickerAlbumId = ref(albumId.value)
// Task 5 (Task 4 re-review fold-in): the id snapshot above pins the *write*, but the success
// toast's `{name}` used to read `album.value?.title` live at resolve time -- a computed that
// tracks whatever album the route currently points at, not the one the write actually landed on.
// After a navigation to a different, real album while the picker was open, the toast would name
// the *new* album while the write still landed on the *snapshotted* one (see `pickerAlbumId`'s own
// comment): two different albums, one confirm. Snapshotting the name alongside the id here keeps
// the toast and the write pointed at the same album, always.
const pickerAlbumName = ref(album.value?.title ?? '')
function openPicker(): void {
  pickerAlbumId.value = albumId.value
  pickerAlbumName.value = album.value?.title ?? ''
  pickerOpen.value = true
}
async function onPickerConfirm(ids: Array<string | number>): Promise<void> {
  if (pickerAdding.value) return
  pickerAdding.value = true
  const id = pickerAlbumId.value
  const name = pickerAlbumName.value
  try {
    await albums.addAssetsToAlbum(id, ids)
    toast.show(t('photosAlbumAddedToast', { count: ids.length, name }))
    pickerOpen.value = false
    void albums.fetchAlbumAssets(id)
  } catch (e) {
    console.error('[album-detail] addAssetsToAlbum', e)
    toast.show(t('photosAlbumAddFailed'))
  } finally {
    pickerAdding.value = false
  }
}

// ── PhotoLightbox (P2) wiring -- @delete + @add-to-album (T9: only wired at the lightbox; the
// edit toolbar's "Add photos" already has its own semantics, so "Add to album" isn't duplicated
// there) ──
// Following the same handling as P3's favorites view T8: the lightbox has already deleted at the
// real-asset level, so the album's reference to it must disappear too, achieved by re-fetching
// this album's asset list (not local filtering -- the store is the source of truth).
async function onLightboxDelete(assetId: string | number): Promise<void> {
  // Minor fix: timeline.deleteAssets deletes item-by-item, swallows a per-item failure, and
  // returns the real success count (src/photos/stores/timeline.ts:162-176) -- the original
  // implementation ignored the return value and always reported count:1, which happened to be
  // true here (single-item delete) but was the wrong semantics regardless; follows the same
  // batch-write pattern as PhotosFavorites.vue:52-57 in reading the return value, and uses the
  // same 4000ms duration (the default 1500ms is too short, per P3's own decision).
  const n = await timeline.deleteAssets([String(assetId)])
  toast.show(t('photosDeletedToast', { count: n }), 4000)
  void albums.fetchAlbumAssets(albumId.value)
}

// ── document-level listeners (close the ⋯ menu/sort menu on outside click, Esc for the delete
// confirm modal) ──
// Following the established pattern (T5/T6/T7/PhotoLightbox.vue): not using the template's
// @keydown.esc, since relying on real focus can miss cases.
function onDocMousedown(e: MouseEvent): void {
  if (menuOpen.value && morePopRef.value && !morePopRef.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
  if (sortMenuOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortMenuOpen.value = false
  }
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (confirmDelete.value) { confirmDelete.value = false; return }
  if (menuOpen.value) { menuOpen.value = false; return }
  if (sortMenuOpen.value) sortMenuOpen.value = false
}

// ── Lifecycle / watch (following Vue2 :257-280's three trigger points + the route watch the
// brief added) ──
// Minor 3 fix: the first asset fetch is moved from onMounted to fire directly during setup
// (not waiting for the onMounted callback) -- fetchAlbumAssets sets the isLoadingAssets flag
// synchronously (before the await), so moving it here means that flag is already true before
// the first render commits. Without this move: arriving from the album list page, the album is
// already loaded, album.value is immediately non-null, but isLoadingPhotos is still false on the
// first frame (the loading flag only gets set once onMounted finishes running), and
// photos.length is also 0 -> isAlbumEmpty evaluates true on the first frame, flashing "the album
// is empty" for one frame before flipping to the skeleton branch. fetchAlbumAssets has its own
// isLoadingAssets reentrancy guard, so calling it early is safe and won't duplicate the request.
void albums.fetchAlbumAssets(albumId.value)

onMounted(() => {
  if (!albums.albumsLoaded) void albums.fetchAlbums()
  void nextTick(() => drag.refresh())
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
  // T6: gates the more menu's "Convert to Smart Album" entry — in-flight dedup already lives
  // inside the store, so a concurrent call from the sidebar/another view is harmless.
  void settings.fetchAiFeatures()
})
onBeforeUnmount(() => {
  drag.destroy()
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})

// Task 4 fix round 2 (coordinator review): the invariant this watcher exists to hold is that
// any state scoped to "the album currently being viewed" must not survive an id change --
// `selected`/`titleEditing`/`titleDraft` were already reset on that basis; `edit` and
// `pickerOpen` are exactly the same kind of state and were missing from the list.
//
// Without this, two real bugs: (a) Minor -- leaving edit mode never happened on navigation, so
// switching from album 7 (mid-edit) to a different, perfectly valid album 8 dropped the user
// into edit mode on 8 without choosing it. (b) Important -- an *already-open* Add-photos picker
// survived the navigation (`PhotosLibraryPicker`'s `:open="pickerOpen"` has no `album` gate of
// its own, unlike the select bar's `v-if="edit && album"` a few lines down). Resetting
// `pickerOpen` here closes the dialog on every id change (matching what PhotosLibraryPicker.vue's
// own `v-if="open"` does -- a real user can no longer reach the confirm button once this fires);
// `onPickerConfirm`'s own `pickerAlbumId` snapshot (see its comment) is the belt-and-suspenders
// half, covering a confirm that is already in flight the instant this watcher runs.
watch(() => route.params.id, () => {
  selected.value.clear()
  // Minor fix (deliberately not reproducing a latent Vue2 bug -- this period's rule: match Vue2
  // visually, don't copy its logic bugs): Vue2's same-named watch
  // (PhotosAlbumDetail.vue:258-260) only re-fetches assets, never clears the title-editing state.
  // On the same component instance across a route switch (a hash jump to a different album,
  // no unmount/remount): rename album 7, switch to album 8 before committing, and
  // titleEditing/titleDraft carry album 7's draft name over onto album 8 -- a subsequent
  // blur/Enter would then commit that stray draft name to album 8. This is a real data-corruption
  // path, not a "minor detail", hence it's cleared here.
  titleEditing.value = false
  titleDraft.value = ''
  edit.value = false
  pickerOpen.value = false
  void albums.fetchAlbumAssets(albumId.value)
  void nextTick(() => drag.refresh())
})
watch([edit, sortBy], () => {
  void nextTick(() => drag.refresh())
})
// Review Important 2 fix: `gridRef` is only bound in the last of the three v-if branches
// (skeleton / empty / real grid) -- the skeleton and empty states are different elements, and
// Vue 3 gives each v-if branch its own implicit key so elements aren't reused, meaning gridRef is
// always null while either of those two renders (useAlbumDragSort.refresh() bails immediately
// when it sees a null container). None of the three original trigger points (onMounted /
// route.params.id watch / [edit,sortBy] watch) fire on "the moment the grid itself first appears"
// -- they're all hung off "state the user changed". Typical repro path: empty album -> enter
// edit mode (gridRef is still null here) -> add photos -> fetchAlbumAssets comes back non-empty
// -> the template switches to the real-grid branch for the first time and gridRef gets its first
// value -> but no watch fires at that moment, Sortable never gets created, and drag silently
// stops working. This adds a watch keyed on the container itself specifically to cover that
// trigger point.
watch(gridRef, () => {
  void nextTick(() => drag.refresh())
})
</script>

<template>
  <AreaShell :title="album ? album.title : t('photosAlbumsTitle')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Task 9 (closing out a P4 leftover): the failure state is gated ahead of the skeleton
             branch -- once loadError is true, albumsLoaded is still false (deliberate, see the
             albums.ts comment), so it should no longer fall through to the skeleton branch and
             show "Loading" forever. -->
        <div v-if="albums.loadError" class="empty-state" data-test="album-load-error">
          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="album-retry"
            :disabled="retryingAlbums"
            @click="retryAlbums"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- Not loaded yet: skeleton -->
        <!-- SP15-P2c Task 3: the placeholder used to be a 260px hero-shaped block. With the hero
             gone it stands in for the detail bar + header instead, which is what actually
             arrives when the album lands. -->
        <div v-else-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
          <div class="album-skel-bar"></div>
          <div class="album-skel-header"></div>
        </div>

        <!-- Loaded, and genuinely doesn't exist: a New-UI gap-fill -->
        <div v-else-if="notFound" class="empty-state" data-test="album-not-found">
          <div class="empty-state-title">{{ t('photosAlbumNotFoundTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosAlbumNotFoundHint') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="album-not-found-back"
            @click="goToAlbumsList"
          >{{ t('photosAlbumBack') }}</button>
        </div>

        <template v-else-if="album">
          <!-- SP15-P2c Task 3 (Vue2 33b05636:PhotosAlbumDetail.vue:5-11): the same top bar the
               smart-view/moment detail pages carry -- back on the left, the creation date on the
               right. The date span does not render at all when createdLabel is the placeholder. -->
          <div class="sv-detail-bar">
            <button type="button" class="back" data-test="album-back" @click="goToAlbumsList">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
              {{ t('photosAlbumBack') }}
            </button>
            <div class="sv-detail-bar-spacer"></div>
            <span v-if="createdLabel !== DASH" class="sv-detail-created" data-test="album-created">
              {{ t('photosDetailCreatedAt', { date: createdLabel }) }}
            </span>
          </div>

          <!-- Two-column skeleton (Vue2 :20-21), the same one PhotosSmartViewDetail.vue uses:
               the main column holds the header and the grid and scrolls as one, the sidebar
               scrolls on its own. The old .album-toolbar band and .album-detail-body wrapper are
               both gone -- the band's "{n} items shown" repeated the header stats verbatim, and
               the body's two-column job is done by .sv-detail-layout. -->
          <div class="sv-detail-layout">
            <div class="sv-detail-main">
              <div class="sv-header">
                <div class="sv-header-text">
                  <h1>
                    <span
                      v-if="!titleEditing"
                      class="sv-title"
                      data-test="album-title"
                      :title="t('photosAlbumClickToRename')"
                      @click="startTitleEdit"
                    >{{ album.title }}</span>
                    <input
                      v-else
                      ref="titleInputRef"
                      v-model="titleDraft"
                      class="sv-title-input"
                      data-test="album-title-input"
                      @keydown.enter.prevent="commitTitle"
                      @keydown.esc.prevent="cancelTitleEdit"
                      @blur="commitTitle"
                    >
                    <!-- Vue2 :67: the date range rides the h1 row as a flex sibling of the
                         title, not a chips row of its own (that row held only this pill and the
                         type badge, and both left). -->
                    <span v-if="album.dateRange" class="sv-cond" data-test="album-date-pill">{{ album.dateRange }}</span>
                  </h1>
                  <div class="sv-header-stats">
                    <span data-test="album-header-items"><b>{{ album.count.toLocaleString(localeTag) }}</b> {{ t('photosDetailItems') }}</span>
                    <span v-if="album.videoCount > 0" data-test="album-header-videos"><b>{{ album.videoCount.toLocaleString(localeTag) }}</b> {{ t('photosDetailVideos') }}</span>
                  </div>
                </div>

                <!-- Vue2 :80-121: Sort pill -> separator -> Edit/Done -> separator -> density.
                     Sort and density render outside edit mode only (the old toolbar band drew
                     the same distinction); Edit/Done is always there, and in edit mode it is the
                     only one of the three still rendered. Each separator comes along with the
                     group next to it, so neither is ever left dangling. -->
                <div class="sv-actions">
                  <template v-if="!edit">
                    <span class="group">{{ t('photosAlbumSort') }}</span>
                    <div ref="sortMenuRef" class="album-sort-wrap">
                      <button
                        type="button"
                        class="order-pill"
                        data-test="album-sort-btn"
                        @click.stop="sortMenuOpen = !sortMenuOpen"
                      >
                        {{ currentSortLabel }}
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </button>
                      <div v-if="sortMenuOpen" class="album-sort-menu" data-test="album-sort-menu">
                        <!-- Task 11 (b): the target (PhotosAlbumDetail.vue:88-101) marks the active
                             option with a check glyph and keeps every label at the same x with a
                             same-width empty spacer on the inactive rows. This page used to render a
                             bare label with only the data-active background, which left it visibly
                             out of step with the smart-view page's identical dropdown. -->
                        <button
                          v-for="s in sortOptions" :key="s.id"
                          type="button"
                          class="album-sort-item"
                          data-test="album-sort-item"
                          :data-sort-id="s.id"
                          :data-active="s.id === sortBy"
                          @click="pickSort(s.id)"
                        >
                          <svg v-if="s.id === sortBy" class="album-sort-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                          <span v-else class="album-sort-check" />
                          <span class="lbl">{{ s.label }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="album-detail-actions-sep"></div>
                  </template>
                  <button
                    type="button"
                    class="sv-action-btn"
                    data-test="album-edit-toggle"
                    :data-open="edit"
                    @click="toggleEditMode"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                    {{ edit ? t('photosAlbumDone') : t('photosAlbumEdit') }}
                  </button>
                  <template v-if="!edit">
                    <div class="album-detail-actions-sep"></div>
                    <!-- Density keeps New-UI's own enum values ('comfortable'/'compact'); Vue2
                         spells the first one 'comfort'. That name is never visible, and changing
                         it would churn this page's existing tests for no visual gain. -->
                    <div class="density">
                      <button
                        type="button"
                        :data-active="density === 'comfortable'"
                        :title="t('photosDensityComfortable')"
                        @click="density = 'comfortable'"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
                      </button>
                      <button
                        type="button"
                        :data-active="density === 'compact'"
                        :title="t('photosDensityCompact')"
                        @click="density = 'compact'"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /><rect x="3" y="19" width="6" height="2" /><rect x="11" y="19" width="6" height="2" /></svg>
                      </button>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Grid. E5 re-anchor: the edit flag used to live on the deleted .album-toolbar,
                   with two rules reaching the tiles through a sibling combinator. The target
                   (Vue2 :124) marks the grid container itself, so those two rules are now plain
                   descendant selectors on this element -- see the style block. -->
              <div class="album-photos-wrap" :data-edit="edit">
              <div v-if="isLoadingPhotos && photos.length === 0" class="album-photo-grid" :class="{ 'is-compact': density === 'compact' }">
                <div v-for="i in 6" :key="'sk' + i" class="tile album-tile-skeleton"></div>
              </div>
              <div v-else-if="isAlbumEmpty" class="empty-state" data-test="album-empty">
                <div class="empty-state-title">{{ t('photosAlbumEmptyTitle') }}</div>
                <div class="empty-state-desc">{{ t('photosAlbumEmptyHint') }}</div>
              </div>
              <div v-else ref="gridRef" class="album-photo-grid" :class="{ 'is-compact': density === 'compact' }">
                <div
                  v-for="p in photos" :key="p.id"
                  class="tile"
                  :data-id="p.id"
                  :data-cover="isCover(p)"
                  :data-selected="edit && isSelected(p)"
                  :title="tileHintTitle"
                  @click="onTileClick(p)"
                  @contextmenu.prevent="setCover(p)"
                >
                  <img :src="thumbnailUrl(p.id, 'small')" alt="" loading="lazy">
                  <button
                    type="button"
                    class="tile-cover-btn"
                    :data-on="isCover(p)"
                    :title="isCover(p) ? t('photosAlbumCurrentCover') : t('photosAlbumSetCover')"
                    @click.stop="setCover(p)"
                  >★</button>
                  <div v-if="edit" class="tile-select-check" :data-checked="isSelected(p)">
                    <span v-if="isSelected(p)">✓</span>
                  </div>
                </div>
              </div>
              </div>
            </div>

            <!-- T6: stats rail, ported from Vue2 :101-134. Aligns this page with the smart-view
                 detail page's own sidebar (PhotosMomentDetail.vue), so the two detail pages stop
                 looking like different products. -->
            <aside class="sv-detail-side" data-test="album-side">
              <!-- Task 5 (Vue2 33b05636:PhotosAlbumDetail.vue :211-283). The "..." menu's target
                   home -- moved here from the header's .sv-actions, where Task 3 parked it
                   unchanged (mounting it in this overflow-y:auto sidebar before the fixed-position
                   composable existed would have reproduced the exact clipping bug that composable
                   fixes). New-UI never carries a Slideshow button here (the target has one; Vue2's
                   own version only ever popped a "coming soon" toast, and this repo never built the
                   tile-fullscreen player it would open), so this container holds a single child --
                   still flex-wrap to match the target's own .sv-side-actions shape (Vue2
                   photos-smartview.scss, restated below since scoped styles don't cross SFCs in
                   this repo).
                   The five entries are the target's full set, in its order (not reorderable):
                   Rename/Duplicate/Download as ZIP/Convert/Delete. Main titles are shortened per
                   #117 (Rename album -> Rename, Convert to Smart Album -> Convert, Delete album ->
                   Delete); desc lines keep the longer copy that disambiguates context. The menu
                   itself is position:fixed via `menuStyle` (T1's useFixedMenuPosition bound to
                   `moreBtnRef`'s rect) so it no longer clips against this aside's own
                   overflow-y:auto; `morePopRef` still wraps both the button and the menu for
                   click-outside dismissal (onDocMousedown below) -- the composable only computes
                   coordinates, it does not touch open/close. -->
              <div class="sv-side-actions">
                <div ref="morePopRef" class="album-more-wrap">
                  <button
                    ref="moreBtnRef"
                    type="button"
                    class="sv-action-btn sv-action-btn-icon"
                    data-test="album-more-btn"
                    :data-open="menuOpen"
                    @click="menuOpen = !menuOpen"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </button>
                  <!-- Whole-branch review, Important 4: the target wraps this menu in
                       <transition name="sv-menu"> too (33b05636 PhotosAlbumDetail.vue:223/:278),
                       exactly as PhotosSmartViewDetail.vue's copy does. This page rendered it
                       bare for the whole phase, so the two otherwise-identical menus animated
                       differently. The two .sv-menu-* rules are duplicated into this file's
                       scoped style block (below) because scoped styles do not cross files. -->
                  <Transition name="sv-menu">
                  <div v-if="menuOpen" class="sv-export-menu sv-more-menu" data-test="album-menu" :style="menuStyle">
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-rename"
                      @click="menuOpen = false; startTitleEdit()"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></div>
                      <div>
                        <!-- Reuses PhotosSmartViewDetail.vue's own short "Rename" key -- same
                             product copy, and it already carries the exact target string. -->
                        <div class="sv-export-title">{{ t('photosSvRename') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumRenameHint') }}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-duplicate"
                      @click="duplicateAlbum"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></div>
                      <div>
                        <!-- Same reuse: PhotosSmartViewDetail.vue's own short "Duplicate" key. -->
                        <div class="sv-export-title">{{ t('photosSvDuplicate') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumDuplicateHint') }}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-zip"
                      @click="downloadZip"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></div>
                      <div>
                        <!-- photosFavExport is the favourites page's own "Download as ZIP" title
                             -- identical target copy, reused rather than coining a near-synonym.
                             The desc's {n}/{mb} interpolation (photosSvNPhotosMbMb) is the exact
                             key PhotosSmartViewDetail.vue's own zip entry already uses; 3.2 is
                             Vue2's own hard-coded MB-per-photo estimate (33b05636 :266), not a
                             measured figure -- registered here as it was there. -->
                        <div class="sv-export-title">{{ t('photosFavExport') }}</div>
                        <div class="sv-export-desc">{{ t('photosSvNPhotosMbMb', { n: album.count.toLocaleString(localeTag), mb: Math.round(album.count * 3.2).toLocaleString(localeTag) }) }}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-convert"
                      :disabled="smartViewDisabled"
                      :title="smartViewDisabled ? t('photosSvSmartViewsOffCreateHint') : undefined"
                      @click="openConvertModal"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.9L19 9l-4.9 1.8L12 16l-1.8-5.2L5 9l5.2-1.1L12 3zM19 15l.9 2.5L22 18l-2.5.9L19 21l-.9-2.5L16 18l2.5-.9L19 15z" /></svg></div>
                      <div>
                        <div class="sv-export-title">{{ t('photosAlbumMenuConvert') }}</div>
                        <!-- Whole-branch review, Important 2: the menu entry's desc is the
                             target's :266 string, not the convert modal's :375 subtitle -- the
                             two were collapsed onto one key for the whole phase. -->
                        <div class="sv-export-desc">{{ t('photosAlbumMenuConvertHint') }}</div>
                      </div>
                    </button>
                    <div class="sv-export-sep"></div>
                    <button
                      type="button"
                      class="sv-export-item sv-export-item-danger"
                      data-test="album-menu-delete"
                      @click="askConfirmDelete"
                    >
                      <div class="sv-export-icon sv-export-icon-danger" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
                      <div>
                        <!-- Reuses the generic photosDelete key ("Delete") already used by
                             PhotosMomentDetail.vue's and PhotosSmartViewDetail.vue's own confirm/
                             selection-toolbar buttons -- the long-form "Delete album" stays at
                             photosAlbumDelete, still alive via this page's own confirm-modal
                             button (below), so it is not orphaned by this change. -->
                        <div class="sv-export-title">{{ t('photosDelete') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumDeleteHint') }}</div>
                      </div>
                    </button>
                  </div>
                  </Transition>
                </div>
              </div>

              <!-- Task 4 (Vue2 :283-290). About — Type/Created/Time span/Place, same
                   mo-about-row idiom as PhotosMomentDetail.vue's own About section. Type/Created/
                   Place reuse existing keys verbatim (photosAlbumLabel/photosAlbumStatCreated/
                   photosMoPlace already carry the exact Chinese the Vue2 target uses for these
                   labels); only "Time span" is new — PhotosMomentDetail's own About row calls its
                   third field "Time" (photosMoTime), a different label for a different thing. -->
              <div class="sv-side-section" data-test="album-about">
                <h3>{{ t('photosMoAbout') }}</h3>
                <div class="mo-about-row" data-test="album-about-type"><span>{{ t('photosMoType') }}</span><b>{{ t('photosAlbumLabel') }}</b></div>
                <div class="mo-about-row" data-test="album-about-created"><span>{{ t('photosAlbumStatCreated') }}</span><b>{{ createdLabel }}</b></div>
                <div class="mo-about-row" data-test="album-about-timespan"><span>{{ t('photosDetailTimeSpan') }}</span><b>{{ timeSpanLabel }}</b></div>
                <div class="mo-about-row" data-test="album-about-place"><span>{{ t('photosMoPlace') }}</span><b :title="placesTitle">{{ placesLabel }}</b></div>
              </div>

              <!-- Task 4 (Vue2 :292-309). Stats — trimmed from 4 cells to 2: Span/Created are the
                   exact same data as the two About rows just above (duplicated, not a distinct
                   metric), so the target drops them and keeps only Photos/Videos. -->
              <div class="sv-side-section">
                <h3>{{ t('photosMoStats') }}</h3>
                <div class="sv-stat-grid">
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ album.count.toLocaleString(localeTag) }}</div>
                    <div class="l">{{ t('photosMoPhotos') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ videoCountLabel }}</div>
                    <div class="l">{{ t('photosAlbumStatVideos') }}</div>
                  </div>
                </div>
              </div>
              <!-- By month: absent entirely when nothing carries a takenAt. Vue2 has exactly
                   this histogram behind exactly this gate (939a7d3a:PhotosAlbumDetail.vue
                   :218-224, `v-if="monthBuckets.length"`); the earlier comment here claiming
                   otherwise was wrong. PhotosMomentDetail.vue carries the same gate, which is
                   where the restated rule bodies below come from. -->
              <div v-if="monthBuckets.length" class="sv-side-section" data-test="album-dist">
                <h3>{{ t('photosMoByMonth') }}</h3>
                <div class="sv-distribution">
                  <div
                    v-for="(b, i) in monthBuckets" :key="b.key" class="sv-dist-bar"
                    data-test="album-dist-bar" :style="distStyle(b, i)" :title="b.label + ' · ' + b.count"
                  />
                </div>
                <div class="sv-dist-x">
                  <span>{{ monthBuckets[0].label }}</span>
                  <span>{{ monthBuckets[monthBuckets.length - 1].label }}</span>
                </div>
              </div>
            </aside>
          </div>
        </template>
      </main>
    </div>

    <!-- Edit-mode select bar (Vue2 :322-343). This is where the deleted toolbar band's two edit
         buttons live now, plus the hint line the band also carried. Deviation from the plan's
         prose, registered: it renders on `edit` alone, not only once something is selected --
         the target says so explicitly at :326 and has to, because the hint copy only ever shows
         with an empty selection and Add photos would otherwise be unreachable in an empty album.
         The bar is a sibling of .photos-layout, as on PhotosSmartViewDetail.vue (:871): it is
         position:fixed, so nesting it inside the scrolling column would buy nothing.

         Task 4 fold-in fix: this container used to live inside the `v-else-if="album"` branch
         above (before the P2c skeleton rebuild pulled it out to be a fixed-position sibling), so
         it inherited "no album -> not rendered" for free. Gating on `edit` alone lost that: at the
         time this was written, the route-id watcher cleared `selected`/the title draft but never
         reset `edit`, so navigating from an album in edit mode to a missing id left this bar
         floating over the "Album not found" screen with Add photos still reachable.
         `edit && album` restores the original invariant directly (this is what the condition
         actually depends on) rather than indirectly through a watcher, so it also covers the case
         where `album` disappears without a route change (e.g. a concurrent fetchAlbums no longer
         finds it) -- a watcher on route.params.id alone would miss that.

         Fix round 2 (coordinator review): the watcher below now also resets `edit` on every id
         change (not just a missing one), closing the sibling Minor finding -- edit mode used to
         survive navigating between two perfectly valid albums. The two fixes are complementary,
         not redundant: the watcher handles "the id changed", this `&& album` guard handles
         "the album vanished without the id changing". -->
    <div v-if="edit && album" class="sv-select-bar">
      <span class="group">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        {{ editHintText }}
      </span>
      <button
        type="button"
        class="sv-action-btn"
        data-test="album-remove-selected"
        :disabled="!selected.size || removing"
        @click="removeSelected"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        {{ t('photosAlbumRemoveFrom') }}
      </button>
      <button
        type="button"
        class="sv-action-btn"
        data-test="album-add-photos"
        @click="openPicker"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
        {{ t('photosAlbumAddPhotos') }}
      </button>
    </div>
  </AreaShell>

  <!-- Delete album confirmation modal (the only action with a second confirmation) -->
  <div
    v-if="confirmDelete"
    class="album-confirm-scrim"
    data-test="album-delete-confirm"
    @click.self="confirmDelete = false"
  >
    <div class="album-confirm">
      <div class="album-confirm-title">{{ t('photosAlbumDeleteTitle', { name: album?.title ?? '' }) }}</div>
      <div class="album-confirm-body">{{ t('photosAlbumDeleteBody', { count: album?.count ?? 0 }) }}</div>
      <div class="album-confirm-foot">
        <button type="button" class="album-confirm-cancel" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
        <button type="button" class="album-confirm-ok" data-test="album-delete-confirm-btn" @click="doDelete">
          {{ t('photosAlbumDelete') }}
        </button>
      </div>
    </div>
  </div>

  <PhotosLibraryPicker
    :open="pickerOpen"
    :title="t('photosAlbumPickerTitle', { name: album?.title ?? '' })"
    :existing-ids="pickerExistingIds"
    :existing-label="t('photosAlbumPickerAlready')"
    :submit-label="pickerSubmitLabel"
    :submitting="pickerAdding"
    @update:open="pickerOpen = $event"
    @confirm="onPickerConfirm"
  />

  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />

  <AlbumConvertToSmartDialog
    v-if="album"
    :open="convertOpen"
    :album-id="album.id"
    :album-name="album.title"
    :album-count="album.count"
    @update:open="convertOpen = $event"
    @converted="onConverted"
  />
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

/* height (not min-height): this screen is capped, only the inner scroll container scrolls --
   same-source fix; see the comment at the same rule in src/views/Photos.vue for the Vue2
   origin. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; max-width: 340px; }
.empty-state .bar-btn { margin-top: 10px; }

/* ── SP15-P2c Task 3: loading placeholder ──
   The 260px cover hero it used to imitate is gone; it now stands in for the detail bar and the
   header, which is what the album actually renders on arrival. */
.album-loading { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.album-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.album-skel-header { height: 90px; border-radius: 12px; background: var(--skeleton-bg); }

/* ── SP15-P2c Task 3: detail bar / two-column skeleton / header / action row ──
   Rule bodies restated from PhotosSmartViewDetail.vue's own (:968-1019, :1164-1176) and from
   Vue2 photos-smartview.scss (:261-274 the bar, :325-334 the header, :372 the h1 pill,
   :409-432 stats/separator/actions) + photos.scss (:285-288 density, :3458-3475 .group and
   .order-pill). Scoped styles do not cross SFCs in this repo, so this is the same
   KEEP-THE-DUPLICATION ruling P2b made, not a missed extraction. */
.sv-detail-bar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--divider); flex: 0 0 auto; }
.sv-detail-bar .back {
  display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px;
  border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 12px; cursor: pointer;
}
.sv-detail-bar .back:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-detail-bar-spacer { flex: 1; }
.sv-detail-created { font-size: 12px; color: var(--fg-muted); }

.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }

.sv-header { padding: 24px 32px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.sv-header-text { flex: 1; min-width: 0; }
/* Vue2 :329-334 also sets `font-family: var(--font-display)`. That token does not exist in this
   repo (registered in P1), so the h1 keeps the app font and only the size/weight/tracking
   travel over. */
.sv-header h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; display: flex; align-items: center; gap: 10px; }
.sv-title { cursor: text; color: var(--fg); }
/* Vue2 writes this inline on the input (:56). Everything there is reproduced except the
   `font-family: var(--font-display)` (see above); the colours go through tokens instead of the
   inline literals. */
.sv-title-input {
  background: var(--chip-bg); border: 1px solid var(--accent); border-radius: 8px;
  padding: 2px 10px; color: var(--fg); font: inherit; font-size: 28px; font-weight: 600;
  letter-spacing: -0.02em; outline: none; min-width: 300px;
}
/* Vue2 photos-smartview.scss:81-87 (base .sv-cond) with :372's h1-row size bump folded in --
   the pill only ever appears on the h1 row here, so the two layers collapse into one rule, the
   same shape AlbumConvertToSmartDialog.vue:310 already uses for this chip. Vue2's --surface-3
   maps to --chip-bg here to stay with the two .sv-cond restatements this repo already ships
   (that one and MomentCard.vue:213). Weight and tracking are deliberately NOT reset: in Vue2 the
   pill inherits the h1's 600 / -0.02em, and resetting them would be a visible deviation. */
.sv-header h1 .sv-cond {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px;
  background: var(--chip-bg); color: var(--fg-muted); font-size: 11.5px;
}
.sv-header-stats { display: flex; gap: 20px; font-size: 12px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.sv-header-stats b { color: var(--fg); font-weight: 600; }

.sv-actions { display: flex; gap: 8px; align-items: center; }
.sv-action-btn {
  height: 32px; padding: 0 12px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
}
.sv-action-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.sv-action-btn[data-open="true"] { box-shadow: 0 0 0 2px var(--accent-soft); }
/* Task 5: icon-only modifier for the sidebar's "..." toggle -- rule body restated from
   PhotosSmartViewDetail.vue's own .sv-action-btn-icon (:1018) because scoped styles don't cross
   SFCs in this repo. */
.sv-action-btn-icon { padding: 0 10px; min-width: 32px; justify-content: center; }

.group { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.sv-actions .order-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
  font: inherit; font-size: 12px; cursor: pointer;
}
.sv-actions .order-pill:hover { background: var(--chip-bg-hi); color: var(--fg); }
.album-detail-actions-sep { width: 1px; height: 18px; background: var(--divider); flex-shrink: 0; }

/* Vue2 photos.scss:285-288. Replaces the pill-shaped .album-density this page carried while the
   controls lived on the toolbar band. */
.density { display: inline-flex; gap: 2px; background: var(--chip-bg); border-radius: 8px; padding: 3px; }
.density button {
  width: 28px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 5px; background: transparent; color: var(--fg-muted); cursor: pointer;
}
.density button:hover { color: var(--fg); }
.density button[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); }

/* Task 5: the sidebar's top action row -- rule body restated from Vue2 photos-smartview.scss's
   own `.sv-side-actions` (flex-wrap so a narrow sidebar can still fit multiple buttons on their
   own line each; this page only ever renders one, see the template comment on this container).
   margin-bottom keeps the same 24px rhythm as .sv-side-section below it. */
.sv-side-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.album-more-wrap { position: relative; }

/* Whole-branch review, Important 4: the target wraps this page's "..." menu in
   `transition name="sv-menu"` (33b05636 PhotosAlbumDetail.vue:223/:278), rules in
   photos-smartview.scss:454-455 (opacity 0.14s + translateY(-4px) scale(0.97)).
   Same two rules PhotosSmartViewDetail.vue carries; scoped styles do not cross files, so the
   pair is repeated rather than shared. Vue 3 spells the start state `-enter-from`
   (Vue 2's `-enter`). */
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── T6: more menu reshaped to the sv-export-item idiom -- rule bodies restated from
   PhotosSmartViewDetail.vue's (:937-960) because scoped styles do not cross SFCs in this repo.
   Not a byte-for-byte copy of that block: the `:disabled` rules below are additions this page
   needs, and the final fix wave restored the `.sv-more-menu` width modifier that the original
   restatement dropped. Replaces the old two-item .album-more-item* rules (removed: this page
   no longer has any element with that class). Vue2 expresses the danger row with an inline
   coral color literal; this repo already has the -danger classes below walking the --remove-fg
   token instead, so the literal is never reproduced. ── */
.sv-export-menu {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 280px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 6px;
  box-shadow: var(--card-shadow-hi); z-index: 50; display: flex; flex-direction: column; gap: 1px;
}
/* The only menu this page has is the more menu, so the base 280px above is never used on its
   own -- restated all the same, so the block stays a faithful copy of the sibling's rule set
   and a future export menu here inherits the right width. */
.sv-more-menu { min-width: 220px; }
.sv-export-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; background: transparent; border: 0;
  border-radius: 8px; color: var(--fg); text-align: left; cursor: pointer; font: inherit; width: 100%;
}
/* :not(:disabled) -- CSS applies :hover to disabled buttons too, so without it the greyed-out
   Convert row still lit up under the cursor and read as clickable. */
.sv-export-item:hover:not(:disabled) { background: var(--chip-bg-hi); }
/* Not present in PhotosSmartViewDetail.vue's own copy of this rule set (none of its menu items
   are ever disabled) -- added here because the Convert entry is disabled when Smart Views are
   off. Same treatment this file already gives .bar-btn:disabled above. */
.sv-export-item:disabled { opacity: 0.45; cursor: not-allowed; }
.sv-export-icon {
  width: 28px; height: 28px; border-radius: 7px; background: var(--accent-soft); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.sv-export-title { font-size: 12.5px; font-weight: 500; line-height: 1.2; }
.sv-export-desc { font-size: 11px; color: var(--fg-muted); margin-top: 3px; line-height: 1.35; }
.sv-export-sep { height: 1px; margin: 4px 6px; background: var(--divider); }
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--remove-fg); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg); }
/* Compound selector (0,3,0) beats the base .sv-export-item:hover's (0,2,0) structurally, not by
   source order -- same fix PhotosSmartViewDetail.vue applies at its own copy of this rule. */
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); }

/* ── Sort dropdown ── */
/* .bar-btn (theme.css:308) sets background and color explicitly, which overrides the browser's
   default dimming of a disabled button -- same wording PhotosTrash.vue:341 carries.
   SP15-P2c Task 3: the edit-mode buttons this was written for now wear .sv-action-btn (which has
   its own :disabled rule above); the .bar-btn left on this page are the not-found / load-error
   branches, and the rule stays for them. */
.bar-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
/* Sort popup. Vue2 photos.scss:3122-3153 (.albums-sort-menu / .albums-sort-item), the same source
   PhotosSmartViewDetail.vue's .sv-sort-menu restates -- the rule bodies are duplicated rather than
   shared because scoped styles do not cross SFCs in this repo (the KEEP-THE-DUPLICATION ruling from
   P2b). Task 11 (a): min-width is the target's 240px, not the 180px this page carried.
   `.album-sort-check` is the fixed-width slot the check glyph sits in; it renders as an empty span
   on the inactive rows, which is how the target keeps every label at the same x (its own version
   writes style="width:12px;display:inline-block" inline). Vue2 tints the glyph with --accent-hi,
   a token this repo does not have; --accent-text is the pair used against --accent-soft here. */
.album-sort-wrap { position: relative; }
.album-sort-menu {
  position: absolute; top: calc(100% + 4px); right: 0; min-width: 240px; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.album-sort-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 8px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.album-sort-item:hover { background: var(--chip-bg-hi); }
.album-sort-item[data-active="true"] { background: var(--accent-soft); }
.album-sort-item .album-sort-check { width: 12px; flex-shrink: 0; color: var(--accent-text); }
.album-sort-item .lbl { display: block; font-weight: 500; }

/* ── SP15-P2c Task 3: edit-mode select bar ──
   Same bar as PhotosSmartViewDetail.vue's `.sv-select-bar` (:1138-1144) -- the rule bodies are
   restated here rather than shared because scoped styles do not cross SFCs in this repo (the
   KEEP-THE-DUPLICATION ruling from P2b). Vue2 photos-smartview.scss:623-641 is the common
   source; its literal drop shadow and blur go through --card-shadow-hi / --blur. */
.sv-select-bar {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 150;
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 14px;
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur);
}
/* Vue2 :639-641 sizes the bar's own label; here that label is the `.group` hint line, which the
   base .group rule already colours. */
.sv-select-bar .group { font-size: 13px; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

/* ── Grid (column count following Vue2 photos.scss :3629-3691: comfortable=6 columns,
   compact=9 columns) ── */
/* SP15-P2c Task 3: no scroll container of its own any more -- .sv-detail-main scrolls the header
   and the grid together (Vue2 photos.scss:3486-3489), and two nested scrollers would put two
   scrollbars side by side. Padding matches the header's 32px gutter. */
.album-photos-wrap { min-width: 0; padding: 16px 32px 0; }
.album-photo-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.album-photo-grid.is-compact { grid-template-columns: repeat(9, 1fr); }
.tile { aspect-ratio: 1; position: relative; border-radius: 3px; overflow: hidden; background: var(--chip-bg); cursor: pointer; }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
.tile:hover img { transform: scale(1.04); }
.album-tile-skeleton { background: var(--skeleton-bg); }

/* T4's useAlbumDragSort ghostClass (the sortablejs drag placeholder element). Vue2's original
   value was rgba 137/80/242 with a 0.15-alpha fill + 0.6-alpha dashed outline -> replaced with
   color-mix(accent) so no color literal is hard-coded. */
.tile-drag-ghost {
  opacity: 0.4;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  outline: 1px dashed color-mix(in srgb, var(--accent) 60%, transparent);
  outline-offset: -1px;
}

/* ★ Cover badge: Vue2's original color value was rgba 110/91/255 at alpha .85 -> replaced with
   color-mix(accent 85% + transparent). Hidden in edit mode (it shares the top-left corner with
   the multi-select check circle, and the check circle takes priority — same as Vue2 :3743-3745). */
/* Minor fill-in (Vue2 photos.scss:3649-3652): the current cover tile gets a solid accent outline, to set it apart from the other tiles. */
.tile[data-cover="true"] { outline: 2px solid var(--accent); outline-offset: -2px; }
.tile[data-cover="true"]::after {
  content: "★ Cover"; position: absolute; top: 6px; left: 6px; z-index: 2; pointer-events: none;
  padding: 2px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  border-radius: 999px; color: var(--on-accent);
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  backdrop-filter: var(--blur);
}
/* Aligned with Vue2 photos.scss:3743-3745: in edit mode EVERY tile's "★ Cover" badge gives way
   to the multi-select check (both sit top-left), not only the tile that happens to be selected.
   Hence a rule that hits the whole grid rather than one keyed on a tile's own data-selected --
   the latter would leave the badge showing on an as-yet-unselected cover tile, overlapping the
   check.
   SP15-P2c Task 3 (E5 re-anchor): this rule and the one below used to hang off
   `.album-toolbar[data-edit="true"] ~ .album-detail-body`. Both of those containers are gone,
   which would have silently killed both rules -- no gate in this repo can see a selector that
   stopped matching. The target's answer (Vue2 photos.scss:3546, :3604) is to mark the grid
   container itself, so they are plain descendant selectors on .album-photos-wrap now. */
.album-photos-wrap[data-edit="true"] .tile[data-cover="true"]::after { display: none; }
/* Minor fill-in (Vue2 photos.scss:3685-3688): in edit mode each tile gets a dashed outline,
   hinting "selectable/draggable". Vue2's original token `--line-strong` doesn't exist in either
   of this repo's theme.css theme blocks (it was only ever defined locally in Vue2's own
   AI/Agent/tokens.scss, not as a global token) — swapped for this repo's existing, semantically
   equivalent --card-border (dedicated to card/tile outlines, defined in both themes), without
   adding a new token. */
.album-photos-wrap[data-edit="true"] .tile { outline: 1px dashed var(--card-border); outline-offset: -1px; }

/* Cover star button: Vue2's original background was rgba 0/0/0 at alpha .55 -> --overlay-bg;
   the glyph color is the theme-exception below (review Critical 1 fix: pinned to #fff instead of
   --on-accent, see the comment on that line for why). */
.tile-cover-btn {
  position: absolute; top: 6px; right: 6px; z-index: 3; width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; border: 0;
  background: var(--overlay-bg); opacity: 0; transform: scale(0.85);
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease; cursor: pointer; font-size: 11px;
  /* theme-exception: the background is normally --overlay-bg (a fixed dark backing that darkens
     the cover), switching to a solid --accent background only on hover/data-on — the star glyph
     needs a fixed, legible light color under both backgrounds, and can't use --on-accent (in the
     default dark theme it resolves to a deep, dark tone that becomes illegible on top of
     --overlay-bg — review Critical 1 fix). */
  color: #fff;
}
.tile:hover .tile-cover-btn { opacity: 1; transform: scale(1); }
.tile-cover-btn:hover { background: var(--accent); }
.tile-cover-btn[data-on="true"] { opacity: 1; transform: scale(1); background: var(--accent); }

.tile-select-check {
  position: absolute; top: 6px; left: 6px; z-index: 4; width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; background: var(--overlay-bg);
  border: 1.5px solid var(--card-border); color: var(--on-accent); font-size: 11px;
}
.tile[data-selected="true"] .tile-select-check { background: var(--accent); border-color: var(--accent); }

/* ── delete album confirmation modal ── */
.album-confirm-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 32px 20px;
}
/* P2/P3 hard-won lesson (the brief explicitly calls this out): the modal background must use
   --popup-bg, not --card-bg (under the dark theme --card-bg is nearly transparent, and stacking
   it on a dark backing lets it show through). */
.album-confirm {
  width: min(380px, 100%); background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 22px;
}
.album-confirm-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.album-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.album-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.album-confirm-cancel, .album-confirm-ok {
  padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg);
  color: var(--fg); font: inherit; font-size: 13px; cursor: pointer;
}
.album-confirm-cancel:hover { background: var(--chip-bg-hi); }
.album-confirm-ok {
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent); color: var(--remove-fg);
}
.album-confirm-ok:hover { background: color-mix(in srgb, var(--remove-fg) 16%, transparent); }

/* ── T6 stats rail: rule bodies identical to PhotosMomentDetail.vue:1059-1090's
   .sv-side-section, .sv-stat-*, .sv-distribution and .sv-dist-* rules (which themselves
   restate SmartViewSidePanel.vue's, per that file's own comment). Scoped styles do not cross
   SFCs in this repo, so this is the third restatement of the same source, not a fresh
   invention -- extracting a shared stylesheet was explicitly rejected for this task (both
   closed files would need reworking, and scoped→global changes selector precedence). ── */
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-faint); margin: 0 0 10px;
}
/* Task 4: About key/value rows -- rule body identical to PhotosMomentDetail.vue's own
   .mo-about-row (scoped styles do not cross SFCs in this repo). The hairline is --divider. */
.mo-about-row {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  font-size: 12.5px; color: var(--fg-muted); padding: 7px 0;
  border-bottom: 1px solid var(--divider);
}
.mo-about-row:last-child { border-bottom: 0; }
.mo-about-row b { color: var(--fg); font-weight: 600; text-align: right; }
.sv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv-stat-cell { background: var(--chip-bg); padding: 10px 12px; border-radius: 8px; }
.sv-stat-cell .v { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg); }
.sv-stat-cell .l { font-size: 11px; color: var(--fg-faint); margin-top: 2px; }
.sv-distribution { height: 56px; display: flex; align-items: flex-end; gap: 2px; margin-top: 8px; }
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  background: linear-gradient(to top, var(--accent), var(--accent-text));
}
.sv-dist-x { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg-subtle); margin-top: 4px; }

/* ≤768px: the sidebar has collapsed into a drawer, layout goes single-column */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .sv-header h1 { font-size: 24px; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }
}
</style>
