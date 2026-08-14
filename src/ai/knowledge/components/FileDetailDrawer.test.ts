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
const REAL_FILE_ID = 'dce79e8ea5d48719cd4ad16fe48da843' // 真实 file_id,F5b/F6/F6b/F12 共用同一份索引文档
const REAL_PATH_DIR = '/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/'
const REAL_NAME = '26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log'
// 真实前缀,取自 F5b files[0].chunks[0].preview.text;完整值 len=2342 sha256=fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b
const CHUNK0_TEXT_PREFIX = '{"log":"/usr/share/nimoos/agent/main.py:201: DeprecationWarning: \\n","'
// 真实前缀,取自 F5b files[0].chunks[1].preview.text;完整值 len=2317 sha256=8c56f4fb9077e623048ce9614449cc2ac811c5ec98a82dba521bbcff3e401eea
const CHUNK1_TEXT_PREFIX = 'stAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/'
// 真实前缀,取自 F6-search-chunk.window.REPLAYED.json 的 anchor 条目(chunk_no=2387);
// 完整值 len=2296 sha256=029f9038b87c7cb3d72a146ff6502fef5b287f3995eae9f5cec5138188fb2b0c
const F6_ANCHOR_TEXT_PREFIX = "-f4b8bca68b49: Client error '404 Not Found' for "
// 真实前缀,取自 F6b-search-chunk.window-multi.REPLAYED.json 的 anchor 条目(chunk_no=1);
// 完整值 len=2317 sha256=8c56f4fb9077e623048ce9614449cc2ac811c5ec98a82dba521bbcff3e401eea(与
// CHUNK1_TEXT_PREFIX 同一份真实文本 —— F6b 与 F5b 是同一份索引文档的不同视角,已交叉核对一致)
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
  it('文件内确认无任何 <style> 块', () => {
    const src = stripLineComments(read('./FileDetailDrawer.vue'))
    expect(/<style/.test(src)).toBe(false)
  })
})

