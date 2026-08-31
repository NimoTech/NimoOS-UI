<script setup lang="ts">
// The album list view — card grid + sort + the three new-album fill
// modes (empty/recent/select; the Ask Nimo branch is deliberately not built here) +
// empty state. The structure follows the Vue 2 panel's
// src/views/Photos/PhotosAlbumsView.vue:16-86 (banner+grid), :99-165 (new-album modal).
// Route registration is left for T11.
//
// Shared re-shell: the shell moves from AreaShell + a `.photos-layout` flex
// row to Photos.vue's Vue2 structure `.photos-root[themeClass] > .app[data-collapsed] >
// PhotosSidebar + main.main` (the Vue 2 panel's PhotosTimeline.vue:943-956) — `collapsed` now comes
// from the shared composable useSidebarCollapse(), rather than state this
// page never had (the albums page had never persisted a collapsed state, so PhotosSidebar was
// always eating the prop default of false, i.e. permanently expanded — a gap in its own right,
// closed here along with the re-shell). These five Vue2 pages have no PhotosTopbar (that is
// timeline-only); the banner is the header, so no extra top bar is added.
// On dropping AreaShell: same conclusion as Photos.vue Task 3 — on desktop (≥769px)
// `.area-bar` is indeed display:none, but `.area-body` still carries 20px of padding plus a
// flex wrapper, which conflicts with the `.app` grid's own 100vh and zero padding, so it goes
// too. Known leftover (deliberately not fixed here): AreaShell's `.area-bar`
// was this page's only way to open the sidebar drawer on ≤768px screens (the hamburger
// button), and that entry point disappears with the shell — the same temporary gap Photos.vue
// had between its Task 3 and Task 4 (it too lost the entry point until Task 4 wired the toggle
// into PhotosTopbar). This page has no topbar to wire it into, and this task deliberately
// adds no extra wiring beyond :data-collapsed, so it is left alone — the
// sidebar drawer is temporarily unreachable on mobile, to be handled by a later task.
//
// Clicking a card navigates to a real route (Vue2 kept it as in-page openAlbumId state) —
// router.push('/photos/albums/' + view.id); hard rule: id may be numeric, string
// concatenation already calls toString() automatically, no extra String() wrap needed.
//
// Sort: hooks into util/mixedAlbums.ts's sortMixed (sort logic is not reimplemented in this
// view; see the comment on the views computed below for the T2 wrap-up fix). The sort dropdown
// and the new-album modal's Esc/click-outside-to-close both listen at the document level
// (attached once in onMounted, cleanly removed in onUnmounted) rather than the template's
// @keydown.esc — the same semantics as Vue2's two global listeners in mounted/beforeDestroy
// (:240-259); the component itself mounts/unmounts with the route (unlike T6
// PhotosLibraryPicker, which is a v-if-controlled child), so it follows Vue2's one-shot
// mount/unmount directly, rather than the "add/remove listeners on the open prop's watch"
// pattern used by T5/T6.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosIcon from '../photos/components/PhotosIcon.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import SmartViewCreateDialog from '../photos/components/SmartViewCreateDialog.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useAskNimo } from '../photos/composables/useAskNimo'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSmartViews, type SmartView } from '../photos/stores/smartViews'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import { albumToView, type AlbumView } from '../photos/util/albumView'
import { buildMixedAlbums, sortMixed, type MixedSortId } from '../photos/util/mixedAlbums'
import { isConflict } from '../photos/util/httpErrors'

// 'nimo' is the fourth fill option (Vue2 939a7d3a:PhotosAlbumsView.vue
// :329-336's sourceOptions, 4th entry) -- picking it swaps the panel body for the
// embedded smart-view creation form.
type SourceId = 'empty' | 'recent' | 'select' | 'nimo'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
// `toggle` wires the topbar's collapse button,
// same as Photos.vue's own `onToggleCollapse` (Photos.vue:104).
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const router = useRouter()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const smartViews = usePhotosSmartViews()
const settings = usePhotosSettingsStore()
const toast = useToast()

const sort = ref<MixedSortId>('created')
const sortOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)

const createOpen = ref(false)
const creating = ref(false)
const newAlbumTitle = ref('')
const newAlbumSource = ref<SourceId>('empty')
const newAlbumInputRef = ref<HTMLInputElement | null>(null)

const pickerOpen = ref(false)
const pickerAlbumId = ref<string | number>('')
const pickerAlbumName = ref('')

// Re-evaluates on a hot locale switch (per the existing lesson from Vue2 :192 — a computed
// rather than baking a copy into data()).
const sortOptions = computed(() => [
  { id: 'created' as MixedSortId, label: t('photosAlbumSortCreated'), hint: t('photosAlbumSortCreatedHint') },
  { id: 'name' as MixedSortId, label: t('photosAlbumSortName'), hint: t('photosAlbumSortNameHint') },
  { id: 'name-r' as MixedSortId, label: t('photosAlbumSortNameR'), hint: t('photosAlbumSortNameRHint') },
  { id: 'count' as MixedSortId, label: t('photosAlbumSortCount'), hint: t('photosAlbumSortCountHint') },
  { id: 'date' as MixedSortId, label: t('photosAlbumSortDate'), hint: t('photosAlbumSortDateHint') },
])
const sourceOptions = computed(() => [
  { id: 'empty' as SourceId, label: t('photosAlbumFillEmpty'), hint: t('photosAlbumFillEmptyHint') },
  { id: 'recent' as SourceId, label: t('photosAlbumFillRecent'), hint: t('photosAlbumFillRecentHint') },
  { id: 'select' as SourceId, label: t('photosAlbumFillSelect'), hint: t('photosAlbumFillSelectHint') },
  // Vue2 :329-336, 4th entry: picking this swaps the panel body for the
  // embedded SmartViewCreateDialog instead of opening a second modal.
  { id: 'nimo' as SourceId, label: t('photosSvLetNimoDraft'), hint: t('photosSvLetNimoDraftHint') },
])

// PhotosTopbar's title/sub for the 'albums' nav
// -- Vue2 topbarTitle's 'albums' branch is literally `this.$t('Albums')`
// (PhotosTimeline.vue:187, this repo's own photosAlbumsTitle key already carries that exact
// string) and topbarSubContext's 'albums' branch sums photoCount/videoCount across every
// album, list AND smart alike (PhotosTimeline.vue:226-232) -- NOT the album *count* the
// banner's own .albums-sub already shows a few lines below in the template.
const topbarTitle = computed(() => t('photosAlbumsTitle'))
const topbarSub = computed(() => {
  const totalPhotos = albums.albums.reduce((sum, a) => sum + (Number((a as Record<string, unknown>).photoCount) || 0), 0)
  const totalVideos = albums.albums.reduce((sum, a) => sum + (Number((a as Record<string, unknown>).videoCount) || 0), 0)
  return t('photosCountSummary', { photos: totalPhotos.toLocaleString(), videos: totalVideos.toLocaleString() })
})

