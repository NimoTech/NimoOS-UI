<script setup lang="ts">
// Task 11 (Places · Map main view, closing out this phase): PhotosPlaces.vue — the
// container that wires the previous 10 tasks' output into one usable page: shell + legend/
// stats/hover card + five child-component wiring + routing and the 4th sidebar entry.
// Ported section by section from Vue2's src/views/Photos/PhotosPlacesView.vue :760-761+:827-828+
// :949-950+:1250-1251 (container skeleton), :1013-1028 (hover card), :1030-1044 (legend),
// :1046-1056 (stats), :70-132 (state), :290-322 (watch), :323-357 (mounted, skipping the
// cover-picker/document-mousedown parts — those are Vue2's old click-outside-to-close logic for
// the cover picker + Filters/Theme popovers; the cover picker belongs to P6b, and the Filters/
// Theme popovers' own overlay conventions are already implemented inside the T9/T10 components
// themselves, so they aren't duplicated in this container), :724-753 (autoPan/pickPin/setHover).
// The shell is copied section by section from PhotosAlbums.vue:185-188/346-347's AreaShell/
// .photos-layout/PhotosSidebar/.photos-main (per P3/P4/P5's standing decision not to extract a
// shared component).
//
// Source cross-check (line numbers/values were verified against the Vue2 source before use;
// the source code is authoritative on any discrepancy):
//  - The container skeleton's own closing-tag line numbers are :1250 (closes
//    .map-canvas-wrap)/:1251 (closes .map-shell) — verified, no discrepancy found.
//  - The 4th legend group's i18n text key photosPlacesCurrentTrip actually resolves to
//    "本次旅行" (zh_cn.ts:1061, restored to the original JSON text by commit a04ca2b) —
//    "当前行程" seen elsewhere is a conceptual paraphrase, not the literal value; assertions
//    follow the i18n dictionary's real value "本次旅行".
//  - autoPan()/pickPin()/setHover()'s actual line numbers are :724-753 (:736-753 covers only
//    the pickPin/setHover pair; autoPan itself is at :724-735 — cross-checked against source
//    and confirmed the semantics match).
//
// Deviations on record (deliberate, documented here — see the corresponding component/
// composable for the full rationale on each):
//  8 (inherited from T3): hasDetailPanel always returns false — the detail panel belongs to
//     P6b; this file only keeps the loadDetail call as the seam (kept deliberately, not
//     dropped just because the panel doesn't exist yet).
//  9: the three-state loading gate (skeleton/failed-retry/normal) is a New-UI addition; Vue2
//     has no such concept — Vue2's own load failure only does console.error (see T3's store
//     fetchPlaces comment), and on the view itself it's indistinguishable from "zero places".
//  10: hover positioning uses an explicit wrapEl ref instead of relying on svg.parentElement
//     (Vue2 :746-749's approach).
//  11-⑤: wheel is registered explicitly via addEventListener({ passive: false }) on the svg
//     element rather than the template's @wheel — a template binding can't guarantee
//     passive: false, and Chrome will warn and ignore preventDefault.
//
// Task 1 (Plan E re-shell, 2026-08-14): the transitional AreaShell/.photos-layout shell (Fix
// round 1's own interim workaround, see this file's git history for the removed `.sidebar`/
// `.photos-layout` scoped rules) has been swapped for the same `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure every other re-shelled Photos page uses
// (PhotosPeople.vue/PhotosAlbums.vue's own Plan C/D Task 2 precedent), via the shared
// `useSidebarCollapse` singleton. Topbar copy: `title = t('photosPlaces')`, `sub` mirrors Vue2
// PhotosPlacesTopbar.vue's own subtitle computed (the Vue 2 panel's src/views/Photos/
// PhotosPlacesTopbar.vue:32-35) — no `back` (Plan D ruling: back affordances don't go in the
// topbar), no Ask Nimo button (Vue2's own, registered as a Plan G input, not built here).
// PlacesFilterMenu/PlacesThemeMenu were already rendered in-tree (inside the old
// `.photos-layout` subtree) — they stay exactly where they are, now inside `.photos-main`.
// PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade
// tie that F8-r4 guarded against (see the mount site near this file's template root for the full
// note). PlaceCoverPicker is still declared here as
// a template-root sibling too, but as of Task 2 (Plan E) it Teleports its own content to
// `document.body` internally and re-applies `photos-root` + themeClass to its own portal
// root (Vue2 PhotosPlacesView.vue :1338 semantics) — this container no longer needs to do
// anything special for it; its own props/emits wiring below is unchanged.
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PlacesRail from '../photos/components/PlacesRail.vue'
import PlacesMap from '../photos/components/PlacesMap.vue'
import PlacesZoomBar from '../photos/components/PlacesZoomBar.vue'
import PlacesFilterMenu from '../photos/components/PlacesFilterMenu.vue'
import PlacesThemeMenu, { type MapThemeSelection } from '../photos/components/PlacesThemeMenu.vue'
import PlaceDetailPanel from '../photos/components/PlaceDetailPanel.vue'
import PlaceCoverPicker from '../photos/components/PlaceCoverPicker.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useAskNimo } from '../photos/composables/useAskNimo'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosPlaces, type PlaceSpot, type PlaceVisit } from '../photos/stores/places'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosTrash } from '../photos/stores/trash'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import { usePlacesView } from '../photos/composables/usePlacesView'
import { useToast } from '../stores/toast'
import { countCountries, countPhotos, filterPlaces, type Pin, type Place, type PlacesFilter } from '../photos/util/placesMap'
import { mapThemeStyleVars, resolveMapTheme } from '../photos/util/placesMapThemes'
import { assetToPhoto } from '../photos/util/assetToPhoto'

