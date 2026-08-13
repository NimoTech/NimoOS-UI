// SP8-P5b Task 8 — IndexedFilesView.vue "Indexed Files" page, first cut test: scaffold +
// 7 filter items + table header meta + error banner (K14/K19) + skeleton screen + empty state (N10).
//
// Test scaffold discipline same as T5 QueueView.test.ts (governance §9): real i18n (no hand-written
// subsets), mock @nimotech/nimoos-service (otherwise onMounted makes real requests), afterEach
// unmounts all wrappers uniformly (T5 M-4 lesson — this component has a module-level
// 30-second polling timer `knowledgeStore.ts` `indexedPollTimer`; if not unmounted, the stale timer
// blocks `startIndexedPolling`'s own guard `if (indexedPollTimer) return`, so subsequent mounted
// instances can never start their own polling, polluting the next test's call count assertions).
//
// 🔴 This cut does NOT set up vue-router: `git grep '\$route\|\$router'` returns zero hits on the
// blueprint `IndexedFilesView.vue` (main@7a6ee6b7) (unlike QueueView, this component does not read
// route query), so only pinia + i18n two plugins are mounted.
//
// Mock shape sources (governance §4, no hand-editing; documented individually):
//   ai.parserFiles({...}) — service.ai.* has zero transformation of this endpoint (§4.1), fixture
//     as-is snake_case.
//   FILES_ALL_8 — verbatim from p5b-fixtures/files-all-8.json (8 files, 5 indexing / 3 ok,
//     device distribution measured 2026-08-01, see governance §4.5/§12 E-8).
//   ALL_OK_FILES — 3 rows filtered as-is from FILES_ALL_8 where status==='ok', not synthesized
//     data, just a subset of the same fixture (device has no "all ok, zero indexing" 8-row
//     scenario, so we must pick the no-indexing-rows subset from verified data to cover the
//     isAnyIndexing=false branch).
//   EMPTY_RESULT — verbatim from p5b-fixtures/files-has-error.json
//     (`{"total":0,"limit":3,"offset":0,"files":[]}`, the real empty response when has_error=true
//     on device), borrowed as a generic empty-state fixture (shape unchanged, just this file doesn't
//     specifically assert it came from the has_error scenario).
//   MULTI_ROOT_FILES — synthesized (README explicitly registers: all 8 device files land under
//     /DATA, only one derivable root segment; cannot test derivedRoots multi-value sort / miss
//     fallback to 'all' branches). Field names match the fixture file row schema (file_id/paths/
//     status, remaining optional fields omitted, component doesn't read them this cut), just
//     swapping paths[0].path to /DATA/…, /Wiki/…, and one path with no second slash /lonely
//     (topSegment returns null for it, should not enter derivedRoots).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '../../../i18n'
import IndexedFilesView from './IndexedFilesView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
// T9: KIcon used to assert the status badge icon name prop (RED probe① anchor); fmtBytes/
// fmtAbs imported as aliases, only for "does the component wire the correct fields to these
// functions" reference assertions (these two functions' own boundary values are already covered
// in util/indexedFilesView.test.ts (T7), no repeat here).
import KIcon from '../components/KIcon.vue'
import { fmtBytes as fmtBytesRef, fmtAbs as fmtAbsRef } from '../util/indexedFilesView'
// Guard gap③ (Appendix B §B.0.4) directional assertions read the .vue source file itself — always
// node:fs, not Vite's ?raw (vitest's CSSEnablerPlugin replaces the style source wholesale with
// empty string, assertions "fake pass" against empty string; precedent in knowledgeStyles.test.ts
// header comment③, QueueView.test.ts same reuse). This repo "type": "module" → __dirname
// unavailable in ESM, switched to fileURLToPath + node:path equivalent. Type declarations for
// node: prefix modules provided by `@types/node`, installed in this repo (SP8-P6 merged from
// master), vue-tsc passes directly, **no need for** @ts-expect-error suppression (suppression
// lines originally in sp8-ai branch removed on merge; see knowledgeStyles.test.ts header①②).
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock scaffold (governance §9: avoid ESM hoisting TDZ) ──
// T10 adds `parserReindexFiles` — three rebuild entry points (rebuildRow / rebuildSelected /
// doRebuildAll) all fall through to one wrapper method in store (`knowledgeStore.ts:467` and
// `:477`, just body: one passes `file_ids` one passes `filter`). Shape from `p5b-fixtures/
// reindex-one.http` measured text (snake_case, §4.1 zero transformation).
const ai = vi.hoisted(() => ({ parserFiles: vi.fn(), parserReindexFiles: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// ── Fixture data (verbatim from p5b-fixtures/files-all-8.json) ──
const FILES_ALL_8 = [
  { file_id: '2685dfba774c87b77b9ca4af44e691f6', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/tmp/nimoos_panic.log', mtime_ms: 1785413747017 }], sha256_full: '2685dfba774c87b77b9ca4af44e691f63f21d35402307fe1686aa0b6333ffe9c', size: 627268604, mime: 'application/octet-stream', modalities_done: {}, parser_version: 'parser/0.2.0', indexed_at: 1785413748112, tombstoned_at: null, vector_count: 0, last_error: null, status: 'indexing' },
  { file_id: '05d732586959ea3f480b5feb4b0d17c8', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/log/nimoos/log.log', mtime_ms: 1784404128499 }], sha256_full: '05d732586959ea3f480b5feb4b0d17c833ea5df0bffb7cea68d53b29e05db7e3', size: 1670833, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784436202505, tombstoned_at: null, vector_count: 856, last_error: null, status: 'ok' },
  { file_id: '4018267c2ec373cddb244ac220a06cc2', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/log/nimoos/app-management.log', mtime_ms: 1784434525914 }], sha256_full: '4018267c2ec373cddb244ac220a06cc2fc78bca7da8e5e2c8bf27b9768d9c919', size: 1342451, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784434892746, tombstoned_at: null, vector_count: 696, last_error: null, status: 'ok' },
  { file_id: '6e1be7c24c4cdb09e1bf1a8318e8ca27', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/home/nimo/.vscode-server/cli/servers/lru.json', mtime_ms: 1784427082918 }], sha256_full: '6e1be7c24c4cdb09e1bf1a8318e8ca2788e5014a7e2dba8d6efb9d36d7d01028', size: 251, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784434891932, tombstoned_at: null, vector_count: 1, last_error: null, status: 'indexing' },
  { file_id: '721c340b1dc3b982cdb4ea6c9783103e', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/home/nimo/.vscode-server/cli/agent-host-stable.log', mtime_ms: 1784427082918 }], sha256_full: '721c340b1dc3b982cdb4ea6c9783103e33b10f2f18ac76d774797a28af2bc4e3', size: 61392, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784434817480, tombstoned_at: null, vector_count: 30, last_error: null, status: 'indexing' },
  { file_id: 'dce79e8ea5d48719cd4ad16fe48da843', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log', mtime_ms: 1784424392240 }], sha256_full: 'dce79e8ea5d48719cd4ad16fe48da843c877e5ce861b6595cfa76598339c077d', size: 6961641, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784424393143, tombstoned_at: null, vector_count: 3448, last_error: null, status: 'indexing' },
  { file_id: 'ae3894193e56d181e90b23712f1e3081', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/.docker/containers/aade3000de2889facb1f7ba7789d6f2c2fe6acdaf1a9adc7433242648d5c47e7/aade3000de2889facb1f7ba7789d6f2c2fe6acdaf1a9adc7433242648d5c47e7-json.log', mtime_ms: 1784357047056 }], sha256_full: 'ae3894193e56d181e90b23712f1e3081197dc3e3ddea1cc01b9aaa87c9fdea34', size: 13174, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784360624748, tombstoned_at: null, vector_count: 7, last_error: null, status: 'indexing' },
  { file_id: 'e531767d0b917dfb86ea6c8451c4bf65', paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/.docker/containers/9f4d9086c55a06321ece3e53ddd890df5127fd5deaf0d95bb94fa223f32ffef0/9f4d9086c55a06321ece3e53ddd890df5127fd5deaf0d95bb94fa223f32ffef0-json.log', mtime_ms: 1784359333549 }], sha256_full: 'e531767d0b917dfb86ea6c8451c4bf651895cae04cdb0528e56d9e1d13496c11', size: 1121945, mime: 'text/plain', modalities_done: { text: 'bge-m3/v1' }, parser_version: 'parser/0.2.0', indexed_at: 1784359354310, tombstoned_at: null, vector_count: 554, last_error: null, status: 'ok' },
]
// Subset (not synthesized): 3 rows from FILES_ALL_8 where status==='ok', specifically covers isAnyIndexing=false.
const ALL_OK_FILES = FILES_ALL_8.filter((f) => f.status === 'ok')

// Verbatim from p5b-fixtures/files-has-error.json (real empty response when has_error=true on device).
const EMPTY_RESULT = { total: 0, limit: 3, offset: 0, files: [] }

// Synthesized (README registers: all device files under /DATA, cannot test multiple roots), same field set.
const MULTI_ROOT_FILES = [
  { file_id: 'm1', paths: [{ root_id: 'r', path: '/DATA/a.log', mtime_ms: 1 }], status: 'ok' },
  { file_id: 'm2', paths: [{ root_id: 'r', path: '/DATA/b.log', mtime_ms: 2 }], status: 'ok' },
  { file_id: 'm3', paths: [{ root_id: 'r', path: '/Wiki/x.md', mtime_ms: 3 }], status: 'ok' },
  // No second slash — topSegment (blueprint :439-444/T7 as-is) returns null for it, should not enter
  // derivedRoots (same rule as T7 util unit test boundary case, here confirming at component integration level).
  { file_id: 'm4', paths: [{ root_id: 'r', path: '/lonely', mtime_ms: 4 }], status: 'ok' },
]

// T10: `reindex-one.http` measured response body verbatim (200 branch) —
// `{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`. Blueprint reads only `queued` in three places.
const REINDEX_OK = { queued: 1, tombstoned: 1, job_ids: [349], skipped: [] }

function setupServiceMocks(): void {
  ai.parserFiles.mockResolvedValue({ total: FILES_ALL_8.length, limit: 100, offset: 0, files: FILES_ALL_8 })
  ai.parserReindexFiles.mockResolvedValue(REINDEX_OK)
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

const flush = async () => {
  await flushPromises()
  await nextTick()
}

async function mountFiles() {
  const w = mount(IndexedFilesView, { global: { plugins: [i18n] } })
  mountedWrappers.push(w)
  await flush()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setupServiceMocks()
})

// T5 M-4 lesson: must unmount all mounted wrappers, otherwise this component's onMounted-triggered
// store.startIndexedPolling() 30s setInterval (store module-level handle) survives across tests,
// blocking the next mount's own `if (indexedPollTimer) return` guard.
afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  // T10: K7 modal portal host (withHost() puts .knowledge-app in document.body) must be cleared,
  // or the next test's `host.querySelector('.k-modal')` will hit the previous test's leftover
  // host (precedent in QueueView.test.ts `document.body.innerHTML = ''`, here only precisely
  // removing our own host, not clearing the entire body).
  document.querySelectorAll('.knowledge-app').forEach((el) => el.remove())
})

// ──────────────────────────────────────────────────────────────────────
// Skeleton container
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Skeleton container (blueprint :1-5)', () => {
  it('Three-layer nesting .k-view > .k-scroll > .k-scroll-inner exists', async () => {
    const w = await mountFiles()
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Filter bar 7 items — each: "change → offset zero + clear selection + clear error banner + reload"
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Filter bar: _applyFilter four things (offset zero / clear selection / clear error banner / reload)', () => {
  // Each test first sets up three "dirty" states (offset non-zero, selSet non-empty, errorBanner non-
  // empty), then triggers a filter change, asserts all four things happen — stricter than asserting
  // just one (RED probe② specifically deletes the offset=0 line to verify this discrimination power).
  function dirtyState(store: ReturnType<typeof useKnowledgeStore>, w: Awaited<ReturnType<typeof mountFiles>>) {
    store.indexedFiles.filters.offset = 300
    ;(w.vm as unknown as { selSet: Set<string> }).selSet = new Set(['stale-id'])
    ;(w.vm as unknown as { errorBanner: string | null }).errorBanner = 'stale banner text'
  }
  function expectClean(store: ReturnType<typeof useKnowledgeStore>, w: Awaited<ReturnType<typeof mountFiles>>) {
    expect(store.indexedFiles.filters.offset).toBe(0)
    expect((w.vm as unknown as { selSet: Set<string> }).selSet.size).toBe(0)
    expect((w.vm as unknown as { errorBanner: string | null }).errorBanner).toBeNull()
  }

  it('1) Root dropdown switches to segment: path_prefix becomes /DATA/ + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.findAll('.k-filt select')[0].setValue('DATA')
    await flush()
    expect(store.indexedFiles.filters.path_prefix).toBe('/DATA/')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('1b) Root dropdown switches back to "all": path_prefix cleared + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/'
    await flush()
    ai.parserFiles.mockClear()
    await w.findAll('.k-filt select')[0].setValue('all')
    await flush()
    expect(store.indexedFiles.filters.path_prefix).toBe('')
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('2) Path prefix input: each keystroke fires full reload (N9, no debounce) + four things', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    const input = w.findAll('.k-filt-grow input')[0]
    await input.setValue('/DATA/Wiki/')
    await flush()
    expect(store.indexedFiles.filters.path_prefix).toBe('/DATA/Wiki/')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('3) Path prefix clear button: baseline both clear buttons not rendered (both prefixes empty); only 1 appears after path_prefix non-empty (sides match)', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    expect(w.findAll('.k-filt-clear')).toHaveLength(0) // Both prefixes empty: path clear button not rendered, mime goes chip branch
    expect(w.find('.k-filt-chip').exists()).toBe(true)
    store.indexedFiles.filters.path_prefix = '/DATA/Wiki/'
    await flush()
    expect(w.findAll('.k-filt-clear')).toHaveLength(1) // Only path clear button appears, mime still empty, still chip
    expect(w.find('.k-filt-chip').exists()).toBe(true)
  })

  it('3b) Path prefix clear button click: clear + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/Wiki/'
    await flush()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-filt-grow .k-filt-clear').trigger('click')
    await flush()
    expect(store.indexedFiles.filters.path_prefix).toBe('')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('4) Type prefix input: full reload + four things', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    const input = w.findAll('.k-filt-grow input')[1]
    await input.setValue('text/x-')
    await flush()
    expect(store.indexedFiles.filters.mime_prefix).toBe('text/x-')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('5) Type prefix clear button: clear + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.mime_prefix = 'text/x-'
    await flush()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-filt-grow .k-filt-clear').trigger('click')
    await flush()
    expect(store.indexedFiles.filters.mime_prefix).toBe('')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('6) "Old .doc" shortcut chip: only rendered when mime_prefix empty, click writes fixed prefix + four things', async () => {
    const w = await mountFiles()
    expect(w.find('.k-filt-chip').exists()).toBe(true)
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-filt-chip').trigger('click')
    await flush()
    expect(store.indexedFiles.filters.mime_prefix).toBe('application/legacy-office/')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
    // After mime_prefix non-empty, chip should disappear, switch to clear button (sides match)
    expect(w.find('.k-filt-chip').exists()).toBe(false)
  })

  it('7) Status dropdown change (N12 see dedicated describe): also triggers four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.findAll('.k-filt select')[1].setValue('tombstoned')
    await flush()
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('8) "Only errors" checkbox: has_error toggle + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-filt-check input[type="checkbox"]').setValue(true)
    await flush()
    expect(store.indexedFiles.filters.has_error).toBe(true)
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('9) Sort dropdown change: sort field update + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-sort select').setValue('vector_count')
    await flush()
    expect(store.indexedFiles.filters.sort).toBe('vector_count')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('10) Ascending/descending button: order toggles between desc/asc + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    expect(store.indexedFiles.filters.order).toBe('desc')
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-sort-dir').trigger('click')
    await flush()
    expect(store.indexedFiles.filters.order).toBe('asc')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('11) "Clear" button: six filter fields reset to defaults + four things + reload', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    const f = store.indexedFiles.filters
    f.path_prefix = '/DATA/'
    f.mime_prefix = 'text/x-'
    f.has_error = true
    f.tombstoned = 'tombstoned'
    f.sort = 'size'
    f.order = 'asc'
    await flush()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.find('.k-filter-bar .k-btn.ghost').trigger('click')
    await flush()
    expect(f.path_prefix).toBe('')
    expect(f.mime_prefix).toBe('')
    expect(f.has_error).toBe(false)
    expect(f.tombstoned).toBe('alive')
    expect(f.sort).toBe('indexed_at')
    expect(f.order).toBe('desc')
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('12) "Clear filters" button in empty state (N10 .k-empty-btn) also calls clearFilters', async () => {
    ai.parserFiles.mockResolvedValueOnce(EMPTY_RESULT)
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/'
    await flush()
    ai.parserFiles.mockClear()
    await w.find('.k-empty-btn').trigger('click')
    await flush()
    expect(store.indexedFiles.filters.path_prefix).toBe('')
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Filter text (fix round 1, M-3): collection assertion pins four labels + status dropdown three option
// exact text (aiKbStatusActive is Appendix A ⚠️N #85 mistranslation "已启用", as-is no change)
// + "Only errors" checkbox text + "Clear" button text + "Old .doc" chip text/title +
// two placeholders. Previously these strings only appeared incidentally in other tests with toContain
// on whole button text, no dedicated directional assertions — in future if someone "accidentally
// fixes" a key's value or transposes two key names, three gates won't flag. RED probe: temporarily
// change aiKbStatusActive value to "有效" → this test precisely flags (see task report).
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Filter text (collection assertion, prevent accidental fix / name transposition)', () => {
  it('Four .k-filt-label exact text', async () => {
    const w = await mountFiles()
    const labels = w.findAll('.k-filt-label').map((l) => l.text())
    expect(labels).toEqual(['存储根', '路径前缀', '类型前缀', '状态'])
  })

  it('Status dropdown three option exact text (includes ⚠️N #85 mistranslation "已启用", as-is)', async () => {
    const w = await mountFiles()
    const opts = w.findAll('.k-filt select')[1].findAll('option').map((o) => o.text())
    expect(opts).toEqual(['已启用', '已删除', '全部'])
  })

  it('"Only errors" checkbox text / "Clear" button text', async () => {
    const w = await mountFiles()
    expect(w.find('.k-filt-check').text()).toBe('仅看失败')
    expect(w.find('.k-filter-bar .k-btn.ghost').text()).toBe('清除')
  })

  it('"Old .doc" shortcut chip text and title', async () => {
    const w = await mountFiles()
    const chip = w.find('.k-filt-chip')
    expect(chip.text()).toBe('旧 .doc')
    expect(chip.attributes('title')).toBe('一键圈出待修复的旧 .doc')
  })

  it('Two prefix input placeholders', async () => {
    const w = await mountFiles()
    const inputs = w.findAll('.k-filt-grow input')
    expect(inputs[0].attributes('placeholder')).toBe('/DATA/Wiki/ …')
    expect(inputs[1].attributes('placeholder')).toBe('application/legacy-office/ …')
  })
})

// ──────────────────────────────────────────────────────────────────────
// filtersDirty — six conditions independent + all default false
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — filtersDirty (six conditions independent coverage + all default false)', () => {
  it('All defaults (no filter fields changed) → false, clear button disabled', async () => {
    const w = await mountFiles()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeDefined()
  })

  it('path_prefix non-empty → true', async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.path_prefix = '/DATA/'
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })

  it('mime_prefix non-empty → true', async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.mime_prefix = 'text/x-'
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })

  it('has_error=true → true', async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.has_error = true
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })

  it("tombstoned !== 'alive' → true", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.tombstoned = 'tombstoned'
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })

  it("sort !== 'indexed_at' → true", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.sort = 'size'
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })

  it("order !== 'desc' → true", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.order = 'asc'
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────
// N12 — statusViewLocal ↔ API tombstoned bidirectional mapping, both directions × three values full coverage
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — N12: active ↔ alive bidirectional mapping (statusViewLocal × statusSuffix full coverage)', () => {
  it("Read direction 1/3: tombstoned='alive' → dropdown selects 'active', statusSuffix empty", async () => {
    const w = await mountFiles() // Default tombstoned==='alive'
    expect((w.findAll('.k-filt select')[1].element as HTMLSelectElement).value).toBe('active')
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件')
  })

  it("Read direction 2/3: tombstoned='tombstoned' → dropdown selects 'tombstoned', statusSuffix ' (已删除)'", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.tombstoned = 'tombstoned'
    await flush()
    expect((w.findAll('.k-filt select')[1].element as HTMLSelectElement).value).toBe('tombstoned')
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件 (已删除)')
  })

  it("Read direction 3/3: tombstoned='all' → dropdown selects 'all', statusSuffix ' (全部)'", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.tombstoned = 'all'
    await flush()
    expect((w.findAll('.k-filt select')[1].element as HTMLSelectElement).value).toBe('all')
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件 (全部)')
  })

  it("Write direction 1/3: select '已启用' (option value='active') → store stores 'alive', not direct 'active' (RED probe③ anchor)", async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.tombstoned = 'tombstoned' // First deviate to ensure below is truly this change written back
    await flush()
    await w.findAll('.k-filt select')[1].setValue('active')
    await flush()
    expect(store.indexedFiles.filters.tombstoned).toBe('alive')
    expect(store.indexedFiles.filters.tombstoned).not.toBe('active')
  })

  it("Write direction 2/3: select '已删除' (tombstoned) → passes through as-is 'tombstoned'", async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    await w.findAll('.k-filt select')[1].setValue('tombstoned')
    await flush()
    expect(store.indexedFiles.filters.tombstoned).toBe('tombstoned')
  })

  it("Write direction 3/3: select '全部' (all) → passes through as-is 'all'", async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    await w.findAll('.k-filt select')[1].setValue('all')
    await flush()
    expect(store.indexedFiles.filters.tombstoned).toBe('all')
  })
})

// ──────────────────────────────────────────────────────────────────────
// derivedRoots / rootSelect
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — derivedRoots (best-effort) and rootSelect lookup', () => {
  it('Multiple roots: dedup after sort, paths without second slash excluded (RED probe① anchor)', async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const options = w.findAll('.k-filt select')[0].findAll('option')
    // options[0] always "all", rest is derivedRoots after sort
    const optionValues = options.slice(1).map((o) => o.attributes('value'))
    expect(optionValues).toEqual(['DATA', 'Wiki']) // Dedup (a.log/b.log both DATA) + sort, /lonely excluded
  })

  it("rootSelect lookup: path_prefix='/DATA/' matches derivedRoots → dropdown shows 'DATA'", async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/'
    await flush()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('DATA')
  })

  it("rootSelect lookup: path_prefix matches no derivedRoots → falls back to 'all'", async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/Unknown/'
    await flush()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('all')
  })

  it("rootSelect lookup: path_prefix not '/seg/' shape (more levels) → falls back to 'all'", async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/sub/'
    await flush()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('all')
  })

  it("rootSelect lookup: path_prefix empty → 'all'", async () => {
    const w = await mountFiles()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('all')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Header meta
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Header meta (blueprint :60-90)', () => {
  it('Ready state file count text: {n} indexed files (thousands separator)', async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 12345, files: FILES_ALL_8 })
    const w = await mountFiles()
    expect(w.find('.k-files-count').text()).toBe('共 12,345 个文件')
  })

  it('isAnyIndexing=true (FILES_ALL_8 has 5 indexing rows) show auto-refresh hint', async () => {
    const w = await mountFiles()
    expect(w.find('.k-poll').exists()).toBe(true)
    expect(w.find('.k-poll').text()).toContain('自动刷新中 · 30s')
    expect(w.find('.k-poll').attributes('title')).toBe('只要还有索引中的行，每 30 秒自动刷新')
  })

  it('isAnyIndexing=false (all ok) do not show auto-refresh hint (sides match)', async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: ALL_OK_FILES.length, files: ALL_OK_FILES })
    const w = await mountFiles()
    expect(w.find('.k-poll').exists()).toBe(false)
  })

  it('Sort dropdown three option text correct', async () => {
    const w = await mountFiles()
    const opts = w.find('.k-sort select').findAll('option')
    expect(opts.map((o) => o.text())).toEqual(['索引时间', '大小', '向量数'])
  })

  it('Ascending/descending button: no rotate when desc, rotate 180deg when asc (inline style, sides match)', async () => {
    const w = await mountFiles()
    const dirIcon = () => w.find('.k-sort-dir span')
    expect(dirIcon().attributes('style')).not.toContain('rotate(180deg)')
    expect(w.find('.k-sort-dir').attributes('title')).toBe('降序')
    await w.find('.k-sort-dir').trigger('click')
    await flush()
    expect(dirIcon().attributes('style')).toContain('rotate(180deg)')
    expect(w.find('.k-sort-dir').attributes('title')).toBe('升序')
    await w.find('.k-sort-dir').trigger('click')
    await flush()
    expect(dirIcon().attributes('style')).not.toContain('rotate(180deg)')
    expect(w.find('.k-sort-dir').attributes('title')).toBe('降序')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Error banner — K14 / K19 + inverse assertions
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Error banner (K14/K19, inverse assertions)', () => {
  it('K19: load-error branch does not show e.message, use fixed aiKbLoadErrorBody (inverse assertion, RED probe④ anchor)', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('ECONNREFUSED super-secret-backend-stack-trace'))
    const w = await mountFiles()
    const banner = w.find('.k-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.attributes('data-tone')).toBe('warn')
    expect(banner.text()).toContain('加载失败：')
    expect(banner.text()).toContain('无法读取已收录文件列表，请稍后重试。')
    // Inverse assertion: e.message original text must not appear at all
    expect(banner.text()).not.toContain('ECONNREFUSED')
    expect(banner.text()).not.toContain('super-secret-backend-stack-trace')
  })

  it('K14: rebuild-all 400 branch does not show backend detail, only fixed "400 Bad Request" + aiKbRebuildCapHint (inverse assertion)', async () => {
    const w = await mountFiles()
    // errorBanner assignment function doRebuildAll() (blueprint :791-809/confirm dialog :356-381) is
    // action bar functionality landed in T9/T10, this cut first gets the "how errorBanner renders after
    // being populated" display path right. Technical approach: <script setup> top-level ref even without
    // defineExpose, @vue/test-utils wrapper.vm still readable/writable in test environment (instance.proxy
    // goes setupState bidirectional read/write, verified in testing), use it to directly drive this branch,
    // not adding features or bypassing component public behavior — just this cut has no clickable UI entry
    // to reach this branch.
    ;(w.vm as unknown as { errorBanner: string | null }).errorBanner =
      'too many file_ids (max 500)'
    await nextTick()
    const banner = w.find('.k-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('400 Bad Request')
    expect(banner.text()).toContain('重建匹配文件超过 10,000 上限')
    // Inverse assertion: backend detail original text must not appear at all
    expect(banner.text()).not.toContain('too many file_ids')
    expect(banner.text()).not.toContain('max 500')
  })

  it('Do not render banner when both storeError and errorBanner empty', async () => {
    const w = await mountFiles()
    expect(w.find('.k-banner').exists()).toBe(false)
  })

  it('errorBanner takes priority over storeError (both non-empty goes 400 branch, not load-error)', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('some load error'))
    const w = await mountFiles()
    expect(w.find('.k-banner').text()).toContain('加载失败：')
    ;(w.vm as unknown as { errorBanner: string | null }).errorBanner = 'too many file_ids (max 500)'
    await nextTick()
    expect(w.find('.k-banner').text()).toContain('400 Bad Request')
    expect(w.find('.k-banner').text()).not.toContain('加载失败：')
  })

  it('Click "Close" and clear both local errorBanner and store-side error', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('some load error'))
    const w = await mountFiles()
    const store = useKnowledgeStore()
    expect(w.find('.k-banner').exists()).toBe(true)
    await w.find('.k-banner-close').trigger('click')
    await flush()
    expect(w.find('.k-banner').exists()).toBe(false)
    expect(store.indexedFiles.error).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────