// Vue2 939a7d3a:PhotosAlbumsView.vue:391-393: one grid for both kinds, ranked
// by the single Sort control -- smart albums are no longer pinned to the front.
const mixedItems = computed(() =>
  sortMixed(
    buildMixedAlbums(
      albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))),
      smartViews.smartViews,
    ),
    sort.value,
  ),
)
const currentSort = computed(() => sortOptions.value.find((s) => s.id === sort.value) ?? sortOptions.value[0])

// Vue2 :79-85 moved this banner from the smart-views page to here along with the smart
// albums themselves. `=== false` is load-bearing: a missing field and a failed fetch both
// mean "on" (settings.ts already encodes that), and only an explicit off should warn.
const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)

function coverUrl(view: AlbumView): string {
  // Only generate a thumbnail URL for a real asset id; an empty album/no cover falls through
  // to the .album-cover-fallback gradient placeholder (same semantics as Vue2 :274-281, but
  // New-UI always goes through service.photos.thumbnailUrl rather than hand-building the URL).
  if (view.cover == null || view.cover === '') return ''
  return service.photos.thumbnailUrl(view.cover, 'large')
}

// Vue2 9f7e941f:PhotosAlbumsView.vue's smartCoverUrl: a smart album card
// now shows a single cover, seeds[0], exactly like a manual album card -- not the old
// three-image collage. Missing or empty seeds return '' so the template falls through to the
// same .album-cover-fallback the manual card uses; it must never render an <img> with an
// empty src.
function smartCoverUrl(sv: SmartView): string {
  const seed = sv.seeds[0]
  if (!seed) return ''
  return service.photos.thumbnailUrl(seed, 'large')
}

function pickSort(s: { id: MixedSortId }): void {
  sort.value = s.id
  sortOpen.value = false
}

function openCard(view: AlbumView): void {
  router.push('/photos/albums/' + view.id)
}

function openSmartCard(id: string): void {
  router.push('/photos/smart-views/' + id)
}

function openCreate(): void {
  newAlbumTitle.value = ''
  newAlbumSource.value = 'empty'
  createOpen.value = true
  void nextTick(() => { newAlbumInputRef.value?.focus() })
}
function closeCreate(): void {
  createOpen.value = false
}

// Vue2 :521-524: clicking the disabled nimo option is a no-op, the same
// defensive guard the old standalone New Smart Album button had. Reuses `aiSmartViewOff`
// directly rather than a same-meaning synonym computed.
function selectSource(s: { id: SourceId }): void {
  if (s.id === 'nimo' && aiSmartViewOff.value) return
  newAlbumSource.value = s.id
}

// Vue2 :575-578: the embedded form reports success -- the store already
// unshifted the new smart view into the list, so there is nothing to insert and nowhere to
// navigate. Just close the shared panel and stay on the list.
function onSmartAlbumCreated(): void {
  closeCreate()
}

// Follows Vue2 :309-358 (minus the nimo branch, Task 4 added back the short-circuit):
// creation succeeds → branch on source → toast → finally close the modal.
async function confirmCreate(): Promise<void> {
  // Vue2 :525-530: with nimo picked, the panel body *is* the smart form
  // and it owns its own submit (SmartViewCreateDialog's confirm()). Falling through here
  // used to create a throwaway empty manual album first before handing off -- Vue2's own
  // fix for that bug, ported here rather than reintroduced.
  if (newAlbumSource.value === 'nimo') return
  const title = newAlbumTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    // Deliberately diverges from Vue2 here (Vue2's own behavior here was a defect, fixed in
    // this port): Vue2's album list was never a standalone route — it was a v-else-if sub-block
    // inside PhotosTimeline.vue switched on activeNav (the Vue 2 panel's src/router/route.js:206-208
    // registers only a single /photos route), and PhotosTimeline.mounted() unconditionally
    // dispatches fetchTimeline regardless of activeNav, so under Vue2 "the timeline data is
    // necessarily already loaded" was a structural guarantee that came from the parent
    // component's warm-up. New-UI turned albums into a standalone real route
    // (/photos/albums), so that guarantee no longer holds: when a user deep-links or refreshes
    // straight into this page having never visited /photos, timeline.allPhotos is an empty
    // array, and without an extra fetchTimeline here this would silently create an empty album
    // plus a fake "created" success toast, with zero error signal. The guard added here only
    // fetches when the timeline hasn't been pulled yet (to avoid a pointless refetch when the
    // user navigates over from the timeline view).
    // Unify the emptiness check on timeline.months (already the pattern
    // in PhotosLibraryPicker.vue:114) — months is a 1:1 map of timelineGroups (timeline.ts:60),
    // so the two always have equal length and are always true/false together; unify on the
    // semantics the consumer actually cares about ("are there any months to show"), rather than
    // leaving two equivalent spellings around.
    //
    // Task 8b: bucket mode hands us months without their photos -- the guard above is
    // satisfied while allPhotos is still empty, which used to make this create an empty
    // album and report success. Two buckets always cover a 30-day window (the current
    // month plus the previous one). fetchNewestBuckets is a no-op outside bucket mode, so
    // the legacy behaviour above is unchanged.
    let recentIds: Array<string | number> | null = null
    if (newAlbumSource.value === 'recent') {
      if (timeline.months.length === 0) {
        await timeline.fetchTimeline()
      }
      await timeline.fetchNewestBuckets(2)
      const cutoff = Date.now() - 30 * 86400000
      recentIds = timeline.allPhotos
        .filter((p) => {
          const ts = p.takenAt ? Date.parse(String(p.takenAt)) : 0
          return ts >= cutoff
        })
        .map((p) => p.id)
      // Task 8b guard: no recent photos in hand -- do not create an empty album and do
      // not report success. (Previously this always created the album first, then silently
      // skipped addAssetsToAlbum when ids was empty while still showing the success toast.)
      if (recentIds.length === 0) {
        toast.show(t('photosAlbumCreateFailed'))
        return
      }
    }

    const created = await albums.createAlbum(title)
    const albumId = created?.id as string | number | undefined

    if (recentIds && albumId != null) {
      await albums.addAssetsToAlbum(albumId, recentIds)
    } else if (newAlbumSource.value === 'select' && albumId != null) {
      // Pre-fetch the album's assets so PhotosLibraryPicker's existingIds is correct from the
      // moment it opens (per Vue2 :330-335).
      await albums.fetchAlbumAssets(albumId)
      pickerAlbumId.value = albumId
      pickerAlbumName.value = title
      pickerOpen.value = true
    }

    toast.show(t('photosAlbumCreatedToast', { name: title }))
  } catch (e) {
    console.error('[albums] createAlbum', e)
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
  } finally {
    // Vue2 :354-357 closes the modal in finally (not only on success) — closing the modal on
    // the select branch doesn't affect the already-open pickerOpen (the two are independent
    // v-if layers).
    createOpen.value = false
    creating.value = false
  }
}