const { t, locale } = useI18n()
// `theme` (Task 6, Plan E) feeds the map's isLight signal (D5 revert, see the `isLight`
// computed below); `themeClass` (pre-existing) drives `.photos-root.is-light` on the shell.
const { theme: photosTheme, themeClass } = usePhotosTheme()
// Task 1 (Plan E re-shell): same shared module singleton every other re-shelled Photos page
// uses (PhotosPeople.vue/PhotosAlbums.vue's own precedent) — toggle wired straight to the
// topbar button.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const router = useRouter()
const store = usePhotosPlaces()
const toast = useToast()
const lb = useLightbox()
// Task 6 (Plan F): real delete/Undo pathway for this page's own PhotoLightbox mount (see
// onLightboxDelete's own comment below for why this page needed them at all).
const timeline = useTimelineStore()
const trash = usePhotosTrash()
const photosToast = usePhotosToast()

const activeId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const filterOpen = ref(false)
const themeOpen = ref(false)
// The failed-state condition must distinguish "hasn't been requested yet" from
// "requested and failed" — during the brief window before onMounted's own
// `await store.fetchPlaces()` (or even just the current synchronous render, before onMounted
// has run at all), `placesLoaded`/`loading` are both still their initial `false`; if the failed
// state only checked those two fields it would hit "failed" on the very first frame (reporting
// failure before a request was even sent). `attempted` only flips true once onMounted actually
// starts a fetchPlaces call — on the first render it's still its initial `false`.
const attempted = ref(false)

// ── Detail panel container state (per Vue2 :114-121). ──────────────
const activeSpotKey = ref<string | null>(null)
const coverOpen = ref(false)
const coverTab = ref('recent')
const coverSearch = ref('')
const coverPage = ref(0)

// The six filter fields from Vue2's data() :76-81, merged into one object; T9's
// PlacesFilterMenu writes it back as a "whole-object replace" (not in-place field mutation).
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

// (deviation 4): activePlace only looks itself up in the list by activeId; activeDetail
// is only accepted when store.detail's own id matches the current activeId — after switching
// cities, before the new detail arrives, store.detail is still the previous city's (Vue2
// :204's `activeDetail || find()` would let the hero briefly show the previous city).
const activePlace = computed<Place | null>(() =>
  store.places.find((p) => String(p.id) === String(activeId.value)) ?? null)
const activeDetail = computed(() =>
  (store.detail && String(store.detail.id) === String(activeId.value)) ? store.detail : null)
const hasPanel = computed(() => activePlace.value != null || activeDetail.value != null)

// Mirrors Vue2's own `currentHero` computed
// (PhotosPlacesView.vue:310-314) exactly — `coverAssetId || thumbs[0] || ''`. This container's
// PlaceCoverPicker `current-asset-id` binding used to read only `activeDetail?.coverAssetId ??
// ''`, missing the `thumbs[0]` fallback: most places have no *explicit* coverAssetId (only set
// once a user picks one via this same dialog) and fall back to their first thumb for a cover —
// so the dialog's own head thumbnail (`.cp-head-thumb`) rendered empty for the common case,
// exactly the reported symptom. PlaceDetailPanel.vue's own `currentHero` (this same file's hero
// image) already gets this right and additionally falls back to `activePlace`'s own cover/thumb
// when `activeDetail` hasn't loaded yet (its own documented deviation 1) — this computed
// deliberately does NOT add that extra place-level fallback, staying exactly at Vue2's own
// `currentHero` semantics for this specific consumer (the cover picker), since Vue2 never falls
// back further than `activeDetail` here either.
const coverHeadThumbAssetId = computed(() =>
  activeDetail.value?.coverAssetId || activeDetail.value?.thumbs[0] || '')

const {
  view, zoomFrac, autoPanTo, zoomToCluster, zoomBy, setScale, reset,
  onWheel, onPointerDown, onPointerMove, onPointerUp, dispose,
} = usePlacesView({ svgEl: svgRef, wrapEl, hasDetailPanel: () => hasPanel.value })

// ── Filtered places (per Vue2 :152-175 / T2's filterPlaces): feeds both the rail and the
// map. The rail's own search is its own internal state (T5's standing decision) — it doesn't
// flow through here and doesn't affect the map either (cross-checked against Vue2 :229/:237,
// confirmed the map only consumes visiblePlaces, not searched).
const filteredPlaces = computed<Place[]>(() => filterPlaces(store.places, filter.value))
const totalPhotos = computed(() => countPhotos(filteredPlaces.value))
const countryCount = computed(() => countCountries(filteredPlaces.value))

// Task 1 (Plan E re-shell): PhotosTopbar's `sub` line mirrors Vue2 PhotosPlacesTopbar.vue's own
// subtitle computed (the Vue 2 panel's src/views/Photos/PhotosPlacesTopbar.vue:32-35) — cities/countries
// counts. Vue2 feeds that component from `placesStats`, itself fed by this same view's own
// `update:visible-stats` emit off `visiblePlaces.length`/`countries` (PhotosPlacesView.vue:341/
// 490) — i.e. the *filtered* set, not the raw fetch total. Reuses filteredPlaces/countryCount
// rather than a second computation so this line can never disagree with the .map-stats footer
// below, which shows the identical two numbers.
const topbarSub = computed(() => t('photosPlacesTopbarSub', {
  cities: filteredPlaces.value.length,
  countries: countryCount.value,
}))

// D5 revert: T10/T11's original decision read the global
// `useThemeStore()` here — this task reverts that back to Vue2's own signal, the photos-private
// theme (`usePhotosTheme()`, same source `themeClass` above already uses to toggle
// `.photos-root.is-light`). Vue2's currentTheme computed reads `this.$store.state.photos.theme`
// (a Vuex module scoped to the Photos area, NOT the app-wide theme module) — `usePhotosTheme()`
// is its Vue3 counterpart. Switching the global app theme must no longer move the map; toggling
// the photos-private theme must (both directions covered by placesMapPerf.test.ts's D5 cases).
const isLight = computed(() => photosTheme.value === 'light')
const resolvedTheme = computed(() =>
  resolveMapTheme(
    store.themePrefs.mapTheme,
    store.themePrefs.customDotColor,
    store.themePrefs.customCityColor,
    isLight.value,
  ),
)
const themeVars = computed(() => mapThemeStyleVars(resolvedTheme.value))
// PlacesZoomBar's own slider accent color reads the .dot from this same resolveMapTheme() result (disambiguation 2).
const dotColor = computed(() => resolvedTheme.value.dot)

