<script setup lang="ts">
// The `/photos/places/:key` place-assets page — the landing page reached from the map detail
// panel's "view all N photos" / "open in library" links, or a spot card's "view all photos for
// this spot in the library" action (goLibrary/onOpenSpotLibrary). Month-grouped grid + lightbox +
// breadcrumb ("city › spot") + three-state gate. This page is a minimal drop-in for jumping into
// the library: browse only, no multi-select or batch operations.
//
// References:
//  - Shell / route-param normalization / lightbox mount site: PhotosAlbumDetail.vue:1-80
//    (AreaShell + .photos-layout + PhotosSidebar + .photos-main; deliberately not extracted into
//    a shared component).
//  - Three-state gate convention: PhotosPersonDetail.vue:583-611 (loading && !loaded / failed /
//    empty / normal).
//  - Breadcrumb information hierarchy: Vue2's PhotosTimeline.vue:1073-1090 (map icon + city
//    segment (a button when a spot is active, returns to the whole city) + right chevron + spot
//    segment + count on the right).
//  - Silent-degradation semantics when a spot deep link can't be found: Vue2
//    PhotosTimeline.vue:547-551 (`_applyPlaceFromQuery`: if spotKey is present but not found among
//    the detail's spots, just clear the spot key — no toast, fall back to the whole-city view).
//
// Hard rules:
//  1) placeKey/spotKey are always normalized with String(); lat/lon are guarded with
//     Number()+Number.isFinite, passing null for anything not finite (the shared package's
//     usePlaceAssets.load requires lat/lon to come paired with spotKey — a NaN must never reach
//     the backend).
//  2) Route param changes (key/spot/lat/lon) must always re-fetch both detail and assets — a real
//     bug caught earlier: a hash-route change reusing the same component doesn't remount it, and
//     without an :id watcher on the detail page, a new place would render with the previous
//     place's stale data.
//  3) The breadcrumb's city/spot names are always derived from `store.detail`, never trusted from
//     a possibly-stale string on the URL (this page's query only ever carries spot/lat/lon, never
//     city/spotName — those two strings would go stale after a rename, as review already pointed
//     out).
//
// A departure from the literal brief (an extra required case beyond what was spelled out, rationale
// below): `currentDetail` is only trusted when `store.detail.id` matches the current `placeKey` —
// this isn't an arbitrary extra check. `usePhotosPlaces.loadDetail` already has a sequence guard
// against races (so an old response can never overwrite newer data), but when navigating from
// place A to place B, `store.detail` still holds A's data until B's response arrives; without this
// identity check, the breadcrumb would show the previous city's name during that brief transition
// window. The sister page PhotosPlaces.vue:99-100 already established this same pattern on the
// same store (`activeDetail`: `store.detail && String(store.detail.id) === String(activeId.value)`),
// and this page copies that same technique rather than inventing new complexity.
//
// The transitional AreaShell/.photos-layout shell has been swapped for the same
// `.photos-root > .app[data-collapsed] > PhotosSidebar + main.main > PhotosTopbar + .photos-main`
// structure every other re-shelled Photos page uses (PhotosPeople.vue/PhotosAlbums.vue's own
// precedent), via the shared `useSidebarCollapse` singleton. Topbar copy: `title = cityName` (this
// page's existing fallback logic, unchanged — city name once the detail resolves, `t('photosPlaces')`
// before it does); `sub=""` — Vue2 has no dedicated topbar for this detail context at all (this
// route's Vue2 counterpart is a breadcrumb embedded inside PhotosTimeline.vue's own library topbar
// area, not a standalone topbar component with a sub-line). Simply omitting `sub` does NOT mean "no
// subtitle" — PhotosTopbar's own default computed falls back to the library-wide photo/video count
// summary on an omitted prop, which would render a wrong, stray subtitle under the city name (a
// regression vs. the old AreaShell shell, which had none here at all). `sub=""` is PhotosTopbar's
// explicit opt-out for exactly this case (see that component's own comment) — it renders no
// `.topbar-sub` node. No `back` button — back affordances don't go in the topbar; this page's own
// breadcrumb already carries that affordance (see `showWholeCity`/the `.place-crumb` markup below).
// PhotoLightbox is re-nested here because the re-skin removed the scoped-vs-parity cascade tie that
// previously made nesting unsafe (see the mount site near this file's template root for the full
// note).
import '../photos/styles/vue2-parity'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePlaceAssets } from '../photos/composables/usePlaceAssets'
import { usePhotosPlaces } from '../photos/stores/places'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosTrash } from '../photos/stores/trash'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import type { Photo } from '../photos/util/assetToPhoto'
// This page layers EXIF filtering on top of the place-assets view — mirroring Vue2
// PhotosTimeline.vue:167, where the spot branch uses placeAssets as its base set and layers the
// FilterBar's years/cameras dimensions on top of it. The places dimension is deliberately left
// out: Vue2's filter bar is shared between the timeline and the spot jump-in, but the spot branch
// explicitly only passes years/cameras and drops places (its own comment there says "the city is
// already fixed, layering a place-text filter on top would wrongly exclude results") — carrying
// that same chip over onto this standalone New-UI page would just be a chip that sits there doing
// nothing when tapped.
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import { groupPhotosByMonth } from '../photos/util/groupPhotosByMonth'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
// Same shared module singleton every other re-shelled Photos page uses (PhotosPeople.vue/
// PhotosAlbums.vue's own precedent) — toggle wired straight to the topbar button.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const route = useRoute()
const router = useRouter()
const store = usePhotosPlaces()
const assets = usePlaceAssets()
const lb = useLightbox()
// Real delete/Undo pathway for this page's own PhotoLightbox mount (see onLightboxDelete's own
// comment below).
const timeline = useTimelineStore()
const trash = usePhotosTrash()
const photosToast = usePhotosToast()