// With PhotosLibraryPicker generalised, three things it used to do itself
// come back to the caller — the write, the success/failure toasts, and closing the panel (the
// component now only picks photos and hands the ids over). Everything below reproduces its
// previous behaviour one for one: the same addAssetsToAlbum, the same photosAlbumAddedToast
// (album name + count), the same photosAlbumAddFailed, closing on success only (a failure leaves
// the panel up with the selection still in it, ready to retry), and the fetchAlbums refresh that
// used to hang off `@added`.
//
// The String() here is load-bearing, not decoration: album assets come back from the API with
// numeric ids while timeline photos carry string ids, so without it the picker would stop
// recognising a single already-in photo. Asserted in this page's own test with a numeric fixture.
const pickerExistingIds = computed(
  () => new Set(albums.assetsOf(pickerAlbumId.value).map((p) => String(p.id))),
)
// The button label used to be photosAlbumPickerAdd (with the selected count) inside the
// component; the caller supplies it now. Passing a function rather than a fixed string is what
// keeps the count moving with the selection.
function pickerSubmitLabel(count: number): string {
  return t('photosAlbumPickerAdd', { count })
}
const pickerAdding = ref(false)
async function onPickerConfirm(ids: Array<string | number>): Promise<void> {
  if (pickerAdding.value) return
  pickerAdding.value = true
  const albumId = pickerAlbumId.value
  const name = pickerAlbumName.value
  try {
    await albums.addAssetsToAlbum(albumId, ids)
    toast.show(t('photosAlbumAddedToast', { count: ids.length, name }))
    pickerOpen.value = false
    void albums.fetchAlbums()
  } catch (e) {
    console.error('[albums] addAssetsToAlbum', e)
    toast.show(t('photosAlbumAddFailed'))
  } finally {
    pickerAdding.value = false
  }
}

// Final review Important 1 (whole-branch wrap-up): when fetchAlbums fails, albumsLoaded stays
// false (see albums.ts's comment, deliberately unchanged), so under the old implementation
// `isEmpty = albums.albumsLoaded && albums.albums.length === 0` was therefore always false
// → it fell into the grid branch, rendering the "My Albums" section head plus a bare create
// tile with no failure notice/retry entry point at all — the same defect already closed on
// PhotosFavorites.vue/PhotosAlbumDetail.vue (P8a Task 9), same store, same symbol (loadError);
// this closes the third spot. The pattern is copied straight from those two sibling pages'
// established shape: a local retrying guard (not in the store) + disabled feedback + reusing
// the same fetchAlbums.
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

// Mirrors Vue2's two global listeners at :240-259, cleanly removed in onUnmounted.
function onDocMousedown(e: MouseEvent): void {
  if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortOpen.value = false
  }
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (createOpen.value) {
    closeCreate()
    return
  }
  if (sortOpen.value) sortOpen.value = false
}

