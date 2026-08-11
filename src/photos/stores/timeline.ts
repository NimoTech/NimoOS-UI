// Ported (behavior unchanged, types added) from Vue2 NimoOS-UI
// src/store/modules/photos.js:590-610 (fetchTimeline/refreshTimelineQuiet) and
// :620-653 (fetchIndexStatus side effects + startIndexPoll/stopIndexPoll).
//
// Photos backend has NO standard {Success,Message,Data} envelope — the shared
// service package passes response bodies through as-is. getTimeline()
// resolves to a bare array (or undefined/null on 204) → always `?? []`.
// listTasks() resolves to a bare `{ tasks: [...] }` wrapper — this store
// extracts `.tasks` itself.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { groupToMonth, assetToPhoto, type Month, type Photo } from '../util/assetToPhoto'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../util/taskBus'
import { isNotFound } from '../util/httpErrors'
import {
  bucketKey, bucketToMonth, normalizeBuckets, parseBucketKey, staleBucketKeys, type BucketMeta,
} from '../util/timelineBuckets'

export interface TimelineGroup {
  year: number
  month: number
  assets?: unknown[]
}

export interface IndexStatus {
  pending: number
  indexed: number
  error: number
  queueLen: number
  totalBytes: number
  galleryDir: string
  diskTotal: number
  diskAvail: number
  mlReady: boolean | null
}

function emptyIndexStatus(): IndexStatus {
  return {
    pending: 0,
    indexed: 0,
    error: 0,
    queueLen: 0,
    totalBytes: 0,
    galleryDir: '',
    diskTotal: 0,
    diskAvail: 0,
    mlReady: null,
  }
}

// Module-level poll timer (singleton by design, mirroring the Vue2 module-level
// _pollTimer): survives across store-instance boundaries within one page
// lifecycle, so __resetForTest() must clear it explicitly between tests.
let _pollTimer: ReturnType<typeof setInterval> | null = null

// P8a-T10(P1 挂账):照 Vue2 module-scope taskTimers + scheduleTaskRemove
// (store/modules/photos.js:8,50-58)——done 任务的延迟移除计时器,按 id 去重(同 id 再次
// 调度会先清掉旧的)。同样是模块级单例,__resetForTest() 必须显式清掉。
const _doneRemovalTimers = new Map<string | number, ReturnType<typeof setTimeout>>()

function _cancelDoneRemoval(id: string | number): void {
  const t = _doneRemovalTimers.get(id)
  if (t !== undefined) {
    clearTimeout(t)
    _doneRemovalTimers.delete(id)
  }
}

// A legacy backend answers 404 on the bucket directory every single time. Probing
// on every page entry is pure noise, so a 404 parks the probe for a while. This
// is a timestamp, not store state — it must not be reactive, and __resetForTest
// has to clear it or one test's 404 would silence the next test's probe.
const BUCKET_PROBE_BACKOFF_MS = 10 * 60_000
let _bucketProbeRetryAfter = 0

// The backend clamps a bucket page to 500 rows, so paging is not optional for a
// busy month. The page ceiling is a runaway guard, not a product limit: 40 pages
// is 20k assets in one month, far past any real library.
const BUCKET_PAGE_SIZE = 500
const BUCKET_MAX_PAGES = 40

// Promises are not store state. Keyed so two viewport events for the same month
// share one request instead of racing.
const _bucketInflight = new Map<string, Promise<void>>()

export function __resetBucketProbeForTest(): void {
  _bucketProbeRetryAfter = 0
  _bucketInflight.clear()
}

// Indexing polls every 5s and each tick used to refetch the whole timeline. The
// directory is cheap enough to poll, but not free — debounce it so a burst of
// index progress cannot turn into a burst of requests.
const INDEX_REFRESH_DEBOUNCE_MS = 3_000
let _lastIndexRefreshAt = 0

export function __resetIndexRefreshForTest(): void {
  _lastIndexRefreshAt = 0
}

