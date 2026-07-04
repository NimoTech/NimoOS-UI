import type { UploadItem } from './types'
import { canStoreBlob } from './budget'
import {
  openUploadDB, putQueueItem, putBlob, getBlob, getAllQueueItems, removeItemAndBlob, pruneOld,
} from './idb'

// id -> persisted blob size; running sum = budget used. Kept in memory, rebuilt
// from IDB on restore so it survives a refresh.
const storedBlob = new Map<string, number>()
function blobBudgetUsed(): number {
  let n = 0
  for (const v of storedBlob.values()) n += v
  return n
}
export function _resetBudgetForTest(): void { storedBlob.clear() }

function blobSizeOf(item: { size?: number; file?: Blob | File | null }): number {
  if (typeof item.size === 'number' && item.size > 0) return item.size
  return item.file && typeof item.file.size === 'number' ? item.file.size : 0
}

// Persist metadata only (no File/Blob, no thumbUrl) to the queue store.
function stripForQueue(item: UploadItem): Record<string, unknown> {
  const { file, thumbUrl, ...rest } = item
  void file; void thumbUrl
  return rest
}

// Serialize writes per item id so a late meta-write can't resurrect a record a
// later drop already removed (writes are async and not awaited by the caller).
const writeChains = new Map<string, Promise<unknown>>()
function enqueueWrite(id: string, fn: () => Promise<unknown>): Promise<unknown> {
  const prev = writeChains.get(id) || Promise.resolve()
  const next = prev.then(fn, fn).catch((e) => {
    console.warn('[file upload persist] write failed', id, e)
  })
  writeChains.set(id, next)
  next.finally(() => { if (writeChains.get(id) === next) writeChains.delete(id) })
  return next
}

export function persistNewItem(item: UploadItem): void {
  const size = blobSizeOf(item)
  const willStore = !!(item.file && canStoreBlob(size, blobBudgetUsed()))
  if (willStore) storedBlob.set(item.id, size)
  const meta = stripForQueue(item)
  meta.blobStored = willStore
  const blob = item.file
  enqueueWrite(item.id, async () => {
    await putQueueItem(meta)
    if (willStore && blob) await putBlob(item.id, blob)
  })
}

export function persistItemMeta(item: UploadItem): void {
  const meta = stripForQueue(item)
  meta.blobStored = storedBlob.has(item.id)
  enqueueWrite(item.id, () => putQueueItem(meta))
}

export function dropPersisted(id: string): void {
  storedBlob.delete(id)
  enqueueWrite(id, () => removeItemAndBlob(id))
}

export async function restoreFromIDB(): Promise<{ items: UploadItem[]; resumedCount: number }> {
  try {
    await openUploadDB()
    const rows = await getAllQueueItems()
    storedBlob.clear()
    const items: UploadItem[] = []
    for (const it of rows) {
      if (it.status === 'done') {
        // Leftover from an interrupted cleanup — drop defensively.
        await removeItemAndBlob(it.id).catch(() => {})
        continue
      }
      if (it.blobStored) {
        const blob = await getBlob(it.id)
        if (blob) {
          const size = blobSizeOf({ size: it.size, file: blob })
          storedBlob.set(it.id, size)
          // Preserve an explicit paused state across refresh; everything else with
          // bytes resumes automatically.
          const status = it.status === 'paused' ? 'paused' : 'pending'
          items.push({ ...it, status, file: blob, restored: true })
          continue
        }
        // Bytes gone (evicted/quota) — fall through to re-select.
      }
      items.push({ ...it, status: 'needs_file', file: null, restored: true })
    }
    const resumedCount = items.filter((it) => it.status === 'pending' && it.file).length
    return { items, resumedCount }
  } catch (e) {
    console.warn('[file upload persist] restoreFromIDB failed; memory-only mode', e)
    return { items: [], resumedCount: 0 }
  }
}

export function pruneOldItems(cutoffMs: number): Promise<number> {
  return pruneOld(cutoffMs)
}
