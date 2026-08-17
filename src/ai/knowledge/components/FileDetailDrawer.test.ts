// SP8-P5e Task 5 — `FileDetailDrawer.vue` unit tests. Blueprint `NimoOS-UI@7a6ee6b7`
// `src/views/AI/Knowledge/components/FileDetailDrawer.vue`(220 lines, all ported this pass)+
// following Vue2 spec `src/views/AI/Knowledge/__tests__/fileDetailDrawerDistill.spec.js`(N43,
// test approach must change, see corresponding describe block below).
//
// ═══ mock boundary(governance §4.1)═══
// `service.notes.distillFile` uses `vi.hoisted` mock; `isDistillableName` uses
// `importOriginal` keeping real implementation(sole definition in `NimoOS-Service/src/notes.ts`'s
// `DISTILL_EXTS`, N44 requires this repo not re-define extension table — if mock here too,
// `canDistill`'s `.pdf`/`.png` two cases can't test real extension table).
// `store.loadChunkContext` uses real Pinia + `vi.spyOn(store, 'loadChunkContext')` per-case
// mock(`store.runSearch` not involved, that's T6/T7's work), return value = back end original snake_case
// (`{chunks:[{chunk_no,text}], anchor_chunk_no}`), follows governance §4.1 level table.
//
// ═══ fixture source(three-level labels per entry, ruling R3 constraint 1 / R9)═══
// `REAL_FILE_ID` / `CHUNK0_TEXT_PREFIX` / `CHUNK1_TEXT_PREFIX` from
// `.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json`
// (`files[0]`, real file_id/mime/score/mtime_ms/path, REPLAYED).
// `F6_ANCHOR_TEXT_PREFIX`/`F6B_ANCHOR_TEXT_PREFIX` from
// `F6-search-chunk.window.REPLAYED.json` / `F6b-search-chunk.window-multi.REPLAYED.json`
// anchor entries(REPLAYED). RED per R9-3「test allows only 1-2 complete texts」, this file **zero**
// complete texts — all truncated to real first 48–72 chars(still real prefix of real data, not hand-written),
// each marked with complete value's `len`/`sha256`, verify command unified in comment below(swap `<n>`
// for corresponding length to verify prefix truly is real prefix of that sha256 value):
//   python3 -c "import json,hashlib; d=json.load(open('.superpowers/sdd/p5e-fixtures/<FILE>')); \
//     t=<value path>; print(len(t), hashlib.sha256(t.encode()).hexdigest())"
// `F12_CONSTRUCTED`(sole sample for anchor absent fallback) from
// `F12-search-chunk.anchor-absent.CONSTRUCTED.json`(CONSTRUCTED, D-6 template, already very short,
// copy entire text as-is).
//
// ═══ K/N hits (each see comment in corresponding describe block below)═══
// K44 · emit contract(don't directly call useToast) · N42(fetchFull four reqId guards) · N43(distill test approach changed) ·
// N44(canDistill use package isDistillableName) · K48(four functions zero re-definition) · K49(v-html injection) ·
// N41(Esc) · T5 DoD-12(auto-load guard).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname as pathDirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { ChunkVM, FileVM } from '../util/searchAggregate'
import FileDetailDrawer from './FileDetailDrawer.vue'

const __dirname = pathDirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8') as string
// RED E-60/E-25 family: negation assertions for class names/call shapes must strip comments first(mentioning
// `<style>`/`useToast()`/`function highlight` etc. in comments is false positive—file header comment itself
// heavily references these for explanation). Only strip full-line `//` comments(this file has no color literals
// comments needing judgment preservation, doesn't apply reverse E-60 color scan rules).
const stripLineComments = (src: string) =>
  src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

// ─── mock service.notes.distillFile; isDistillableName uses importOriginal for real implementation ───
const notes = vi.hoisted(() => ({ distillFile: vi.fn() }))
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { notes } }
})
import { service } from '@nimotech/nimoos-service'

