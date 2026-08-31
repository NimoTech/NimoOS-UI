// Ported (behavior unchanged, types added) from the Vue 2 panel's
// views/Photos/PhotosSettings.vue:234-297 (data + two watchers), :387-486
// (five actions + loadStorage/loadAbout), :500-526 (mounted initial fetches)
// and store/modules/photos.js:1249-1306 (setAiFaces/setAiFeatures/
// fetchAiFeatures) + :1413-1438 (fetchTrashRetention/setTrashRetention/
// fetchScanInterval/setScanInterval).
//
// This store is the shared config/storage/about cache for the settings page
// (Tasks 3-6). It also folds in retention/scanInterval — duplicated on
// purpose against trash.ts's own fetchRetention/setRetention (that copy
// stays; the trash view is out of scope here).
//
// rebuildIndex()'s 409 branch reads timeline.ts's existing `tasks` list (via
// its fetchTasks() action) rather than taking a caller-supplied lookup
// callback — see the comment at rebuildIndex() below for why an earlier
// revision used a callback instead.
//
// IMPORTANT: the shared package's `updateConfig` is NOT
// `updateConfig(patch: object)`. Its real signature
// (the shared HTTP client's src/photos.ts:48-62) is positional:
//   updateConfig(watchDirs: string[], retentionDays?, facesEnabled?, extra?)
// `watchDirs` is unconditionally included in the request body (no way to
// omit it), and the backend rejects an empty watchDirs list. Vue2 handles
// this by re-reading getConfig() immediately before every updateConfig call
// and re-sending the current watchDirs (setAiFaces :1249-1256, setAiFeatures
// :1281-1291, setTrashRetention :1419-1425, setScanInterval :1432-1438) —
// every write in this store follows that same read-then-write shape.
//
// (2026-08-04): folded PhotosPeople.vue's and PhotosSmartViews.vue's own
// onMounted-direct getConfig reads into this store's fetchAiFeatures (§7e-10
// debt), added an in-flight dedup to fetchAiFeatures (see the comment at its
// definition — the sidebar is a config consumer too now, §7e-15), and wired
// PhotosSmartViews.vue's dead-link settings banner to a real route (§7e-9).
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useTimelineStore } from './timeline'

export interface PhotosAiFeatures {
  faces: boolean
  scenes: boolean
  ocr: boolean
  smartview: boolean
}

export interface PhotosStorageInfo {
  diskTotalBytes: number
  diskFreeBytes: number
  prunableBytes: number
  photosBytes: number
  videosBytes: number
  rawBytes: number
  cacheBytes: number
  aiBytes: number
}

export interface PhotosAboutInfo {
  version: string
  deviceName: string
  indexCoverage: number
  indexLastBuilt: string
  librarySince: string
}

const ALL_ON: PhotosAiFeatures = { faces: true, scenes: true, ocr: true, smartview: true }

// Vue2 store/modules/photos.js:1297-1302 reading strategy: **only explicit false turns it off**, missing field/request failure
// all treated as enabled (rather display one extra entry than hide feature due to one config read jitter).
// Real backend uses flat fields (`facesEnabled`/`scenesEnabled`/`ocrEnabled`/`smartViewEnabled`, note
// smartViewEnabled's camelCase differs from the other three), directly on getConfig() response body, no `aiFeatures`
// nested key—here we support both test fixture shape `{ aiFeatures: {...} }` nesting and short field names.
function readAiFeatures(cfg: Record<string, unknown> | null | undefined): PhotosAiFeatures {
  const ai = (cfg?.aiFeatures ?? cfg ?? {}) as Record<string, unknown>
  const on = (v: unknown): boolean => v !== false
  return {
    faces: on(ai.faces ?? ai.facesEnabled),
    scenes: on(ai.scenes ?? ai.scenesEnabled),
    ocr: on(ai.ocr ?? ai.ocrEnabled),
    smartview: on(ai.smartview ?? ai.smartViewEnabled),
  }
}

