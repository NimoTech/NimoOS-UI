<script setup lang="ts">
// Task 11 (SP7-P6a Places · map main view, wraps up this phase): PhotosPlaces.vue — the
// container that wires the output of the previous 10 tasks into one usable page: shell +
// legend/stats/hover card + wiring for five child components + route and 4th sidebar entry.
// Ported section by section from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue
// :760-761+:827-828+:949-950+:1250-1251 (container skeleton), :1013-1028 (hover card),
// :1030-1044 (legend), :1046-1056 (stats), :70-132 (state), :290-322 (watch), :323-357
// (mounted, skipping the cover-picker popover / document mousedown parts — those are the
// Vue2 cover picker plus the Filters/Theme popover's old click-outside-to-close logic; the
// cover picker belongs to P6b, and the popover specs for the Filters/Theme popovers have
// already each landed inside the T9/T10 components, so they aren't repeated in this
// container), and :724-753 (autoPan/pickPin/setHover).
// The shell is copied section by section from PhotosAlbums.vue:185-188/346-347's
// AreaShell/.photos-layout/PhotosSidebar/.photos-main (per the P3/P4/P5 decision: don't
// extract a shared component).
//
// Source cross-check (verified each line/number the brief gives against the source before
// starting work; discrepancies favor the source and are listed in the task report):
//  - The container skeleton's closing tags actually land at :1250 (closes .map-canvas-wrap)
//    / :1251 (closes .map-shell); the brief's ":1250-1251" matches, no discrepancy found.
//  - The legend's fourth group uses the i18n key photosPlacesCurrentTrip, whose actual
//    value is "本次旅行" (zh_cn.ts:1061, restored to the original json text by T4 commit
//    a04ca2b) — the brief text and the Step1 test checklist's "当前行程" is a conceptual
//    paraphrase, not the literal value; assertions go by the i18n dictionary's real value
//    "本次旅行" (recorded in the task report).
//  - autoPan()/pickPin()/setHover() actually land at :724-753 (the brief's :736-753 only
//    covers the pickPin/setHover portion; autoPan itself is at :724-735 — confirmed against
//    the source that the semantics match the brief's description).
//
// Deviation log (already enumerated by the brief; implemented item by item without
// re-arguing each one here — the full rationale for each lives in the corresponding
// component/composable):
//  8 (inherited from T3): hasDetailPanel always returns false — the detail panel belongs to
//     P6b; this only keeps the loadDetail call as a seam (brief §7 explicitly requires
//     keeping it, not dropping it just because the panel doesn't exist yet).
//  9: the three-state loading gate (skeleton/failed-retry/normal) is a New-UI addition —
//     Vue2 has no such concept; Vue2's load failure is just a console.error (see T3 store's
//     fetchPlaces comment), and on screen it's indistinguishable from "zero places".
//  10: hover positioning uses an explicit wrapEl ref instead of relying on
//     svg.parentElement (the approach Vue2 :746-749 reads).
//  11-⑤: wheel is registered explicitly on the svg element via
//     addEventListener({ passive: false }) instead of the template's @wheel — template
//     bindings can't guarantee passive: false, and Chrome will warn and ignore
//     preventDefault.
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PlacesRail from '../photos/components/PlacesRail.vue'
import PlacesMap from '../photos/components/PlacesMap.vue'
import PlacesZoomBar from '../photos/components/PlacesZoomBar.vue'
import PlacesFilterMenu from '../photos/components/PlacesFilterMenu.vue'
import PlacesThemeMenu, { type MapThemeSelection } from '../photos/components/PlacesThemeMenu.vue'
import PlaceDetailPanel from '../photos/components/PlaceDetailPanel.vue'
import PlaceCoverPicker from '../photos/components/PlaceCoverPicker.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosPlaces, type PlaceSpot, type PlaceVisit } from '../photos/stores/places'
import { usePlacesView } from '../photos/composables/usePlacesView'
import { useThemeStore } from '../stores/theme'
import { useToast } from '../stores/toast'
import { countCountries, countPhotos, filterPlaces, type Pin, type Place, type PlacesFilter } from '../photos/util/placesMap'
import { mapThemeStyleVars, resolveMapTheme } from '../photos/util/placesMapThemes'
import { assetToPhoto } from '../photos/util/assetToPhoto'

