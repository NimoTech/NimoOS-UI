<script setup lang="ts">
// Task 7 (SP7-P4 albums): the album list view — card grid + sort + the three new-album fill
// modes (empty/recent/select; the Ask Nimo branch is deliberately not built per the brief) +
// empty state. The shell copies AreaShell/.photos-layout/.photos-main from
// Photos.vue:176-180/PhotosFavorites.vue/PhotosTrash.vue (not extracted into a shared piece,
// same treatment as P3 T8). The structure follows Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumsView.vue:16-86 (banner+grid), :99-165 (new-album modal).
// Route registration is left for T11.
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
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import SmartViewCreateDialog from '../photos/components/SmartViewCreateDialog.vue'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSmartViews, type SmartView } from '../photos/stores/smartViews'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import { albumToView, type AlbumView } from '../photos/util/albumView'
import { buildMixedAlbums, sortMixed, type MixedSortId } from '../photos/util/mixedAlbums'
import { isConflict } from '../photos/util/httpErrors'

// SP15-P2b Task 4: 'nimo' is the fourth fill option (Vue2 939a7d3a:PhotosAlbumsView.vue
// :329-336's sourceOptions, 4th entry) -- picking it swaps the panel body for the
// embedded smart-view creation form.
type SourceId = 'empty' | 'recent' | 'select' | 'nimo'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
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
  // SP15-P2b Task 4 (Vue2 :329-336, 4th entry): picking this swaps the panel body for the
  // embedded SmartViewCreateDialog instead of opening a second modal.
  { id: 'nimo' as SourceId, label: t('photosSvLetNimoDraft'), hint: t('photosSvLetNimoDraftHint') },
])

// SP15-P2b (Vue2 939a7d3a:PhotosAlbumsView.vue:391-393): one grid for both kinds, ranked
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

// SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue's smartCoverUrl): a smart album card
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

// SP15-P2b Task 4 (Vue2 :521-524): clicking the disabled nimo option is a no-op, the same
// defensive guard the old standalone New Smart Album button had. Reuses `aiSmartViewOff`
// directly rather than a same-meaning synonym computed.
function selectSource(s: { id: SourceId }): void {
  if (s.id === 'nimo' && aiSmartViewOff.value) return
  newAlbumSource.value = s.id
}

// SP15-P2b Task 4 (Vue2 :575-578): the embedded form reports success -- the store already
// unshifted the new smart view into the list, so there is nothing to insert and nowhere to
// navigate. Just close the shared panel and stay on the list.
function onSmartAlbumCreated(): void {
  closeCreate()
}

