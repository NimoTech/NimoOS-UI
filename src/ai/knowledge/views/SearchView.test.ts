// SP8-P5e Task 6 —— `SearchView.vue` 上半单测(搜索框 + 高级面板 + `run()` + 四态)。
// 蓝本 `NimoOS-UI@7a6ee6b7` `src/views/AI/Knowledge/SearchView.vue`。
//
// ═══ 范围自证 ═══
// 本文件不测(全归 T7):结果卡列表的渲染细节(`:121-156`,除了"phase 变成
// 'results' 且 results/totalChunks 数值正确"这个**状态层**事实——那属于本刀的
// run() 分支,markup 归 T7)· 两个子组件的挂载 markup(`FileDetailDrawer`/
// `KFileViewer` 的 `<template>` 接线)· `fetchBlobUrl`/`openOriginal`/
// `downloadFile`/`onDrawerToast` 的任何行为。
//
// ═══ mock 边界(治理 §4.1)═══
// `store.runSearch` 用真 Pinia + `vi.spyOn(store, 'runSearch')` 逐条 mock,返回值
// = 后端原始 snake_case(`knowledgeStore.ts:550-561` 零归一化),不是 camelCase——
// `toFileResults` 才是归一化的地方,搞反了按 Critical。
//
// ═══ fixture 出处(三级标签逐个标注,裁定 R3 约束 1 / R9)═══
//   F1  —— REAL,`.superpowers/sdd/p5e-fixtures/F1-search-text.empty.REAL.json`,
//          原样(该文件本来就零 `_` 前缀键,见 README §3.3 的 PURE_REAL 例外)。
//   F4  —— REAL,`F4-search-text.no_accessible_roots.REAL.json`,原样。用于 N38
//          反向断言(非空 `warnings` 但不含 `rerank_unavailable` → 不应置真)。
//   F11 —— CONSTRUCTED(D-6 模具,裁定 R2:rerank 真机不可达,这条 warning 本机
//          无法端到端触达),`F11-rerank-warning.CONSTRUCTED.json`,已删
//          `_provenance`/`_authoritative_string`/
//          `_other_real_warning_strings_in_the_same_slice` 三个 `_` 前缀台账键。
//   F5b —— REPLAYED,`F5b-search-text.multifile.REPLAYED.json`。4 文件 × 每文件
//          2 chunk = 8 chunk。🔴 按 R9-3"测试里只许贴 1–2 条完整正文",本文件
//          **零条**完整正文——8 条 `preview.text` 全部截到真实前 70 字符,每条
//          都标了完整值的 `len`/`sha256`(完整正文的等价校验已在
//          `FileDetailDrawer.test.ts` 里对同一份 `file_id`(`dce79e8ea5…`)的两个
//          chunk 做过,本文件不重复贴全文)。已删 `_provenance` 台账键(§3.3)。
//          本刀只用它验证 `results.length`/`totalChunks`/`phase` 这些状态层事实,
//          不渲染 chunk 内容(结果卡 markup 归 T7)。`hits[]` 字段在这条代码路径
//          不被消费(`toFileResults` 优先取非空 `files`),故省略为 `[]`——
//          hits-回退分支已在 `searchAggregate.test.ts` 里覆盖过,不在本文件重复。
//
// ═══ K/N 命中(逐条见对应 describe 块内注释)═══
// K44(零 <style>)· K51(toggleSet 响应性)· N33(SAMPLE_QUERIES)· N34(advEnabled
// 反直觉判据)· N35(MIME_PREFIXES 逐字)· N36(buildFilters 三档假时钟)·
// N37(catch 不清 ms)· N38(showRerankWarn 假时钟)· N39(clear 清 openFile/
// viewerFile)· N40(?q= 深链 watch,immediate + 三条件)· 治理 §5.2 run() 过期
// 守卫(蓝本无,本期新增)· 裁定 R25(自动上膛守卫,本刀新加一条)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import SearchView from './SearchView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明(先例见 KFileViewer.test.ts / FileDetailDrawer.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname as pathDirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = pathDirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8') as string
// 🔴 E-60/E-25 家族:类名/调用形状的否定式断言要先剥注释(`SearchView.vue` 头部
// `//` 注释与模板尾部 `<!-- -->` 注释本身都大量引用 `<style`/`FileDetailDrawer`/
// `@close` 等字样做申报说明,是假阳性来源——首次实测就在这里栽了一次,见报告)。
// `.vue` 文件混排 `<script>` 的 `//` 行注释与 `<template>` 的 HTML 注释,两种都要剥。
const stripLineComments = (src: string) =>
  src
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

// ─── fixture 数据(出处见文件头)───

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

// F5b —— 4 文件 × 2 chunk。每条 preview.text 截到真实前 70 字符,完整值的
// len/sha256 逐条标注(取自 F5b-search-text.multifile.REPLAYED.json)。
const F5B_RESPONSE = {
  hits: [], // 本代码路径不消费(files 非空时优先),见文件头说明
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

// ─── 脚手架(照 QueueView.test.ts / FileDetailDrawer.test.ts 的既定写法)───

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

// ══════════════════════════════════════════════════════════════════════════

describe('SearchView —— K44:.vue 侧零 <style> 块', () => {
  it('文件内确认无任何 <style> 块', () => {
    const src = stripLineComments(read('./SearchView.vue'))
    expect(/<style/.test(src)).toBe(false)
  })
})

describe('SearchView —— 范围自证:不写结果卡 markup / 不写两个子组件挂载 markup', () => {
  it('模板不含 <FileDetailDrawer/<KFileViewer markup(只 import,不挂载,裁定 R25)', () => {
    const raw = read('./SearchView.vue')
    const src = stripLineComments(raw) // 剥注释,否则会被本文件自己的申报注释假阳性命中
    expect(/<FileDetailDrawer[\s/>]/.test(src), '不许出现 <FileDetailDrawer 挂载 markup(归 T7)').toBe(false)
    expect(/<KFileViewer/.test(src), '不许 import 或挂载 KFileViewer(归 T7)').toBe(false)
    expect(/from '\.\.\/components\/FileDetailDrawer\.vue'/.test(raw), '必须 import FileDetailDrawer 以满足 T5 DoD-12').toBe(
      true,
    )
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
  // 🔴 本 describe 块只放"惰性时该恒过"的永久用例。「上膛证明」(临时把
  // `<FileDetailDrawer v-if="openFile" ... />` 加进模板 → 必须报红 → 补全四个
  // 监听 → 转绿 → 删除还原)不写进永久测试文件——那样会把一次性验证行为烧进
  // CI(读写真实文件系统、其中一步故意制造失败态),已按 T5 DoD-12 同款手法在
  // 报告里用 cp/临时文件 + 完整命令输出的方式手工做了这两类 RED 探针并逐一贴出。
  it('🔴 现在模板不含 <FileDetailDrawer(markup 归 T7)⇒ 惰性通过,非 skip/todo', () => {
    const src = stripLineComments(read('./SearchView.vue')) // 剥注释,防假阳性(同上一个 describe 块的教训)
    const hasMarkup = /<FileDetailDrawer[\s/>]/.test(src)
    if (!hasMarkup) {
      expect(hasMarkup).toBe(false)
      return
    }
    for (const ev of ['@close', '@open', '@download', '@toast']) {
      expect(src.includes(ev), `模板含 <FileDetailDrawer 时必须同时接 ${ev}`).toBe(true)
    }
  })
})
