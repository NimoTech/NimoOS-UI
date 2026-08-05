// SP8-P5e Task 5 —— `FileDetailDrawer.vue` 单测。蓝本 `NimoOS-UI@7a6ee6b7`
// `src/views/AI/Knowledge/components/FileDetailDrawer.vue`(220 行,全部本刀移植)+
// 承接的 Vue2 spec `src/views/AI/Knowledge/__tests__/fileDetailDrawerDistill.spec.js`(N43,
// 测法必须改,见下方对应 describe 块)。
//
// ═══ mock 边界(治理 §4.1)═══
// `service.notes.distillFile` 用 `vi.hoisted` mock;`isDistillableName` 走
// `importOriginal` 保留真实实现(唯一定义处在 `NimoOS-Service/src/notes.ts` 的
// `DISTILL_EXTS`,N44 要求本仓不重定义扩展名表 —— 若这里也 mock 掉,`canDistill` 的
// `.pdf`/`.png` 两条用例就测不到真实扩展名表)。
// `store.loadChunkContext` 用真 Pinia + `vi.spyOn(store, 'loadChunkContext')` 逐条
// mock(`store.runSearch` 不涉及,那是 T6/T7 的活),返回值 = 后端原始 snake_case
// (`{chunks:[{chunk_no,text}], anchor_chunk_no}`),照治理 §4.1 的层次表。
//
// ═══ fixture 出处(三级标签逐个标注,裁定 R3 约束 1 / R9)═══
// `REAL_FILE_ID` / `CHUNK0_TEXT_PREFIX` / `CHUNK1_TEXT_PREFIX` 取自
// `.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json`
// (`files[0]`,真实 file_id/mime/score/mtime_ms/path,REPLAYED)。
// `F6_ANCHOR_TEXT_PREFIX`/`F6B_ANCHOR_TEXT_PREFIX` 取自
// `F6-search-chunk.window.REPLAYED.json` / `F6b-search-chunk.window-multi.REPLAYED.json`
// 的 anchor 条目(REPLAYED)。🔴 按 R9-3「测试里只许贴 1–2 条完整正文」,本文件**零条**
// 完整正文 —— 全部截到真实前 48–72 字符(仍是真实数据的真实前缀,不是手编内容),
// 每条都标了完整值的 `len`/`sha256`,校验命令统一见下方注释(把 `<n>` 换成对应长度即可
// 复核前缀确实是该 sha256 对应值的真前缀):
//   python3 -c "import json,hashlib; d=json.load(open('.superpowers/sdd/p5e-fixtures/<FILE>')); \
//     t=<取值路径>; print(len(t), hashlib.sha256(t.encode()).hexdigest())"
// `F12_CONSTRUCTED`(anchor 缺席兜底的唯一样本)取自
// `F12-search-chunk.anchor-absent.CONSTRUCTED.json`(CONSTRUCTED,D-6 模具,本身已经很短,
// 全文照抄)。
//
// ═══ K/N 命中(逐条见对应 describe 块内注释)═══
// K44 · emit 契约(不直调 useToast)· N42(fetchFull 四条 reqId 守卫)· N43(distill 测法改)·
// N44(canDistill 用包内 isDistillableName)· K48(四函数零重复定义)· K49(v-html 注入)·
// N41(Esc)· T5 DoD-12(自动上膛守卫)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见既有先例(KFileViewer.test.ts)
import { readFileSync, existsSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname as pathDirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { ChunkVM, FileVM } from '../util/searchAggregate'
import FileDetailDrawer from './FileDetailDrawer.vue'

const __dirname = pathDirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8') as string
// 🔴 E-60/E-25 家族:类名/调用形状的否定式断言要先剥注释(注释里提到 `<style>`/`useToast()`/
// `function highlight` 等字样是假阳性——本文件头部注释本身就大量引用这些字样来做申报说明)。
// 只剥掉整行 `//` 注释(本文件不含需要保留判别力的色字面量注释,不适用相反方向的 E-60 色扫规则)。
const stripLineComments = (src: string) =>
  src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

// ─── mock service.notes.distillFile;isDistillableName 走 importOriginal 保真实实现 ───
const notes = vi.hoisted(() => ({ distillFile: vi.fn() }))
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { notes } }
})
import { service } from '@nimotech/nimoos-service'

// ─── fixture 数据(§0 出处说明,截到真实前缀)───
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

/** REPLAYED —— F6:满窗口 5 条,anchor(2387)居中。非 anchor 条目的 text 只保留真实前 48
 * 字符(component 只用 `chunk_no` 做 `.find()` 匹配,非 anchor 条目的 text 从不被渲染,
 * 截断不影响任何断言的判别力,见文件头 R9-3 说明)。 */
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

/** REPLAYED —— F6b:anchor(1)贴着 chunk_no 下界 ⇒ 只取到 4 条(不足 2W+1=5),钉住
 * 「后端只按窗口过滤 + 升序,不保证条数」。 */
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