// Vue2's own hoverPlace :213 reads this.places (the full list). This looks it up in
// filteredPlaces instead — hovering can only ever happen on a pin actually rendered on the map,
// and pins are built from filteredPlaces, always a subset of it.
const hoverPlace = computed<Place | null>(() => {
  if (!hoverId.value) return null
  return filteredPlaces.value.find((p) => String(p.id) === String(hoverId.value)) ?? null
})
// Vue2 :1014 `v-if="hoverPlace && hoverPlace.id !== activeId"` — the currently selected place doesn't show a tip.
const showHoverTip = computed(() => hoverPlace.value != null && String(hoverPlace.value.id) !== String(activeId.value))
const hoverThumbSrc = computed(() => {
  const p = hoverPlace.value
  if (!p) return ''
  const id = p.coverAssetId || p.thumbs[0] || ''
  return id ? service.photos.thumbnailUrl(id, 'large') : ''
})
// Recorded deviation (consistent with PlacesRail.vue's own existing decision; a deliberate
// choice of "localized dates"): the date follows the i18n locale for display rather
// than replicating Vue2 :1025's raw backend English string; falls back to the original string
// when lastDate is null.
function formatLast(p: Place): string {
  if (!p.lastDate) return p.last
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(p.lastDate)
}

// ── Wiring for the five child components ────────────────────────────────────
function onToggleFold(regionId: string): void {
  store.toggleRegionFold(regionId)
}
// Vue2 :736-743. stopPropagation so the click doesn't keep bubbling into the underlying pan's pointerdown logic.
function onPickPin(pin: Pin, ev: MouseEvent): void {
  ev.stopPropagation()
  if (pin.cluster) {
    zoomToCluster(pin, view.value.scale)
  } else {
    activeId.value = pin.id
  }
}
// Vue2 :744-752, swapped for an explicit wrapEl ref (deviation 10) instead of deriving it from svg.parentElement.
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
// Disambiguation 3: PlacesThemeMenu only emits — the container decides which store action the
// write lands on. Reads always go through store.themePrefs (direct, see the :selection binding
// in the template below). pickPreset always emits a non-'custom' mapTheme (customDotColor/
// customCityColor carried through unchanged); the color picker always emits mapTheme: 'custom'
// (see PlacesThemeMenu.vue's onDotInput/onGridInput). The two branches are mutually exclusive
// and don't overlap.
function onUpdateThemeSelection(next: MapThemeSelection): void {
  if (next.mapTheme === 'custom') {
    store.setCustomColors(next.customDotColor, next.customCityColor)
  } else {
    store.setMapTheme(next.mapTheme)
  }
}

// ── wheel is registered explicitly (deviation 11-⑤). svgRef changes as PlacesMap mounts/unmounts
// (skeleton ↔ map switch), and the listener follows it — the old element is detached first, then
// the new one is attached, so it never double-registers or dangles.
function handleWheel(e: WheelEvent): void {
  onWheel(e)
}
watch(svgRef, (el, prev) => {
  if (prev) prev.removeEventListener('wheel', handleWheel)
  if (el) el.addEventListener('wheel', handleWheel, { passive: false })
})
// flush: 'post' — must wait for the DOM/template ref to commit before PlacesMap's just-mounted instance can be read.
watch(mapRef, (inst) => {
  svgRef.value = (inst as unknown as { svgEl: SVGSVGElement | null } | null)?.svgEl ?? null
}, { flush: 'post' })

// ── activeId watch (Vue2 :291-294): changes and is non-empty → autoPanTo; always loadDetail(next).
// Vue3's own watch() only fires when the value actually changes (unlike a Vue2 watcher, which can
// in theory fire on a no-op), so the redundant `next !== prev` check Vue2 does isn't replicated
// here — `next` being non-empty alone covers "changed and non-empty".
// (per Vue2 :295-301): switching cities resets the cover-picker/spot state — the
// existing autoPanTo + loadDetail lines are unchanged.
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

// ── The three cover-candidate watches (per Vue2 :304-312). Fetch precondition is
// activeId && coverOpen — changing tab/search/page while the popover is closed sends no request
// (deleted-code checklist item ⑧). No debounce added (deviation 15-①; per the user's 2026-07-31
// pre-flight ruling: keep Vue2's own keystroke-by-keystroke request cadence, only keep the
// store-side result-landing seq guard).
// When coverPage > 0, changing tab/search fires a duplicate request
// with identical params twice — this watch itself calls fetchCandidatesIfOpen() once, and
// assigning `coverPage.value = 0` also triggers the coverPage watcher's own
// fetchCandidatesIfOpen() below. Vue2 :304-312 has the same shape (coverTab's/coverSearch's own
// watchers likewise set coverPage=0 first then call loadCoverCandidates(), with the coverPage
// watcher firing again separately) — this is a straight port, not a bug this repo introduced —
// the store's coverSeq race guard ensures the two results never get aliased, it's just one extra
// request, correctness is unaffected.
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

// openCoverPicker() = set coverOpen = true then fetch once (per Vue2 :517-521's toggle
// semantics: fetch on open, don't fetch on close).
function openCoverPicker(): void {
  coverOpen.value = true
  fetchCandidatesIfOpen()
}