// ─── fixture data(§0 source explanation, truncated to real prefix) ───
const REAL_FILE_ID = 'dce79e8ea5d48719cd4ad16fe48da843' // real file_id, shared by F5b/F6/F6b/F12 — same underlying indexed document
const REAL_PATH_DIR = '/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/'
const REAL_NAME = '26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log'
// Real prefix, taken from F5b files[0].chunks[0].preview.text; full value len=2342 sha256=fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b
const CHUNK0_TEXT_PREFIX = '{"log":"/usr/share/nimoos/agent/main.py:201: DeprecationWarning: \\n","'
// Real prefix, taken from F5b files[0].chunks[1].preview.text; full value len=2317 sha256=8c56f4fb9077e623048ce9614449cc2ac811c5ec98a82dba521bbcff3e401eea
const CHUNK1_TEXT_PREFIX = 'stAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/'
// Real prefix, taken from the anchor entry (chunk_no=2387) in F6-search-chunk.window.REPLAYED.json;
// full value len=2296 sha256=029f9038b87c7cb3d72a146ff6502fef5b287f3995eae9f5cec5138188fb2b0c
const F6_ANCHOR_TEXT_PREFIX = "-f4b8bca68b49: Client error '404 Not Found' for "
// Real prefix, taken from the anchor entry (chunk_no=1) in F6b-search-chunk.window-multi.REPLAYED.json;
// full value len=2317 sha256=8c56f4fb9077e623048ce9614449cc2ac811c5ec98a82dba521bbcff3e401eea (same
// real text as CHUNK1_TEXT_PREFIX — F6b and F5b are different views of the same indexed document, cross-checked consistent)
const F6B_ANCHOR_TEXT_PREFIX = 'stAPI docs for Lifespan Events](https://fastapi.'

/** REPLAYED — F6: full window 5 items, anchor(2387) centered. Non-anchor items' text only keeps
 * real first 48 chars(component only uses `chunk_no` for `.find()` match, non-anchor text never rendered,
 * truncation doesn't affect any assertion discrimination, see file header R9-3 explanation). */
const F6_WINDOW_RAW = {
  file_id: REAL_FILE_ID,
  kind: 'body',
  anchor_chunk_no: 2387,
  chunks: [
    { chunk_no: 2385, text: "-873d0fbc8c4b: Client error '404 Not Found' for " },
    { chunk_no: 2386, text: '.mozilla.org/en-US/docs/Web/HTTP/Status/404\\n","' },
    { chunk_no: 2387, text: F6_ANCHOR_TEXT_PREFIX },
    { chunk_no: 2388, text: '.mozilla.org/en-US/docs/Web/HTTP/Status/404\\n","' },
    { chunk_no: 2389, text: "-576c047ebf2e: Client error '404 Not Found' for " },
  ],
}

/** REPLAYED — F6b: anchor(1) at chunk_no lower bound ⇒ only get 4 items(less than 2W+1=5), pin
 * "back end only filters by window + ascending, doesn't guarantee count". */
const F6B_WINDOW_RAW = {
  file_id: REAL_FILE_ID,
  kind: 'body',
  anchor_chunk_no: 1,
  chunks: [
    { chunk_no: 0, text: CHUNK0_TEXT_PREFIX },
    { chunk_no: 1, text: F6B_ANCHOR_TEXT_PREFIX },
    { chunk_no: 2, text: '330537Z"}\n{"log":"        on_event is deprecated' },
    { chunk_no: 3, text: '.749353428Z"}\n{"log":"        \\n","stream":"stde' },
  ],
}

/** CONSTRUCTED(D-6 template) — sole sample with anchor not in chunks, copy
 * `F12-search-chunk.anchor-absent.CONSTRUCTED.json` exactly(stripped `_provenance`). Authoritative source:
 * `NimoOS-Search/service/authz.go:96-149`(GetChunkWindow echoes request chunk_no as anchor_chunk_no as-is,
 * but chunks only keeps still-existing neighbors—if anchor item re-chunked/tombstoned,
 * anchor not in chunks). */
const F12_ANCHOR_ABSENT_RAW = {
  file_id: REAL_FILE_ID,
  kind: 'body',
  anchor_chunk_no: 2387,
  chunks: [
    { chunk_no: 2386, text: 'neighbour before the anchor' },
    { chunk_no: 2388, text: 'neighbour after the anchor' },
  ],
}