// ── Route param normalization ────────────────────────────────────────────────
const placeKey = computed(() => String(route.params.key))
const spotKey = computed(() => String(route.query.spot ?? ''))
// lat/lon must be tied to spotKey and never take effect on their own — this follows Vue2's
// `_applyPlaceFromQuery` (src/views/Photos/PhotosTimeline.vue:538-545): it only assigns
// spotLat/spotLon when a spot actually matches, otherwise forcing them to null. The shared
// package's `listAssetsByPlace` requires lat/lon to come paired with spotKey (see that method's
// own comment in the shared service package's src/photos.ts) — without a spotKey, even if the URL
// manually carries `?lat=1&lon=2`, they must still be passed as null, or this invariant is
// violated. In-app navigation never hits this case (showWholeCity/spot cards always clear or
// carry all three keys together), but hand-editing the address bar or an old bookmark can.
const lat = computed(() => {
  if (!spotKey.value) return null
  const n = Number(route.query.lat)
  return Number.isFinite(n) ? n : null
})
const lon = computed(() => {
  if (!spotKey.value) return null
  const n = Number(route.query.lon)
  return Number.isFinite(n) ? n : null
})

// Identity guard (a departure from the literal brief, rationale in this file's header comment) —
// only trust the detail that matches the current placeKey.
const currentDetail = computed(() =>
  (store.detail && String(store.detail.id) === placeKey.value) ? store.detail : null)

const cityName = computed(() => currentDetail.value?.city || t('photosPlaces'))

// When a spot is present, its name is looked up by key in store.detail.spots; when it can't be
// found (a stale deep link, a rename, or the detail hasn't arrived yet) the spot segment isn't
// rendered — the watch below syncs by clearing the query, silently falling back to the
// whole-city view (per Vue2 :547-551, no toast).
const matchedSpot = computed(() => {
  if (!spotKey.value || !currentDetail.value) return null
  return currentDetail.value.spots.find((s) => String(s.key) === spotKey.value) ?? null
})

function loadAll(): void {
  void store.loadDetail(placeKey.value)
  void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
}

// ── Data orchestration ───────────────────────────────────────────────────────
onMounted(loadAll)

// Route param changes re-run both fetches (a lesson learned from an earlier real bug).
watch(
  () => [route.params.key, route.query.spot, route.query.lat, route.query.lon],
  loadAll,
)

// Clicking the city segment: drop the query, keep only the path, returning to the whole-city view.
function showWholeCity(): void {
  void router.replace({ path: route.path, query: {} })
}

// Silent degradation when a spot can't be found (per Vue2 :547-551 semantics): once the
// identity-matched detail is confirmed not to contain this spot key, clear all three of the
// spot/lat/lon query params — no toast.
//
// Gotcha: this **must** watch `currentDetail` (it points to a brand-new object reference every
// time loadDetail succeeds — `toPlaceDetail` always `return`s a freshly built `{ ... }`), not
// `matchedSpot` directly. `matchedSpot`'s value is **null in both** cases — "detail hasn't arrived
// yet" (currentDetail is null) and "detail arrived but genuinely has no such spot" — and Vue's
// `watch` compares old vs. new via `hasChanged`, so null→null is treated as unchanged and the
// callback never runs, turning the degradation into dead code (there's a mutation-style test
// pinning this down). Watching a value that's guaranteed to get a new reference, then reading
// `matchedSpot.value` inside the callback, is what guarantees a check actually fires the moment
// the detail goes from absent to present.
watch(currentDetail, (d) => {
  if (d && spotKey.value && !matchedSpot.value) showWholeCity()
})

