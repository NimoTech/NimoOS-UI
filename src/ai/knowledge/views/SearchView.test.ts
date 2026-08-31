// `SearchView.vue` unit tests (T6: search box + advanced panel + `run()` +
// four states; T7 continuation: result card list + two subcomponents wiring + `fetchBlobUrl`/
// `openOriginal`/`downloadFile`/`onDrawerToast`). Blueprint `the Vue 2 panel@7a6ee6b7`
// `src/views/AI/Knowledge/SearchView.vue` (401 lines).
//
// === T7 scope (this continuation) ===
// Result card list (`:121-156`) · `k-result-count`'s `ms` v-if · mounting of two subcomponents
// markup (`FileDetailDrawer`/`KFileViewer`'s `<template>` wiring) ·
// complete behavior of `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast`
// (K50/decision R1 "Option A").
//
// === mock boundaries (governance §4.1) ===
// `store.runSearch`/`store.loadChunkContext` use real Pinia + `vi.spyOn` per-condition mocks,
// return values = backend-original snake_case (`knowledgeStore.ts:550-561`/`:571-574` zero
// normalization), not camelCase — `toFileResults` is where normalization happens; reversing
// this would be Critical.
// 🔴 T7 addition: `@nimotech/nimoos-service` uses `importOriginal` for partial mocking —
// `service.file.fileUrl` and `getHttp().get` are the only two external symbols consumed by
// `fetchBlobUrl`, mock shape follows existing precedent `src/files/stores/files.test.ts:17`
// / `FileDetailDrawer.test.ts`'s `vi.hoisted` pattern.
//
// === fixture sources (three-level tags annotated per condition, decision R3 constraint 1 / R9) ===
// F1 — REAL, a captured device response,
//         as-is (file already has zero `_`-prefixed keys; see README §3.3 PURE_REAL exception).
//   F4  — REAL, `F4-search-text.no_accessible_roots.REAL.json`, as-is. Used for N38
//         reverse assertion (non-empty `warnings` but not rerank_unavailable → should not assert true).
//   F11 — CONSTRUCTED (D-6 mold; decision R2: rerank unreachable on real device, this warning
//         cannot be end-to-end reproduced locally), `F11-rerank-warning.CONSTRUCTED.json`, removed
//         `_provenance`/`_authoritative_string`/
//         `_other_real_warning_strings_in_the_same_slice` three `_`-prefixed ledger keys.
//   F5b — REPLAYED, `F5b-search-text.multifile.REPLAYED.json`. 4 files × 2 chunks per file =
//         8 chunks. 🔴 Per R9-3 "tests must only include 1–2 complete bodies", this file
//         **zero complete bodies** — all 8 `preview.text` entries truncated to actual first
//         70 characters, each annotated with `len`/`sha256` of complete value (full-text
//         equivalence already verified in `FileDetailDrawer.test.ts` on the same `file_id`
//         (`dce79e8ea5…`) for two chunks; not duplicated here). Removed `_provenance` ledger
//         key (§3.3). T6 only uses it to verify `results.length`/`totalChunks`/`phase` state
//         facts; T7 uses it to render visible fields of result cards (`data-kind`/
//         `k-match-pill`/`k-rel`/`k-more-hint`/`k-rcard-meta`). `hits[]` field not consumed
//         on this code path (`toFileResults` prefers non-empty `files`), omitted as `[]` —
//         hits-fallback branch already covered in `searchAggregate.test.ts`, not duplicated here.
//   T7 new local constructed cases (`.CONSTRUCTED`, not fixture files, annotated inline):
//   K49 injection sample (containing `<script>` in `preview.text`) · zero-chunk file sample ·
//   single-chunk file sample (`k-more-hint` reverse) · `makeFileVM` factory output wiring sample
//   (`chunks: []`, specifically to bypass network call in `FileDetailDrawer.fetchFull()`,
//   see `makeFileVM` comment below).
//
// === K/N hits (see comment in corresponding describe block) ===
// K44 (zero `<style>`) · K49 (v-html component-level injection, T7 addition) · K51 (toggleSet
// reactivity) · K52/decision R1 "Option A" (fetchBlobUrl four self-proofs, T7 addition) ·
// N33 (SAMPLE_QUERIES) · N34 (advEnabled counterintuitive criterion) · N35 (MIME_PREFIXES
// verbatim) · N36 (buildFilters three tiers, fake clock) · N37 (catch does not clear ms) ·
// N38 (showRerankWarn fake clock) · N39 (clear openFile/viewerFile) · N40 (?q= deep link watch,
// immediate + three conditions) · N41 (two Esc listeners close both, T7 addition wiring
// verification) · governance §5.2 run() stale guard (blueprint none, T7 addition) · decision
// R25 (auto-load guard, T6 created, T7 satisfied).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import SearchView from './SearchView.vue'
import FileDetailDrawer from '../components/FileDetailDrawer.vue'
import AssetDetailDrawer from '../components/AssetDetailDrawer.vue'
import KFileViewer from '../components/KFileViewer.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { FileVM } from '../util/searchAggregate'
import { readFileSync } from 'node:fs'
import { resolve, dirname as pathDirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── T7 — mock `@nimotech/nimoos-service` (K50/decision R1 "Option A") ───
// `service.file.fileUrl` and `getHttp().get` are the only two external symbols consumed by
// `fetchBlobUrl`. Mock values intentionally embed `token=TEST_TOKEN_ABC` in the returned URL —
// this allows asserting "window.open/<a href> does not expose token=" (K50 criterion ②'s
// reverse assertion needs a fileUrl() output that exposes the token as control group).
// `isDistillableName` (consumed by `FileDetailDrawer`, N44) uses `importOriginal` to preserve
// real implementation, unaffected — this file does not test distill.
const fileUrl = vi.hoisted(() => vi.fn((p: string) => `/v3/file?token=TEST_TOKEN_ABC&path=${encodeURIComponent(p)}`))
const httpGet = vi.hoisted(() => vi.fn())
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { file: { fileUrl } }, getHttp: () => ({ get: httpGet }) }
})

const __dirname = pathDirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8') as string
// 🔴 E-60/E-25 family: negation-form assertions on class names/call shapes must first strip
// comments (`SearchView.vue` head `//` comments and template tail `<!-- -->` comments themselves
// heavily reference `<style`/`FileDetailDrawer`/`@close` etc. for declaration documentation,
// source of false positives — first real test failed here once, see report).
// `.vue` files interleave `//` line comments from `<script>` and HTML comments from `<template>`,
// both types must be stripped.
const stripLineComments = (src: string) =>
  src
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

// ─── fixture data (sources documented in file head) ───

const F1_EMPTY = {
  hits: [],
  stats: { total_candidates: 0, rerank_ms: 0, embed_ms: 257, vector_search_ms: 1, expand_ms: 0 },
  warnings: [],
}

const F4_NO_ACCESSIBLE_ROOTS = {
  hits: [],
  stats: { total_candidates: 0, rerank_ms: 0, embed_ms: 0, vector_search_ms: 0, expand_ms: 0 },
  warnings: ['no_accessible_roots'],
}

const F11_RERANK_WARN = {
  hits: [],
  files: [],
  stats: { total_candidates: 12, rerank_ms: 41, embed_ms: 233, vector_search_ms: 3, expand_ms: 8 },
  warnings: ['rerank_unavailable'],
}