onMounted(() => {
  void albums.fetchAlbums()
  // Both fetches are fire-and-forget: the two halves of the grid render independently,
  // so a smart-view failure must not gate the manual albums. Vue2 :414-417 awaited both
  // because its deep-link arbitration needed them together -- New-UI has no such
  // arbitration (usePhotosDeepLinks sends ?smartview= straight to the detail route).
  void smartViews.fetchSmartViews()
  void settings.fetchAiFeatures()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Same narrow-mode coordination as
           Photos.vue -- the topbar's own collapse button
           now delegates to the sidebar drawer on narrow viewports, so the sidebar's floating
           trigger would be a redundant second affordance here. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="topbarTitle"
          :sub="topbarSub"
          :show-search="false"
          show-ask-nimo
          @toggle-collapse="onToggleCollapse"
          @ask-nimo="useAskNimo().openDrawer()"
        />
       <div class="photos-main">
        <div class="albums-banner">
          <div>
            <h1>{{ t('photosAlbumsTitle') }}</h1>
            <div class="albums-sub">{{ t('photosAlbumsCount', { count: mixedItems.length }) }}</div>
          </div>
          <div class="albums-actions">
            <div ref="sortMenuRef" class="albums-sort-wrap">
              <!-- Was `class="bar-btn"` -- a *global*
                   New-UI button class (theme.css), not Vue2's real class for this button
                   (the Vue 2 panel's PhotosAlbumsView.vue:60 uses `class="btn"`, parity's own
                   `.photos-root .btn`, photos.scss:290-298). `.bar-btn`'s chrome
                   (`--chip-bg`/`--chip-border`/`--fg`) is not shadowed on `.photos-root`, so it
                   doesn't follow the private photos-is-light toggle -- in photos light mode
                   `--chip-bg`'s dark-theme value (a translucent *white* glass gradient) sits on
                   the parity light page's own near-white background and effectively
                   disappears, same for the border. The visible result: bare text, no
                   border, no background. `.btn` is theme-correct throughout (--surface-2/--line/
                   --text-1, all `.photos-root`-scoped and already correctly shadowed under
                   `.photos-root.is-light`) and is the button Vue2 itself actually uses here.
                   Renamed to match; no local override needed, parity's own rule governs
                   directly. The "New album" button next to it (`bar-btn btn-primary`) is
                   unaffected by this same underlying bug -- `.btn-primary`'s own solid
                   `--accent` fill (also `.photos-root`-scoped) already wins over `.bar-btn`'s
                   background regardless of theme, which is why the owner reported it as fine
                   and it is left untouched. -->
              <button type="button" class="btn" data-test="albums-sort-btn" @click.stop="sortOpen = !sortOpen">
                <!-- Was missing entirely -- Vue2
                     (PhotosAlbumsView.vue:60-61) leads this button with
                     `<photos-icon name="filter" :size="13"/>`. Root cause was a missing icon
                     element, not a wrong/unmapped icon name -- this button never had a leading
                     icon at all. -->
                <PhotosIcon name="filter" :size="13" data-test="albums-sort-icon" />
                {{ t('photosAlbumSort') }} {{ currentSort.label }}
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div v-if="sortOpen" class="albums-sort-menu" data-test="albums-sort-menu">
                <button
                  v-for="s in sortOptions" :key="s.id"
                  type="button"
                  class="albums-sort-item"
                  data-test="albums-sort-item"
                  :data-sort-id="s.id"
                  :data-active="s.id === sort"
                  @click="pickSort(s)"
                >
                  <span class="sort-check">{{ s.id === sort ? '✓' : '' }}</span>
                  <span class="sort-text">
                    <span class="lbl">{{ s.label }}</span>
                    <span class="hint">{{ s.hint }}</span>
                  </span>
                </button>
              </div>
            </div>
            <button type="button" class="bar-btn btn-primary" data-test="albums-new-btn" @click="openCreate">
              <!-- Was missing entirely -- Vue2
                   (PhotosAlbumsView.vue:83-84) leads this button with
                   `<photos-icon name="album" :size="13"/>`. -->
              <PhotosIcon name="album" :size="13" data-test="albums-new-icon" />
              {{ t('photosAlbumNew') }}
            </button>
          </div>
        </div>

        <!-- The failure state takes priority over the empty state —
             once loadError is true, albumsLoaded still reads false (deliberate, see albums.ts's
             comment), so it must not fall into the empty-state branch and render an empty grid
             with no notice at all. Same shape already closed on
             PhotosFavorites.vue/PhotosAlbumDetail.vue.
             The standalone "isEmpty" panel that
             used to sit here (data-test="albums-empty") is gone -- it duplicated the section
             subtitle below with the exact same "还没有相册" copy once smart albums joined the
             grid, so a genuinely empty library showed the same message twice on screen at
             once. Vue2 939a7d3a:PhotosAlbumsView.vue:87-95 never had a separate empty panel
             either -- the section subtitle *is* the empty state there, with the create tile
             sitting right beside it. The loadError branch above is untouched: it is a real,
             separate state (fetch failed, not "fetch succeeded with zero results"). -->
        <div v-if="albums.loadError" class="empty-state" data-test="albums-load-error">
          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="albums-retry"
            :disabled="retryingAlbums"
            @click="retryAlbums"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- Vue2 PhotosAlbumsView.vue:52-58 unconditionally renders a
             section head above the grid ("My Albums / albums you created") — New-UI used to
             fall straight from the banner to the grid, missing this entire block, and along
             with it the two i18n keys prepared just for it (photosAlbumsMine/photosAlbumsMineHint)
             became dead code.
             Scroll-container placement: Vue2's scroll container is the outer .albums-body
             (photos.scss:3202-3206) — the section head and the grid are both static content
             that scrolls together inside it, not a separate scroll region owned by the grid
             itself. Same structure here.
             This container's class name used to
             be the repo-invented `.albums-scroll` (a slip during the T3 cleanup) — the parity
             stylesheet only knows `.albums-body` (photos.scss:3206-3211, padding: 18px 24px
             80px, which also carries flex:1 + min-height:0 + overflow-y:auto). `.albums-scroll`
             is not a name it recognises, so the only rule that actually applied was a local
             `.albums-scroll` further down this file (padding of just `4px 4px 20px`) — which is
             why the grid hugged the left edge, exactly the reported symptom.
             Renamed back to parity's real name, the local rule is deleted outright (parity
             takes over directly, with larger and more correct values), and the `scroll` class
             stays (the global hide-scrollbar rule keys off that class name, photos.scss:21). -->
        <div class="albums-body scroll">
          <!-- AI-off banner, moved here from PhotosSmartViews.vue (Vue2
               939a7d3a:PhotosAlbumsView.vue:79-85) now that smart albums live in this grid too.
               Markup/classes copied verbatim from PhotosSmartViews.vue's .svs-banner* (renamed
               .albums-ai-banner*) -- see the style block for the token-for-token rule copy.
               The two registered deviations on the source banner
               (PhotosSmartViews.vue:177-178 -- the RouterLink replacing Vue2's non-clickable
               placeholder span, and not copying Vue2's bare trailing period after the link)
               still apply to this copy; see that file's own header comment for the full
               rationale, not restated twice. -->
          <div v-if="aiSmartViewOff" class="albums-ai-banner" data-test="albums-ai-banner">
            <div class="albums-ai-banner-icon">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </div>
            <div>
              <div class="albums-ai-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
              <div class="albums-ai-banner-desc">
                {{ t('photosSvTheseSavedSearchesStay') }}
                <RouterLink class="albums-ai-banner-link" data-test="albums-settings-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
              </div>
            </div>
          </div>

          <section class="albums-section">
            <div class="albums-section-head">
              <h2>{{ t('photosAlbumsMine') }}</h2>
              <!-- This subtitle carries the empty
                   state itself (Vue2 939a7d3a:PhotosAlbumsView.vue:91-93 has no separate empty
                   panel, this line is it). Gated on both `albums.albumsLoaded` AND
                   `smartViews.listLoaded` so it cannot flash the "none yet" copy while either
                   fetch is still in flight -- before both resolve, mixedItems.length is 0 for
                   every library, not just an empty one. This folds in a fix for an earlier
                   incomplete guard: the grid is now mixed, so a library with
                   zero manual albums but pending/nonzero smart views needs the smart half's own
                   loaded flag too -- gating on the albums fetch alone left a window where the
                   smart half hadn't landed yet but the guard already read "loaded". -->
              <span class="albums-section-hint">
                {{ albums.albumsLoaded && smartViews.listLoaded && mixedItems.length === 0 ? t('photosAlbumsNoneYetHint') : t('photosAlbumsMineHint') }}
              </span>
            </div>
            <div class="album-grid">
              <!-- Vue2 9f7e941f:PhotosAlbumsView.vue:96-107: the create
                   tile matches an album card's total height -- the dashed frame narrows to a
                   cover-sized .album-create-cover, and two invisible lines of the same spec as
                   .album-title/.album-meta pad out the rest. Deliberately no hardcoded pixel
                   height: it follows the theme's own font metrics. -->
              <div class="album-create" data-test="album-create-tile" @click="openCreate">
                <div class="album-create-cover">
                  <!-- Was a literal "+" text glyph, a
                       substitute an earlier cleanup (T3) explicitly registered as standing in
                       for "Vue2's PhotosIcon SVG that parity has no property for"
                       (PhotosAlbumsView.vue:118-120 uses
                       `<photos-icon name="album" :size="20"/>` inside `.plus`, the same 'album'
                       glyph the New-album button above uses at a larger size) -- now that the
                       glyph exists in this repo's own PhotosIcon.vue, the substitute is no
                       longer needed. `.plus`'s own local `font-size: 20px` (sized the text
                       glyph) is removed below since the icon component sizes itself via its
                       own `:size` prop, not font-size. -->
                  <div class="plus"><PhotosIcon name="album" :size="20" data-test="album-create-icon" /></div>
                  <div class="album-create-label">{{ t('photosAlbumNew') }}</div>
                  <div class="album-create-hint">{{ t('photosAlbumNewHint') }}</div>
                </div>
                <div class="album-title" aria-hidden="true" style="visibility:hidden">&nbsp;</div>
                <div class="album-meta" aria-hidden="true" style="visibility:hidden">&nbsp;</div>
              </div>
              <!-- The kind prefix on :key is load-bearing, not decoration: a manual album's
                   numeric id and a smart album's string id can collide once they share a
                   grid (Vue2 :104/:111 uses the same 'sv-' + item.id / item.id split).
                   It got teeth here. While the smart card was a component
                   and the manual card a plain <div>, Vue's isSameVNodeType compared (type,
                   key) as a pair, so a raw-id collision could never be conflated whatever the
                   key said. Both kinds are plain <div>s now, so this prefix is the only thing
                   separating them. Measured cost of dropping it: the
                   rendered text stays correct, but every re-sort tears both colliding cards
                   down and rebuilds them instead of moving them, so their cover images are
                   re-fetched and re-decoded. Guarded by PhotosAlbums.test.ts's "moves, rather
                   than rebuilds, a manual album and a smart view that share the same raw id". -->
              <template v-for="item in mixedItems" :key="item.kind + '-' + item.id">
                <!-- Vue2 9f7e941f:PhotosAlbumsView.vue:108-146: the smart
                     album card is rendered inline with the manual card's shape instead of the
                     standalone SmartViewCard box (deleted in this task). One cover from
                     seeds[0], a Smart badge and a Live/Paused breathing dot over it, then the
                     title and the meta row. Conditions and the threshold are off the card face
                     -- the detail page carries the full picture, the card only has to be
                     recognisable.
                     Task 11 (d): the @click below passes item.sv.id straight through, with no
                     String() wrapper. SmartView.id is typed `string` (smartViews.ts:28) and every
                     write path into the store normalises it through toSmartView (smartViews.ts:98),
                     so the cast was a no-op. -->
                <div
                  v-if="item.kind === 'smart'"
                  class="album-card"
                  data-test="album-smart-card"
                  :data-id="item.sv.id"
                  @click="openSmartCard(item.sv.id)"
                >
                  <div class="album-cover">
                    <img v-if="smartCoverUrl(item.sv)" :src="smartCoverUrl(item.sv)" :alt="item.sv.name">
                    <div v-else class="album-cover-fallback" data-test="album-cover-fallback">
                      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="album-cover-icon"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
                    </div>
                    <div class="al-smart-badge">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>
                      {{ t('photosSvBadgeSmartView') }}
                    </div>
                    <div
                      class="al-live-dot"
                      :data-paused="!item.sv.live"
                      :title="item.sv.live ? t('photosSvLive') : t('photosSvPaused')"
                    >
                      <span class="live-dot"></span>
                    </div>
                  </div>
                  <div class="album-title">{{ item.sv.name }}</div>
                  <div class="album-meta">
                    <!-- Vue2 renders `{n} photos` here, not the manual card's `{n} items`.
                         Reusing photosPeoplePhotosCount rather than adding a fifth copy of
                         that string: its value in both locales is exactly Vue2's own copy for
                         it, and this repo already reuses that key well outside the People page
                         (PhotosFavorites.vue:231/239, PersonPlacesTab.vue:86). -->
                    <span>{{ t('photosPeoplePhotosCount', { n: item.sv.count }) }}</span>
                    <span class="sep"></span>
                    <span>{{ item.sv.live ? t('photosSvLive') : t('photosSvPaused') }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="album-card"
                  data-test="album-card"
                  :data-id="item.view.id"
                  @click="openCard(item.view)"
                >
                  <div class="album-cover">
                    <img v-if="coverUrl(item.view)" :src="coverUrl(item.view)" :alt="item.view.title">
                    <div v-else class="album-cover-fallback" data-test="album-cover-fallback">
                      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="album-cover-icon"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
                    </div>
                  </div>
                  <div class="album-title">{{ item.view.title }}</div>
                  <div class="album-meta">
                    <span>{{ t('photosItemsCount', { count: item.view.count }) }}</span>
                    <template v-if="item.view.dateRange">
                      <span class="sep"></span>
                      <span>{{ item.view.dateRange }}</span>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </section>
        </div>
       </div>
      </main>
    </div>

    <!-- The create-modal and the library picker
         below used to sit as template-root SIBLINGS of `.photos-root` (outside its DOM
         subtree entirely, Vue 3's multi-root fragment). Every layout rule either one relies
         on is written `.photos-root .albums-modal-scrim { position: fixed; ... }`
         (photos.scss:3844) / `.picker-scrim` reads `var(--modal-bg)`, a custom property only
         defined inside `.photos-root { ... }` (photos.scss:14-60) -- a descendant selector
         and a CSS custom property both require an actual `.photos-root` ANCESTOR in the real
         DOM, which "declared after `.photos-root`'s closing tag in the template" does not
         provide. The click handler firing and `createOpen`/`pickerOpen` flipping true were
         never in question (that is why the pre-existing DOM-existence tests never caught
         this) -- what silently failed is every position/background/z-index rule the modal
         needs to be visible at all, which is exactly the owner-visible symptom ("New album"
         appears to do nothing). This file's own header comment (photos.scss:1-13) already
         documents the repo's established fix for portaled elements escaping `.photos-root`
         (re-carry the class onto the portal host, see PhotosToastHost.vue's Teleport target)
         -- the simpler fix used here is to stop portaling at all: nest both dialogs back
         inside `.photos-root`, matching how Vue2's own single-page shell always had them
         (PhotosAlbumsView.vue's modal and picker are both descendants of PhotosTimeline's one
         `.photos-root`, never siblings of it). `position: fixed` on both dialogs' root
         elements means nesting them here does not reintroduce `.app`'s `overflow: hidden`
         clipping (`.photos-root` itself sets no transform/filter/perspective/contain that
         would create a containing block for `position: fixed`). -->
    <div
      v-if="createOpen"
      class="albums-modal-scrim"
      data-test="albums-create-modal"
      @click.self="closeCreate"
    >
    <div class="albums-modal" :class="{ 'albums-modal-wide': newAlbumSource === 'nimo' }">
      <div class="albums-modal-head">
        <div class="albums-modal-head-text">
          <div class="albums-modal-title">{{ t('photosAlbumCreateTitle') }}</div>
          <div class="albums-modal-sub">{{ t('photosAlbumCreateSub') }}</div>
        </div>
        <button type="button" class="albums-modal-close" :aria-label="t('photosCancel')" @click="closeCreate">&#215;</button>
      </div>

      <label class="albums-modal-label">{{ t('photosAlbumNameLabel') }}</label>
      <input
        ref="newAlbumInputRef"
        v-model="newAlbumTitle"
        :placeholder="t('photosAlbumNamePlaceholder')"
        class="albums-modal-input"
        data-test="albums-name-input"
        @keydown.enter="confirmCreate"
      >

      <label class="albums-modal-label">{{ t('photosAlbumFillLabel') }}</label>
      <div class="albums-source-list">
        <button
          v-for="s in sourceOptions" :key="s.id"
          type="button"
          class="albums-source-item"
          :data-active="newAlbumSource === s.id"
          :data-test="'source-' + s.id"
          :disabled="s.id === 'nimo' && aiSmartViewOff"
          :title="s.id === 'nimo' && aiSmartViewOff ? t('photosSvSmartViewsOffCreateHint') : undefined"
          @click="selectSource(s)"
        >
          <div class="radio" :data-active="newAlbumSource === s.id"><div v-if="newAlbumSource === s.id" class="dot"></div></div>
          <div class="src-text">
            <div class="lbl">{{ s.label }}</div>
            <div class="hint">{{ s.hint }}</div>
          </div>
        </button>
      </div>

      <!-- Vue2 :519-524's mirror on the panel body: source==='nimo'
           swaps the panel body for the embedded smart form, owning its own submit --
           two submit entry points side by side would be ambiguous, so the host footer
           hides while it is shown. -->
      <SmartViewCreateDialog
        v-if="newAlbumSource === 'nimo'"
        :open="true"
        embedded
        :initial-name="newAlbumTitle"
        @created="onSmartAlbumCreated"
        @close="closeCreate"
      />
      <div v-else class="albums-modal-foot">
        <button type="button" class="albums-btn-ghost" @click="closeCreate">{{ t('photosCancel') }}</button>
        <button
          type="button"
          class="albums-btn-cta"
          data-test="albums-confirm-create"
          :disabled="!newAlbumTitle.trim() || creating"
          @click="confirmCreate"
        >
          {{ creating ? t('photosAlbumCreating') : t('photosAlbumCreate') }}
        </button>
      </div>
    </div>
    </div>

    <PhotosLibraryPicker
      :open="pickerOpen"
      :title="t('photosAlbumPickerTitle', { name: pickerAlbumName })"
      :existing-ids="pickerExistingIds"
      :existing-label="t('photosAlbumPickerAlready')"
      :submit-label="pickerSubmitLabel"
      :submitting="pickerAdding"
      @update:open="pickerOpen = $event"
      @confirm="onPickerConfirm"
    />
    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body"
         shape as PhotosToastHost (not present on this view) -- Photos has no shared shell to
         mount this once at. -->
    <AskNimoHost />
  </div>
</template>

<style scoped>
/* Shared re-shell: `.photos-layout` flex-row + the transitional `.sidebar { flex... }` width
   pin are gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns both the
   sidebar's width and the height cap (`height: 100vh; overflow: hidden`), same as
   Photos.vue since its own Task 3 re-skin. `.photos-layout` no longer appears anywhere in
   this file's source — photosLayoutHeightCap.test.ts's CAPPED list has been updated to drop
   this page accordingly (its `allPhotosLayoutViews()` scan only collects pages that still
   contain the `.photos-layout` rule). */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--text-2); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--text-1); }
