import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { refreshAccessToken } from '@nimotech/nimoos-service'
import { createScheduler, type SchedulerDeps } from '../upload/scheduler'
import { precheckExisting, conflictKey, decideConflictPolicy } from '../upload/conflict'
import { canStoreBlob } from '../upload/budget'
import type { UploadItem, SelectedFile } from '../upload/types'
import { PROTECTED } from '../util/protect'
import { useFilesStore } from './files'

export const useUploadsStore = defineStore('files-uploads', () => {
  const queue = ref<UploadItem[]>([])
  const uploading = ref(false)
  const restoreNoticeCount = ref(0)

  let scheduler: ReturnType<typeof createScheduler> | null = null

  function claimNext(): UploadItem | null {
    const item = queue.value.find((i) => i.status === 'pending' && i.file)
    if (!item) return null
    item.status = 'uploading'
    return item
  }

  function patch(id: string, p: Partial<UploadItem>) {
    const item = queue.value.find((i) => i.id === id)
    if (item) Object.assign(item, p)
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

    const batchId = crypto.randomUUID()
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
    queue.value = queue.value.filter((i) => i.id !== id)
  }

  function clearDone(): void {
    queue.value = queue.value.filter((i) => i.status !== 'done')
  }

  const hasActive = computed(() =>
    uploading.value || queue.value.some((i) => i.status === 'pending' && !!i.file),
  )

  return {
    queue,
    uploading,
    restoreNoticeCount,
    hasActive,
    addFilesToQueue,
    resolveConflict,
    startUpload,
    retryItem,
    cancelItem,
    clearDone,
  }
})