describe('FileDetailDrawer — K48: four functions zero re-definition, all imported from util/searchAggregate', () => {
  it('grep self-proof: highlight/fmtMtime/relLevel/relLabel all "zero function declaration" in this file', () => {
    const rawSrc = read('./FileDetailDrawer.vue')
    const src = stripLineComments(rawSrc)
    for (const fn of ['highlight', 'fmtMtime', 'relLevel', 'relLabel']) {
      expect(new RegExp(`function ${fn}\\b`).test(src), `${fn} 不应在本文件里重复定义`).toBe(false)
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
    // .k-rcard-meta-item 出现 3 次:[0]=folder+path 行,[1]=matching sections,[2]=modified。
    // aiKbSrMatchTitle 的 zh 值 = '命中 {n} 段'(2 个 chunk)
    expect(w.findAll('.k-rcard-meta-item')[1].text()).toBe('命中 2 段')
    // aiKbSrModified 的 zh 值 = '修改时间',后接 fmtMtime(mtimeMs) 的真实输出
    const modifiedItem = w.findAll('.k-rcard-meta-item')[2].text()
    expect(modifiedItem.startsWith('修改时间')).toBe(true)
    expect(modifiedItem).toContain('2026-') // mtimeMs=1784424392240 落在 2026 年(与 fixture README 记的换算一致)
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
    // 首条按钮 disabled(UI 层面无法点入越界)
    const prevBtn = w.findAll('.k-row-action')[0]
    expect(prevBtn.attributes('disabled')).toBeDefined()
    // 🔴 wrapper.vm 直读 <script setup> 顶层函数(先例:NoteEditPane.test.ts 文件头技术说明)
    // 直接调用 step(-1),绕开 disabled 属性,精确核 step() 自身的边界判断(不是 UI 层拦截生效)
    ;(w.vm as unknown as { step: (d: number) => void }).step(-1)
    expect(w.findAll('.k-chunk-item')[0].attributes('data-active')).toBe('true')
  })

  it('step boundary: when curIndex=end, step(+1) doesn\'t overflow', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.findAll('.k-chunk-item')[1].trigger('click') // curIndex=1(末尾,file 只有 2 条)
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
    spy.mockImplementationOnce(() => pA as Promise<unknown>) // 挂载时自动为 chunk[0](=A)发起
    spy.mockImplementationOnce(() => pB as Promise<unknown>) // 点选 chunk[1](=B)时发起

    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.findAll('.k-chunk-item')[1].trigger('click') // 选 B
    await flushPromises()

    resolveB({ chunks: [{ chunk_no: 1, text: 'B-FULL-TEXT' }], anchor_chunk_no: 1 })
    await flushPromises()
    expect(w.find('.k-chunk-content').html()).toContain('B-FULL-TEXT')

    resolveA({ chunks: [{ chunk_no: 0, text: 'A-FULL-TEXT-LATE' }], anchor_chunk_no: 0 })
    await flushPromises()
    // A 是"先发后至"的旧请求,不许覆盖 B 已经写入的内容
    expect(w.find('.k-chunk-content').html()).toContain('B-FULL-TEXT')
    expect(w.find('.k-chunk-content').html()).not.toContain('A-FULL-TEXT-LATE')
  })

  it('② RED two instance interleaving respects scope(criterion: move activeId to module level → must fail red, see T5 report RED probe)', async () => {
    const store = withPinia()
    let resolve1!: (v: unknown) => void
    const p1 = new Promise((res) => { resolve1 = res })
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => p1 as Promise<unknown>) // 实例 1 挂载时发起(悬而不决)
    spy.mockResolvedValueOnce({ chunks: [{ chunk_no: 0, text: 'INSTANCE-2-TEXT' }], anchor_chunk_no: 0 }) // 实例 2 挂载时发起,立即回

    const w1 = mount(FileDetailDrawer, {
      props: { file: makeFile({ id: 'file-instance-1' }, [{ id: 'file-instance-1:body:0' }]) },
    })
    await flushPromises()
    const w2 = mount(FileDetailDrawer, {
      props: { file: makeFile({ id: 'file-instance-2' }, [{ id: 'file-instance-2:body:0' }]) },
    })
    await flushPromises()
    expect(w2.find('.k-chunk-content').html()).toContain('INSTANCE-2-TEXT')

    // 实例 1 的迟到响应现在才回来 —— activeId 是各实例本地状态,不应被实例 2 的选择干扰
    resolve1({ chunks: [{ chunk_no: 0, text: 'INSTANCE-1-LATE-TEXT' }], anchor_chunk_no: 0 })
    await flushPromises()
    expect(w1.find('.k-chunk-content').html()).toContain('INSTANCE-1-LATE-TEXT')
  })

  it('③ catch branch also has reqId check: failed old request doesn\'t overwrite new content', async () => {
    const store = withPinia()
    let rejectA!: (e: unknown) => void
    const pA = new Promise((_res, rej) => { rejectA = rej })
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => pA as Promise<unknown>) // A(挂载时,chunk[0])
    spy.mockResolvedValueOnce({ chunks: [{ chunk_no: 1, text: 'B-SUCCEEDED-TEXT' }], anchor_chunk_no: 1 }) // B(选 chunk[1])

    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.findAll('.k-chunk-item')[1].trigger('click')
    await flushPromises()
    expect(w.find('.k-chunk-content').html()).toContain('B-SUCCEEDED-TEXT')

    rejectA(new Error('A 网络错误,姗姗来迟'))
    await flushPromises()
    // A 失败了,但它已经是旧请求 —— 不许把 B 已经渲染的内容替换成 A 的 catch 兜底(chunk[0]的 snippet)
    expect(w.find('.k-chunk-content').html()).toContain('B-SUCCEEDED-TEXT')
    expect(w.find('.k-chunk-content').html()).not.toContain(CHUNK0_TEXT_PREFIX.slice(0, 20))
  })

  it('④ loading in finally also has reqId check: old request\'s finally doesn\'t clear loading already set by current request', async () => {
    const store = withPinia()
    let resolveA!: (v: unknown) => void
    const pA = new Promise((res) => { resolveA = res })
    const pBNeverSettles = new Promise(() => {}) // B 永不 settle,loading 保持 true
    const spy = vi.spyOn(store, 'loadChunkContext')
    spy.mockImplementationOnce(() => pA as Promise<unknown>) // A(挂载时)
    spy.mockImplementationOnce(() => pBNeverSettles as Promise<unknown>) // B(选 chunk[1])

    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.findAll('.k-chunk-item')[1].trigger('click') // 触发 B,loading=true(B 的 reqId)
    await flushPromises()
    expect((w.vm as unknown as { loading: boolean }).loading).toBe(true)

    resolveA({ chunks: [{ chunk_no: 0, text: 'A-LATE' }], anchor_chunk_no: 0 }) // A 迟到 resolve
    await flushPromises()
    // A 的 finally 判断 activeId!==reqId(A) 为真 → 不许把 loading 设回 false(那是 B 的请求还在飞)
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
    expect(F6B_WINDOW_RAW.chunks).toHaveLength(4) // 钉住「不保证条数 = 2W+1」这件事本身
    expect(w.find('.k-chunk-content').html()).toContain(F6B_ANCHOR_TEXT_PREFIX)
  })

  it('🔴 anchor 找不到时兜底 c.snippet(蓝本 :157,F12 CONSTRUCTED,anchor 缺席兜底的唯一样本)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F12_ANCHOR_ABSENT_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    // F12_ANCHOR_ABSENT_RAW.chunks 里没有 chunk_no===2387 的条目 —— find() 落空,
    // 兜底取 cur.snippet(即当前选中 chunk[0] 的 snippet = CHUNK0_TEXT_PREFIX)
    expect(F12_ANCHOR_ABSENT_RAW.chunks.some((c) => c.chunk_no === F12_ANCHOR_ABSENT_RAW.anchor_chunk_no)).toBe(false)
    expect(w.find('.k-chunk-content').html()).toContain(CHUNK0_TEXT_PREFIX.slice(0, 30))
    expect(w.find('.k-chunk-content').html()).not.toContain('neighbour')
  })
})