// Skeleton screen
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Skeleton screen (blueprint :106-132)', () => {
  it('pageState=loading renders fake header + 8 skeleton placeholder rows, file count also skeleton bar', async () => {
    let resolveFiles: (v: unknown) => void = () => {}
    ai.parserFiles.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFiles = resolve
        }),
    )
    const w = mount(IndexedFilesView, { global: { plugins: [i18n] } })
    mountedWrappers.push(w)
    // Only nextTick, not flushPromises — promise never resolved anyway, flush pointless,
    // here capturing the frame where "loading=true but data not yet back".
    await nextTick()
    expect(w.find('.k-ftable').exists()).toBe(true)
    expect(w.findAll('.k-frow-skel')).toHaveLength(8)
    expect(w.find('.k-frow-fhead').exists()).toBe(true)
    expect(w.find('.k-files-count .k-skel').exists()).toBe(true)
    expect(w.find('.k-files-count').text()).toBe('') // loading 分支不显示计数文案(两侧对照)

    resolveFiles!({ total: FILES_ALL_8.length, files: FILES_ALL_8 })
    await flush()
    // T9 correction: ready state now also renders `.k-ftable` (real file rows), so "after loading
    // .k-ftable disappears" was correct when T8 landed (ready state had no table then), but T9 added
    // ready state table making it no longer valid — changed to assert skeleton placeholder rows
    // (loading-state-only) truly disappear, this is what the test should protect (skeleton → real data
    // switch, not "table container entirely gone").
    expect(w.findAll('.k-frow-skel')).toHaveLength(0)
    expect(w.find('.k-ftable').exists()).toBe(true)
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件')
  })

  it('Fake header text: status/path/type/size/indexed/vector count/type (Action collision)', async () => {
    let resolveFiles: (v: unknown) => void = () => {}
    ai.parserFiles.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFiles = resolve
        }),
    )
    const w = mount(IndexedFilesView, { global: { plugins: [i18n] } })
    mountedWrappers.push(w)
    await nextTick()
    const spans = w.find('.k-frow-fhead').findAll('span')
    expect(spans[0].text()).toBe('状态')
    expect(spans[1].text()).toBe('路径')
    expect(spans[2].text()).toBe('类型')
    expect(spans[3].text()).toBe('大小')
    expect(spans[4].text()).toBe('已收录')
    expect(spans[5].text()).toBe('向量数')
    expect(spans[6].text()).toBe('类型') // aiKbColAction ⚠️N mistranslation, as-is
    resolveFiles!({ total: 0, files: [] })
    await flush()
  })
})

