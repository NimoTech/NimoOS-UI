// Ported (optimistic-flip/rollback + view-throttle behavior, unchanged) from
// Vue2 NimoOS-UI store/modules/photos.js:743-755 (toggleFav) and :727-734
// (VIEW_THROTTLE_MS=60000 recordView throttle).
//
// Photos backend has NO standard {Success,Message,Data} envelope — listFavoriteIds
// / listFavorites resolve to bare arrays (or null) → always `?? []`.
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
import { groupPhotosByMonth } from '../util/groupPhotosByMonth'

const VIEW_THROTTLE_MS = 60_000

// Task 11 (SP15-P3): NimoOS-Photos#54 turned an absent limit from "everything" into 500, so this
// list has to be paged or it silently truncates. A generation counter guards the shared state: a
// slow page that lands after a refresh must be dropped whole rather than appended to a list it no
// longer belongs to.
const FAVORITES_PAGE_SIZE = 500

export const usePhotosFavorites = defineStore('photosFavorites', () => {
  const favIds = ref<Set<string>>(new Set())
  const favIdsLoaded = ref(false)
  const favoritesList = ref<Photo[] | null>(null)
  const favoritesLoaded = ref(false)
  const favoritesExhausted = ref(false)
  const loadingMore = ref(false)
  let _offset = 0
  let _generation = 0
  // Task 9 (P8a, P3 遗留收口): 独立失败标志——绝不与 favoritesLoaded 合并/复用。
  // favoritesLoaded 仅成功路径置真是刻意的(见下方 fetchFavorites 注释);一次瞬时失败
  // 必须能被视图区分出「加载失败」而不是「正在加载」或「确认为空」,这就是 loadError 存在
  // 的唯一理由。
  const loadError = ref(false)
  // Non-reactive view-report throttle ledger — mirrors Vue2's non-reactive
  // `state._viewReportTs`, avoiding a render trigger on every photo view.
  const _viewTs = new Map<string, number>()

  function isFav(id: string | number): boolean {
    return favIds.value.has(String(id))
  }
  const favoritesMonths = computed<Month[]>(() => groupPhotosByMonth(favoritesList.value ?? []))

  // Exact count from the server's full id list. favoritesList.length is only the pages
  // fetched so far, and favIds lands independently — falling back to the loaded length
  // keeps the header from flashing 0 while ids are in flight.
  const favoritesTotal = computed(() =>
    favIdsLoaded.value ? favIds.value.size : (favoritesList.value?.length ?? 0),
  )

  async function reconcileFavIds(): Promise<void> {
    try {
      const ids = await service.photos.listFavoriteIds()
      favIds.value = new Set(((ids as unknown[]) ?? []).map((v) => String(v)))
      favIdsLoaded.value = true
    } catch (e) {
      // leave favIds as-is on failure
      console.error('[photos-favorites] reconcileFavIds', e)
    }
  }

  // Task 11: fetchFavorites now always fetches page one and resets the cursor — call it
  // for the initial load and for any refresh (toggle invalidation, delete refresh, retry).
  async function fetchFavorites(): Promise<void> {
    // Task 9 correction: `loadError` used to be reset to false at the top of
    // this function (before the await), mirroring the "reset before attempt"
    // instruction this task started with. That was wrong: it created a
    // window, on every retry (success *or* failure), where loadError was
    // false but favoritesLoaded was still false too — and the Favorites view
    // has no dedicated "loading" branch, so during that window it fell
    // through to the v-else branch and rendered an empty grid, transiently
    // reproducing the exact P3 defect this task exists to fix. Clearing
    // loadError only on confirmed success means the failure UI stays
    // continuously visible from the first failure until a retry actually
    // succeeds — no window where the view can fall through to the wrong
    // branch.
    const gen = ++_generation
    loadingMore.value = false
    try {
      const list = (await service.photos.listFavorites(FAVORITES_PAGE_SIZE, 0)) as unknown[]
      if (gen !== _generation) return
      const rows = list ?? []
      favoritesList.value = rows.map((a) => assetToPhoto(a as Record<string, unknown>))
      _offset = rows.length
      favoritesExhausted.value = rows.length < FAVORITES_PAGE_SIZE
      // Only mark loaded on success — a transient fetch failure must stay
      // distinguishable from "confirmed zero favorites", otherwise consumers
      // gating a refetch on `!favoritesLoaded` (e.g. the Favorites view) would
      // permanently mask real favorites behind an empty state.
      favoritesLoaded.value = true
      loadError.value = false
    } catch (e) {
      if (gen !== _generation) return
      favoritesList.value = []
      _offset = 0
      favoritesExhausted.value = false
      loadError.value = true
      console.error('[photos-favorites] fetchFavorites', e)
    }
  }

  // Task 11: appends the next page behind the load-more button. A generation counter
  // guards against a page landing after a refresh happened mid-flight — that page must
  // be dropped whole, not appended to a list it no longer belongs to.
  async function loadMoreFavorites(): Promise<void> {
    if (favoritesExhausted.value || loadingMore.value) return
    const gen = _generation
    loadingMore.value = true
    try {
      const list = (await service.photos.listFavorites(FAVORITES_PAGE_SIZE, _offset)) as unknown[]
      // A refresh happened while this page was in flight: drop it entirely.
      if (gen !== _generation) return
      const rows = list ?? []
      favoritesList.value = [
        ...(favoritesList.value ?? []),
        ...rows.map((a) => assetToPhoto(a as Record<string, unknown>)),
      ]
      _offset += rows.length
      if (rows.length < FAVORITES_PAGE_SIZE) favoritesExhausted.value = true
    } catch (e) {
      // Leave the cursor where it was so the retry asks for the same page again
      // rather than skipping it.
      console.error('[photos-favorites] loadMoreFavorites', e)
    } finally {
      if (gen === _generation) loadingMore.value = false
    }
  }

  // Single-item optimistic flip + failure rollback (true to Vue2 toggleFav:
  // flips again to roll back, not a snapshot restore).
  async function toggle(id: string | number): Promise<void> {
    const key = String(id)
    const wasFav = favIds.value.has(key)
    const flipped = new Set(favIds.value)
    if (wasFav) flipped.delete(key)
    else flipped.add(key)
    favIds.value = flipped
    try {
      if (wasFav) await service.photos.unfavorite(id)
      else await service.photos.favorite(id)
      // Invalidate the cached favorites list — next view re-fetches.
      favoritesLoaded.value = false
      // Task 11: reset the pagination cursor too, so the next fetchFavorites() starts a
      // fresh page one instead of leaving a stale "exhausted" flag that would hide the
      // load-more button while the list is actually smaller than what was loaded before.
      favoritesExhausted.value = false
      _offset = 0
    } catch (e) {
      // Roll back + log only — do NOT rethrow. Every caller invokes this
      // fire-and-forget (`void fav.toggle(id)`, mirroring P2's
      // useLightbox.toggleFav precedent); rethrowing here would surface as an
      // unhandled promise rejection instead of the UI-consistent rollback +
      // diagnostic log this store already provides.
      const rollback = new Set(favIds.value)
      if (wasFav) rollback.add(key)
      else rollback.delete(key)
      favIds.value = rollback
      console.error('[photos-favorites] toggle', e)
    }
  }

  function recordView(id: string | number): void {
    if (id == null) return
    const key = String(id)
    const now = Date.now()
    const last = _viewTs.has(key) ? (_viewTs.get(key) as number) : -Infinity
    if (now - last < VIEW_THROTTLE_MS) return
    _viewTs.set(key, now)
    void service.photos.recordView(id).then(undefined, (e) => {
      console.error('[photos-favorites] recordView', e)
    })
  }

  function exportZip(): void {
    const url = service.photos.exportFavoritesUrl()
    if (typeof window !== 'undefined') window.location.href = url
  }

  function __resetForTest(): void {
    favIds.value = new Set()
    favIdsLoaded.value = false
    favoritesList.value = null
    favoritesLoaded.value = false
    loadError.value = false
    favoritesExhausted.value = false
    loadingMore.value = false
    _offset = 0
    _generation = 0
    _viewTs.clear()
  }

  return {
    favIds, favIdsLoaded, favoritesList, favoritesLoaded, loadError,
    favoritesExhausted, loadingMore, favoritesTotal,
    isFav, favoritesMonths,
    reconcileFavIds, fetchFavorites, loadMoreFavorites, toggle, recordView, exportZip,
    __resetForTest,
  }
})