// ── Cover submission ─────────────────────────────────────────────────
async function onPickCover(assetId: string): Promise<void> {
  coverOpen.value = false // Per Vue2 :538: close the popover before submitting
  if (!activeId.value) return
  try {
    await store.setPlaceCover(activeId.value, assetId)
  } catch {
    toast.show(t('photosPlacesCoverFailed')) // Deviation 6: Vue2 has no catch
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

// ── The three spot actions ────────────────────────────────────────────
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
// D8. Shares one failure message with rename (the same category of operation on the same
// resource). On success the dialog doesn't close and there's no extra loadDetail call
// (deviation 7: setSpotName already writes detail.spots back in place; resetSpotName refetches
// on its own inside the store). The dialog's own edit state exits on its own once
// props.spot.name changes (already implemented in T4).
async function onResetSpotName(): Promise<void> {
  if (!activeId.value || !activeSpotKey.value) return
  try {
    await store.resetSpotName(activeId.value, activeSpotKey.value)
  } catch {
    toast.show(t('photosPlacesSpotRenameFailed'))
  }
}

// ── Album and toast ───────────────────────────────────────────────────
// This used to call the GENERIC app-wide
// `useToast()` for the save-as-album success toast, rendering as a plain gray pill instead of
// the photos-styled toast every other Places/library flow uses (delete/lightbox — see
// `onLightboxDelete` above, which already calls `photosToast.show(...)`). Vue2's own
// `onPlacesSaveAlbum` (PhotosTimeline.vue:744-764) shows both its success AND failure toasts
// through `window.PhotosToast` — this repo's Vue3 counterpart of that exact host is
// `usePhotosToast()` + `<PhotosToastHost/>` (already mounted on this page's template, see
// below), not the generic `useToast()` store. Switched both branches to `photosToast`,
// `icon: 'album'` matching Vue2's own `icon: 'album'` (PhotosToastHost.vue already maps that
// icon name to Vue2's exact glyph path) — copy/Open-action/duration semantics unchanged.
async function createAlbum(name: string, from?: string, to?: string): Promise<void> {
  if (!activeId.value) return
  try {
    const album = await store.createPlaceAlbum(activeId.value, { name, from, to })
    photosToast.show({
      text: t('photosPlacesAlbumCreated', { name: album.name, count: album.count }),
      icon: 'album',
      duration: 5000,
      action: { label: t('photosPlacesToastOpen'), onClick: () => { void router.push(`/photos/albums/${album.albumId}`) } },
    })
  } catch (e) {
    // A busy re-entry isn't an error, no toast (see T2's albumBusy contract)
    if ((e as Error)?.message !== 'albumBusy') photosToast.show({ text: t('photosPlacesAlbumCreateFailed') })
  }
}
function onSaveAlbum(): void { void createAlbum(activePlace.value?.city ?? '') } // Vue2 :458-462
function onSaveTrip(v: PlaceVisit): void { // Vue2 :463-472
  void createAlbum(`${activePlace.value?.city ?? ''} · ${v.when}`, v.from, v.to)
}

// ── Lightbox (D9). The detail payload only gives an assetId string, no asset object;
// the lightbox's openAt needs a Photo. assetToPhoto({ id }) produces a valid Photo with default
// values, and useLightbox hydrates the real details via getAsset(id) once opened
// (useLightbox.ts:95-124), so a placeholder object is enough. ────────────────────
function onOpenPhoto(assetId: string, list: string[]): void {
  const ids = list.length ? list : [assetId]
  const photos = ids.map((id) => assetToPhoto({ id }))
  const target = photos.find((p) => String(p.id) === String(assetId)) ?? photos[0]
  lb.openAt(target, photos)
}

// ── Task 6 (Plan F): PhotoLightbox event wiring ─────────────────────────────────────────
// This page mounted <PhotoLightbox> with NO listeners at all (delete/add-to-album silently
// no-op'd — the same false-success bug class already found and fixed on
// PhotosSearch.vue, now formally audited and closed here too).
//
// @toggle-fav: no-op, same convention every other host page uses — useLightbox's own
// onToggleFav already optimistically flips favIds and re-renders the star icon internally;
// the emit only matters to a host page that keeps its own separate favorited-items list
// needing a local update (PhotosFavorites.vue). This page's hero/recent/spot photos aren't a
// favorites list, so there's nothing local to react to.
function onLightboxToggleFav(): void {}

// @delete: real timeline.deleteAssets pathway (same as Photos.vue's/PhotosSearch.vue's own
// onLightboxDelete: service.photos.deleteAsset under the hood) + usePhotosToast Undo.
//
// Data-source note (brief's "check each page's data source" requirement): the ids the
// lightbox opens here (hero/recent grid/spot photos) all ultimately come from `store.detail`
// (PlaceDetail: `recent`, `spots[].thumb`, `visits[].thumbs`), which also carries
// server-computed counts (`place.count`, `spot.count`, `visit.photos`) and cover/thumbnail
// picks. Patching any one of those arrays locally risks a stale count or a thumb that now
// points at the just-deleted asset — there is no single "right" array to splice, there are at
// least four, all interdependent. Full refetch via the already-idempotent `store.loadDetail`
// (same call `activeId` watch/`retryLoad` already reuse) is the documented, safer choice —
// a full refetch is an acceptable, documented fallback here.
async function onLightboxDelete(id: string | number): Promise<void> {
  const snapshot = [String(id)]
  await timeline.deleteAssets(snapshot)
  if (activeId.value) void store.loadDetail(activeId.value)
  photosToast.show({
    text: t('photosDeletedToast', { count: 1 }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      onClick: () => {
        void (async () => {
          await trash.restore(snapshot)
          // trash.restore() only refreshes the global timeline store — this page's own
          // place-detail data is a separate fetch, so it needs its own refresh too (same
          // "Undo re-fetches this page's own data source" fallback PhotosSearch.vue's
          // onLightboxDelete documents for its `search.smartSearch` re-run).
          if (activeId.value) void store.loadDetail(activeId.value)
        })()
      },
    },
  })
}

// @add-to-album: single-asset picker, same PhotosMomentDetail.vue/PhotosSearch.vue precedent
// (no batch-selection state exists on this page to clear afterward either).
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
function onAlbumPickerAdded(): void {}

// ── Jump-to-library navigation ────────────────────────────────────────
// Both handlers below used to push to the
// standalone place-assets page (`/photos/places/:key`) — the explicit, binding
// requirement is that "Open in Library"/a spot row's "View in Library" must instead land in
// the actual PHOTO LIBRARY (`/photos`) with a place filter applied, matching Vue2's own
// `onPlacesOpenLibrary`/`onPlacesOpenSpot` (PhotosTimeline.vue:767-793), which drive the
// library's own client-side `places` EXIF facet with the place's city name rather than
// navigating to any per-place page at all (Vue2 has no separate route to navigate to — it's a
// same-page panel switch). New-UI's library (`src/views/Photos.vue`) has no placeKey/spotKey
// facet or per-spot backend fetch (see that file's own `exifFilter`/`onMounted` comment for the
// full account of what's in scope here and what isn't) — only the city-name-based `places`
// facet exists, fed here via a `?libraryPlace=<city>` query key that file reads once on mount.
// The standalone place-assets page itself is untouched (net addition, other entries may still
// use it) — only these two handlers' own navigation target changes.
function goLibrary(): void {
  const city = activePlace.value?.city ?? ''
  if (!city) return
  void router.push({ path: '/photos', query: { libraryPlace: city } })
}
function onOpenSpotLibrary(): void {
  const spot = activeDetail.value?.spots.find((s) => String(s.key) === String(activeSpotKey.value))
  const city = activePlace.value?.city ?? ''
  if (!city || !spot) return
  activeSpotKey.value = null // Per Vue2 :484: close the dialog before navigating away
  // Spot-level precision has no home in the library's existing filter system (see this
  // function group's own header comment) — degrades to the identical city-level jump
  // `goLibrary()` above performs; documented limitation, not an oversight.
  void router.push({ path: '/photos', query: { libraryPlace: city } })
}

// Vue2 :412-413 puts "select places[0] if nothing is selected" inside loadPlaces() itself, so
// every successful load (first page entry, or retry after failure) re-selects and auto-pans.
// T3's store deliberately doesn't do this step (leaving it to the view layer), but that means the
// caller must add this step after **every** successful fetchPlaces call — Review I4: extracted
// into a function that both onMounted and retryLoad call, rather than doing it only once in
// onMounted.
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
  // Task 5 (Plan E #106 perf architecture port): Vue2 beforeDestroy's flush equivalent
  // (git show 78cf3335 :393-397) — the store's theme-persist write is now 250ms-debounced
  // (perf: a picker drag no longer writes localStorage per input event), so a pick made just
  // before navigating away must still be flushed here or it's lost when the timer never fires.
  store.flushThemePersist()
})

