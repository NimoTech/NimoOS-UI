// Ported (behavior unchanged, types added) from the Vue 2 panel's
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

// Task 12 (SP15-P3): NimoOS-Photos#54 turned an absent limit from "everything" into 500, so
// this list has to be paged or it silently truncates — same fix, same shape, as Task 11's
// favorites.ts. See that file for the fuller rationale behind the two counters below.
const TRASH_PAGE_SIZE = 500

export const usePhotosTrash = defineStore('photosTrash', () => {
  const items = ref<TrashPhoto[]>([])
  const loaded = ref(false)
  const retentionDays = ref(30)
  const trashExhausted = ref(false)
  const loadingMore = ref(false)
  let _offset = 0
  let _generation = 0
  // Task 12 review lesson carried over from Task 11 round 2: a separate ownership sequence
  // for `loadingMore`, distinct from `_generation`. `_generation` answers "is this page's data
  // still current"; `loadingMore` answers "does this call still own the load-more button" —
  // a fetchTrash() reset forces loadingMore false unconditionally (correct: it's a full
  // reset), but a loadMoreTrash() call already in flight before that reset — and whose page
  // still arrives after a *second* loadMoreTrash() has since started — must not be allowed to
  // clear the second call's flag out from under it in its `finally`.
  let _loadMoreSeq = 0

  // Task 10 (Plan H): now that PhotosSidebar also calls fetchTrash() once per session (its own
  // onMounted, gated on `loaded`), it mounts in the same frame as PhotosTrash.vue's own
  // unconditional onMounted fetch whenever the user's first visit of the session lands directly
  // on the Trash page -- two concurrent fetchTrash() calls would each bump `_generation` and
  // fire their own real service.photos.listTrash() request, so the first call's response is
  // always discarded (see the `gen !== _generation` guards below) even though it already cost a
  // network round trip. Same in-flight-dedup shape as settings.ts's fetchAiFeatures (see that
  // function's header comment for the fuller precedent): concurrent callers share one in-flight
  // promise instead of firing a second request; intentionally NOT a permanent cache -- the
  // promise resets to null in `finally`, so a later call (restore/purge/empty/undoRestore, or a
  // fresh page navigation) still re-fetches for real.
  let fetchInFlight: Promise<void> | null = null

  // Task 12: fetchTrash now always fetches page one and resets the cursor — call it for the
  // initial load and for any refresh (restore/purge/empty/undoRestore all end with it, which
  // is exactly "go back to page one").
  async function fetchTrash(): Promise<void> {
    if (fetchInFlight) return fetchInFlight
    fetchInFlight = (async () => {
      const gen = ++_generation
      _loadMoreSeq++
      loadingMore.value = false
      try {
        const list = (await service.photos.listTrash(TRASH_PAGE_SIZE, 0)) as unknown[]
        if (gen !== _generation) return
        const rows = list ?? []
        items.value = rows.map((a) => trashAssetToPhoto(a as Record<string, unknown>, retentionDays.value))
        _offset = rows.length
        trashExhausted.value = rows.length < TRASH_PAGE_SIZE
        // Only mark loaded on success — a transient fetch failure must stay
        // distinguishable from "confirmed empty trash" so callers can retry,
        // mirroring the favIdsLoaded/favoritesLoaded precedent in favorites.ts.
        loaded.value = true
      } catch (e) {
        if (gen !== _generation) return
        items.value = []
        _offset = 0
        trashExhausted.value = false
        console.error('[photos-trash] fetchTrash', e)
      }
    })()
    try {
      await fetchInFlight
    } finally {
      fetchInFlight = null
    }
  }

  // Task 12: appends the next page behind the load-more button. A generation counter guards
  // against a page landing after a refresh happened mid-flight — that page must be dropped
  // whole, not appended to a list it no longer belongs to.
  async function loadMoreTrash(): Promise<void> {
    if (trashExhausted.value || loadingMore.value) return
    const gen = _generation
    const seq = ++_loadMoreSeq
    loadingMore.value = true
    try {
      const list = (await service.photos.listTrash(TRASH_PAGE_SIZE, _offset)) as unknown[]
      // A refresh happened while this page was in flight: drop it entirely.
      if (gen !== _generation) return
      const rows = list ?? []
      items.value = [
        ...items.value,
        ...rows.map((a) => trashAssetToPhoto(a as Record<string, unknown>, retentionDays.value)),
      ]
      _offset += rows.length
      if (rows.length < TRASH_PAGE_SIZE) trashExhausted.value = true
    } catch (e) {
      // Leave the cursor where it was so the retry asks for the same page again
      // rather than skipping it.
      console.error('[photos-trash] loadMoreTrash', e)
    } finally {
      // Only clear the flag if this call still owns it — see the comment on
      // `_loadMoreSeq` above.
      if (seq === _loadMoreSeq) loadingMore.value = false
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

  // Owner-acceptance Fix-3 (delete-chain diagnosis): used to be a Promise.all with a
  // swallow-and-lie per-item catch -- every call resolved regardless of how many purgeTrash()
  // calls actually failed, so callers could only ever report the click-time selection size,
  // not the truth. Promise.allSettled + counting fulfilled results gives callers the ACTUAL
  // number of assets that were really purged, so the honest three-way toast (full / partial /
  // zero success) in PhotosTrash.vue is possible at all. Per-item failures are still logged
  // (not re-thrown) -- one bad id must not abort the rest of the batch.
  async function purge(ids: Array<string | number>): Promise<number> {
    const results = await Promise.allSettled(ids.map((id) => service.photos.purgeTrash(id)))
    let successCount = 0
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') successCount++
      else console.error('[photos-trash] purge', ids[i], result.reason)
    })
    await fetchTrash()
    return successCount
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
    trashExhausted.value = false
    loadingMore.value = false
    _offset = 0
    _generation = 0
    _loadMoreSeq = 0
  }

  return {
    items,
    loaded,
    retentionDays,
    trashExhausted,
    loadingMore,
    fetchTrash,
    loadMoreTrash,
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