// F5b — 4 files × 2 chunks. Each preview.text truncated to actual first 70 characters,
// len/sha256 of complete value annotated per entry (from F5b-search-text.multifile.REPLAYED.json).
const F5B_RESPONSE = {
  hits: [], // not consumed on this code path (files prioritized when non-empty), see file head documentation
  files: [
    {
      file_id: 'dce79e8ea5d48719cd4ad16fe48da843',
      paths: [
        {
          root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
          path: '/DATA/Containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log',
          mtime_ms: 1784424392240,
        },
      ],
      mime: 'text/plain',
      kind: 'body',
      score: 0.738,
      chunks: [
        // len=2342 sha256=fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b
        {
          score: 0.738,
          file_id: 'dce79e8ea5d48719cd4ad16fe48da843',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 0, offset_end: 2343, chunk_no: 0 },
          preview: { text: '{"log":"/usr/share/nimoos/agent/main.py:201: DeprecationWarning: \\n","' },
        },
        // len=2317 sha256=8c56f4fb9077e623048ce9614449cc2ac811c5ec98a82dba521bbcff3e401eea
        {
          score: 0.7354,
          file_id: 'dce79e8ea5d48719cd4ad16fe48da843',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 2343, offset_end: 4660, chunk_no: 1 },
          preview: { text: 'stAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/' },
        },
      ],
    },
    {
      file_id: '05d732586959ea3f480b5feb4b0d17c8',
      paths: [
        { root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/log/nimoos/log.log', mtime_ms: 1784404128499 },
      ],
      mime: 'text/plain',
      kind: 'body',
      score: 0.6118,
      chunks: [
        // len=2285 sha256=d5dcb90a45d6ac4d368004b5c6d4b10a01a72b28888d62ae05a95dad12b1c32f
        {
          score: 0.6118,
          file_id: '05d732586959ea3f480b5feb4b0d17c8',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 0, offset_end: 2285, chunk_no: 0 },
          preview: { text: '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: images path mismatch' },
        },
        // len=2361 sha256=9fe8686eae1fe7d2d770bce8de4f387ce1ecc6dab91e8b95e17de2612f04f9d0
        {
          score: 0.6002,
          file_id: '05d732586959ea3f480b5feb4b0d17c8',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 2285, offset_end: 4646, chunk_no: 1 },
          preview: { text: 'nimoos/file/upload", "func": "route.InitV2Router", "file": "/home/root' },
        },
      ],
    },
    {
      file_id: 'e531767d0b917dfb86ea6c8451c4bf65',
      paths: [
        {
          root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
          path: '/DATA/Containers/9f4d9086c55a06321ece3e53ddd890df5127fd5deaf0d95bb94fa223f32ffef0/9f4d9086c55a06321ece3e53ddd890df5127fd5deaf0d95bb94fa223f32ffef0-json.log',
          mtime_ms: 1784359333549,
        },
      ],
      mime: 'text/plain',
      kind: 'body',
      score: 0.5127,
      chunks: [
        // len=2336 sha256=42d31721f06f64ef9f8069a55bcddc5c65b04626541824323f3a1e3c86e299b5
        {
          score: 0.5127,
          file_id: 'e531767d0b917dfb86ea6c8451c4bf65',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 0, offset_end: 2336, chunk_no: 0 },
          preview: { text: '{"log":"/usr/share/nimoos/agent/main.py:127: DeprecationWarning: \\n","' },
        },
        // len=2379 sha256=b4139d08dd29c977da5a88972fcb26dd3e06b408a8a4371f4ccdfba4ad92571d
        {
          score: 0.5044,
          file_id: 'e531767d0b917dfb86ea6c8451c4bf65',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 2336, offset_end: 4715, chunk_no: 1 },
          preview: { text: 'stdout","time":"2026-07-16T06:37:33.686913167Z"}\n{"log":"INFO:     127' },
        },
      ],
    },
    {
      file_id: '4018267c2ec373cddb244ac220a06cc2',
      paths: [
        { root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/log/nimoos/app-management.log', mtime_ms: 1784434525914 },
      ],
      mime: 'text/plain',
      kind: 'body',
      score: 0.4824,
      chunks: [
        // len=2271 sha256=8c7d723ddcd52369cc142e7f4805ef6e54ac9549c3b1910f0cf2bf9edf04a349
        {
          score: 0.4824,
          file_id: '4018267c2ec373cddb244ac220a06cc2',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 0, offset_end: 2271, chunk_no: 0 },
          preview: { text: '2026-07-13T16:10:05.000+0800\terror\terror while updating catalog for ap' },
        },
        // len=2156 sha256=5100145d0afe36ac33e9155f6f5a3896f98c140b33418bae78d8b8d07b3ef89e
        {
          score: 0.4666,
          file_id: '4018267c2ec373cddb244ac220a06cc2',
          mime: 'text/plain',
          kind: 'body',
          cite: { page: null, offset_start: 2271, offset_end: 4427, chunk_no: 1 },
          preview: { text: 'ce/appstore_management.go", "line": 442}\n2026-07-13T16:30:01.336+0800\t' },
        },
      ],
    },
  ],
  stats: { total_candidates: 8, rerank_ms: 0, embed_ms: 345, vector_search_ms: 62, expand_ms: 4 },
  warnings: [],
}

// ─── scaffolding (following established patterns from QueueView.test.ts / FileDetailDrawer.test.ts) ───

function withPinia() {
  setActivePinia(createPinia())
  return useKnowledgeStore()
}

function makeRouter(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHashHistory('/'),
    routes: [{ path: '/ai/knowledge/search', name: 'KnowledgeSearch', component: SearchView }],
  })
  router.push({ path: '/ai/knowledge/search', query })
  return router
}

const flush = async () => {
  await flushPromises()
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

async function mountSearch(query: Record<string, string> = {}) {
  const router = makeRouter(query)
  await router.isReady()
  const w = mount(SearchView, { global: { plugins: [router, i18n] } })
  mountedWrappers.push(w)
  await flush()
  return { w, router }
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  vi.useRealTimers()
})

// ─── URL.createObjectURL/revokeObjectURL (jsdom unimplemented, `typeof` always
// `undefined`, direct assignment rather than `vi.spyOn` — spyOn requires property to exist,
// same issue as `document.execCommand`) ───
let createObjectURLMock: ReturnType<typeof vi.fn>
let revokeObjectURLMock: ReturnType<typeof vi.fn>
let blobUrlSeq = 0
// 🔴 jsdom actually attempts navigation on <a href="blob:...">.click() (internally scheduled via
// setTimeout, see `HTMLHyperlinkElementUtils-impl.js`), without mocking will asynchronously print
// "Not implemented: navigation" noise after test completes (does not affect assertion results,
// but pollutes output) — globally stub it out.
let anchorClickMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  blobUrlSeq = 0
  createObjectURLMock = vi.fn(() => `blob:mock-url-${++blobUrlSeq}`)
  revokeObjectURLMock = vi.fn()
  ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURLMock
  ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURLMock
  anchorClickMock = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  anchorClickMock.mockRestore()
})

// ─── T7 — FileVM factory (wiring/K50 cases only) ───
// 🔴 default `chunks: []` — when mounting `FileDetailDrawer`, `fetchFull()` early returns on
// `c.chunkNo == null` (see FileDetailDrawer.vue `:108`), does not call
// `store.loadChunkContext`, specifically to isolate "subcomponent wiring" itself without
// mixing in FileDetailDrawer's own data-fetching logic (that's FileDetailDrawer.test.ts's scope).
// Cases needing non-empty chunks (result card render fields) always use F5B_RESPONSE real data,
// not this factory.
function makeFileVM(overrides: Partial<FileVM> = {}): FileVM {
  return {
    id: 'file-1',
    name: 'report.pdf',
    path: '/DATA/Documents/',
    fullPath: '/DATA/Documents/report.pdf',
    kind: 'pdf',
    mime: 'application/pdf',
    mtimeMs: 1700000000000,
    score: 0.7,
    chunks: [],
    ...overrides,
  }
}

// ══════════════════════════════════════════════════════════════════════════

describe('SearchView — K44: .vue side zero <style> block', () => {
  it('File confirmed to have no <style> block at all', () => {
    const src = stripLineComments(read('./SearchView.vue'))
    expect(/<style/.test(src)).toBe(false)
  })
})