async function retryLoad(): Promise<void> {
  await store.fetchPlaces()
  selectFirstIfNeeded()
}
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="t('photosPlaces')"
          :sub="topbarSub"
          :show-search="false"
          show-ask-nimo
          @toggle-collapse="onToggleCollapse"
          @ask-nimo="useAskNimo().openDrawer()"
        />
        <div class="photos-main">
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

            <!-- Loading skeleton (deviation 9, a concept Vue2 has none of). Note: the
                 first frame (before `attempted` flips true) also falls into this branch — onMounted's
                 own fetchPlaces is async, and the first render happens before it actually starts
                 running, so loading is still its initial false at that point too — it must not fall
                 into the "failed" branch. -->
            <div v-if="!store.placesLoaded && (store.loading || !attempted)" class="map-skeleton" data-test="places-skeleton"></div>

            <!-- Load failed (deviation 9). Must be tightened with `attempted`,
                 or "hasn't been requested yet" gets misjudged as "requested and failed". -->
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

              <!-- Detail panel (DOM order doesn't affect stacking — z-index is already
                   fixed at 6 — but keeps the readable "map → panel → tip/furniture" order). -->
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

              <!-- Legend (per Vue2 :1030-1044). The three numeric literals are coupled to T2's own
                   tierRadius (see that function's own comment above); the 4th group's green swaps
                   in the --place-current-trip token (disambiguation / brief §5). -->
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
        </div>
      </main>
    </div>

    <!-- PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade tie that F8-r4 guarded against. -->
    <!-- Task 6 (Plan F): event wiring added -- this mount had none before (delete/add-to-album
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
    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body" shape
         as PhotosToastHost -- Photos has no shared shell to mount this once at. -->
    <AskNimoHost />
  </div>

  <!-- Task 1 (Plan E re-shell): PlaceCoverPicker stays declared here as a template-root sibling
       of the shell, outside `.photos-root` entirely (position:fixed, avoids being clipped by an
       ancestor's transform/overflow, same PhotosPersonDetail.vue:708-710 precedent). It now
       Teleports its own content to `document.body` internally (Task 2, Plan E), so its actual
       rendered DOM lives outside this template entirely regardless of where it's declared —
       this component-tree position only matters for props/emits wiring. -->
  <PlaceCoverPicker
    :open="coverOpen"
    :city="activePlace?.city ?? ''"
    :total-count="activePlace?.count ?? 0"
    :current-asset-id="coverHeadThumbAssetId"
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
</template>

<style scoped>
/* Task 1 (Plan E re-shell): the transitional `.sidebar` flex-width pin and the `.photos-layout`
   flex-row shell (an interim AreaShell workaround) are both gone — the shell is
   now the shared Vue2-structured `.app` CSS Grid (parity photos.scss's own `.app`/`.main` rules
   under `.photos-root`), which already gives the sidebar its pixel-parity column width and the
   page its height cap (same as PhotosPeople.vue's own re-shell; see photosLayoutHeightCap.test.ts
   for why this page no longer needs a local height-capping rule). `.photos-main` survives as
   pure layout scaffolding — no parity selector by that name (same situation as every other
   re-shelled Photos page's own copy) — it's just the flex child that now sits inside `<main
   class="main">`, after `<PhotosTopbar>`, instead of being the `<main>` element itself. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Every `.map-*` rule below has
   been re-diffed property-by-property against `photos-places.scss`'s same-anchor rules (all
   nested under that file's own `.photos-root { … }`, so they already cascade onto this page
   without any local duplicate needed). Properties whose value is byte-identical to parity have
   been deleted outright — parity governs them directly. What's left in each rule is only:
   (a) properties with no parity counterpart at all (a fresh New-UI addition), (b) properties
   parity gives a different value, kept here under an established, previously-documented token
   substitution (cited by name below, not reconstructed by inference), or (c) properties that
   must stay physically present in this file's own source text because a test in
   PhotosPlaces.test.ts parses `PhotosPlaces.vue?raw` directly and asserts on them (the
   `.map-toolbar` pointer-events guard and the `.map-toolbar`/`.map-legend`/`.map-stats`/
   `.map-tip` z-index guards) — those are called out individually where they occur.

   Established token-substitution table this Places area has used since PlacesRail.vue's own
   original task (cited again by PlacesFilterMenu.vue/PlacesThemeMenu.vue/PlacesZoomBar.vue —
   see each of their own scoped-style header comments): `--text-1/2/3` → `--fg`/`--fg-muted`/
   `--fg-subtle`; `--line`/`--line-strong` → `--card-border`; `--surface-1` → `--panel-bg`;
   `--surface-2` → `--chip-bg`; parity's "content-heavy floating panel" pairing `--pop-bg` (+ no
   dedicated shadow token) → New-UI's own equivalent pairing `--popup-bg` + `--card-shadow-hi`
   (PlacesFilterMenu.vue's own citation lists six already-reviewed components using that exact
   pair for opaque dropdown/floating panels). `--font-display` → `--font` is the same substitution
   PlacesRail.vue's own `.map-rail-head h2` already made (uncited there, but consistently applied —
   cited explicitly here). Parity's `--r-sm`/`--r-md` corner-radius tokens have no New-UI
   equivalent at all (already flagged by the comment kept below) — those
   spots keep their approximated literal px values, unchanged. */

/* Vue2 scss:29-36's .map-shell only has three rules — flex/grid/background — no
   border/corner-radius/overflow. These three (border/border-radius/overflow:hidden) are a
   New-UI addition, giving the whole map area a unified card frame (the existing convention for
   every other full-screen container in this area), not part of the pixel-parity port —
   registered but not reverted.
   `flex`/`min-height`/`display`/`grid-template-columns`/`gap` all matched parity byte-for-byte
   (parity: `flex: 1`, this rule previously duplicated `flex: 1 1 auto` — flagged by review as
   undocumented; corrected to parity's exact value since a single-child flex column behaves
   identically either way, so there was no reason to diverge) and have been deleted; `background`
   deviates from parity's `var(--surface-0, #0A0A0C)` (a token that is never actually defined
   anywhere in this codebase, so it always resolves to that literal near-black fallback — a
   theme-invariant Vue2 literal) under the same D3 "surface treatment is New-UI's to reshape"
   ruling `.map-canvas-wrap`'s own background uses just below, not a separate ad-hoc choice.

   Correction: the D3 reshape had picked the wrong
   token family. `background: var(--panel-bg)` and `border: 1px solid var(--card-border)` are
   *global* New-UI glass tokens (src/styles/theme.css) — `--panel-bg` is a translucent WHITE
   glass overlay in BOTH of theme.css's own blocks (a low-alpha white wash, see that file's own
   two token definitions for the exact alpha in each theme), meant for a frosted panel floating
   over a photo/wallpaper backdrop, not for painting an entire opaque view's own base surface.
   Stacked under this view's actual content, that translucent white wash read as a light
   frame/halo around the whole map area even in Photos' own DARK theme — the reported
   bug, exactly. It also never follows Photos' own private theme toggle (`.photos-root.is-light`,
   `usePhotosTheme()`) at all, only the unrelated global `[data-theme]` attribute — same root
   cause class as `photosGlassSurfaces.test.ts`'s already-documented `PhotosSmartViewDetail.vue`/
   `.sv-detail-side` fix. Switched to this file's own local, opaque, is-light-aware tokens:
   `--surface-1` (photos.scss:16/102, a flat fully-opaque color in both of Photos' own themes —
   the same token parity's own sibling `.places-view-root` rule above already uses for this
   exact "outermost view frame" role) and `--line` (photos.scss:19/105, the thinner of the two
   local border tokens, matching this rule's own visual weight as a subtle card outline, not a
   popover's stronger `--line-strong`). */
.map-shell {
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

/* `position`/`display`/`flex-direction`/`min-height`/`overflow` all matched parity
   byte-for-byte and have been deleted; only `background` survives, under the same D3 ruling
   cited above. */
.map-canvas-wrap {
  /* Vue2 photos-places.scss:196 is a hardcoded deep-space gradient literal; only the letterbox
     area (the blank space SVG's preserveAspectRatio leaves) shows this base color. D3: the
     layout structure follows Vue2, but the base color belongs to "component system / surface
     treatment", which is New-UI's to reshape — same standing ruling as PlacesFilterMenu.vue's
     own popover base color, switched to a base gradient that follows the app theme instead of
     precisely replicating this theme-invariant deep-space literal.
     Correction: the reshape had picked `var(--panel-bg)`, the same
     global translucent-white glass token `.map-shell` above wrongly used — same bug (a white
     wash under the map canvas contributing to the reported light-frame-in-dark-theme look, and
     not following Photos' own private is-light toggle at all). Switched to this file's own
     local, opaque, is-light-aware `--surface-1` (see `.map-shell`'s own comment above for the
     full token citation), same substitution, same rationale. */
  background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 6%, var(--surface-1)) 0%, var(--surface-1) 70%);
}

/* `top`/`left`/`right`/`display`/`align-items`/`gap` all matched parity byte-for-byte and have
   been deleted. `z-index` and `pointer-events` survive for two different reasons, each noted at
   its own declaration below. */
.map-toolbar {
  /* Recorded deviation (found in on-device testing; a Vue2 defect, deliberately fixed here
     rather than copied as-is): Vue2 photos-places.scss:199-207 (.map-toolbar)
     and :234-245 (.map-zoombar) both set z-index: 4 — .map-toolbar forms its own stacking
     context because it's position:absolute with a non-auto z-index, so its inner popovers
     (PlacesFilterMenu.vue's/PlacesThemeMenu.vue's own z-index: 30) only compete within the
     toolbar, and can never beat the sibling .map-zoombar. At equal z-index, DOM order wins, and
     in the template .map-zoombar (PlacesZoomBar.vue) comes after .map-toolbar, so the zoom bar
     paints over the Filters/theme popovers — in Vue2, opening either popover lets the zoom bar
     poke straight through the middle of it. This repo raises the toolbar from 4 to 7: this
     area's existing stacking ladder is 4 (map furniture — zoombar/legend/stats) < 5 (.map-tip) <
     6 (reserved for the P6b detail panel) < 7 (here), so 7 lets the toolbar and its own inner
     popovers reliably sit above every overlay in the map area, without taking the 6 reserved for
     P6b. */
  z-index: 7;
  /* Same value as parity (`pointer-events: none`) — kept here anyway, not deleted, because
     PhotosPlaces.test.ts's own ".map-toolbar 的 pointer-events 守卫" test parses THIS file's
     raw source text and regexes for this exact declaration inside `.map-toolbar { … }`; relying
     on parity to supply it would make that guard's regex find nothing and fail. Ported straight
     from Vue2 scss:199-207's transparent band + restoring pointer events on child elements —
     otherwise this toolbar would swallow the map's drag gestures. */
  pointer-events: none;
}
/* Same-value duplicate of parity's identical rule, kept for the same raw-text-guard reason as
   `pointer-events: none` above (the same test asserts on this selector too). */
.map-toolbar > * { pointer-events: auto; }

/* `display`/`gap`/`padding`/`background`/`backdrop-filter`/`border-radius` all matched parity
   byte-for-byte and have been deleted. `border` survives, now under the *corrected* `--line`
   token (see `.map-shell`'s own comment above for the full account
   of why this section's former `--line` → `--card-border` substitution table was itself the
   bug: `--card-border` is a *global* token, only following the app-wide `[data-theme]`
   attribute, not Photos' own private `.photos-root.is-light` toggle — every rule below that used
   to cite that table has been corrected the same way, one deviation-comment for the whole
   sweep instead of repeating it per rule). */
.map-chip-row {
  border: 1px solid var(--line);
}
/* Byte-identical to parity's `.map-spacer { flex: 1; }` — deleted entirely, parity governs. */

/* Loading/failed (deviation 9, a New-UI addition). No parity counterpart at all for
   `.map-skeleton`/`.map-failed`/`.map-failed-title` (grep-confirmed against
   photos-places.scss) — Vue2 has no loading-skeleton/failed-state concept for this view (see
   this file's own script-header deviation 9), so there is nothing to diff these three selectors
   against; pure survivors.
   `--skeleton-bg`/`--fg-muted`/`--fg` were the same global-token bug (see
   `.map-chip-row`'s comment above) — corrected to local `--surface-2`/`--text-2`/`--text-1`. */
.map-skeleton {
  flex: 1; margin: 16px; border-radius: 16px;
  background: var(--surface-2);
}
.map-failed {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--text-2); text-align: center;
}
.map-failed-title { font-size: 14px; font-weight: 600; color: var(--text-1); }

/* Hover card (per Vue2 photos-places.scss:437-473). This repo has no equivalent to
   Vue2's --r-md/--r-sm corner-radius tokens, so the few corner radii below are literal px values
   taken from the nearest fit, not a precise replica of those two tokens (the numbers differ;
   non-negative numeric literals aren't governed by the color-guard — registered, no new token
   added).
   `position`/`transform`/`padding`/`display`/`gap`/`align-items`/
   `min-width`/`backdrop-filter` all matched parity byte-for-byte and have been deleted.
   `z-index: 5` is a same-value duplicate kept only because PhotosPlaces.test.ts's own
   `.map-toolbar 层叠顺序守卫` test reads `zIndexOf(rules, '.map-tip')` off this file's raw
   source text (see that test's own comment for why).
   Correction: `background`/`border`/`box-shadow` used to cite a
   `--pop-bg` → `--popup-bg`+`--card-shadow-hi` "pairing" — but `--popup-bg`/`--card-shadow-hi`/
   `--card-border` are *global* New-UI tokens (only following the app-wide `[data-theme]`
   attribute), while `--pop-bg` is this area's own Photos-local, is-light-aware token
   (photos.scss:56/116) — there was never a real "pairing" needed, `--pop-bg` alone is the
   correct local counterpart parity itself uses for this exact selector (photos-places.scss's
   own `.map-tip` rule). `box-shadow` is switched to Vue2/parity's own literal value (see that
   declaration's own theme-exception comment below for the exact figure, photos-places.scss:467)
   instead of the global shadow token — Vue2 never themes this shadow either (same literal in
   both of Photos' own themes), so a plain literal is the exact parity value, not an
   approximation. `border-radius` keeps the `--r-md` px-approximation the M4 note above already
   covers (unrelated to this fix). */
.map-tip {
  z-index: 5;
  pointer-events: none;
  background: var(--pop-bg);
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  /* theme-exception: Vue2/parity's own literal drop shadow (black at 55% alpha) —
     theme-invariant in Vue2 itself (same value in both of Photos' own themes), not a token
     substitution. */
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.55);
}
/* Vue2 scss:453's thumbnail placeholder background is a hardcoded pure black; here
   it's switched to this area's own local --surface-2 (follows Photos' own private theme),
   not a precise replica of that theme-invariant black background — same D3 ruling, surface
   treatment is New-UI's to reshape. This used to mistakenly use the global --chip-bg (only
   follows the global data-theme, not Photos' own private is-light), switched back to this
   area's own local token.
   `width`/`height`/`overflow`/`flex-shrink` matched parity byte-for-byte and have been deleted;
   `border-radius` keeps the same `--r-sm` literal-px approximation the M4 note above covers. */
