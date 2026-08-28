// SP8-P5a Task 6 — unit tests taken from the task brief a captured device response
// Step 2 skeleton (used verbatim, including the discriminating intent noted in its comments).
// Covers knowledgeStore's Parser group: loadOverview / Jobs' five actions / Allowlist's four /
// setControl / IndexedFiles' five actions (including polling) / toast (P4 deviation) / fmtAgo.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

const ai = vi.hoisted(() => ({
  parserStats: vi.fn(), parserState: vi.fn(), parserJobs: vi.fn(),
  parserRetryJobs: vi.fn(), parserDeleteJob: vi.fn(), parserClearFailedJobs: vi.fn(),
  parserAllowlistExtensions: vi.fn(), parserAllowlistFolders: vi.fn(),
  patchParserAllowlistExtensions: vi.fn(), addParserAllowlistFolder: vi.fn(),
  deleteParserAllowlistFolder: vi.fn(), parserControl: vi.fn(),
  parserFiles: vi.fn(), parserReindexFiles: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('../../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))

import { useKnowledgeStore, fmtAgo, DISTILL_JOBS_LIMIT } from './knowledgeStore'

// Backend shape verified on the real device (design §6.1) — **a bare body, no { data: … } envelope**
const STATS = { queue_depth: { pending: 338, running: 1, failed: 0, done: 9 },
  indexed_files: 8, total_vectors_text: 5592, total_vectors_visual: 0,
  last_cursor_ms: 1784775953391 }
const STATE = { paused: true, concurrency: 2, device: 'auto', ocr_enabled: false, resolved_device: 'cpu' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('loadOverview', () => {
  it('a single fetch writes stats/controlState, and computes lastSyncFmt and backlogPeak', async () => {
    ai.parserStats.mockResolvedValue(STATS); ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    await s.loadOverview()
    expect(s.stats).toEqual(STATS)              // ← the mock is a bare body: if the implementation strips an extra .data layer this must go red
    expect(s.controlState).toEqual(STATE)
    expect(s.unreachable).toBe(false)
    expect(s.overviewLoaded).toBe(true)
    expect(s.backlogPeak).toBe(339)             // 338 + 1
  })

  it('backlogPeak is a rolling maximum, it never drops back down', async () => {
    ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    ai.parserStats.mockResolvedValue({ ...STATS, queue_depth: { pending: 100, running: 0, failed: 0, done: 0 } })
    await s.loadOverview()
    expect(s.backlogPeak).toBe(100)
    ai.parserStats.mockResolvedValue({ ...STATS, queue_depth: { pending: 10, running: 0, failed: 0, done: 0 } })
    await s.loadOverview()
    expect(s.backlogPeak).toBe(100)
  })

  it('either request failing → unreachable=true, and does not touch the existing stats', async () => {
    ai.parserStats.mockResolvedValue(STATS); ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    await s.loadOverview()
    ai.parserStats.mockRejectedValue(new Error('boom'))
    await s.loadOverview()
    expect(s.unreachable).toBe(true)
    expect(s.stats).toEqual(STATS)          // keeps the previous value
    expect(s.overviewLoaded).toBe(true)     // doesn't revert once already loaded
  })
})

describe('Jobs group', () => {
  it('loadAllJobs sends one request per bucket for all three buckets, and sorts them by status', async () => {
    ai.parserJobs.mockImplementation(async (p: { status: string }) => ({ jobs: [{ id: 1, path: '/' + p.status }] }))
    const s = useKnowledgeStore()
    await s.loadAllJobs()
    expect(ai.parserJobs.mock.calls.map((c) => c[0])).toEqual([
      { status: 'pending', limit: 200 }, { status: 'running', limit: 200 }, { status: 'failed', limit: 200 }])
    expect(s.jobs.pending[0].path).toBe('/pending')
    expect(s.jobs.failed[0].path).toBe('/failed')
  })

  it('loadJobs falls back to an empty array for a response missing the jobs key (N7)', async () => {
    ai.parserJobs.mockResolvedValue({})
    const s = useKnowledgeStore()
    expect(await s.loadJobs('pending')).toEqual([])
  })

  it('retryFailed / cancelJob / clearFailed all reload the three buckets after their action', async () => {
    ai.parserJobs.mockResolvedValue({ jobs: [] })
    // 🔴 P5c handoff item #2 (outside P5b's mandate, assigned by P5c governance §8.2 item 2):
    // `parserDeleteJob`'s mock changes from `{}` to `''` — `DELETE /v1/parser/jobs/{id}` is
    // **HTTP 204 with an empty body** (`NimoOS-Parser/parser/routes/jobs.py:42-50`'s
    // `status_code=204` + `return None`); the package does `return res.data` (`ai.ts:637-640`),
    // and **axios 1.18.1's `res.data` for an empty body is `''`** (empty string) (the guard
    // `if (data && utils.isString(data) && …)` in `axios.cjs:2118` — an empty string is falsy →
    // skips JSON parsing and returns it as-is). `{}`/`{ok:true}`/`undefined` would all be
    // encoding a hallucination into the assertion. `cancelJob` doesn't consume the return value
    // (`knowledgeStore.ts:370-373`) → **zero behavioral difference**.
    // ⚠️ `parserRetryJobs`'s `{}` is left alone: it's real JSON like `{"retried":0}`, not covered
    // by this authorization.
    ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue('')
    ai.parserClearFailedJobs.mockResolvedValue({ cleared: 3 })
    const s = useKnowledgeStore()
    await s.retryFailed(['f1'])
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: ['f1'] })
    await s.retryFailed()
    expect(ai.parserRetryJobs).toHaveBeenLastCalledWith({ file_ids: null })   // reference defaults to null
    await s.cancelJob(7)
    expect(ai.parserDeleteJob).toHaveBeenCalledWith(7)
    expect(await s.clearFailed()).toEqual({ cleared: 3 })
    expect(ai.parserJobs).toHaveBeenCalledTimes(12)   // 4 actions × 3 buckets
  })
})

describe('Allowlist group', () => {
  it("N1: enabled's 0/1 is normalized to a boolean", async () => {
    ai.parserAllowlistExtensions.mockResolvedValue({ extensions: [
      { ext: '.md', enabled: 1, source: 'default' }, { ext: '.png', enabled: 0, source: 'default' }] })
    ai.parserAllowlistFolders.mockResolvedValue({ rules: [{ id: 1, path_glob: '/a/*' }] })
    const s = useKnowledgeStore()
    await s.loadAllowlist()
    expect(s.extensions).toEqual([
      { ext: '.md', enabled: true, source: 'default' }, { ext: '.png', enabled: false, source: 'default' }])
    expect(s.folderRules).toHaveLength(1)
  })

  it('missing-key response falls back to an empty array', async () => {
    ai.parserAllowlistExtensions.mockResolvedValue({}); ai.parserAllowlistFolders.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.loadAllowlist()
    expect(s.extensions).toEqual([]); expect(s.folderRules).toEqual([])
  })

  it('toggle / add / delete all reload the allowlist after their action', async () => {
    ai.parserAllowlistExtensions.mockResolvedValue({ extensions: [] })
    ai.parserAllowlistFolders.mockResolvedValue({ rules: [] })
    ai.patchParserAllowlistExtensions.mockResolvedValue({})
    ai.addParserAllowlistFolder.mockResolvedValue({ id: 9 })
    ai.deleteParserAllowlistFolder.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.toggleExtension('.md', false)
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.md', enabled: false })
    expect(await s.addFolderRule({ root_id: 'r', path_glob: '/a/*', action: 'deny' })).toEqual({ id: 9 })
    await s.deleteFolderRule(9)
    expect(ai.deleteParserAllowlistFolder).toHaveBeenCalledWith(9)
    expect(ai.parserAllowlistExtensions).toHaveBeenCalledTimes(3)
  })
})

describe('setControl', () => {
  it('merges action and extra fields into the body, and reloads overview', async () => {
    ai.parserControl.mockResolvedValue({}); ai.parserStats.mockResolvedValue(STATS)
    ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    await s.setControl('pause')
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
    // 🔴 P5c third round (outside P5b's mandate, the coordinator expanded scope for these two
    // lines this round; same family as handoff item #2 = "encoding a shape the backend doesn't
    // recognize into the assertion"). The original payload was `{ concurrency: 4 }` — **the
    // backend never reads that key at all**: `NimoOS-AI route/v2/parser_proxy.go:80-85`'s
    // `controlReq` only has `N *int json:"n,omitempty"`, and `:103-105`'s `set_concurrency`
    // branch returns a flat 400 `"n required"` when `req.N == nil`. The real call site also
    // passes `n` (reference `SettingsView.vue:292` = `setControl('set_concurrency', { n })`).
    // The assertion's meaning is unchanged (still "`extra` is spread as-is into the body"),
    // just with the payload swapped for the real contract key.
    await s.setControl('set_concurrency', { n: 4 })
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_concurrency', n: 4 })
    expect(ai.parserStats).toHaveBeenCalledTimes(2)
  })
})

describe('IndexedFiles group', () => {
  it('loadIndexedFiles goes through buildListParams, writes files/total, and finishes with loading=false', async () => {
    ai.parserFiles.mockResolvedValue({ total: 8, files: [{ file_id: 'a', status: 'ok' }] })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    expect(s.indexedFiles.files).toHaveLength(1)
    expect(s.indexedFiles.total).toBe(8)
    expect(s.indexedFiles.loading).toBe(false)
    expect(s.indexedFiles.error).toBe(null)
  })

  it('on failure, writes error and resets loading', async () => {
    ai.parserFiles.mockRejectedValue(new Error('nope'))
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    expect(s.indexedFiles.error).toBe('nope')
    expect(s.indexedFiles.loading).toBe(false)
  })

  it('startIndexedPolling: does not start a timer when there are no indexing rows; when there are, reloads after 30s and stops itself once done', async () => {
    vi.useFakeTimers()
    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'ok' }] })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    s.startIndexedPolling()
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)      // never started

    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'indexing' }] })
    await s.loadIndexedFiles()
    s.startIndexedPolling()
    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'ok' }] })
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(3)      // polling fetched once
    vi.advanceTimersByTime(60000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(3)      // stops itself once done
    vi.useRealTimers()
  })

  it('startIndexedPolling repeated calls do not stack timers', async () => {
    vi.useFakeTimers()
    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'indexing' }] })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    s.startIndexedPolling(); s.startIndexedPolling(); s.startIndexedPolling()
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(2)      // only one extra call
    s.stopIndexedPolling()
    vi.useRealTimers()
  })
})