function makeFile(overrides: Partial<FileVM> = {}, chunkOverrides: Partial<ChunkVM>[] = []): FileVM {
  const baseChunks: ChunkVM[] = [
    { id: `${REAL_FILE_ID}:body:0`, kind: 'body', chunkNo: 0, page: null, score: 0.738, snippet: CHUNK0_TEXT_PREFIX },
    { id: `${REAL_FILE_ID}:body:1`, kind: 'body', chunkNo: 1, page: null, score: 0.4666, snippet: CHUNK1_TEXT_PREFIX },
  ]
  const chunks = chunkOverrides.length
    ? baseChunks.map((c, i) => ({ ...c, ...(chunkOverrides[i] || {}) }))
    : baseChunks
  return {
    id: REAL_FILE_ID,
    name: REAL_NAME,
    path: REAL_PATH_DIR,
    fullPath: REAL_PATH_DIR + REAL_NAME,
    kind: 'txt',
    mime: 'text/plain',
    mtimeMs: 1784424392240,
    score: 0.738,
    chunks,
    ...overrides,
  }
}

function withPinia() {
  setActivePinia(createPinia())
  return useKnowledgeStore()
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('FileDetailDrawer — K44: .vue side zero <style> block', () => {
  it('confirms no <style> block anywhere in the file', () => {
    const src = stripLineComments(read('./FileDetailDrawer.vue'))
    expect(/<style/.test(src)).toBe(false)
  })
})

describe('FileDetailDrawer — K48: four functions zero re-definition, all imported from util/searchAggregate', () => {
  it('grep self-proof: highlight/fmtMtime/relLevel/relLabel all "zero function declaration" in this file', () => {
    const rawSrc = read('./FileDetailDrawer.vue')
    const src = stripLineComments(rawSrc)
    for (const fn of ['highlight', 'fmtMtime', 'relLevel', 'relLabel']) {
      expect(new RegExp(`function ${fn}\\b`).test(src), `${fn} should not be redefined in this file`).toBe(false)
    }
    expect(/from '\.\.\/util\/searchAggregate'/.test(rawSrc)).toBe(true)
  })
})

describe('FileDetailDrawer — render: file info / match section count / modified time / summary line', () => {
  it('kind label uppercase / path / "{n} matching sections" / Modified date', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile(), query: 'agent' } })
    expect(w.find('.k-rcard-tag').text()).toBe('TXT')
    expect(w.find('.k-drawer-filename').text()).toBe(REAL_NAME)
    expect(w.find('.k-drawer-filename').attributes('title')).toBe(REAL_NAME)
    expect(w.find('.path').text()).toBe(REAL_PATH_DIR)
    // .k-rcard-meta-item appears 3 times: [0]=folder+path row, [1]=matching sections, [2]=modified.
    // aiKbSrMatchTitle's zh value = '命中 {n} 段' (2 chunks)
    expect(w.findAll('.k-rcard-meta-item')[1].text()).toBe('命中 2 段')
    // aiKbSrModified's zh value = '修改时间', followed by the real output of fmtMtime(mtimeMs)
    const modifiedItem = w.findAll('.k-rcard-meta-item')[2].text()
    expect(modifiedItem.startsWith('修改时间')).toBe(true)
    expect(modifiedItem).toContain('2026-') // mtimeMs=1784424392240 falls in 2026 (matches the conversion recorded in the fixture README)
  })

  it('summary line = aiKbFdSummary(n=chunks.length, query), spliced by real i18n value', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile(), query: 'skating' } })
    expect(w.find('.k-drawer-summary').text()).toBe('为「skating」找到 2 段相关内容，按相似度排序')
  })

  it('k-chunk-nav-count = curIndex+1 / total', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    expect(w.find('.k-chunk-nav-count').text()).toBe('1 / 2')
  })
})

