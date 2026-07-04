import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetForTest, getAllQueueItems, getBlob, putQueueItem, putBlob } from './idb'
import {
  persistNewItem, persistItemMeta, dropPersisted, restoreFromIDB,
  pruneOldItems, _resetBudgetForTest,
} from './persist'
import { canStoreBlob, PER_FILE_BLOB_CAP, TOTAL_BLOB_BUDGET } from './budget'
import type { UploadItem } from './types'

function mkItem(over: Partial<UploadItem> = {}): UploadItem {
  return {
    id: 'i1', file: new Blob(['data']), fileName: 'a.txt', fileType: 'text/plain',
    size: 4, targetPath: '/DATA/x', relativePath: 'a.txt', status: 'pending',
    progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0,
    error: '', createdAt: 1000, batchId: 'b', batchTotal: 1, restored: false,
    conflictPolicy: '', oversize: false, ...over,
  }
}

// persist writes are fire-and-forget; flush microtasks/timers before asserting.
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  ;(globalThis as any).indexedDB = new IDBFactory()
  _resetForTest()
  _resetBudgetForTest()
})

describe('persist', () => {
  it('persistNewItem within budget writes meta + blob, blobStored true', async () => {
    persistNewItem(mkItem())
    await flush()
    const rows = await getAllQueueItems()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('i1')
    expect(rows[0].blobStored).toBe(true)
    expect(rows[0].file).toBeUndefined() // stripped
    expect(await getBlob('i1')).toBeInstanceOf(Blob)
  })

  it('persistNewItem over per-file cap writes meta only, blobStored false', async () => {
    persistNewItem(mkItem({ size: 300 * 1024 * 1024, oversize: true }))
    await flush()
    const rows = await getAllQueueItems()
    expect(rows[0].blobStored).toBe(false)
    expect(await getBlob('i1')).toBeUndefined()
  })

  it('dropPersisted removes record + blob and frees budget', async () => {
    persistNewItem(mkItem({ id: 'a', size: 4 }))
    await flush()
    dropPersisted('a')
    await flush()
    expect(await getAllQueueItems()).toEqual([])
    expect(await getBlob('a')).toBeUndefined()
  })

  it('restoreFromIDB: blob present → pending+file; counts resumed', async () => {
    await putQueueItem({ ...stripFile(mkItem({ id: 'r1' })), blobStored: true })
    await putBlob('r1', new Blob(['data']))
    const { items, resumedCount } = await restoreFromIDB()
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('pending')
    expect(items[0].file).toBeInstanceOf(Blob)
    expect(items[0].restored).toBe(true)
    expect(resumedCount).toBe(1)
  })

  it('restoreFromIDB keeps paused items paused (not auto-resumed)', async () => {
    await putQueueItem({ ...stripFile(mkItem({ id: 'pz', status: 'paused' })), blobStored: true })
    await putBlob('pz', new Blob(['data']))
    const { items, resumedCount } = await restoreFromIDB()
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('paused')
    expect(items[0].file).toBeTruthy()
    expect(resumedCount).toBe(0) // paused does not count as auto-resumed
  })

  it('restoreFromIDB: blobStored but blob gone → needs_file', async () => {
    await putQueueItem({ ...stripFile(mkItem({ id: 'r2' })), blobStored: true })
    const { items, resumedCount } = await restoreFromIDB()
    expect(items[0].status).toBe('needs_file')
    expect(items[0].file).toBeNull()
    expect(resumedCount).toBe(0)
  })

  it('restoreFromIDB: no blobStored → needs_file', async () => {
    await putQueueItem({ ...stripFile(mkItem({ id: 'r3' })), blobStored: false })
    const { items } = await restoreFromIDB()
    expect(items[0].status).toBe('needs_file')
  })

  it('restoreFromIDB prunes leftover done items', async () => {
    await putQueueItem({ ...stripFile(mkItem({ id: 'd1', status: 'done' })), blobStored: false })
    const { items } = await restoreFromIDB()
    expect(items).toEqual([])
    expect(await getAllQueueItems()).toEqual([])
  })

  it('restoreFromIDB swallows open errors → empty (memory-only mode)', async () => {
    vi.stubGlobal('indexedDB', undefined as any)
    _resetForTest()
    const { items, resumedCount } = await restoreFromIDB()
    expect(items).toEqual([])
    expect(resumedCount).toBe(0)
    vi.unstubAllGlobals()
  })

  it('pruneOldItems forwards to idb.pruneOld', async () => {
    await putQueueItem({ ...stripFile(mkItem({ id: 'old', createdAt: 10 })), blobStored: false })
    const removed = await pruneOldItems(1000)
    expect(removed).toBe(1)
  })

  it('persistItemMeta re-persists metadata, preserving blobStored=true for in-budget item', async () => {
    persistNewItem(mkItem({ id: 'm1', size: 4 }))
    await flush()
    expect((await getAllQueueItems())[0].blobStored).toBe(true)

    // Mutate status and tusUploadUrl via persistItemMeta
    const updated = mkItem({ id: 'm1', size: 4, status: 'uploading', tusUploadUrl: '/v2/nimoos/file/upload-tus/abc' })
    persistItemMeta(updated)
    await flush()

    const rows = await getAllQueueItems()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('m1')
    expect(rows[0].status).toBe('uploading')
    expect(rows[0].tusUploadUrl).toBe('/v2/nimoos/file/upload-tus/abc')
    expect(rows[0].blobStored).toBe(true) // preserved from storedBlob map
    expect(rows[0].file).toBeUndefined() // stripped
    expect(rows[0].thumbUrl).toBeUndefined() // stripped
  })

  it('persistItemMeta preserves blobStored=false for over-cap item', async () => {
    persistNewItem(mkItem({ id: 'm2', size: 300 * 1024 * 1024, oversize: true }))
    await flush()
    expect((await getAllQueueItems())[0].blobStored).toBe(false)

    // Update status via persistItemMeta
    const updated = mkItem({ id: 'm2', size: 300 * 1024 * 1024, oversize: true, status: 'uploading' })
    persistItemMeta(updated)
    await flush()

    const rows = await getAllQueueItems()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('m2')
    expect(rows[0].status).toBe('uploading')
    expect(rows[0].blobStored).toBe(false) // oversize items never stored
  })

  it('cumulative budget: fills TOTAL_BLOB_BUDGET across many items, then rejects the overflow item and stops accounting growth', async () => {
    // Fill the budget with as many max-per-file-size items as fit, leaving a
    // remainder smaller than PER_FILE_BLOB_CAP so the next full-size item cannot fit.
    const n = Math.floor(TOTAL_BLOB_BUDGET / PER_FILE_BLOB_CAP)
    for (let i = 0; i < n; i++) {
      persistNewItem(mkItem({ id: `bulk${i}`, size: PER_FILE_BLOB_CAP }))
    }
    await flush()
    const rowsAfterBulk = await getAllQueueItems()
    expect(rowsAfterBulk.filter((r) => r.blobStored).length).toBe(n)

    const usedAfterBulk = n * PER_FILE_BLOB_CAP
    const remaining = TOTAL_BLOB_BUDGET - usedAfterBulk
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThan(PER_FILE_BLOB_CAP) // sanity: next full-size item must not fit
    expect(canStoreBlob(PER_FILE_BLOB_CAP, usedAfterBulk)).toBe(false)

    // One more full-size item goes over budget: meta persists, but no blob is stored.
    persistNewItem(mkItem({ id: 'overBudget', size: PER_FILE_BLOB_CAP }))
    await flush()
    const overRow = (await getAllQueueItems()).find((r) => r.id === 'overBudget')
    expect(overRow?.blobStored).toBe(false)
    expect(await getBlob('overBudget')).toBeUndefined()

    // The rejected attempt must not have grown the accounting: an item sized to
    // exactly the remaining headroom should still fit.
    persistNewItem(mkItem({ id: 'fitsRemaining', size: remaining }))
    await flush()
    const fitsRow = (await getAllQueueItems()).find((r) => r.id === 'fitsRemaining')
    expect(fitsRow?.blobStored).toBe(true)
    expect(await getBlob('fitsRemaining')).toBeInstanceOf(Blob)
  })

  it('dropPersisted frees budget (observable)', async () => {
    // Persist item A with blob stored
    persistNewItem(mkItem({ id: 'a', size: 4 }))
    await flush()
    expect((await getAllQueueItems())[0].blobStored).toBe(true)

    // Drop item A — budget slot is released
    dropPersisted('a')
    await flush()
    expect(await getAllQueueItems()).toEqual([])

    // Restore from IDB — rebuilds storedBlob map (now empty after drop)
    const { items: restored } = await restoreFromIDB()
    expect(restored).toEqual([])

    // Persist item B — the freed budget from A is available
    persistNewItem(mkItem({ id: 'b', size: 4 }))
    await flush()
    const rows = await getAllQueueItems()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('b')
    expect(rows[0].blobStored).toBe(true) // B gets stored because A freed its budget
  })
})

// helper: strip File before writing to IDB (mirrors persist stripForQueue)
function stripFile(it: UploadItem): Record<string, unknown> {
  const { file, thumbUrl, ...rest } = it
  return rest
}