// ── Grid + lightbox ───────────────────────────────────────────────────────────
// EXIF filter state (same shape as the other similar pages). Only the years/cameras chips are
// kept — see the comment at the import above.
// Noted as a known gap (recorded, not changed here): the `places` EXIF dimension has never been
// wired end-to-end on this page — PLACE_CHIP_KEYS doesn't include 'places', so the UI never
// renders or produces that chip, and gridMonths below only projects the years/cameras keys into
// applyExifFilters (:146-150). exifFilter.places is always []. Only the cameras dimension was
// wired up here; leaving the places dimension unwired is a deliberate design choice for this page
// (see the comment below), not an oversight.
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
const PLACE_CHIP_KEYS = ['years', 'cameras'] as const

// Doesn't touch usePlaceAssets' own `months` (that composable belongs to another page — no
// unrelated refactors here) — this page computes its own filtered month grouping and drops empty
// months (same reasoning as elsewhere: the month ruler reads `months` unfiltered by tab, so here
// too, instead of reading assets.months.value, it filters assets.photos.value first and then
// groups it).
//
// The call order here is "filter, then group" — groupPhotosByMonth
// (util/groupPhotosByMonth.ts:15-23) only creates a bucket when it encounters a photo, so it can
// never produce an empty bucket, which means this page's own
// `.filter(m => m.photos.length > 0)` can never structurally remove anything — it's defensive
// dead code. It's kept anyway to match the same calling convention used on the timeline page
// (views/Photos.vue, where months come pre-bucketed from the backend, filtering happens inside
// each bucket, and an empty month is a real possibility there), not because this page currently
// needs that logical protection.
// The explicit projection only feeds the years/cameras dimensions, matching Vue2
// `PhotosTimeline.vue:167` (the spot branch likewise explicitly passes `{ years, cameras }`
// rather than forwarding the whole filter object). Today exifFilter.places is always empty, so
// feeding the whole object vs. just these two keys gives an identical result — but if some future
// code (a deep link/store) ever puts a value into exifFilter.places, feeding the whole object
// would silently filter results by place with no chip visible in the UI to show or clear it (a
// "ghost filter"). The explicit projection makes the years/cameras-only behavior self-evident at
// the data layer, instead of relying solely on the UI not rendering a places chip as the only
// line of defense.
const gridMonths = computed(() =>
  groupPhotosByMonth(applyExifFilters(assets.photos.value, {
    years: exifFilter.value.years,
    cameras: exifFilter.value.cameras,
  })).filter((m) => m.photos.length > 0))

// PhotosGrid's own emitted list is always undefined (it doesn't know where the "whole page"
// boundary is). The paging set follows the active filter (the lightbox must only be able to page
// through what's visible on screen), so gridMonths is used to rebuild the paging set instead of
// assets.photos.value — same reasoning as onOpenTile on the timeline page (views/Photos.vue).
function onOpen(photo: Photo, _list: undefined, startMs: number): void {
  lb.openAt(photo, gridMonths.value.flatMap((m) => m.photos), startMs)
}

function retry(): void {
  void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
}

// ── PhotoLightbox event wiring ───────────────────────────────────────────────
// This page mounted <PhotoLightbox> with NO listeners at all (delete/add-to-album silently
// no-op'd — the same false-success bug class an earlier fix found and fixed on
// PhotosSearch.vue, now formally audited and closed here too).
//
// @toggle-fav: no-op, same convention every other host page uses — see PhotosSearch.vue's own
// onLightboxToggleFav comment for the full rationale (useLightbox's own internal optimistic
// flip already covers the visible star icon; this page keeps no separate favorited list).
function onLightboxToggleFav(): void {}