// Follows Vue2 :309-358 (minus the nimo branch, Task 4 added back the short-circuit):
// creation succeeds → branch on source → toast → finally close the modal.
async function confirmCreate(): Promise<void> {
  // SP15-P2b Task 4 (Vue2 :525-530): with nimo picked, the panel body *is* the smart form
  // and it owns its own submit (SmartViewCreateDialog's confirm()). Falling through here
  // used to create a throwaway empty manual album first before handing off -- Vue2's own
  // fix for that bug, ported here rather than reintroduced.
  if (newAlbumSource.value === 'nimo') return
  const title = newAlbumTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    // Deliberate deviation from Vue2 here (review Important verdict: a new defect, fixed this
    // round): Vue2's album list was never a standalone route — it was a v-else-if sub-block
    // inside PhotosTimeline.vue switched on activeNav (NimoOS-UI src/router/route.js:206-208
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
    // Final review Minor 5: unify the emptiness check on timeline.months (already the pattern
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

// SP15-P1-T9 · Step 0: with PhotosLibraryPicker generalised, three things it used to do itself
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
// keeps the count moving with the selection (see deviation b in the component's header).
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
  <AreaShell :title="t('photosAlbumsTitle')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="albums-banner">
          <div>
            <h1>{{ t('photosAlbumsTitle') }}</h1>
            <div class="albums-sub">{{ t('photosAlbumsCount', { count: mixedItems.length }) }}</div>
          </div>
          <div class="albums-actions">
            <div ref="sortMenuRef" class="albums-sort-wrap">
              <button type="button" class="bar-btn" data-test="albums-sort-btn" @click.stop="sortOpen = !sortOpen">
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
              {{ t('photosAlbumNew') }}
            </button>
          </div>
        </div>

        <!-- Final review Important 1: the failure state takes priority over the empty state —
             once loadError is true, albumsLoaded still reads false (deliberate, see albums.ts's
             comment), so it must not fall into the empty-state branch and render an empty grid
             with no notice at all. Same shape already closed on
             PhotosFavorites.vue/PhotosAlbumDetail.vue.
             SP15-P2b Task 3 fix round 1 (Important 3): the standalone "isEmpty" panel that
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

        <!-- Final review must-fix 3: Vue2 PhotosAlbumsView.vue:52-58 unconditionally renders a
             section head above the grid ("My Albums / albums you created") — New-UI used to
             fall straight from the banner to the grid, missing this entire block, and along
             with it the two i18n keys prepared just for it (photosAlbumsMine/photosAlbumsMineHint)
             became dead code.
             Scroll-container placement: Vue2's scroll container is the outer .albums-body
             (photos.scss:3202-3206) — the section head and the grid are both static content
             that scrolls together inside it, not a separate scroll region owned by the grid
             itself. Same structure here: move flex:1+overflow-y:auto off .album-grid onto a
             newly wrapped .albums-scroll layer, narrow .album-grid back to a plain grid layout
             (display:grid + gap), and let the section head and the card grid scroll together
             with .albums-scroll, rather than splitting into two independent scroll regions. -->
        <div class="albums-scroll scroll">
          <!-- SP15-P2b Task 3: AI-off banner, moved here from PhotosSmartViews.vue (Vue2
               939a7d3a:PhotosAlbumsView.vue:79-85) now that smart albums live in this grid too.
               Markup/classes copied verbatim from PhotosSmartViews.vue's .svs-banner* (renamed
               .albums-ai-banner*) -- see the style block for the token-for-token rule copy.
               fix round 1 (Minor 2): the two registered deviations on the source banner
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
              <!-- SP15-P2b Task 3 fix round 1 (Important 3): this subtitle carries the empty
                   state itself (Vue2 939a7d3a:PhotosAlbumsView.vue:91-93 has no separate empty
                   panel, this line is it). Gated on both `albums.albumsLoaded` AND
                   `smartViews.listLoaded` so it cannot flash the "none yet" copy while either
                   fetch is still in flight -- before both resolve, mixedItems.length is 0 for
                   every library, not just an empty one. SP15-P2b Task 4 (fold-in from Task 3's
                   incomplete guard, see progress.md): the grid is now mixed, so a library with
                   zero manual albums but pending/nonzero smart views needs the smart half's own
                   loaded flag too -- gating on the albums fetch alone left a window where the
                   smart half hadn't landed yet but the guard already read "loaded". -->
              <span class="albums-section-hint">
                {{ albums.albumsLoaded && smartViews.listLoaded && mixedItems.length === 0 ? t('photosAlbumsNoneYetHint') : t('photosAlbumsMineHint') }}
              </span>
            </div>
            <div class="album-grid">
              <!-- SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue:96-107): the create
                   tile matches an album card's total height -- the dashed frame narrows to a
                   cover-sized .album-create-cover, and two invisible lines of the same spec as
                   .album-title/.album-meta pad out the rest. Deliberately no hardcoded pixel
                   height: it follows the theme's own font metrics. -->
              <div class="album-create" data-test="album-create-tile" @click="openCreate">
                <div class="album-create-cover">
                  <div class="plus">+</div>
                  <div class="album-create-label">{{ t('photosAlbumNew') }}</div>
                  <div class="album-create-hint">{{ t('photosAlbumNewHint') }}</div>
                </div>
                <div class="album-title" aria-hidden="true" style="visibility:hidden">&nbsp;</div>
                <div class="album-meta" aria-hidden="true" style="visibility:hidden">&nbsp;</div>
              </div>
              <!-- The kind prefix on :key is load-bearing, not decoration: a manual album's
                   numeric id and a smart album's string id can collide once they share a
                   grid (Vue2 :104/:111 uses the same 'sv-' + item.id / item.id split).
                   SP15-P2c Task 10: it got teeth here. While the smart card was a component
                   and the manual card a plain <div>, Vue's isSameVNodeType compared (type,
                   key) as a pair, so a raw-id collision could never be conflated whatever the
                   key said. Both kinds are plain <div>s now, so this prefix is the only thing
                   separating them. Measured cost of dropping it (task-10-report.md): the
                   rendered text stays correct, but every re-sort tears both colliding cards
                   down and rebuilds them instead of moving them, so their cover images are
                   re-fetched and re-decoded. Guarded by PhotosAlbums.test.ts's "moves, rather
                   than rebuilds, a manual album and a smart view that share the same raw id". -->
              <template v-for="item in mixedItems" :key="item.kind + '-' + item.id">
                <!-- SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue:108-146): the smart
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
      </main>
    </div>
  </AreaShell>

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

      <!-- SP15-P2b Task 4 (Vue2 :519-524's mirror on the panel body): source==='nimo'
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
   same-origin fix, see the comment on the same rule in src/views/Photos.vue for the Vue2
   source rationale. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }
/* Final review Important 1: align spacing with the same failure-state pattern in
   PhotosFavorites.vue/PhotosAlbumDetail.vue (both already have this rule), otherwise the
   three failure screens look visually inconsistent. */
