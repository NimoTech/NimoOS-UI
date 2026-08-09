import type { UploadItem } from './types'

export type BatchLabel =
  | { kind: 'single'; name: string; count: 1 }
  | { kind: 'folder'; name: string; count: number }
  | { kind: 'files'; name: ''; count: number }

export interface BatchView {
  batchId: string
  label: BatchLabel
  total: number
  items: UploadItem[]
  doneCount: number
  errorCount: number
  activeCount: number // pending + uploading
  conflictCount: number
  pausedCount: number
  progress: number // 0-100, bytes-weighted
  sentBytes: number // uploaded so far across the batch
  totalBytes: number // sum of all item sizes in the batch
  zone: 'problem' | 'active' | 'done'
  multi: boolean
}

// Label a batch: a folder upload (webkitdirectory) has every item's
// relativePath rooted at the same top segment AND at least one nested path
// (e.g. "MyFolder/sub/a.txt") → folder name. A single file → its name. A loose
// multi-file selection → a count.
export function batchLabel(items: UploadItem[]): BatchLabel {
  if (items.length === 1) {
    const it = items[0]
    return { kind: 'single', name: it.fileName || it.relativePath, count: 1 }
  }
  const firsts = items.map((i) => i.relativePath.split('/')[0])
  const shared = firsts.every((f) => f === firsts[0]) ? firsts[0] : ''
  const isFolder = !!shared && items.some((i) => i.relativePath.includes('/'))
  return isFolder ? { kind: 'folder', name: shared, count: items.length } : { kind: 'files', name: '', count: items.length }
}

// Group the flat queue into one view per batch (one addFilesToQueue call =
// one batch). A folder or multi-select collapses to a single aggregate row;
// a single file stays one row. Order follows first appearance in the queue.
export function groupByBatch(queue: UploadItem[]): BatchView[] {
  const order: string[] = []
  const map = new Map<string, UploadItem[]>()
  for (const it of queue) {
    if (!map.has(it.batchId)) { map.set(it.batchId, []); order.push(it.batchId) }
    map.get(it.batchId)!.push(it)
  }
  return order.map((batchId) => {
    const items = map.get(batchId)!
    const doneCount = items.filter((i) => i.status === 'done').length
    const errorCount = items.filter((i) => i.status === 'error').length
    const conflictCount = items.filter((i) => i.status === 'conflict').length
    const activeCount = items.filter((i) => i.status === 'pending' || i.status === 'uploading').length
    const pausedCount = items.filter((i) => i.status === 'paused').length
    const totalBytes = items.reduce((s, i) => s + i.size, 0)
    const sentBytes = items.reduce((s, i) => s + (i.status === 'done' ? i.size : i.bytesSent), 0)
    const progress = totalBytes > 0 ? Math.floor((sentBytes / totalBytes) * 100) : activeCount > 0 ? 0 : 100
    const zone: 'problem' | 'active' | 'done' =
      errorCount > 0
        ? 'problem'
        : activeCount > 0 || conflictCount > 0 || pausedCount > 0
          ? 'active'
          : 'done'
    return {
      batchId,
      label: batchLabel(items),
      total: items[0]?.batchTotal ?? items.length,
      items,
      doneCount,
      errorCount,
      activeCount,
      conflictCount,
      pausedCount,
      progress,
      sentBytes,
      totalBytes,
      zone,
      multi: items.length > 1,
    }
  })
}

// A batch is "settled" once nothing is pending/uploading/awaiting a conflict
// decision — every item is terminal (done or error). Used to fire ONE toast
// per batch and to clear the batch afterwards.
export function isBatchSettled(items: UploadItem[]): boolean {
  return items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error')
}
