// SP8-P5c Task 5 —— unit tests for `parserStore.ts`. Covers: initial values (blueprint :5-18) ·
// `loadAll` four concurrent requests + K1 single-layer extraction + N7 fallback ·
// `unreachable` both directions · five control actions ·
// 🔴 K33 stale guard's **two things** (governance §9.1): ① guard logic (earlier arrival
// doesn't overwrite later) ② guard variable scope (must be store instance local, not module-level).
//
// 🔴 **mock level** (governance §4.1): `service.ai.parser*` six methods in shared package
// only `return res.data` (`NimoOS-Service/src/ai.ts:591-620`, zero transformation) → here
// all mocked as **bare HTTP snake_case**, fixture verbatim, not a byte changed.
//
// 🔴 **fixtures are copies, not runtime reads** (governance §4.4; following P5b/T3
// established practice):
// data copied verbatim into this file's `FIXTURE-COPY-BEGIN/END` blocks with sources, **don't
// use `node:fs` to read `.superpowers/`** —— that directory is gitignored (lost once in SP7),
// this branch will merge to master, tests in `src/` with cross-repo dependency would
// mysteriously fail with "file not found".
// Copy-to-fixture **byte-for-byte equivalence verified by one-shot script** (see T5 report §5),
// not eyeballed.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

