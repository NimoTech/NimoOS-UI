// 1:1 port from Vue2
// the Vue 2 panel's `src/views/AI/Parser/store/parserStore.js` (main@7a6ee6b7, 65 lines, full port).
//
// Consumers are two Parser pages (`ParserStatus.vue` / `ParserTest.vue`, belong to T6/T7) ——
// **zero imports in full repo when this lands is expected**, not built `.vue` or routed
// to make it into the product.
//
// 【K26 —— Mechanical replacement of Vue2 reactivity API】(equivalent, not behavior change;
// following P1/P2, same pattern as `knowledgeStore.ts`)
//   Vue.observable({ state: {...} })  → set of ref
//   parserStore.state.x = v           → x.value = v
//   parserStore.actions.foo()         → local function in setup store (five actions internal
//                                       `await this.loadAll()` → direct call `loadAll()`)
//   Blueprint `state` layer object entirely disappears (Pinia setup store returns ref directly) ——
//   `store.state.stats` from Vue2 components becomes `store.stats` here.
// 🔴 **`parserStore` has no timer, should not have one**: 5-second polling and `document.hidden`
//   guard are in component (blueprint `ParserStatus.vue:129-135` `this._timer` + `beforeDestroy`),
//   belong to T6. K26's "move `_timer` handle out of state" refers to that location, not this file.
//
// 【K27 —— Five direct calls changed to shared package】Blueprint `api.get('/ai/parser/stats')` /
//   `'/ai/parser/state'` / `'/ai/parser/folders'` / `'/ai/parser/jobs'` and
//   `api.post('/ai/parser/control')` (five actions once each) → `service.ai.parserStats()` /
//   `parserState()` / `parserFolders({limit:20})` / `parserJobs({status:'failed',limit:5})` /
//   `parserControl({...})` (the shared HTTP client's `src/ai.ts:591-620`).
//
// 【K1 —— Single-layer extraction】In Vue2 `api.*()` returns raw axios response, everywhere writes
//   `.data`; six `service.ai.parser*` in shared package all only `return res.data`
//   (`ai.ts:591-620`, zero transformation) → this file **unwraps one fewer layer** than blueprint,
//   4 places:
//     blueprint :31 `stats.data`                        → this file `statsBody`
//     blueprint :32 `control.data`                      → this file `controlBody`
//     blueprint :33 `folders.data`                      → this file `foldersBody`
//     blueprint :34 `(failed.data && failed.data.jobs)` → this file `(failed && failed.jobs)`
//   🔴 **N7: `|| []` fallback preserved unchanged** (missing `jobs` key or `null` both take this path).
//
// 【K33 —— `loadAll()`'s store instance-local epoch stale guard】(coordinator pre-authorized
//   2026-08-03, basis in governance §3 K33; K15 family second hit). Blueprint
//   `parserStore.js:22-46` **has no such guard**. Rationale: `loadAll` has 8 concurrent entry
//   points (blueprint `ParserStatus.vue` `mounted()` · 5-second polling `:129-131` · refresh
//   button `reload()` `:137` · five control actions each `await this.loadAll()`), two in flight
//   ① earlier-arrives-later overwrites with older data;
//   ② more critically `loading = false` in `finally` gets prematurely cleared by whichever
//   completes first, and `loading` directly drives refresh button `:disabled` (`ParserStatus.vue:7`)
//   and all control `:disabled` → **buttons/radios prematurely enabled, user-visible**.
//   Per governance §2 criterion this is "fix a reproducible error behavior". Inline write,
//   **don't extract common guard** (premature abstraction); epoch is local variable in store setup
//   closure (**not module-level**) —— module-level would make two pinia instances judge each
//   other's requests stale. Scope strictly bounded: only add guards, `Promise.all` four requests /
//   catch sets `unreachable` + `error` / success sets `unreachable=false` + `error=null` /
//   `|| []` fallback / five actions "call `parserControl` then `await loadAll()`" all copied unchanged.
//
// 【Relationship with `knowledgeStore`】Both hold `stats` / `controlState`, **this is Vue2
//   reality** (blueprint is also two separate `store/parserStore.js` and `store/knowledgeStore.js`),
//   per governance §5.1 copy both, **no merge**.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// ── Types: return values of `service.ai.parser*` in shared package are all `unknown`,
//    narrowed here per live-tested response bodies (live capture 2026-08-03).
//    Blueprint is JS untyped —— initial values still copied exactly from blueprint :5-19,
//    server-provided fields not in blueprint initial values (`total_vectors_visual` / `models`)
//    marked optional, **not added to initial values**.