.empty-state-desc { font-size: 13px; }
/* Aligns spacing with the same failure-state pattern in
   PhotosFavorites.vue/PhotosAlbumDetail.vue (both already have this rule), otherwise the
   three failure screens look visually inconsistent. */
.empty-state .bar-btn { margin-top: 10px; }

/* ── Banner ──
   T3 shadow cleanup: `.albums-banner`/`h1`, `.albums-sort-menu`/`.albums-sort-item`(+hover/
   active) and `.sort-text .lbl` used to carry local scoped copies under the exact same class
   names parity already styles (`.photos-root .albums-banner`, `.photos-root .albums-sort-menu`,
   etc.) — the scoped copies won by data-v specificity and were built against New-UI's OWN
   theme.css tokens (--popup-bg/--card-border/--card-shadow-hi/--chip-bg-hi/--fg), which
   `.photos-root` does NOT redefine, so they rendered with the wrong (non-Vue2) numbers: 22px h1
   instead of 28px, a translucent glass sort-menu instead of the opaque `--surface-2` panel the
   brief calls for, wrong padding/radius throughout. Deleted outright — the parity rules (photos.
   scss:3119-3195) now govern directly, no local shadow left to remove them again later. */
.albums-sub { color: var(--text-3); font-size: 12.5px; margin-top: 4px; }
.albums-actions { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; }
/* Vue2 has no class here — the sort dropdown's positioned ancestor is an inline
   `style="position:relative"` div (PhotosAlbumsView.vue:59); this is that div's New-UI class
   equivalent. Parity has no matching selector, so this one survives. */