const ai = vi.hoisted(() => ({
  parserStats: vi.fn(),
  parserState: vi.fn(),
  parserFolders: vi.fn(),
  parserJobs: vi.fn(),
  parserControl: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

import { useParserStore } from './parserStore'
import type { ParserStatsBody, ParserControlStateBody, ParserFoldersBody, ParserFailedJob } from './parserStore'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-stats.json  (complete, GET /v1/parser/stats)
// from `.superpowers/sdd/p5c-fixtures/parser-stats.json` (2026-08-03 13:22 live capture).
// Copy inserted by script from fixture, zero manual rewriting; equivalence check in report §5.
const STATS_NOW: ParserStatsBody = {
  "queue_depth": {
    "pending": 339,
    "running": 1,
    "failed": 0,
    "done": 9
  },
  "indexed_files": 7,
  "total_vectors_text": 5592,
  "total_vectors_visual": 0,
  "last_cursor_ms": 1784775953391,
  "models": [
    {
      "name": "bge-m3",
      "version": "v1",
      "modality": "text",
      "dim": 1024
    },
    {
      "name": "bge-reranker-v2-m3",
      "version": "v1",
      "modality": "rerank",
      "dim": null
    }
  ]
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5b-fixtures/stats.json  (complete, **earlier capture** of same endpoint)
// from `.superpowers/sdd/p5b-fixtures/stats.json` (P5b era live capture).
// 🔴 Purpose: interleaving tests need two **distinguishable** real response bodies. These are the
// same `GET /v1/parser/stats` at two time points (`pending` 338→339 / `indexed_files` 8→7,
// drift logged in governance §12.1), exactly the real scenario of "two polling requests in flight,
// earlier arrives later" —— not hand-crafted data.
const STATS_EARLIER: ParserStatsBody = {
  "queue_depth": {
    "pending": 338,
    "running": 1,
    "failed": 0,
    "done": 9
  },
  "indexed_files": 8,
  "total_vectors_text": 5592,
  "total_vectors_visual": 0,
  "last_cursor_ms": 1784775953391,
  "models": [
    {
      "name": "bge-m3",
      "version": "v1",
      "modality": "text",
      "dim": 1024
    },
    {
      "name": "bge-reranker-v2-m3",
      "version": "v1",
      "modality": "rerank",
      "dim": null
    }
  ]
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-control-state.json  (complete, GET /v1/parser/state)
// from `.superpowers/sdd/p5c-fixtures/parser-control-state.json` (2026-08-03 13:22).
// 🔴 Live test shows exactly 5 fields; this machine is currently in **paused state** (governance §4.3).
const STATE: ParserControlStateBody = {
  "paused": true,
  "concurrency": 2,
  "device": "auto",
  "ocr_enabled": false,
  "resolved_device": "cpu"
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-folders-pending-20.json  (complete 20 items + total_groups)
// from `.superpowers/sdd/p5c-fixtures/parser-folders-pending-20.json` (2026-08-03 13:22,
// `GET /v1/parser/folders?limit=20`). 🔴 **all 20 items copied**, fields (`root_id`/`folder`/`count`)
// none simplified, order unchanged; relationship between `total_groups: 119` and list length 20 has dedicated test.
const FOLDERS: ParserFoldersBody = {
  "folders": [
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/workflows", "count": 18 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/projects/-home-nimo-NimoTech/9c3e7a5c-f2fc-409c-9ca3-7f46a47e1d81/subagents", "count": 16 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1", "count": 15 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/text_chunks", "count": 12 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/tmp", "count": 11 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude", "count": 11 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/discord", "count": 10 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/imessage", "count": 10 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/fakechat", "count": 8 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/visual_chunks", "count": 8 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-security/agents", "count": 7 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins", "count": 6 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/scripts", "count": 6 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-code-setup/skills/claude-automation-recommender/references", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/text_chunks/0", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/visual_chunks/0", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/.docker/containers/2e55949f61fe879896fedd0334339c31d1cd962691358c56bf3ca0b03781e983", "count": 4 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/greptile", "count": 4 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/.docker/containers/aade3000de2889facb1f7ba7789d6f2c2fe6acdaf1a9adc7433242648d5c47e7", "count": 4 },
  ],
  "total_groups": 119,
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-jobs-failed-5.json  (complete, GET /v1/parser/jobs?status=failed&limit=5)
// from `.superpowers/sdd/p5c-fixtures/parser-jobs-failed-5.json` (2026-08-03 13:22).
// 🔴 This machine's failed bucket **is empty** → can't alone distinguish "actually read `.jobs`" from
// "took `|| []` fallback", so borrow a real row from next block for confirmation.
const FAILED_EMPTY: { jobs: ParserFailedJob[] } = {
  "jobs": []
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5b-fixtures/jobs-pending.json  jobs[0]  (one real row, copied verbatim)
// from `.superpowers/sdd/p5b-fixtures/jobs-pending.json`'s `jobs[0]` (id 348).
// 🔴 Why borrow a pending bucket row: this machine's failed bucket is live-test empty
// (`parser-jobs-failed-5.json` and P5b's `jobs-failed.json` both `{"jobs":[]}`), but
// `/v1/parser/jobs` is one table, one serializer, row shape independent of status → borrow as
// distinguishing real row. **Precedent: `knowledgeStore.staleGuard.test.ts` `POISON_FAILED_ROW`
// same technique** (T3 fix round 1 M-2 approved). No fields changed.
const FAILED_ROW: ParserFailedJob = {
  "id": 348,
  "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0",
  "path": "/DATA/.system_data/tmp/nimoos_panic.log",
  "op": "index",
  "sub_modality": null,
  "priority": 100,
  "attempts": 0,
  "last_error": null,
  "locked_until": null,
  "created_at": 1784776422853,
  "picked_at": null,
  "done_at": null
}
// FIXTURE-COPY-END
// ═══════════════════════════════════════════════════════════════════════════

// Blueprint `parserStore.js:6-11` / `:12` initial values, copied exactly (**these are not
// fixtures, they are blueprint source code**) —— if initial values change, these two tests must fail.
const INITIAL_STATS = {
  queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
  indexed_files: 0,
  total_vectors_text: 0,
  last_cursor_ms: 0,
}
const INITIAL_CONTROL_STATE = {
  paused: false,
  concurrency: 2,
  device: 'auto',
  resolved_device: 'cpu',
  ocr_enabled: false,
}

/** Controllable deferred —— standard tool for interleaving path testing (precedent `knowledgeStore.staleGuard.test.ts:37`). */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** All four requests succeed, all fed fixture verbatim. */
function mockAllOk() {
  ai.parserStats.mockResolvedValue(STATS_NOW)
  ai.parserState.mockResolvedValue(STATE)
  ai.parserFolders.mockResolvedValue(FOLDERS)
  ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
  // `parserControl` response body not consumed by this store (blueprint :46 also just `await`),
  // this batch didn't capture `POST /v1/parser/control` response (governance §8.2 clause 8 same
  // "not dependent" convention) ——
  // shape kept consistent with `knowledgeStore.parser.test.ts:136` (same method two files two shapes = red flag).
  ai.parserControl.mockResolvedValue({})
}

/** Three requests (state/folders/jobs) fixed success, only `parserStats` controlled by caller ——
 * `Promise.all` waits for slowest, so overall arrival order determined by `parserStats`. */
function mockStatsDeferred(...promises: Promise<unknown>[]) {
  ai.parserState.mockResolvedValue(STATE)
  ai.parserFolders.mockResolvedValue(FOLDERS)
  ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
  for (const p of promises) ai.parserStats.mockReturnValueOnce(p)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('Initial values (blueprint parserStore.js:5-18, copied exactly)', () => {
  it('Seven state fields match blueprint (concurrency defaults 2 / device defaults auto)', () => {
    const s = useParserStore()
    expect(s.stats).toEqual(INITIAL_STATS)
    expect(s.controlState).toEqual(INITIAL_CONTROL_STATE)
    expect(s.folders).toEqual({ folders: [], total_groups: 0 })
    expect(s.failedJobs).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.error).toBe(null)
    expect(s.unreachable).toBe(false)
  })
})

describe('loadAll —— four concurrent + K1 single-layer extraction', () => {
  it('Four package methods each called once, parameters match blueprint exactly (folders limit 20 / jobs status=failed limit 5)', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    expect(ai.parserStats).toHaveBeenCalledTimes(1)
    expect(ai.parserStats).toHaveBeenCalledWith()
    expect(ai.parserState).toHaveBeenCalledTimes(1)
    expect(ai.parserState).toHaveBeenCalledWith()
    expect(ai.parserFolders).toHaveBeenCalledWith({ limit: 20 })
    expect(ai.parserJobs).toHaveBeenCalledWith({ status: 'failed', limit: 5 })
  })

  it('🔴 K1: fixture snake_case as-is written to state (no .data layer)', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    // ← mock is bare body: if implementation unwraps extra `.data`, all four fail
    expect(s.stats).toEqual(STATS_NOW)
    expect(s.controlState).toEqual(STATE)
    expect(s.folders).toEqual(FOLDERS)
    expect(s.failedJobs).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.unreachable).toBe(false)
    expect(s.error).toBe(null)
  })

  it('🔴 K1 reverse: mock with extra { data } layer, what gets written is that wrapper (proves zero unwrap)', async () => {
    ai.parserStats.mockResolvedValue({ data: STATS_NOW })
    ai.parserState.mockResolvedValue({ data: STATE })
    ai.parserFolders.mockResolvedValue({ data: FOLDERS })
    ai.parserJobs.mockResolvedValue({ data: FAILED_EMPTY })
    const s = useParserStore()
    await s.loadAll()
    expect(s.stats).toEqual({ data: STATS_NOW })
    expect(s.stats.queue_depth).toBeUndefined()
    expect(s.folders).toEqual({ data: FOLDERS })
    // `jobs` not found in wrapper → N7 fallback to empty array (no throw)
    expect(s.failedJobs).toEqual([])
  })

  it('Live test shape: 20 folder items + total_groups 119 (list length ≠ total groups, title numbers from different sources)', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    expect(s.folders.folders).toHaveLength(20)
    expect(s.folders.total_groups).toBe(119)
    expect(s.folders.folders[0]).toEqual({
      root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
      folder:
        '/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/workflows',
      count: 18,
    })
    // count descending (blueprint barWidth assumes first item as max)
    expect(s.folders.folders.map((f) => f.count)[19]).toBe(4)
  })

  it('failedJobs truly read .jobs (non-empty bucket, borrowed real row from jobs-pending.json)', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue({ jobs: [FAILED_ROW] })
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([FAILED_ROW])
    // Blueprint `ParserStatus.vue:97-99` only reads these three fields
    expect(s.failedJobs[0].id).toBe(348)
    expect(s.failedJobs[0].path).toBe('/DATA/.system_data/tmp/nimoos_panic.log')
    expect(s.failedJobs[0].last_error).toBe(null)
  })

  it('【N7 fallback】failed response missing jobs key → empty array', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue({})
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([])
  })

  it('【N7 fallback】failed response jobs is null (Go nil slice serialized) → empty array', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue({ jobs: null })
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([])
  })

  it('【N7 fallback】failed response entirely null → empty array, no throw (blueprint :34 `failed.data &&` half)', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue(null)
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([])
    expect(s.unreachable).toBe(false)
  })
})