// ──────────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Empty state (blueprint :135-142, N10)', () => {
  it('total=0 renders empty state, text and icon correct', async () => {
    ai.parserFiles.mockResolvedValueOnce(EMPTY_RESULT)
    const w = await mountFiles()
    expect(w.find('.k-empty').exists()).toBe(true)
    expect(w.find('.k-empty-title').text()).toBe('没有匹配的文件')
    expect(w.find('.k-empty-sub').text()).toBe(
      '没有匹配的文件。试着放宽路径 / 类型前缀，或把状态切到「全部」。',
    )
  })

  it('filtersDirty=false empty state no "Clear filters" button; appears when filtersDirty=true (N10 .k-empty-btn, sides match)', async () => {
    ai.parserFiles.mockResolvedValueOnce(EMPTY_RESULT)
    const w = await mountFiles()
    expect(w.find('.k-empty-btn').exists()).toBe(false)
    // Directly changing store filters triggers no reload (reload only via @change → _applyFilter),
    // here just driving filtersDirty computed to re-evaluate, no need and shouldn't queue mock response
    // again (fix round 1, M-5: previously queued unconsumed mockResolvedValueOnce here, misleading readers
    // into thinking changing filters auto-reloads).
    useKnowledgeStore().indexedFiles.filters.has_error = true
    await flush()
    expect(w.find('.k-empty-btn').exists()).toBe(true)
    expect(w.find('.k-empty-btn').text()).toContain('清空筛选')
  })

  // N10 report explicitly states: .k-empty-btn is an undefined class from blueprint itself (repo-wide git grep
  // only hits IndexedFilesView.vue:139 template line, no corresponding rule in knowledge.scss), renders as
  // unstyled button same as Vue2, not in knowledgeStyles.test.ts whitelist — this file doesn't write separate
  // style existence assertions for it, here only confirms functional behavior (click calls clearFilters, already
  // covered in "Filter 7 items" describe test 12).
})

// ──────────────────────────────────────────────────────────────────────
// Attribute state (Appendix D.3 covers those in this cut's scope)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Attribute state (Appendix D.3)', () => {
  it('.k-filt-check data-on both sides covered (true/false), compare string value directly, not toBeUndefined', async () => {
    const w = await mountFiles()
    const check = () => w.find('.k-filt-check')
    expect(check().attributes('data-on')).toBe('false')
    await check().find('input[type="checkbox"]').setValue(true)
    await flush()
    expect(check().attributes('data-on')).toBe('true')
    await check().find('input[type="checkbox"]').setValue(false)
    await flush()
    expect(check().attributes('data-on')).toBe('false')
  })

  it('.k-banner data-tone static "warn"', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('x'))
    const w = await mountFiles()
    expect(w.find('.k-banner').attributes('data-tone')).toBe('warn')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Lifecycle (created→refresh, beforeDestroy→stop polling)', () => {
  it('Mount immediately triggers one loadIndexedFiles (ai.parserFiles exactly once)', async () => {
    await mountFiles()
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('Unmount stops store module-level polling timer, no leakage triggers next instance guard (same T5 M-4 lesson)', async () => {
    // Fix round 1, M-4 (review noted): w1/w2 and vi.useFakeTimers() previously had no try/finally fallback —
    // if any assertion in middle throws, both `vi.useRealTimers()` and `w2.unmount()` never execute, real
    // timer state + 30s interval component instance leaks to subsequent tests (exact same T5 M-4 lesson). Now
    // both wrappers pushed into `mountedWrappers` (afterEach fallback unmount), `vi.useRealTimers()` in finally,
    // any step failure leaves no fake timers.
    vi.useFakeTimers()
    try {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      ai.parserFiles.mockResolvedValue({ total: FILES_ALL_8.length, files: FILES_ALL_8 }) // Has indexing rows, truly start polling
      const w1 = mount(IndexedFilesView, { global: { plugins: [i18n] } })
      mountedWrappers.push(w1)
      await flushPromises()
      expect(ai.parserFiles).toHaveBeenCalledTimes(1)

      w1.unmount() // onUnmounted → store.stopIndexedPolling()

      ai.parserFiles.mockClear()
      vi.advanceTimersByTime(30000)
      await flushPromises()
      expect(ai.parserFiles).not.toHaveBeenCalled() // Unmount polling truly stops

      // Key regression anchor: swap fresh Pinia + component instance, must start its own polling —
      // if forgot to stop polling above, `indexedPollTimer` store module-level variable stays non-null,
      // next startIndexedPolling() `if (indexedPollTimer) return` guard shorts it out, never starts.
      setActivePinia(createPinia())
      ai.parserFiles.mockResolvedValue({ total: FILES_ALL_8.length, files: FILES_ALL_8 })
      const w2 = mount(IndexedFilesView, { global: { plugins: [i18n] } })
      mountedWrappers.push(w2)
      await flushPromises()
      ai.parserFiles.mockClear()
      vi.advanceTimersByTime(30000)
      await flushPromises()
      expect(ai.parserFiles).toHaveBeenCalledTimes(1) // New instance polling truly started
    } finally {
      vi.useRealTimers()
    }
  })
})

// ──────────────────────────────────────────────────────────────────────
// Guard gap③: <template> block zero naked color literals (same approach T5 QueueView.test.ts)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Guard gap③: <template> block zero naked color literals', () => {
  it('<template> block (after stripping var()/color-mix()) contains no naked hex / rgb / hsl literals (RED probe⑤ anchor)', () => {
    const src: string = readFileSync(resolve(__dirname, './IndexedFilesView.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]

    // Strip contents of var(...) and color-mix(...) (same technique as color-guard.test.ts /
    // QueueView.test.ts: char-by-char scan paired bracket depth, supports nested fallback).
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') {
              depth--
              if (depth === 0) {
                j++
                break
              }
            }
          }
          i = j
        } else {
          out += s[i]
          i++
        }
      }
      return out
    }
    const scrubbed = stripCalls(tmpl, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})