describe('FileDetailDrawer — activeId initial value / select / step boundary(DoD-3)', () => {
  it('initial value = first chunk id (first .k-chunk-item with data-active=true)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    const items = w.findAll('.k-chunk-item')
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
  })

  it('activeId initial = null(criterion: when chunks=[], no .k-chunk-item has data-active=true)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile({ chunks: [] }) } })
    expect(w.findAll('.k-chunk-item')).toHaveLength(0)
  })

  it('click second chunk(select) → data-active switches', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.findAll('.k-chunk-item')[1].trigger('click')
    const items = w.findAll('.k-chunk-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('true')
    expect(w.find('.k-chunk-nav-count').text()).toBe('2 / 2')
  })

  it('step boundary: when curIndex=0, step(-1) doesn\'t overflow(criterion: remove boundary check → must fail red, see RED probe below)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    // First button is disabled (UI layer can't click past the boundary)
    const prevBtn = w.findAll('.k-row-action')[0]
    expect(prevBtn.attributes('disabled')).toBeDefined()
    // 🔴 wrapper.vm reads the <script setup> top-level function directly (precedent: NoteEditPane.test.ts file header technical note)
    // Call step(-1) directly, bypassing the disabled attribute, to precisely check step()'s own boundary logic (not the UI-layer guard taking effect)
    ;(w.vm as unknown as { step: (d: number) => void }).step(-1)
    expect(w.findAll('.k-chunk-item')[0].attributes('data-active')).toBe('true')
  })

  it('step boundary: when curIndex=end, step(+1) doesn\'t overflow', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.findAll('.k-chunk-item')[1].trigger('click') // curIndex=1 (last one, file only has 2 items)
    const nextBtn = w.findAll('.k-row-action')[1]
    expect(nextBtn.attributes('disabled')).toBeDefined()
    ;(w.vm as unknown as { step: (d: number) => void }).step(1)
    expect(w.findAll('.k-chunk-item')[1].attributes('data-active')).toBe('true')
  })
})