describe('unreachable both directions (blueprint :37-42)', () => {
  it('Any of four reject → unreachable=true + error=e.message, existing values unchanged, loading resets', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    expect(s.stats).toEqual(STATS_NOW)

    ai.parserFolders.mockRejectedValue(new Error('parser down'))
    await s.loadAll()
    expect(s.unreachable).toBe(true)
    expect(s.error).toBe('parser down')
    expect(s.loading).toBe(false)
    expect(s.stats).toEqual(STATS_NOW) // catch branch leaves existing data (blueprint also leaves it)
    expect(s.folders).toEqual(FOLDERS)
  })

  it('After recovery unreachable back false and error cleared null (blueprint :35-36)', async () => {
    ai.parserStats.mockRejectedValue(new Error('boom'))
    ai.parserState.mockResolvedValue(STATE)
    ai.parserFolders.mockResolvedValue(FOLDERS)
    ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
    const s = useParserStore()
    await s.loadAll()
    expect(s.unreachable).toBe(true)
    expect(s.error).toBe('boom')

    mockAllOk()
    await s.loadAll()
    expect(s.unreachable).toBe(false)
    expect(s.error).toBe(null)
    expect(s.stats).toEqual(STATS_NOW)
  })

  it('Non-Error thrown takes String(e) fallback (blueprint :39 `|| String(e)`)', async () => {
    mockAllOk()
    ai.parserState.mockRejectedValue('net down')
    const s = useParserStore()
    await s.loadAll()
    expect(s.unreachable).toBe(true)
    expect(s.error).toBe('net down')
  })
})