// ══════════════════════════════════════════════════════════════════════
// SP8-P5b Task 9 — Second cut: header row + file rows · inline detail panel · pagination
// (blueprint :146-317). All below newly added this cut.
//
// New mock data source notes (governance §4, no hand-editing, documented individually):
//   FILE_OK / FILE_INDEXING — directly reuse FILES_ALL_8[1] / FILES_ALL_8[0] above (real fixture
//     rows, not synthesized).
//   FILE_ERROR / FILE_TOMBSTONED / FILE_ZEROHINT — synthesized. Governance §4.5 measured and
//     registered: device 8 files have only ok(3)/indexing(5) statuses, no error/tombstoned rows;
//     the only vector_count===0 row has status indexing not ok, so `status==='ok' && vector_count===0`
//     (zerohint criterion) cannot be produced on device, must synthesize. Field shape matches files-all-8.json
//     file row schema (file_id/paths/sha256_full/size/mime/modalities_done/parser_version/indexed_at/
//     tombstoned_at/vector_count/last_error/status) exactly, just swapping values for combinations
//     triggering error/tombstoned/zerohint branches.
//   FILE_UNKNOWN_STATUS — synthesized, status intentionally given string not in statusBadgeMap,
//     covers blueprint :190/:194 fallback branch (governance §3.5 N14 explicitly requires).
// ──────────────────────────────────────────────────────────────────────
const FILE_OK = FILES_ALL_8[1] // Real fixture row, status='ok', vector_count=856
const FILE_INDEXING = FILES_ALL_8[0] // Real fixture row, status='indexing', vector_count=0 (zerohint counter-example anchor)

const FILE_ERROR = {
  file_id: 'constructed-error-1',
  paths: [{ root_id: 'r', path: '/DATA/broken/report.pdf', mtime_ms: 1 }],
  sha256_full: 'e'.repeat(64),
  size: 4096,
  mime: 'application/pdf',
  modalities_done: {},
  parser_version: 'parser/0.2.0',
  indexed_at: 1784434891932,
  tombstoned_at: null,
  vector_count: 0,
  last_error: 'docling parse failed: corrupt xref table',
  status: 'error',
}

const FILE_TOMBSTONED = {
  file_id: 'constructed-tomb-1',
  paths: [{ root_id: 'r', path: '/DATA/deleted/old-notes.txt', mtime_ms: 1 }],
  sha256_full: 't'.repeat(64),
  size: 2048,
  mime: 'text/plain',
  modalities_done: { text: 'bge-m3/v1' },
  parser_version: 'parser/0.2.0',
  indexed_at: 1784434891932,
  tombstoned_at: 1784500000000,
  vector_count: 12,
  last_error: null,
  status: 'tombstoned',
}

// 🔴 zerohint requires status==='ok' && vector_count===0 both conditions — governance
// §4.5 measured: device's only vector_count===0 row has status indexing not ok,
// Device cannot produce this row, must synthesize (compared to FILE_INDEXING, proves vector_count===0 alone insufficient).
const FILE_ZEROHINT = {
  file_id: 'constructed-zerohint-1',
  paths: [{ root_id: 'r', path: '/DATA/empty/blank.bin', mtime_ms: 1 }],
  sha256_full: 'z'.repeat(64),
  size: 0,
  mime: 'application/octet-stream',
  modalities_done: {},
  parser_version: 'parser/0.2.0',
  indexed_at: 1784434891932,
  tombstoned_at: null,
  vector_count: 0,
  last_error: null,
  status: 'ok',
}

// Fallback branch when statusBadgeMap not found (blueprint :190/:194), synthesized.
const FILE_UNKNOWN_STATUS = {
  file_id: 'constructed-unknown-status-1',
  paths: [{ root_id: 'r', path: '/DATA/weird/file.bin', mtime_ms: 1 }],
  sha256_full: 'u'.repeat(64),
  size: 100,
  mime: 'application/octet-stream',
  modalities_done: {},
  parser_version: 'parser/0.2.0',
  indexed_at: 1784434891932,
  tombstoned_at: null,
  vector_count: 5,
  last_error: null,
  status: 'quarantined', // 不在 statusBadgeMap 里
}

async function mountWithFiles(fileArr: unknown[], total = fileArr.length) {
  ai.parserFiles.mockResolvedValueOnce({ total, limit: 100, offset: 0, files: fileArr })
  return mountFiles()
}