.albums-sort-wrap { position: relative; }

/* Survivors: `.sort-check`/`.sort-text`/`.sort-text .hint` wrap the check-mark and label/hint
   pair in real elements+classes where Vue2 uses an icon-or-blank-span and an unclassed
   `style="flex:1"` span (PhotosAlbumsView.vue:72-77) — parity has no selector for either
   wrapper, and `.sort-text .hint` doesn't share a name with parity's `.desc` (this repo's own
   i18n key suffix convention is "Hint", not "Desc"; see photosAlbumSortCreatedHint etc.). Colors
   corrected to the parity tokens the wrapped content would carry if unwrapped:
   `.albums-sort-item .lbl` itself is deleted below (name-identical to parity, no wrapper
   needed there). */
.sort-check { width: 14px; flex: 0 0 auto; color: var(--accent-hi); }
.sort-text { flex: 1 1 auto; display: flex; flex-direction: column; }
.sort-text .hint { font-size: 11px; color: var(--text-3); margin-top: 2px; }

/* ── AI-off banner ── token values and inner sizes copied from
   PhotosSmartViews.vue's old .svs-banner* (renamed .albums-ai-banner*); see that file's own
   header comment for why --dem-fg/--dem-bg/--dem-bd rather than the Vue2 source's inline amber
   literals.
   The OUTER margin is not copied from there, though. The right reference for this
   surface is Vue2's own Albums-page banner (939a7d3a:PhotosAlbumsView.vue:79,
   `margin:0 0 20px`): it sits flush with the section head and the grid below it. Inheriting the
   other page's `24px 32px 20px` indented this banner 32px further in than everything else on
   the page. */
