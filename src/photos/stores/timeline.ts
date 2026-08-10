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
import { groupToMonth, type Month, type Photo } from '../util/assetToPhoto'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../util/taskBus'
import { isNotFound } from '../util/httpErrors'
import {
  bucketKey, bucketToMonth, normalizeBuckets, type BucketMeta,
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

export function __resetBucketProbeForTest(): void {
  _bucketProbeRetryAfter = 0
}

// `months` returns a plain Month in the legacy branch and a
// Month & {loaded, count, videoCount} in the bucket branch (bucketToMonth's
// return type — see timelineBuckets.ts). Widening `Month` itself belongs to
// Task 6, so this store-local type (optional extra fields) covers what
// `months` actually produces without touching the shared interface.
type TimelineMonth = Month & { loaded?: boolean; count?: number; videoCount?: number }

export const useTimelineStore = defineStore('photos-timeline', () => {
  const timelineGroups = ref<TimelineGroup[]>([])
  const loading = ref(false)
  const indexStatus = ref<IndexStatus>(emptyIndexStatus())
  const tasks = ref<TaskBusPayload[]>([])

  const buckets = ref<BucketMeta[]>([])
  const bucketAssets = ref<Map<string, Photo[]>>(new Map())
  const bucketLoading = ref<Set<string>>(new Set())
  const bucketMode = ref(false)

  const months = computed<TimelineMonth[]>(() => {
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

  async function fetchTimeline() {
    loading.value = true
    try {
      if (Date.now() >= _bucketProbeRetryAfter) {
        try {
          const raw = await service.photos.getTimelineBuckets()
          buckets.value = normalizeBuckets(raw)
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
      const res = await service.photos.getTimeline()
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
        void refreshTimelineQuiet()
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

  async function deleteAssets(ids: string[]): Promise<number> {
    let successCount = 0
    for (const id of ids) {
      try {
        await service.photos.deleteAsset(id)
        successCount++
      } catch (e) {
        console.error('[photos-timeline] deleteAsset', id, e)
      }
    }
    if (successCount > 0) {
      await refreshTimelineQuiet()
    }
    return successCount
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
    __resetForTest,
  }
})