.map-tip .thumb { border-radius: 8px; background: var(--surface-2); }
/* Byte-identical to parity's `.map-tip .thumb img` rule — deleted entirely, parity governs. */
/* `font-size`/`font-weight` matched parity byte-for-byte and have been deleted; `color`
   corrected from the global `--fg` to local `--text-1` — see `.map-chip-row`'s
   comment above for why the former global-token substitution table was itself the bug. */
.map-tip .name { color: var(--text-1); }
/* `font-size`/`margin-top` matched parity byte-for-byte and have been deleted; `color`
   corrected from the global `--fg-subtle` to local `--text-3`. */
.map-tip .meta { color: var(--text-3); }
/* `content`/`position`/`left`/`bottom`/`transform`/`width`/`height` all matched parity
   byte-for-byte and have been deleted (this pseudo-element still gets them from parity's own
   identical `.map-tip::after` rule, which cascades onto any `.photos-root` descendant — deleting
   a duplicate declaration here doesn't remove the property, only the local copy of it).
   `background`/`border-right`/`border-bottom` corrected to the same local
   `--pop-bg`/`--line-strong` pair `.map-tip` itself uses above. */
.map-tip::after {
  background: var(--pop-bg);
  border-right: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
}

/* Legend (per Vue2 photos-places.scss:285-309).
   `position`/`bottom`/`left`/`display`/`align-items`/`gap`/
   `padding`/`background`/`backdrop-filter` all matched parity byte-for-byte and have been
   deleted. `z-index: 4` is a same-value duplicate kept only because
   PhotosPlaces.test.ts's `.map-toolbar 层叠顺序守卫` test reads `zIndexOf(rules,
   '.map-legend')` off this file's raw source text.
   `border`/`color` corrected from the global `--card-border`/
   `--fg-subtle` to local `--line`/`--text-3` — see `.map-chip-row`'s comment above. */