describe('SearchView — T7 scope self-proof: two subcomponents mount markup complete (blueprint :164-172)', () => {
  // At T6 stage this assertion tests "markup does not exist" (decision R25: import only, do not
  // mount). After T7 continuation writes the file and adds markup, this must flip to "markup
  // exists and all four/two listeners present" — otherwise contradicts T7 real output. History
  // of old assertion in SearchView.vue file head R25 comment (flip, not delete).
  it('Template contains <FileDetailDrawer with four listeners + <KFileViewer with two listeners, both imported', () => {
    const raw = read('./SearchView.vue')
    const src = stripLineComments(raw) // strip comments, else false positive from this file's own declaration comments
    expect(/<FileDetailDrawer[\s/>]/.test(src), 'must have <FileDetailDrawer mount markup').toBe(true)
    expect(/<KFileViewer[\s/>]/.test(src), 'must have <KFileViewer mount markup').toBe(true)
    expect(/from '\.\.\/components\/FileDetailDrawer\.vue'/.test(raw)).toBe(true)
    expect(/from '\.\.\/components\/KFileViewer\.vue'/.test(raw)).toBe(true)
    for (const ev of ['@close', '@open', '@download', '@toast']) {
      expect(src.includes(ev), `FileDetailDrawer must handle ${ev}`).toBe(true)
    }
  })
})

describe('SearchView — four render states: idle / loading / empty / error (blueprint :1-119 + :158-162)', () => {
  it('idle: title/subtitle/5 sample query chips (translated)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    expect(w.find('.k-empty-title').text()).toBe('用自然语言搜索任何东西')
    expect(w.find('.k-empty-sub').text()).toBe('输入任何自然语言，Nimo 在 NAS 上找到匹配文档。语义匹配，不只是关键词。')
    const chips = w.findAll('.k-suggest-chip')
    expect(chips.length).toBe(5)
    expect(chips[0].text()).toBe('甲状腺')
    expect(chips[4].text()).toBe('羽生结弦')
  })

  it('loading: search sent but not returned yet, skeleton screen renders 6 .k-skel-rcard', async () => {
    const store = withPinia()
    let resolveIt!: (v: unknown) => void
    vi.spyOn(store, 'runSearch').mockImplementation(
      () => new Promise((res) => { resolveIt = res }),
    )
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-result-count .k-skel').exists()).toBe(true)
    expect(w.findAll('.k-skel-rcard').length).toBe(6)
    resolveIt(F1_EMPTY)
    await flush()
  })

  it('empty: zero results (F1) → title/subtitle/3 tips', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('nonexistent-query')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-empty-title').text()).toBe('没找到相关文档')
    expect(w.find('.k-empty-sub').text()).toBe('试试这些方式：')
    expect(w.findAll('.k-empty-tip').length).toBe(3)
  })

  it('error: throw error → title fixed + subtitle is actual error message (e.message branch)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockRejectedValue(new Error('network fail'))
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-empty-title').text()).toBe('搜索失败')
    expect(w.find('.k-empty-sub').text()).toBe('network fail')
  })

  it('error: e.response.data.error takes priority over e.message', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockRejectedValue({
      response: { data: { error: 'backend says no' } },
      message: 'axios generic message',
    })
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-empty-sub').text()).toBe('backend says no')
  })

  it('error: neither response.data.error nor message → String(e)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockRejectedValue('raw string thrown')
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-empty-sub').text()).toBe('raw string thrown')
  })

  it('run() branch: empty query → idle and no request sent', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('   ')
    await input.trigger('keydown.enter')
    await flush()
    expect(spy).not.toHaveBeenCalled()
    expect(w.find('.k-empty-title').text()).toBe('用自然语言搜索任何东西') // still idle copy
  })

  it('run() branch: has results (F5b, 4 files) → phase=results, results.length/totalChunks correct' +
    ' (result card markup in T7, this task no render entry reaches this branch display, use w.vm' +
    ' to directly read top-level ref — precedent IndexedFilesView.test.ts:618-621 / AgentPage.test.ts:295)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    const vm = w.vm as unknown as { phase: string; results: unknown[]; totalChunks: number }
    expect(vm.phase).toBe('results')
    expect(vm.results.length).toBe(4)
    expect(vm.totalChunks).toBe(8)
  })
})

describe('SearchView — N37: run() failure does not clear ms (previous successful elapsed time retained)', () => {
  it('succeed once getting non-zero ms, then fail once → ms not cleared to zero', async () => {
    vi.useFakeTimers()
    const start = 1_700_000_000_000
    vi.setSystemTime(start)
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch')
    spy.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 123) // simulate 123ms elapsed
      return F1_EMPTY
    })
    spy.mockRejectedValueOnce(new Error('second call fails'))
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('first')
    await input.trigger('keydown.enter')
    await flush()
    const vm = w.vm as unknown as { ms: number; phase: string }
    expect(vm.ms).toBe(123)

    await input.setValue('second')
    await input.trigger('keydown.enter')
    await flush()
    expect(vm.phase).toBe('error')
    expect(vm.ms).toBe(123) // 🔴 N37: do not set ms in catch, no "while here clear zero"
  })
})

describe('SearchView — N38: showRerankWarn (fake clock, auto-disappear after 5000ms)', () => {
  it('warnings contains rerank_unavailable → show; advance 5000ms → disappear', async () => {
    vi.useFakeTimers()
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F11_RERANK_WARN)
    const { w } = await mountSearch()
    await w.find('.k-adv-toggle').trigger('click') // open panel, .k-rerank-warn inside
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-rerank-warn').exists()).toBe(true)
    expect(w.find('.k-rerank-warn').text()).toBe('排序质量暂不可用，已自动降级')
    vi.advanceTimersByTime(5000)
    await flush()
    expect(w.find('.k-rerank-warn').exists()).toBe(false)
  })

  it('reverse assertion: warnings non-empty but not rerank_unavailable (F4) → do not show', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F4_NO_ACCESSIBLE_ROOTS)
    const { w } = await mountSearch()
    await w.find('.k-adv-toggle').trigger('click')
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-rerank-warn').exists()).toBe(false)
  })
})

// ─── N34: advEnabled (four or branches each + full-select side one) ───

async function openAdv(w: ReturnType<typeof mount>) {
  await w.find('.k-adv-toggle').trigger('click')
}

describe('SearchView — N34: advEnabled criterion = types.size < FILE_TYPES.length (all-select=disabled, counterintuitive)', () => {
  it('full-select side: default state (all 5 types + mtime=any + quality=fast + topK=10) → disabled, do not show "· Enabled"', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    // "· Enabled" indicator is in .k-adv-toggle button itself, not gated by advOpen, can check without opening panel
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(false)
  })

  it('branch ① types.size < 5 (deselect one type) → enabled', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    await fileTypeChips[4].trigger('click') // 'code'
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').text()).toBe('· 启用')
  })

  it('branch ② mtime !== "any" → enabled', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const mtimeChips = w.findAll('.k-adv-field')[1].findAll('.k-adv-chip')
    await mtimeChips[1].trigger('click') // '1w'
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
  })

  it('branch ③ quality !== "fast" → enabled', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const qualityButtons = w.findAll('.k-adv-field')[2].findAll('button')
    await qualityButtons[1].trigger('click') // accurate
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
  })

  it('branch ④ topK !== 10 → enabled', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const topkButtons = w.findAll('.k-adv-field')[3].findAll('button')
    await topkButtons[2].trigger('click') // 20
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
  })
})

describe('SearchView — K51: toggleSet copies new Set then assigns whole, reactivity verification', () => {
  it('advEnabled immediately flips after toggle (proves reactivity really works, not dead Set reference)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    expect(fileTypeChips[4].attributes('data-on')).toBe('true')
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(false)
    await fileTypeChips[4].trigger('click')
    expect(fileTypeChips[4].attributes('data-on')).toBe('false')
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
    // click back — restore all-select, indicator disappears
    await fileTypeChips[4].trigger('click')
    expect(fileTypeChips[4].attributes('data-on')).toBe('true')
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(false)
  })
})

