<script setup lang="ts">
// P6b-T9 (SP7 Photos "Places" detail, the last task of this period): the per-place photo
// page for `/photos/places/:key` (D6) — the landing page reached from the map detail panel's
// "View all N photos" / "Open in library" / a spot card's "View all photos for this spot in
// Library" (T8 goLibrary/onOpenSpotLibrary). Month-grouped grid + lightbox + breadcrumb
// "City › spot" + three-state gating. D10: this jump-target page is browse-only, no
// multi-select/batch ops (deferred to P7/P8).
//
// References:
//  - Shell / route-param normalization / lightbox mount position: PhotosAlbumDetail.vue:1-80
//    (AreaShell + .photos-layout + PhotosSidebar + .photos-main; P3/P4/P5 decided not to
//    extract a shared component).
//  - Three-state gating convention: PhotosPersonDetail.vue:583-611 (loading&&!loaded / failed /
//    empty / normal).
//  - Breadcrumb information hierarchy: Vue2 NimoOS-UI PhotosTimeline.vue:1073-1090 (map icon +
//    city segment (a button when there's a spot, click to return to the whole city) + chevron +
//    spot segment + count on the right).
//  - Silent-fallback semantics when a spot deep link can't be resolved: Vue2
//    PhotosTimeline.vue:547-551 (`_applyPlaceFromQuery`: if spotKey is given but not found among
//    the detail's spots → just clear the spot key, no toast, fall back to the whole-city view).
//
// Hard rules:
//  1) placeKey/spotKey are always normalized via String(); lat/lon are guarded with
//     Number()+Number.isFinite, non-finite values become null (the shared package's
//     usePlaceAssets.load requires lat/lon to be paired with spotKey — it must never receive
//     NaN).
//  2) Route param changes (key/spot/lat/lon) must re-fetch both detail and assets — a real bug
//     caught in SP6-P5.5: hash routes don't remount the same component, and a detail page
//     missing an :id watcher will render the previous place's stale data for the new one.
//  3) The breadcrumb's city/spot names are always derived from store.detail, never trusted from
//     whatever stale string might be sitting in the URL (this page's query only ever carries
//     spot/lat/lon, never city/spotName — those two strings would go stale after a rename, as
//     the T8 review already pointed out).
//
// Disclosed deviation (a case beyond what the brief literally lists, rationale below):
// `currentDetail` is only trusted when `store.detail.id` matches the current `placeKey` — this
// isn't an arbitrary extra check. `usePhotosPlaces.loadDetail` already has a sequence-race guard
// internally (guaranteeing a stale response never overwrites newer data), but when navigating
// from place A to place B, store.detail still holds A's data until B's response comes back;
// without this identity check, the breadcrumb would briefly show the previous city's name during
// that transition window. The sibling page PhotosPlaces.vue:99-100 already has this precedent for
// its `activeDetail` on the same store (`store.detail && String(store.detail.id) ===
// String(activeId.value)`) — this copies that same technique, not a newly invented complexity.
import '../photos/styles/vue2-parity'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePlaceAssets } from '../photos/composables/usePlaceAssets'
import { usePhotosPlaces } from '../photos/stores/places'
import type { Photo } from '../photos/util/assetToPhoto'
// P7b-T5: this jump-target page layers EXIF filtering on top (D19) — mirroring Vue2
// PhotosTimeline.vue:167, where the spot branch takes placeAssets as its base set and layers the
// FilterBar's years/cameras dimensions on top. The places dimension deliberately does not appear,
// per D19: in Vue2 that filter bar is shared between the timeline and spot navigation, but the
// spot branch explicitly passes only years/cameras and drops places (the comment there states
// outright that "the city is already fixed, filtering by place text on top would wrongly exclude
// results"). Reproducing the full filter bar on this standalone New-UI page would just be a
// non-functional dead chip.
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import { groupPhotosByMonth } from '../photos/util/groupPhotosByMonth'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const route = useRoute()
const router = useRouter()
const store = usePhotosPlaces()
const assets = usePlaceAssets()
const lb = useLightbox()