// ──────────────────────────────────────────────────────────────────────
// Header row (blueprint :148-165)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Header row (blueprint :148-165)', () => {
  it('Seven column title text (collection assertion, includes ⚠️N aiKbColAction "type" collision)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const spans = w.find('.k-frow-fhead').findAll('span')
    expect(spans.map((s) => s.text())).toEqual([
      '状态',
      '路径',
      '类型',
      '大小',
      '已收录',
      '向量数',
      '类型', // aiKbColAction 的 ⚠️N 错译,照抄
      '',
    ])
  })

  it('Select-all checkbox title = aiKbSelectAllTip', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-fhead .k-row-check').attributes('title')).toBe('全选当前页可选行')
  })

  it('Selectable rows = 0 (all tombstoned) select-all checkbox disabled', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    expect(w.find('.k-frow-fhead .k-row-check').attributes('disabled')).toBeDefined()
  })

  it('When selectable rows exist, select-all checkbox not disabled', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-fhead .k-row-check').attributes('disabled')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────
// N14 — statusBadgeMap four states + fallback, 🔴 title English original string + inverse assertion
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — N14: statusBadgeMap four states (data-s/icon/Chinese text/title English original)', () => {
  it('ok: data-s="ok", icon check (RED probe① anchor), text "已收录", title="Indexed" (English original, RED probe④ anchor)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('ok')
    expect(badge.findComponent(KIcon).props('name')).toBe('check')
    expect(badge.find('.k-status-badge-cn').text()).toBe('已收录')
    expect(badge.attributes('title')).toBe('Indexed')
    // Inverse assertion: title not Chinese, also not key name
    expect(badge.attributes('title')).not.toBe('已收录')
    expect(badge.attributes('title')).not.toBe('aiKbStatusIndexed')
  })

  it('indexing: data-s="indexing", icon spinner, text "Indexing" (K20 no translation falls back to English), title="Indexing"', async () => {
    const w = await mountWithFiles([FILE_INDEXING])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('indexing')
    expect(badge.findComponent(KIcon).props('name')).toBe('spinner')
    expect(badge.find('.k-status-badge-cn').text()).toBe('Indexing')
    expect(badge.attributes('title')).toBe('Indexing')
    // K20 special case: title and badge text happen to both be English "Indexing" (Vue2 language pack
    // has no translation for this key) — this is not a bug, inverse assertion changed to exclude key name.
    expect(badge.attributes('title')).not.toBe('aiKbStatusIndexing')
  })

  it('error: data-s="error", icon x, text "错误", title="Error" (English original)', async () => {
    const w = await mountWithFiles([FILE_ERROR])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('error')
    expect(badge.findComponent(KIcon).props('name')).toBe('x')
    expect(badge.find('.k-status-badge-cn').text()).toBe('错误')
    expect(badge.attributes('title')).toBe('Error')
    expect(badge.attributes('title')).not.toBe('错误')
    expect(badge.attributes('title')).not.toBe('aiKbStatusError')
  })

  it('tombstoned:data-s="tombstoned"、图标 tomb(只经 map 动态取到,不是字面量)、文案「已删除」、title="Removed"(英文原串)', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('tombstoned')
    expect(badge.findComponent(KIcon).props('name')).toBe('tomb')
    expect(badge.find('.k-status-badge-cn').text()).toBe('已删除')
    expect(badge.attributes('title')).toBe('Removed')
    expect(badge.attributes('title')).not.toBe('已删除')
    expect(badge.attributes('title')).not.toBe('aiKbStatusRemoved')
  })

  it('N13: `.k-status-badge-cn` class name as-is from blueprint :197 (blueprint doesn\'t define class, not in whitelist, renders unstyled span)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-status-badge-cn').exists()).toBe(true)
    expect(w.find('.k-status-badge-cn').text()).toBe('已收录')
  })

  it('Fallback branch: status not found in statusBadgeMap → data-s falls back "ok", title/text both fall back to file.status original, icon falls back to check', async () => {
    const w = await mountWithFiles([FILE_UNKNOWN_STATUS])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('ok')
    expect(badge.attributes('title')).toBe('quarantined')
    expect(badge.find('.k-status-badge-cn').text()).toBe('quarantined')
    // Fix round 1, I-1: test name claims to cover "icon fallback to check", but test body only asserted
    // data-s/title/text three items, no props('name') — review probe⑩ swapped badgeFor() fallback
    // branch icon from 'check' to 'danger', 107 tests all green, proving this is fake coverage.
    expect(badge.findComponent(KIcon).props('name')).toBe('check')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Path cell — errhint (error rows) / zerohint (ok && vector_count===0)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Path cell: errhint / zerohint', () => {
  it('Path text = filePath(file) (get paths[0].path)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-pathtxt').text()).toBe(FILE_OK.paths[0].path)
    expect(w.find('.k-frow-pathtxt').attributes('title')).toBe(FILE_OK.paths[0].path)
  })

  it('errhint: status===error and has last_error renders, title/text both last_error original', async () => {
    const w = await mountWithFiles([FILE_ERROR])
    const hint = w.find('.k-frow-errhint')
    expect(hint.exists()).toBe(true)
    expect(hint.attributes('title')).toBe(FILE_ERROR.last_error)
    expect(hint.text()).toContain(FILE_ERROR.last_error)
  })

  it('errhint opposite: status=ok does not render (sides match)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-errhint').exists()).toBe(false)
  })

  it('zerohint: status==="ok" && vector_count===0 renders, title=aiKbZeroVecTip, text=aiKbZeroVec', async () => {
    const w = await mountWithFiles([FILE_ZEROHINT])
    const hint = w.find('.k-frow-zerohint')
    expect(hint.exists()).toBe(true)
    expect(hint.attributes('title')).toBe('已索引但没有可搜索内容（不是错误）')
    expect(hint.text()).toBe('无可搜索内容')
  })

  it('zerohint opposite: vector_count===0 but status=indexing (FILE_INDEXING real data) → not render (proves both conditions required, RED probe⑤ anchor)', async () => {
    const w = await mountWithFiles([FILE_INDEXING])
    expect(FILE_INDEXING.vector_count).toBe(0) // Premise check: this row vector_count truly is 0
    expect(FILE_INDEXING.status).toBe('indexing') // Premise check: but status not ok
    expect(w.find('.k-frow-zerohint').exists()).toBe(false)
  })

  it('zerohint opposite: status=ok but vector_count non-zero (FILE_OK) → not render', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-zerohint').exists()).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Type tag — 5 data-kind from simplifyMime + Legacy badge
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Type tag (simplifyMime 5 data-kind + Legacy badge)', () => {
  const mk = (mime: string) => ({ ...FILE_OK, file_id: 'mk-' + mime, mime })

  it('data-kind="doc" (docx, not legacy): wordprocessing mime', async () => {
    const w = await mountWithFiles([
      mk('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('doc')
    expect(tag.text()).toContain('DOCX')
    expect(tag.find('.k-type-legacy').exists()).toBe(false)
  })

  it('data-kind="doc" (old .doc, legacy=true): application/legacy-office mime', async () => {
    const w = await mountWithFiles([mk('application/legacy-office/msword')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('doc')
    expect(tag.text()).toContain('DOC')
    expect(tag.find('.k-type-legacy').exists()).toBe(true)
    expect(tag.find('.k-type-legacy').text()).toBe('旧版')
  })

  it('data-kind="pdf"', async () => {
    const w = await mountWithFiles([mk('application/pdf')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('pdf')
    expect(tag.text()).toContain('PDF')
  })

  it('data-kind="txt" (text/plain)', async () => {
    const w = await mountWithFiles([mk('text/plain')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('txt')
    expect(tag.text()).toContain('TXT')
  })

  it('data-kind="code" (old .ppt, legacy=true): ms-powerpoint mime', async () => {
    const w = await mountWithFiles([mk('application/vnd.ms-powerpoint')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('code')
    expect(tag.text()).toContain('PPT')
    expect(tag.find('.k-type-legacy').exists()).toBe(true)
  })

  it('data-kind="md" (text/markdown)', async () => {
    const w = await mountWithFiles([mk('text/markdown')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('md')
    expect(tag.text()).toContain('MD')
  })

  it('type tag 的 title = file.mime 原文', async () => {
    const w = await mountWithFiles([mk('text/markdown')])
    expect(w.find('.k-type-tag').attributes('title')).toBe('text/markdown')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Size / time (fmtBytes/fmtRel/fmtAbs boundary already in util/indexedFilesView.test.ts
// (T7), here only verify component wires correct fields to these functions)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Size/time cells (wiring verification, boundary see T7 util tests)', () => {
  it('Size cell: text=fmtBytes(size), title=thousands separator bytes+" bytes"', async () => {
    const w = await mountWithFiles([FILE_OK])
    // Constrain to file row (header "vector count" column title span also has .k-frow-num, can't
    // use page findAll or index shifts relative to header span).
    const row = w.find('.k-frow-f:not(.k-frow-fhead)')
    const cell = row.findAll('.k-frow-num')[0] // 行内第一个 .k-frow-num 是大小列(向量数列另有 k-frow-vec 复合类)
    expect(cell.text()).toBe(fmtBytesRef(FILE_OK.size))
    expect(cell.attributes('title')).toBe(FILE_OK.size.toLocaleString() + ' bytes')
  })

  it('Time cell: title=fmtAbs(indexed_at)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-time').attributes('title')).toBe(fmtAbsRef(FILE_OK.indexed_at))
  })
})

// ──────────────────────────────────────────────────────────────────────
// Vector count — data-zero
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Vector count (data-zero, RED probe③ anchor)', () => {
  it('vector_count=0 → data-zero="true"', async () => {
    const w = await mountWithFiles([FILE_ZEROHINT])
    expect(w.find('.k-frow-vec').attributes('data-zero')).toBe('true')
    expect(w.find('.k-frow-vec').text().trim()).toBe('0')
  })

  it('vector_count!=0 → data-zero="false" (sides match)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-vec').attributes('data-zero')).toBe('false')
    expect(w.find('.k-frow-vec').text().trim()).toBe(FILE_OK.vector_count.toLocaleString())
  })
})

// ──────────────────────────────────────────────────────────────────────
// Rebuild button — disable conditions + three titles (documented placeholder, see file header comment)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Rebuild button (disable conditions + three titles)', () => {
  it('status=ok → not disabled, title/text="Force rebuild this row"/"Restore", icon refresh', async () => {
    const w = await mountWithFiles([FILE_OK])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBe('强制重建本行')
    expect(btn.text()).toContain('恢复')
  })

  it('status=error → not disabled, title/text same as ok (default branch, not indexing/tombstoned two exceptions)', async () => {
    const w = await mountWithFiles([FILE_ERROR])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBe('强制重建本行')
    expect(btn.text()).toContain('恢复')
  })

  it('status=indexing → disabled, title/text="Rebuilding…", icon spinner (exception 1/3)', async () => {
    const w = await mountWithFiles([FILE_INDEXING])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('重建中…')
    expect(btn.text()).toContain('重建中…')
  })

  it('status=tombstoned → disabled, title="Deleted, needs rescan to revive", text still "Restore" (exception 2/3, only title special, button text goes else branch)', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('已删除，需 rescan 复活')
    expect(btn.text()).toContain('恢复')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Expand button + inline detail panel
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — Expand button (data-open, K13 expSet) + inline detail panel', () => {
  it('Default collapsed: data-open="false", detail panel not rendered', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-expand').attributes('data-open')).toBe('false')
    expect(w.find('.k-file-detail').exists()).toBe(false)
  })

  it('Click expand: data-open="true", detail panel renders; click once more to collapse (sides match)', async () => {
    const w = await mountWithFiles([FILE_OK])
    await w.find('.k-frow-expand').trigger('click')
    await flush()
    expect(w.find('.k-frow-expand').attributes('data-open')).toBe('true')
    expect(w.find('.k-file-detail').exists()).toBe(true)
    await w.find('.k-frow-expand').trigger('click')
    await flush()
    expect(w.find('.k-frow-expand').attributes('data-open')).toBe('false')
    expect(w.find('.k-file-detail').exists()).toBe(false)
  })

  it('Expand button title = aiKbMore ("Browse more")', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-expand').attributes('title')).toBe('浏览更多')
  })

  // Fix round 1, I-2/M-3: pinpoint to specific field cell then compare value, not rely on "existence=true"
  // selector (`.k-fd-v.mono[title]` also hits `.k-fd-sha`, see I-2 notes).
  function fdValueFor(w: Awaited<ReturnType<typeof mountFiles>>, key: string) {
    const item = w.findAll('.k-fd-item').find((it) => it.find('.k-fd-k').text() === key)
    expect(item, `找不到字段格 "${key}"`).toBeTruthy()
    return item!.find('.k-fd-v')
  }

  it('详情面板 5 个字段格:parser_version/modalities_done/sha256_full/mime,tombstoned_at 条件出现(此行非 tombstoned,不出现)', async () => {
    const w = await mountWithFiles([FILE_OK])
    await w.find('.k-frow-expand').trigger('click')
    await flush()
    const keys = w.findAll('.k-fd-k').map((k) => k.text())
    expect(keys).toEqual(['parser_version', 'modalities_done', 'sha256_full', 'mime'])
    expect(w.find('.k-fd-sha').text()).toBe(FILE_OK.sha256_full)
    expect(w.find('.k-fd-sha').attributes('title')).toBe(FILE_OK.sha256_full)
    // M-3:parser_version / mime 两处值绑定此前零覆盖(评审探针⑨:三处同时换成
    // 常量后 107 例全绿),补上。
    expect(fdValueFor(w, 'parser_version').text()).toBe(FILE_OK.parser_version)
    expect(fdValueFor(w, 'mime').text()).toBe(FILE_OK.mime)
  })

  it('tombstoned_at 条件出现:tombstoned 行多一个字段格,mono 文字/title = fmtAbs(tombstoned_at)', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    await w.find('.k-frow-expand').trigger('click')
    await flush()
    const keys = w.findAll('.k-fd-k').map((k) => k.text())
    expect(keys).toEqual(['parser_version', 'modalities_done', 'sha256_full', 'tombstoned_at', 'mime'])
    // 修复轮 1,I-2:`.k-fd-v.mono[title]` 是恒真断言 —— `.k-fd-sha`
    // (class="k-fd-v mono k-fd-sha" :title="...")同样命中这个选择器,只要详情
    // 面板渲染出来这条就永真,与 tombstoned_at 格本身的值毫无关系(评审探针⑧:
    // 把这一格整体换成 `WRONG` 常量后 107 例全绿)。改成先定位到 tombstoned_at
    // 自己的格,再比文字与 title 两侧都等于 fmtAbs(tombstoned_at)。
    const cell = fdValueFor(w, 'tombstoned_at')
    const expected = fmtAbsRef(FILE_TOMBSTONED.tombstoned_at)
    expect(cell.text()).toBe(expected)
    expect(cell.attributes('title')).toBe(expected)
  })

  it('modalities_done 非空时渲染 chip 列表,空时渲染 "—"(两侧对照,含回落值断言)', async () => {
    const w1 = await mountWithFiles([FILE_OK]) // modalities_done: { text: 'bge-m3/v1' }
    await w1.find('.k-frow-expand').trigger('click')
    await flush()
    expect(w1.findAll('.k-fd-mod').map((m) => m.text())).toEqual(['text'])

    const w2 = await mountWithFiles([FILE_ERROR]) // modalities_done: {}
    await w2.find('.k-frow-expand').trigger('click')
    await flush()
    expect(w2.find('.k-fd-mods').exists()).toBe(false)
    // M-3:用例名声称"空时渲染 —"但此前只断言了 .k-fd-mods 不存在,没断言 —
    // 这个回落值本身(评审探针⑨点名的第三处零覆盖)。
    expect(fdValueFor(w2, 'modalities_done').text()).toBe('—')
  })

  it('last_error 条:有值时渲染 .k-fd-error,无值时不渲染(两侧对照)', async () => {
    const w1 = await mountWithFiles([FILE_ERROR])
    await w1.find('.k-frow-expand').trigger('click')
    await flush()
    expect(w1.find('.k-fd-error').exists()).toBe(true)
    expect(w1.find('.k-fd-error').text()).toContain(FILE_ERROR.last_error)

    const w2 = await mountWithFiles([FILE_OK])
    await w2.find('.k-frow-expand').trigger('click')
    await flush()
    expect(w2.find('.k-fd-error').exists()).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Pagination — boundary of four computations currentPage/pageCount/pageFrom/pageTo
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 分页边界(total=0 / 恰好整除 / 末页)', () => {
  it('total=0:pageState=empty,pager 不渲染;直接读组件内部 computed 确认边界值(state 存在但入口未渲染,同 T8 established 技巧)', async () => {
    const w = await mountWithFiles([], 0)
    expect(w.find('.k-pager').exists()).toBe(false)
    const vm = w.vm as unknown as { pageFrom: number; pageTo: number; pageCount: number }
    expect(vm.pageFrom).toBe(0)
    expect(vm.pageTo).toBe(0)
    expect(vm.pageCount).toBe(1) // Math.max(1, …) 兜底
  })

  it('total 恰好整除 limit:第 2(末)页,pageFrom/pageTo 精确、下一页禁用、上一页启用(RED 探针②的钉子)', async () => {
    const w = await mountWithFiles([FILE_OK], 16)
    const store = useKnowledgeStore()
    store.indexedFiles.filters.limit = 8
    store.indexedFiles.filters.offset = 8 // 第 2 页,16/8 恰好整除,这是末页
    await flush()
    expect(w.find('.k-pager-page').text()).toBe('2 / 2')
    expect(w.find('.k-pager-info').text()).toBe('显示 9–16 / 16')
    expect(w.find('.k-pager button.k-btn').attributes('disabled')).toBeUndefined() // 上一页
    const nextBtn = w.findAll('.k-pager button.k-btn')[1]
    expect(nextBtn.attributes('disabled')).toBeDefined() // 下一页禁用(末页)
  })

  it('末页(不整除):total=17, limit=8, offset=16 → 第 3 页只有 1 条,pageTo 钳到 17 不越界', async () => {
    const w = await mountWithFiles([FILE_OK], 17)
    const store = useKnowledgeStore()
    store.indexedFiles.filters.limit = 8
    store.indexedFiles.filters.offset = 16
    await flush()
    expect(w.find('.k-pager-page').text()).toBe('3 / 3')
    expect(w.find('.k-pager-info').text()).toBe('显示 17–17 / 17')
    const nextBtn = w.findAll('.k-pager button.k-btn')[1]
    expect(nextBtn.attributes('disabled')).toBeDefined()
  })

  it('首页:上一页禁用,下一页启用(两侧对照)', async () => {
    const w = await mountWithFiles([FILE_OK], 16)
    const store = useKnowledgeStore()
    store.indexedFiles.filters.limit = 8
    store.indexedFiles.filters.offset = 0
    await flush()
    const prevBtn = w.findAll('.k-pager button.k-btn')[0]
    const nextBtn = w.findAll('.k-pager button.k-btn')[1]
    expect(prevBtn.attributes('disabled')).toBeDefined()
    expect(nextBtn.attributes('disabled')).toBeUndefined()
  })

  it('点击「上一步」/「下一步」推进 offset 并重载', async () => {
    const w = await mountWithFiles([FILE_OK], 24)
    const store = useKnowledgeStore()
    store.indexedFiles.filters.limit = 8
    store.indexedFiles.filters.offset = 8
    await flush()
    ai.parserFiles.mockClear()
    await w.findAll('.k-pager button.k-btn')[1].trigger('click') // 下一步
    await flush()
    expect(store.indexedFiles.filters.offset).toBe(16)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)

    ai.parserFiles.mockClear()
    await w.findAll('.k-pager button.k-btn')[0].trigger('click') // 上一步
    await flush()
    expect(store.indexedFiles.filters.offset).toBe(8)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('每页条数下拉:4 档 [50,100,200,500],切换后清选择 + 归零 offset + 重载(不清 errorBanner,与 _applyFilter 不同)', async () => {
    const w = await mountWithFiles([FILE_OK], 300)
    const store = useKnowledgeStore()
    const opts = w.find('.k-pager-size select').findAll('option')
    expect(opts.map((o) => o.text())).toEqual(['50', '100', '200', '500'])
    store.indexedFiles.filters.offset = 100
    ;(w.vm as unknown as { errorBanner: string | null }).errorBanner = 'stale banner text'
    await flush()
    ai.parserFiles.mockClear()
    await w.find('.k-pager-size select').setValue('200')
    await flush()
    expect(store.indexedFiles.filters.limit).toBe(200)
    expect(store.indexedFiles.filters.offset).toBe(0)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
    // 与 _applyFilter 不同:onPageSizeChange 不清 errorBanner(蓝本本来就没这行,照抄不补齐)
    expect((w.vm as unknown as { errorBanner: string | null }).errorBanner).toBe('stale banner text')
  })
})

// ──────────────────────────────────────────────────────────────────────
// Multi-select checkboxes (read+write, this cut's scope; selectedCount/action bar/confirm dialog is T10)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 多选复选框(toggleRow/toggleAll,attribute 两侧对照)', () => {
  it('.k-frow-f data-selected 两侧都覆盖:勾选行 checkbox → true,再取消 → false', async () => {
    const w = await mountWithFiles([FILE_OK])
    const row = () => w.find('.k-frow-f:not(.k-frow-fhead)')
    expect(row().attributes('data-selected')).toBe('false')
    await row().find('.k-row-check').setValue(true)
    await flush()
    expect(row().attributes('data-selected')).toBe('true')
    await row().find('.k-row-check').setValue(false)
    await flush()
    expect(row().attributes('data-selected')).toBe('false')
  })

  it('tombstoned 行的复选框禁用,title=aiKbTombstonedNoSelect', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    const cb = w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check')
    expect(cb.attributes('disabled')).toBeDefined()
    expect(cb.attributes('title')).toBe('已删除文件不可选')
  })

  it('非 tombstoned 行复选框不禁用,title 为空字符串', async () => {
    const w = await mountWithFiles([FILE_OK])
    const cb = w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check')
    expect(cb.attributes('disabled')).toBeUndefined()
    expect(cb.attributes('title')).toBe('')
  })

  it('全选:点击表头复选框选中所有可选行(排除 tombstoned),再点一次取消全选', async () => {
    const w = await mountWithFiles([FILE_OK, FILE_ERROR, FILE_TOMBSTONED])
    await w.find('.k-frow-fhead .k-row-check').setValue(true)
    await flush()
    const rows = w.findAll('.k-frow-f:not(.k-frow-fhead)')
    expect(rows[0].attributes('data-selected')).toBe('true') // FILE_OK
    expect(rows[1].attributes('data-selected')).toBe('true') // FILE_ERROR
    expect(rows[2].attributes('data-selected')).toBe('false') // FILE_TOMBSTONED,不可选,全选不影响它
    await w.find('.k-frow-fhead .k-row-check').setValue(false)
    await flush()
    expect(rows[0].attributes('data-selected')).toBe('false')
    expect(rows[1].attributes('data-selected')).toBe('false')
  })

  it('.k-frow-f data-done:baseline 恒为 false(doneSet 本刀只读不写);直接改内部 ref 验证「true」侧渲染正确(状态存在但写入口留给 T10,同 T8 established 技巧)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const row = () => w.find('.k-frow-f:not(.k-frow-fhead)')
    expect(row().attributes('data-done')).toBe('false')
    ;(w.vm as unknown as { doneSet: Set<string> }).doneSet = new Set([FILE_OK.file_id])
    await flush()
    expect(row().attributes('data-done')).toBe('true')
  })

  it('.k-frow-f data-status 直接透传 file.status(ok/indexing/error/tombstoned 四值)', async () => {
    for (const [file, status] of [
      [FILE_OK, 'ok'],
      [FILE_INDEXING, 'indexing'],
      [FILE_ERROR, 'error'],
      [FILE_TOMBSTONED, 'tombstoned'],
    ] as const) {
      const w = await mountWithFiles([file])
      expect(w.find('.k-frow-f:not(.k-frow-fhead)').attributes('data-status')).toBe(status)
      w.unmount()
    }
  })
})

// ──────────────────────────────────────────────────────────────────────
// RED probe② anchor (pageTo's Math.min) and probe③ (data-zero) already hung in corresponding
// describe above (see comment marks), not repeating here.
// ──────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════
// SP8-P5b Task 10 — Third cut (final): three rebuild entry points + dual caps + K7 confirm dialog +
// bottom action bar + polling close. All below newly added this cut.
//
// Mock shape sources (governance §4, no hand-editing, documented individually):
//   ai.parserReindexFiles success → `REINDEX_OK`, verbatim from `p5b-fixtures/reindex-one.http`
//     200 response body (`{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`, snake_case,
//     §4.1 endpoint in-package zero transformation).
//   ai.parserReindexFiles 400 (file_ids exceeded) → `CAP_400_FILE_IDS`, verbatim from
//     `p5b-fixtures/reindex-cap-400.http` (`{"detail":"too many file_ids (max 500)"}`,
//     **already tested**). ⚠️ Backend uses same message for "empty array" and ">500" (§4.4).
//   ai.parserReindexFiles 400 (filter exceeded) → `CAP_400_FILTER`, shape from fixture README
//     "not tested · source-inferred shape" section (`{"detail":"filter matches {n} files (> 10000);
//     narrow it or raise max_reindex_by_filter"}`, `service_reindex.py:53-58`).
//     🔴 Device has only 8 files, 10000 cap doesn't trigger, this **source-inferred, not tested**,
//     using shape per README (noted in report).
//   CAP_ROW_TEMPLATE / capIds() — 500/501 boundary selection needs 501 different file_ids.
//     Row shape still ok rows from `files-all-8.json` (directly spread FILE_OK only swap file_id),
//     not newly authored schema.
//
// 501 row boundary driven: `overExplicitCap` only reads `selSet.size` (blueprint :484-485),
// unrelated to "whether these ids on current page", so boundary test directly writes internal
// `selSet` (T8/T9 established `w.vm` read/write `<script setup>` top-level ref technique), doesn't
// mount 501 real rows — assertions still land on real DOM (action bar `data-active` / `.k-ab-warn` /
// button `disabled`), not reading component internal state self-proving.
// ══════════════════════════════════════════════════════════════════════

// 逐字取自 p5b-fixtures/reindex-cap-400.http(已实测)。
const CAP_400_FILE_IDS = { response: { data: { detail: 'too many file_ids (max 500)' } } }
// 取自 fixture README「未实测 · 源码推定」表(filter 模式超限)。
const CAP_400_FILTER = {
  response: {
    data: {
      detail:
        'filter matches 12345 files (> 10000); narrow it or raise max_reindex_by_filter',
    },
  },
}

// FILE_OK(= FILES_ALL_8[1],真实 fixture 行)换 file_id,造够 501 个不同 id。
function capIds(n: number): Set<string> {
  return new Set(Array.from({ length: n }, (_, i) => `cap-probe-${i}`))
}

// K7:弹窗 portal 目标 —— 本视图独立挂载时不在 .knowledge-app 子树里(生产环境
// 由 KnowledgeLayout.vue 提供),测试须先在 body 里放一个同名宿主
// (先例 QueueView.test.ts::withHost() / SkillDetail.test.ts::withHost())。
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** 与 mountWithFiles 相同,只是 attachTo document.body —— 照 T5 挂 reka 弹窗用例
 * 的既有写法(reka 的 DismissableLayer 往 document 上挂 pointerdown 监听)。 */
async function mountAttachedWithFiles(fileArr: unknown[], total = fileArr.length) {
  ai.parserFiles.mockResolvedValueOnce({ total, limit: 100, offset: 0, files: fileArr })
  const w = mount(IndexedFilesView, {
    global: { plugins: [i18n] },
    attachTo: document.body,
  } as never)
  mountedWrappers.push(w)
  await flush()
  return w
}

const setSel = (w: ReturnType<typeof mount>, s: Set<string>) => {
  ;(w.vm as unknown as { selSet: Set<string> }).selSet = s
}

// ──────────────────────────────────────────────────────────────────────
// 底部粘性动作条(蓝本 :322-353)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 底部粘性动作条(蓝本 :322-353)', () => {
  it('data-active 两侧都断言:未选中 "false",勾选一行后 "true",再取消回 "false"(直接比字符串值)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const bar = () => w.find('.k-files-actionbar')
    expect(bar().exists()).toBe(true)
    expect(bar().attributes('data-active')).toBe('false')
    await w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check').setValue(true)
    await flush()
    expect(bar().attributes('data-active')).toBe('true')
    await w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check').setValue(false)
    await flush()
    expect(bar().attributes('data-active')).toBe('false')
  })

  it('.k-ab-info 未选中时是提示文案、选中后换成「已选 {n} 项」(两侧对照,提示文案此时消失)', async () => {
    const w = await mountWithFiles([FILE_OK, FILE_ERROR])
    expect(w.find('.k-ab-info').text()).toBe('勾选文件后可批量强制重建')
    await w.find('.k-frow-fhead .k-row-check').setValue(true)
    await flush()
    expect(w.find('.k-ab-info').text()).toBe('已选 2 项')
    expect(w.find('.k-ab-info').text()).not.toContain('勾选文件后可批量强制重建')
  })

  it('「重建该 Root 全部」按钮:文案 + total>0 时不禁用、title 是匹配数提示', async () => {
    const w = await mountWithFiles([FILE_OK], 8)
    const btn = w.find('.k-files-actionbar .k-btn.outline')
    expect(btn.text()).toContain('重建该 Root 全部')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBe('重建当前筛选匹配的 8 个文件')
  })

  it('「重建该 Root 全部」按钮:total===0 时禁用、title 换成「没有匹配的文件」(两侧对照)', async () => {
    ai.parserFiles.mockReset()
    ai.parserFiles.mockResolvedValue(EMPTY_RESULT)
    const w = await mountFiles()
    const btn = w.find('.k-files-actionbar .k-btn.outline')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('没有匹配的文件')
  })

  it('「重建选中 ({n})」按钮:未选中时文案带 0 且禁用;选中 1 行后文案变 1 且启用(两侧对照)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const btn = () => w.find('.k-files-actionbar .k-btn.primary')
    expect(btn().text()).toContain('重建选中 (0)')
    expect(btn().attributes('disabled')).toBeDefined()
    await w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check').setValue(true)
    await flush()
    expect(btn().text()).toContain('重建选中 (1)')
    expect(btn().attributes('disabled')).toBeUndefined()
  })

  it('title 的千分位:total=12345 → 「重建当前筛选匹配的 12,345 个文件」', async () => {
    const w = await mountWithFiles([FILE_OK], 12345)
    expect(w.find('.k-files-actionbar .k-btn.outline').attributes('title')).toBe(
      '重建当前筛选匹配的 12,345 个文件',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────
// 🔴 双上限的阈值两侧 —— EXPLICIT_REBUILD_CAP = 500(前端硬拦)
// 承 P5a T6 教训:不钉两侧等于没测(`fmtAgo` 的 h<24 改成 h<48 曾 16/16 全绿)。
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — EXPLICIT_REBUILD_CAP 阈值两侧(500 / 501)', () => {
  it('选中 500 个(= 上限,后端判据是 len > 500)→ 不超限:无警告、「重建选中」可点', async () => {
    const w = await mountWithFiles([FILE_OK])
    setSel(w, capIds(500))
    await flush()
    expect(w.find('.k-files-actionbar').attributes('data-active')).toBe('true')
    expect(w.find('.k-ab-info').text()).toContain('已选 500 项')
    expect(w.find('.k-ab-warn').exists()).toBe(false)
    expect(w.find('.k-files-actionbar .k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('选中 501 个(> 上限)→ 超限:出 .k-ab-warn 警告、「重建选中」禁用(RED 探针①的钉子:> 改 >= 会让 500 那条报红)', async () => {
    const w = await mountWithFiles([FILE_OK])
    setSel(w, capIds(501))
    await flush()
    expect(w.find('.k-ab-info').text()).toContain('已选 501 项')
    const warn = w.find('.k-ab-warn')
    expect(warn.exists()).toBe(true)
    expect(warn.text()).toBe('超过 500 上限，请改用整库重建')
    expect(w.find('.k-files-actionbar .k-btn.primary').attributes('disabled')).toBeDefined()
  })

  it('超限时 rebuildSelected 直接 return(蓝本 :773 的双保险):即便绕过 disabled 也一个请求都不发', async () => {
    const w = await mountWithFiles([FILE_OK])
    setSel(w, capIds(501))
    await flush()
    ai.parserReindexFiles.mockClear()
    // 绕过 disabled 直接调内部函数 —— 正是这条守卫存在的意义(键盘/程序化调用)。
    await (w.vm as unknown as { rebuildSelected: () => Promise<void> }).rebuildSelected()
    await flush()
    expect(ai.parserReindexFiles).not.toHaveBeenCalled()
  })

  it('选中 0 个时 rebuildSelected 同样直接 return(蓝本 :773 前半个条件)', async () => {
    const w = await mountWithFiles([FILE_OK])
    ai.parserReindexFiles.mockClear()
    await (w.vm as unknown as { rebuildSelected: () => Promise<void> }).rebuildSelected()
    await flush()
    expect(ai.parserReindexFiles).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────
// 🔴 双上限的阈值两侧 —— FILTER_REBUILD_CAP = 10000(前端只警告,真拦在后端)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — FILTER_REBUILD_CAP 阈值两侧(10000 / 10001)', () => {
  it('total=10000(= 上限,后端判据是 n > 10000)→ 弹窗里**不出**超限横幅', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 10000)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    expect(host.querySelector('.k-modal .k-banner')).toBeNull()
  })

  it('total=10001(> 上限)→ 弹窗里出超限横幅,文案带两个千分位数字(两侧对照)', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 10001)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const banner = host.querySelector('.k-modal .k-banner')
    expect(banner).not.toBeNull()
    expect(banner!.getAttribute('data-tone')).toBe('warn')
    expect(banner!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '共 10,001 个文件，超过单次 10,000 上限，服务器可能会拒绝（400）。请缩小路径前缀后分批重建。',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────
// 🔴 indeterminate 四种组合(T9 已落地那两个 watch,本刀补测试覆盖)
// jsdom 下 `indeterminate` 可读写但无视觉表现 → 断言读 DOM 属性本身。
// 每条都设计成「先经历相反状态、再回落」,不靠挂载后的 DOM 默认值蒙对
// (RED 探针⑤:把两个 watch 里的赋值删掉,下面 2/4 与 4/4 会报红)。
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 全选复选框的 indeterminate(四种组合)', () => {
  const indet = (w: ReturnType<typeof mount>) =>
    (w.find('.k-frow-fhead .k-row-check').element as HTMLInputElement).indeterminate

  it('1/4 全不选:先勾一行让它变 true,再取消 → 回 false(不是靠挂载默认值蒙对)', async () => {
    const w = await mountWithFiles([FILE_OK, FILE_ERROR])
    const rowCheck = () => w.findAll('.k-frow-f:not(.k-frow-fhead) .k-row-check')[0]
    await rowCheck().setValue(true)
    await flush()
    expect(indet(w)).toBe(true) // 中间态,证明下一步的 false 不是恒 false
    await rowCheck().setValue(false)
    await flush()
    expect(indet(w)).toBe(false)
    expect((w.find('.k-frow-fhead .k-row-check').element as HTMLInputElement).checked).toBe(false)
  })

  it('2/4 部分选(2 行里选 1 行)→ indeterminate=true,且全选框自身 checked=false', async () => {
    const w = await mountWithFiles([FILE_OK, FILE_ERROR])
    await w.findAll('.k-frow-f:not(.k-frow-fhead) .k-row-check')[0].setValue(true)
    await flush()
    expect(indet(w)).toBe(true)
    expect((w.find('.k-frow-fhead .k-row-check').element as HTMLInputElement).checked).toBe(false)
  })

  it('3/4 全选(2 行全选中)→ indeterminate=false(先经过部分选的 true 再补齐第二行)', async () => {
    const w = await mountWithFiles([FILE_OK, FILE_ERROR])
    const rows = () => w.findAll('.k-frow-f:not(.k-frow-fhead) .k-row-check')
    await rows()[0].setValue(true)
    await flush()
    expect(indet(w)).toBe(true) // 中间态
    await rows()[1].setValue(true)
    await flush()
    expect(indet(w)).toBe(false)
    expect((w.find('.k-frow-fhead .k-row-check').element as HTMLInputElement).checked).toBe(true)
  })

  it('4/4 可选行为 0:先在有可选行时变 true,再让当前页只剩 tombstoned 行 → indeterminate 回 false 且全选框禁用', async () => {
    // 需要**两个**可选行才能造出「部分选」中间态(只有一个可选行时,选它就等于
    // 全选,allSelected 立刻为真、indeterminate 恒 false)。
    const w = await mountWithFiles([FILE_OK, FILE_ERROR, FILE_TOMBSTONED])
    await w.findAll('.k-frow-f:not(.k-frow-fhead) .k-row-check')[0].setValue(true)
    await flush()
    expect(indet(w)).toBe(true) // 中间态(2 个可选行里选中 1 个)
    // 模拟切到「只看已删除」后重载:当前页零可选行,但 selSet 里还留着上一页的 id。
    useKnowledgeStore().indexedFiles.files = [FILE_TOMBSTONED] as never
    await flush()
    expect(w.find('.k-frow-fhead .k-row-check').attributes('disabled')).toBeDefined()
    expect(indet(w)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────
// rebuildRow(T9 留的空占位,本刀补全)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — rebuildRow(蓝本 :760-770)', () => {
  it('点行内「恢复」按钮:派 file_ids + reason、toast「已入队 1 个任务」、起轮询', async () => {
    const w = await mountWithFiles([FILE_OK])
    const store = useKnowledgeStore()
    const toast = vi.spyOn(store, 'toast')
    const poll = vi.spyOn(store, 'startIndexedPolling')
    await w.find('.k-rebuild-btn').trigger('click')
    await flush()
    expect(ai.parserReindexFiles).toHaveBeenCalledWith({
      file_ids: [FILE_OK.file_id],
      reason: 'rebuild row',
    })
    expect(toast).toHaveBeenCalledWith('已入队 1 个任务')
    expect(poll).toHaveBeenCalled()
  })

  it('toast 的 {n} 取响应体的 queued(不是写死 1):queued=7 → 「已入队 7 个任务」', async () => {
    const w = await mountWithFiles([FILE_OK])
    const store = useKnowledgeStore()
    const toast = vi.spyOn(store, 'toast')
    ai.parserReindexFiles.mockResolvedValueOnce({ ...REINDEX_OK, queued: 7 })
    await w.find('.k-rebuild-btn').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('已入队 7 个任务')
  })

  it('K5:失败只弹固定「重建失败」,不回显 e.message / 后端 detail(反向断言)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const store = useKnowledgeStore()
    const toast = vi.spyOn(store, 'toast')
    ai.parserReindexFiles.mockRejectedValueOnce(
      Object.assign(new Error('ECONNREFUSED secret-stack-trace'), CAP_400_FILE_IDS),
    )
    await w.find('.k-rebuild-btn').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('重建失败')
    const said = toast.mock.calls.map((c) => String(c[0])).join(' | ')
    expect(said).not.toContain('ECONNREFUSED')
    expect(said).not.toContain('too many file_ids')
  })
})

// ──────────────────────────────────────────────────────────────────────
// 🔴 _flashDone 的 2200 ms —— fake timers 断言「加」与「撤」两侧
// (RED 探针②:删掉 setTimeout → 「撤」那侧报红)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — _flashDone 2200 ms 绿闪(蓝本 :811-823)', () => {
  it('重建成功后该行 data-done 立刻 true;2199 ms 仍 true;满 2200 ms 后撤成 false', async () => {
    vi.useFakeTimers()
    try {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      // 用非 Once 的 mock:store 的 reindexIndexedByIds 内部会再 loadIndexedFiles
      // 一次,列表必须稳定返回同一行,否则 data-done 的宿主行会被换掉。
      ai.parserFiles.mockResolvedValue({ total: 1, limit: 100, offset: 0, files: [FILE_OK] })
      ai.parserReindexFiles.mockResolvedValue(REINDEX_OK)
      const w = mount(IndexedFilesView, { global: { plugins: [i18n] } })
      mountedWrappers.push(w)
      await flushPromises()
      await nextTick()

      const row = () => w.find('.k-frow-f:not(.k-frow-fhead)')
      expect(row().attributes('data-done')).toBe('false')

      await w.find('.k-rebuild-btn').trigger('click')
      await flushPromises()
      await nextTick()
      expect(row().attributes('data-done')).toBe('true') // 「加」侧

      vi.advanceTimersByTime(2199)
      await flushPromises()
      await nextTick()
      expect(row().attributes('data-done')).toBe('true') // 还没到点,精确钉住 2200

      vi.advanceTimersByTime(1)
      await flushPromises()
      await nextTick()
      expect(row().attributes('data-done')).toBe('false') // 「撤」侧
    } finally {
      vi.useRealTimers()
    }
  })

  it('rebuildSelected 不绿闪(蓝本 :772-784 没有调 _flashDone,只有 rebuildRow 有)', async () => {
    vi.useFakeTimers()
    try {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      ai.parserFiles.mockResolvedValue({ total: 1, limit: 100, offset: 0, files: [FILE_OK] })
      ai.parserReindexFiles.mockResolvedValue(REINDEX_OK)
      const w = mount(IndexedFilesView, { global: { plugins: [i18n] } })
      mountedWrappers.push(w)
      await flushPromises()
      await nextTick()
      await w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check').setValue(true)
      await nextTick()
      await w.find('.k-files-actionbar .k-btn.primary').trigger('click')
      await flushPromises()
      await nextTick()
      expect(w.find('.k-frow-f:not(.k-frow-fhead)').attributes('data-done')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })
})

// ──────────────────────────────────────────────────────────────────────
// rebuildSelected(蓝本 :772-784)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — rebuildSelected(蓝本 :772-784)', () => {
  it('选中两行后点「重建选中」:派全部选中 id + reason、toast、起轮询、清空选择', async () => {
    const w = await mountWithFiles([FILE_OK, FILE_ERROR])
    const store = useKnowledgeStore()
    const toast = vi.spyOn(store, 'toast')
    const poll = vi.spyOn(store, 'startIndexedPolling')
    await w.find('.k-frow-fhead .k-row-check').setValue(true)
    await flush()
    expect(w.find('.k-ab-info').text()).toBe('已选 2 项')
    await w.find('.k-files-actionbar .k-btn.primary').trigger('click')
    await flush()
    expect(ai.parserReindexFiles).toHaveBeenCalledWith({
      file_ids: [FILE_OK.file_id, FILE_ERROR.file_id],
      reason: 'rebuild selected',
    })
    expect(toast).toHaveBeenCalledWith('已入队 1 个任务')
    expect(poll).toHaveBeenCalled()
    // 蓝本 :778 —— 成功后清空选择,动作条回到未选中态(两侧对照)
    expect(w.find('.k-ab-info').text()).toBe('勾选文件后可批量强制重建')
    expect(w.find('.k-files-actionbar').attributes('data-active')).toBe('false')
  })

  it('失败时**不清空**选择(蓝本 :778 在 try 里、catch 里没有),并走 K5 固定文案', async () => {
    const w = await mountWithFiles([FILE_OK])
    const store = useKnowledgeStore()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-frow-f:not(.k-frow-fhead) .k-row-check').setValue(true)
    await flush()
    ai.parserReindexFiles.mockRejectedValueOnce(
      Object.assign(new Error('boom-secret'), CAP_400_FILE_IDS),
    )
    await w.find('.k-files-actionbar .k-btn.primary').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('重建失败')
    expect(w.find('.k-ab-info').text()).toBe('已选 1 项')
    const said = toast.mock.calls.map((c) => String(c[0])).join(' | ')
    expect(said).not.toContain('boom-secret')
    expect(said).not.toContain('too many file_ids')
  })
})

// ──────────────────────────────────────────────────────────────────────
// K7:整库重建确认弹窗(reka Dialog 原语,portal 到 .knowledge-app)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — K7:整库重建确认弹窗(蓝本 :355-381)', () => {
  it('点「重建该 Root 全部」打开弹窗(portal 到 .knowledge-app,不在组件子树里),标题/两段正文/两个按钮文案正确', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    expect(host.querySelector('.k-modal')).toBeNull()
    // 反向确认:弹窗不是渲染在组件自身子树里(K7 要求 portal 到知识库容器)
    expect(w.find('.k-modal').exists()).toBe(false)

    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    expect(modal!.querySelector('.k-confirm-title')!.textContent).toBe('重建整个匹配集合？')
    const summary = modal!.querySelector('.k-confirm-summary')!.textContent!.replace(/\s+/g, ' ').trim()
    expect(summary).toBe(
      '将强制全部重新索引当前筛选匹配的 8 个文件，可能耗时数分钟。 后端会先墓碑再重新入队，旧的搜索内容会被新内容覆盖。',
    )
    const btns = Array.from(modal!.querySelectorAll('.k-modal-foot button')).map((b) =>
      b.textContent!.trim(),
    )
    expect(btns).toEqual(['取消', '确认重建 8 个'])
    // reka a11y:DialogContent 就是 role=dialog,且 VisuallyHidden 包的 DialogTitle
    // 通过 aria-labelledby 挂上去(缺了它 reka 会在控制台告警)。
    expect(modal!.getAttribute('role')).toBe('dialog')
    const labelId = modal!.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(host.querySelector(`#${labelId}`)!.textContent).toBe('重建整个匹配集合？')
  })

  it('total===0 时按钮禁用,openRebuildAllConfirm 即便被直接调用也不开弹窗(蓝本 :787 的守卫)', async () => {
    const host = withHost()
    ai.parserFiles.mockReset()
    ai.parserFiles.mockResolvedValue(EMPTY_RESULT)
    const w = await mountAttachedWithFiles([], 0)
    expect(w.find('.k-files-actionbar .k-btn.outline').attributes('disabled')).toBeDefined()
    ;(w.vm as unknown as { openRebuildAllConfirm: () => void }).openRebuildAllConfirm()
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
  })

  it('点「取消」关闭弹窗且不发请求', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    ai.parserReindexFiles.mockClear()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => b.textContent!.trim() === '取消',
    ) as HTMLElement
    cancel.click()
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.parserReindexFiles).not.toHaveBeenCalled()
  })

  it('点「确认重建」发 filter 请求、toast、起轮询,并关闭弹窗', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    const store = useKnowledgeStore()
    const toast = vi.spyOn(store, 'toast')
    const poll = vi.spyOn(store, 'startIndexedPolling')
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const confirm = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('确认重建'),
    ) as HTMLElement
    confirm.click()
    await flush()
    expect(ai.parserReindexFiles).toHaveBeenCalledWith({
      filter: { tombstoned: 'alive' },
      reason: 'rebuild all matching',
    })
    expect(toast).toHaveBeenCalledWith('已入队 1 个任务')
    expect(poll).toHaveBeenCalled()
    expect(host.querySelector('.k-modal')).toBeNull()
  })

  it('点遮罩(弹窗外部)关闭;点弹窗内部不关闭(reka pointerDownOutside 等价蓝本 :356 @click / :357 @click.stop)', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    // reka 的 usePointerDownOutside 用 setTimeout(0) 延后挂 document 的 pointerdown
    // 监听(见 T5 QueueView.test.ts 同款注释),补一次真宏任务 tick。
    await new Promise((resolve) => setTimeout(resolve, 0))

    const titleEl = host.querySelector('.k-confirm-title') as HTMLElement
    titleEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    const overlayEl = host.querySelector('.k-modal-bg') as HTMLElement
    overlayEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────
// 🔴 doRebuildAll 的 filterObj 组装:四个条件各一条 + 全空一条
// (RED 探针③:删掉 `tombstoned !== 'all'` 判据 → 「全空」那条报红)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — doRebuildAll 的 filterObj 组装(蓝本 :793-799)', () => {
  /**
   * 打开弹窗 → 点确认 → 返回实际发出去的 filter 对象。
   * 🔴 一个用例里可能连调两次(两侧对照),所以进来先把上一轮的 wrapper 与 portal
   * 宿主清干净 —— `DialogPortal to=".knowledge-app"` 用的是 `document.querySelector`,
   * 只认**第一个**同名宿主;不清理的话第二轮的弹窗会落进第一轮遗留的宿主里,
   * 本轮 `host.querySelectorAll` 一个按钮都找不到(实测踩过)。
   */
  async function rebuildAllWith(
    patch: Partial<Record<'path_prefix' | 'mime_prefix' | 'has_error' | 'tombstoned', unknown>>,
  ): Promise<Record<string, unknown>> {
    while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
    document.querySelectorAll('.knowledge-app').forEach((el) => el.remove())
    setActivePinia(createPinia())
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    Object.assign(useKnowledgeStore().indexedFiles.filters, patch)
    await flush()
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const confirm = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('确认重建'),
    ) as HTMLElement
    confirm.click()
    await flush()
    // 本仓 tsconfig 的 lib 低于 es2022,`Array.prototype.at` 无类型声明(TS2550),
    // 改用等价的下标写法。
    const calls = ai.parserReindexFiles.mock.calls
    const call = calls[calls.length - 1][0] as { filter: Record<string, unknown> }
    return call.filter
  }

  it('1/5 全空:tombstoned="all" 且其余三项默认 → filter 是 {}(证明 `tombstoned !== "all"` 判据真的在起作用)', async () => {
    expect(await rebuildAllWith({ tombstoned: 'all' })).toEqual({})
  })

  it('2/5 path_prefix 非空 → 带 path_prefix', async () => {
    expect(await rebuildAllWith({ tombstoned: 'all', path_prefix: '/DATA/Wiki/' })).toEqual({
      path_prefix: '/DATA/Wiki/',
    })
  })

  it('3/5 mime_prefix 非空 → 带 mime_prefix', async () => {
    expect(
      await rebuildAllWith({ tombstoned: 'all', mime_prefix: 'application/legacy-office/' }),
    ).toEqual({ mime_prefix: 'application/legacy-office/' })
  })

  it('4/5 has_error=true → 带 has_error;false 时不带(两侧对照)', async () => {
    expect(await rebuildAllWith({ tombstoned: 'all', has_error: true })).toEqual({
      has_error: true,
    })
    expect(await rebuildAllWith({ tombstoned: 'all', has_error: false })).toEqual({})
  })

  it('5/5 tombstoned 非 "all" → 带 tombstoned(默认 "alive" 与显式 "tombstoned" 各一次)', async () => {
    expect(await rebuildAllWith({})).toEqual({ tombstoned: 'alive' })
    expect(await rebuildAllWith({ tombstoned: 'tombstoned' })).toEqual({
      tombstoned: 'tombstoned',
    })
  })

  it('四项同时非默认 → 四个字段一起带上', async () => {
    expect(
      await rebuildAllWith({
        path_prefix: '/DATA/',
        mime_prefix: 'text/',
        has_error: true,
        tombstoned: 'tombstoned',
      }),
    ).toEqual({
      path_prefix: '/DATA/',
      mime_prefix: 'text/',
      has_error: true,
      tombstoned: 'tombstoned',
    })
  })
})

