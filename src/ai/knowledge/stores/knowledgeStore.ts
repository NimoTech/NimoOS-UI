// 1:1 port from Vue2
// the Vue 2 panel (main@7a6ee6b7) `src/views/AI/Knowledge/store/knowledgeStore.js` (363 lines).
// This file carries only the **Parser group** (Dashboard/topbar, Jobs queue, Allowlist,
// Control, Indexed Files five state blocks + corresponding actions + `toast`/`fmtAgo`).
// The three groups notes/wiki/distill (state: distillJobs/wikiRoots/wikiCandidates/
// wikiRootsLoading/notesDraftCount/notesSummary + corresponding actions) are left for a later task
// to continue in this file ——
// see task brief: "This task only does: state Dashboard/topbar/Allowlist/Queue(parser
// half)/indexedFiles five blocks + toast + loadOverview + Jobs five actions + Allowlist
// four + setControl + IndexedFiles five. notes/wiki/distill left for later".
// 【Review R1 correction, 2026-08-01】`export const DISTILL_JOBS_LIMIT = 500` was
// mistakenly omitted on grounds of "no usage in this task's code, belongs to a later task".
// That assessment was wrong —— the criterion is task brief's **Interface contract** (brief
// line 11 explicitly lists it as this task's output) and **downstream consumers** (the next task's brief
// `import { useKnowledgeStore, DISTILL_JOBS_LIMIT } from './knowledgeStore'` and direct
// use in assertions), not "whether this task's own code uses it". Missing a cross-task
// interface deliverable means the next task fails to compile. Adding it now; definition
// below (before `fmtAgo`, corresponding to blueprint :11).
//
// 【Data extraction mode】(K1, following P2a/P3a/P3b/P4 fifth iteration of same pattern)
// —— In Vue2 `api.xxx()` returns raw axios response, everywhere written `resp.data`
// (e.g. blueprint :84 `stats.data`). Shared package `service.ai.*` already unwraps that
// layer, returns body directly. Thus this file rewrites blueprint's
// `stats.data`/`control.data`/`r.data.jobs`/`r.data.files`/`r.data.total`/
// `exts.data.extensions`/`folders.data.rules` to single-layer
// `stats`/`control`/`body.jobs`/`body.files`/`body.total`/`body.extensions`/`body.rules`,
// no extra `.data` unwrap. Consistent with agentStore.ts:110-130,
// settingsStore.ts:6-9.
//
// 【Mechanical replacement of Vue2 reactivity API】(equivalent, not behavior change;
// following P1)
//   Vue.observable({ state: {...} }) → set of ref
//   state.x                          → x.value
//   Vue.set(o, k, v)                 → o[k] = v (no hits in this group)
//   actions.foo() internal calls (e.g. loadAllJobs calls this.loadJobs) → direct local call
//
// 【Divergence P2: timer handle moved out of state】—— Blueprint puts
// `indexedFiles.pollTimer` in reactive state (:53). This file changes to module-level
// `let indexedPollTimer` (same style as agentStore.ts `_toastTimer`): Pinia state is
// serialized by devtools, timer handle is not data.
// Behavior equivalent —— the "already polling, don't start again" guard in
// `startIndexedPolling` (blueprint :346 `if (s.pollTimer) return`) preserved unchanged,
// only the check variable changed to module-level.
//
// 【Divergence P4: where toast lives after `.k-toast` retires】—— Blueprint `toast(msg)`
// (:72-76) directly writes `knowledgeStore.state.toast` and uses module-level `_toastTimer`
// for 2400ms auto-clear, paired with `.k-toast` render in component. This repo doesn't port
// `.k-toast` (K3), `toast()` stays as store action (blueprint has many callers depending on
// that name), internally calls global `useToast().show(msg, 2400)` —— 2400ms is blueprint's
// own timeout, must be passed explicitly (`useToast().show` default is 1500, see
// `src/stores/toast.ts:21`). The `state.toast` field is entirely deleted, no longer needed.
//
// 【i18n】`fmtAgo` (blueprint :60-69) uses `i18n.t(...)`. This repo's vue-i18n 9 uses
// composition mode, Pinia setup store is not in component setup context, `useI18n()` is
// unavailable, following precedent from agentStore.ts:6,899 uses global instance
// `i18n.global.t(...)`. Four keys (`aiKbJustNow`/`aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`)
// by T8, verified to exist in `src/i18n/{zh_cn,en_us}.ts`, interpolation placeholders
// `m`/`h`/`d` match blueprint `{m}`/`{h}`/`{d}` exactly.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { DistillJob, WikiRoot, WikiCandidate, WikiTreeNode, WikiNode } from '@nimotech/nimoos-service'
import { i18n } from '../../../i18n'
import { useToast } from '../../../stores/toast'
import { buildListParams, anyIndexing } from '../util/indexedFiles'
import { summarizeNotes } from '../util/dashboardHelpers'