describe('SearchView — N35: MIME_PREFIXES verbatim, all-select not sent/deselect one type sent in declaration order', () => {
  it('all-select (default) → buildFilters does not contain mime_prefix key', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    const call = spy.mock.calls[0][0] as { filters: Record<string, unknown> }
    expect('mime_prefix' in call.filters).toBe(false)
  })

  it('deselect one type ("code") → send mime_prefix, order = types declaration order (pdf, md, doc, txt)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    await fileTypeChips[4].trigger('click') // deselect 'code' (FILE_TYPES render order 5th)
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    const call = spy.mock.calls[0][0] as { filters: { mime_prefix?: string[] } }
    // 🔴 types initial declaration order is pdf, md, doc, txt, code (blueprint :232, note doc before txt,
    // different from FILE_TYPES render order pdf/md/txt/doc/code — this is blueprint's existing fact, copied as-is).
    expect(call.filters.mime_prefix).toEqual([
      'text/markdown+docling/pdf',
      'application/pdf',
      'text/markdown',
      'text/markdown+docling/docx',
      'text/markdown+docling/pptx',
      'text/markdown+docling/xlsx',
      'text/plain',
    ])
  })

  it('🔴 do not "fill in" missing docling variants: txt only text/plain, md only text/markdown', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    // only leave 'code' (deselect pdf/md/txt/doc four types, index 0,1,2,3)
    await fileTypeChips[0].trigger('click')
    await fileTypeChips[1].trigger('click')
    await fileTypeChips[2].trigger('click')
    await fileTypeChips[3].trigger('click')
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    const call = spy.mock.calls[0][0] as { filters: { mime_prefix?: string[] } }
    expect(call.filters.mime_prefix).toEqual(['text/x-source'])
  })
})

describe('SearchView — N36: buildFilters 1w/1m/1y (fake clock, 1m=30 days/1y=365 days, not calendar)', () => {
  const NOW = 1_700_000_000_000
  const WEEK_MS = 7 * 24 * 3600 * 1000
  const MONTH_MS = 30 * 24 * 3600 * 1000
  const YEAR_MS = 365 * 24 * 3600 * 1000

  async function runWithMtime(idx: number) {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const mtimeChips = w.findAll('.k-adv-field')[1].findAll('.k-adv-chip')
    await mtimeChips[idx].trigger('click')
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    return spy.mock.calls[0][0] as { filters: { mtime_after_ms?: number } }
  }

  it('any (default) → do not send mtime_after_ms', async () => {
    const call = await runWithMtime(0)
    expect('mtime_after_ms' in call.filters).toBe(false)
  })
  it('1w → mtime_after_ms = now - 7*24*3600*1000', async () => {
    const call = await runWithMtime(1)
    expect(call.filters.mtime_after_ms).toBe(NOW - WEEK_MS)
  })
  it('1m → mtime_after_ms = now - 30*24*3600*1000 (30 days, not calendar month)', async () => {
    const call = await runWithMtime(2)
    expect(call.filters.mtime_after_ms).toBe(NOW - MONTH_MS)
  })
  it('1y → mtime_after_ms = now - 365*24*3600*1000 (365 days, not calendar year)', async () => {
    const call = await runWithMtime(3)
    expect(call.filters.mtime_after_ms).toBe(NOW - YEAR_MS)
  })
})

describe('SearchView — governance §5.2: run() stale guard (blueprint none, T7 addition, K15 family 9th)', () => {
  it('🔴 ① logic interleaved: send A (alpha, suspended) → send B (beta, immediate return) → B lands first → A lands later, final state is B\'s', async () => {
    const store = withPinia()
    let resolveA!: (v: unknown) => void
    const pA = new Promise((res) => {
      resolveA = res
    })
    const spy = vi.spyOn(store, 'runSearch')
    spy.mockImplementationOnce(() => pA as Promise<unknown>)
    spy.mockResolvedValueOnce(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('alpha')
    await input.trigger('keydown.enter') // send A (suspended)
    await input.setValue('beta')
    await input.trigger('keydown.enter') // send B (immediate return)
    await flush()
    const vm = w.vm as unknown as { phase: string; lastQuery: string; results: unknown[] }
    expect(vm.phase).toBe('results')
    expect(vm.lastQuery).toBe('beta')
    expect(vm.results.length).toBe(4)

    // A now returns — must be discarded, not allowed to overwrite B's already-landed results
    resolveA(F1_EMPTY)
    await flush()
    expect(vm.phase).toBe('results')
    expect(vm.results.length).toBe(4)
  })

  it(
    '🔴 ② two instances interleaved guard scope (criterion: runEpoch moved to module-level shared → must fail,' +
      ' see report manual RED probe — precedent FileDetailDrawer.test.ts activeId two-instance interleaved case)',
    async () => {
      const store = withPinia()
      let resolve1!: (v: unknown) => void
      const p1 = new Promise((res) => {
        resolve1 = res
      })
      const spy = vi.spyOn(store, 'runSearch')
      spy.mockImplementationOnce(() => p1 as Promise<unknown>) // instance 1 initiated (undecided)
      spy.mockResolvedValueOnce(F5B_RESPONSE) // instance 2 initiated, immediate return

      const { w: w1 } = await mountSearch()
      await w1.find('.k-search-box input').setValue('instance-1-query')
      await w1.find('.k-search-box input').trigger('keydown.enter')
      await flush()

      const { w: w2 } = await mountSearch()
      await w2.find('.k-search-box input').setValue('instance-2-query')
      await w2.find('.k-search-box input').trigger('keydown.enter')
      await flush()
      const vm2 = w2.vm as unknown as { phase: string }
      expect(vm2.phase).toBe('results')

      // instance 1's delayed response now returns — runEpoch is each instance's local closure variable,
      // should not be interfered by instance 2's run(). If runEpoch is module-level shared variable,
      // instance 1's only run() call's myEpoch will be judged "stale" because instance 2 also called
      // run(), this assertion below will fail (must fail, see report manual RED probe: temporarily move
      // runEpoch into module scope).
      resolve1(F1_EMPTY)
      await flush()
      const vm1 = w1.vm as unknown as { phase: string }
      expect(vm1.phase).toBe('empty')
    },
  )
})

describe('SearchView — N33: SAMPLE_QUERIES copied and pass t(), click chip → q becomes translation and trigger run()', () => {
  it('click first sample chip → input value becomes translation "甲状腺", and search request sent', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await w.findAll('.k-suggest-chip')[0].trigger('click')
    await flush()
    expect((w.find('.k-search-box input').element as HTMLInputElement).value).toBe('甲状腺')
    expect(spy).toHaveBeenCalledTimes(1)
    expect((spy.mock.calls[0][0] as { query: string }).query).toBe('甲状腺')
  })
})

describe('SearchView — N39: clear() also clears openFile/viewerFile (blueprint :264)', () => {
  it('clear() resets q/phase/results, and openFile/viewerFile (two refs declared this task, rendering in T7)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    const vm = w.vm as unknown as {
      phase: string
      results: unknown[]
      openFile: unknown
      viewerFile: unknown
      q: string
    }
    expect(vm.phase).toBe('results')
    // result card markup in T7, this task no clickable UI entry can set openFile/viewerFile non-empty
    // — directly read/write top-level ref to drive these states, technical precedent IndexedFilesView.test.ts:618-621.
    vm.openFile = { id: 'x', name: 'x.txt', path: '/', fullPath: '/x.txt', kind: 'txt', mime: 'text/plain', mtimeMs: 0, score: 0, chunks: [] }
    vm.viewerFile = { id: 'y', name: 'y.docx', path: '/', fullPath: '/y.docx', kind: 'doc', mime: 'text/plain', mtimeMs: 0, score: 0, chunks: [] }
    await w.find('.k-search-clear').trigger('click')
    expect(vm.q).toBe('')
    expect(vm.phase).toBe('idle')
    expect(vm.results.length).toBe(0)
    expect(vm.openFile).toBe(null)
    expect(vm.viewerFile).toBe(null)
  })
})