describe('FileDetailDrawer — emit contract copy as-is(close/open/download/toast, don\'t directly call useToast)', () => {
  it('🔴 本组件自身零处调用 useToast()(grep 自证,蓝本 :186-190 的约定)', () => {
    const src = stripLineComments(read('./FileDetailDrawer.vue'))
    expect(/useToast\s*\(/.test(src)).toBe(false)
  })

  it('点击返回结果按钮(.k-drawer-back)→ emit close', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.find('.k-drawer-back').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点击右上角关闭(.k-modal-x)→ emit close', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.find('.k-modal-x').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点击背景遮罩(.k-drawer-bg)→ emit close;点击面板内部(.k-drawer,@click.stop)→ 不 emit close', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.find('.k-drawer').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
    await w.find('.k-drawer-bg').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点击下载按钮 → emit download(完整 FileVM,不是瘦身对象)', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile()
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-drawer-actions .k-btn.outline').trigger('click')
    const emitted = w.emitted('download')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toStrictEqual(file)
  })

  it('点击打开原文件(.k-btn.primary)→ emit open 载荷 { file }', async () => {
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
  // clipboard/execCommand mock 手法照本仓既定先例 src/files/util/clipboard.test.ts:
  // jsdom 原生零 `document.execCommand`(不是"存在但为 undefined"——属性根本不存在),
  // `vi.spyOn` 要求属性已存在,故直接赋值 `document.execCommand = vi.fn(...)`,
  // 用 `Object.defineProperty(navigator, 'clipboard', {value, configurable:true})`
  // 而不是 `delete navigator.clipboard`(jsdom 下 `navigator.clipboard` 是原型链上的
  // getter,`delete` 在自有属性不存在时是无副作用的空操作,反而验证不了任何东西)。
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
  })

  it('① navigator.clipboard.writeText 成功 → emit toast(Copied)', async () => {
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

  it('② 🔴 navigator.clipboard 不存在(HTTP-IP 非安全上下文,记忆 newui-clipboard-insecure-reka)→ 走 execCommand 兜底,返回 true → 仍 emit toast(Copied)', async () => {
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

  it('③ 🔴 execCommand 返回 false → emit toast(Copy failed)(判据:execCommand 确实被调用,不是零判别力的「反正都是失败消息」)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => false) as typeof document.execCommand
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    await w.find('.k-chunk-viewer-foot .k-btn.ghost').trigger('click')
    await flushPromises()
    // 🔴 评审第一必查项警告的坑:光断言 toast 文案不够 —— 若 execCommand 兜底整段被删掉,
    // `ok` 也会停留在初始的 `false`,emit 的文案与此处期望恰好相同,断言会"假通过"。
    // 必须额外钉住 execCommand 真的被调用过,才能证明走的是兜底路径而不是"根本没试就报失败"。
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(w.emitted('toast')).toEqual([['复制失败,请手动选择']])
  })

  it('④ plain = 剥标签后的正文(highlight() 产出的 <mark> 标签不进剪贴板)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue({
      chunks: [{ chunk_no: 0, text: 'hello world foo' }],
      anchor_chunk_no: 0,
    })
    const w = mount(FileDetailDrawer, { props: { file: makeFile(), query: 'world' } })
    await flushPromises()
    // viewerHtml 此刻应含 <mark>(highlight 命中了 query="world")
    expect(w.find('.k-chunk-content').html()).toContain('<mark>')
    await w.find('.k-chunk-viewer-foot .k-btn.ghost').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('hello world foo')
  })
})