.albums-ai-banner {
  margin: 0 0 20px; padding: 14px 16px;
  background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
  display: flex; gap: 10px; align-items: flex-start;
}
.albums-ai-banner-icon {
  width: 26px; height: 26px; border-radius: 7px;
  background: color-mix(in srgb, var(--dem-fg) 18%, transparent); color: var(--dem-fg);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.albums-ai-banner-title { font-size: 12.5px; font-weight: 600; color: var(--dem-fg); }
.albums-ai-banner-desc { font-size: 11.5px; color: var(--text-2); margin-top: 3px; line-height: 1.5; }
.albums-ai-banner-link { color: var(--accent-hi); text-decoration: underline; cursor: pointer; }

/* ── Section head + Grid ──
   The scroll container moved to this layer (per Vue2 photos.scss:3202-3206's .albums-body):
   the section head and the grid scroll together, and .album-grid itself is only responsible
   for the grid layout, no longer doubling as the scroll container.
   minmax(220px, 1fr) below is deliberately NOT changed to the
   minmax(320px, 1fr) SmartViewCard was designed against (PhotosSmartViews.vue's old .sv-grid) --
   the two card kinds now share one grid, and a smart card is therefore narrower here than it
   used to be on its own page. This matches Vue 2 exactly and is not a cost to
   apologise for. Vue2 939a7d3a unified both kinds into a single `.album-grid-user` at
   minmax(220px, 1fr) (photos.scss:3190-3193) and renders smart-view-card inside it
   (:PhotosAlbumsView.vue:99-105) -- 220px IS the target's mixed-grid column width.
   The local `.albums-scroll` rule that used to
   sit here is deleted outright, not value-patched -- the template now carries parity's own
   `.albums-body` class name (photos.scss:3206-3211), which already provides
   flex/min-height/overflow-y AND the correct `padding: 18px 24px 80px` (this local copy's
   `4px 4px 20px` was the actual bug: the grid rendered flush against the left edge because
   parity's real padding rule never matched the old, unrecognised class name). */
/* `.albums-section-head`/`h2` deleted (T3 shadow cleanup): both class names already match
   parity's `.photos-root .albums-section-head`/`h2` (photos.scss:3213-3225) exactly, and the
   local copies disagreed on real values -- padding 4px 4px 14px vs parity's 12px 0 14px, h2
   15px vs parity's 18px, plus an explicit `color: var(--text-1)` (New-UI token, not redefined
   inside `.photos-root`) shadowing the `--text-1` the `.app` grid already sets as the ambient
   text color. `.albums-section-hint` keeps its own name (PhotosAlbums.test.ts asserts on it by
   class, e.g. `w.find('.albums-section-hint')`) -- parity's equivalent is the nameless
   `.albums-section-head .sub`, so only its color is corrected to the parity token (font-size
   already agreed at 12px). */
.albums-section-hint { font-size: 12px; color: var(--text-3); }
.album-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px;
}
/* Vue2 9f7e941f:photos.scss's .album-create split: the tile's outer box is
   now the same vertical flex column as .album-card, and the dashed frame moved inward to
   .album-create-cover so the two invisible text lines below it can pad the tile out to a
   card's total height. */
/* T3 shadow cleanup: `.album-create`/`.album-create-cover`/its hover state deleted -- all three
   share their name with parity's `.photos-root .album-create*` (photos.scss:3364-3388) and the
   local copies disagreed on real values (16px radius vs parity's `--r-lg` =14px, a translucent
   `--chip-bg` glass background vs parity's solid `--surface-1`, `--accent-text` [New-UI's own
   blue] vs parity's `--accent-hi` [purple] on hover). `.album-create .plus`'s box is deleted the
   same way (40px/`--chip-bg-hi` vs parity's 44px/`--surface-2`, and parity's own
   `.album-create:hover .plus` hover rule now applies for free). `.album-create-label`/`-hint`
   survive too -- Vue2 renders this pair via inline `style=` on unclassed divs
   (PhotosAlbumsView.vue:121-122), so parity's extraction has no selector for them; hint's
   opacity corrected from 0.75 to Vue2's actual 0.7.
   `.album-create .plus { font-size: 20px }` is deleted
   here -- it sized this repo's literal "+" text glyph, now replaced with the real
   `<PhotosIcon name="album" :size="20">` Vue2 itself renders inside `.plus`
   (PhotosAlbumsView.vue:120); the icon component sizes itself via its own `:size` prop, so the
   font-size rule has nothing left to size and would be dead CSS if kept. */
.album-create-label { font-size: 12.5px; font-weight: 500; }
.album-create-hint { font-size: 11px; opacity: 0.7; }

/* `.album-card`/`:hover`/`.album-cover`/`img`/`:hover img` deleted (T3 shadow cleanup): all
   name-identical to parity (photos.scss:3237-3261) and all disagreed on values the same way as
   `.album-create-cover` above (16px vs `--r-lg`=14px radius, `--chip-bg` vs `--surface-2`
   background, and a `--card-shadow-hi` box-shadow standing in for parity's own two-layer
   soft-drop-shadow-plus-hairline-border spec). Parity's `.album-cover::after` vignette gradient
   was never locally shadowed and already rendered correctly throughout. */
/* Final review Minor 4: this used to have its own copy of a gradient expression identical,
   character for character, to PhotosAlbumDetail.vue:104 — lifted into theme.css's
   --album-cover-fallback token, and both places now use it instead of duplicating it.
   T3 note: this one stays despite matching parity's selector name -- parity's own
   `.album-cover-fallback` uses a literal dark hex color (photos.scss:3272), which this repo's
   hard "no hardcoded colors outside vue2-parity/" rule forbids reintroducing here; the token
   already reproduces the same per-theme gradient without a literal. */
.album-cover-fallback {
  position: absolute; inset: 0;
  background: var(--album-cover-fallback);
  display: flex; align-items: center; justify-content: center;
}
/* Vue2's icon colour was a hardcoded semi-transparent light-toned literal (a semantic
   foreground sitting atop the colourful gradient) -- switched to --on-accent (the token for a
   readable foreground atop an accent fill) + reduced opacity, rather than hardcoding a colour
   literal. */