.map-legend {
  z-index: 4;
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--text-3);
}
/* Byte-identical to parity's `.map-legend .grp` rule — deleted entirely, parity governs. */
/* The box-shadow's 0.2 alpha precisely replicates Vue2 scss:304's own technique of taking the
   same alpha for accent — this repo has no RGB-triplet token for accent, so it uses color-mix
   directly on var(--accent) for that exact alpha instead, the same technique
   PlacesFilterMenu.vue's own .map-chip.is-active already uses — no new token, no approximation.
   `display`/`background`/`border-radius` matched parity byte-for-byte and have been deleted;
   only the differing `box-shadow` alpha-technique survives. This rule must still exist under
   this exact selector (not merged away) — PhotosPlaces.test.ts's own specificity test
   (`第四组的选择器优先级真的高于基类...`) parses this file's raw text for a standalone rule
   whose only selector is `.map-legend .dot`. */
.map-legend .dot { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent); }
/* `.dot.s1`/`.s2`/`.s3` width/height all matched parity byte-for-byte (photos-places.scss:
   306-308) — all three rules deleted entirely, parity governs. */
/* `font-weight: 500` matched parity byte-for-byte and has been deleted; `color` corrected
   from the global `--fg-muted` to local `--text-2`. */
.map-legend b { color: var(--text-2); }
/* No parity counterpart (Vue2 has no dedicated 4th-tier "current trip" legend class) — pure
   survivor, see the `.dot.dot-trip` comment just below for the full story on this tier. */