describe('FileDetailDrawer — N43: following fileDetailDrawerDistill.spec.js(test approach must change, see file header explanation)', () => {
  it('🔴 传的是 file.fullPath,不是 file.path(dirname)—— 判据:改成 file.path → 必须报红', async () => {
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

  it('成功 → emit toast(Queued for note distillation)', async () => {
    notes.distillFile.mockResolvedValue({ queued: true })
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile({ name: 'a.pdf', fullPath: '/DATA/Documents/a.pdf' })
    const w = mount(FileDetailDrawer, { props: { file } })
    await w.find('.k-drawer-actions .k-btn.outline:nth-of-type(2)').trigger('click')
    await flushPromises()
    expect(w.emitted('toast')).toEqual([['已加入笔记沉淀队列']])
  })

  it('失败 → emit toast(Could not queue this file)', async () => {
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
  it('.pdf → 沉淀按钮渲染', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile({ name: 'a.pdf' }) } })
    expect(w.findAll('.k-drawer-actions .k-btn.outline')).toHaveLength(2) // 下载 + 沉淀
  })

  it('.png → 沉淀按钮不渲染(§9.11 可点性:v-if="canDistill")', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile({ name: 'a.png' }) } })
    expect(w.findAll('.k-drawer-actions .k-btn.outline')).toHaveLength(1) // 只有下载
  })
})