// ── Types: service responses are all `unknown` in shared package, narrowed here by
// blueprint's actual usage ——
// (field shape per design §6.1 / p5a-common-constraints.md §4 backend contract)

export interface QueueDepth {
  pending: number
  running: number
  failed: number
  done: number
}

export interface ParserModel {
  name: string
  version?: string
  modality?: string
  dim?: number
  [k: string]: unknown
}

/** parserStats() response —— live testing shows no rate_per_min/done_last_10m/eta_s (N2, copy only). */
export interface ParserStats {
  queue_depth: QueueDepth
  indexed_files: number
  total_vectors_text: number
  total_vectors_visual: number
  last_cursor_ms: number
  models?: ParserModel[]
}

/** parserState() response —— live testing shows exactly these 5 fields. */
export interface ParserControlState {
  paused: boolean
  concurrency: number
  device: string
  resolved_device: string
  ocr_enabled: boolean
}

export interface ParserJob {
  id: string | number
  root_id?: string
  path: string
  op?: string
  sub_modality?: string
  priority?: number
  attempts?: number
  last_error?: string | null
  locked_until?: string | null
  created_at?: string
  picked_at?: string | null
  done_at?: string | null
  [k: string]: unknown
}

export interface JobsBuckets {
  pending: ParserJob[]
  running: ParserJob[]
  failed: ParserJob[]
}

/** parserAllowlistExtensions() single item —— backend `enabled` is SQLite integer 0/1 (N1). */
export interface RawAllowlistExtension {
  ext: string
  enabled: number | boolean
  source: string
}

/** After normalization (N1: `enabled` to boolean). */
export interface AllowlistExtension {
  ext: string
  enabled: boolean
  source: string
}

export interface FolderRule {
  id: string | number
  root_id?: string
  path_glob?: string
  action?: string
  [k: string]: unknown
}

export interface IndexedFile {
  file_id: string
  paths?: { root_id: string; path: string; mtime_ms: number }[]
  sha256_full?: string
  size?: number
  mime?: string
  modalities_done?: string[]
  parser_version?: string
  indexed_at?: string
  tombstoned_at?: string | null
  vector_count?: number
  last_error?: string | null
  status?: string
  [k: string]: unknown
}

/** Blueprint :48-52 —— Initial filter values for Indexed Files tab. */
export interface IndexedFileFilters {
  root_id: string | null
  path_prefix: string
  mime_prefix: string
  has_error: boolean
  tombstoned: string
  sort: string
  order: string
  limit: number
  offset: number
}

/** Blueprint :46-54 —— **excludes** `pollTimer` (P2 divergence, handle moved to module-level `indexedPollTimer`). */
export interface IndexedFilesState {
  files: IndexedFile[]
  total: number
  loading: boolean
  error: string | null
  filters: IndexedFileFilters
}

/**
 * Blueprint :9-11 —— per-call limit for distill job queue fetch from server, shared number
 * with view so "list is truncated" criterion (rows loaded >= this limit) computes the same
 * on both sides. This batch (T6) doesn't consume it —— distill queue (distillJobs) whole
 * group belongs to T7; T7 onwards `import { ..., DISTILL_JOBS_LIMIT } from './knowledgeStore'`
 * to use. Value matches blueprint exactly (500).
 */
export const DISTILL_JOBS_LIMIT = 500

