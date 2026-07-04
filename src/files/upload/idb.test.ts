import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  openUploadDB, putQueueItem, getAllQueueItems, removeQueueItem,
  putBlob, getBlob, removeBlob, removeItemAndBlob, pruneOld, _resetForTest,
} from './idb'

beforeEach(() => {
  // 每例一套全新 IndexedDB,避免跨例污染
  ;(globalThis as any).indexedDB = new IDBFactory()
  _resetForTest()
})

describe('idb', () => {
  it('opens and round-trips a queue item', async () => {
    await openUploadDB()
    await putQueueItem({ id: 'a', status: 'pending', createdAt: 1 })
    const all = await getAllQueueItems()
    expect(all).toEqual([{ id: 'a', status: 'pending', createdAt: 1 }])
  })

  it('stores and reads a blob by id', async () => {
    const blob = new Blob(['hello'])
    await putBlob('b1', blob)
    const got = await getBlob('b1')
    expect(got).toBeInstanceOf(Blob)
    expect(await getBlob('missing')).toBeUndefined()
  })

  it('removeItemAndBlob deletes both stores', async () => {
    await putQueueItem({ id: 'x', createdAt: 1 })
    await putBlob('x', new Blob(['z']))
    await removeItemAndBlob('x')
    expect(await getAllQueueItems()).toEqual([])
    expect(await getBlob('x')).toBeUndefined()
  })

  it('removeQueueItem / removeBlob delete individually', async () => {
    await putQueueItem({ id: 'q', createdAt: 1 })
    await putBlob('q', new Blob(['z']))
    await removeQueueItem('q')
    expect(await getAllQueueItems()).toEqual([])
    expect(await getBlob('q')).toBeInstanceOf(Blob)
    await removeBlob('q')
    expect(await getBlob('q')).toBeUndefined()
  })

  it('pruneOld removes items older than cutoff, keeps missing/zero createdAt', async () => {
    await putQueueItem({ id: 'old', createdAt: 100 })
    await putQueueItem({ id: 'new', createdAt: 5000 })
    await putQueueItem({ id: 'nodate' }) // missing createdAt → keep
    await putQueueItem({ id: 'zero', createdAt: 0 }) // zero → keep
    const removed = await pruneOld(1000)
    expect(removed).toBe(1)
    const ids = (await getAllQueueItems()).map((i) => i.id).sort()
    expect(ids).toEqual(['new', 'nodate', 'zero'])
  })
})