// ──────────────────────────────────────────────────────────────────────
// 🔴 K14 —— 走真实入口(doRebuildAll)的 400 分支反向断言
// T8 那条是用 wrapper.vm 直接塞 errorBanner 驱动的(当时没有真实入口),
// **本刀不削弱它**,而是补上真实入口这一半:后端 400 带 detail → DOM 不含 detail。
// (RED 探针④:把渲染改回回显 detail → 下面两条一起报红)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — K14 真实入口:doRebuildAll 400 不回显后端 detail', () => {
  it('filter 超限 400 → 警示条只有「400 Bad Request」+ aiKbRebuildCapHint,后端 detail 一个字都没有', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    ai.parserReindexFiles.mockRejectedValueOnce(CAP_400_FILTER)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const confirm = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('确认重建'),
    ) as HTMLElement
    confirm.click()
    await flush()

    const banner = w.find('.k-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.attributes('data-tone')).toBe('warn')
    expect(banner.text()).toContain('400 Bad Request')
    expect(banner.text()).toContain('重建匹配文件超过 10,000 上限')
    // 反向断言:后端 detail 原文一个字都不能出现
    expect(banner.text()).not.toContain('filter matches')
    expect(banner.text()).not.toContain('12345')
    expect(banner.text()).not.toContain('max_reindex_by_filter')
    // 弹窗必须已关(蓝本 :792 第一行就关,失败也不重开)
    expect(host.querySelector('.k-modal')).toBeNull()
  })

  it('普通网络错误(无 response.data.detail)同样只渲染固定文案,不回显 e.message', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    ai.parserReindexFiles.mockRejectedValueOnce(new Error('ECONNREFUSED leak-me-please'))
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const confirm = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('确认重建'),
    ) as HTMLElement
    confirm.click()
    await flush()
    const banner = w.find('.k-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('400 Bad Request')
    expect(banner.text()).not.toContain('ECONNREFUSED')
    expect(banner.text()).not.toContain('leak-me-please')
  })

  it('成功路径不留警示条(两侧对照:证明上面那条不是「横幅恒显示」)', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    const confirm = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('确认重建'),
    ) as HTMLElement
    confirm.click()
    await flush()
    expect(w.find('.k-banner').exists()).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────