.album-cover-icon { color: var(--on-accent); opacity: 0.7; }
/* `.album-title`/`.album-meta`/`.album-meta .sep` deleted (T3 shadow cleanup): name-identical to
   parity (photos.scss:3277-3298), local copies used `--fg`/`--fg-muted` (New-UI tokens, not
   redefined inside `.photos-root`) in place of parity's `--text-1`/`--text-3`/`--text-4`, and
   the padding didn't match (`0 4px` vs parity's `2px 6px` / `0 6px`). */

/* ── Smart badge + Live/Paused dot overlaid on a smart album's cover
   (Vue2 9f7e941f:photos.scss's .al-smart-badge / .al-live-dot).
   T3 shadow cleanup: both rules, plus `.al-live-dot .live-dot`/`[data-paused] .live-dot`, are
   deleted outright rather than value-patched -- they are name-identical to parity
   (photos.scss:3306-3354) and every property already agreed *except* one real bug:
   `backdrop-filter: var(--blur)` was reaching for this repo's own glass token (`blur(44px)
   saturate(1.7) brightness(1.08)` in dark mode, `none` in light mode -- a heavy multi-effect
   blur sized for large panels elsewhere in the app), not the small `blur(8px)` chip blur Vue2
   actually uses. Deleting lets parity's literal `blur(8px)` govern -- correct in both themes,
   and correctly sized for a small overlay chip. The animation-name collision below is the other
   real bug this cleanup fixes. */

/* The local `@keyframes pulse` this file used to define (deleted along with the rules above)
   collided by name with theme.css's own global `@keyframes pulse` (a box-shadow glow used
   elsewhere in the app, `50% { box-shadow: 0 0 54px var(--orb-glow); } `) -- `<style scoped>`
   does not namespace `@keyframes`, so which animation actually ran depended on stylesheet
   load order, not on which rule "should" win. Parity already defines a collision-free
   `@keyframes photos-pulse` (photos.scss:203) for exactly this reason and its own
   `.al-live-dot .live-dot` rule already references it -- nothing left to declare locally. */

/* ── New album modal ──
   T3 shadow cleanup, whole family: `.albums-modal-scrim/-head/-head-text/-title/-sub/-label/
   -input`, `.albums-source-list/-item`(+hover/active/disabled), `.radio`(+active/.dot),
   `.src-text .lbl`, and `.albums-modal-foot/.albums-btn-ghost/.albums-btn-cta`(+disabled) are
   all name-identical to parity (photos.scss:3844-4022) and are deleted outright rather than
   value-patched. Two of these were real bugs, not just cosmetic drift:
     - `.albums-btn-cta`'s `color: var(--on-accent)` is a deep navy hex in dark mode (see
       theme.css), meant for text on a *light* accent fill, sitting on this button's actual
       purple `--accent` background -- low-contrast text on the modal's own primary action
       button. Parity's literal `color: white` (correct here: a fixed accent-filled button
       reads light text in both themes) now applies.
     - `.albums-modal-foot` had `justify-content: flex-end` sizing two auto-width buttons off the
       right edge; Vue2's actual footer is a full-width bar (`flex: 1` / `flex: 1.4` on the two
       buttons, photos.scss:3985-4022, no justify-content needed) with a divider line above it.
   `.albums-modal-head-text` (a flex:1 wrapper) and `.albums-modal-input:focus` survive: Vue2
   marks up the first as an unclassed `style="flex:1"` div (PhotosAlbumsView.vue:222, no parity
   selector to inherit), and parity's own `.albums-modal-input` has no `:focus` rule at all
   (outline: none) -- keeping a visible focus ring here is a deliberate a11y addition, not a
   pixel-parity concern, so it's kept alongside (not instead of) letting parity's sizing/color
   properties through. */
.albums-modal-head-text { flex: 1 1 auto; min-width: 0; }
.albums-modal-close {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--text-2); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.albums-modal-close:hover { background: var(--surface-3); color: var(--text-1); }
/* No parity selector under this name -- Vue2's close button is the generic, app-wide `.icon-btn`
   (photos.scss:229-237, 32px). This repo's own dialogs consistently use a bespoke, smaller
   close-button class instead of `.icon-btn` for this exact spot (MergeReviewDialog.vue
   `.mrd-close`, AlbumPickerDialog.vue `.album-picker-close`, ClusterActionDialog.vue
   `.cad-close`, PhotosLibraryPicker.vue `.picker-close` -- same 24px circle + "×" glyph shape
   as this one), so this survives unchanged as the
   established local pattern rather than being swapped to `.icon-btn`. */
.albums-modal-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

/* Vue2 has no class for this positioned width-cap either (PhotosAlbumsView.vue:220's
   `:class="{ 'albums-modal-wide': ... }"` sets width via the class parity already covers) --
   parity's own `.albums-modal-wide` is a flat `width: 820px` (photos.scss:3871-3877), which
   would overflow below 820px viewports. This repo's sidebar already collapses into a drawer at
   ≤768px (see the media query below), so the modal needs to survive that width too; the
   `min(820px, 100%)` safety net is kept as a New-UI-only responsive addition layered on top of
   parity's other `.albums-modal-wide` properties (max-height/display/flex-direction/overflow),
   which are otherwise deleted as exact duplicates. */
.albums-modal.albums-modal-wide { width: min(820px, 100%); }

/* Parity defines no hover state for `.albums-source-item` (photos.scss:3918-3941 has only
   `[data-active]`/`:disabled`) -- kept as a New-UI hover affordance using the matching parity
   surface-increment token rather than reintroducing a New-UI-only one. */
.albums-source-item:hover { background: var(--surface-3); }
.src-text { flex: 1 1 auto; min-width: 0; }
/* `.src-text .lbl` is gone -- name-identical to parity's `.albums-source-item .lbl`
   (font-weight: 500, photos.scss:3958), no wrapper-specific override needed. `.hint` keeps its
   own name (this repo's i18n key suffix is "Hint", parity's is "Desc") but its color is
   corrected to the parity token parity's `.desc` actually uses. */
.src-text .hint { font-size: 11px; color: var(--text-3); margin-top: 1px; }

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation
   as Photos.vue's own copy of this rule): once the sidebar switches into is-drawer mode
   (position:fixed, taken out of grid flow) at ≤768px, collapse `.app`'s sidebar column too,
   so `.main` doesn't leave a dead var(--sidebar-w) gutter where the now-floating sidebar
   used to sit. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