describe('SearchView — N40: ?q= deep link, watch (immediate:true) + condition v && v !== q', () => {
  it('① query present at mount → search immediately (immediate takes effect)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch({ q: 'deep-link-term' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect((spy.mock.calls[0][0] as { query: string }).query).toBe('deep-link-term')
    expect((w.find('.k-search-box input').element as HTMLInputElement).value).toBe('deep-link-term')
  })

  it(
    '② change query after mount → search again (🔴 criterion: downgrade to only read once in onMounted → must fail,' +
      ' memory newui-router-query-only-no-remount)',
    async () => {
      const store = withPinia()
      const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
      const { w, router } = await mountSearch() // no q at mount, zero calls
      expect(spy).not.toHaveBeenCalled()
      await router.push({ path: '/ai/knowledge/search', query: { q: 'after-mount-term' } })
      await flush()
      expect(spy).toHaveBeenCalledTimes(1)
      expect((spy.mock.calls[0][0] as { query: string }).query).toBe('after-mount-term')
      expect((w.find('.k-search-box input').element as HTMLInputElement).value).toBe('after-mount-term')
    },
  )

  it(
    '③ 🔴 do not search again when query equals current q (rewritten value must differ from initial, prevent §9.14-3' +
      ' zero discrimination trap: path is undefined → "manual" (real change, watch fires) → push same "manual" again' +
      ' (watch source unchanged, watch itself won\'t call handler again) — this tests "condition inside handler" layer,' +
      ' not "watch source unchanged" layer)',
    async () => {
      const store = withPinia()
      const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
      const { w, router } = await mountSearch() // query has no q → immediate fires but v is empty, zero calls
      expect(spy).not.toHaveBeenCalled()
      // simulate user typing directly in search box (bypassing router), make q.value become 'manual'
      await w.find('.k-search-box input').setValue('manual')
      expect(spy).not.toHaveBeenCalled() // only input, not enter/not past watch, not fired yet
      // now push router query.q to same 'manual' as current q.value — watch source from
      // undefined → 'manual' is real change, will fire handler, but inside handler
      // `v !== q.value` should be false, should not send search again.
      await router.push({ path: '/ai/knowledge/search', query: { q: 'manual' } })
      await flush()
      expect(spy).not.toHaveBeenCalled()
    },
  )
})

describe('SearchView — auto-load guard (T6 created): if template has <FileDetailDrawer, all four listeners must appear', () => {
  // 🔴 at T6 stage this walks "lazy pass" branch (markup does not exist). After T7 continuation writes
  // file and adds markup, this **now primed by markup appearing** — see `hasMarkup` branch below, assertion
  // all four listeners appear, already satisfied (see report §T5 DoD-12 evidence section). Original describe
  // name and structure preserved (flip, not delete), conditional branch itself is generic, no code changes needed,
  // just walk other branch now.
  it('template contains <FileDetailDrawer ⇒ all four listeners appear (now primed by T7 markup, satisfied)', () => {
    const src = stripLineComments(read('./SearchView.vue')) // strip comments, prevent false positive (lesson from previous describe block)
    const hasMarkup = /<FileDetailDrawer[\s/>]/.test(src)
    expect(hasMarkup, 'T7 already wrote markup, this assertion should now be true').toBe(true)
    if (!hasMarkup) {
      return
    }
    for (const ev of ['@close', '@open', '@download', '@toast']) {
      expect(src.includes(ev), `when template has <FileDetailDrawer must also handle ${ev}`).toBe(true)
    }
  })
})


// ══════════════════════════════════════════════════════════════════════════
// T7 — result card list (blueprint :121-156)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView — T7: result card render fields (blueprint :121-156, use F5B_RESPONSE)', () => {
  async function mountWithF5b() {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('deprecation')
    await input.trigger('keydown.enter')
    await flush()
    return { w, store }
  }

  it(':key=r.id · data-kind + toUpperCase() · k-match-pill title and visible text are two different keys (blueprint :135-136, not allowed to merge)', async () => {
    const { w } = await mountWithF5b()
    const cards = w.findAll('.k-rcard')
    expect(cards.length).toBe(4)
    const first = cards[0]
    // file_id='dce79e8ea5…', mime='text/plain' → kindFromMime → 'txt'
    expect(first.find('.k-rcard-tag').attributes('data-kind')).toBe('txt')
    expect(first.find('.k-rcard-tag').text()).toBe('TXT')
    const pill = first.find('.k-match-pill')
    // 🔴 title uses aiKbSrMatchTitle ('命中 {n} 段'), visible text uses aiKbSrMatchPill ('{n} 段匹配') — two different keys
    expect(pill.attributes('title')).toBe('命中 2 段')
    expect(pill.text()).toContain('2 段匹配')
  })

  it('k-rel data-level and title (contains (score*100).toFixed(0)%)', async () => {
    const { w } = await mountWithF5b()
    const first = w.findAll('.k-rcard')[0]
    const rel = first.find('.k-rel')
    // score=0.738 → relLevel >= 0.65 → 'high'
    expect(rel.attributes('data-level')).toBe('high')
    expect(rel.attributes('title')).toBe('相似度 74%')
    expect(rel.text()).toContain('高')
  })

  it('🔴 k-more-hint: chunks.length > 1 (F5B 2 chunks per file) → show, text uses chunks.length - 1', async () => {
    const { w } = await mountWithF5b()
    const first = w.findAll('.k-rcard')[0]
    expect(first.find('.k-more-hint').exists()).toBe(true)
    expect(first.find('.k-more-hint').text()).toContain('还有 1 段相关内容')
  })

  it('🔴 reverse: chunks.length === 1 (single-chunk file) → do not show k-more-hint', async () => {
    const store = withPinia()
    const singleChunkResp = {
      hits: [],
      files: [{ ...F5B_RESPONSE.files[2], chunks: [F5B_RESPONSE.files[2].chunks[0]] }],
      stats: { total_candidates: 1, rerank_ms: 0, embed_ms: 1, vector_search_ms: 1, expand_ms: 0 },
      warnings: [],
    }
    vi.spyOn(store, 'runSearch').mockResolvedValue(singleChunkResp)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.findAll('.k-rcard').length).toBe(1)
    expect(w.find('.k-more-hint').exists()).toBe(false)
  })

  it('k-rcard-meta three parts: path · modification time · indexed (aiKbStatusIndexed)', async () => {
    const { w } = await mountWithF5b()
    const first = w.findAll('.k-rcard')[0]
    const meta = first.findAll('.k-rcard-meta-item')
    expect(meta.length).toBe(3)
    expect(meta[0].text()).toContain('/DATA/Containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/') // r.path = dirname(fullPath), no filename
    expect(meta[1].text()).toContain('修改时间')
    expect(meta[2].text()).toContain('已收录')
  })

  it('click result card → openFile = r (blueprint :128 @click="openFile = r")', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue({ chunks: [], anchor_chunk_no: 0 })
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    await w.findAll('.k-rcard')[0].trigger('click')
    await flush()
    const vm = w.vm as unknown as { openFile: FileVM | null }
    expect(vm.openFile?.id).toBe('dce79e8ea5d48719cd4ad16fe48da843')
  })

  it('🔴 blueprint :142 empty array fallback: r.chunks[0] && r.chunks[0].snippet — files with zero chunks must not throw', async () => {
    const store = withPinia()
    const zeroChunkResp = {
      hits: [],
      files: [
        {
          file_id: 'zero-chunk-file',
          mime: 'text/plain',
          kind: 'body',
          score: 0.5,
          paths: [{ path: '/DATA/empty.txt', mtime_ms: 1700000000000 }],
          chunks: [], // .CONSTRUCTED — constructed specifically to verify empty array fallback, not real device sample
        },
      ],
      stats: { total_candidates: 0, rerank_ms: 0, embed_ms: 0, vector_search_ms: 0, expand_ms: 0 },
      warnings: [],
    }
    vi.spyOn(store, 'runSearch').mockResolvedValue(zeroChunkResp)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.findAll('.k-rcard').length).toBe(1)
    expect(w.find('.k-rcard-snippet').exists()).toBe(true)
    expect(w.find('.k-rcard-snippet').html()).not.toContain('undefined')
    expect(w.find('.k-more-hint').exists()).toBe(false)
  })
})