.map-legend .legend-trip { margin-left: 6px; }
/* The 4th group's green swaps in the T6-established --place-current-trip token instead of
   replicating Vue2 :1041's inline literal (a deliberate, documented decision). The
   box-shadow's 0.2 alpha uses the same technique as above, applied to --place-current-trip.
   A sibling pitfall to the hover-cascade iron rule (the "equal specificity surviving
   on source order alone" pattern, hit repeatedly in this port): the selector must be
   written as `.map-legend .dot.dot-trip` (two classes, specificity 0,3,0), not just
   `.map-legend .dot-trip` (0,2,0) — that would tie with `.map-legend .dot` above (also 0,2,0)
   and only win by "happening to come later"; reordering the style block would silently revert it
   back to the accent color. cssCascade.ts's own winningHoverBackground family is designed for
   :hover states, which don't apply here, so this uses parseCssRules to compare selector
   specificity directly instead (see the test). */
.map-legend .dot.dot-trip {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}

/* Stats (per Vue2 photos-places.scss:311-330).
   `position`/`bottom`/`right`/`display`/`gap`/`padding`/`background`/`backdrop-filter`/
   `font-size` all matched parity byte-for-byte and have been deleted. `z-index: 4` is a
   same-value duplicate kept only because PhotosPlaces.test.ts's own stacking-order guard test
   reads `zIndexOf(rules, '.map-stats')` off this file's raw source text. `border` corrected
   from the global `--card-border` to local `--line` — see `.map-chip-row`'s comment above.
   `border-radius` keeps its `--r-md` px-approximation (M4 note above, unrelated to this fix). */
.map-stats {
  z-index: 4;
  border: 1px solid var(--line);
  border-radius: 12px;
}
/* `display`/`font-size`/`font-weight`/`letter-spacing` all matched parity byte-for-byte and
   have been deleted. `font-family` keeps the deliberate `--font-display` → `--font` swap
   (PlacesRail.vue's own `.map-rail-head h2` precedent, cited above — not a color, and `--font`
   deliberately carries CJK fallbacks `--font-display` doesn't, so this one stays as-is).
   `color` corrected from the global `--fg` to local `--text-1`. */
.map-stats .stat .v { font-family: var(--font); color: var(--text-1); }
/* `font-size` matched parity byte-for-byte and has been deleted; `color` corrected from the
   global `--fg-subtle` to local `--text-3`. */
.map-stats .stat .k { color: var(--text-3); }

/* At or below 768px: the sidebar is already collapsed to a drawer, so the map's own two columns
   (rail + canvas) also collapse to a single column to avoid horizontal overflow. */
@media (max-width: 768px) {
  .map-shell { grid-template-columns: 1fr; }
}
</style>