// 整页 DOM 完整性 —— 收官刀的自证:蓝本 826 行的三个 T10 区块都在,
// 且文件里没有留下任何占位/空函数体/TODO。
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 收官刀:整页落地完整性', () => {
  it('三个 T10 区块的宿主元素同时存在(动作条 + 弹窗 + 行内重建按钮)', async () => {
    const host = withHost()
    const w = await mountAttachedWithFiles([FILE_OK], 8)
    expect(w.find('.k-files-actionbar .k-ab-inner').exists()).toBe(true)
    expect(w.find('.k-files-actionbar .k-ab-info').exists()).toBe(true)
    expect(w.find('.k-files-actionbar .k-ab-actions').exists()).toBe(true)
    expect(w.find('.k-rebuild-btn').exists()).toBe(true)
    await w.find('.k-files-actionbar .k-btn.outline').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal .k-confirm-body .k-confirm-icon')).not.toBeNull()
    expect(host.querySelector('.k-modal .k-modal-foot .right')).not.toBeNull()
  })

  it('源文件里没有 TODO / 待补 / 空函数体占位(剥掉注释后扫描)', () => {
    const src: string = readFileSync(resolve(__dirname, './IndexedFilesView.vue'), 'utf8')
    // 先剥 HTML 注释与 JS 行/块注释(治理 §9:「在文件里找文本」必须先排除注释,
    // 否则头注释里那些解释性的「T10 补全 / 占位」字样会把断言撞对/撞错)。
    const noComments = src
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
    expect(noComments).not.toMatch(/\bTODO\b/i)
    expect(noComments).not.toMatch(/\bFIXME\b/i)
    // 空函数体(`{ }` 或 `{\n}`)—— T9 留的 rebuildRow 占位就是这个形状。
    expect(noComments).not.toMatch(/function\s+\w+\s*\([^)]*\)\s*(:\s*[\w<>|\s]+)?\s*\{\s*\}/)
  })
})
