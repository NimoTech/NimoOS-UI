// Ported (behavior unchanged, types added) from Vue2 NimoOS-UI
// src/store/modules/photos.js:1413-1468 (fetchTrashRetention/setTrashRetention/
// fetchTrash/restoreTrash/restoreAllTrash/purgeTrash/emptyTrash) and
// views/Photos/PhotosTrashView.vue:267-275 (undoLast).
//
// Photos backend has NO standard {Success,Message,Data} envelope — listTrash()
// resolves to a bare array (or null/undefined) → always `?? []`.
//
// No optimistic updates (true to Vue2): every mutating action awaits the
// backend, then fully re-fetches trash (and the timeline, where the Vue2
// action also did) rather than patching local state in place.
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { trashAssetToPhoto, type TrashPhoto } from '../util/trashAssetToPhoto'
import { useTimelineStore } from './timeline'

// Buckets patch themselves on delete; a restore/undo out of the trash only
// needs the directory counts to come back, not the whole timeline. On a
// legacy backend bucketMode stays false and this falls back to the full
// refetch, same as before. Shared by restore/restoreAll/undoRestore so the
// branch isn't pasted three times.
function refreshTimelineAfterTrashChange(): void {
  const timeline = useTimelineStore()
  if (timeline.bucketMode) void timeline.refreshBuckets()
  else void timeline.fetchTimeline()
}

export const usePhotosTrash = defineStore('photosTrash', () => {
  const items = ref<TrashPhoto[]>([])
  const loaded = ref(false)
  const retentionDays = ref(30)

  async function fetchTrash(): Promise<void> {
    try {
      const list = (await service.photos.listTrash()) as unknown[]
      items.value = (list ?? []).map((a) => trashAssetToPhoto(a as Record<string, unknown>, retentionDays.value))
      // Only mark loaded on success — a transient fetch failure must stay
      // distinguishable from "confirmed empty trash" so callers can retry,
      // mirroring the favIdsLoaded/favoritesLoaded precedent in favorites.ts.
      loaded.value = true
    } catch (e) {
      items.value = []
      console.error('[photos-trash] fetchTrash', e)
    }
  }

  async function restore(ids: Array<string | number>): Promise<void> {
    await service.photos.restoreTrashBatch(ids)
    await fetchTrash()
    refreshTimelineAfterTrashChange()
  }

  async function restoreAll(): Promise<void> {
    await service.photos.restoreAllTrash()
    await fetchTrash()
    refreshTimelineAfterTrashChange()
  }

  async function purge(ids: Array<string | number>): Promise<void> {
    await Promise.all(
      ids.map((id) =>
        service.photos.purgeTrash(id).then(undefined, (e) => {
          console.error('[photos-trash] purge', id, e)
        }),
      ),
    )
    await fetchTrash()
  }

  async function empty(): Promise<void> {
    await service.photos.emptyTrash()
    await fetchTrash()
  }

  async function undoRestore(ids: Array<string | number>): Promise<void> {
    await Promise.all(
      ids.map((id) =>
        service.photos.deleteAsset(id).then(undefined, (e) => {
          console.error('[photos-trash] undoRestore', id, e)
        }),
      ),
    )
    await fetchTrash()
    refreshTimelineAfterTrashChange()
  }

  async function fetchRetention(): Promise<void> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const d = Number(cfg?.retentionDays)
      if (d > 0) retentionDays.value = d
    } catch (e) {
      console.error('[photos-trash] fetchRetention', e)
    }
  }

  // Settings-page-only concern (edit UI is P8): reads current watchDirs and
  // re-sends them alongside the new retention value, since the backend
  // rejects an empty watchDirs list — true to Vue2 photos.js:1419-1425.
  async function setRetention(days: number): Promise<void> {
    const cfg = (await service.photos.getConfig()) as Record<string, unknown>
    const watchDirs = (cfg?.watchDirs as string[]) || []
    await service.photos.updateConfig(watchDirs, days)
    if (days > 0) retentionDays.value = days
  }

  function __resetForTest(): void {
    items.value = []
    loaded.value = false
    retentionDays.value = 30
  }

  return {
    items,
    loaded,
    retentionDays,
    fetchTrash,
    restore,
    restoreAll,
    purge,
    empty,
    undoRestore,
    fetchRetention,
    setRetention,
    __resetForTest,
  }
})
