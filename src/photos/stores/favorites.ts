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

export const usePhotosFavorites = defineStore('photosFavorites', () => {
  const favIds = ref<Set<string>>(new Set())
  const favIdsLoaded = ref(false)
  const favoritesList = ref<Photo[] | null>(null)
  const favoritesLoaded = ref(false)
  // Non-reactive view-report throttle ledger — mirrors Vue2's non-reactive
  // `state._viewReportTs`, avoiding a render trigger on every photo view.
  const _viewTs = new Map<string, number>()

  function isFav(id: string | number): boolean {
    return favIds.value.has(String(id))
  }
  const favoritesMonths = computed<Month[]>(() => groupPhotosByMonth(favoritesList.value ?? []))

  async function reconcileFavIds(): Promise<void> {
    try {
      const ids = await service.photos.listFavoriteIds()
      favIds.value = new Set(((ids as unknown[]) ?? []).map((v) => String(v)))
      favIdsLoaded.value = true
    } catch {
      // leave favIds as-is on failure
    }
  }

  async function fetchFavorites(): Promise<void> {
    try {
      const list = (await service.photos.listFavorites()) as unknown[]
      favoritesList.value = (list ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
    } catch {
      favoritesList.value = []
    }
    favoritesLoaded.value = true
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
    } catch {
      const rollback = new Set(favIds.value)
      if (wasFav) rollback.add(key)
      else rollback.delete(key)
      favIds.value = rollback
    }
  }

  function recordView(id: string | number): void {
    if (id == null) return
    const key = String(id)
    const now = Date.now()
    const last = _viewTs.has(key) ? (_viewTs.get(key) as number) : -Infinity
    if (now - last < VIEW_THROTTLE_MS) return
    _viewTs.set(key, now)
    void service.photos.recordView(id).then(undefined, () => {})
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
    _viewTs.clear()
  }

  return {
    favIds, favIdsLoaded, favoritesList, favoritesLoaded,
    isFav, favoritesMonths,
    reconcileFavIds, fetchFavorites, toggle, recordView, exportZip, __resetForTest,
  }
})
