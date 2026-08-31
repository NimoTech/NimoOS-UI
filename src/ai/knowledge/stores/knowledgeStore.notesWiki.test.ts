// Unit tests taken from the task brief a captured device response
// Step 2 skeleton (copied verbatim). Covers the notes + distill + wiki groups of knowledgeStore:
// setNotesDraftCount / refreshNotesDraftCount / loadNotesSummary / runSearch /
// loadChunkContext / loadDistillJobs / retryDistill / cancelDistill /
// loadRoots / loadCandidates / createRoot / deleteRoot / rescanRoot /
// loadWikiTree / loadWikiNode / loadWikiRaw / setRootEnabled。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const notes = vi.hoisted(() => ({
  list: vi.fn(),
  listDistillJobs: vi.fn(),
  getDistillStatus: vi.fn(),
  distillFile: vi.fn(),
  cancelDistillJob: vi.fn(),
}))
const wiki = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getCandidates: vi.fn(),
  createRoot: vi.fn(),
  deleteRoot: vi.fn(),
  rescanRoot: vi.fn(),
  patchRootEnabled: vi.fn(),
  getTree: vi.fn(),
  getNode: vi.fn(),
  getRaw: vi.fn(),
}))
const ai = vi.hoisted(() => ({ searchText: vi.fn(), searchChunk: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { notes, wiki, ai } }))
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('../../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))

import { useKnowledgeStore, DISTILL_JOBS_LIMIT } from './knowledgeStore'

const ROOT = {
  id: 'r1',
  path: '/DATA',
  level: 'space',
  watchMode: 'auto',
  storageMode: 'inline',
  enabled: true,
  scanIntervalS: 21600,
  createdAt: 1,
  lastScanAt: 0,
  needsReconcile: false,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('notes group', () => {
  it('refreshNotesDraftCount uses status=draft&limit=200, writes the draft count', async () => {
    notes.list.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    const s = useKnowledgeStore()
    await s.refreshNotesDraftCount()
    expect(notes.list).toHaveBeenCalledWith({ status: 'draft', limit: 200 })
    expect(s.notesDraftCount).toBe(2)
  })

  it('refreshNotesDraftCount silently keeps the old value when the agent is offline', async () => {
    const s = useKnowledgeStore()
    s.setNotesDraftCount(5)
    notes.list.mockRejectedValue(new Error('offline'))
    await s.refreshNotesDraftCount()
    expect(s.notesDraftCount).toBe(5)
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('loadNotesSummary uses limit=500, writes the summary and syncs the draft count', async () => {
    notes.list.mockResolvedValue([{ status: 'draft' }, { status: 'curated' }, { status: 'archived' }])
    const s = useKnowledgeStore()
    await s.loadNotesSummary()
    expect(notes.list).toHaveBeenCalledWith({ limit: 500 })
    expect(s.notesSummary).toEqual({ total: 3, draft: 1, curated: 1, archived: 1 })
    expect(s.notesDraftCount).toBe(1)
  })

  it('loadNotesSummary keeps the old value and does not toast on failure', async () => {
    notes.list.mockResolvedValue([{ status: 'draft' }])
    const s = useKnowledgeStore()
    await s.loadNotesSummary()
    notes.list.mockRejectedValue(new Error('offline'))
    await s.loadNotesSummary()
    expect(s.notesSummary.total).toBe(1)
    expect(toastShow).not.toHaveBeenCalled()
  })
})

describe('distill queue (N4/N5)', () => {
  const JOBS = (rows: unknown[], counts = { pending: 1, running: 2, failed: 3 }) => ({ jobs: rows, counts })

  it('refreshes all three buckets when unfiltered, skipped rolls into the failed bucket', async () => {
    notes.listDistillJobs.mockResolvedValue(
      JOBS([
        { filePath: '/p', status: 'pending' },
        { filePath: '/r', status: 'running' },
        { filePath: '/f', status: 'failed' },
        { filePath: '/s', status: 'skipped' },
      ]),
    )
    notes.getDistillStatus.mockResolvedValue({ distilled: 7 })
    const s = useKnowledgeStore()
    await s.loadDistillJobs()
    expect(notes.listDistillJobs).toHaveBeenCalledWith('', DISTILL_JOBS_LIMIT)
    expect(s.distillJobs.pending).toHaveLength(1)
    expect(s.distillJobs.running).toHaveLength(1)
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f', '/s'])
    expect(s.distillJobs.counts).toEqual({ pending: 1, running: 2, failed: 3 })
    expect(s.distillJobs.done).toBe(7)
    expect(s.distillJobs.total).toBe(4)
  })

  it('only refreshes the filtered bucket, the other two keep their last result (N4 asymmetry, copied as-is)', async () => {
    notes.getDistillStatus.mockResolvedValue({ distilled: 0 })
    notes.listDistillJobs.mockResolvedValue(
      JOBS([
        { filePath: '/p', status: 'pending' },
        { filePath: '/f', status: 'failed' },
      ]),
    )
    const s = useKnowledgeStore()
    await s.loadDistillJobs()
    expect(s.distillJobs.pending).toHaveLength(1)
    notes.listDistillJobs.mockResolvedValue(JOBS([{ filePath: '/f2', status: 'failed' }]))
    await s.loadDistillJobs('failed')
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f2'])
    expect(s.distillJobs.pending).toHaveLength(1) // <- not cleared
  })

  it('retryDistill / cancelDistill reload using the current filter afterward', async () => {
    notes.listDistillJobs.mockResolvedValue(JOBS([]))
    notes.getDistillStatus.mockResolvedValue({ distilled: 0 })
    notes.distillFile.mockResolvedValue({})
    notes.cancelDistillJob.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.retryDistill({ filePath: '/a' }, 'failed')
    expect(notes.distillFile).toHaveBeenCalledWith('/a')
    expect(notes.listDistillJobs).toHaveBeenLastCalledWith('failed', DISTILL_JOBS_LIMIT)
    await s.cancelDistill({ filePath: '/b' }, 'pending')
    expect(notes.cancelDistillJob).toHaveBeenCalledWith('/b')
    expect(notes.listDistillJobs).toHaveBeenLastCalledWith('pending', DISTILL_JOBS_LIMIT)
  })
})

describe('search forwarding', () => {
  it('runSearch assembles the fixed body fields', async () => {
    ai.searchText.mockResolvedValue({ groups: {} })
    const s = useKnowledgeStore()
    await s.runSearch({ query: 'q', filters: { mime: 'pdf' }, topK: 5, rerank: true })
    expect(ai.searchText).toHaveBeenCalledWith({
      query: 'q',
      filters: { mime: 'pdf' },
      top_k: 5,
      rerank: true,
      group_by_file: true,
      max_chunks_per_file: 8,
    })
  })

  it('runSearch defaults (filters {}, topK 10, rerank false)', async () => {
    ai.searchText.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.runSearch({ query: 'q' })
    expect(ai.searchText).toHaveBeenCalledWith({
      query: 'q',
      filters: {},
      top_k: 10,
      rerank: false,
      group_by_file: true,
      max_chunks_per_file: 8,
    })
  })

  it('loadChunkContext defaults window to 2, kind to body', async () => {
    ai.searchChunk.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.loadChunkContext({ fileId: 'f', chunkNo: 3 })
    expect(ai.searchChunk).toHaveBeenCalledWith({ file_id: 'f', kind: 'body', chunk_no: 3, window: 2 })
  })
})

describe('wiki index roots (ported from Vue2 knowledgeStoreRoots.spec.js)', () => {
  it('loadRoots writes the list and clears loading', async () => {
    wiki.getRoots.mockResolvedValue([ROOT])
    const s = useKnowledgeStore()
    await s.loadRoots()
    expect(s.wikiRoots).toEqual([ROOT])
    expect(s.wikiRootsLoading).toBe(false)
  })

  it('loadRoots toasts an error and resets loading on failure', async () => {
    wiki.getRoots.mockRejectedValue(new Error('timeout'))
    const s = useKnowledgeStore()
    await s.loadRoots()
    expect(toastShow).toHaveBeenCalled()
    expect(String(toastShow.mock.calls[0][0])).not.toContain('timeout') // K5: do not echo the raw backend message
    expect(s.wikiRootsLoading).toBe(false)
  })

  // Acceptance feedback fix (2026-08-01): background load failures should not toast.
  it('loadRoots({ silent: true }) does not toast on failure, but loading still resets', async () => {
    wiki.getRoots.mockRejectedValue(new Error('timeout'))
    const s = useKnowledgeStore()
    await s.loadRoots({ silent: true })
    expect(toastShow).not.toHaveBeenCalled()
    expect(s.wikiRootsLoading).toBe(false)
  })

  it('silent only silences failures, the success path still writes the list', async () => {
    wiki.getRoots.mockResolvedValue([ROOT])
    const s = useKnowledgeStore()
    await s.loadRoots({ silent: true })
    expect(s.wikiRoots).toEqual([ROOT])
  })

  // Stale guard: switching pages back and forth can leave multiple loadRoots calls
  // in flight at once. The earlier call lands later (on-device it's the one hitting
  // the 60s timeout) -- it must not overwrite the later call's result, must not
  // reset loading early, and must not toast on the later call's behalf.
  it('stale guard: a late-arriving failure from the earlier call neither toasts nor touches loading', async () => {
    let rejectFirst: (e: Error) => void = () => {}
    wiki.getRoots.mockReturnValueOnce(
      new Promise((_res, rej) => {
        rejectFirst = rej
      }),
    )
    const s = useKnowledgeStore()
    const first = s.loadRoots() // not silent -- if the guard fails, this call would toast
    let resolveSecond: (v: unknown[]) => void = () => {}
    wiki.getRoots.mockReturnValueOnce(
      new Promise((res) => {
        resolveSecond = res as (v: unknown[]) => void
      }),
    )
    const second = s.loadRoots({ silent: true })
    resolveSecond([ROOT])
    await second
    expect(s.wikiRoots).toEqual([ROOT])
    expect(s.wikiRootsLoading).toBe(false)
    rejectFirst(new Error('timeout'))
    await first
    expect(toastShow).not.toHaveBeenCalled()
    expect(s.wikiRoots).toEqual([ROOT]) // not cleared by the stale call
  })

  it('stale guard: a late-arriving success from the earlier call does not overwrite the later result', async () => {
    let resolveFirst: (v: unknown[]) => void = () => {}
    wiki.getRoots.mockReturnValueOnce(
      new Promise((res) => {
        resolveFirst = res as (v: unknown[]) => void
      }),
    )
    const s = useKnowledgeStore()
    const first = s.loadRoots()
    wiki.getRoots.mockResolvedValueOnce([ROOT])
    await s.loadRoots()
    resolveFirst([{ ...ROOT, id: 'stale' }])
    await first
    expect(s.wikiRoots).toEqual([ROOT])
  })

  it('loadCandidates silently clears on failure', async () => {
    wiki.getCandidates.mockRejectedValue(new Error('x'))
    const s = useKnowledgeStore()
    await s.loadCandidates()
    expect(s.wikiCandidates).toEqual([])
  })

  it('setRootEnabled updates optimistically, keeps the change on success', async () => {
    wiki.getRoots.mockResolvedValue([{ ...ROOT }])
    wiki.patchRootEnabled.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.loadRoots()
    await s.setRootEnabled('r1', false)
    expect(s.wikiRoots[0].enabled).toBe(false)
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('r1', false)
  })

  it('setRootEnabled rolls back and rethrows on failure', async () => {
    wiki.getRoots.mockResolvedValue([{ ...ROOT }])
    wiki.patchRootEnabled.mockRejectedValue(new Error('boom'))
    const s = useKnowledgeStore()
    await s.loadRoots()
    await expect(s.setRootEnabled('r1', false)).rejects.toThrow('boom')
    expect(s.wikiRoots[0].enabled).toBe(true)
  })

  it('setRootEnabled returns immediately for an unknown id, does not send a request', async () => {
    const s = useKnowledgeStore()
    await s.setRootEnabled('nope', false)
    expect(wiki.patchRootEnabled).not.toHaveBeenCalled()
  })

  it('createRoot unwraps a single layer: returns the given body as-is and reloads the list', async () => {
    wiki.createRoot.mockResolvedValue({ id: 'r2' }) // <- already unwrapped, not { data: { id } }
    wiki.getRoots.mockResolvedValue([ROOT])
    const s = useKnowledgeStore()
    expect(await s.createRoot({ Path: '/DATA' })).toEqual({ id: 'r2' })
    expect(wiki.getRoots).toHaveBeenCalled()
  })

  it('createRoot rethrows the error as-is (RootsView needs the 409 to drive the mirror retry)', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    wiki.createRoot.mockRejectedValue(err)
    const s = useKnowledgeStore()
    await expect(s.createRoot({ Path: '/ro' })).rejects.toBe(err)
  })

  it('deleteRoot passes purge through and reloads; rescanRoot does not reload', async () => {
    wiki.deleteRoot.mockResolvedValue({})
    wiki.rescanRoot.mockResolvedValue({})
    wiki.getRoots.mockResolvedValue([])
    const s = useKnowledgeStore()
    await s.deleteRoot('r1', true)
    expect(wiki.deleteRoot).toHaveBeenCalledWith('r1', true)
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
    await s.rescanRoot('r1')
    expect(wiki.getRoots).toHaveBeenCalledTimes(1) // <- the blueprint deliberately does not reload
  })
})

describe('wiki navigation (N6: 404 -> null, otherwise rethrow)', () => {
  it('loadWikiNode / loadWikiRaw convert 404 into null', async () => {
    const e404 = Object.assign(new Error('nf'), { response: { status: 404 } })
    wiki.getNode.mockRejectedValue(e404)
    wiki.getRaw.mockRejectedValue(e404)
    const s = useKnowledgeStore()
    expect(await s.loadWikiNode('/x')).toBe(null)
    expect(await s.loadWikiRaw('/x')).toBe(null)
  })

  it('rethrows non-404 errors as-is', async () => {
    const e500 = Object.assign(new Error('boom'), { response: { status: 500 } })
    wiki.getNode.mockRejectedValue(e500)
    wiki.getRaw.mockRejectedValue(e500)
    const s = useKnowledgeStore()
    await expect(s.loadWikiNode('/x')).rejects.toBe(e500)
    await expect(s.loadWikiRaw('/x')).rejects.toBe(e500)
  })

  it('loadWikiTree forwards directly', async () => {
    wiki.getTree.mockResolvedValue([{ path: '/DATA' }])
    const s = useKnowledgeStore()
    expect(await s.loadWikiTree('r1')).toEqual([{ path: '/DATA' }])
    expect(wiki.getTree).toHaveBeenCalledWith('r1')
  })
})