describe('FileDetailDrawer — fetchFull() N42 four reqId stale guards(blueprint included, copy as-is)', () => {
  it('① logic interleaving: select A → select B → B returns first → A returns late, render content is B\'s', async () => {
    const store = withPinia()
    let resolveA!: (v: unknown) => void
    let resolveB!: (v: unknown) => void
    const pA = new Promise((res) => { resolveA = res })
    const pB = new Promise((res) => { resolveB = res })
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => pA as Promise<unknown>) // auto-fired for chunk[0] (=A) on mount
    spy.mockImplementationOnce(() => pB as Promise<unknown>) // fired when chunk[1] (=B) is clicked

    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.findAll('.k-chunk-item')[1].trigger('click') // select B
    await flushPromises()

    resolveB({ chunks: [{ chunk_no: 1, text: 'B-FULL-TEXT' }], anchor_chunk_no: 1 })
    await flushPromises()
    expect(w.find('.k-chunk-content').html()).toContain('B-FULL-TEXT')

    resolveA({ chunks: [{ chunk_no: 0, text: 'A-FULL-TEXT-LATE' }], anchor_chunk_no: 0 })
    await flushPromises()
    // A is the stale request that fired first but arrived later — it must not overwrite what B already wrote
    expect(w.find('.k-chunk-content').html()).toContain('B-FULL-TEXT')
    expect(w.find('.k-chunk-content').html()).not.toContain('A-FULL-TEXT-LATE')
  })

  it('② RED two instance interleaving respects scope(criterion: move activeId to module level → must fail red, see T5 report RED probe)', async () => {
    const store = withPinia()
    let resolve1!: (v: unknown) => void
    const p1 = new Promise((res) => { resolve1 = res })
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => p1 as Promise<unknown>) // fired on instance 1's mount (left pending)
    spy.mockResolvedValueOnce({ chunks: [{ chunk_no: 0, text: 'INSTANCE-2-TEXT' }], anchor_chunk_no: 0 }) // fired on instance 2's mount, resolves immediately

    const w1 = mount(FileDetailDrawer, {
      props: { file: makeFile({ id: 'file-instance-1' }, [{ id: 'file-instance-1:body:0' }]) },
    })
    await flushPromises()
    const w2 = mount(FileDetailDrawer, {
      props: { file: makeFile({ id: 'file-instance-2' }, [{ id: 'file-instance-2:body:0' }]) },
    })
    await flushPromises()
    expect(w2.find('.k-chunk-content').html()).toContain('INSTANCE-2-TEXT')

    // Instance 1's late response arrives now — activeId is per-instance local state and must not be disturbed by instance 2's selection
    resolve1({ chunks: [{ chunk_no: 0, text: 'INSTANCE-1-LATE-TEXT' }], anchor_chunk_no: 0 })
    await flushPromises()
    expect(w1.find('.k-chunk-content').html()).toContain('INSTANCE-1-LATE-TEXT')
  })

  it('③ catch branch also has reqId check: failed old request doesn\'t overwrite new content', async () => {
    const store = withPinia()
    let rejectA!: (e: unknown) => void
    const pA = new Promise((_res, rej) => { rejectA = rej })
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => pA as Promise<unknown>) // A (on mount, chunk[0])
    spy.mockResolvedValueOnce({ chunks: [{ chunk_no: 1, text: 'B-SUCCEEDED-TEXT' }], anchor_chunk_no: 1 }) // B (select chunk[1])

    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.findAll('.k-chunk-item')[1].trigger('click')
    await flushPromises()
    expect(w.find('.k-chunk-content').html()).toContain('B-SUCCEEDED-TEXT')

    rejectA(new Error('A network error, arrives late'))
    await flushPromises()
    // A failed, but it's already a stale request — must not replace B's already-rendered content with A's catch fallback (chunk[0]'s snippet)
    expect(w.find('.k-chunk-content').html()).toContain('B-SUCCEEDED-TEXT')
    expect(w.find('.k-chunk-content').html()).not.toContain(CHUNK0_TEXT_PREFIX.slice(0, 20))
  })

  it('④ loading in finally also has reqId check: old request\'s finally doesn\'t clear loading already set by current request', async () => {
    const store = withPinia()
    let resolveA!: (v: unknown) => void
    const pA = new Promise((res) => { resolveA = res })
    const pBNeverSettles = new Promise(() => {}) // B never settles, loading stays true
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => pA as Promise<unknown>) // A (on mount)
    spy.mockImplementationOnce(() => pBNeverSettles as Promise<unknown>) // B (select chunk[1])

    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.findAll('.k-chunk-item')[1].trigger('click') // trigger B, loading=true (B's reqId)
    await flushPromises()
    expect((w.vm as unknown as { loading: boolean }).loading).toBe(true)

    resolveA({ chunks: [{ chunk_no: 0, text: 'A-LATE' }], anchor_chunk_no: 0 }) // A resolves late
    await flushPromises()
    // A's finally checks activeId!==reqId(A), which is true → must not set loading back to false (B's request is still in flight)
    expect((w.vm as unknown as { loading: boolean }).loading).toBe(true)
  })

  it('⑤ RED chunkNo == null early exit(blueprint :147)—fetchFull doesn\'t send request when file.chunks empty', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    mount(FileDetailDrawer, { props: { file: makeFile({ chunks: [] }) } })
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })

  it('mock shape = back end original snake_case(F6: full window 5 items, anchor centered)—fetchFull correctly gets anchor text', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    expect(w.find('.k-chunk-content').html()).toContain(F6_ANCHOR_TEXT_PREFIX)
  })

  it('mock shape = back end original snake_case(F6b: anchor at lower bound, count 4 < 2W+1=5)—still correctly get anchor', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6B_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    expect(F6B_WINDOW_RAW.chunks).toHaveLength(4) // pins down the fact itself that "count is not guaranteed to be 2W+1"
    expect(w.find('.k-chunk-content').html()).toContain(F6B_ANCHOR_TEXT_PREFIX)
  })

  it('🔴 when anchor is not found, falls back to c.snippet (blueprint :157, F12 CONSTRUCTED, the only sample for anchor-absent fallback)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F12_ANCHOR_ABSENT_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    // F12_ANCHOR_ABSENT_RAW.chunks has no entry with chunk_no===2387 — find() comes up empty,
    // falls back to cur.snippet (i.e. the currently selected chunk[0]'s snippet = CHUNK0_TEXT_PREFIX)
    expect(F12_ANCHOR_ABSENT_RAW.chunks.some((c) => c.chunk_no === F12_ANCHOR_ABSENT_RAW.anchor_chunk_no)).toBe(false)
    expect(w.find('.k-chunk-content').html()).toContain(CHUNK0_TEXT_PREFIX.slice(0, 30))
    expect(w.find('.k-chunk-content').html()).not.toContain('neighbour')
  })
})