// ── Structure spec 2: parameter normalization ─────────────────────────────────────────────
const placeKey = computed(() => String(route.params.key))
const spotKey = computed(() => String(route.query.spot ?? ''))
// Review fix I1: lat/lon must be tied to spotKey, they cannot take effect on their own — this
// traces back to Vue2 `_applyPlaceFromQuery`
// (NimoOS-UI/src/views/Photos/PhotosTimeline.vue:538-545), which only assigns
// spotLat/spotLon when a spot is matched, forcing null otherwise. The shared package's
// `listAssetsByPlace` requires lat/lon to be paired with spotKey (see the comment on that
// method in `.sp7/NimoOS-Service/src/photos.ts`) — without a spotKey, even if the URL was
// hand-edited to carry `?lat=1&lon=2`, null must still be passed, or this invariant is
// violated. In-app navigation never hits this path (showWholeCity and spot cards always
// clear/set all three keys together), but a hand-edited address bar or a stale bookmark can
// trigger it.
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

// Identity guard (disclosed deviation, see rationale in the file header comment) — only trust
// detail data that matches the current placeKey.
const currentDetail = computed(() =>
  (store.detail && String(store.detail.id) === placeKey.value) ? store.detail : null)

const cityName = computed(() => currentDetail.value?.city || t('photosPlaces'))

// When there's a spot, its name is looked up in store.detail.spots by key; if not found
// (dead deep link / renamed / detail not yet loaded) the spot segment is not rendered — the
// watch below will sync-clear the query, silently falling back to the whole-city view (per
// Vue2 :547-551, no toast).
const matchedSpot = computed(() => {
  if (!spotKey.value || !currentDetail.value) return null
  return currentDetail.value.spots.find((s) => String(s.key) === spotKey.value) ?? null
})

function loadAll(): void {
  void store.loadDetail(placeKey.value)
  void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
}

// ── Structure spec 3: data orchestration ──────────────────────────────────────────────────
onMounted(loadAll)

// Structure spec 3: re-run both when route params change (lesson #6 from SP6-P5.5).
watch(
  () => [route.params.key, route.query.spot, route.query.lat, route.query.lon],
  loadAll,
)

// City segment click: drop the query, keep only the path, return to the whole-city view
// (structure spec 4).
function showWholeCity(): void {
  void router.replace({ path: route.path, query: {} })
}

// Silent fallback when a spot can't be found (structure spec 4 + Vue2 :547-551 semantics): once
// the identity-matched detail confirms it has no such spot key, clear all three of the
// spot/lat/lon queries, no toast.
//
// Pitfall note: this **must** watch `currentDetail` (it points to a brand-new object reference
// every time loadDetail succeeds — `toPlaceDetail` always builds a fresh `return { ... }`), not
// watch `matchedSpot` directly. `matchedSpot` is **null** in both cases — "detail hasn't arrived
// yet" (currentDetail is null) and "detail has arrived but genuinely has no such spot" — and
// Vue's `watch` compares old vs. new via `hasChanged`, so null→null counts as unchanged and the
// callback never fires, turning the fallback into dead code (there's a mutation-testing case
// pinning this down). Watching a value that's "guaranteed to get a new reference", then reading
// matchedSpot.value inside the callback, is what guarantees a check fires the moment detail goes
// from absent to present.
watch(currentDetail, (d) => {
  if (d && spotKey.value && !matchedSpot.value) showWholeCity()
})

// ── Structure spec 6: grid + lightbox ─────────────────────────────────────────────────────
// P7b-T5: EXIF filter state (same shape as T4). D19: only the years/cameras chips remain — see
// the comment at the import above.
// P8a-T10 disclosed-only debt (recorded, not fixed): the `places` EXIF dimension has never been
// wired end-to-end on this page — PLACE_CHIP_KEYS doesn't include 'places', so the UI never
// renders/produces that chip, and gridMonths below also only projects the years/cameras keys
// into applyExifFilters (:146-150). exifFilter.places is always []. P7b only wired up the
// cameras dimension; the places dimension being "unwired" is deliberate on this page (see the
// comment below), not an oversight.
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
const PLACE_CHIP_KEYS = ['years', 'cameras'] as const