describe('FileDetailDrawer — K49: v-html injection(component layer render, util layer escape already tested by T3)', () => {
  it('喂含 <script> 的 snippet → 渲染 DOM 里 querySelector("script") 为 null、<mark> 在(chunk 列表)', async () => {
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

  it('喂含 <img onerror> 的 snippet(经 fetchFull 落到 viewerHtml)→ 渲染 DOM 里无可执行的 onerror 属性(已转义)', async () => {
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

describe('FileDetailDrawer —— N41 Esc 监听(created/beforeDestroy → onMounted/onBeforeUnmount)', () => {
  it('挂载时注册 keydown;按 Esc 发 close;卸载时用同一个函数引用注销(判据:删掉 onBeforeUnmount → 必须报红,见 T5 报告 RED 探针)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })

    const addCall = addSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(addCall, '未找到 keydown 的 addEventListener 调用').toBeDefined()
    const handler = addCall![1]

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('close')).toHaveLength(1) // 未增长

    w.unmount()
    const removeCall = removeSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(removeCall, '未找到 keydown 的 removeEventListener 调用').toBeDefined()
    expect(removeCall![1]).toBe(handler)
  })
})

describe('FileDetailDrawer —— T5 DoD-12:自动上膛守卫(views/SearchView.vue 由 T6 建,现在还不存在)', () => {
  // 🔴 本 describe 块只放"惰性时该恒过"的那一条永久用例。
  // 「上膛证明」(临时创建 views/SearchView.vue → 必须报红 → 删除还原 → 转绿)与「两种偏态各一条」
  // 不写进永久测试文件 —— 那样会把一次性验证行为烧进 CI(读写真实文件系统、且其中一步故意
  // 制造失败态),这不是这条守卫的职责。已在 T5 报告里用 `cp`/临时文件 + 完整命令输出的方式
  // 手工做了这两类 RED 探针并逐一贴出,证据见报告 §（自动上膛守卫)。
  const searchViewPath = resolve(__dirname, '../views/SearchView.vue')

  it('🔴 若 views/SearchView.vue 存在,则它必须 import 本组件(现在文件不存在 ⇒ 惰性通过,非 skip/todo)', () => {
    if (!existsSync(searchViewPath)) {
      // 惰性分支:文件真的不存在,断言仍然被执行到(不是 it.skip/it.todo),只是判据真空成立。
      expect(existsSync(searchViewPath)).toBe(false)
      return
    }
    const src = readFileSync(searchViewPath, 'utf8') as string
    expect(src).toMatch(/FileDetailDrawer\.vue/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 SP8-P5f Task 1b —— 债务 M-1(P5e 终审 Minor-1)的补漏块
//
// P5e 终审实测:`fetchFull()` 传给 `store.loadChunkContext` 的实参在本文件里
// **一条都没被读过**(全量 `mock.calls` 列举里零命中)⇒ 把 `window: 2` 改成任意
// 值,3125 例全绿(终审探针 F3:`window: 7` → 全绿)。
//
// 🔴 本块**只加断言,产品码一行未动** —— `FileDetailDrawer.vue:116-121` 的
// `window: 2` 经 P5e 终审对蓝本 `bp-FileDetailDrawer.vue:153` 逐字核为**正确**。
// ⚠️ 杀伤面(终审记录):`knowledgeStore.ts` 的 `loadChunkContext` 默认参数也是 2
// ⇒ **删掉该入参无害,只有改值才有害** —— 所以判据钉的是「值 === 2」,
// 不是「键存在」。
//
// 判据(RED 探针,见 p5f-task-1b-report.md):把产品码改成 `window: 3` → 必须报红。
// ═══════════════════════════════════════════════════════════════════════════

describe('FileDetailDrawer —— 债务 M-1:loadChunkContext 的实参(window: 2 是硬判据)', () => {
  it('🔴 window === 2(数值 2,不是字符串/未传;改成 3 即报红)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0][0] as { window?: unknown }
    expect(arg.window).toBe(2)
    expect(typeof arg.window).toBe('number')
  })

  // 🔴 加固申报(治理 §9.10 / 裁定 R22):brief 的 DoD 只要求钉住 `window: 2`。
  // 另外三个入参同样零守卫(同一次 `mock.calls` 缺口),它们与 `window` 一起决定
  // 这一发请求打向哪个 chunk —— 顺手一并钉住是**加固**,不放宽任何既有断言。
  it('🔴 四个入参整体形状:fileId / kind / chunkNo 取自当前 chunk,window 恒 2', async () => {
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

  it('🔴 切到第二个 chunk 后重新发起:chunkNo 跟着变,window 仍是 2(不是只有首发才对)', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const file = makeFile()
    const w = mount(FileDetailDrawer, { props: { file } })
    await flushPromises()
    // 治理 §13-1:先确认第二个 chunk 在本用例数据下真的渲染成可点元素
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