describe('FileDetailDrawer — emit contract copy as-is(close/open/download/toast, don\'t directly call useToast)', () => {
  it('🔴 this component itself has zero calls to useToast() (grep self-proof, blueprint :186-190 convention)', () => {
    const src = stripLineComments(read('./FileDetailDrawer.vue'))
    expect(/useToast\s*\(/.test(src)).toBe(false)
  })

  it('click the back-to-results button (.k-drawer-back) → emit close', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.find('.k-drawer-back').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('click the top-right close button (.k-modal-x) → emit close', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.find('.k-modal-x').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('click the backdrop (.k-drawer-bg) → emit close; click inside the panel (.k-drawer, @click.stop) → does not emit close', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.find('.k-drawer').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
    await w.find('.k-drawer-bg').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('click the download button → emit download (full FileVM, not a slimmed-down object)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile()
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-drawer-actions .k-btn.outline').trigger('click')
    const emitted = w.emitted('download')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toStrictEqual(file)
  })

  it('click open original file (.k-btn.primary) → emit open with payload { file }', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile()
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-btn.primary').trigger('click')
    const emitted = w.emitted('open')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toStrictEqual({ file })
  })
})

describe('FileDetailDrawer — copy() two paths(blueprint :164-181, first review must-check item)', () => {
  // clipboard/execCommand mock technique follows this repo's established precedent src/files/util/clipboard.test.ts:
  // jsdom has zero native `document.execCommand` (not "exists but undefined" — the property doesn't exist at all),
  // `vi.spyOn` requires the property to already exist, so assign directly `document.execCommand = vi.fn(...)`,
  // use `Object.defineProperty(navigator, 'clipboard', {value, configurable:true})`
  // instead of `delete navigator.clipboard` (under jsdom `navigator.clipboard` is a
  // getter on the prototype chain — `delete` is a no-op with no side effects when the own property doesn't exist, so it verifies nothing).
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
  })

  it('① navigator.clipboard.writeText succeeds → emit toast(Copied)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.find('.k-chunk-viewer-foot .k-btn.ghost').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(w.emitted('toast')).toEqual([['已复制']])
  })

  it('② 🔴 navigator.clipboard does not exist (HTTP-IP insecure context, memory newui-clipboard-insecure-reka) → falls back to execCommand, returns true → still emit toast(Copied)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => true) as typeof document.execCommand
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.find('.k-chunk-viewer-foot .k-btn.ghost').trigger('click')
    await flushPromises()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(w.emitted('toast')).toEqual([['已复制']])
  })

  it('③ 🔴 execCommand returns false → emit toast(Copy failed) (criterion: execCommand is actually called — not the zero-discriminating-power "it is always the failure message anyway")', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => false) as typeof document.execCommand
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.find('.k-chunk-viewer-foot .k-btn.ghost').trigger('click')
    await flushPromises()
    // 🔴 Trap flagged by review's first must-check item: asserting the toast copy alone isn't enough — if the entire
    // execCommand fallback block is deleted, `ok` would also stay at its initial `false`, and the emitted copy would
    // happen to match this expectation, so the assertion would "false-pass".
    // Must additionally pin down that execCommand was actually called, to prove it went through the fallback path
    // and did not just report failure without even trying.
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(w.emitted('toast')).toEqual([['复制失败,请手动选择']])
  })

  it('④ plain = body text with tags stripped (the <mark> tags produced by highlight() do not go into the clipboard)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue({
      chunks: [{ chunk_no: 0, text: 'hello world foo' }],
      anchor_chunk_no: 0,
    })
    const w = mount(FileDetailDrawer, { props: { file: makeFile(), query: 'world' } })
    await flushPromises()
    // viewerHtml should contain <mark> at this point (highlight matched query="world")
    expect(w.find('.k-chunk-content').html()).toContain('<mark>')
    await w.find('.k-chunk-viewer-foot .k-btn.ghost').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('hello world foo')
  })
})