const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
const router = useRouter()
const store = usePhotosPlaces()
const themeStore = useThemeStore()
const toast = useToast()
const lb = useLightbox()

const activeId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const filterOpen = ref(false)
const themeOpen = ref(false)
// Review M2: the failure-state predicate must distinguish "hasn't been requested yet" from
// "requested and failed" — during the brief window in onMounted before
// `await store.fetchPlaces()` resolves (or even just this current synchronous render,
// before onMounted has run), `placesLoaded`/`loading` are both still their initial `false`.
// If the failure condition only looked at those two fields it would hit "failed" on the
// very first frame (reporting failure before a request has even gone out). `attempted` is
// only set true once onMounted actually starts a fetchPlaces call — on the first frame it's
// still its initial value of `false`.
const attempted = ref(false)

// ── P6b-T8: detail panel container state (mirrors Vue2 :114-121). ──────────────────────────
const activeSpotKey = ref<string | null>(null)
const coverOpen = ref(false)
const coverTab = ref('recent')
const coverSearch = ref('')
const coverPage = ref(0)

// The six filter fields from Vue2 data() :76-81, combined into one object; T9
// PlacesFilterMenu writes back by "replacing the whole object" (not mutating fields in
// place).
const filter = ref<PlacesFilter>({
  timeFilter: 'all',
  customStart: '',
  customEnd: '',
  minCount: 0,
  regionFilter: null,
  recentOnly: false,
})

const wrapEl = ref<HTMLElement | null>(null)
const mapRef = ref<InstanceType<typeof PlacesMap> | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

// P6b-T8 (deviation log 4): activePlace only looks up activeId in the list; activeDetail is
// only accepted when store.detail's id matches the current activeId — after switching
// cities, before the new detail comes back, store.detail is still the previous city's
// (Vue2 :204's `activeDetail || find()` would let the hero briefly show the previous city).
const activePlace = computed<Place | null>(() =>
  store.places.find((p) => String(p.id) === String(activeId.value)) ?? null)
const activeDetail = computed(() =>
  (store.detail && String(store.detail.id) === String(activeId.value)) ? store.detail : null)
const hasPanel = computed(() => activePlace.value != null || activeDetail.value != null)

const {
  view, zoomFrac, autoPanTo, zoomToCluster, zoomBy, setScale, reset,
  onWheel, onPointerDown, onPointerMove, onPointerUp, dispose,
} = usePlacesView({ svgEl: svgRef, wrapEl, hasDetailPanel: () => hasPanel.value })

// ── Filtered places (mirrors Vue2 :152-175 / T2 filterPlaces): feeds both the rail and the
// map. The rail's search is its own internal state (settled in T5), doesn't flow through
// here, and doesn't affect the map (checked against Vue2 :229/:237, which confirmed the map
// only consumes visiblePlaces, not searched).
const filteredPlaces = computed<Place[]>(() => filterPlaces(store.places, filter.value))
const totalPhotos = computed(() => countPhotos(filteredPlaces.value))
const countryCount = computed(() => countCountries(filteredPlaces.value))

// D5: the light-mode signal now reads the global data-theme (useThemeStore) instead of a
// Photos-private field (settled in T10 — here we just compute the boolean to pass to child
// components).
const isLight = computed(() => themeStore.theme === 'light')
const resolvedTheme = computed(() =>
  resolveMapTheme(
    store.themePrefs.mapTheme,
    store.themePrefs.customDotColor,
    store.themePrefs.customGridColor,
    isLight.value,
  ),
)
const themeVars = computed(() => mapThemeStyleVars(resolvedTheme.value))
// PlacesZoomBar's slider accent color takes the same resolveMapTheme() result's .dot
// (disambiguation 2).
const dotColor = computed(() => resolvedTheme.value.dot)