// @delete: real timeline.deleteAssets pathway + usePhotosToast Undo, same shape as
// Photos.vue/PhotosSearch.vue's own onLightboxDelete.
//
// Data-source note (brief's "check each page's data source" requirement): unlike
// PhotosPlaces.vue's own detail payload (several interdependent id arrays with server-computed
// counts, hence that page's full-refetch choice), this page's data source is
// `usePlaceAssets()`'s own `photos` ref — a flat `Photo[]` this composable hands back verbatim
// (`usePlaceAssets.ts:22/50`), no derived counts or thumbnail picks layered on top. A precise
// local removal (same pattern as PhotosSearch.vue's `search.results` filter) is both correct
// and cheap here, and it preserves this page's own EXIF-filter/month-grouping state instead of
// discarding it for a full re-`load()`.
async function onLightboxDelete(id: string | number): Promise<void> {
  const snapshot = [String(id)]
  await timeline.deleteAssets(snapshot)
  assets.photos.value = assets.photos.value.filter((p) => String(p.id) !== String(id))
  photosToast.show({
    text: t('photosDeletedToast', { count: 1 }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      onClick: () => {
        void (async () => {
          await trash.restore(snapshot)
          // trash.restore() only refreshes the global timeline store — this page's own
          // place-assets list is a separate one-shot fetch (usePlaceAssets), so Undo re-runs
          // the same load() to bring the restored asset back into view (same "Undo re-fetches
          // this page's own data source" fallback PhotosSearch.vue's onLightboxDelete documents).
          void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
        })()
      },
    },
  })
}