describe('FileDetailDrawer — N43: following fileDetailDrawerDistill.spec.js(test approach must change, see file header explanation)', () => {
  it('🔴 passes file.fullPath, not file.path (dirname) — criterion: change to file.path → must fail red', async () => {
    notes.distillFile.mockResolvedValue({ queued: true })
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile({ name: 'a.pdf', fullPath: '/DATA/Documents/a.pdf', path: '/DATA/Documents/' })
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-drawer-actions .k-btn.outline:nth-of-type(2)').trigger('click')
    await flushPromises()
    expect(notes.distillFile).toHaveBeenCalledWith('/DATA/Documents/a.pdf')
    expect(notes.distillFile).not.toHaveBeenCalledWith('/DATA/Documents/')
  })

  it('success → emit toast(Queued for note distillation)', async () => {
    notes.distillFile.mockResolvedValue({ queued: true })
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile({ name: 'a.pdf', fullPath: '/DATA/Documents/a.pdf' })
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-drawer-actions .k-btn.outline:nth-of-type(2)').trigger('click')
    await flushPromises()
    expect(w.emitted('toast')).toEqual([['已加入笔记沉淀队列']])
  })

  it('failure → emit toast(Could not queue this file)', async () => {
    notes.distillFile.mockRejectedValue(new Error('agent 404'))
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile({ name: 'a.pdf', fullPath: '/DATA/Documents/a.pdf' })
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-drawer-actions .k-btn.outline:nth-of-type(2)').trigger('click')
    await flushPromises()
    expect(w.emitted('toast')).toEqual([['无法加入沉淀队列']])
  })
})

describe('FileDetailDrawer — N44: canDistill use package isDistillableName(real implementation, don\'t re-define extension table)', () => {
  it('.pdf → distill button renders', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile({ name: 'a.pdf' }) } })
    expect(w.findAll('.k-drawer-actions .k-btn.outline')).toHaveLength(2) // download + distill
  })

  it('.png → distill button does not render (§9.11 clickability: v-if="canDistill")', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile({ name: 'a.png' }) } })
    expect(w.findAll('.k-drawer-actions .k-btn.outline')).toHaveLength(1) // download only
  })
})

describe('FileDetailDrawer — K49: v-html injection(component layer render, util layer escape already tested by T3)', () => {
  it('feed a snippet containing <script> → in the rendered DOM querySelector("script") is null, <mark> is present (chunk list)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const malicious = makeFile(
      {},
      [{ snippet: '<script>alert(1)</script> hello' }, {}],
    )
    const w = mount(FileDetailDrawer, { props: { file: malicious, query: 'hello' }, attachTo: document.body })
    const preview = w.find('.k-chunk-item-preview').element as HTMLElement
    expect(preview.querySelector('script')).toBeNull()
    expect(preview.querySelector('mark')).not.toBeNull()
    expect(preview.innerHTML).toContain('&lt;script&gt;')
    w.unmount()
  })

  it('feed a snippet containing <img onerror> (lands in viewerHtml via fetchFull) → rendered DOM has no executable onerror attribute (escaped)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue({
      chunks: [{ chunk_no: 0, text: '<img src=x onerror=alert(1)> hello' }],
      anchor_chunk_no: 0,
    })
    const w = mount(FileDetailDrawer, { props: { file: makeFile(), query: 'hello' }, attachTo: document.body })
    await flushPromises()
    const viewer = w.find('.k-chunk-content').element as HTMLElement
    expect(viewer.querySelector('img')).toBeNull()
    expect(viewer.innerHTML).toContain('&lt;img')
    expect(viewer.innerHTML).toContain('&gt;')
    expect(viewer.innerHTML).toContain('<mark>')
    w.unmount()
  })
})

describe('FileDetailDrawer —— N41 Esc listener (created/beforeDestroy → onMounted/onBeforeUnmount)', () => {
  it('registers keydown on mount; pressing Esc emits close; unregisters with the same function reference on unmount (criterion: remove onBeforeUnmount → must fail red, see T5 report RED probe)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })

    const addCall = addSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(addCall, 'no addEventListener call for keydown found').toBeDefined()
    const handler = addCall![1]

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('close')).toHaveLength(1) // did not grow

    w.unmount()
    const removeCall = removeSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(removeCall, 'no removeEventListener call for keydown found').toBeDefined()
    expect(removeCall![1]).toBe(handler)
  })
})