export interface ParserQueueDepth {
  pending: number
  running: number
  failed: number
  done: number
}

/** `GET /v1/parser/stats` (fixture `parser-stats.json`). P5a N2: live-test shows no
 * `rate_per_min` / `done_last_10m` / `eta_s`, copy only, don't add. */
export interface ParserStatsBody {
  queue_depth: ParserQueueDepth
  indexed_files: number
  total_vectors_text: number
  last_cursor_ms: number
  /** Server has, blueprint initial values (:6-11) don't → optional, not added to initial. */
  total_vectors_visual?: number
  /** Same; `dim` live-test can be `null` (reranker row). */
  models?: { name: string; version?: string; modality?: string; dim?: number | null }[]
}

/** `GET /v1/parser/state` (fixture `parser-control-state.json`) —— live-test shows exactly 5 fields. */
export interface ParserControlStateBody {
  paused: boolean
  concurrency: number
  device: string
  resolved_device: string
  ocr_enabled: boolean
}

/** Single item from `GET /v1/parser/folders?limit=20` (fixture `parser-folders-pending-20.json`)
 * —— live-test shows exactly 3 fields. */
export interface ParserPendingFolder {
  root_id: string
  folder: string
  count: number
}

export interface ParserFoldersBody {
  folders: ParserPendingFolder[]
  /** Blueprint `ParserStatus.vue:80` reads it; live-test field exists (119 on this machine). */
  total_groups: number
}

/** Single item from `GET /v1/parser/jobs?status=failed&limit=5`. Blueprint template only reads
 * `id` / `path` / `last_error` (`ParserStatus.vue:97-99`); other fields left as-is. */
export interface ParserFailedJob {
  id: string | number
  path: string
  last_error?: string | null
  [k: string]: unknown
}