describe('Five control actions (blueprint :45-64) —— parserControl first, then await loadAll()', () => {
  it('pause / resume body and reload count', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.pause()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
    expect(ai.parserStats).toHaveBeenCalledTimes(1) // reloaded once after action
    await s.resume()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'resume' })
    expect(ai.parserStats).toHaveBeenCalledTimes(2)
  })

  // Key name `n` **consistent** with settings page path (blueprint `SettingsView.vue:292` also passes `{ n }`),
  // backend `controlReq` is also `N *int json:"n"` —— pinning it here, not registering "two places inconsistent".
  it('🔴 setConcurrency key is `n` (consistent with settings call site, backend controlReq), and reloads', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.setConcurrency(4)
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_concurrency', n: 4 })
    expect(ai.parserStats).toHaveBeenCalledTimes(1)
  })

  it('setDevice / setOcr body copied exactly, each reloads', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.setDevice('cuda')
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_device', device: 'cuda' })
    await s.setOcr(true)
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: true })
    await s.setOcr(false)
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: false })
    expect(ai.parserStats).toHaveBeenCalledTimes(3)
    expect(ai.parserControl).toHaveBeenCalledTimes(3)
  })

  it('Reload in control action also guarded: action-triggered arrives later than polling → it is latest', async () => {
    // Polling request (earlier) in flight when user clicks "resume" → action internal loadAll is later.
    const dPoll = deferred<ParserStatsBody>()
    const dAction = deferred<ParserStatsBody>()
    mockStatsDeferred(dPoll.promise, dAction.promise)
    ai.parserControl.mockResolvedValue({})
    const s = useParserStore()
    const pPoll = s.loadAll()
    const pAction = s.resume()
    await flushPromises()
    dAction.resolve(STATS_NOW) // later (action) returns first
    await flushPromises()
    dPoll.resolve(STATS_EARLIER) // earlier (polling) returns later → must be discarded
    await Promise.all([pPoll, pAction])
    expect(s.stats).toEqual(STATS_NOW)
    expect(s.loading).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K33 —— stale guard. Governance §9.1: **must guard both things**.
// ① guard logic (earlier arrival doesn't overwrite / no premature loading reset / no error state write)
// ② guard **variable scope** (must be store instance local, not module-level)
// Criteria: ① removing guard must fail; ② moving `loadAllEpoch` to module-level must fail.
// ⚠️ Don't extract common guard (premature abstraction, following K15 established).
// ═══════════════════════════════════════════════════════════════════════════

describe('K33 stale guard ① —— guard logic (8 concurrent entry points: mounted / 5s poll / refresh button / five actions)', () => {
  it('Two loadAll interleaved (later returns first, earlier returns later) → state from later call, loading converges false', async () => {
    const d1 = deferred<ParserStatsBody>()
    const d2 = deferred<ParserStatsBody>()
    mockStatsDeferred(d1.promise, d2.promise)
    const s = useParserStore()
    const p1 = s.loadAll() // earlier
    const p2 = s.loadAll() // later
    expect(ai.parserStats).toHaveBeenCalledTimes(2)

    d2.resolve(STATS_NOW) // later returns first
    await flushPromises()
    expect(s.stats).toEqual(STATS_NOW)

    d1.resolve(STATS_EARLIER) // earlier returns later —— without guard would overwrite with older data
    await Promise.all([p1, p2])
    expect(s.stats).toEqual(STATS_NOW)
    expect(s.stats.indexed_files).toBe(7) // STATS_EARLIER is 8, overwrite would fail
    expect(s.loading).toBe(false)
  })

  it('🔴 Stale arrival first, must not write state or prematurely clear loading (refresh button would be enabled early)', async () => {
    const d1 = deferred<ParserStatsBody>()
    const d2 = deferred<ParserStatsBody>()
    mockStatsDeferred(d1.promise, d2.promise)
    const s = useParserStore()
    const p1 = s.loadAll()
    const p2 = s.loadAll()

    d1.resolve(STATS_EARLIER) // stale response first
    await flushPromises()
    // ↓ without finally guard would be false → button/radio enabled before latest arrives
    expect(s.loading).toBe(true)
    expect(s.stats).toEqual(INITIAL_STATS) // also must not write its data

    d2.resolve(STATS_NOW)
    await Promise.all([p1, p2])
    expect(s.loading).toBe(false)
    expect(s.stats).toEqual(STATS_NOW)
  })

  it('🔴 Stale failure, must not write unreachable / error (else page reports "unreachable" with good data)', async () => {
    const d1 = deferred<ParserStatsBody>()
    const d2 = deferred<ParserStatsBody>()
    mockStatsDeferred(d1.promise, d2.promise)
    const s = useParserStore()
    const p1 = s.loadAll()
    const p2 = s.loadAll()

    d2.resolve(STATS_NOW) // latest succeeds
    await flushPromises()
    expect(s.unreachable).toBe(false)

    d1.reject(new Error('stale boom')) // stale then fails
    await Promise.all([p1, p2])
    expect(s.unreachable).toBe(false)
    expect(s.error).toBe(null)
    expect(s.loading).toBe(false)
    expect(s.stats).toEqual(STATS_NOW)
  })
})

describe('K33 stale guard ② —— guard variable must be store instance local, not module-level', () => {
  // 🔴 Governance §9.1 (T3 review M-1 found gap): previous production code correct, but "guard
  // variable must be instance local" invariant **has zero tests** —— moving `seq` to true
  // module-level, three single-instance interleaving tests still pass. Module-level epoch's real
  // consequence: two simultaneously alive store instances judge each other's requests stale
  // (data never writes, `loading` never resets). This test guards only that.
  // Only one criterion: moving `let loadAllEpoch = 0` in `parserStore.ts` to module-level → must fail.
  it('Two pinia instances each loadAll interleaved in flight → each gets own result, no overwrite, both loading converges', async () => {
    const dA = deferred<ParserStatsBody>()
    const dB = deferred<ParserStatsBody>()
    mockStatsDeferred(dA.promise, dB.promise)

    const piniaA = createPinia()
    const piniaB = createPinia()
    setActivePinia(piniaA)
    const sA = useParserStore()
    setActivePinia(piniaB)
    const sB = useParserStore()
    expect(sA).not.toBe(sB)

    const pA = sA.loadAll() // instance A in flight
    const pB = sB.loadAll() // instance B in flight
    expect(ai.parserStats).toHaveBeenCalledTimes(2)

    // Interleave: B later but returns first, then A —— both instances must not affect each other
    dB.resolve(STATS_NOW)
    await flushPromises()
    dA.resolve(STATS_EARLIER)
    await Promise.all([pA, pB])

    // ↓ with module-level epoch, A's epoch(1) !== loadAllEpoch(2) → entire response discarded, stats stuck at initial
    expect(sA.stats).toEqual(STATS_EARLIER)
    expect(sA.stats.indexed_files).toBe(8)
    expect(sB.stats).toEqual(STATS_NOW)
    expect(sB.stats.indexed_files).toBe(7)
    // ↓ with module-level epoch, A's finally check fails → loading never resets
    expect(sA.loading).toBe(false)
    expect(sB.loading).toBe(false)
  })
})