// Vue2's hoverPlace :213 reads this.places (the full list). Here we look it up from
// filteredPlaces instead — hover can only happen on a pin actually rendered on the map, and
// pins are built from filteredPlaces, so it's always a subset.
const hoverPlace = computed<Place | null>(() => {
  if (!hoverId.value) return null
  return filteredPlaces.value.find((p) => String(p.id) === String(hoverId.value)) ?? null
})
// Vue2 :1014 `v-if="hoverPlace && hoverPlace.id !== activeId"` — don't show the tip for the
// currently selected place.
const showHoverTip = computed(() => hoverPlace.value != null && String(hoverPlace.value.id) !== String(activeId.value))
const hoverThumbSrc = computed(() => {
  const p = hoverPlace.value
  if (!p) return ''
  const id = p.coverAssetId || p.thumbs[0] || ''
  return id ? service.photos.thumbnailUrl(id, 'large') : ''
})
// Deviation log (consistent with PlacesRail.vue's existing decision; brief §4 explicitly
// requires "localized dates"): the date follows the i18n locale, not a verbatim copy of
// Vue2 :1025's raw backend English string; falls back to the original string when lastDate
// is null.
function formatLast(p: Place): string {
  if (!p.lastDate) return p.last
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(p.lastDate)
}

// ── Wiring for the five child components ──────────────────────────────────────────────────────────
function onToggleFold(regionId: string): void {
  store.toggleRegionFold(regionId)
}
// Vue2 :736-743. stopPropagation so the click doesn't bubble up and trigger the underlying
// pan's pointerdown logic.
function onPickPin(pin: Pin, ev: MouseEvent): void {
  ev.stopPropagation()
  if (pin.cluster) {
    zoomToCluster(pin, view.value.scale)
  } else {
    activeId.value = pin.id
  }
}
// Vue2 :744-752, switched to an explicit wrapEl ref (deviation log 10) instead of deriving
// it from svg.parentElement.
function onHoverPin(pin: Pin, ev: MouseEvent): void {
  hoverId.value = pin.id
  const wrap = wrapEl.value
  const target = ev.currentTarget as Element | null
  if (!wrap || !target) return
  const wrapRect = wrap.getBoundingClientRect()
  const pinRect = target.getBoundingClientRect()
  hoverPos.value = { x: pinRect.left - wrapRect.left + 20, y: pinRect.top - wrapRect.top }
}
function onHoverClear(): void {
  hoverId.value = null
}
// Disambiguation 3: PlacesThemeMenu only emits; the container decides which store action
// the write path lands on — reads always go through store.themePrefs (wired directly, see
// the :selection binding in the template below). pickPreset always emits a non-'custom'
// mapTheme (customDotColor/customGridColor carried through unchanged); the color picker
// always emits mapTheme: 'custom' (see PlacesThemeMenu.vue's onDotInput/onGridInput). The
// two branches are mutually exclusive and don't overlap.
function onUpdateThemeSelection(next: MapThemeSelection): void {
  if (next.mapTheme === 'custom') {
    store.setCustomColors(next.customDotColor, next.customGridColor)
  } else {
    store.setMapTheme(next.mapTheme)
  }
}

// ── Explicit wheel registration (deviation log 11-⑤). svgRef changes as PlacesMap
// mounts/unmounts (skeleton ↔ map toggling), and the listener moves along with it — the
// previous element is detached first, then the new one attached, so it never double-
// registers or dangles.
function handleWheel(e: WheelEvent): void {
  onWheel(e)
}
watch(svgRef, (el, prev) => {
  if (prev) prev.removeEventListener('wheel', handleWheel)
  if (el) el.addEventListener('wheel', handleWheel, { passive: false })
})
// flush: 'post' — must wait until DOM/template refs are committed before we can read the
// PlacesMap instance that just mounted.
watch(mapRef, (inst) => {
  svgRef.value = (inst as unknown as { svgEl: SVGSVGElement | null } | null)?.svgEl ?? null
}, { flush: 'post' })

// ── activeId watch (Vue2 :291-294): changed and non-empty → autoPanTo; always
// loadDetail(next). Vue3's watch() only fires when the value actually changes (unlike a
// Vue2 watcher, which could in theory fire with no real change), so we don't replicate
// Vue2's redundant `next !== prev` check here — `next` being non-empty is enough to cover
// "changed and non-empty".
// P6b-T8 addition (mirrors Vue2 :295-301): reset the cover popover/spot state on city
// switch — the existing autoPanTo + loadDetail two lines stay unchanged.
watch(activeId, (next) => {
  if (next) {
    const place = store.places.find((p) => String(p.id) === String(next)) ?? null
    autoPanTo(place)
  }
  void store.loadDetail(next)
  coverOpen.value = false
  coverTab.value = 'recent'
  coverSearch.value = ''
  coverPage.value = 0
  activeSpotKey.value = null
})