describe('SearchView — T7: K49 result card v-html injection case (.k-rcard-snippet)', () => {
  it('🔴 feed snippet with <script> → rendered DOM querySelector("script") is null, <mark> still there', async () => {
    const store = withPinia()
    // .CONSTRUCTED — snippet constructed specifically for XSS injection verification, shape from F5B_RESPONSE
    // but body replaced with attack sample containing <script>, not real device data. highlight()'s escaping
    // already tested in searchAggregate.test.ts (K49), here supplement real DOM assertion after component-level v-html rendering.
    const evilResp = {
      hits: [],
      files: [
        {
          ...F5B_RESPONSE.files[0],
          chunks: [
            {
              ...F5B_RESPONSE.files[0].chunks[0],
              preview: { text: '<script>alert(1)</script> hello world' },
            },
          ],
        },
      ],
      stats: F5B_RESPONSE.stats,
      warnings: [],
    }
    vi.spyOn(store, 'runSearch').mockResolvedValue(evilResp)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('hello')
    await input.trigger('keydown.enter')
    await flush()
    const snippet = w.find('.k-rcard-snippet')
    expect(snippet.find('script').exists()).toBe(false)
    expect(snippet.html()).toContain('&lt;script&gt;')
    expect(snippet.find('mark').exists()).toBe(true)
  })
})