export const usePhotosSettingsStore = defineStore('photos-settings', () => {
  const aiFeatures = ref<PhotosAiFeatures>({ ...ALL_ON })
  // Set to true only on success path—same calibration as favorites.ts:44: a single fetch failure must be distinguishable from "confirmed all off",
  // else consumers using !loaded as re-fetch criterion will permanently mask real config behind defaults.
  const aiFeaturesLoaded = ref(false)
  const storage = ref<PhotosStorageInfo | null>(null)
  const storageError = ref(false)
  const about = ref<PhotosAboutInfo | null>(null)
  const retentionDays = ref(30)
  const scanIntervalMinutes = ref(1440)

  // Multiple consumers (sidebar + each view's own onMounted) now all mount and each call
  // fetchAiFeatures() once—sidebar is a globally shared photo section component, mounts same frame as any view,
  // naive implementation would fire two concurrent getConfig requests in a single page load. Here we add "in-flight dedup":
  // multiple concurrent calls share the same in-flight promise. **Intentionally not permanent cache**—promise resets to null in finally,
  // next call (when not in-flight) re-fetches, preserving "save on settings page then enter list page sees latest value" existing
  // semantics (no one expects this store to fetch only once per app lifetime). Shape follows Vue2
  // store/modules/photos.js:1307-1315's `_restoreUploadsPromise` (module-level variable holds in-flight promise
  // so concurrent callers share one request), but semantics differ: that one is "global run-once, permanent no-reset"
  // migration idempotency; here we clear in finally, doing only "same-frame concurrent dedup", not permanent cache.
  let aiFeaturesInFlight: Promise<PhotosAiFeatures> | null = null

  async function fetchAiFeatures(): Promise<PhotosAiFeatures> {
    if (aiFeaturesInFlight) return aiFeaturesInFlight
    aiFeaturesInFlight = (async () => {
      try {
        const cfg = (await service.photos.getConfig()) as Record<string, unknown>
        aiFeatures.value = readAiFeatures(cfg)
        aiFeaturesLoaded.value = true
      } catch (e) {
        aiFeatures.value = { ...ALL_ON }
        console.error('[photos-settings] fetchAiFeatures', e)
      }
      return aiFeatures.value
    })()
    try {
      return await aiFeaturesInFlight
    } finally {
      aiFeaturesInFlight = null
    }
  }

  // Vue2 :263-281 is a deep watcher on features, using _suppressFeaturesWatch + $nextTick
  // to suppress write-back when "syncing initial value from backend". New-UI switches to explicit action (call only on toggle click),
  // **no watcher, entire suppression flag scheme unnecessary**—this is not removing functionality, it's the same intent
  // under explicit-call model's direct correspondence.
  // Optimistic update + failure rollback: consistent with Vue2 (:274-275 reverts features to _lastGoodFeatures).
  //
  // Before write-back re-read getConfig() once to get current watchDirs/retentionDays to send along—see top-of-file comment,
  // shared package updateConfig's watchDirs is required positional param, backend validates non-empty watchDirs
  // (same as Vue2 setAiFeatures :1281-1291).
  async function setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean> {
    const prev = { ...aiFeatures.value }
    aiFeatures.value = { ...prev, [id]: on }
    try {
      const next = aiFeatures.value
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
      const retention = cfg?.retentionDays as number | undefined
      await service.photos.updateConfig(watchDirs, retention, next.faces, {
        scenesEnabled: next.scenes,
        ocrEnabled: next.ocr,
        smartViewEnabled: next.smartview,
      })
      return true
    } catch (e) {
      aiFeatures.value = prev
      console.error('[photos-settings] setAiFeature', id, e)
      return false
    }
  }

  async function fetchStorage(): Promise<void> {
    try {
      const res = (await service.photos.getStorage()) as unknown as PhotosStorageInfo | null
      storage.value = res ?? null
      // Vue2 :391—empty response body also counts as failure state (bare JSON output, Photos v1 has no envelope, 204 empty body is possible)
      storageError.value = !storage.value
    } catch (e) {
      storage.value = null
      storageError.value = true
      console.error('[photos-settings] fetchStorage', e)
    }
  }

  async function fetchAbout(): Promise<void> {
    try {
      const res = (await service.photos.getAbout()) as unknown as PhotosAboutInfo | null
      about.value = res ?? null
    } catch (e) {
      about.value = null
      console.error('[photos-settings] fetchAbout', e)
    }
  }

  async function fetchRetention(): Promise<void> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const d = Number(cfg?.retentionDays)
      if (d > 0) retentionDays.value = d
    } catch (e) {
      console.error('[photos-settings] fetchRetention', e)
    }
  }

  // Vue2 :254-262's retention watcher on save failure **only toasts, no rollback**⇒ UI stays on user's selected slot
  // while backend still holds old value, next settings open jumps back. By iron rule "don't copy Vue2 bugs" add rollback,
  // aligning with :447-457's setScanInterval (already has prev rollback).
  async function setRetention(days: number): Promise<boolean> {
    const prev = retentionDays.value
    retentionDays.value = days
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
      await service.photos.updateConfig(watchDirs, days)
      return true
    } catch (e) {
      retentionDays.value = prev
      console.error('[photos-settings] setRetention', e)
      return false
    }
  }

  // scanInterval allows 0 (= disable auto re-scan, see Vue2 :306's scan_interval_off option),
  // so check uses Number.isFinite not truthy test—`cfg.scanInterval || 1440` would swallow 0 as 1440.
  async function fetchScanInterval(): Promise<void> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const v = Number(cfg?.scanInterval)
      if (Number.isFinite(v) && v >= 0) scanIntervalMinutes.value = v
    } catch (e) {
      console.error('[photos-settings] fetchScanInterval', e)
    }
  }

  async function setScanInterval(minutes: number): Promise<boolean> {
    const prev = scanIntervalMinutes.value
    scanIntervalMinutes.value = minutes
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
      const retention = cfg?.retentionDays as number | undefined
      await service.photos.updateConfig(watchDirs, retention, undefined, { scanInterval: minutes })
      return true
    } catch (e) {
      scanIntervalMinutes.value = prev
      console.error('[photos-settings] setScanInterval', e)
      return false
    }
  }

  // Fetch failure conservatively defaults to 0, failure already console.error-logged; action-type (pruneCache/triggerScan/
  // reclusterFaces/rebuildIndex non-409 branch) failures **throw up**, view layer handles toast,
  // consistent with Vue2 showToast placement in action methods (store does data/rollback only, not UI).
  async function pruneCache(): Promise<number> {
    const res = (await service.photos.pruneCache()) as { freedBytes?: number } | null
    return res?.freedBytes ?? 0
  }

  // 409 = rebuild already running on backend. Vue2 PhotosSettings.vue:458-473 here dispatch once
  // 'photos/fetchTasks' (one-time refresh, not new polling), then find
  // type==='rebuild' entry in local task list and bind to show progress, **no error**.
  // Here similarly call timeline store's ready fetchTasks() once and read its tasks—"don't start another task polling" means
  // don't spin up new setInterval/poller in this store, consuming timeline's already-existing refresh action and state doesn't violate it.
  // useTimelineStore() must be called inside action (not module level), else throws when called before Pinia activates.
  async function rebuildIndex(): Promise<string> {
    try {
      const res = (await service.photos.rebuildIndex()) as { taskId?: string } | null
      return res?.taskId ?? ''
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        const timeline = useTimelineStore()
        await timeline.fetchTasks()
        const running = timeline.tasks.find(t => t.type === 'rebuild')
        return running?.id != null ? String(running.id) : ''
      }
      throw e
    }
  }

  async function triggerScan(): Promise<boolean> {
    await service.photos.triggerScan()
    return true
  }

  async function reclusterFaces(): Promise<boolean> {
    await service.photos.reclusterFaces()
    return true
  }

  function reset(): void {
    aiFeatures.value = { ...ALL_ON }
    aiFeaturesLoaded.value = false
    storage.value = null
    storageError.value = false
    about.value = null
    retentionDays.value = 30
    scanIntervalMinutes.value = 1440
  }

  return {
    aiFeatures,
    aiFeaturesLoaded,
    storage,
    storageError,
    about,
    retentionDays,
    scanIntervalMinutes,
    fetchAiFeatures,
    setAiFeature,
    fetchStorage,
    fetchAbout,
    fetchRetention,
    setRetention,
    fetchScanInterval,
    setScanInterval,
    pruneCache,
    rebuildIndex,
    triggerScan,
    reclusterFaces,
    reset,
  }
})