// ── P6b-T8: the three cover-candidate watches (mirrors Vue2 :304-312). Fetch precondition
// is activeId && coverOpen — changing tab/search/page while the popover is closed doesn't
// fire a request (deletion checklist item ⑧). No debounce (deviation 15-①, per the user's
// 2026-07-31 pre-flight ruling: keep the same pacing as Vue2's fire-on-every-keystroke,
// relying only on the store-side seq guard on the landed result).
// Review M3 (backfilled): when coverPage > 0, changing tab/search fires two requests with
// identical parameters — this watch calls fetchCandidatesIfOpen() itself once, and setting
// `coverPage.value = 0` triggers the coverPage watcher's fetchCandidatesIfOpen() below a
// second time. Vue2 :304-312 has the same shape (the coverTab/coverSearch watchers also
// each set coverPage=0 first and then call loadCoverCandidates(), with the coverPage
// watcher firing again separately) — this is a straight port, not a new problem introduced
// by this repo. The store's coverSeq race guard ensures the two results never get aliased;
// it's just one extra request, and correctness is unaffected.
function fetchCandidatesIfOpen(): void {
  if (!activeId.value || !coverOpen.value) return
  void store.fetchCoverCandidates(activeId.value, { tab: coverTab.value, q: coverSearch.value, page: coverPage.value })
}
watch(coverTab, () => {
  coverPage.value = 0
  fetchCandidatesIfOpen()
})
watch(coverSearch, () => {
  coverPage.value = 0
  fetchCandidatesIfOpen()
})
watch(coverPage, () => {
  fetchCandidatesIfOpen()
})

// openCoverPicker() = set coverOpen = true then fetch once (mirrors Vue2 :517-521's toggle
// semantics: fetch on open, don't fetch on close).
function openCoverPicker(): void {
  coverOpen.value = true
  fetchCandidatesIfOpen()
}

// ── P6b-T8: Cover submission ────────────────────────────────────────────────────────
async function onPickCover(assetId: string): Promise<void> {
  coverOpen.value = false // Mirrors Vue2 :538: close the popover before submitting
  if (!activeId.value) return
  try {
    await store.setPlaceCover(activeId.value, assetId)
  } catch {
    toast.show(t('photosPlacesCoverFailed')) // Deviation log 6: Vue2 has no catch
  }
}
async function onResetCover(): Promise<void> {
  coverOpen.value = false
  if (!activeId.value) return
  try {
    await store.resetPlaceCover(activeId.value)
  } catch {
    toast.show(t('photosPlacesCoverFailed'))
  }
}

// ── P6b-T8: The three spot actions ───────────────────────────────────────────────────
function onPickSpot(spot: PlaceSpot): void {
  activeSpotKey.value = String(spot.key)
}
async function onRenameSpot(name: string): Promise<void> {
  if (!activeId.value || !activeSpotKey.value) return
  try {
    await store.setSpotName(activeId.value, activeSpotKey.value, name)
  } catch {
    toast.show(t('photosPlacesSpotRenameFailed'))
  }
}
// D8. The failure message is shared with rename (same category of operation on the same
// resource). On success, don't close the dialog and don't call loadDetail again (deviation
// 7: setSpotName already writes detail.spots back in place; resetSpotName refetches on its
// own inside the store). The dialog's edit state is exited by the component itself once
// props.spot.name changes (already implemented in T4).
async function onResetSpotName(): Promise<void> {
  if (!activeId.value || !activeSpotKey.value) return
  try {
    await store.resetSpotName(activeId.value, activeSpotKey.value)
  } catch {
    toast.show(t('photosPlacesSpotRenameFailed'))
  }
}