// Store id is `'ai-parser'` (coordinator adopted T5 concern ② on 2026-08-03): AI section already has
// three stores `'ai-knowledge'` / `'ai-settings'` / `'ai-theme'`, no unprefixed orphans here.
// Export name `useParserStore` unchanged.
export const useParserStore = defineStore('ai-parser', () => {
  // ── state (blueprint :5-18, initial values copied exactly) ──

  /** Blueprint :6-11. */
  const stats = ref<ParserStatsBody>({
    queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
    indexed_files: 0,
    total_vectors_text: 0,
    last_cursor_ms: 0,
  })
  /** Blueprint :12 —— note initial values `paused: false` / `concurrency: 2` / `device: 'auto'` /
   * `resolved_device: 'cpu'` / `ocr_enabled: false`, copied exactly. */
  const controlState = ref<ParserControlStateBody>({
    paused: false,
    concurrency: 2,
    device: 'auto',
    resolved_device: 'cpu',
    ocr_enabled: false,
  })
  /** Blueprint :13 —— outer object + inner array same-named, copy exactly. */
  const folders = ref<ParserFoldersBody>({ folders: [], total_groups: 0 })
  /** Blueprint :14. */
  const failedJobs = ref<ParserFailedJob[]>([])
  /** Blueprint :15-17. */
  const loading = ref(false)
  const error = ref<string | null>(null)
  const unreachable = ref(false)

  /** K33 —— stale-guard counter for `loadAll`. **store instance-local, not module-level**
   * (see file header comment); pattern from K15's `allJobsEpoch` / `indexedFilesEpoch` in
   * `knowledgeStore.ts`.
   * Not data, so not in returned state. */
  let loadAllEpoch = 0

  /**
   * Blueprint :22-43 —— four concurrent requests, any failure lands entire set on `unreachable`,
   * `finally` resets `loading`.
   *
   * 【Divergence, K33, stale guard】Blueprint has no such guard, added are three checks
   * (success branch / catch / finally), stale time **write no state** (including `loading` /
   * `error` / `unreachable`). Rationale and authorization in file header. Rest copied exactly:
   * `loading = true` unconditional at start (latest must disable button) · `Promise.all` four
   * requests **order and parameters** copied · success sets `unreachable = false` + `error = null` ·
   * catch sets `unreachable = true` + `error = e.message || String(e)`.
   */
  async function loadAll(): Promise<void> {
    const epoch = ++loadAllEpoch
    loading.value = true
    try {
      const [statsBody, controlBody, foldersBody, failedBody] = await Promise.all([
        service.ai.parserStats(),
        service.ai.parserState(),
        service.ai.parserFolders({ limit: 20 }),
        service.ai.parserJobs({ status: 'failed', limit: 5 }),
      ])
      if (epoch !== loadAllEpoch) return
      // K1: blueprint :31-33 is `stats.data` / `control.data` / `folders.data`,
      // package already unwraps that layer → data as-is, no extra unwrap.
      stats.value = statsBody as ParserStatsBody
      controlState.value = controlBody as ParserControlStateBody
      folders.value = foldersBody as ParserFoldersBody
      // Blueprint :34 `(failed.data && failed.data.jobs) || []` → one fewer `.data`;
      // N7: `|| []` fallback must not be deleted (missing `jobs` key / `null` both take this).
      const failed = failedBody as { jobs?: ParserFailedJob[] } | null | undefined
      failedJobs.value = (failed && failed.jobs) || []
      unreachable.value = false
      error.value = null
    } catch (e) {
      if (epoch !== loadAllEpoch) return
      unreachable.value = true
      error.value = (e as Error | undefined)?.message || String(e)
    } finally {
      if (epoch === loadAllEpoch) loading.value = false
    }
  }

  // ── Five control actions (blueprint :45-64) —— "call `parserControl` then `await loadAll()`",
  //    body field names copied exactly. `set_concurrency` key is **`n`**, **consistent with**
  //    settings page path (blueprint `SettingsView.vue:292` is also `setControl('set_concurrency', { n })`,
  //    while `knowledgeStore.setControl` is just `{ action, ...extra }` spread-forward, key names
  //    by call site); backend contract same `n` (NimoOS-AI `route/v2/parser_proxy.go:80-85`
  //    `controlReq{ N *int  json:"n,omitempty" }`). **No historical baggage, no need to "unify".**

  /** Blueprint :45-48. */
  async function pause(): Promise<void> {
    await service.ai.parserControl({ action: 'pause' })
    await loadAll()
  }

  /** Blueprint :49-52. */
  async function resume(): Promise<void> {
    await service.ai.parserControl({ action: 'resume' })
    await loadAll()
  }

  /** Blueprint :53-56. */
  async function setConcurrency(n: number): Promise<void> {
    await service.ai.parserControl({ action: 'set_concurrency', n })
    await loadAll()
  }

  /** Blueprint :57-60. */
  async function setDevice(device: string): Promise<void> {
    await service.ai.parserControl({ action: 'set_device', device })
    await loadAll()
  }

  /** Blueprint :61-64. */
  async function setOcr(enabled: boolean): Promise<void> {
    await service.ai.parserControl({ action: 'set_ocr', enabled })
    await loadAll()
  }

  return {
    // state
    stats,
    controlState,
    folders,
    failedJobs,
    loading,
    error,
    unreachable,
    // actions
    loadAll,
    pause,
    resume,
    setConcurrency,
    setDevice,
    setOcr,
  }
})