export const useTimelineStore = defineStore('photos-timeline', () => {
  const timelineGroups = ref<TimelineGroup[]>([])
  const loading = ref(false)
  const indexStatus = ref<IndexStatus>(emptyIndexStatus())
  const tasks = ref<TaskBusPayload[]>([])

  const buckets = ref<BucketMeta[]>([])
  const bucketAssets = ref<Map<string, Photo[]>>(new Map())
  const bucketLoading = ref<Set<string>>(new Set())
  const bucketMode = ref(false)

  // Returns a plain Month in the legacy branch and a Month with the SP15-P3
  // bucket fields populated (loaded/count/videoCount) in the bucket branch —
  // see bucketToMonth in timelineBuckets.ts. Month itself carries those fields
  // as optional (assetToPhoto.ts), so no store-local widening type is needed.
  const months = computed<Month[]>(() => {
    if (bucketMode.value) {
      return buckets.value.map((b) => bucketToMonth(b, bucketAssets.value.get(bucketKey(b)) ?? null))
    }
    return timelineGroups.value.map(g => groupToMonth(g))
  })
  const allPhotos = computed(() => months.value.flatMap(m => m.photos))
  const isIndexing = computed(() => indexStatus.value.pending > 0 || indexStatus.value.queueLen > 0)

  // In bucket mode the directory knows the whole library, so these are exact
  // before a single asset has been fetched. The legacy branch can only count
  // what it holds — which was always wrong for a large library, and stays as it
  // was because that path has no directory to consult.
  const totalCount = computed(() =>
    bucketMode.value
      ? buckets.value.reduce((s, b) => s + b.count, 0)
      : allPhotos.value.length,
  )
  const videoCount = computed(() =>
    bucketMode.value
      ? buckets.value.reduce((s, b) => s + b.videoCount, 0)
      : allPhotos.value.filter(p => p.isVideo).length,
  )
  const photoCount = computed(() =>
    bucketMode.value
      ? Math.max(0, totalCount.value - videoCount.value)
      : allPhotos.value.filter(p => !p.isVideo).length,
  )

  // Replacing the directory is never just an assignment: the caches that hang off
  // it have to be reconciled in the same breath, or the grid renders assets the
  // directory no longer describes.
  //
  // Whole-branch review fix (Important 5): this used to live only inside
  // refreshBuckets, while fetchTimeline — which runs on every mount of /photos and
  // on every socket reconnect — overwrote `buckets` raw. So leaving /photos and
  // coming back after something else added to or deleted from a month left the
  // summary saying 11 and the month showing its cached 10 forever: the next
  // refreshBuckets diffs new-against-new and finds nothing stale, and a deleted
  // asset keeps a tile that 404s in the lightbox. Both entry points go through
  // here now.
  function applyDirectory(next: BucketMeta[]): void {
    const stale = staleBucketKeys(buckets.value, next, bucketAssets.value.keys())
    const live = new Set(next.map((b) => bucketKey(b)))
    const map = new Map(bucketAssets.value)
    for (const key of stale) map.delete(key)
    // Defence in depth, kept deliberately (T5 review flagged it as dead): the only
    // writer that can put a key into bucketAssets is fetchBucket, and it now
    // refuses to write a bucket whose directory entry changed or vanished while it
    // was in flight (see below). If that guard is ever weakened, this loop is what
    // stops an orphan key surviving for the lifetime of the page.
    for (const key of [...map.keys()]) if (!live.has(key)) map.delete(key)
    buckets.value = next
    bucketAssets.value = map
  }

  async function fetchTimeline() {
    loading.value = true
    try {
      if (Date.now() >= _bucketProbeRetryAfter) {
        try {
          const raw = await service.photos.getTimelineBuckets()
          applyDirectory(normalizeBuckets(raw))
          bucketMode.value = true
          // Both sources feed `months`; leaving legacy groups behind would
          // render every month twice.
          timelineGroups.value = []
          return
        } catch (e) {
          if (isNotFound(e)) {
            _bucketProbeRetryAfter = Date.now() + BUCKET_PROBE_BACKOFF_MS
          } else {
            // A network blip must not pin the user on the legacy path for ten
            // minutes — only a 404 (this backend has no bucket endpoints) does.
            console.error('[photos-timeline] bucket probe', e)
          }
        }
      }
      // Whole-branch review fix (Important 5, second half): the fall-through must
      // not leave a working bucket mode rendering a directory nobody refreshes any
      // more — if bucketMode stayed true, `months` would ignore this response
      // entirely and it would be dead memory.
      //
      // R2 (regression from the first version of that fix): the flag is flipped
      // AFTER the legacy call answers, not before it. Flipping first meant a
      // double failure — the probe blips and the legacy endpoint is down too, i.e.
      // a backend restart mid-session — left bucketMode false while
      // `timelineGroups` was still the `[]` that entering bucket mode wrote: an
      // empty `months`, so the page rendered "No photos" over a library that
      // exists, and Photos.vue has no error branch (only `store.loading`) to say
      // otherwise. Keeping the previous directory on screen is the lesser evil, and
      // the next mount or socket reconnect probes again. There is no await between
      // the two lines below, so no render can catch bucket mode off with the groups
      // not yet in place.
      const res = await service.photos.getTimeline()
      bucketMode.value = false
      timelineGroups.value = (res as TimelineGroup[] | null | undefined) ?? []
    } catch (e) {
      console.error('[photos-timeline] fetchTimeline', e)
    } finally {
      loading.value = false
    }
  }

  // Silent refresh: refetch and replace the timeline without flipping `loading`.
  // Used for background incremental refresh while indexing is in progress —
  // list stays keyed by asset id / thumbnail URL so consumers can diff without
  // a full-page loading flash.
  async function refreshTimelineQuiet() {
    try {
      const res = await service.photos.getTimeline()
      timelineGroups.value = (res as TimelineGroup[] | null | undefined) ?? []
    } catch (e) {
      console.error('[photos-timeline] refreshTimelineQuiet', e)
    }
  }

  async function fetchIndexStatus() {
    try {
      const res = await service.photos.getStatus()
      const prevIndexed = indexStatus.value.indexed ?? 0
      const next = (res as Partial<IndexStatus> | null | undefined) ?? emptyIndexStatus()
      indexStatus.value = { ...emptyIndexStatus(), ...next }
      const nextIndexed = indexStatus.value.indexed ?? 0

      // Indexing is async (upload complete !== timeline-visible; backend still
      // has to run EXIF/thumbnail/CLIP/faces/OCR). When polling observes
      // "indexed count grew", refresh the photo wall so newly-indexed photos
      // appear automatically. Quiet refresh (no loading flip) avoids a flash
      // every 5s.
      if (nextIndexed > prevIndexed) {
        if (bucketMode.value) {
          const now = Date.now()
          if (now - _lastIndexRefreshAt >= INDEX_REFRESH_DEBOUNCE_MS) {
            _lastIndexRefreshAt = now
            void refreshBuckets()
          }
        } else {
          void refreshTimelineQuiet()
        }
      }

      // Level-triggered reconciliation: clear stale/stuck index tasks, trusting
      // DB truth. Uploads are sequential (one file at a time), so a momentary
      // pending==0 && queueLen==0 gap can appear between two files; clearing
      // index tasks right then would make the task bar disappear and
      // immediately reappear (jarring). So index tasks are only cleared when
      // the local task list also shows no active upload in flight.
      const indexIdle = (indexStatus.value.pending || 0) === 0 && (indexStatus.value.queueLen || 0) === 0
      const uploadsActive = tasks.value.some(
        t => t.type === 'upload' && (t.status === 'pending' || t.status === 'uploading'),
      )
      if (indexIdle && !uploadsActive) {
        tasks.value = tasks.value.filter(t => t.type !== 'index')
      }
    } catch {
      // 对齐 Vue2:轮询失败静默,恢复由下轮补 —— 后端下线时这条 5s 轮询会持续
      // 报错刷屏(NimoOS-UI src/store/modules/photos.js 的等价轮询同样吞掉异常)。
    }
  }

  function startIndexPoll() {
    if (_pollTimer) return
    void fetchIndexStatus()
    _pollTimer = setInterval(() => void fetchIndexStatus(), 5000)
  }

  function stopIndexPoll() {
    if (_pollTimer) {
      clearInterval(_pollTimer)
      _pollTimer = null
    }
  }

  async function fetchTasks() {
    try {
      const res = await service.photos.listTasks()
      const wrapper = res as { tasks?: TaskBusPayload[] } | null | undefined
      tasks.value = wrapper?.tasks ?? []
    } catch (e) {
      console.warn('[photos-timeline] fetchTasks failed', e)
      tasks.value = []
    }
  }

  function ingestTaskBus(evt: unknown) {
    const task = unwrapTaskBusPayload(evt)
    if (!task || !task.id) return
    const idx = tasks.value.findIndex(t => t.id === task.id)
    if (idx >= 0) {
      tasks.value.splice(idx, 1, { ...tasks.value[idx], ...task })
    } else {
      tasks.value.push(task)
    }

    // P8a-T10(P1 挂账,照 Vue2 _onTaskBus store/modules/photos.js:1382-1406):非 index 类型
    // 的 done 任务 5s 后自动从列表移除;running 事件说明任务复活,取消挂起的移除计时器。
    // index 类型故意不接这套计时器——它由 fetchIndexStatus 的 idle 对账(:118-120,按后端
    // pending/queueLen 真实进度收尾)负责摘除,两套机制同时管一种任务类型会变成任务列表的
    // 第二个真相源(违反"不建第二个任务列表源"的约束)。Vue2 源里 index 其实也会走这个计时器
    // (只在 face 任务已存在时才改成立即摘除),但 New-UI 早在 timeline.ts 落地 fetchIndexStatus
    // 时就已经用 idle 对账取代了 index 的收尾路径,这里维持既有分工,不重新引入计时器竞争。
    //
    // 终审 Minor 5:Vue2 :1403-1406 对 status==='error' 的任务同样 scheduleTaskRemove,
    // 只是延迟 10s(不是 done 的 5s)。此前这段只搬了 running/done 两支,error 任务因此永久
    // 留在任务列表里——不是"考虑过 error 之后决定不做"的偏离,是遗漏,现补上,复用同一张
    // _doneRemovalTimers 表(不新开第二张计时器 map)。
    if (task.status === 'running') {
      _cancelDoneRemoval(task.id)
    } else if (task.status === 'done' && task.type !== 'index') {
      _cancelDoneRemoval(task.id)
      const id = task.id
      const timer = setTimeout(() => {
        _doneRemovalTimers.delete(id)
        tasks.value = tasks.value.filter(t => t.id !== id)
      }, 5000)
      _doneRemovalTimers.set(id, timer)
    } else if (task.status === 'error') {
      _cancelDoneRemoval(task.id)
      const id = task.id
      const timer = setTimeout(() => {
        _doneRemovalTimers.delete(id)
        tasks.value = tasks.value.filter(t => t.id !== id)
      }, 10000)
      _doneRemovalTimers.set(id, timer)
    }
  }

  async function fetchBucket(key: string): Promise<void> {
    if (!bucketMode.value) return
    if (bucketAssets.value.has(key)) return
    const inflight = _bucketInflight.get(key)
    if (inflight) return inflight
    const ym = parseBucketKey(key)
    if (!ym) return
    const meta = buckets.value.find((b) => bucketKey(b) === key)
    if (!meta) return

    const run = (async () => {
      const next = new Set(bucketLoading.value)
      next.add(key)
      bucketLoading.value = next
      // Set when the pages are thrown away because the directory moved under
      // them. Read in `finally`, after this run has deregistered itself — see the
      // comment there for why the signal cannot be sent from the drop branch.
      let droppedByDirectoryChange = false
      try {
        const photos: Photo[] = []
        for (let page = 0; page < BUCKET_MAX_PAGES; page++) {
          const raw = await service.photos.getTimelineBucket(
            ym.year, ym.month, BUCKET_PAGE_SIZE, page * BUCKET_PAGE_SIZE,
          )
          const list = (raw as unknown[] | null | undefined) ?? []
          photos.push(...list.map((a) => assetToPhoto(a as Record<string, unknown>)))
          // A short page means the month is exhausted; the directory count is
          // only an upper bound (an asset can be deleted between the two calls).
          if (list.length < BUCKET_PAGE_SIZE) break
          if (photos.length >= meta.count) break
          if (page === BUCKET_MAX_PAGES - 1) {
            console.warn('[photos-timeline] bucket truncated at the page ceiling', key, photos.length)
          }
        }
        // Whole-branch review fix (minor 10): a directory refresh can land while
        // these pages are in flight, and it makes its staleness decision before
        // this write happens — so without this check the month would be cached
        // from a directory that no longer exists, and the NEXT refresh (diffing
        // new against new) would never find it stale. A bucket that vanished
        // outright would leak its key for the lifetime of the page.
        //
        // The check is per-key rather than a global directory counter on purpose.
        // A counter would drop this write on ANY refresh, and while indexing the
        // directory refreshes every few seconds — a big month that takes longer
        // than that to page in would be re-requested and re-dropped forever. The
        // condition below is the same one staleBucketKeys uses (count or
        // videoCount moved, or the bucket is gone), so a month that did not change
        // keeps the pages it just paid for, and one that did change is refetched
        // by the grid's level-triggered request.
        const nowMeta = buckets.value.find((b) => bucketKey(b) === key)
        if (!nowMeta || nowMeta.count !== meta.count || nowMeta.videoCount !== meta.videoCount) {
          console.warn('[photos-timeline] bucket changed while loading, dropping the page', key)
          droppedByDirectoryChange = true
          return
        }
        const map = new Map(bucketAssets.value)
        map.set(key, photos)
        bucketAssets.value = map
      } catch (e) {
        // Leave the month unloaded. The grid re-asks for it on its own: the
        // request is level-triggered on "inside the window and still unloaded"
        // (PhotosGrid.vue's requestPendingBuckets), so recovery does not depend on
        // the user scrolling the month out of the window and back — which was the
        // claim this comment used to make, and it was wrong for the common case of
        // a month that failed while it was on screen the whole time.
        console.error('[photos-timeline] fetchBucket', key, e)
      } finally {
        const done = new Set(bucketLoading.value)
        done.delete(key)
        bucketLoading.value = done
        _bucketInflight.delete(key)
        // R1 (regression introduced by the minor-10 guard): a dropped run must not
        // end in silence. The directory change that doomed it did make the grid
        // emit `need-bucket` — but that emit landed while this run was still
        // registered above, so the dedupe swallowed it, and then this run returned
        // without writing anything. Nothing else in the drop path is reactive
        // (`bucketLoading` is not a dependency of `months`, nor of Photos.vue's
        // `gridMonths`), so the month shimmered until some unrelated event moved
        // the directory again or the user scrolled across a rootMargin boundary —
        // exactly the permanent skeleton the level-triggered request exists to
        // remove, and now on a perfectly healthy backend.
        //
        // Republishing bucketAssets under a new identity (same content) makes
        // `months` recompute, which re-runs the grid's level-triggered request; by
        // now this key is out of `_bucketInflight`, so the re-ask goes through and
        // walks the pages again against the fresh directory. It is sent from
        // `finally`, after deregistration, for exactly that reason — from the drop
        // branch itself the dedupe would still be armed.
        //
        // Bounded by construction rather than by a counter: only a directory
        // change can doom a walk, so each directory change costs at most one extra
        // walk. Directory changes are themselves rate-limited (refreshBuckets is
        // debounced to one per 3s while indexing), and a walk that is not doomed
        // writes its pages and ends the cycle. No dropped run re-enters itself, so
        // nothing can chain.
        if (droppedByDirectoryChange) bucketAssets.value = new Map(bucketAssets.value)
      }
    })()
    _bucketInflight.set(key, run)
    return run
  }

  // Refresh the directory only — a few hundred bytes — and drop just the caches
  // it invalidates. Untouched months keep their exact photo arrays so the grid
  // does not re-render them.
  async function refreshBuckets(): Promise<void> {
    if (!bucketMode.value) return
    try {
      const raw = await service.photos.getTimelineBuckets()
      applyDirectory(normalizeBuckets(raw))
    } catch (e) {
      console.error('[photos-timeline] refreshBuckets', e)
    }
  }

  // Consumers that need actual photos rather than just structure (the library
  // picker, "make an album from the last 30 days") cannot work off the directory
  // alone. They ask for the newest N months, which is cheap and enough: both use
  // cases care about recent photos first, and the picker pages further back as
  // the user scrolls.
  async function fetchNewestBuckets(n: number): Promise<void> {
    if (!bucketMode.value || n <= 0) return
    const dated = buckets.value.filter((b) => !(b.year === 0 && b.month === 0))
    await Promise.all(dated.slice(0, n).map((b) => fetchBucket(bucketKey(b))))
  }

  // Remove ids from every loaded bucket and take the directory counts down by
  // what was actually removed locally. Counting the requested ids instead would
  // leave the header lying whenever a delete partially failed.
  function removeAssetsFromBuckets(ids: string[]): void {
    if (!bucketMode.value || ids.length === 0) return
    const doomed = new Set(ids.map(String))
    const map = new Map(bucketAssets.value)
    const removedPerKey = new Map<string, { total: number; videos: number }>()
    for (const [key, photos] of map) {
      let total = 0
      let videos = 0
      const kept = photos.filter((p) => {
        if (!doomed.has(String(p.id))) return true
        total++
        if (p.isVideo) videos++
        return false
      })
      if (total === 0) continue
      map.set(key, kept)
      removedPerKey.set(key, { total, videos })
    }
    if (removedPerKey.size === 0) return
    bucketAssets.value = map
    buckets.value = buckets.value.map((b) => {
      const hit = removedPerKey.get(bucketKey(b))
      if (!hit) return b
      return {
        ...b,
        count: Math.max(0, b.count - hit.total),
        videoCount: Math.max(0, b.videoCount - hit.videos),
      }
    })
  }

  async function deleteAssets(ids: string[]): Promise<number> {
    const deleted: string[] = []
    for (const id of ids) {
      try {
        await service.photos.deleteAsset(id)
        deleted.push(id)
      } catch (e) {
        console.error('[photos-timeline] deleteAsset', id, e)
      }
    }
    if (deleted.length > 0) {
      if (bucketMode.value) removeAssetsFromBuckets(deleted)
      else await refreshTimelineQuiet()
    }
    return deleted.length
  }

  // Pinia setup-stores don't get an automatic $reset() (that's option-store
  // only) — implement our own state reset, mirroring how other setup stores
  // in this codebase would if they needed a test-only teardown hook.
  function resetState() {
    timelineGroups.value = []
    loading.value = false
    indexStatus.value = emptyIndexStatus()
    tasks.value = []
    buckets.value = []
    bucketAssets.value = new Map()
    bucketLoading.value = new Set()
    bucketMode.value = false
  }

  function __resetForTest() {
    stopIndexPoll()
    for (const t of _doneRemovalTimers.values()) clearTimeout(t)
    _doneRemovalTimers.clear()
    __resetBucketProbeForTest()
    __resetIndexRefreshForTest()
    resetState()
  }

  return {
    timelineGroups,
    loading,
    indexStatus,
    tasks,
    buckets,
    bucketAssets,
    bucketLoading,
    bucketMode,
    months,
    allPhotos,
    isIndexing,
    photoCount,
    videoCount,
    totalCount,
    fetchTimeline,
    refreshTimelineQuiet,
    fetchIndexStatus,
    startIndexPoll,
    stopIndexPoll,
    fetchTasks,
    ingestTaskBus,
    deleteAssets,
    fetchBucket,
    fetchNewestBuckets,
    refreshBuckets,
    __resetForTest,
  }
})