// ── P6b-T8: Albums and toast ────────────────────────────────────────────────────
async function createAlbum(name: string, from?: string, to?: string): Promise<void> {
  if (!activeId.value) return
  try {
    const album = await store.createPlaceAlbum(activeId.value, { name, from, to })
    toast.show(
      t('photosPlacesAlbumCreated', { name: album.name, count: album.count }),
      5000,
      { label: t('photosPlacesToastOpen'), onClick: () => { void router.push(`/photos/albums/${album.albumId}`) } },
    )
  } catch (e) {
    // A busy re-entry isn't an error — don't show a toast (see T2's albumBusy contract)
    if ((e as Error)?.message !== 'albumBusy') toast.show(t('photosPlacesAlbumCreateFailed'))
  }
}
function onSaveAlbum(): void { void createAlbum(activePlace.value?.city ?? '') } // Vue2 :458-462
function onSaveTrip(v: PlaceVisit): void { // Vue2 :463-472
  void createAlbum(`${activePlace.value?.city ?? ''} · ${v.when}`, v.from, v.to)
}

// ── P6b-T8: Lightbox (D9). The detail payload only gives an assetId string, no asset
// object; lightbox openAt needs a Photo. assetToPhoto({ id }) produces a valid Photo with
// default values, and once useLightbox opens it hydrates the real detail via getAsset(id)
// (useLightbox.ts:95-124), so the placeholder object is enough. ──────────────
function onOpenPhoto(assetId: string, list: string[]): void {
  const ids = list.length ? list : [assetId]
  const photos = ids.map((id) => assetToPhoto({ id }))
  const target = photos.find((p) => String(p.id) === String(assetId)) ?? photos[0]
  lb.openAt(target, photos)
}

// ── P6b-T8: Jump-to-library navigation. key uses the backend's raw key (int32), not the
// normalized activeId — the jump-to-library page needs it to hit the backend directly. ──────────────────────────────────────────────────────────────
function goLibrary(): void {
  const key = activePlace.value?.key ?? activeId.value
  if (key == null) return
  void router.push(`/photos/places/${encodeURIComponent(String(key))}`)
}
function onOpenSpotLibrary(): void {
  const spot = activeDetail.value?.spots.find((s) => String(s.key) === String(activeSpotKey.value))
  const key = activePlace.value?.key ?? activeId.value
  if (key == null || !spot) return
  activeSpotKey.value = null // Per Vue2 :484: close the popover before navigating away
  void router.push({
    path: `/photos/places/${encodeURIComponent(String(key))}`,
    query: { spot: String(spot.key), lat: String(spot.lat), lon: String(spot.lon) },
  })
}

// Vue2 :412-413 puts "select places[0] when nothing is selected" inside loadPlaces() itself,
// so every successful load (first page entry, or a retry after failure) re-selects and
// re-autoPans. T3's store deliberately doesn't do this step (left for the view layer), but
// that means the caller must add this step after **every** successful fetchPlaces call —
// review I4: extract it into a function that both onMounted and retryLoad call, not just
// once inside onMounted.
function selectFirstIfNeeded(): void {
  if (!activeId.value && store.places.length > 0) {
    activeId.value = store.places[0].id
  }
}

onMounted(async () => {
  attempted.value = true
  await store.fetchPlaces()
  selectFirstIfNeeded()
})
onUnmounted(() => {
  dispose()
  if (svgRef.value) svgRef.value.removeEventListener('wheel', handleWheel)
})

async function retryLoad(): Promise<void> {
  await store.fetchPlaces()
  selectFirstIfNeeded()
}
</script>

