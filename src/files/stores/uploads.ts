import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { refreshAccessToken, service } from '@nimotech/nimoos-service'
import { createScheduler, type SchedulerDeps } from '../upload/scheduler'
import { safeRandomUUID } from '../upload/uuid'
import { batchLabel, isBatchSettled } from '../upload/uploadBatches'
import type { UploadItem, SelectedFile } from '../upload/types'
import { PROTECTED } from '../util/protect'
import { useFilesStore } from './files'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

export const useUploadsStore = defineStore('files-uploads', () => {
  const queue = ref<UploadItem[]>([])
  const uploading = ref(false)
  // One-shot latch: Files.vue calls initUploads() from onMounted on every SPA
  // navigation, but the Pinia store is an app-lifetime singleton. A real page
  // reload rebuilds the store and resets this flag, so this is still "once
  // per page load", not "once per mount".
  const initialized = ref(false)

  // Batches already toasted (one toast per batch, not per file). Cleared when a
  // batch reactivates (retry) or is fully removed, so a retried batch re-toasts.
  const toastedBatches = new Set<string>()

  let scheduler: ReturnType<typeof createScheduler> | null = null

  // Extracts the tus upload id (server-side staging id) from a resumable
  // upload URL like ".../upload-tus/<id>". Returns '' if there is no URL or
  // it doesn't match the expected shape.
  function tusIdFromUrl(url: string | null): string {
    if (!url) return ''
    const m = String(url).match(/upload-tus\/([^/?#]+)/)
    return m ? m[1] : ''
  }

  // Resolve the server-side tus staging id to cancel. Fresh/local items carry
  // an fq_ id + the tus id inside tusUploadUrl; server-origin rows carry the
  // tus id AS item.id. Mirrors Vue2 fileUpload.js:257-258.
  function resolveTusId(item: UploadItem | undefined): string {
    if (!item) return ''
    const fromUrl = tusIdFromUrl(item.tusUploadUrl)
    if (fromUrl) return fromUrl
    if (item.tusUploadUrl) return '' // had a url but unparseable → nothing to cancel
    return item.id.startsWith('fq_') ? '' : item.id
  }

  function claimNext(): UploadItem | null {
    const item = queue.value.find((i) => i.status === 'pending' && i.file)
    if (!item) return null
    item.status = 'uploading'
    return item
  }

  function patch(id: string, p: Partial<UploadItem>) {
    const item = queue.value.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, p)
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
      conflictPolicy: f.conflictPolicy || '',
    }))

    // Report the manifest before enqueuing: it is the server's sole basis for
    // deciding which files belong to this batch, so it must reach the NAS
    // before the first chunk does. A failed report only warns — reconciliation
    // being unavailable is not a reason to refuse the upload.
    if (items.length > 0) {
      try {
        await service.uploadBatches.createBatch({
          id: batchId,
          targetPath: items[0].targetPath,
          items: items.map((i) => ({ relativePath: i.relativePath, size: i.size })),
        })
      } catch (e) {
        console.warn('[uploads] createBatch failed — batch reconciliation unavailable', e)
      }
    }

    queue.value.push(...items)
    if (items.some((i) => i.status === 'pending')) startUpload()
    return { rejected }
  }

  function retryItem(id: string): void {
    // Also clears tusUploadUrl: the staging area behind it may already be gone
    // (interrupt clears it at once, the sweeper after the idle grace period),
    // and resuming a dead URL loops forever on a misleading "network error".
    patch(id, { status: 'pending', progress: 0, bytesSent: 0, error: '', tusUploadUrl: null })
    startUpload()
  }

  function cancelItem(id: string): void {
    getScheduler().abort(id)
    const item = queue.value.find((i) => i.id === id)
    const tid = resolveTusId(item)
    if (tid) service.file.cancelUpload(tid).catch(() => {})
    queue.value = queue.value.filter((i) => i.id !== id)
  }

  // Batch-level controls (folder / multi-select rows). A single-file batch
  // routes through these too when the panel renders it as one row.
  function retryBatch(batchId: string): void {
    toastedBatches.delete(batchId)
    for (const i of queue.value.filter((x) => x.batchId === batchId && x.status === 'error')) {
      // See retryItem: a stale tusUploadUrl points at staging the server may
      // have already swept away.
      patch(i.id, { status: 'pending', progress: 0, bytesSent: 0, error: '', tusUploadUrl: null })
    }
    startUpload()
  }

  function cancelBatch(batchId: string): void {
    for (const i of queue.value.filter((x) => x.batchId === batchId)) {
      getScheduler().abort(i.id)
      const tid = resolveTusId(i)
      if (tid) service.file.cancelUpload(tid).catch(() => {})
    }
    queue.value = queue.value.filter((i) => i.batchId !== batchId)
    toastedBatches.delete(batchId)
  }

  // Delete EVERY upload task: abort in-flight transfers, cancel server-side
  // staging for any item that has a tusUploadUrl (so nothing leaks), and clear
  // the queue. This removes done/error/paused/uploading alike.
  function cancelAll(): void {
    for (const i of queue.value) {
      getScheduler().abort(i.id)
      const tid = resolveTusId(i)
      if (tid) service.file.cancelUpload(tid).catch(() => {})
    }
    queue.value = []
    toastedBatches.clear()
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
    queue.value = queue.value.filter((i) => i.status !== 'done')
  }

  function resumePending(): void {
    if (queue.value.some((i) => i.status === 'pending' && !!i.file)) startUpload()
  }

  async function initUploads(): Promise<void> {
    if (initialized.value) return
    initialized.value = true
    resumePending()
  }

  const hasActive = computed(() =>
    uploading.value || queue.value.some((i) => i.status === 'pending' && !!i.file),
  )

  return {
    queue,
    uploading,
    hasActive,
    patch,
    addFilesToQueue,
    startUpload,
    retryItem,
    cancelItem,
    retryBatch,
    cancelBatch,
    cancelAll,
    pauseItem,
    resumeItem,
    pauseBatch,
    resumeBatch,
    pauseAll,
    resumeAll,
    clearDone,
    resumePending,
    initUploads,
  }
})
