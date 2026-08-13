// SP8-P5e Task 6+7 — `SearchView.vue` unit tests (T6: search box + advanced panel + `run()` +
// four states; T7 continuation: result card list + two subcomponents wiring + `fetchBlobUrl`/
// `openOriginal`/`downloadFile`/`onDrawerToast`). Blueprint `NimoOS-UI@7a6ee6b7`
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
//   F1  — REAL, `.superpowers/sdd/p5e-fixtures/F1-search-text.empty.REAL.json`,
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
          path: '/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log',
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
          path: '/DATA/.system_data/.docker/containers/9f4d9086c55a06321ece3e53ddd890df5127fd5deaf0d95bb94fa223f32ffef0/9f4d9086c55a06321ece3e53ddd890df5127fd5deaf0d95bb94fa223f32ffef0-json.log',
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
    history: createWebHashHistory('/app/'),
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

// ─── T7 — URL.createObjectURL/revokeObjectURL (jsdom unimplemented, `typeof` always
// `undefined`, direct assignment rather than `vi.spyOn` — spyOn requires property to exist,
// see T5 report for same issue with `document.execCommand`) ───
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

// ─── T7 —— FileVM 工厂(wiring/K50 用例专用)───
// 🔴 默认 `chunks: []` —— 这样挂载 `FileDetailDrawer` 时 `fetchFull()` 在
// `c.chunkNo == null` 早退(见 FileDetailDrawer.vue `:108`),不会调用
// `store.loadChunkContext`,专门用来隔离"子组件接线"这件事本身,不牵连
// FileDetailDrawer 自己的取数逻辑(那是 FileDetailDrawer.test.ts 的范围)。
// 需要非空 chunks 的用例(结果卡渲染字段)一律用 F5B_RESPONSE 真实数据,不用这个工厂。
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

describe('SearchView —— K44:.vue 侧零 <style> 块', () => {
  it('文件内确认无任何 <style> 块', () => {
    const src = stripLineComments(read('./SearchView.vue'))
    expect(/<style/.test(src)).toBe(false)
  })
})

describe('SearchView —— T7 范围自证:两个子组件挂载 markup 齐全(蓝本 :164-172)', () => {
  // T6 阶段这条断言的是"markup 不存在"(裁定 R25:只 import,不挂载)。T7 续写本文件、
  // 补上 markup 后,这条必须反转成"markup 存在且四/两个监听齐全"——否则会与 T7
  // 的真实产出矛盾。旧断言的历史见 SearchView.vue 文件头 R25 注释(反转不删)。
  it('模板含 <FileDetailDrawer 四个监听 + <KFileViewer 两个监听,两者均已 import', () => {
    const raw = read('./SearchView.vue')
    const src = stripLineComments(raw) // 剥注释,否则会被本文件自己的申报注释假阳性命中
    expect(/<FileDetailDrawer[\s/>]/.test(src), '必须出现 <FileDetailDrawer 挂载 markup').toBe(true)
    expect(/<KFileViewer[\s/>]/.test(src), '必须出现 <KFileViewer 挂载 markup').toBe(true)
    expect(/from '\.\.\/components\/FileDetailDrawer\.vue'/.test(raw)).toBe(true)
    expect(/from '\.\.\/components\/KFileViewer\.vue'/.test(raw)).toBe(true)
    for (const ev of ['@close', '@open', '@download', '@toast']) {
      expect(src.includes(ev), `FileDetailDrawer 必须接 ${ev}`).toBe(true)
    }
  })
})

