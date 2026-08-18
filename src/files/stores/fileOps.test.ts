import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const deleteTask = vi.fn().mockResolvedValue(undefined)
const getList = vi.fn().mockResolvedValue({ content: [] })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    batch: { deleteTask: (...a: unknown[]) => deleteTask(...a) },
    folder: { getList: (...a: unknown[]) => getList(...a) },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

import { useFileOpsStore } from './fileOps'
import { useFilesStore } from './files'

const envelope = (tasks: unknown[]) => ({ file_operate: JSON.stringify({ data: tasks }) })
const task = (o: Record<string, unknown>) => ({
  id: '1', type: 'copy', finished: false, status: 'PROCESSING',
  processing_path: '/DATA/a', processed_size: 1, total_size: 2, to: '/DATA/x', ...o,
})

describe('fileOps store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('keeps only the active tasks on ingest', () => {
    const s = useFileOpsStore()
    expect(s.active).toEqual([])
    s.ingest(envelope([task({ id: '1', finished: false }), task({ id: '2', finished: true })]))
    expect(s.active.map((t) => t.id)).toEqual(['1'])
  })

  it('ingest: finished task with to === current directory → should reload current directory', () => {
    const files = useFilesStore(); files.currentPath = '/DATA/here'
    const spy = vi.spyOn(files, 'load')
    const s = useFileOpsStore()
    s.ingest(envelope([task({ finished: true, to: '/DATA/here' })]))
    expect(spy).toHaveBeenCalledWith('/DATA/here')
  })

  it('ingest: finished task with to !== current directory → should not reload', () => {
    const files = useFilesStore(); files.currentPath = '/DATA/here'
    const spy = vi.spyOn(files, 'load')
    const s = useFileOpsStore()
    s.ingest(envelope([task({ finished: true, to: '/DATA/other' })]))
    expect(spy).not.toHaveBeenCalled()
  })

  it('ingest: unfinished task even with to === current directory should not reload (reload requires finished)', () => {
    const files = useFilesStore(); files.currentPath = '/DATA/here'
    const spy = vi.spyOn(files, 'load')
    const s = useFileOpsStore()
    s.ingest(envelope([task({ finished: false, to: '/DATA/here' })]))
    expect(spy).not.toHaveBeenCalled()
  })

  it('cancelAll should call batch.deleteTask(0)', async () => {
    const s = useFileOpsStore()
    await s.cancelAll()
    expect(deleteTask).toHaveBeenCalledWith(0)
  })

  // POST /v1/batch/task only means the request was ACCEPTED -- the move itself
  // runs as an async task and reports back over MessageBus. Callers that must
  // know whether it actually ran (favourite repointing) wait on this.
  //
  // The response body carries no task id (measured on the device: a 43-byte
  // standard envelope with data:null), so `to` is the only correlation key
  // available.
  describe('watchDest', () => {
    // Already-resolved sentinel: settle() runs synchronously inside ingest(),
    // so a watch that was going to settle is already settled by the time this
    // races -- `pending` winning therefore means it really is still waiting.
    const raceSettled = (p: Promise<string>) => Promise.race([p, Promise.resolve('pending')])

    it('settles as finished when a FINISHED task lands in the watched destination', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      s.ingest(envelope([task({ id: '9', finished: true, status: 'FINISHED', to: '/DATA/dst' })]))
      await expect(w.settled).resolves.toBe('finished')
    })

    // A cancelled task moved nothing; treating it as a completion is exactly
    // how favourites got repointed at paths that were never created.
    it('reports a CANCELLED task as aborted, not finished', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      s.ingest(envelope([task({ id: '9', finished: true, status: 'CANCELLED', to: '/DATA/dst' })]))
      await expect(w.settled).resolves.toBe('aborted')
    })

    it('treats any other terminal status as aborted too', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      s.ingest(envelope([task({ id: '9', finished: true, status: 'ERROR', to: '/DATA/dst' })]))
      await expect(w.settled).resolves.toBe('aborted')
    })

    it('keeps waiting while the task is still running', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      s.ingest(envelope([task({ id: '9', finished: false, status: 'PROCESSING', to: '/DATA/dst' })]))
      await expect(raceSettled(w.settled)).resolves.toBe('pending')
    })

    it('keeps waiting for a task that finished somewhere else', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      s.ingest(envelope([task({ id: '9', finished: true, status: 'FINISHED', to: '/DATA/other' })]))
      await expect(raceSettled(w.settled)).resolves.toBe('pending')
    })

    // Every event repeats the whole task list, so a task that finished before
    // this watch was even registered keeps arriving. Settling on it would
    // report someone else's completion as this paste's.
    it('ignores tasks that had already finished before the watch was registered', async () => {
      const s = useFileOpsStore()
      s.ingest(envelope([task({ id: 'old', finished: true, status: 'FINISHED', to: '/DATA/dst' })]))
      const w = s.watchDest('/DATA/dst')
      s.ingest(envelope([task({ id: 'old', finished: true, status: 'FINISHED', to: '/DATA/dst' })]))
      await expect(raceSettled(w.settled)).resolves.toBe('pending')
      s.ingest(envelope([task({ id: 'new', finished: true, status: 'FINISHED', to: '/DATA/dst' })]))
      await expect(w.settled).resolves.toBe('finished')
    })

    // A completion event can be dropped outright (MessageBus subscriber buffer
    // is 1) -- the registration must not sit in the map forever waiting for it.
    it('times out instead of waiting forever when no event ever arrives', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst', 5)
      await expect(w.settled).resolves.toBe('timeout')
    })

    it('cancel settles the watch immediately so a caller that no longer needs it does not linger', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      w.cancel()
      await expect(w.settled).resolves.toBe('aborted')
    })

    // The registration id is the guard: a settled watch is removed from the
    // map, so a late event (or the timer) finds nothing and cannot re-resolve
    // an outcome the caller already acted on.
    it('a matching event after cancel cannot change the outcome', async () => {
      const s = useFileOpsStore()
      const w = s.watchDest('/DATA/dst')
      w.cancel()
      s.ingest(envelope([task({ id: '9', finished: true, status: 'FINISHED', to: '/DATA/dst' })]))
      await expect(w.settled).resolves.toBe('aborted')
    })

    it('settles each concurrent watch on its own destination', async () => {
      const s = useFileOpsStore()
      const a = s.watchDest('/DATA/a')
      const b = s.watchDest('/DATA/b')
      s.ingest(envelope([task({ id: '9', finished: true, status: 'FINISHED', to: '/DATA/a' })]))
      await expect(a.settled).resolves.toBe('finished')
      await expect(raceSettled(b.settled)).resolves.toBe('pending')
      b.cancel()
    })
  })
})
