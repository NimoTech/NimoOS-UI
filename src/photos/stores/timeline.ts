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
import { groupToMonth, type Month } from '../util/assetToPhoto'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../util/taskBus'

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

export const useTimelineStore = defineStore('photos-timeline', () => {
  const timelineGroups = ref<TimelineGroup[]>([])
  const loading = ref(false)
  const indexStatus = ref<IndexStatus>(emptyIndexStatus())
  const tasks = ref<TaskBusPayload[]>([])

  const months = computed<Month[]>(() => timelineGroups.value.map(g => groupToMonth(g)))
  const allPhotos = computed(() => months.value.flatMap(m => m.photos))
  const isIndexing = computed(() => indexStatus.value.pending > 0 || indexStatus.value.queueLen > 0)
  const photoCount = computed(() => allPhotos.value.filter(p => !p.isVideo).length)
  const videoCount = computed(() => allPhotos.value.filter(p => p.isVideo).length)

  async function fetchTimeline() {
    loading.value = true
    try {
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
  }

  function __resetForTest() {
    stopIndexPoll()
    resetState()
  }

  return {
    timelineGroups,
    loading,
    indexStatus,
    tasks,
    months,
    allPhotos,
    isIndexing,
    photoCount,
    videoCount,
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
