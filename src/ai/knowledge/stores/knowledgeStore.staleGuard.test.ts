// SP8-P5b Task 3 —— K15: `loadAllJobs` / `loadIndexedFiles` / `loadDistillJobs`
// three actions each with store instance-local epoch stale guard (async stale guard
// discipline sixth hit).
//
// This file only tests "interleaving paths" themselves: whether guard correctly works
// under both arrival orders (earlier-arrives-later / earlier-arrives-first). Each
// action's normal behavior (single bucket reset, N4 refresh only corresponding bucket
// per filter, etc.) already covered in `knowledgeStore.parser.test.ts` /
// `knowledgeStore.notesWiki.test.ts`, no repeat here.
//
// Mock shapes sourced (all from `.superpowers/sdd/p5b-fixtures/`, no hand-editing, see
// governance §4):
//   - `ai.parserJobs` → `jobs-pending.json` / `jobs-running.json` / `jobs-failed.json`
//     verbatim snake_case (`service.ai.parser*` zero transformation, §4.1).
//   - `ai.parserFiles` → `files-default.json` / `files-mime-prefix-legacy.json` /
//     `files-sort-size-asc.json` verbatim snake_case.
//   - `notes.listDistillJobs` / `notes.getDistillStatus` → queue empty on this machine
//     (`distill-jobs.json`/`distill-status.json` live-test both empty), row shape per
//     governance §4.2 table right column (package-normalized camelCase: `filePath`/`lastError`/…)
//     same pattern as `JOBS()` in `knowledgeStore.notesWiki.test.ts` (shape in README
//     "untested·source inferred" table, not hand-edited).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const ai = vi.hoisted(() => ({
  parserJobs: vi.fn(),
  parserFiles: vi.fn(),
}))
const notes = vi.hoisted(() => ({
  listDistillJobs: vi.fn(),
  getDistillStatus: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai, notes } }))
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('../../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))

import { useKnowledgeStore } from './knowledgeStore'

/** Controllable deferred promise —— standard tool for interleaving path tests (governance §9 "async assertions"). */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

// ══════════════════════════════════════════════════════════════════════
// loadAllJobs —— race evidence: QueueView 10-second polling + `setScope('index')`
// manual trigger, two paths coexist. Row content from `jobs-pending.json` (rows 0/1
// from same real response body, used as pending bucket for "fresh"/"stale" two calls,
// fields unchanged exactly) and `jobs-running.json` (single row, shared by both calls
// no impact on discrimination, all discrimination rests on pending bucket). Failed
// bucket empty on this machine (`jobs-failed.json`), POISON_FAILED_ROW borrows row
// `jobs[2]` (id 346) from `jobs-pending.json` copied entirely as stale marker (see
// constant comment below, fix round 1 M-2).
// ══════════════════════════════════════════════════════════════════════
describe('loadAllJobs stale guard (K15)', () => {
  // jobs-pending.json jobs[0] (id 348) and jobs[1] (id 347), copied field-for-field.
  const FRESH_PENDING_ROW = {
    id: 348,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log',
    op: 'index',
    sub_modality: null,
    priority: 100,
    attempts: 0,
    last_error: null,
    locked_until: null,
    created_at: 1784776422853,
    picked_at: null,
    done_at: null,
  }
  const STALE_PENDING_ROW = {
    id: 347,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log',
    op: 'index',
    sub_modality: null,
    priority: 100,
    attempts: 0,
    last_error: null,
    locked_until: null,
    created_at: 1784776420537,
    picked_at: null,
    done_at: null,
  }
  // jobs-running.json single row.
  const RUNNING_ROW = {
    id: 10,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log',
    op: 'index',
    sub_modality: null,
    priority: 100,
    attempts: 5,
    last_error: null,
    locked_until: 1785414048100,
    created_at: 1784424392938,
    picked_at: 1784438018718,
    done_at: null,
  }
  const EMPTY = { jobs: [] } // jobs-failed.json verbatim
  // 【Fix round 1, M-2】This machine's failed bucket live-test empty (`jobs-failed.json` =
  // `{"jobs":[]}`), can't get real failed row; use row `jobs[2]` (id 346, `op:"delete"`)
  // from same `jobs-pending.json` copied entirely as stale marker for failed bucket ——
  // field shape still live-tested, not hand-edited incomplete object (original `{ id: 999 }` removed).
  const POISON_FAILED_ROW = {
    id: 346,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/opt/qdrant/storage/collections/agent_memory/0/wal/.atomicwritewmbpAO',
    op: 'delete',
    sub_modality: null,
    priority: 100,
    attempts: 0,
    last_error: null,
    locked_until: null,
    created_at: 1784776420537,
    picked_at: null,
    done_at: null,
  }

  it('Interleaved: earlier (polling) arrives later, does not overwrite later (manual setScope) already written buckets', async () => {
    const d1p = deferred<{ jobs: unknown[] }>()
    const d1r = deferred<{ jobs: unknown[] }>()
    const d1f = deferred<{ jobs: unknown[] }>()
    const d2p = deferred<{ jobs: unknown[] }>()
    const d2r = deferred<{ jobs: unknown[] }>()
    const d2f = deferred<{ jobs: unknown[] }>()
    // Promise.all([loadJobs('pending'), loadJobs('running'), loadJobs('failed')])
    // three sub-calls issued synchronously in array literal order —— each loadAllJobs()
    // call corresponds to three consecutive mockImplementationOnce.
    ai.parserJobs
      .mockImplementationOnce(() => d1p.promise) // first (polling) pending
      .mockImplementationOnce(() => d1r.promise) // first running
      .mockImplementationOnce(() => d1f.promise) // first failed
      .mockImplementationOnce(() => d2p.promise) // second (manual) pending
      .mockImplementationOnce(() => d2r.promise) // second running
      .mockImplementationOnce(() => d2f.promise) // second failed

    const s = useKnowledgeStore()
    const first = s.loadAllJobs() // polling path, sent first
    const second = s.loadAllJobs() // manual setScope('index') trigger, sent later, should win

    // Later arrives first: manual trigger path lands first.
    d2p.resolve({ jobs: [FRESH_PENDING_ROW] })
    d2r.resolve({ jobs: [RUNNING_ROW] })
    d2f.resolve(EMPTY)
    await second
    expect(s.jobs.pending.map((j) => j.id)).toEqual([348])
    expect(s.jobs.running.map((j) => j.id)).toEqual([10])
    expect(s.jobs.failed).toEqual([])

    // Earlier arrives later: polling path lands finally, must be entirely discarded, cannot overwrite results already in effect.
    d1p.resolve({ jobs: [STALE_PENDING_ROW] })
    d1r.resolve({ jobs: [] })
    d1f.resolve({ jobs: [POISON_FAILED_ROW] })
    await first
    expect(s.jobs.pending.map((j) => j.id)).toEqual([348]) // not overwritten by 347
    expect(s.jobs.running.map((j) => j.id)).toEqual([10]) // not cleared
    expect(s.jobs.failed).toEqual([]) // not polluted by stale row 346
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('Reverse test: non-overlapping calls (earlier lands first then next), both truly take effect', async () => {
    ai.parserJobs.mockImplementation(async (p: { status: string }) => {
      if (p.status === 'pending') return { jobs: [FRESH_PENDING_ROW] }
      if (p.status === 'running') return { jobs: [RUNNING_ROW] }
      return EMPTY
    })
    const s = useKnowledgeStore()
    await s.loadAllJobs() // first call, fully landed
    expect(s.jobs.pending.map((j) => j.id)).toEqual([348])

    ai.parserJobs.mockImplementation(async (p: { status: string }) => {
      if (p.status === 'pending') return { jobs: [STALE_PENDING_ROW] }
      if (p.status === 'running') return EMPTY
      return { jobs: [POISON_FAILED_ROW] }
    })
    await s.loadAllJobs() // second call, non-overlapping with first, should take effect normally
    expect(s.jobs.pending.map((j) => j.id)).toEqual([347])
    expect(s.jobs.running).toEqual([])
    expect(s.jobs.failed.map((j) => j.id)).toEqual([346])
  })
})

// ══════════════════════════════════════════════════════════════════════
// loadIndexedFiles —— race evidence: `onPathPrefixInput`/`onMimePrefixInput` each
// keystroke reloads entire request, no debounce (N9, copy exactly, only fix earlier-later
// overwrite correctness).
// Use `files-default.json` (result of typing "/DATA/tmp", 8 files) simulate earlier
// (stale), `files-mime-prefix-legacy.json` (typing one more character narrows to legacy
// office MIME prefix, hits 0 files) simulate later (fresh) —— consistent with blueprint
// narrative: more characters typed, narrower range.
// ══════════════════════════════════════════════════════════════════════
describe('loadIndexedFiles stale guard (K15)', () => {
  // files-default.json verbatim (excerpt needed fields, copied field-for-field).
  const STALE_FILES = [
    { file_id: '2685dfba774c87b77b9ca4af44e691f6', status: 'indexing' },
    { file_id: '05d732586959ea3f480b5feb4b0d17c8', status: 'ok' },
    { file_id: '4018267c2ec373cddb244ac220a06cc2', status: 'ok' },
  ]
  const STALE_TOTAL = 8
  // files-mime-prefix-legacy.json verbatim: {"total":0,...,"files":[]}
  const FRESH_FILES: unknown[] = []
  const FRESH_TOTAL = 0

  it('Interleaved: earlier (shorter prefix) arrives later, does not overwrite later (longer prefix) result, loading not early reset', async () => {
    const d1 = deferred<{ files: unknown[]; total: number }>()
    const d2 = deferred<{ files: unknown[]; total: number }>()
    ai.parserFiles.mockImplementationOnce(() => d1.promise).mockImplementationOnce(() => d2.promise)

    const s = useKnowledgeStore()
    const first = s.loadIndexedFiles() // trigger from typing "/DATA"
    const second = s.loadIndexedFiles() // immediately typing longer prefix, later trigger
    expect(s.indexedFiles.loading).toBe(true)

    // Earlier (stale) lands first: should not prematurely clear loading, should not write
    // files as its result, else user sees "complete" frame with old data while filter
    // already shows longer prefix.
    d1.resolve({ files: STALE_FILES, total: STALE_TOTAL })
    await first
    expect(s.indexedFiles.loading).toBe(true) // not prematurely reset
    expect(s.indexedFiles.files).toEqual([]) // not written to stale data (still initial)
    expect(s.indexedFiles.total).toBe(0)
    expect(toastShow).not.toHaveBeenCalled()

    // Later (fresh) lands: only now truly reset + write data.
    d2.resolve({ files: FRESH_FILES, total: FRESH_TOTAL })
    await second
    expect(s.indexedFiles.loading).toBe(false)
    expect(s.indexedFiles.files).toEqual(FRESH_FILES)
    expect(s.indexedFiles.total).toBe(FRESH_TOTAL)
  })

  // 【Fix round 1, I-1 supplement】Review mutation M8: only delete `if (epoch !== indexedFilesEpoch) return`
  // in catch branch, 52 tests in `src/ai/knowledge/stores/` still green —— because original
  // three interleaving test groups all take success path, catch branch guard has no test proof.
  // Real consequence: stale request fails (aborted / backend momentary 500), while latest
  // already succeeded and written data, without this guard would additionally write `s.error` ——
  // error banner stacked on top of correct data. This test specifically covers that path.
  it('Interleaved: stale failure, latest success → error not polluted, loading reset to success value', async () => {
    const d1 = deferred<{ files: unknown[]; total: number }>()
    const d2 = deferred<{ files: unknown[]; total: number }>()
    ai.parserFiles.mockImplementationOnce(() => d1.promise).mockImplementationOnce(() => d2.promise)

    const s = useKnowledgeStore()
    const first = s.loadIndexedFiles() // stale request, will eventually fail
    const second = s.loadIndexedFiles() // latest request, will succeed

    // Latest succeeds first.
    d2.resolve({ files: FRESH_FILES, total: FRESH_TOTAL })
    await second
    expect(s.indexedFiles.error).toBe(null)
    expect(s.indexedFiles.files).toEqual(FRESH_FILES)
    expect(s.indexedFiles.loading).toBe(false)

    // Stale then fails: must not write error, must not touch loading again.
    d1.reject(new Error('boom'))
    await first
    expect(s.indexedFiles.error).toBe(null) // not polluted by stale failure
    expect(s.indexedFiles.files).toEqual(FRESH_FILES) // still latest request data
    expect(s.indexedFiles.loading).toBe(false) // not touched by stale branch again
  })

  it('Reverse test: non-overlapping calls (earlier lands first then next), both truly take effect and each resets loading', async () => {
    ai.parserFiles.mockResolvedValueOnce({ files: STALE_FILES, total: STALE_TOTAL })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    expect(s.indexedFiles.files).toEqual(STALE_FILES)
    expect(s.indexedFiles.total).toBe(STALE_TOTAL)
    expect(s.indexedFiles.loading).toBe(false)

    // files-sort-size-asc.json verbatim (sort=size&order=asc, another 3-row slice from
    // same 8 files, different from above group, to prove second call truly takes effect).
    const SECOND_FILES = [
      { file_id: '6e1be7c24c4cdb09e1bf1a8318e8ca27', status: 'indexing' },
      { file_id: 'ae3894193e56d181e90b23712f1e3081', status: 'indexing' },
      { file_id: '721c340b1dc3b982cdb4ea6c9783103e', status: 'indexing' },
    ]
    ai.parserFiles.mockResolvedValueOnce({ files: SECOND_FILES, total: 8 })
    await s.loadIndexedFiles()
    expect(s.indexedFiles.files).toEqual(SECOND_FILES)
    expect(s.indexedFiles.total).toBe(8)
    expect(s.indexedFiles.loading).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
// loadDistillJobs —— race evidence: 10-second polling + `setFilter(f)` + `setScope('distill')`
// + internal reload in `retryDistill`/`cancelDistill`, four paths coexist; and per filter
// only refresh corresponding bucket (N4), stale responses let pending results land in
// failed bucket (or inverse: latest refresh results in failed bucket overwritten by full
// counts/done/total from stale pending request).
// Distill queue empty on this machine (`distill-jobs.json`/`distill-status.json` live-test
// both empty), row content per governance §4.2 table right column (package-normalized camelCase)
// same pattern as `JOBS()` in existing `knowledgeStore.notesWiki.test.ts` (README
// "untested·source inferred" shape).
// ══════════════════════════════════════════════════════════════════════
describe('loadDistillJobs stale guard (K15)', () => {
  it('Interleaved: earlier (pending pill) arrives later, does not overwrite later (failed pill) written bucket and full counts', async () => {
    const d1jobs = deferred<{ jobs: unknown[]; counts: Record<string, number> }>()
    const d1status = deferred<{ distilled: number }>()
    const d2jobs = deferred<{ jobs: unknown[]; counts: Record<string, number> }>()
    const d2status = deferred<{ distilled: number }>()
    notes.listDistillJobs
      .mockImplementationOnce(() => d1jobs.promise) // first: user clicked pending pill
      .mockImplementationOnce(() => d2jobs.promise) // second: immediately clicked failed pill
    notes.getDistillStatus
      .mockImplementationOnce(() => d1status.promise)
      .mockImplementationOnce(() => d2status.promise)

    const s = useKnowledgeStore()
    const first = s.loadDistillJobs('pending')
    const second = s.loadDistillJobs('failed')

    // Later (failed pill) lands first.
    d2jobs.resolve({
      jobs: [{ filePath: '/f2', status: 'failed' }],
      counts: { pending: 9, running: 9, failed: 2 },
    })
    d2status.resolve({ distilled: 20 })
    await second
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f2'])
    expect(s.distillJobs.counts).toEqual({ pending: 9, running: 9, failed: 2 })
    expect(s.distillJobs.done).toBe(20)
    expect(s.distillJobs.total).toBe(1)

    // Earlier (pending pill) lands later: must entirely discard —— cannot write stale
    // data to pending bucket, cannot overwrite latest values just written with its full counts/done/total.
    d1jobs.resolve({
      jobs: [{ filePath: '/p1', status: 'pending' }],
      counts: { pending: 1, running: 0, failed: 0 },
    })
    d1status.resolve({ distilled: 1 })
    await first
    expect(s.distillJobs.pending).toEqual([]) // stale pending bucket not written
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f2']) // failed bucket not overwritten
    expect(s.distillJobs.counts).toEqual({ pending: 9, running: 9, failed: 2 }) // full count not overwritten by stale
    expect(s.distillJobs.done).toBe(20)
    expect(s.distillJobs.total).toBe(1)
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('Reverse test: non-overlapping calls (pill clicked twice), both truly take effect', async () => {
    notes.listDistillJobs.mockResolvedValueOnce({
      jobs: [{ filePath: '/p1', status: 'pending' }],
      counts: { pending: 1, running: 0, failed: 0 },
    })
    notes.getDistillStatus.mockResolvedValueOnce({ distilled: 3 })
    const s = useKnowledgeStore()
    await s.loadDistillJobs('pending')
    expect(s.distillJobs.pending.map((j) => j.filePath)).toEqual(['/p1'])
    expect(s.distillJobs.done).toBe(3)

    notes.listDistillJobs.mockResolvedValueOnce({
      jobs: [{ filePath: '/f1', status: 'failed' }],
      counts: { pending: 0, running: 0, failed: 1 },
    })
    notes.getDistillStatus.mockResolvedValueOnce({ distilled: 4 })
    await s.loadDistillJobs('failed')
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f1'])
    expect(s.distillJobs.pending.map((j) => j.filePath)).toEqual(['/p1']) // N4: other bucket keeps last result
    expect(s.distillJobs.done).toBe(4)
  })
})