describe('SearchView — T7: k-result-count (blueprint :122-127)', () => {
  it('results.length / totalChunks / lastQuery rendered correctly', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('deprecation')
    await input.trigger('keydown.enter')
    await flush()
    const text = w.find('.k-result-count').text()
    expect(text).toContain('4')
    expect(text).toContain('8')
    expect(text).toContain('deprecation')
  })

  it('🔴 when ms === 0 do not render " · N ms" (blueprint :125 v-if="ms", falsy not rendered)', async () => {
    vi.useFakeTimers()
    const store = withPinia()
    // mock immediate resolve, system clock not advanced → Date.now() - t0 === 0
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-result-count').text()).not.toMatch(/\d+ ms/)
  })

  it('when ms non-zero render " · N ms"', async () => {
    vi.useFakeTimers()
    const start = 1_700_000_000_000
    vi.setSystemTime(start)
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockImplementation(async () => {
      vi.setSystemTime(start + 456)
      return F5B_RESPONSE
    })
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-result-count').text()).toContain('456 ms')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// T7 — K50/decision R1 "Option A": fetchBlobUrl four self-proofs (first review must-check item)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView — T7: K50/decision R1 (Option A) — fetchBlobUrl self-proof', () => {
  function openOriginalOf(w: ReturnType<typeof mount>) {
    return (w.vm as unknown as { openOriginal: (payload: { file: FileVM }) => Promise<void> }).openOriginal
  }
  function downloadFileOf(w: ReturnType<typeof mount>) {
    return (w.vm as unknown as { downloadFile: (file: FileVM) => Promise<void> }).downloadFile
  }

  async function mountBasic() {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    return mountSearch()
  }

  it('① 🔴 responseType hard assertion: getHttp().get second parameter exactly { responseType: "blob" } (criterion: change to arraybuffer → fail, see report RED probe)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const { w } = await mountBasic()
    await downloadFileOf(w)(makeFileVM({ fullPath: '/DATA/a.txt' }))
    await flush()
    expect(httpGet).toHaveBeenCalledTimes(1)
    expect(httpGet.mock.calls[0][1]).toEqual({ responseType: 'blob' })
  })

  it('② 🔴 window.open opens blob: address from URL.createObjectURL(), does not contain token= (criterion: change to directly open fileUrl() → fail, see report RED probe)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w } = await mountBasic()
    await openOriginalOf(w)({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(openSpy).toHaveBeenCalledTimes(1)
    const [openedUrl] = openSpy.mock.calls[0]
    expect(String(openedUrl)).toMatch(/^blob:/)
    expect(String(openedUrl)).not.toContain('token=')
    openSpy.mockRestore()
  })

  it('③ service.file.fileUrl() return value (contains token) only used as URL for that XHR, not directly given to window.open — fileUrl mock still called (for sending that request), but visible open parameter is blob', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w } = await mountBasic()
    await openOriginalOf(w)({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(fileUrl).toHaveBeenCalledWith('/DATA/a.pdf')
    const [xhrUrl] = httpGet.mock.calls[0]
    expect(String(xhrUrl)).toContain('token=TEST_TOKEN_ABC') // that XHR's URL contains token, as expected
    const [openedUrl] = openSpy.mock.calls[0]
    expect(String(openedUrl)).not.toContain('token=') // but window.open receives without token
    openSpy.mockRestore()
  })

  it('④ inline:true → URL contains &inline=1; downloadFile (no inline) → URL does not contain inline (two conditions)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w } = await mountBasic()
    await openOriginalOf(w)({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(String(httpGet.mock.calls[0][0])).toContain('&inline=1')
    httpGet.mockClear()
    await downloadFileOf(w)(makeFileVM({ fullPath: '/DATA/b.pdf' }))
    await flush()
    expect(String(httpGet.mock.calls[0][0])).not.toContain('inline')
    openSpy.mockRestore()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// T7 — openOriginal three routing branches (blueprint :361-380)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView — T7: openOriginal three routing branches (blueprint :361-380)', () => {
  function openOriginalOf(w: ReturnType<typeof mount>) {
    return (w.vm as unknown as { openOriginal: (payload: { file: FileVM }) => Promise<void>; viewerFile: FileVM | null }) as {
      openOriginal: (payload: { file: FileVM }) => Promise<void>
      viewerFile: FileVM | null
    }
  }
  async function mountBasic() {
    const store = withPinia()
    const toastSpy = vi.spyOn(store, 'toast')
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    return { w, toastSpy }
  }

  it('ext ∈ {docx,wps,xls,xlsx,csv} → set viewerFile, no request sent (criterion: getHttp mock zero calls)', async () => {
    const { w } = await mountBasic()
    const file = makeFileVM({ name: 'sheet.xlsx' })
    await openOriginalOf(w).openOriginal({ file })
    await flush()
    expect(openOriginalOf(w).viewerFile).toEqual(file)
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('ext ∈ {doc,ppt,pptx} → toast "该格式暂不支持预览，请下载查看", no request sent', async () => {
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'slides.ppt' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('该格式暂不支持预览，请下载查看')
    expect(httpGet).not.toHaveBeenCalled()
    expect(openOriginalOf(w).viewerFile).toBe(null)
  })

  it('other ext → fetchBlobUrl (inline:true) + window.open (url, "_blank", "noopener,noreferrer")', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0][1]).toBe('_blank')
    expect(openSpy.mock.calls[0][2]).toBe('noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('🔴 window.open returns null (popup blocked) → toast "浏览器拦截了新窗口"', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('浏览器拦截了新窗口')
    openSpy.mockRestore()
  })

  it('🔴 setTimeout (revokeObjectURL, 60000) (fake clock)', async () => {
    vi.useFakeTimers()
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60000)
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    openSpy.mockRestore()
  })

  it('!file.fullPath → toast "文件路径缺失", no request sent', async () => {
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ fullPath: '' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('文件路径缺失')
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('throw error → toast "打开失败: <msg>"', async () => {
    httpGet.mockRejectedValue(new Error('network down'))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('打开失败: network down')
    openSpy.mockRestore()
  })

  it('🔴 ext extracts whole name as ext: filename exactly "docx" (no extension) → misclassifies as in-app previewable format (copied blueprint existing quirk)', async () => {
    const { w } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'docx' }) })
    await flush()
    expect(openOriginalOf(w).viewerFile?.name).toBe('docx')
    expect(httpGet).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// T7 — downloadFile (blueprint :382-397)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView — T7: downloadFile (blueprint :382-397)', () => {
  function downloadFileOf(w: ReturnType<typeof mount>) {
    return (w.vm as unknown as { downloadFile: (file: FileVM) => Promise<void> }).downloadFile
  }
  async function mountBasic() {
    const store = withPinia()
    const toastSpy = vi.spyOn(store, 'toast')
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    return { w, toastSpy }
  }

  it('🔴 success: create <a download> → appendChild → click → removeChild (same element) → revoke after 60s', async () => {
    vi.useFakeTimers()
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const { w } = await mountBasic()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    await downloadFileOf(w)(makeFileVM({ name: 'report.pdf', fullPath: '/DATA/report.pdf' }))
    await flush()
    expect(appendSpy).toHaveBeenCalledTimes(1)
    const a = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(a.tagName).toBe('A')
    expect(a.download).toBe('report.pdf')
    expect(a.rel).toBe('noopener noreferrer')
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    // 🔴 removeChild truly called, and same element (else DOM leak)
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy.mock.calls[0][0]).toBe(a)
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60000)
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('🔴 a.download fallback: file.name empty → "download"', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const { w } = await mountBasic()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    await downloadFileOf(w)(makeFileVM({ name: '', fullPath: '/DATA/x' }))
    await flush()
    const a = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(a.download).toBe('download')
    appendSpy.mockRestore()
  })

  it('!file.fullPath → toast "文件路径缺失", no request sent', async () => {
    const { w, toastSpy } = await mountBasic()
    await downloadFileOf(w)(makeFileVM({ fullPath: '' }))
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('文件路径缺失')
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('throw error → toast "下载失败: <msg>"', async () => {
    httpGet.mockRejectedValue(new Error('disk full'))
    const { w, toastSpy } = await mountBasic()
    await downloadFileOf(w)(makeFileVM({ fullPath: '/DATA/x' }))
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('下载失败: disk full')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// T7 — two subcomponents mount wiring (blueprint :164-172)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView — T7: FileDetailDrawer all four listeners wired (blueprint :164-168)', () => {
  async function mountWithOpenFile(fileOverrides: Partial<FileVM> = {}) {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const toastSpy = vi.spyOn(store, 'toast')
    const { w } = await mountSearch()
    const vm = w.vm as unknown as { openFile: FileVM | null; viewerFile: FileVM | null }
    vm.openFile = makeFileVM(fileOverrides)
    await flush()
    return { w, vm, toastSpy }
  }

  it('after mount pass :file/:query correct (query = lastQuery)', async () => {
    const { w, vm } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    expect(drawer.exists()).toBe(true)
    expect(drawer.props('file')).toEqual(vm.openFile)
    expect(drawer.props('query')).toBe('')
  })

  it('@close → openFile = null', async () => {
    const { w, vm } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('close')
    await flush()
    expect(vm.openFile).toBe(null)
  })

  it('@open → call openOriginal (forwarded file determines routing branch, use office ext here to verify lands in viewerFile)', async () => {
    const { w, vm } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('open', { file: makeFileVM({ name: 'sheet.xlsx' }) })
    await flush()
    expect(vm.viewerFile?.name).toBe('sheet.xlsx')
  })

  it('@download → call downloadFile (trigger fetchBlobUrl, proves same function)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['x']) })
    const { w } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('download', makeFileVM({ fullPath: '/DATA/dl.txt' }))
    await flush()
    expect(fileUrl).toHaveBeenCalledWith('/DATA/dl.txt')
    expect(httpGet).toHaveBeenCalledTimes(1)
  })

  it('🔴 @toast → forward to store.toast (K3, not call global useToast directly)', async () => {
    const { w, toastSpy } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('toast', '已复制')
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('已复制')
  })
})

describe('SearchView — T7: KFileViewer two listeners wired (blueprint :170-172)', () => {
  async function mountWithViewerFile(fileOverrides: Partial<FileVM> = {}) {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const vm = w.vm as unknown as { viewerFile: FileVM | null }
    // use extension not in VIEWER_MAP → KFileViewer walks fallback branch, does not mount real
    // DocViewer/ExcelViewer (avoid known @vue-office crash in jsdom, §9.12 same family).
    vm.viewerFile = makeFileVM({ name: 'weird.xyz', ...fileOverrides })
    await flush()
    return { w, vm }
  }

  it('after mount pass :file correct, walk fallback branch (unknown extension)', async () => {
    const { w, vm } = await mountWithViewerFile()
    const viewer = w.findComponent(KFileViewer)
    expect(viewer.exists()).toBe(true)
    expect(viewer.props('file')).toEqual(vm.viewerFile)
    expect(w.find('.k-fileviewer-fallback').exists()).toBe(true)
  })

  it('@close → viewerFile = null', async () => {
    const { w, vm } = await mountWithViewerFile()
    const viewer = w.findComponent(KFileViewer)
    viewer.vm.$emit('close')
    await flush()
    expect(vm.viewerFile).toBe(null)
  })

  it('@download → call downloadFile (reuse same function as FileDetailDrawer)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['x']) })
    const { w } = await mountWithViewerFile()
    const viewer = w.findComponent(KFileViewer)
    viewer.vm.$emit('download', makeFileVM({ fullPath: '/DATA/weird.xyz' }))
    await flush()
    expect(fileUrl).toHaveBeenCalledWith('/DATA/weird.xyz')
    expect(httpGet).toHaveBeenCalledTimes(1)
  })
})

describe('SearchView — T7: two subcomponents can mount simultaneously + N41 (Esc closes both)', () => {
  it('🔴 openFile and viewerFile both non-empty → both subcomponents render; press Esc → close both (blueprint existing behavior, no stopPropagation)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const vm = w.vm as unknown as { openFile: FileVM | null; viewerFile: FileVM | null }
    vm.openFile = makeFileVM({ id: 'a', chunks: [] })
    vm.viewerFile = makeFileVM({ id: 'b', name: 'weird.xyz', chunks: [] })
    await flush()
    expect(w.findComponent(FileDetailDrawer).exists()).toBe(true)
    expect(w.findComponent(KFileViewer).exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flush()
    expect(vm.openFile).toBe(null)
    expect(vm.viewerFile).toBe(null)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 debt I-1 (P5e final review Important-1) hole-fill block
//
// P5e final review testing: `runSearch` two parameters `topK` / `rerank` have **zero guards**
// in this file — reversing `rerank`, hardcoding `topK` to 10, all 4254 tests green (final review
// probes F1/F2 each `3125/3125 green`), but SearchView result half-section on this machine
// **unreachable on real device** (governance §0.3) ⇒ **test guards are the only defense line**.
//
// 🔴 this block **only adds assertions, zero product code change** — `SearchView.vue:220-225`
// `topK: topK.value` / `rerank: quality.value === 'accurate'` verified word-for-word in P5e
// final review as **correct** (blueprint `bp-SearchView.vue:301-302`), this is pure coverage
// gap, not defect.
//
// input parameter true sources (this task re-read `SearchView.vue` to confirm, not copied from brief):
//   `topK`   ← `const topK = ref(10)` (`:108`), advanced panel 4th `.k-adv-field`
//              four buttons `[5, 10, 20, 50]` assign directly → pass unchanged to `runSearch`.
//   `rerank` ← `const quality = ref<'fast' | 'accurate'>('fast')` (`:107`),
//              3rd `.k-adv-field` two buttons; passes **boolean** `quality === 'accurate'`
//              (not string) — `fast → false`, `accurate → true`.
//
// criteria (RED probe):
//   ① reverse `rerank` to `quality.value !== 'accurate'` → this block must fail;
//   ② hardcode `topK` to `topK: 10` → this block must fail.
// ═══════════════════════════════════════════════════════════════════════════

describe('SearchView — debt I-1: runSearch topK / rerank two inputs must truly come from component state', () => {
  /** open advanced panel, execute one search, return first call's arguments to `store.runSearch`. */
  async function runAndCapture(
    pick: (w: ReturnType<typeof mount>) => Promise<void>,
  ): Promise<{ topK: number; rerank: boolean }> {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    await pick(w)
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(spy).toHaveBeenCalledTimes(1)
    return spy.mock.calls[0][0] as unknown as { topK: number; rerank: boolean }
  }

  // ─── rerank: compare both sides (governance §9 "state property assertions compare both sides") ───
  // flip probe to fail, must pin both directions: only pinning accurate→true, write criterion as
  // constant `true` still passes; only pinning fast→false same logic.
  it('quality="fast" (default) → rerank === false (boolean false, not "fast"/undefined)', async () => {
    const call = await runAndCapture(async () => {})
    expect(call.rerank).toBe(false)
  })

  it('🔴 quality="accurate" → rerank === true (flip → fail)', async () => {
    const call = await runAndCapture(async (w) => {
      const qualityButtons = w.findAll('.k-adv-field')[2].findAll('button')
      // first confirm this button truly renders as clickable on this machine (governance §13-1)
      expect(qualityButtons.length).toBe(2)
      expect(qualityButtons[1].attributes('data-on')).toBe('false')
      await qualityButtons[1].trigger('click')
      expect(qualityButtons[1].attributes('data-on')).toBe('true')
    })
    expect(call.rerank).toBe(true)
  })

  // ─── topK: pin each of four tiers (hardcode to 10, 5/20/50 three must fail) ───
  const TOPK_BUTTONS = [5, 10, 20, 50] as const

  it('default (no tier clicked) → topK === 10', async () => {
    const call = await runAndCapture(async () => {})
    expect(call.topK).toBe(10)
  })

  for (let idx = 0; idx < TOPK_BUTTONS.length; idx++) {
    const n = TOPK_BUTTONS[idx]
    it(`🔴 click tier ${idx + 1} (${n}) → topK === ${n} (hardcode to 10, non-10 three tiers must fail)`, async () => {
      const call = await runAndCapture(async (w) => {
        const topkButtons = w.findAll('.k-adv-field')[3].findAll('button')
        // empty-loop guard: four buttons must truly render, else this case has zero discrimination
        expect(topkButtons.length).toBe(TOPK_BUTTONS.length)
        expect(topkButtons[idx].text()).toBe(String(n))
        await topkButtons[idx].trigger('click')
        expect(topkButtons[idx].attributes('data-on')).toBe('true')
      })
      expect(call.topK).toBe(n)
      // type also pinned: blueprint passes number, not string from button
      expect(typeof call.topK).toBe('number')
    })
  }

  it('🔴 both inputs non-default simultaneously → one call has topK and rerank each independently correct (prevent "one crossed")', async () => {
    const call = await runAndCapture(async (w) => {
      await w.findAll('.k-adv-field')[2].findAll('button')[1].trigger('click') // accurate
      await w.findAll('.k-adv-field')[3].findAll('button')[3].trigger('click') // 50
    })
    expect(call.topK).toBe(50)
    expect(call.rerank).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════
// Album-asset hits render as photo cards (2026-08-15, landed as Plan B after the user reported
// from real hardware that "the third result shows Untitled with no path")
//
// Data source: the raw row the user pasted back from real hardware (`file_id: photos:b615bb4a-…`,
// `mime: video/mp4`, `kind: caption`, `paths: null`, `preview.text` is a VLM-generated
// description of the frame). Background and the three candidate fixes are recorded at the end of
// `acceptance-handoff/09-clicksheet-p5e-search.md`.
// ══════════════════════════════════════════════════════════════════════════
describe('SearchView — album-asset hits render as photo cards', () => {
  const PHOTO_RESPONSE = {
    files: [
      {
        file_id: 'photos:b615bb4a-5397-4113-b524-0c574d0fa46e',
        mime: 'video/mp4',
        kind: 'caption',
        score: 0.5724284648895264,
        paths: null,
        chunks: [
          {
            file_id: 'photos:b615bb4a-5397-4113-b524-0c574d0fa46e',
            kind: 'caption',
            score: 0.5724284648895264,
            cite: { page: null, chunk_no: 0, offset_start: 0, offset_end: 418 },
            preview: { text: 'This image is a slide from an educational presentation' },
          },
        ],
      },
    ],
    hits: [],
    stats: {},
    warnings: [],
  }

  async function mountWithPhoto() {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(PHOTO_RESPONSE)
    const { w, router } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('reinforcement learning')
    await input.trigger('keydown.enter')
    await flush()
    return { w, store, router }
  }

  it('renders a thumbnail <img> whose src points at the Photos thumbnail endpoint', async () => {
    const { w } = await mountWithPhoto()
    const thumb = w.find('.k-rcard-thumb')
    expect(thumb.exists()).toBe(true)
    expect(thumb.attributes('src')).toBe(
      '/v1/photos/assets/b615bb4a-5397-4113-b524-0c574d0fa46e/thumbnail?size=small',
    )
  })

  it('no longer shows (Untitled): the title falls back to the album-asset copy', async () => {
    const { w } = await mountWithPhoto()
    const name = w.find('.k-rcard-name').text()
    expect(name).not.toBe(i18n.global.t('aiKbSrUntitled'))
  })

  it('clicking a photo card opens the asset drawer in place — no navigation, no file drawer', async () => {
    const { w, router } = await mountWithPhoto()
    router.addRoute({ path: '/photos', name: 'photos', component: { template: '<div />' } })
    await w.find('.k-rcard').trigger('click')
    await flush()
    expect(router.currentRoute.value.path).toBe('/ai/knowledge/search')
    expect(w.findComponent(AssetDetailDrawer).exists()).toBe(true)
    // The file drawer is for hits that have chunks to page through; an album asset must not land in it.
    expect(w.findComponent(FileDetailDrawer).exists()).toBe(false)
  })

  it('"Open in Photos" inside the drawer is what deep-links to #/photos?asset=<id>, and closes the drawer', async () => {
    const { w, router } = await mountWithPhoto()
    router.addRoute({ path: '/photos', name: 'photos', component: { template: '<div />' } })
    await w.find('.k-rcard').trigger('click')
    await flush()
    await w.find('.k-asset-open-photos').trigger('click')
    await flush()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query.asset).toBe('b615bb4a-5397-4113-b524-0c574d0fa46e')
    expect(w.findComponent(AssetDetailDrawer).exists()).toBe(false)
  })

  it('the drawer collapses on close and the result list is still there', async () => {
    const { w } = await mountWithPhoto()
    await w.find('.k-rcard').trigger('click')
    await flush()
    await w.find('.k-drawer-back').trigger('click')
    await flush()
    expect(w.findComponent(AssetDetailDrawer).exists()).toBe(false)
    expect(w.findAll('.k-rcard').length).toBe(1)
  })

  it('with a path resolved by Photos the card shows the real file name and folder', async () => {
    const store = withPinia()
    const withPath = {
      ...PHOTO_RESPONSE,
      files: [{ ...PHOTO_RESPONSE.files[0], paths: [{ root_id: 'photos', path: '/media/RAID_raid10/知识库/肝疾病1.mp4', mtime_ms: 1784600000000 }] }],
    }
    vi.spyOn(store, 'runSearch').mockResolvedValue(withPath)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('liver')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-rcard-name').text()).toBe('肝疾病1.mp4')
    const meta = w.findAll('.k-rcard-meta-item')
    expect(meta.length).toBe(2)
    expect(meta[0].text()).toBe('/media/RAID_raid10/知识库/')
  })

  it('the meta row swaps the path + mtime items for one photo-library locator', async () => {
    const { w } = await mountWithPhoto()
    const meta = w.findAll('.k-rcard-meta-item')
    // Two items, not three: an album asset has no path and no mtime, so rendering them would
    // give a bare folder icon plus "Modified —".
    expect(meta.length).toBe(2)
    expect(meta[0].text()).toBe(i18n.global.t('aiKbSrPhotoLibrary'))
    expect(meta[1].text()).toContain(i18n.global.t('aiKbStatusIndexed'))
    expect(w.find('.k-rcard-meta').text()).not.toContain(i18n.global.t('aiKbSrModified'))
  })

  it('a thumbnail that fails to load leaves a bare paper chip, not a broken image', async () => {
    const { w } = await mountWithPhoto()
    await w.find('.k-rcard-thumb').trigger('error')
    await flush()
    expect(w.find('.k-rcard-thumb').exists()).toBe(false)
    expect(w.find('.k-rcard-icon').exists()).toBe(true)
    // Not the kind chip either: kindFromMime only knows document kinds, so `video/mp4` would
    // read DOC. The card name already says Photo/Video.
    expect(w.find('.k-rcard-tag').exists()).toBe(false)
  })

  it('a plain file hit renders no thumbnail (existing cards untouched)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('deprecation')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-rcard-thumb').exists()).toBe(false)
  })
})