.empty-state .bar-btn { margin-top: 10px; }

/* ── Banner ── */
.albums-banner { display: flex; align-items: flex-end; gap: 18px; padding: 4px 4px 16px; flex-wrap: wrap; }
.albums-banner h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.albums-sub { color: var(--fg-muted); font-size: 12.5px; margin-top: 4px; }
.albums-actions { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; }
.albums-sort-wrap { position: relative; }

.albums-sort-menu {
  position: absolute; top: calc(100% + 6px); right: 0; min-width: 230px; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.albums-sort-item {
  display: flex; width: 100%; align-items: flex-start; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 8px; color: var(--fg); font: inherit;
  font-size: 12.5px; cursor: pointer; text-align: left;
}
.albums-sort-item:hover { background: var(--chip-bg-hi); }
.albums-sort-item[data-active="true"] { background: var(--accent-soft); }
.sort-check { width: 14px; flex: 0 0 auto; color: var(--accent-text); }
.sort-text { flex: 1 1 auto; display: flex; flex-direction: column; }
.sort-text .lbl { font-weight: 500; }
.sort-text .hint { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

/* ── SP15-P2b Task 3: AI-off banner ── token values and inner sizes copied from
   PhotosSmartViews.vue's old .svs-banner* (renamed .albums-ai-banner*); see that file's own
   header comment for why --dem-fg/--dem-bg/--dem-bd rather than the Vue2 source's inline amber
   literals.
   Final fix wave -- the OUTER margin is not copied from there. The right reference for this
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
.albums-ai-banner-desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 3px; line-height: 1.5; }
.albums-ai-banner-link { color: var(--accent-text); text-decoration: underline; cursor: pointer; }

/* ── Section head + Grid ──
   The scroll container moved to this layer (per Vue2 photos.scss:3202-3206's .albums-body):
   the section head and the grid scroll together, and .album-grid itself is only responsible
   for the grid layout, no longer doubling as the scroll container.
   SP15-P2b Task 3: minmax(220px, 1fr) below is deliberately NOT changed to the
   minmax(320px, 1fr) SmartViewCard was designed against (PhotosSmartViews.vue's old .sv-grid) --
   the two card kinds now share one grid, and a smart card is therefore narrower here than it
   used to be on its own page. Final fix wave: this matches Vue 2 exactly and is not a cost to
   apologise for. Vue2 939a7d3a unified both kinds into a single `.album-grid-user` at
   minmax(220px, 1fr) (photos.scss:3190-3193) and renders smart-view-card inside it
   (:PhotosAlbumsView.vue:99-105) -- 220px IS the target's mixed-grid column width. */
.albums-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 4px 20px; }
.albums-section-head { display: flex; align-items: baseline; gap: 10px; padding: 4px 4px 14px; }
.albums-section-head h2 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.albums-section-hint { font-size: 12px; color: var(--fg-muted); }
.album-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px;
}
/* SP15-P2c Task 10 (Vue2 9f7e941f:photos.scss's .album-create split): the tile's outer box is
   now the same vertical flex column as .album-card, and the dashed frame moved inward to
   .album-create-cover so the two invisible text lines below it can pad the tile out to a
   card's total height. */
.album-create { display: flex; flex-direction: column; gap: 8px; padding: 4px; cursor: pointer; }
.album-create-cover {
  aspect-ratio: 4 / 5; border-radius: 16px; border: 1.5px dashed var(--chip-border);
  background: var(--chip-bg); display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; color: var(--fg-muted);
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}
.album-create:hover .album-create-cover { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.album-create .plus { width: 40px; height: 40px; border-radius: 50%; background: var(--chip-bg-hi); display: flex; align-items: center; justify-content: center; font-size: 20px; }
.album-create-label { font-size: 12.5px; font-weight: 500; }
.album-create-hint { font-size: 11px; opacity: 0.75; }

.album-card { cursor: pointer; display: flex; flex-direction: column; gap: 8px; border-radius: 16px; padding: 4px; transition: transform 0.18s ease; }
.album-card:hover { transform: translateY(-2px); }
.album-cover { position: relative; aspect-ratio: 4 / 5; border-radius: 16px; overflow: hidden; background: var(--chip-bg); box-shadow: var(--card-shadow-hi); }
.album-cover img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.5s ease; }
.album-card:hover .album-cover img { transform: scale(1.04); }
/* Final review Minor 4: this used to have its own copy of a gradient expression identical,
   character for character, to PhotosAlbumDetail.vue:104 — lifted into theme.css's
   --album-cover-fallback token, and both places now use it instead of duplicating it. */
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
.album-title { font-size: 14px; font-weight: 600; color: var(--fg); letter-spacing: -0.01em; padding: 0 4px; }
.album-meta { font-size: 11.5px; color: var(--fg-muted); padding: 0 4px; display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.album-meta .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--fg-muted); opacity: 0.6; }