describe('SearchView —— 渲染四态:idle / loading / empty / error(蓝本 :1-119 + :158-162)', () => {
  it('idle:标题/副标题/5 个示例查询 chip(译文)', async () => {
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

  it('loading:搜索发出但未回时,骨架屏渲染 6 张 .k-skel-rcard', async () => {
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

  it('empty:零结果(F1)→ 标题/副标题/3 条提示', async () => {
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

  it('error:抛错 → 标题固定 + 副标题是真实错误信息(e.message 分支)', async () => {
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

  it('error:e.response.data.error 优先于 e.message', async () => {
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

  it('error:既无 response.data.error 也无 message → String(e)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockRejectedValue('raw string thrown')
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-empty-sub').text()).toBe('raw string thrown')
  })

  it('run() 分支:空 query → idle 且不发请求', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('   ')
    await input.trigger('keydown.enter')
    await flush()
    expect(spy).not.toHaveBeenCalled()
    expect(w.find('.k-empty-title').text()).toBe('用自然语言搜索任何东西') // 仍是 idle 文案
  })

  it('run() 分支:有结果(F5b,4 文件)→ phase=results,results.length/totalChunks 正确' +
    '(结果卡 markup 归 T7,本刀无渲染入口到达这个分支的显示,用 w.vm 直读顶层 ref——' +
    '先例 IndexedFilesView.test.ts:618-621 / AgentPage.test.ts:295)', async () => {
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

describe('SearchView —— N37:run() 失败不清 ms(上一次成功的耗时保留)', () => {
  it('先成功拿到非零 ms,再失败一次 → ms 不被清零', async () => {
    vi.useFakeTimers()
    const start = 1_700_000_000_000
    vi.setSystemTime(start)
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch')
    spy.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 123) // 模拟耗时 123ms
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
    expect(vm.ms).toBe(123) // 🔴 N37:catch 里不设 ms,不许"顺手清零"
  })
})

describe('SearchView —— N38:showRerankWarn(假时钟,5000ms 后自动消失)', () => {
  it('warnings 含 rerank_unavailable → 显示;推进 5000ms → 消失', async () => {
    vi.useFakeTimers()
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F11_RERANK_WARN)
    const { w } = await mountSearch()
    await w.find('.k-adv-toggle').trigger('click') // 打开面板,.k-rerank-warn 在面板内
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

  it('反向断言:warnings 非空但不含 rerank_unavailable(F4)→ 不显示', async () => {
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

// ─── N34:advEnabled(四个 or 分支各一条 + 全选侧一条)───

async function openAdv(w: ReturnType<typeof mount>) {
  await w.find('.k-adv-toggle').trigger('click')
}

describe('SearchView —— N34:advEnabled 判据 = types.size < FILE_TYPES.length(全选=未启用,反直觉)', () => {
  it('全选侧:默认状态(全 5 类 + mtime=any + quality=fast + topK=10)→ 未启用,不显示"· 启用"', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    // "· 启用" 指示器在 .k-adv-toggle 按钮本身里,不受 advOpen 门控,不需要打开面板即可查
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(false)
  })

  it('分支① types.size < 5(取消一类)→ 启用', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    await fileTypeChips[4].trigger('click') // 'code'
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').text()).toBe('· 启用')
  })

  it('分支② mtime !== "any" → 启用', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const mtimeChips = w.findAll('.k-adv-field')[1].findAll('.k-adv-chip')
    await mtimeChips[1].trigger('click') // '1w'
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
  })

  it('分支③ quality !== "fast" → 启用', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const qualityButtons = w.findAll('.k-adv-field')[2].findAll('button')
    await qualityButtons[1].trigger('click') // accurate
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
  })

  it('分支④ topK !== 10 → 启用', async () => {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const topkButtons = w.findAll('.k-adv-field')[3].findAll('button')
    await topkButtons[2].trigger('click') // 20
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(true)
  })
})

describe('SearchView —— K51:toggleSet 复制新 Set 再整体赋值,响应性验证', () => {
  it('toggle 后 advEnabled 立即跟着翻转(证明响应性真的通了,不是死 Set 引用)', async () => {
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
    // 再点回去 —— 恢复全选,指示器消失
    await fileTypeChips[4].trigger('click')
    expect(fileTypeChips[4].attributes('data-on')).toBe('true')
    expect(w.find('.k-adv-toggle span[style*="var(--accent)"]').exists()).toBe(false)
  })
})

describe('SearchView —— N35:MIME_PREFIXES 逐字,全选不发/取消一类按声明顺序发', () => {
  it('全选(默认)→ buildFilters 不含 mime_prefix 键', async () => {
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

  it('取消一类("code")→ 发 mime_prefix,顺序 = types 声明顺序(pdf, md, doc, txt)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    await fileTypeChips[4].trigger('click') // 取消 'code'(FILE_TYPES 渲染顺序第 5 个)
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    const call = spy.mock.calls[0][0] as { filters: { mime_prefix?: string[] } }
    // 🔴 types 初值声明顺序是 pdf, md, doc, txt, code(蓝本 :232,注意 doc 在 txt 之前,
    // 与 FILE_TYPES 的渲染顺序 pdf/md/txt/doc/code 不同——这是蓝本本身的既有事实,照抄）。
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

  it('🔴 不许"补全"缺的 docling 变体:txt 只有 text/plain,md 只有 text/markdown', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    await openAdv(w)
    const fileTypeChips = w.findAll('.k-adv-field')[0].findAll('.k-adv-chip')
    // 只留 'code'(取消 pdf/md/txt/doc 四类,index 0,1,2,3)
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

describe('SearchView —— N36:buildFilters 的 1w/1m/1y(假时钟,1m=30 天/1y=365 天,非日历)', () => {
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

  it('any(默认)→ 不发 mtime_after_ms', async () => {
    const call = await runWithMtime(0)
    expect('mtime_after_ms' in call.filters).toBe(false)
  })
  it('1w → mtime_after_ms = now - 7*24*3600*1000', async () => {
    const call = await runWithMtime(1)
    expect(call.filters.mtime_after_ms).toBe(NOW - WEEK_MS)
  })
  it('1m → mtime_after_ms = now - 30*24*3600*1000(30 天,非日历月)', async () => {
    const call = await runWithMtime(2)
    expect(call.filters.mtime_after_ms).toBe(NOW - MONTH_MS)
  })
  it('1y → mtime_after_ms = now - 365*24*3600*1000(365 天,非日历年)', async () => {
    const call = await runWithMtime(3)
    expect(call.filters.mtime_after_ms).toBe(NOW - YEAR_MS)
  })
})

describe('SearchView —— 治理 §5.2:run() 过期守卫(蓝本无,本期新增,K15 同族第 9 次)', () => {
  it('🔴 ① 逻辑交错:发 A(alpha,挂起)→ 发 B(beta,立即回)→ B 先落地 → A 后落地,最终状态是 B 的', async () => {
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
    await input.trigger('keydown.enter') // 发 A(挂起)
    await input.setValue('beta')
    await input.trigger('keydown.enter') // 发 B(立即回)
    await flush()
    const vm = w.vm as unknown as { phase: string; lastQuery: string; results: unknown[] }
    expect(vm.phase).toBe('results')
    expect(vm.lastQuery).toBe('beta')
    expect(vm.results.length).toBe(4)

    // A 现在才回 —— 必须被丢弃,不许覆盖 B 已经落地的结果
    resolveA(F1_EMPTY)
    await flush()
    expect(vm.phase).toBe('results')
    expect(vm.results.length).toBe(4)
  })

  it(
    '🔴 ② 两实例交错守作用域(判据:runEpoch 挪到模块级共享 → 必须报红,' +
      '见报告手工 RED 探针 —— 先例 FileDetailDrawer.test.ts 的 activeId 两实例交错用例)',
    async () => {
      const store = withPinia()
      let resolve1!: (v: unknown) => void
      const p1 = new Promise((res) => {
        resolve1 = res
      })
      const spy = vi.spyOn(store, 'runSearch')
      spy.mockImplementationOnce(() => p1 as Promise<unknown>) // 实例 1 发起(悬而不决)
      spy.mockResolvedValueOnce(F5B_RESPONSE) // 实例 2 发起,立即回

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

      // 实例 1 的迟到响应现在才回来 —— runEpoch 是各实例本地闭包变量,不应被实例 2
      // 的 run() 干扰。若 runEpoch 是模块级共享变量,实例 1 此时唯一一次 run() 的
      // myEpoch 会因为实例 2 也调用过 run() 而被判"过期",下面这条断言就会失败
      // (必须报红,见报告手工 RED 探针:临时把 runEpoch 挪进模块作用域)。
      resolve1(F1_EMPTY)
      await flush()
      const vm1 = w1.vm as unknown as { phase: string }
      expect(vm1.phase).toBe('empty')
    },
  )
})

describe('SearchView —— N33:SAMPLE_QUERIES 照抄且过 t(),点 chip → q 变译文且触发 run()', () => {
  it('点第一个示例 chip → 输入框值变成译文"甲状腺",且发出搜索请求', async () => {
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

describe('SearchView —— N39:clear() 一并清 openFile/viewerFile(蓝本 :264)', () => {
  it('clear() 重置 q/phase/results,以及 openFile/viewerFile(本刀声明的两个 ref,渲染归 T7)', async () => {
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
    // 结果卡 markup 归 T7,本刀没有可点击的 UI 入口能把 openFile/viewerFile 设成非空
    // ——直接读写顶层 ref 驱动这两个状态,技术先例见 IndexedFilesView.test.ts:618-621。
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

describe('SearchView —— N40:?q= 深链,watch(immediate:true) + 条件 v && v !== q', () => {
  it('① 挂载时 query 已有 → 立即搜(immediate 生效)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch({ q: 'deep-link-term' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect((spy.mock.calls[0][0] as { query: string }).query).toBe('deep-link-term')
    expect((w.find('.k-search-box input').element as HTMLInputElement).value).toBe('deep-link-term')
  })

  it(
    '② 挂载后改 query → 再搜(🔴 判据:降级成只在 onMounted 读一次 → 必须报红,' +
      '记忆 newui-router-query-only-no-remount)',
    async () => {
      const store = withPinia()
      const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
      const { w, router } = await mountSearch() // 挂载时无 q,零调用
      expect(spy).not.toHaveBeenCalled()
      await router.push({ path: '/ai/knowledge/search', query: { q: 'after-mount-term' } })
      await flush()
      expect(spy).toHaveBeenCalledTimes(1)
      expect((spy.mock.calls[0][0] as { query: string }).query).toBe('after-mount-term')
      expect((w.find('.k-search-box input').element as HTMLInputElement).value).toBe('after-mount-term')
    },
  )

  it(
    '③ 🔴 query 与当前 q 相同时不重复搜(回写值必须与初始值不同,防 §9.14-3 零判别力陷阱: ' +
      '路径是 undefined → "manual"(真变化,watch 会触发)→ 再 push 同一个 "manual"(watch 源不变化,' +
      'watch 本身不会再调用 handler)—— 这里测的是"handler 内部条件"这一层,不是"watch 源没变化"那一层)',
    async () => {
      const store = withPinia()
      const spy = vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
      const { w, router } = await mountSearch() // query 无 q → immediate 触发但 v 为空,零调用
      expect(spy).not.toHaveBeenCalled()
      // 模拟用户直接在搜索框手动输入(不经过路由),使 q.value 变成 'manual'
      await w.find('.k-search-box input').setValue('manual')
      expect(spy).not.toHaveBeenCalled() // 只是输入,未回车/未过 watch,尚未触发
      // 现在把路由 query.q 推成与当前 q.value 相同的 'manual'——watch 源从
      // undefined → 'manual' 是一次真实变化,会触发 handler,但 handler 内部
      // `v !== q.value` 应为 false,不应再发一次搜索。
      await router.push({ path: '/ai/knowledge/search', query: { q: 'manual' } })
      await flush()
      expect(spy).not.toHaveBeenCalled()
    },
  )
})

describe('SearchView —— 自动上膛守卫(T6 自建):若模板出现 <FileDetailDrawer,四个监听必须全部出现', () => {
  // 🔴 T6 阶段这条走"惰性通过"分支(markup 不存在)。T7 续写本文件、写入
  // markup 后,这条**现在因 markup 出现而上膛**——见下方 `hasMarkup` 分支,断言
  // 四个监听全部出现,已满足(见报告 §T5 DoD-12 证据小节)。原 describe 名与结构
  // 保留(反转不删),条件分支本身是通用的,不需要改代码,只是现在走另一支。
  it('模板含 <FileDetailDrawer ⇒ 四个监听全部出现(现在因 T7 markup 而上膛,已满足)', () => {
    const src = stripLineComments(read('./SearchView.vue')) // 剥注释,防假阳性(同上一个 describe 块的教训)
    const hasMarkup = /<FileDetailDrawer[\s/>]/.test(src)
    expect(hasMarkup, 'T7 已写入 markup,此断言现在应为 true').toBe(true)
    if (!hasMarkup) {
      return
    }
    for (const ev of ['@close', '@open', '@download', '@toast']) {
      expect(src.includes(ev), `模板含 <FileDetailDrawer 时必须同时接 ${ev}`).toBe(true)
    }
  })
})


// ══════════════════════════════════════════════════════════════════════════
// T7 —— 结果卡列表(蓝本 :121-156)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView —— T7:结果卡渲染字段(蓝本 :121-156,用 F5B_RESPONSE)', () => {
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

  it(':key=r.id · data-kind + toUpperCase() · k-match-pill 的 title 与可见文案是两个不同的键(蓝本 :135-136,不许合并)', async () => {
    const { w } = await mountWithF5b()
    const cards = w.findAll('.k-rcard')
    expect(cards.length).toBe(4)
    const first = cards[0]
    // file_id='dce79e8ea5…',mime='text/plain' → kindFromMime → 'txt'
    expect(first.find('.k-rcard-tag').attributes('data-kind')).toBe('txt')
    expect(first.find('.k-rcard-tag').text()).toBe('TXT')
    const pill = first.find('.k-match-pill')
    // 🔴 title 用 aiKbSrMatchTitle('命中 {n} 段'),可见文案用 aiKbSrMatchPill('{n} 段匹配')——两个不同键
    expect(pill.attributes('title')).toBe('命中 2 段')
    expect(pill.text()).toContain('2 段匹配')
  })

  it('k-rel 的 data-level 与 title(含 (score*100).toFixed(0)%)', async () => {
    const { w } = await mountWithF5b()
    const first = w.findAll('.k-rcard')[0]
    const rel = first.find('.k-rel')
    // score=0.738 → relLevel >= 0.65 → 'high'
    expect(rel.attributes('data-level')).toBe('high')
    expect(rel.attributes('title')).toBe('相似度 74%')
    expect(rel.text()).toContain('高')
  })

  it('🔴 k-more-hint:chunks.length > 1(F5B 每文件 2 chunk)→ 显示,文案用 chunks.length - 1', async () => {
    const { w } = await mountWithF5b()
    const first = w.findAll('.k-rcard')[0]
    expect(first.find('.k-more-hint').exists()).toBe(true)
    expect(first.find('.k-more-hint').text()).toContain('还有 1 段相关内容')
  })

  it('🔴 反向:chunks.length === 1(单 chunk 文件)→ 不显示 k-more-hint', async () => {
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

  it('k-rcard-meta 三段:路径 · 修改时间 · 已收录(aiKbStatusIndexed)', async () => {
    const { w } = await mountWithF5b()
    const first = w.findAll('.k-rcard')[0]
    const meta = first.findAll('.k-rcard-meta-item')
    expect(meta.length).toBe(3)
    expect(meta[0].text()).toContain('/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/') // r.path = dirname(fullPath),不含文件名
    expect(meta[1].text()).toContain('修改时间')
    expect(meta[2].text()).toContain('已收录')
  })

  it('点结果卡 → openFile = r(蓝本 :128 @click="openFile = r")', async () => {
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

  it('🔴 蓝本 :142 空数组兜底:r.chunks[0] && r.chunks[0].snippet —— 零 chunk 的文件不许抛', async () => {
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
          chunks: [], // .CONSTRUCTED —— 专为验证空数组兜底构造,非真机样本
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

describe('SearchView —— T7:K49 结果卡 v-html 注入用例(.k-rcard-snippet)', () => {
  it('🔴 喂含 <script> 的 snippet → 渲染 DOM 里 querySelector("script") 为 null,<mark> 仍在', async () => {
    const store = withPinia()
    // .CONSTRUCTED —— 专为 XSS 注入验证构造的 snippet,取自 F5B_RESPONSE 的字段形状
    // 但正文替换成含 <script> 的攻击样本,非真机数据。highlight() 的转义本身已在
    // searchAggregate.test.ts 测过(K49),这里补组件层 v-html 渲染后的真实 DOM 断言。
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

describe('SearchView —— T7:k-result-count(蓝本 :122-127)', () => {
  it('results.length / totalChunks / lastQuery 正确渲染', async () => {
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

  it('🔴 ms === 0 时不渲染 " · N ms"(蓝本 :125 v-if="ms",falsy 不渲染)', async () => {
    vi.useFakeTimers()
    const store = withPinia()
    // mock 立即 resolve、系统时钟未推进 → Date.now() - t0 === 0
    vi.spyOn(store, 'runSearch').mockResolvedValue(F5B_RESPONSE)
    const { w } = await mountSearch()
    const input = w.find('.k-search-box input')
    await input.setValue('foo')
    await input.trigger('keydown.enter')
    await flush()
    expect(w.find('.k-result-count').text()).not.toMatch(/\d+ ms/)
  })

  it('ms 非零时渲染 " · N ms"', async () => {
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
// T7 —— K50/裁定 R1「方案 A」:fetchBlobUrl 四条自证(评审第一必查项)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView —— T7:K50/裁定 R1(方案 A)—— fetchBlobUrl 自证', () => {
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

  it('① 🔴 responseType 硬断言:getHttp().get 的第二个参数恰好是 { responseType: "blob" }(判据:改成 arraybuffer → 报红,见报告 RED 探针)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const { w } = await mountBasic()
    await downloadFileOf(w)(makeFileVM({ fullPath: '/DATA/a.txt' }))
    await flush()
    expect(httpGet).toHaveBeenCalledTimes(1)
    expect(httpGet.mock.calls[0][1]).toEqual({ responseType: 'blob' })
  })

  it('② 🔴 window.open 打开的是 URL.createObjectURL() 产出的 blob: 地址,不含 token=(判据:改成直接 open fileUrl() → 报红,见报告 RED 探针)', async () => {
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

  it('③ service.file.fileUrl() 的返回值(含 token)只作那一次 XHR 的 URL,不直接交给 window.open —— fileUrl mock 仍被调用(用于发那次请求),但可见的 open 参数是 blob', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w } = await mountBasic()
    await openOriginalOf(w)({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(fileUrl).toHaveBeenCalledWith('/DATA/a.pdf')
    const [xhrUrl] = httpGet.mock.calls[0]
    expect(String(xhrUrl)).toContain('token=TEST_TOKEN_ABC') // 那一次 XHR 的 URL 含 token,符合预期
    const [openedUrl] = openSpy.mock.calls[0]
    expect(String(openedUrl)).not.toContain('token=') // 但 window.open 拿到的不含
    openSpy.mockRestore()
  })

  it('④ inline:true → URL 含 &inline=1;downloadFile(不传 inline) → URL 不含 inline(两条)', async () => {
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
// T7 —— openOriginal 三条路由分支(蓝本 :361-380)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView —— T7:openOriginal 三条路由分支(蓝本 :361-380)', () => {
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

  it('ext ∈ {docx,wps,xls,xlsx,csv} → 设 viewerFile,不发请求(判据:getHttp mock 零调用)', async () => {
    const { w } = await mountBasic()
    const file = makeFileVM({ name: 'sheet.xlsx' })
    await openOriginalOf(w).openOriginal({ file })
    await flush()
    expect(openOriginalOf(w).viewerFile).toEqual(file)
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('ext ∈ {doc,ppt,pptx} → toast "该格式暂不支持预览,请下载查看",不发请求', async () => {
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'slides.ppt' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('该格式暂不支持预览，请下载查看')
    expect(httpGet).not.toHaveBeenCalled()
    expect(openOriginalOf(w).viewerFile).toBe(null)
  })

  it('其余 ext → fetchBlobUrl(inline:true) + window.open(url,"_blank","noopener,noreferrer")', async () => {
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

  it('🔴 window.open 返回 null(弹窗被拦)→ toast "浏览器拦截了新窗口"', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('浏览器拦截了新窗口')
    openSpy.mockRestore()
  })

  it('🔴 setTimeout(revokeObjectURL, 60000)(假时钟)', async () => {
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

  it('!file.fullPath → toast "文件路径缺失",不发请求', async () => {
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ fullPath: '' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('文件路径缺失')
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('抛错 → toast "打开失败: <msg>"', async () => {
    httpGet.mockRejectedValue(new Error('network down'))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { w, toastSpy } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'a.pdf', fullPath: '/DATA/a.pdf' }) })
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('打开失败: network down')
    openSpy.mockRestore()
  })

  it('🔴 ext 提取整名当 ext:文件名恰好是 "docx"(无扩展名)→ 误判成 in-app 可预览格式(照抄蓝本既有怪行为)', async () => {
    const { w } = await mountBasic()
    await openOriginalOf(w).openOriginal({ file: makeFileVM({ name: 'docx' }) })
    await flush()
    expect(openOriginalOf(w).viewerFile?.name).toBe('docx')
    expect(httpGet).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════
// T7 —— downloadFile(蓝本 :382-397)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView —— T7:downloadFile(蓝本 :382-397)', () => {
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

  it('🔴 成功:造 <a download> → appendChild → click → removeChild(同一元素)→ 60s 后 revokeObjectURL', async () => {
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
    // 🔴 removeChild 真的被调用,且是同一个元素(否则 DOM 泄漏)
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy.mock.calls[0][0]).toBe(a)
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60000)
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('🔴 a.download 兜底:file.name 为空 → "download"', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['bytes']) })
    const { w } = await mountBasic()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    await downloadFileOf(w)(makeFileVM({ name: '', fullPath: '/DATA/x' }))
    await flush()
    const a = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(a.download).toBe('download')
    appendSpy.mockRestore()
  })

  it('!file.fullPath → toast "文件路径缺失",不发请求', async () => {
    const { w, toastSpy } = await mountBasic()
    await downloadFileOf(w)(makeFileVM({ fullPath: '' }))
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('文件路径缺失')
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('抛错 → toast "下载失败: <msg>"', async () => {
    httpGet.mockRejectedValue(new Error('disk full'))
    const { w, toastSpy } = await mountBasic()
    await downloadFileOf(w)(makeFileVM({ fullPath: '/DATA/x' }))
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('下载失败: disk full')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// T7 —— 两个子组件挂载 wiring(蓝本 :164-172)
// ══════════════════════════════════════════════════════════════════════════

describe('SearchView —— T7:FileDetailDrawer 四个监听全接(蓝本 :164-168)', () => {
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

  it('挂载后传 :file/:query 正确(query = lastQuery)', async () => {
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

  it('@open → 调用 openOriginal(转发的 file 决定路由分支,这里用 office ext 验证落到 viewerFile)', async () => {
    const { w, vm } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('open', { file: makeFileVM({ name: 'sheet.xlsx' }) })
    await flush()
    expect(vm.viewerFile?.name).toBe('sheet.xlsx')
  })

  it('@download → 调用 downloadFile(触发 fetchBlobUrl,证明是同一个函数)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['x']) })
    const { w } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('download', makeFileVM({ fullPath: '/DATA/dl.txt' }))
    await flush()
    expect(fileUrl).toHaveBeenCalledWith('/DATA/dl.txt')
    expect(httpGet).toHaveBeenCalledTimes(1)
  })

  it('🔴 @toast → 转发到 store.toast(K3,不直接调用全局 useToast)', async () => {
    const { w, toastSpy } = await mountWithOpenFile()
    const drawer = w.findComponent(FileDetailDrawer)
    drawer.vm.$emit('toast', '已复制')
    await flush()
    expect(toastSpy).toHaveBeenCalledWith('已复制')
  })
})

describe('SearchView —— T7:KFileViewer 两个监听全接(蓝本 :170-172)', () => {
  async function mountWithViewerFile(fileOverrides: Partial<FileVM> = {}) {
    const store = withPinia()
    vi.spyOn(store, 'runSearch').mockResolvedValue(F1_EMPTY)
    const { w } = await mountSearch()
    const vm = w.vm as unknown as { viewerFile: FileVM | null }
    // 用不在 VIEWER_MAP 里的扩展名 → KFileViewer 走 fallback 分支,不挂载真实
    // DocViewer/ExcelViewer(避开 @vue-office 在 jsdom 下的已知崩溃,§9.12 同族)。
    vm.viewerFile = makeFileVM({ name: 'weird.xyz', ...fileOverrides })
    await flush()
    return { w, vm }
  }

  it('挂载后传 :file 正确,走 fallback 分支(未知扩展名)', async () => {
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

  it('@download → 调用 downloadFile(与 FileDetailDrawer 复用同一个函数)', async () => {
    httpGet.mockResolvedValue({ data: new Blob(['x']) })
    const { w } = await mountWithViewerFile()
    const viewer = w.findComponent(KFileViewer)
    viewer.vm.$emit('download', makeFileVM({ fullPath: '/DATA/weird.xyz' }))
    await flush()
    expect(fileUrl).toHaveBeenCalledWith('/DATA/weird.xyz')
    expect(httpGet).toHaveBeenCalledTimes(1)
  })
})

describe('SearchView —— T7:两个子组件可同时挂载 + N41(Esc 同时关闭两者)', () => {
  it('🔴 openFile 与 viewerFile 都非空 → 两个子组件同时渲染;按 Esc → 两个都关(蓝本既有行为,不加 stopPropagation)', async () => {
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
// 🔴 SP8-P5f Task 1b —— 债务 I-1(P5e 终审 Important-1)的补漏块
//
// P5e 终审实测:`runSearch` 的 `topK` / `rerank` 两个入参在本文件里**零守卫**——
// 把 `rerank` 接反、把 `topK` 焊死成 10,4254 例全绿(终审探针 F1/F2 各自
// `3125/3125 全绿`),而 SearchView 的结果半区在本机**真机不可达**(治理 §0.3)
// ⇒ **测试守卫是唯一防线**。
//
// 🔴 本块**只加断言,产品码一行未动** —— `SearchView.vue:220-225` 的
// `topK: topK.value` / `rerank: quality.value === 'accurate'` 经 P5e 终审逐字核为
// **正确**(蓝本 `bp-SearchView.vue:301-302`),这是纯覆盖缺口,不是缺陷。
//
// 入参真实来源(本刀自己回读 `SearchView.vue` 确认,未照抄 brief):
//   `topK`   ← `const topK = ref(10)`(`:108`),高级面板第 4 个 `.k-adv-field`
//              的四个按钮 `[5, 10, 20, 50]` 直接赋值 → 原样传给 `runSearch`。
//   `rerank` ← `const quality = ref<'fast' | 'accurate'>('fast')`(`:107`),
//              第 3 个 `.k-adv-field` 的两个按钮;传的是**布尔** `quality === 'accurate'`
//              (不是字符串)——`fast → false`、`accurate → true`。
//
// 判据(RED 探针,见 p5f-task-1b-report.md):
//   ① 把 `rerank` 反转成 `quality.value !== 'accurate'` → 本块必须报红;
//   ② 把 `topK` 焊死成 `topK: 10` → 本块必须报红。
// ═══════════════════════════════════════════════════════════════════════════

describe('SearchView —— 债务 I-1:runSearch 的 topK / rerank 两入参必须真的取自组件状态', () => {
  /** 打开高级面板、执行一次搜索,返回 `store.runSearch` 第一次调用的实参。 */
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

  // ─── rerank:两侧都比(治理 §9「属性态断言两侧都比」)───
  // 反转探针要报红,必须两个方向都钉:只钉 accurate→true 的话,把判据写成常量 `true`
  // 仍然绿;只钉 fast→false 同理。
  it('quality="fast"(默认)→ rerank === false(布尔 false,不是 "fast"/undefined)', async () => {
    const call = await runAndCapture(async () => {})
    expect(call.rerank).toBe(false)
  })

  it('🔴 quality="accurate" → rerank === true(反转即报红)', async () => {
    const call = await runAndCapture(async (w) => {
      const qualityButtons = w.findAll('.k-adv-field')[2].findAll('button')
      // 先确认这个按钮在本机数据下真的渲染成可点元素(治理 §13-1)
      expect(qualityButtons.length).toBe(2)
      expect(qualityButtons[1].attributes('data-on')).toBe('false')
      await qualityButtons[1].trigger('click')
      expect(qualityButtons[1].attributes('data-on')).toBe('true')
    })
    expect(call.rerank).toBe(true)
  })

  // ─── topK:四个档位逐个钉死(焊死成 10 时,5/20/50 三条必须报红)───
  const TOPK_BUTTONS = [5, 10, 20, 50] as const

  it('默认(未点任何档位)→ topK === 10', async () => {
    const call = await runAndCapture(async () => {})
    expect(call.topK).toBe(10)
  })

  for (let idx = 0; idx < TOPK_BUTTONS.length; idx++) {
    const n = TOPK_BUTTONS[idx]
    it(`🔴 点第 ${idx + 1} 个档位(${n})→ topK === ${n}(焊死成 10 时,非 10 的三档必须报红)`, async () => {
      const call = await runAndCapture(async (w) => {
        const topkButtons = w.findAll('.k-adv-field')[3].findAll('button')
        // 防空循环:四个按钮必须真的渲染出来,否则本用例零判别力
        expect(topkButtons.length).toBe(TOPK_BUTTONS.length)
        expect(topkButtons[idx].text()).toBe(String(n))
        await topkButtons[idx].trigger('click')
        expect(topkButtons[idx].attributes('data-on')).toBe('true')
      })
      expect(call.topK).toBe(n)
      // 类型也钉住:蓝本传的是 number,不是按钮上的字符串
      expect(typeof call.topK).toBe('number')
    })
  }

  it('🔴 两个入参同时非默认 → 一次调用里 topK 与 rerank 各自独立正确(防「串了一个」)', async () => {
    const call = await runAndCapture(async (w) => {
      await w.findAll('.k-adv-field')[2].findAll('button')[1].trigger('click') // accurate
      await w.findAll('.k-adv-field')[3].findAll('button')[3].trigger('click') // 50
    })
    expect(call.topK).toBe(50)
    expect(call.rerank).toBe(true)
  })
})