// Don't touch usePlaceAssets' months (that's P6b's component, no unrelated refactors allowed)
// — this page computes its own post-filter month grouping and drops empty months instead (same
// rationale as T4: the month scrubber reads months unfiltered by tab, so likewise this doesn't
// read assets.months.value, but filters assets.photos.value first and then groups it).
//
// fix round 1 Minor 1 (review): the call order here is "filter then group" — the buckets in
// groupPhotosByMonth (util/groupPhotosByMonth.ts:15-23) are only created when a photo is
// encountered and never produce an empty bucket, so this page's
// `.filter(m => m.photos.length > 0)` can never structurally remove anything — it's defensive
// dead code. It's kept anyway (the brief explicitly requires it) to match the same calling
// convention as T4 (views/Photos.vue, where months come pre-bucketed from the backend, filtering
// happens inside a bucket, and empty months are a real possibility) — not because this page
// currently needs that logical protection.
// fix round (final review M1): explicitly project only the years/cameras dimensions, matching
// Vue2 `PhotosTimeline.vue:167` (the spot branch likewise explicitly passes
// `{ years, cameras }` rather than forwarding the whole filter object). Today
// exifFilter.places is always empty, so passing the whole object vs. just these two keys
// produces an equivalent result — but if some future code (a deep link/store) ever puts a
// value into exifFilter.places, passing the whole object would silently filter by place with
// no chip visible in the UI to show it or clear it (the "ghost filter" T2 flagged as debt).
// Explicit projection makes D19 self-evident at the data layer, rather than relying solely on
// the UI-side defense of not rendering a places chip.
const gridMonths = computed(() =>
  groupPhotosByMonth(applyExifFilters(assets.photos.value, {
    years: exifFilter.value.years,
    cameras: exifFilter.value.cameras,
  })).filter((m) => m.photos.length > 0))

// The list PhotosGrid itself emits is always undefined (it doesn't know where the "whole
// page" boundary is). The paging set follows the filter (D9's rule of consistency: whatever
// the lightbox can page through must be what's visible on this screen), so gridMonths, not
// assets.photos.value, is used when rebuilding the paging set — same reasoning as
// onOpenTile in T4 (views/Photos.vue).
function onOpen(photo: Photo, _list: undefined, startMs: number): void {
  lb.openAt(photo, gridMonths.value.flatMap((m) => m.photos), startMs)
}

function retry(): void {
  void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
}
</script>

<template>
  <AreaShell :title="cityName">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Breadcrumb (structure spec 4) — independent of the three-state gating below, shown in every state. -->
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
          <!-- P7b-T5 (final review I1, wording correction): reads assets.photos **unfiltered**,
               so this count expresses "how many photos this place has in total", not "how many
               remain after filtering". When filtering yields zero, gating falls through to the
               v-else below (PhotosGrid renders its own empty grid) and never hits the
               place-assets-empty branch below — but PhotosGrid's own empty state uses the exact
               same two keys (photosNoPhotos / photosNoPhotosHint), so the copy the user ends up
               seeing is word-for-word identical to that branch, just via a different DOM path —
               it does not "avoid misleading copy". A genuinely distinct "no results match your
               filter" message would be a new feature Vue2 doesn't have either; that should be
               tracked as debt, not built this cycle. -->
          <span class="crumb-count" data-test="place-crumb-count">{{ t('photosPlacesPhotoCount', { n: assets.photos.value.length }) }}</span>
        </div>

        <!-- Structure spec 5: three-state gating (following the PhotosPersonDetail.vue:583-611 convention). -->
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

        <!-- P7b-T5 (final review I1, wording correction): this gate also reads assets.photos
             **unfiltered** — it only decides "does this place itself have any assets"
             (unrelated to filtering). When filtering yields zero, control flow goes to the
             v-else branch below (PhotosGrid renders an empty grid), not here. But that branch's
             rendered empty-state copy is word-for-word identical to this one's (see the matching
             comment at the breadcrumb count above) — the distinction between these two gating
             paths only matters to code/tests, not to what the user actually sees. -->
        <div v-else-if="assets.loaded.value && assets.photos.value.length === 0" class="empty-state" data-test="place-assets-empty">
          <div class="empty-state-title">{{ t('photosNoPhotos') }}</div>
          <div class="empty-state-desc">{{ t('photosNoPhotosHint') }}</div>
        </div>

        <!-- Structure spec 6: D10 is browse-only, no multi-select/batch ops — selectable=false. -->
        <div v-else class="place-grid-slot">
          <PhotosGrid
            :months="gridMonths"
            :selectable="false"
            @open="onOpen"
          />
        </div>
      </main>
    </div>
  </AreaShell>

  <!-- The lightbox is mounted outside AreaShell: position:fixed, to avoid being clipped by an
       ancestor's transform/overflow (same precedent as PhotosPersonDetail.vue:708-710). -->
  <PhotoLightbox />
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

/* height (not min-height): this screen is capped, only the inner scroll container scrolls —
   same-source fix; see the comment at the same rule in src/views/Photos.vue for the Vue2
   origin. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

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

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; max-width: 340px; }
.empty-state .bar-btn { margin-top: 10px; }

.place-skeleton-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; padding: 4px; }
.place-skeleton-tile { aspect-ratio: 1; border-radius: 3px; background: var(--skeleton-bg); }

.place-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