describe('toast (deviates from P4)', () => {
  it('forwards to the global useToast().show, duration follows the reference at 2400ms', () => {
    const s = useKnowledgeStore()
    s.toast('已刷新')
    expect(toastShow).toHaveBeenCalledWith('已刷新', 2400)
  })
})

describe('fmtAgo', () => {
  it('minute/hour/day tiers + zero value', () => {
    const now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtAgo(0)).toBe('—')
    expect(fmtAgo(now - 30_000)).toBe('刚刚')
    expect(fmtAgo(now - 5 * 60_000)).toBe('5 分钟前')
    expect(fmtAgo(now - 3 * 3_600_000)).toBe('3 小时前')
    expect(fmtAgo(now - 50 * 3_600_000)).toBe('2 天前')
    vi.restoreAllMocks()
  })
})

// Review R2 (Important) — the test case above only samples one point from the "middle" of
// each tier, so getting the threshold itself wrong (`m<1`/`m<60`/`h<24`, knowledgeStore.ts:184-188)
// still wouldn't go red (verified with a probe: changing `h<24` to `h<48` still left the
// original case 16/16 green). Governance doc §9 "either side of an A/B branch both need a
// control case" — the following pins down both sides of each of the three transition points:
// "just now/minute", "minute/hour", "hour/day".
describe('fmtAgo boundaries (review R2 — one case per side of each transition point)', () => {
  const now = 1_800_000_000_000

  it('"just now"/minute boundary: 59_999ms (m=0) → just now; 60_000ms (m=1) → 1 minute ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtAgo(now - 59_999)).toBe('刚刚')
    expect(fmtAgo(now - 60_000)).toBe('1 分钟前')
    vi.restoreAllMocks()
  })

  it('minute/hour boundary: 59 minutes (m=59) → 59 minutes ago; 60 minutes (m=60, =1 hour) → 1 hour ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtAgo(now - 59 * 60_000)).toBe('59 分钟前')
    expect(fmtAgo(now - 60 * 60_000)).toBe('1 小时前')
    vi.restoreAllMocks()
  })

  it('hour/day boundary: 23 hours (h=23) → 23 hours ago; 24 hours (h=24, =1 day) → 1 day ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtAgo(now - 23 * 3_600_000)).toBe('23 小时前')
    expect(fmtAgo(now - 24 * 3_600_000)).toBe('1 天前')
    vi.restoreAllMocks()
  })
})

describe('DISTILL_JOBS_LIMIT (review R1)', () => {
  it('matches the reference knowledgeStore.js:11, value is 500', () => {
    expect(DISTILL_JOBS_LIMIT).toBe(500)
  })
})