/** CONSTRUCTED(D-6 模具)—— anchor 不在 chunks 里的唯一样本,逐字照抄
 * `F12-search-chunk.anchor-absent.CONSTRUCTED.json`(已剥 `_provenance`)。权威源:
 * `NimoOS-Search/service/authz.go:96-149`(GetChunkWindow 把请求 chunk_no 原样回显成
 * anchor_chunk_no,但 chunks 只保留仍存在的邻居——若 anchor 那条被 re-chunk/tombstone
 * 掉,anchor 就不在 chunks 里)。 */
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

describe('FileDetailDrawer —— K44:.vue 侧零 <style> 块', () => {
  it('文件内确认无任何 <style> 块', () => {
    const src = stripLineComments(read('./FileDetailDrawer.vue'))
    expect(/<style/.test(src)).toBe(false)
  })
})

describe('FileDetailDrawer —— K48:四个函数零重复定义,一律从 util/searchAggregate import', () => {
  it('grep 自证:highlight/fmtMtime/relLevel/relLabel 在本文件里都是「零函数声明」', () => {
    const rawSrc = read('./FileDetailDrawer.vue')
    const src = stripLineComments(rawSrc)
    for (const fn of ['highlight', 'fmtMtime', 'relLevel', 'relLabel']) {
      expect(new RegExp(`function ${fn}\\b`).test(src), `${fn} 不应在本文件里重复定义`).toBe(false)
    }
    expect(/from '\.\.\/util\/searchAggregate'/.test(rawSrc)).toBe(true)
  })
})

describe('FileDetailDrawer —— 渲染:文件信息 / 匹配段计数 / 修改时间 / 摘要行', () => {
  it('kind 标签大写 / 路径 / "{n} matching sections" / Modified 日期', () => {
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

  it('summary 行 = aiKbFdSummary(n=chunks.length, query),按真实 i18n 值拼接', () => {
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

describe('FileDetailDrawer —— activeId 初值 / select / step 边界(DoD-3)', () => {
  it('初值 = 首个 chunk 的 id(第一条 .k-chunk-item 的 data-active=true)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    const items = w.findAll('.k-chunk-item')
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
  })

  it('activeId 初值 = null(判据:chunks=[] 时无任何 .k-chunk-item 具备 data-active=true)', () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile({ chunks: [] }) } })
    expect(w.findAll('.k-chunk-item')).toHaveLength(0)
  })

  it('点击第二条 chunk(select)→ data-active 切换', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await w.findAll('.k-chunk-item')[1].trigger('click')
    const items = w.findAll('.k-chunk-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('true')
    expect(w.find('.k-chunk-nav-count').text()).toBe('2 / 2')
  })

  it('step 边界:curIndex=0 时 step(-1) 不越界(判据:去掉边界检查 → 必须报红,见下方 RED 探针)', () => {
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

  it('step 边界:curIndex=末尾 时 step(+1) 不越界', async () => {
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

describe('FileDetailDrawer —— fetchFull() N42 四条 reqId 过期守卫(蓝本自带,照抄)', () => {
  it('① 逻辑交错:选A→选B→B先回→A后回,渲染内容是 B 的', async () => {
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

  it('② 🔴 两实例交错守作用域(判据:activeId 挪到模块级 → 必须报红,见 T5 报告 RED 探针)', async () => {
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

  it('③ catch 分支也有 reqId 判断:失败的旧请求不覆盖新内容', async () => {
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

  it('④ finally 里的 loading 也带 reqId 判断:旧请求的 finally 不清空当前请求已经置起的 loading', async () => {
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

  it('⑤ 🔴 chunkNo == null 早退(蓝本 :147)—— file.chunks 为空时 fetchFull 不发起任何请求', async () => {
    const store = withPinia()
    const spy = vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    mount(FileDetailDrawer, { props: { file: makeFile({ chunks: [] }) } })
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })

  it('mock 形状 = 后端原始 snake_case(F6:满窗口 5 条,anchor 居中)—— fetchFull 正确取到 anchor 的 text', async () => {
    const store = withPinia()
    vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)
    const w = mount(FileDetailDrawer, { props: { file: makeFile() } })
    await flushPromises()
    expect(w.find('.k-chunk-content').html()).toContain(F6_ANCHOR_TEXT_PREFIX)
  })

  it('mock 形状 = 后端原始 snake_case(F6b:anchor 贴下界,条数 4 < 2W+1=5)—— 仍正确取到 anchor', async () => {
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

describe('FileDetailDrawer —— emit 契约照抄(close/open/download/toast,不直调 useToast)', () => {
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

describe('FileDetailDrawer —— copy() 两条路径(蓝本 :164-181,评审第一必查项)', () => {
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

describe('FileDetailDrawer —— N43:承接 fileDetailDrawerDistill.spec.js(测法必须改,见文件头说明)', () => {
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

describe('FileDetailDrawer —— N44:canDistill 用包内 isDistillableName(真实实现,不重定义扩展名表)', () => {
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

describe('FileDetailDrawer —— K49:v-html 注入(组件层渲染,util 层的 escape 已由 T3 测过)', () => {
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