describe('FileDetailDrawer —— T5 DoD-12: auto-load guard (views/SearchView.vue is created by T6, does not exist yet)', () => {
  // 🔴 This describe block only holds the one permanent case that "should always pass while dormant".
  // The "loading proof" (temporarily creating views/SearchView.vue → must fail red → delete and restore → turns green) and
  // "one case per each of the two failure modes" are not written into the permanent test file — that would bake a
  // one-time verification behavior into CI (reading/writing the real filesystem, with one step deliberately
  // producing a failure state), which is not this guard's job. These two RED probes were done manually in the T5 report
  // using `cp`/temp files plus full command output, pasted one by one — evidence is in report §(auto-load guard).
  const searchViewPath = resolve(__dirname, '../views/SearchView.vue')

  it('🔴 if views/SearchView.vue exists, it must import this component (file does not currently exist ⇒ passes dormant, not skip/todo)', () => {
    if (!existsSync(searchViewPath)) {
      // Dormant branch: the file genuinely does not exist, the assertion is still executed (not it.skip/it.todo), the criterion just holds vacuously.
      expect(existsSync(searchViewPath)).toBe(false)
      return
    }
    const src = readFileSync(searchViewPath, 'utf8') as string
    expect(src).toMatch(/FileDetailDrawer\.vue/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 SP8-P5f Task 1b —— gap-fill block for debt M-1 (P5e final review Minor-1)
//
// P5e final review found empirically: the arguments `fetchFull()` passes to `store.loadChunkContext`
// were **never read even once** in this file (zero hits across the full `mock.calls` listing) ⇒ changing
// `window: 2` to any value still leaves all 3125 cases green (final review probe F3: `window: 7` → all green).
//
// 🔴 This block **only adds assertions, not a single line of product code touched** — `FileDetailDrawer.vue:116-121`'s
// `window: 2` was verified character-by-character correct against blueprint `bp-FileDetailDrawer.vue:153` in the P5e final review.
// ⚠️ Blast radius (final review record): `knowledgeStore.ts`'s `loadChunkContext` default parameter is also 2
// ⇒ **removing this argument is harmless, only changing the value is harmful** — so the criterion pins down "value === 2",
// not "key exists".
//
// Criterion (RED probe, see p5f-task-1b-report.md): change product code to `window: 3` → must fail red.
// ═══════════════════════════════════════════════════════════════════════════

describe('FileDetailDrawer —— debt M-1: loadChunkContext arguments (window: 2 is the hard criterion)', () => {
  it('🔴 window === 2 (the number 2, not a string / not passed; changing to 3 fails red)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0][0] as { window?: unknown }
    expect(arg.window).toBe(2)
    expect(typeof arg.window).toBe('number')
  })

  // 🔴 Hardening disclosure (governance §9.10 / ruling R22): the brief's DoD only requires pinning down `window: 2`.
  // The other three arguments have the same zero-guard gap (same `mock.calls` blind spot) — together with `window`
  // they determine which chunk this request targets — pinning them down as well is **hardening**, not loosening any existing assertion.
  it('🔴 shape of all four arguments together: fileId / kind / chunkNo taken from the current chunk, window always 2', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile()
    mount(FileDetailDrawer, { props: { file } })
    await flushPromises()
    expect(spy.mock.calls[0][0]).toEqual({
      fileId: file.id,
      kind: file.chunks[0].kind,
      chunkNo: file.chunks[0].chunkNo,
      window: 2,
    })
  })

  it('🔴 switching to the second chunk re-fires the request: chunkNo changes accordingly, window is still 2 (not just correct on the first fire)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile()
    const w = mount(FileDetailDrawer, { props: { file } })
    await flushPromises()
    // Governance §13-1: first confirm the second chunk actually renders as a clickable element under this test case's data
    const items = w.findAll('.k-chunk-item')
    expect(items.length).toBe(2)
    await items[1].trigger('click')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(2)
    const arg = spy.mock.calls[1][0] as { chunkNo?: unknown; window?: unknown }
    expect(arg.chunkNo).toBe(file.chunks[1].chunkNo)
    expect(arg.window).toBe(2)
  })
})