<template>
  <AreaShell :title="t('photosPlaces')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="map-shell">
          <PlacesRail
            :places="filteredPlaces"
            :regions="store.regions"
            :active-id="activeId"
            :total-photos="totalPhotos"
            :country-count="countryCount"
            :loaded="store.placesLoaded"
            :total-places="store.places.length"
            @pick="activeId = $event"
            @toggle-fold="onToggleFold"
          />

          <div ref="wrapEl" class="map-canvas-wrap">
            <div class="map-toolbar">
              <div class="map-chip-row">
                <PlacesFilterMenu
                  :filter="filter"
                  :regions="store.regions"
                  :open="filterOpen"
                  @update:filter="filter = $event"
                  @update:open="filterOpen = $event"
                />
                <PlacesThemeMenu
                  :selection="store.themePrefs"
                  :is-light="isLight"
                  :open="themeOpen"
                  @update:selection="onUpdateThemeSelection"
                  @update:open="themeOpen = $event"
                />
              </div>
              <div class="map-spacer"></div>
            </div>

            <!-- Loading skeleton (deviation log 9, Vue2 has no such concept). Review M2: the
                 very first frame (before `attempted` is set true) also belongs in this branch —
                 onMounted's fetchPlaces is async, and the first render happens before it
                 actually starts running, when loading is still its initial false; it must not
                 fall into the "failed" branch. -->
            <div v-if="!store.placesLoaded && (store.loading || !attempted)" class="map-skeleton" data-test="places-skeleton"></div>

            <!-- Load failed (deviation log 9). Review M2: must be tightened with `attempted`,
                 otherwise "hasn't been requested yet" gets misjudged as "requested and
                 failed". -->
            <div v-else-if="attempted && !store.placesLoaded && !store.loading" class="map-failed" data-test="places-failed">
              <div class="map-failed-title">{{ t('photosPlacesLoadFailed') }}</div>
              <button type="button" class="bar-btn" data-test="places-retry" @click="retryLoad">
                {{ t('photosPlacesRetry') }}
              </button>
            </div>

            <template v-else>
              <PlacesZoomBar
                :zoom-frac="zoomFrac"
                :dot-color="dotColor"
                @zoom-by="zoomBy"
                @set-scale="setScale"
                @reset="reset"
              />

              <PlacesMap
                ref="mapRef"
                :places="filteredPlaces"
                :active-id="activeId"
                :view="view"
                :theme-vars="themeVars"
                @pick-pin="onPickPin"
                @hover-pin="onHoverPin"
                @hover-clear="onHoverClear"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
              />

              <!-- P6b-T8: Detail panel (DOM order doesn't affect stacking, z-index is already
                   fixed at 6, but keeps the readable "map → panel → tip/furniture" order). -->
              <PlaceDetailPanel
                v-if="hasPanel"
                :place="activePlace" :detail="activeDetail"
                :detail-loading="store.detailLoading"
                :active-spot-key="activeSpotKey" :spot-busy="store.spotBusy"
                @close="activeId = null"
                @open-cover-picker="openCoverPicker"
                @open-library="goLibrary()"
                @save-album="onSaveAlbum"
                @open-photo="onOpenPhoto"
                @pick-spot="onPickSpot"
                @close-spot="activeSpotKey = null"
                @rename="onRenameSpot"
                @reset-name="onResetSpotName"
                @open-spot-library="onOpenSpotLibrary"
                @save-trip="onSaveTrip"
              />

              <!-- Hover card (per Vue2 :1013-1028). -->
              <div
                v-if="showHoverTip"
                class="map-tip"
                data-test="map-tip"
                :style="{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }"
              >
                <div class="thumb">
                  <img v-if="hoverThumbSrc" :src="hoverThumbSrc" alt="">
                </div>
                <div>
                  <div class="name">{{ hoverPlace?.city }}</div>
                  <div class="meta">
                    {{ hoverPlace?.country }} · {{ t('photosPlacesPhotoCount', { n: hoverPlace?.count ?? 0 }) }} · {{ hoverPlace ? formatLast(hoverPlace) : '' }}
                  </div>
                </div>
              </div>

              <!-- Legend (per Vue2 :1030-1044). The three numeric literals are coupled to T2's
                   tierRadius (see the comment above that function); the fourth group's accent
                   colour now uses the --place-current-trip token (disambiguation/brief §5). -->
              <div class="map-legend" data-test="map-legend">
                <div class="grp"><span class="dot s1"></span><b>&lt; 40</b></div>
                <div class="grp"><span class="dot s2"></span><b>40–100</b></div>
                <div class="grp"><span class="dot s3"></span><b>100+</b></div>
                <div class="grp legend-trip">
                  <span class="dot s2 dot-trip"></span><b>{{ t('photosPlacesCurrentTrip') }}</b>
                </div>
              </div>

              <!-- Stats (per Vue2 :1046-1056). -->
              <div class="map-stats" data-test="map-stats">
                <div class="stat">
                  <span class="v">{{ filteredPlaces.length }}</span><span class="k">{{ t('photosPlacesCities') }}</span>
                </div>
                <div class="stat">
                  <span class="v">{{ countryCount }}</span><span class="k">{{ t('photosPlacesCountries') }}</span>
                </div>
                <div class="stat">
                  <span class="v">{{ totalPhotos.toLocaleString() }}</span><span class="k">{{ t('photosPlacesPhotos') }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </main>
    </div>
  </AreaShell>

  <!-- P6b-T8: Cover popover + lightbox, mounted outside AreaShell (position:fixed, to avoid
       being clipped by an ancestor's transform/overflow, same precedent as
       PhotosPersonDetail.vue:708-710). -->
  <PlaceCoverPicker
    :open="coverOpen"
    :city="activePlace?.city ?? ''"
    :total-count="activePlace?.count ?? 0"
    :current-asset-id="activeDetail?.coverAssetId ?? ''"
    :candidates="store.coverCandidates"
    :tab="coverTab"
    :search="coverSearch"
    :page="coverPage"
    :busy="store.coverBusy"
    @close="coverOpen = false"
    @update:tab="coverTab = $event"
    @update:search="coverSearch = $event"
    @update:page="coverPage = $event"
    @pick="onPickCover"
    @reset="onResetCover"
  />
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

.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Review M4: Vue2 scss:29-36's .map-shell only has flex/grid/background, no border/
   border-radius/overflow — these three (border/border-radius/overflow:hidden) are a New-UI
   addition, giving the whole map area a unified card frame (an existing convention for other
   full-screen containers in this area); not part of a faithful port, logged but not reverted. */
.map-shell {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 300px 1fr; gap: 0;
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.map-canvas-wrap {
  position: relative;
  display: flex; flex-direction: column;
  min-height: 0;
  overflow: hidden;
  /* Vue2 photos-places.scss:196 is a hardcoded dark gradient literal; only the letterbox
     area (the blank space left by the SVG's preserveAspectRatio) shows this background
     through. D3: the layout structure follows Vue2, but the background belongs to "component
     system / surface treatment", which New-UI reshapes — same established ruling as
     PlacesFilterMenu.vue's popover background: switch to a panel-bg-based gradient that
     follows the app theme, rather than faithfully reproducing this theme-invariant dark
     literal. */
  background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 6%, var(--panel-bg)) 0%, var(--panel-bg) 70%);
}