/* ── SP15-P2c Task 10: Smart badge + Live/Paused dot overlaid on a smart album's cover
   (Vue2 9f7e941f:photos.scss's .al-smart-badge / .al-live-dot). Both are new class names on
   purpose: the old .sv-collage-badge / .sv-collage-status pair was sized for the 16:9 collage
   and is still in use by MomentCard, so these are a size smaller to fit the 4:5 cover. */
.al-smart-badge {
  position: absolute; top: 8px; left: 8px; z-index: 1;
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 7px 2px 5px; border-radius: var(--chip-radius, 999px);
  /* accent family via color-mix -- this repo has no --accent-rgb, same technique as the
     badge on MomentCard. Not a literal, so no exemption needed. */
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  backdrop-filter: var(--blur);
  font-size: 9.5px; font-weight: 600;
  /* theme-exception: badge text and icon sit on top of the cover photograph and need a fixed
     light foreground in both themes. --on-accent is wrong here (in the dark theme it is a deep
     navy, meant for text on a solid accent fill). Same precedent as PhotosGrid.vue .tile-vid. */
  color: #fff;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.al-live-dot {
  position: absolute; top: 8px; right: 8px; z-index: 1;
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  /* theme-exception: fixed dark bubble pinned over the cover photograph, constant across
     themes so the dot inside it stays readable. Same precedent as PhotosGrid.vue .tile-vid. */
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: var(--blur);
}
/* The second sub-commit of Vue2 9f7e941f. Every pre-existing .live-dot rule was a descendant
   selector bound to a different ancestor, so inside .al-live-dot the dot inherited nothing and
   rendered as a hollow ring. Size, colour and the breathing animation are restated explicitly
   here; the values match the ones the old collage status pill used. */
.al-live-dot .live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  /* theme-exception: live indicator fixed on the dark bubble above, constant across themes. */
  background: #34C759; box-shadow: 0 0 6px #34C759;
  animation: pulse 1.6s infinite;
}
.al-live-dot[data-paused="true"] .live-dot {
  /* theme-exception: paused indicator, same fixed-bubble rationale as the live one above. */
  background: #FF9F0A; box-shadow: 0 0 6px #FF9F0A;
  animation: none;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── New album modal ── */
.albums-modal-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 32px 20px;
}
/* P2/P3 hard-won lesson (called out explicitly in the brief): the modal background must use
   --popup-bg, not --card-bg (in the dark theme --card-bg is nearly transparent and shows
   through when layered over a dark backdrop). */
.albums-modal {
  width: min(440px, 100%); background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 20px 22px 18px;
}
/* SP15-P2b Task 4 (Vue2 photos.scss's .albums-modal.albums-modal-wide): the embedded form
   is a two-column layout (body + preview rail); 440px cannot hold it. Widen to the
   standalone dialog's own width and become a flex column so the embedded .sv-modal's
   flex:1 (SmartViewCreateDialog.vue's .sv-modal.sv-modal-embedded) has a fixed-height
   column to fill instead of being sized by its own content and clipped. */
.albums-modal.albums-modal-wide {
  width: min(820px, 100%);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.albums-modal-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.albums-modal-head-text { flex: 1 1 auto; min-width: 0; }
.albums-modal-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.albums-modal-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.albums-modal-close {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.albums-modal-close:hover { background: var(--chip-bg-hi); color: var(--fg); }
.albums-modal-label { display: block; font-size: 12px; font-weight: 500; color: var(--fg-muted); margin: 12px 0 6px; }
.albums-modal-input {
  width: 100%; height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13.5px;
}
.albums-modal-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

.albums-source-list { display: flex; flex-direction: column; gap: 6px; }
.albums-source-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit;
  text-align: left; cursor: pointer;
}
.albums-source-item:hover { background: var(--chip-bg-hi); }
.albums-source-item[data-active="true"] { border-color: var(--accent); background: var(--accent-soft); }
/* SP15-P2b Task 4: the nimo option's disabled state when Smart Views are off (Vue2 :521-524's
   own defensive guard, same as the old standalone New Smart Album button's disabled style). */
.albums-source-item:disabled { opacity: 0.5; cursor: not-allowed; }
.radio { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--chip-border); flex: 0 0 auto; margin-top: 2px; display: flex; align-items: center; justify-content: center; }
.radio[data-active="true"] { border-color: var(--accent); }
.radio .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.src-text { flex: 1 1 auto; min-width: 0; }
.src-text .lbl { font-size: 13px; font-weight: 500; }
.src-text .hint { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

.albums-modal-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.albums-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.albums-btn-ghost:hover { background: var(--chip-bg-hi); }
.albums-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.albums-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

/* ≤768px: sidebar has collapsed into a drawer, layout goes single-column */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