/** Blueprint :60-69 —— relative time formatting, four tiers (zero / minutes / hours / days). */
export function fmtAgo(ms: number): string {
  if (!ms) return '—'
  const diff = Math.max(0, Date.now() - ms)
  const m = Math.floor(diff / 60000)
  if (m < 1) return i18n.global.t('aiKbJustNow')
  if (m < 60) return i18n.global.t('aiKbMinAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.global.t('aiKbHrAgo', { h })
  return i18n.global.t('aiKbDaysAgo', { d: Math.floor(h / 24) })
}

/** P2 —— timer handle moved out of state, rationale in file header. */
let indexedPollTimer: ReturnType<typeof setInterval> | null = null

// ══════════════════════════════════════════════════════════════════════
// Notes + wiki + distill group (blueprint :99-309, same
// knowledgeStore.js; T6 done Parser group, this section continues).
// Following T6 conventions: K1 (single-layer extraction) / P1 (Vue.observable→setup store) /
// K5 (HTTP failure doesn't echo backend body, use i18n key) / K6 (don't copy console.error).
// N4/N5/N6/N7 four "copy exactly" rules noted individually in corresponding functions.
// ══════════════════════════════════════════════════════════════════════

/** Blueprint :35 (distillJobs initial shape) —— pending/running/failed same type as Parser
 * group `jobs`, plus counts (full tally) / done (cumulative distilled count) / total
 * (rows fetched this call, truncation criterion per N5). */
export interface DistillJobsState {
  pending: DistillJob[]
  running: DistillJob[]
  failed: DistillJob[]
  counts: { pending: number; running: number; failed: number }
  done: number
  total: number
}

/** Blueprint :43 (notesSummary initial shape) —— output fed to dashboardHelpers.summarizeNotes,
 * used for dashboard composition card three-tier distribution. */
export interface NotesSummary {
  total: number
  draft: number
  curated: number
  archived: number
}

export const useKnowledgeStore = defineStore('ai-knowledge', () => {
  // ── Dashboard / topbar (blueprint :18-23) ──
  const stats = ref<ParserStats>({
    queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
    indexed_files: 0,
    total_vectors_text: 0,
    total_vectors_visual: 0,
    last_cursor_ms: 0,
  })
  const controlState = ref<ParserControlState>({
    paused: false,
    concurrency: 2,
    device: 'auto',
    resolved_device: 'cpu',
    ocr_enabled: false,
  })
  const unreachable = ref(false)
  const overviewLoaded = ref(false)
  const lastSyncFmt = ref('—')

  // ── Allowlist (blueprint :24-26) ──
  const extensions = ref<AllowlistExtension[]>([])
  const folderRules = ref<FolderRule[]>([])

  // ── Queue (blueprint :27-28, parser half) ──
  const jobs = ref<JobsBuckets>({ pending: [], running: [], failed: [] })
  /** Stale-guard counter for `loadAllJobs` (K15), pattern from `rootsEpoch` (`3d8c9bc`).
   * Per store instance, not module-level singleton. */
  let allJobsEpoch = 0

  // ── Parsing progress (blueprint :41-42) ──
  const backlogPeak = ref(0)

  // ── Indexed Files tab (blueprint :45-54, P2 removed pollTimer) ──
  const indexedFiles = ref<IndexedFilesState>({
    files: [],
    total: 0,
    loading: false,
    error: null,
    filters: {
      root_id: null,
      path_prefix: '',
      mime_prefix: '',
      has_error: false,
      tombstoned: 'alive',
      sort: 'indexed_at',
      order: 'desc',
      limit: 100,
      offset: 0,
    },
  })
  /** Stale-guard counter for `loadIndexedFiles` (K15). See function comment: `loading`
   * reset in `finally` is also guarded, else a stale arrival will reset it after skeleton
   * vanishes. */
  let indexedFilesEpoch = 0

  // ── T7: notes / distill / wiki (blueprint :29-43) ──
  const distillJobs = ref<DistillJobsState>({
    pending: [],
    running: [],
    failed: [],
    counts: { pending: 0, running: 0, failed: 0 },
    done: 0,
    total: 0,
  })
  /** Stale-guard counter for `loadDistillJobs` (K15). Four concurrent sources (10s polling +
   * `setFilter` + `setScope('distill')` + internal reload in `retryDistill`/`cancelDistill`),
   * per filter only refreshes corresponding bucket, stale responses can put pending results
   * in failed bucket. */
  let distillJobsEpoch = 0
  const wikiRoots = ref<WikiRoot[]>([])
  const wikiCandidates = ref<WikiCandidate[]>([])
  const wikiRootsLoading = ref(false)
  /** Stale-guard counter for `loadRoots`, see function comment. Not data, so not in state
   * (same treatment as `indexedPollTimer`), but per store instance not module scope,
   * so each `createPinia()` starts from 0. */
  let rootsEpoch = 0
  const notesDraftCount = ref(0)
  const notesSummary = ref<NotesSummary>({ total: 0, draft: 0, curated: 0, archived: 0 })

  /** P4 —— `.k-toast` retired, delegates to global toast, 2400ms matches blueprint (explicit param). */
  function toast(msg: string): void {
    useToast().show(msg, 2400)
  }

  /** Blueprint :78-96 —— parallel fetch stats + control state; on failure set unreachable, leave existing values. */
  async function loadOverview(): Promise<void> {
    try {
      const [statsBody, controlBody] = await Promise.all([
        service.ai.parserStats(),
        service.ai.parserState(),
      ])
      stats.value = statsBody as ParserStats
      controlState.value = controlBody as ParserControlState
      lastSyncFmt.value = fmtAgo(stats.value.last_cursor_ms)
      unreachable.value = false
      overviewLoaded.value = true

      const q = stats.value.queue_depth || ({} as QueueDepth)
      const backlog = (q.pending || 0) + (q.running || 0)
      backlogPeak.value = Math.max(backlogPeak.value, backlog)
    } catch {
      unreachable.value = true
    }
  }

  // ── Jobs (blueprint :141-166) ──

  /** Blueprint :142-145 —— single bucket fetch, N7: missing `jobs` key defaults to empty array. */
  async function loadJobs(status: string, limit = 200): Promise<ParserJob[]> {
    const body = (await service.ai.parserJobs({ status, limit })) as { jobs?: ParserJob[] }
    return body.jobs || []
  }

  /** Blueprint :146-153 —— parallel three-bucket fetch and reset.
   *
   * 【Divergence, K15, stale guard】QueueView 10-second polling and `setScope('index')`
   * manual trigger coexist —— when manually switching scope and immediately fetching again,
   * if polling's request arrives late (network jitter / backend slowdown), earlier request
   * arriving later overwrites new data, page briefly "jumps back".
   * Use local epoch to check "am I still the latest call", discard entire response if not,
   * don't write `jobs.value`. Pattern from `loadRoots` (`3d8c9bc`). */
  async function loadAllJobs(): Promise<void> {
    const epoch = ++allJobsEpoch
    const [p, r, f] = await Promise.all([
      loadJobs('pending'),
      loadJobs('running'),
      loadJobs('failed'),
    ])
    if (epoch !== allJobsEpoch) return
    jobs.value = { pending: p, running: r, failed: f }
  }

  /** Blueprint :154-157 —— defaults to `null` (retry all). */
  async function retryFailed(fileIds: string[] | null = null): Promise<void> {
    await service.ai.parserRetryJobs({ file_ids: fileIds })
    await loadAllJobs()
  }

  /** Blueprint :158-161. */
  async function cancelJob(id: string | number): Promise<void> {
    await service.ai.parserDeleteJob(id)
    await loadAllJobs()
  }

  /** Blueprint :162-166. */
  async function clearFailed(): Promise<unknown> {
    const body = await service.ai.parserClearFailedJobs()
    await loadAllJobs()
    return body
  }

  // ── Allowlist (blueprint :217-241) ──

  /** Blueprint :217-228 —— N1: `enabled` 0/1 normalized to boolean, copy comment verbatim. */
  async function loadAllowlist(): Promise<void> {
    const [extsBody, foldersBody] = await Promise.all([
      service.ai.parserAllowlistExtensions(),
      service.ai.parserAllowlistFolders(),
    ])
    const exts = extsBody as { extensions?: RawAllowlistExtension[] }
    const folders = foldersBody as { rules?: FolderRule[] }
    // Parser reports `enabled` as SQLite INTEGER(0/1). Chip template is driven by boolean
    // to flip visual state —— without this normalization, chip never highlights per backend
    // value (original blueprint :222-225 comment aligned exactly).
    extensions.value = (exts.extensions || []).map((e) => ({ ...e, enabled: !!e.enabled }))
    folderRules.value = folders.rules || []
  }

  /** Blueprint :229-232. */
  async function toggleExtension(ext: string, enabled: boolean): Promise<void> {
    await service.ai.patchParserAllowlistExtensions({ ext, enabled })
    await loadAllowlist()
  }

  /** Blueprint :233-237. */
  async function addFolderRule(payload: {
    root_id: string
    path_glob: string
    action: string
  }): Promise<unknown> {
    const body = await service.ai.addParserAllowlistFolder(payload)
    await loadAllowlist()
    return body
  }

  /** Blueprint :238-241. */
  async function deleteFolderRule(id: string | number): Promise<void> {
    await service.ai.deleteParserAllowlistFolder(id)
    await loadAllowlist()
  }

  // ── Control (blueprint :310-314, settings page) ──

  /** Blueprint :311-314 —— action + extra fields merged into body, reload overview on success. */
  async function setControl(action: string, extra: Record<string, unknown> = {}): Promise<void> {
    await service.ai.parserControl({ action, ...extra })
    await loadOverview()
  }

  // ── Indexed Files tab (blueprint :316-362) ──

  /** Blueprint :317-330.
   *
   * 【Divergence, K15, stale guard】`onPathPrefixInput` (blueprint `IndexedFilesView.vue:633-636`) /
   * `onMimePrefixInput` (`:643-646`) reloads on every keystroke, blueprint has no debounce (N9,
   * trigger frequency copied unchanged). Typing `abc` with three concurrent requests, if
   * `a`→`ab`→`abc` doesn't arrive in input order (earlier request later), the `ab` request
   * overwrites `abc`'s result while filter shows `abc`. Use local epoch to check "am I still
   * the latest call", discard entire response if not ——
   * **`s.loading = false` in `finally` also guarded**, else stale arrival resets after latest
   * already removed skeleton (new data rendered, no skeleton shown / resetting is benign no-op).
   * But inverse: if latest hasn't arrived yet and stale arrives first, unguarded `finally`
   * removes loading early, shows "fake done" empty table before new data. Pattern from
   * `loadRoots` (`3d8c9bc`). */
  async function loadIndexedFiles(): Promise<void> {
    const epoch = ++indexedFilesEpoch
    const s = indexedFiles.value
    s.loading = true
    s.error = null
    try {
      const body = (await service.ai.parserFiles(buildListParams(s.filters))) as {
        files?: IndexedFile[]
        total?: number
      }
      if (epoch !== indexedFilesEpoch) return
      s.files = body.files || []
      s.total = body.total || 0
    } catch (e) {
      if (epoch !== indexedFilesEpoch) return
      s.error = (e as Error | undefined)?.message || String(e)
    } finally {
      if (epoch === indexedFilesEpoch) s.loading = false
    }
  }

  /** Blueprint :332-336. */
  async function reindexIndexedByIds(fileIds: string[], reason?: string): Promise<unknown> {
    const body = await service.ai.parserReindexFiles({ file_ids: fileIds, reason })
    await loadIndexedFiles()
    return body
  }

  /** Blueprint :338-342. */
  async function reindexIndexedByFilter(
    filter: Record<string, unknown>,
    reason?: string,
  ): Promise<unknown> {
    const body = await service.ai.parserReindexFiles({ filter, reason })
    await loadIndexedFiles()
    return body
  }

  /**
   * Blueprint :344-353 —— if already polling don't start again (P2: guard check changed from
   * `state.indexedFiles.pollTimer` to module-level `indexedPollTimer`, semantics unchanged);
   * don't start if no indexing rows; reload every 30s, auto-stop when done (no more indexing rows).
   */
  function startIndexedPolling(): void {
    if (indexedPollTimer) return
    if (!anyIndexing(indexedFiles.value.files)) return
    indexedPollTimer = setInterval(async () => {
      await loadIndexedFiles()
      if (!anyIndexing(indexedFiles.value.files)) {
        stopIndexedPolling()
      }
    }, 30000)
  }

  /** Blueprint :356-362. */
  function stopIndexedPolling(): void {
    if (indexedPollTimer) {
      clearInterval(indexedPollTimer)
      indexedPollTimer = null
    }
  }

  // ── Knowledge notes (blueprint :98-117) ──

  /** Blueprint :99-101. */
  function setNotesDraftCount(n: number): void {
    notesDraftCount.value = n
  }

  /** Blueprint :102-107 —— silently keep last value when agent is offline, don't toast
   * (K6: don't copy console.error, no logging either). K1: `service.notes.list` already
   * normalized returns `Note[]`, no more unwrapping `r.data.notes`. 【Divergence P3】
   * Blueprint is direct axios `api.get('/ai/agent/notes', {status:'draft',limit:200})`,
   * this repo uses `service.notes.list(...)` (P0 mandate: all REST through package). */
  async function refreshNotesDraftCount(): Promise<void> {
    try {
      const list = await service.notes.list({ status: 'draft', limit: 200 })
      notesDraftCount.value = list.length
    } catch {
      // agent offline — keep last value
    }
  }

  /** Blueprint :108-117 —— dashboard composition card state summary; on failure silently keep last values. */
  async function loadNotesSummary(): Promise<void> {
    try {
      const list: { status?: string }[] = await service.notes.list({ limit: 500 })
      const s = summarizeNotes(list)
      notesSummary.value = s
      notesDraftCount.value = s.draft
    } catch {
      // agent offline — keep last values
    }
  }

  // ── Search (blueprint :119-138) ──

  interface RunSearchParams {
    query: string
    filters?: Record<string, unknown>
    topK?: number
    rerank?: boolean
  }

  /** Blueprint :120-131 —— fixed fields assembly; `service.ai.searchText` already
   * single-layer extracted (K1), return directly. */
  async function runSearch(params: RunSearchParams): Promise<unknown> {
    const { query, filters, topK, rerank } = params
    const body = {
      query,
      filters: filters || {},
      top_k: topK || 10,
      rerank: !!rerank,
      group_by_file: true,
      max_chunks_per_file: 8,
    }
    return service.ai.searchText(body)
  }

  interface LoadChunkContextParams {
    fileId: string
    kind?: string
    chunkNo: number
    window?: number
  }

  /** Blueprint :134-138 —— `window` defaults to 2, `kind` defaults to `'body'`. */
  async function loadChunkContext(params: LoadChunkContextParams): Promise<unknown> {
    const { fileId, kind, chunkNo, window = 2 } = params
    return service.ai.searchChunk({ file_id: fileId, kind: kind || 'body', chunk_no: chunkNo, window })
  }

  // ── Distillation queue (blueprint :168-214) ──

  /**
   * Blueprint :168-197 —— per polling, single request per currently active filter pill.
   * **N4 (copy exactly)**: no filter (`filter===''`) unpacks combined list back to all three
   * buckets refresh; with filter (backend `status=`, already folded `skipped` into `failed`)
   * **only refresh that bucket**, keep other two from last result —— intentional design to
   * prevent earlier failed/skipped rows in busy queue from being squeezed out by single
   * unfiltered window, not a bug.
   * `counts` is always full tally regardless of `filter`, entirely overwritten each call.
   * **N5 (copy exactly)**: `done` from `getDistillStatus()` cumulative distilled count,
   * intentionally not derived from parser's `queue_depth`; `total = actual rows fetched this
   * call` (capped at `DISTILL_JOBS_LIMIT`) as "list is truncated" criterion, simpler and
   * race-free vs another independent SELECT (`counts`) on same changing table.
   *
   * 【Divergence, K15, stale guard】This action has **four concurrent** trigger sources:
   * 10-second polling + `setFilter(f)` + `setScope('distill')` + reload in
   * `retryDistill`/`cancelDistill`. And it only refreshes per `filter` the corresponding
   * bucket (N4) —— stale responses aren't just "overwrite with old data": if user manually
   * switches pill to `pending` then immediately back to `failed`, and earlier
   * `filter==='pending'` response arrives after later `filter==='failed'`, earlier overwrites
   * `d.pending` with stale data, and its `d.counts`/`d.done`/`d.total` stale full snapshots
   * wipe out `failed` bucket's displayed count too. Use local epoch to check "am I still the
   * latest call", discard entire response if not (write none of four fields). Pattern from
   * `loadRoots` (`3d8c9bc`).
   */
  async function loadDistillJobs(filter = ''): Promise<void> {
    const epoch = ++distillJobsEpoch
    const [jobsResult, status] = await Promise.all([
      service.notes.listDistillJobs(filter, DISTILL_JOBS_LIMIT),
      service.notes.getDistillStatus(),
    ])
    if (epoch !== distillJobsEpoch) return
    const rows = jobsResult.jobs || []
    const d = distillJobs.value
    if (!filter || filter === 'pending') d.pending = rows.filter((j) => j.status === 'pending')
    if (!filter || filter === 'running') d.running = rows.filter((j) => j.status === 'running')
    if (!filter || filter === 'failed') {
      d.failed = rows.filter((j) => j.status === 'failed' || j.status === 'skipped')
    }
    d.counts = jobsResult.counts
    d.done = status.distilled
    d.total = rows.length
  }

  /** Blueprint :198-205 —— manual resend is shared retry path for both failed and skipped
   * (already recovered) rows, no separate "unskip" API; `filter` is caller's currently active
   * pill, reload stays in same view range. */
  async function retryDistill(row: { filePath: string }, filter = ''): Promise<void> {
    await service.notes.distillFile(row.filePath)
    await loadDistillJobs(filter)
  }

  /** Blueprint :206-214 —— mirror of retryDistill; backend marks row skipped (reason
   * "user cancelled"), later appears in failed/skipped bucket, retryDistill is its undo.
   * 409 (already not cancellable) is re-thrown as-is for view layer to show friendly message. */
  async function cancelDistill(row: { filePath: string }, filter = ''): Promise<void> {
    await service.notes.cancelDistillJob(row.filePath)
    await loadDistillJobs(filter)
  }

  // ── Wiki index roots (blueprint :243-273) ──

  /** Blueprint :244-253 —— K5: on failure don't echo backend verbatim, use i18n key
   * `aiKbOpFailed` (blueprint original was `i18n.t('Operation failed') + ': ' + e.message`,
   * concatenates backend error string into toast).
   *
   * 【Divergence P5, acceptance feedback fix, 2026-08-01】Added `silent` and stale guard.
   * Blueprint always toasts unconditionally, but `loadRoots` serves two caller types:
   * **user-initiated** (RootsView add/delete/edit then reload, failure must notify) and
   * **background load** (Dashboard mount three-way `Promise.all`, user clicked nothing).
   * Device's `/v1/wiki/roots` never responds (38 GB SQLite + `SetMaxOpenConns(1)`), background
   * waits for full 60s axios timeout to land —— by then user likely left overview page, toast
   * appears on unrelated page saying "operation failed", and every overview visit queues
   * another. That's blueprint's error-swallowing/noise bug, per "1:1 visuals, fix logic"
   * principle don't copy: background callers pass `silent: true` to suppress (overview shows
   * "0 knowledge roots" expressing the failure anyway), user-initiated path unchanged.
   *
   * Stale guard (following New-UI discipline): page-hopping triggers multiple `loadRoots`,
   * earlier request arriving later overwrites later request's result, prematurely resets
   * `wikiRootsLoading`. Use local epoch to check "am I still the latest call", discard
   * entire response if not. */
  async function loadRoots(opts?: { silent?: boolean }): Promise<void> {
    const epoch = ++rootsEpoch
    wikiRootsLoading.value = true
    try {
      const rows = await service.wiki.getRoots()
      if (epoch !== rootsEpoch) return
      wikiRoots.value = rows
    } catch {
      if (epoch !== rootsEpoch) return
      if (!opts?.silent) toast(i18n.global.t('aiKbOpFailed'))
    } finally {
      if (epoch === rootsEpoch) wikiRootsLoading.value = false
    }
  }

  /** Blueprint :254-260 —— silently clear on failure (candidate list is best-effort hint anyway). */
  async function loadCandidates(): Promise<void> {
    try {
      wikiCandidates.value = await service.wiki.getCandidates()
    } catch {
      wikiCandidates.value = []
    }
  }

  /** Blueprint :261-266 —— errors re-thrown as-is, RootsView handles 409→mirror retry.
   * K1: `service.wiki.createRoot` already unwrapped in package, returns directly, no more `r.data` unwrap. */
  async function createRoot(body: Record<string, unknown>): Promise<unknown> {
    const result = await service.wiki.createRoot(body)
    await loadRoots()
    return result
  }

  /** Blueprint :267-270. */
  async function deleteRoot(id: string, purge?: boolean): Promise<void> {
    await service.wiki.deleteRoot(id, purge)
    await loadRoots()
  }

  /** Blueprint :271-273 —— intentionally does not reload list (unlike deleteRoot). */
  async function rescanRoot(id: string): Promise<void> {
    await service.wiki.rescanRoot(id)
  }

  // ── Wiki navigation (blueprint :276-309) ──

  /** Blueprint :276-278. */
  async function loadWikiTree(rootId?: string): Promise<WikiTreeNode[]> {
    return service.wiki.getTree(rootId)
  }

  function isNotFound(e: unknown): boolean {
    return !!(
      e &&
      typeof e === 'object' &&
      'response' in e &&
      (e as { response?: { status?: number } }).response?.status === 404
    )
  }

  /** Blueprint :279-287 —— **N6 (copy exactly)**: 404 (node not yet indexed) becomes `null`,
   * all other errors re-thrown as-is, don't swallow everything to null. */
  async function loadWikiNode(path: string): Promise<WikiNode | null> {
    try {
      return await service.wiki.getNode(path)
    } catch (e) {
      if (isNotFound(e)) return null
      throw e
    }
  }

  /** Blueprint :288-296 —— same N6 stratification as loadWikiNode (`.wiki.md` not yet generated → null). */
  async function loadWikiRaw(path: string): Promise<string | null> {
    try {
      return await service.wiki.getRaw(path)
    } catch (e) {
      if (isNotFound(e)) return null
      throw e
    }
  }

  /** Blueprint :297-309 —— optimistic update: flip local state first, rollback and re-throw on
   * failure; unknown id returns immediately, no request. */
  async function setRootEnabled(id: string, enabled: boolean): Promise<void> {
    const root = wikiRoots.value.find((r) => r.id === id)
    if (!root) return
    const prev = root.enabled
    root.enabled = enabled
    try {
      await service.wiki.patchRootEnabled(id, enabled)
    } catch (e) {
      root.enabled = prev
      throw e
    }
  }

  return {
    // state
    stats,
    controlState,
    unreachable,
    overviewLoaded,
    lastSyncFmt,
    extensions,
    folderRules,
    jobs,
    backlogPeak,
    indexedFiles,
    distillJobs,
    wikiRoots,
    wikiCandidates,
    wikiRootsLoading,
    notesDraftCount,
    notesSummary,
    // actions
    toast,
    loadOverview,
    loadJobs,
    loadAllJobs,
    retryFailed,
    cancelJob,
    clearFailed,
    loadAllowlist,
    toggleExtension,
    addFolderRule,
    deleteFolderRule,
    setControl,
    loadIndexedFiles,
    reindexIndexedByIds,
    reindexIndexedByFilter,
    startIndexedPolling,
    stopIndexedPolling,
    setNotesDraftCount,
    refreshNotesDraftCount,
    loadNotesSummary,
    runSearch,
    loadChunkContext,
    loadDistillJobs,
    retryDistill,
    cancelDistill,
    loadRoots,
    loadCandidates,
    createRoot,
    deleteRoot,
    rescanRoot,
    loadWikiTree,
    loadWikiNode,
    loadWikiRaw,
    setRootEnabled,
  }
})