.map-toolbar {
  position: absolute;
  top: 12px; left: 12px; right: 12px;
  /* Deviation log (real-device acceptance feedback, a Vue2 defect, corrected per the hard
     rule + logged, not copied verbatim): Vue2 photos-places.scss:199-207 (.map-toolbar) and
     :234-245 (.map-zoombar) both set z-index:4 — .map-toolbar, being position:absolute with a
     non-auto z-index, forms its own stacking context, so its inner popovers
     (PlacesFilterMenu.vue/PlacesThemeMenu.vue at z-index:30) only compete within the toolbar
     and can never rise above the sibling .map-zoombar; with equal z-index, DOM order decides,
     and in the template .map-zoombar (PlacesZoomBar.vue) comes after .map-toolbar, so the
     zoom bar paints on top of the Filters/theme popovers — in Vue2, opening either popover
     lets the zoom bar bleed through the middle of it. This repo raises the toolbar from 4 to
     7: the existing stacking gradient in this area is 4 (map furniture — zoombar/legend/stats)
     < 5 (.map-tip) < 6 (reserved for the P6b detail panel) < 7 (here), so 7 lets the toolbar
     and its inner popovers stably sit above everything in the map area, without taking the 6
     reserved for P6b. */
  z-index: 7;
  display: flex; align-items: center; gap: 10px;
  /* Copied verbatim from Vue2 scss:199-207's transparent strip + re-enabling pointer events on
     children — otherwise this toolbar would eat the map's drag gestures (a hard constraint
     from the brief, asserted programmatically in PhotosPlaces.test.ts). */
  pointer-events: none;
}
.map-toolbar > * { pointer-events: auto; }

.map-chip-row {
  display: flex; gap: 6px;
  padding: 5px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 99px;
}
.map-spacer { flex: 1; }

/* Loading/failed (deviation log 9, a New-UI addition). */
.map-skeleton {
  flex: 1; margin: 16px; border-radius: 16px;
  background: var(--skeleton-bg);
}
.map-failed {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--fg-muted); text-align: center;
}
.map-failed-title { font-size: 14px; font-weight: 600; color: var(--fg); }