// @add-to-album: single-asset picker, same PhotosMomentDetail.vue/PhotosSearch.vue precedent
// (this page has no batch-selection state to clear afterward either).
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
function onAlbumPickerAdded(): void {}
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="cityName"
          sub=""
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
        <div class="photos-main">
        <!-- Breadcrumb — independent of the three-state gate below, shown in every state. -->
        <div class="place-crumb" data-test="place-crumb">
          <svg class="crumb-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
          <button
            v-if="matchedSpot"
            type="button" class="crumb-city" data-test="place-crumb-city-btn"
            :title="t('photosPlacesShowWholeCity')"
            @click="showWholeCity"
          >{{ cityName }}</button>
          <span v-else class="crumb-city is-leaf" data-test="place-crumb-city-span">{{ cityName }}</span>
          <template v-if="matchedSpot">
            <svg class="crumb-chev" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            <span class="crumb-spot" data-test="place-crumb-spot">{{ matchedSpot.name }}</span>
          </template>
          <div class="crumb-spacer"></div>
          <PhotosFilterBar
            v-model:filter="exifFilter" :photos="assets.photos.value"
            :chip-keys="[...PLACE_CHIP_KEYS]"
          />
          <!-- Reads **unfiltered** assets.photos so this count expresses "how many photos this
               place has in total", not "how many are left after filtering". When filtering down
               to zero, the gate falls through to the v-else below (PhotosGrid renders its own
               empty grid) rather than hitting the place-assets-empty branch below — but
               PhotosGrid's own empty state uses the very same two keys (photosNoPhotos /
               photosNoPhotosHint), so what the user ultimately sees is word-for-word identical to
               that branch, just through a different DOM path — not "avoiding misleading copy". A
               genuine "no results match this filter" message would be a new feature Vue2 doesn't
               have either; that should be tracked as a backlog item, not built now. -->
          <span class="crumb-count" data-test="place-crumb-count">{{ t('photosPlacesPhotoCount', { n: assets.photos.value.length }) }}</span>
        </div>

        <!-- Three-state gate (following PhotosPersonDetail.vue:583-611's convention). -->
        <div v-if="assets.loading.value && !assets.loaded.value" class="place-skeleton" data-test="place-assets-skeleton">
          <div class="place-skeleton-grid">
            <div v-for="i in 12" :key="i" class="place-skeleton-tile"></div>
          </div>
        </div>

        <div v-else-if="assets.failed.value" class="empty-state" data-test="place-assets-failed">
          <div class="empty-state-title">{{ t('photosPlacesLoadFailed') }}</div>
          <button type="button" class="bar-btn" data-test="place-assets-retry" @click="retry">
            {{ t('photosPlacesRetry') }}
          </button>
        </div>

        <!-- This gate likewise reads **unfiltered** assets.photos, deciding only whether this
             place has any assets at all (unrelated to filtering) — when filtering down to zero
             photos, it falls through to the v-else branch below (PhotosGrid renders an empty
             grid), not here. But that branch's empty-state copy is word-for-word identical to
             this one (see the matching comment at the breadcrumb count above); the distinction
             between these two gate paths only matters for code/tests, not for what the user
             sees. -->
        <div v-else-if="assets.loaded.value && assets.photos.value.length === 0" class="empty-state" data-test="place-assets-empty">
          <div class="empty-state-title">{{ t('photosNoPhotos') }}</div>
          <div class="empty-state-desc">{{ t('photosNoPhotosHint') }}</div>
        </div>

        <!-- Browse-only, no multi-select/batch operations — selectable=false. -->
        <div v-else class="place-grid-slot">
          <PhotosGrid
            :months="gridMonths"
            :selectable="false"
            @open="onOpen"
          />
        </div>
        </div>
      </main>
    </div>

    <!-- PhotoLightbox is re-nested here: the re-skin removed the scoped-vs-parity cascade tie that previously made this unsafe. -->
    <!-- Event wiring added -- this mount had none before (delete/add-to-album
         silently no-op'd, see onLightboxDelete's own comment above). -->
    <PhotoLightbox
      @delete="onLightboxDelete"
      @toggle-fav="onLightboxToggleFav"
      @add-to-album="(id) => openAlbumPicker([id])"
    />
    <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />
    <!-- Required now that onLightboxDelete fires a real usePhotosToast() Undo toast -- without a
         mount, the toast state flips but nothing on this page's own tree renders it. Teleports to
         <body> and re-applies photos-root + themeClass on its own portal target (same mount
         Photos.vue/PhotosSearch.vue already use for the identical Undo-toast pattern). -->
    <PhotosToastHost />
    <!-- Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body" shape
         as PhotosToastHost -- Photos has no shared shell to mount this once at. -->
    <AskNimoHost />
  </div>
</template>

<style scoped>
/* The transitional `.sidebar` flex-width pin and the `.photos-layout` flex-row shell (an earlier
   interim AreaShell workaround) are both gone — the shell is now the shared Vue2-structured
   `.app` CSS Grid (parity photos.scss's own `.app`/`.main` rules under `.photos-root`), which
   already gives the sidebar its pixel-parity column width and the page its height cap (same as
   PhotosPeople.vue's own re-shell; see photosLayoutHeightCap.test.ts for why this page no longer
   needs a local height-capping rule or a mobile-only `gap:0` override — the old max-width:768px
   media query wrapped nothing but that one now-deleted rule, so the whole query block is deleted
   outright rather than kept as an empty shell). `.photos-main` survives as pure layout
   scaffolding — no parity selector by that name (same situation as every other re-shelled Photos
   page's own copy) — it's just the flex child that now sits inside `<main class="main">`, after
   `<PhotosTopbar>`, instead of being the `<main>` element itself. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* New-UI addition: this page's own breadcrumb (city › spot). No Vue2 CSS class to anchor to —
   Vue2's equivalent breadcrumb is inline markup inside PhotosTimeline.vue's own template
   (:1073-1090), which is a different component with its own literal styles; this page is a
   standalone route with no Vue2 counterpart component to diff a `.photos-root .place-crumb`
   parity rule against. */
.place-crumb { display: flex; align-items: center; gap: 6px; padding: 4px 4px 14px; flex: 0 0 auto; color: var(--fg-muted); }
.crumb-icon { flex: 0 0 auto; }
.crumb-city {
  border: 0; background: transparent; padding: 0; margin: 0; font: inherit; color: var(--fg);
  font-weight: 600; font-size: 14px; cursor: pointer;
}
.crumb-city.is-leaf { cursor: default; }
button.crumb-city:hover { color: var(--accent); }
.crumb-chev { flex: 0 0 auto; opacity: 0.6; }
.crumb-spot { font-size: 14px; color: var(--fg); }
.crumb-spacer { flex: 1; }
.crumb-count { font-size: 12px; color: var(--fg-muted); }

/* Parity does have a same-anchor `.photos-root .empty-state`/-title/-desc (photos.scss:1105-1124),
   but this page's own values predated the re-shell's token migration — they were still on the
   pre-migration `--fg`/`--fg-muted` app-wide tokens and a stray `padding: 80px 20px`/
   `max-width: 340px` that don't match parity OR the convention this fleet settled on once
   re-shelled (identical byte-for-byte in both PhotosAlbums.vue and PhotosPeople.vue:
   `padding: 60px 20px 20px`, `--text-2`/`--text-1`, no max-width on the desc line — parity's own
   `font-size: 13px` on `.empty-state-desc` already matches, so nothing local is needed there at
   all). Aligned to that same cross-page convention here rather than left on stale tokens now that
   this page is re-shelled too. */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--text-2); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--text-1); }
.empty-state-desc { font-size: 13px; }
.empty-state .bar-btn { margin-top: 10px; }

/* New-UI addition: loading skeleton, no Vue2 source (same situation as PhotosPersonDetail.vue's
   own `.person-skeleton*` family — Vue2 has no loading-skeleton concept anywhere in this area,
   see this file's own `place-assets-skeleton` gate comment above). */
.place-skeleton-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; padding: 4px; }
.place-skeleton-tile { aspect-ratio: 1; border-radius: 3px; background: var(--skeleton-bg); }

/* New-UI addition: pure layout scaffolding for the PhotosGrid slot, no parity selector by this
   name (same situation as `.photos-main` above). */
.place-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }
</style>
