import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { refreshAccessToken } from '@nimotech/nimoos-service'
import { createScheduler, type SchedulerDeps } from '../upload/scheduler'
import { precheckExisting, conflictKey, decideConflictPolicy } from '../upload/conflict'
import { canStoreBlob } from '../upload/budget'
import { safeRandomUUID } from '../upload/uuid'
import { batchLabel, isBatchSettled } from '../upload/uploadBatches'
import { persistNewItem, persistItemMeta, dropPersisted, restoreFromIDB, pruneOldItems as prunePersisted } from '../upload/persist'
import type { UploadItem, SelectedFile } from '../upload/types'
import { PROTECTED } from '../util/protect'
import { useFilesStore } from './files'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

export const useUploadsStore = defineStore('files-uploads', () => {
  const queue = ref<UploadItem[]>([])
  const uploading = ref(false)
  const restoreNoticeCount = ref(0)
  // Guards initUploads() to restore exactly once per store lifetime. The
  // Pinia store is an app-lifetime singleton, but Files.vue mounts/unmounts
  // on every SPA navigation (no <keep-alive>) and calls initUploads() from
  // onMounted each time. Without this flag, every revisit re-pushes every
  // still-persisted IDB row onto `queue` with no dedup, producing duplicate
  // ids (patch()'s find() only updates the first match) and re-triggering
  // concurrent re-uploads of the same file. A genuine page refresh recreates
  // the store fresh (flag resets to false), so restore-on-refresh still works
  // — this is deliberately a once-per-page-load feature, not once-per-mount.
  const initialized = ref(false)

  // Batches already toasted (one toast per batch, not per file). Cleared when a
  // batch reactivates (retry) or is fully removed, so a retried batch re-toasts.
  const toastedBatches = new Set<string>()

  let scheduler: ReturnType<typeof createScheduler> | null = null

  function claimNext(): UploadItem | null {
    const item = queue.value.find((i) => i.status === 'pending' && i.file)
    if (!item) return null
    item.status = 'uploading'
    return item
  }

  const VOLATILE = new Set(['progress', 'bytesSent', 'speed'])
  function patch(id: string, p: Partial<UploadItem>) {
    const item = queue.value.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, p)
    // Persistence: skip high-frequency progress ticks; done → drop; else re-persist meta.
    const keys = Object.keys(p)
    const volatileOnly = keys.length > 0 && keys.every((k) => VOLATILE.has(k))
    if (!volatileOnly) {
      if (item.status === 'done') dropPersisted(item.id)
      else persistItemMeta(item)
    }
    // Reactivation (retry/resume) re-arms the batch toast.
    if (item.status === 'pending' || item.status === 'uploading') toastedBatches.delete(item.batchId)
    // Terminal transition → maybe the whole batch just finished.
    if (item.status === 'done' || item.status === 'error') settleBatch(item.batchId)
  }

  // Fire ONE toast per batch when it settles (all items done/error), then clear
  // the batch's done rows after 5s (errors stay for retry). A single-file batch
  // is just a batch of one, so this also covers single uploads.
  function settleBatch(batchId: string) {
    const items = queue.value.filter((i) => i.batchId === batchId)
    if (!isBatchSettled(items) || toastedBatches.has(batchId)) return
    toastedBatches.add(batchId)
    // Count only files actually uploaded (progress 100, incl. server-side
    // duplicates). A pure skip is status 'done' with progress 0 — it is not a
    // success and must not trigger a "上传成功" toast.
    const doneCount = items.filter((i) => i.status === 'done' && i.progress === 100).length
    const errorCount = items.filter((i) => i.status === 'error').length
    if (doneCount > 0) {
      const label = batchLabel(items)
      const t = i18n.global.t
      let msg: string
      if (label.kind === 'single') {
        msg = items[0].error === 'duplicate'
          ? t('filesUploadExists', { name: label.name })
          : t('filesUploadDone', { name: label.name })
      } else if (errorCount > 0) {
        msg = label.kind === 'folder'
          ? t('filesUploadFolderPartial', { name: label.name, failed: errorCount })
          : t('filesUploadFilesPartial', { count: label.count, failed: errorCount })
      } else {
        msg = label.kind === 'folder'
          ? t('filesUploadFolderDone', { name: label.name })
          : t('filesUploadFilesDone', { count: label.count })
      }
      useToast().show(msg, 5000)
    }
    setTimeout(() => {
      for (const i of queue.value.filter((i) => i.batchId === batchId && i.status === 'done')) dropPersisted(i.id)
      queue.value = queue.value.filter((i) => i.batchId !== batchId || i.status !== 'done')
      if (!queue.value.some((i) => i.batchId === batchId)) toastedBatches.delete(batchId)
    }, 5000)
  }

  function getScheduler() {
    if (!scheduler) {
      const deps: SchedulerDeps = {
        claimNext,
        patch,
        refresh: () => refreshAccessToken().then((t) => t, () => null),
        concurrency: 3,
      }
      scheduler = createScheduler(deps)
    }
    return scheduler
  }

  function startUpload(): void {
    if (uploading.value) return
    uploading.value = true
    getScheduler()
      .run()
      .finally(() => {
        uploading.value = false
        const files = useFilesStore()
        files.load(files.currentPath)
      })
  }

  async function addFilesToQueue(files: SelectedFile[]): Promise<{ rejected: string[] }> {
    const rejected: string[] = []
    const survivors: SelectedFile[] = []
    for (const f of files) {
      const first = f.relativePath.split('/')[0]
      if (PROTECTED.includes(first)) rejected.push(f.relativePath)
      else survivors.push(f)
    }

    const batchId = safeRandomUUID()
    const items: UploadItem[] = survivors.map((f, i) => ({
      id: `fq_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      file: f.file,
      fileName: f.file.name,
      fileType: f.file.type,
      size: f.file.size,
      targetPath: f.targetPath,
      relativePath: f.relativePath,
      status: 'pending',
      progress: 0,
      bytesSent: 0,
      speed: 0,
      tusUploadUrl: null,
      retryCount: 0,
      error: '',
      createdAt: Date.now(),
      batchId,
      batchTotal: survivors.length,
      restored: false,
      conflictPolicy: '',
      oversize: !canStoreBlob(f.file.size),
    }))

    try {
      const set = await precheckExisting(survivors)
      for (const item of items) {
        item.status = set.has(conflictKey(item.targetPath, item.relativePath)) ? 'conflict' : 'pending'
      }
    } catch {
      // Precheck unavailable — leave everything pending, server will still
      // reject/handle actual conflicts.
    }

    queue.value.push(...items)
    for (const it of items) persistNewItem(it)
    if (items.some((i) => i.status === 'pending')) startUpload()
    return { rejected }
  }

  function resolveConflict(id: string, choice: string): void {
    const policy = decideConflictPolicy(choice)
    if (policy === 'skip') {
      patch(id, { status: 'done' })
    } else {
      patch(id, { conflictPolicy: policy, status: 'pending' })
    }
    startUpload()
  }

  function retryItem(id: string): void {
    patch(id, { status: 'pending', progress: 0, bytesSent: 0, error: '' })
    startUpload()
  }

  function cancelItem(id: string): void {
    getScheduler().abort(id)
    dropPersisted(id)
    queue.value = queue.value.filter((i) => i.id !== id)
  }

  // Batch-level controls (folder / multi-select rows). A single-file batch
  // routes through these too when the panel renders it as one row.
  function retryBatch(batchId: string): void {
    toastedBatches.delete(batchId)
    for (const i of queue.value) {
      if (i.batchId === batchId && i.status === 'error') {
        Object.assign(i, { status: 'pending', progress: 0, bytesSent: 0, error: '' })
      }
    }
    startUpload()
  }

  function cancelBatch(batchId: string): void {
    for (const i of queue.value.filter((x) => x.batchId === batchId)) {
      getScheduler().abort(i.id)
      dropPersisted(i.id)
    }
    queue.value = queue.value.filter((i) => i.batchId !== batchId)
    toastedBatches.delete(batchId)
  }

  function pauseItem(id: string): void {
    const item = queue.value.find((i) => i.id === id)
    if (!item) return
    if (item.status === 'uploading') getScheduler().pause(id)
    else if (item.status === 'pending') patch(id, { status: 'paused', speed: 0 })
  }

  function resumeItem(id: string): void {
    const item = queue.value.find((i) => i.id === id)
    if (!item || item.status !== 'paused') return
    patch(id, { status: 'pending', error: '' })
    startUpload()
  }

  function pauseBatch(batchId: string): void {
    for (const i of queue.value.filter((x) => x.batchId === batchId)) pauseItem(i.id)
  }

  function resumeBatch(batchId: string): void {
    for (const i of queue.value.filter((x) => x.batchId === batchId && x.status === 'paused')) {
      patch(i.id, { status: 'pending', error: '' })
    }
    startUpload()
  }

  function pauseAll(): void {
    for (const i of queue.value.filter((x) => x.status === 'uploading' || x.status === 'pending')) pauseItem(i.id)
  }

  function resumeAll(): void {
    for (const i of queue.value.filter((x) => x.status === 'paused')) patch(i.id, { status: 'pending', error: '' })
    startUpload()
  }

  function clearDone(): void {
    for (const i of queue.value.filter((i) => i.status === 'done')) dropPersisted(i.id)
    queue.value = queue.value.filter((i) => i.status !== 'done')
  }

  async function restoreQueue(): Promise<void> {
    const { items, resumedCount } = await restoreFromIDB()
    if (items.length) queue.value.push(...items)
    restoreNoticeCount.value = resumedCount
  }

  function resumePending(): void {
    if (queue.value.some((i) => i.status === 'pending' && !!i.file)) startUpload()
  }

  async function reattachFiles(files: SelectedFile[]): Promise<{ matched: number; conflicts: UploadItem[] }> {
    const byRel = new Map<string, File>()
    const byName = new Map<string, File>()
    for (const f of files) {
      const rel = f.relativePath || f.file.name
      if (rel) byRel.set(rel, f.file)
      if (f.file.name) byName.set(f.file.name, f.file)
    }

    const matches: { it: UploadItem; file: File }[] = []
    for (const it of queue.value) {
      if (it.status !== 'needs_file') continue
      const f = byRel.get(it.relativePath) || byName.get(it.fileName)
      if (!f) continue
      // Name matched — size must also match, else it's a different file (skip; let user re-pick).
      if (it.size && f.size && f.size !== it.size) continue
      matches.push({ it, file: f })
    }
    if (matches.length === 0) return { matched: 0, conflicts: [] }

    let existing = new Set<string>()
    try {
      existing = await precheckExisting(
        matches.map(({ it, file }) => ({ file, targetPath: it.targetPath, relativePath: it.relativePath })),
      )
    } catch {
      // Precheck unavailable — upload everything.
    }

    let matched = 0
    const conflicts: UploadItem[] = []
    for (const { it, file } of matches) {
      if (existing.has(conflictKey(it.targetPath, it.relativePath))) {
        patch(it.id, { file, status: 'conflict', error: '', restored: true })
        conflicts.push(it)
      } else {
        patch(it.id, { file, status: 'pending', error: '', restored: true })
        matched++
      }
    }
    if (matched > 0 && !uploading.value) startUpload()
    return { matched, conflicts }
  }

  async function pruneOldItems(days = 30): Promise<void> {
    await prunePersisted(Date.now() - days * 24 * 60 * 60 * 1000)
  }

  async function initUploads(): Promise<void> {
    // Set BEFORE the await: two synchronous mounts in the same tick (e.g. a
    // fast back-and-forth navigation) must not both observe `false` and both
    // proceed to restore — that would double-push the same IDB rows before
    // either call's await yields. Latching first, awaiting second, closes
    // that race; latching only on success would leave the window open.
    if (initialized.value) return
    initialized.value = true
    try {
      await restoreQueue()
      await pruneOldItems(30)
      resumePending()
    } catch (e) {
      console.warn('[uploads] initUploads failed; memory-only mode', e)
    }
  }

  const hasActive = computed(() =>
    uploading.value || queue.value.some((i) => i.status === 'pending' && !!i.file),
  )

  return {
    queue,
    uploading,
    restoreNoticeCount,
    hasActive,
    patch,
    addFilesToQueue,
    resolveConflict,
    startUpload,
    retryItem,
    cancelItem,
    retryBatch,
    cancelBatch,
    pauseItem,
    resumeItem,
    pauseBatch,
    resumeBatch,
    pauseAll,
    resumeAll,
    clearDone,
    restoreQueue,
    resumePending,
    pruneOldItems,
    initUploads,
    reattachFiles,
  }
})