/* Hover card (per Vue2 photos-places.scss:437-473). Review M4: this repo has no equivalent
   of Vue2's --r-md/--r-sm border-radius tokens, so the border-radius values below are
   nearby literal px values, not an exact reproduction of those two tokens (the numbers
   differ slightly; non-negative numeric literals aren't governed by the color guard, so
   this is logged rather than adding a new token). */
.map-tip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 14px));
  background: var(--popup-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; gap: 10px; align-items: center;
  box-shadow: var(--card-shadow-hi);
  min-width: 180px;
}
/* Review M4: Vue2 scss:453's thumbnail placeholder background is a hardcoded solid dark
   literal; switched here to --chip-bg (which follows the theme) rather than exactly
   reproducing that theme-invariant dark background — same ruling as D3: surface treatment
   belongs to New-UI's reshaping. */
.map-tip .thumb { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: var(--chip-bg); }
.map-tip .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.map-tip .name { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.map-tip .meta { font-size: 11px; color: var(--fg-subtle); margin-top: 2px; }
.map-tip::after {
  content: "";
  position: absolute;
  left: 50%; bottom: -6px;
  transform: translateX(-50%) rotate(45deg);
  width: 10px; height: 10px;
  background: var(--popup-bg);
  border-right: 1px solid var(--card-border);
  border-bottom: 1px solid var(--card-border);
}

/* Legend (per Vue2 photos-places.scss:285-309). */
.map-legend {
  position: absolute;
  bottom: 16px; left: 16px;
  z-index: 4;
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  font-size: 11px; color: var(--fg-subtle);
}
.map-legend .grp { display: flex; align-items: center; gap: 6px; }
/* The box-shadow's 0.2 opacity exactly reproduces Vue2 scss:304's rule for taking the same
   opacity on the accent colour — this repo has no accent RGB-triplet token, so color-mix is
   used directly against var(--accent) to get the exact same alpha, the same technique
   already used by PlacesFilterMenu.vue's .map-chip.is-active, without adding a new token or
   approximating. */
.map-legend .dot { display: inline-block; background: var(--accent); border-radius: 50%; box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent); }
.map-legend .dot.s1 { width: 6px; height: 6px; }
.map-legend .dot.s2 { width: 10px; height: 10px; }
.map-legend .dot.s3 { width: 14px; height: 14px; }
.map-legend b { color: var(--fg-muted); font-weight: 500; }
.map-legend .legend-trip { margin-left: 6px; }
/* The fourth group's accent colour switches to the --place-current-trip token T6 already
   built, rather than reproducing Vue2 :1041's inline literal (explicitly required by brief
   §5). The box-shadow's 0.2 opacity uses the same technique as above, against
   --place-current-trip.
   Review M3 (a sibling pitfall of the hover-cascade hard rule; this repo's "equal specificity
   surviving only on source order" shape, already hit once each in T5/T9/T10): the selector
   must be written as `.map-legend .dot.dot-trip` (two classes, specificity 0,3,0), not just
   `.map-legend .dot-trip` (0,2,0) — that would tie with `.map-legend .dot` above (0,2,0) and
   win only by "happening to be written later", so reordering the style block would silently
   revert it back to the accent colour. cssCascade.ts's winningHoverBackground family is
   designed for :hover states; there is no hover state here, so parseCssRules is used to
   compare selector specificity directly instead (see the test). */
.map-legend .dot.dot-trip {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}

/* Stats (per Vue2 photos-places.scss:311-330). */
.map-stats {
  position: absolute;
  bottom: 16px; right: 16px;
  z-index: 4;
  display: flex; gap: 18px;
  padding: 10px 16px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  font-size: 11px;
}
.map-stats .stat .v { display: block; font-family: var(--font); font-size: 16px; font-weight: 600; color: var(--fg); letter-spacing: -0.01em; }
.map-stats .stat .k { color: var(--fg-subtle); font-size: 10.5px; }

/* ≤768px: sidebar has collapsed into a drawer, and the map's own two columns (rail + canvas)
   also narrow to a single column to avoid horizontal overflow. */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .map-shell { grid-template-columns: 1fr; }
}
</style>
