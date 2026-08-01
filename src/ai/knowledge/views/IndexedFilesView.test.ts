// SP8-P5b Task 8 —— IndexedFilesView.vue「已收录文件」页,第 1 刀测试:骨架 +
// 过滤条 7 件 + 表头 meta + 错误横幅(K14/K19)+ 骨架屏 + 空态(N10)。
//
// 测试脚手架纪律同 T5 QueueView.test.ts(治理文件 §9):真 i18n(不手写子集)、
// mock @nimotech/nimoos-service(否则 onMounted 会真发请求)、afterEach 统一
// unmount 所有 wrapper(T5 的 M-4 教训 —— 本组件同样有一个 store **模块级**的
// 30 秒轮询定时器 `knowledgeStore.ts` 里的 `indexedPollTimer`,不 unmount 会让
// 残留定时器压住 `startIndexedPolling` 自己的守卫 `if (indexedPollTimer) return`,
// 后续挂载的组件实例永远起不了自己的轮询,进而污染下一个用例的调用次数断言)。
//
// 🔴 本刀不搭 vue-router 脚手架:`git grep '\$route\|\$router'` 对蓝本
// `IndexedFilesView.vue`(main@7a6ee6b7)零命中(与 QueueView 不同,本组件不读
// 路由 query),故只挂 pinia + i18n 两个 plugin。
//
// mock 形状来源(治理文件 §4,禁手编,逐个说明):
//   ai.parserFiles({...}) —— service.ai.* 对该端点零转换(§4.1),fixture 原样
//     snake_case。
//   FILES_ALL_8   —— 逐字取自 p5b-fixtures/files-all-8.json(8 个文件,
//     5 indexing / 3 ok,真机 2026-08-01 实测分布,见治理文件 §4.5/§12 E-8)。
//   ALL_OK_FILES  —— FILES_ALL_8 里 status==='ok' 的 3 行原样过滤,不是新造
//     数据,只是同一份 fixture 的子集(真机没有「全部 ok、零 indexing」的整
//     8 行场景,只能这样从已核实数据里挑出无 indexing 行的子集来覆盖
//     isAnyIndexing=false 分支)。
//   EMPTY_RESULT  —— 逐字取自 p5b-fixtures/files-has-error.json
//     (`{"total":0,"limit":3,"offset":0,"files":[]}`,真机 has_error=true 时的
//     真实空响应),借来当通用空态 fixture(形状不变,只是本文件不专门断言
//     它是从 has_error 场景来的)。
//   MULTI_ROOT_FILES —— 人工构造(README 明确登记:真机 8 个文件全部落在
//     /DATA 下,只有一个可派生 root 段,测不出 derivedRoots 多值排序 / 反查
//     不命中回落 'all' 这几条分支)。字段名与 fixture 的 file 行 schema
//     (file_id/paths/status,其余可选字段省略,组件本刀不读)完全一致,只是
//     把 paths[0].path 换成了 /DATA/…、/Wiki/…、以及一个没有第二个斜杠的
//     /lonely(topSegment 对它返回 null,不应进入 derivedRoots)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '../../../i18n'
import IndexedFilesView from './IndexedFilesView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
// T9:KIcon 用于断言状态徽标的图标 name prop(RED 探针①的钉子);fmtBytes/
// fmtAbs 别名导入,只用于「组件是否把正确字段接线给这些函数」的对照断言
// (这两个函数自身的边界值已在 util/indexedFilesView.test.ts(T7)覆盖,这里不
// 重复)。
import KIcon from '../components/KIcon.vue'
import { fmtBytes as fmtBytesRef, fmtAbs as fmtAbsRef } from '../util/indexedFilesView'
// 守卫缺口③(附录 B §B.0.4)的定向断言要读 .vue 源文件本身 —— 一律 node:fs,
// 不用 Vite 的 ?raw(vitest 的 CSSEnablerPlugin 会把样式源整体替换成空串,断言
// 会对空字符串"假通过";先例见 knowledgeStyles.test.ts 头注释③,QueueView.test.ts
// 同款复用)。本仓 "type": "module" → __dirname 在 ESM 下不可用,改用
// fileURLToPath + node:path 的等价写法;本仓未装 @types/node,逐行用下面这条
// 指令抑制 TS2307(照 knowledgeStyles.test.ts 头注释①②的既定手法逐字复用)。
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
// T10 追加 `parserReindexFiles` —— 重建三入口(rebuildRow / rebuildSelected /
// doRebuildAll)在 store 里都落到这一个包方法上(`knowledgeStore.ts:467` 与
// `:477`,只是 body 一个传 `file_ids` 一个传 `filter`)。形状取自
// `p5b-fixtures/reindex-one.http` 实测原文(snake_case,§4.1 零转换)。
const ai = vi.hoisted(() => ({ parserFiles: vi.fn(), parserReindexFiles: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// ── fixture 数据(逐字取自 p5b-fixtures/files-all-8.json)──
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
// 子集(非新造):FILES_ALL_8 里 status==='ok' 的 3 行,专门覆盖 isAnyIndexing=false。
const ALL_OK_FILES = FILES_ALL_8.filter((f) => f.status === 'ok')

// 逐字取自 p5b-fixtures/files-has-error.json(真机 has_error=true 时的真实空响应)。
const EMPTY_RESULT = { total: 0, limit: 3, offset: 0, files: [] }

// 人工构造(README 登记:真机全部文件在 /DATA 下,测不出多 root),同一套字段名。
const MULTI_ROOT_FILES = [
  { file_id: 'm1', paths: [{ root_id: 'r', path: '/DATA/a.log', mtime_ms: 1 }], status: 'ok' },
  { file_id: 'm2', paths: [{ root_id: 'r', path: '/DATA/b.log', mtime_ms: 2 }], status: 'ok' },
  { file_id: 'm3', paths: [{ root_id: 'r', path: '/Wiki/x.md', mtime_ms: 3 }], status: 'ok' },
  // 没有第二个斜杠——topSegment(蓝本 :439-444/T7 照抄)对它返回 null,不应进入
  // derivedRoots(与 T7 util 单测的边界用例同一条规则,这里是组件集成层面的确认)。
  { file_id: 'm4', paths: [{ root_id: 'r', path: '/lonely', mtime_ms: 4 }], status: 'ok' },
]

// T10:`reindex-one.http` 实测响应体逐字(200 分支)——
// `{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`。蓝本三处只读 `queued`。
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

// T5 M-4 教训:必须 unmount 所有挂载过的 wrapper,否则本组件 onMounted 触发的
// store.startIndexedPolling() 起的 30s setInterval(store 模块级句柄)会跨用例
// 存活,压住下一次挂载自己的 `if (indexedPollTimer) return` 守卫。
afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  // T10:K7 弹窗 portal 宿主(withHost() 往 document.body 塞的 .knowledge-app)
  // 必须清掉,否则下一个用例的 `host.querySelector('.k-modal')` 会命中上一个
  // 用例遗留的宿主(先例 QueueView.test.ts 的 `document.body.innerHTML = ''`,
  // 这里只精确移除自己造的宿主,不清整个 body)。
  document.querySelectorAll('.knowledge-app').forEach((el) => el.remove())
})

// ──────────────────────────────────────────────────────────────────────
// 骨架容器
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 骨架容器(蓝本 :1-5)', () => {
  it('.k-view > .k-scroll > .k-scroll-inner 三层嵌套存在', async () => {
    const w = await mountFiles()
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────
// 过滤条 7 件 —— 每件的「改动 → offset 归零 + 清选择 + 清错误横幅 + 重载」
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 过滤条:_applyFilter 四件事(offset 归零/清选择/清错误横幅/重载)', () => {
  // 每条用例先把三个「脏」状态都摆好(offset 非零、selSet 非空、errorBanner 非
  // 空),再触发一次过滤器改动,断言四件事全部发生 —— 比只断言其中一件更严格
  // (RED 探针②专门删 offset=0 这一行来验证这条判别力)。
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

  it('1) Root 下拉切到具体段:path_prefix 变为 /DATA/ + 四件事 + 重载', async () => {
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

  it('1b) Root 下拉切回 "all":path_prefix 清空 + 重载', async () => {
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

  it('2) 路径前缀输入:每敲一键整发重载(N9,无 debounce)+ 四件事', async () => {
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

  it('3) 路径前缀清除按钮:baseline 两个清除按钮都不渲染(两个前缀都空);path_prefix 非空后只出现 1 个(两侧对照)', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    expect(w.findAll('.k-filt-clear')).toHaveLength(0) // 两个前缀都空:path 的清除按钮不渲染,mime 那边走 chip 分支
    expect(w.find('.k-filt-chip').exists()).toBe(true)
    store.indexedFiles.filters.path_prefix = '/DATA/Wiki/'
    await flush()
    expect(w.findAll('.k-filt-clear')).toHaveLength(1) // 只有 path 的清除按钮出现,mime 仍空、仍是 chip
    expect(w.find('.k-filt-chip').exists()).toBe(true)
  })

  it('3b) 路径前缀清除按钮点击行为:清空 + 四件事 + 重载', async () => {
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

  it('4) 类型前缀输入:整发重载 + 四件事', async () => {
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

  it('5) 类型前缀清除按钮:清空 + 四件事 + 重载', async () => {
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

  it('6) 「旧 .doc」快捷 chip:仅在 mime_prefix 为空时渲染,点击写入固定前缀 + 四件事', async () => {
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
    // mime_prefix 非空后,chip 应该消失,换成清除按钮(两侧对照)
    expect(w.find('.k-filt-chip').exists()).toBe(false)
  })

  it('7) 状态下拉改动(N12 见专门 describe):同样触发四件事 + 重载', async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    dirtyState(store, w)
    ai.parserFiles.mockClear()
    await w.findAll('.k-filt select')[1].setValue('tombstoned')
    await flush()
    expectClean(store, w)
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('8) 「仅看失败」勾选:has_error 切换 + 四件事 + 重载', async () => {
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

  it('9) 排序下拉改动:sort 字段更新 + 四件事 + 重载', async () => {
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

  it('10) 升降序按钮:order 在 desc/asc 间切换 + 四件事 + 重载', async () => {
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

  it('11) 「清除」按钮:六个筛选字段复位到默认值 + 四件事 + 重载', async () => {
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

  it('12) 空态里的「清空筛选」按钮(N10 的 .k-empty-btn)同样调用 clearFilters', async () => {
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
// 过滤条文案(修复轮 1,M-3):集合式断言钉死四个 label + 状态下拉三个 option
// 的确切文字(其中 aiKbStatusActive 是附录 A ⚠️N #85 的错译「已启用」,照抄不
// 改)+ 「仅看失败」勾选文字 + 「清除」按钮文字 + 「旧 .doc」chip 文字/title +
// 两个 placeholder。之前这些文案只在别的用例里顺带 toContain 过按钮整体文字,
// 没有专门的定向断言 —— 将来有人把某个键的值"顺手改对"或把两个键的键名写串,
// 三门不会报红。RED 探针:把 aiKbStatusActive 的值临时改成"有效"→ 这条用例
// 精确报红(见任务报告)。
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 过滤条文案(集合式断言,防止顺手改对/键名写串)', () => {
  it('四个 .k-filt-label 的确切文字', async () => {
    const w = await mountFiles()
    const labels = w.findAll('.k-filt-label').map((l) => l.text())
    expect(labels).toEqual(['存储根', '路径前缀', '类型前缀', '状态'])
  })

  it('状态下拉三个 option 的确切文字(含 ⚠️N #85 错译「已启用」,照抄不改)', async () => {
    const w = await mountFiles()
    const opts = w.findAll('.k-filt select')[1].findAll('option').map((o) => o.text())
    expect(opts).toEqual(['已启用', '已删除', '全部'])
  })

  it('「仅看失败」勾选文字 / 「清除」按钮文字', async () => {
    const w = await mountFiles()
    expect(w.find('.k-filt-check').text()).toBe('仅看失败')
    expect(w.find('.k-filter-bar .k-btn.ghost').text()).toBe('清除')
  })

  it('「旧 .doc」快捷 chip 的文字与 title', async () => {
    const w = await mountFiles()
    const chip = w.find('.k-filt-chip')
    expect(chip.text()).toBe('旧 .doc')
    expect(chip.attributes('title')).toBe('一键圈出待修复的旧 .doc')
  })

  it('两个前缀输入框的 placeholder', async () => {
    const w = await mountFiles()
    const inputs = w.findAll('.k-filt-grow input')
    expect(inputs[0].attributes('placeholder')).toBe('/DATA/Wiki/ …')
    expect(inputs[1].attributes('placeholder')).toBe('application/legacy-office/ …')
  })
})

// ──────────────────────────────────────────────────────────────────────
// filtersDirty —— 六个条件各自独立 + 全默认 false
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — filtersDirty(六条件独立覆盖 + 全默认 false)', () => {
  it('全默认(未改任何筛选字段)→ false,清除按钮禁用', async () => {
    const w = await mountFiles()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeDefined()
  })

  it('path_prefix 非空 → true', async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.path_prefix = '/DATA/'
    await flush()
    expect(w.find('.k-filter-bar .k-btn.ghost').attributes('disabled')).toBeUndefined()
  })

  it('mime_prefix 非空 → true', async () => {
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
// N12 —— statusViewLocal ↔ API tombstoned 反向映射,两个方向 × 三个值全覆盖
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — N12: active ↔ alive 反向映射(statusViewLocal × statusSuffix 全覆盖)', () => {
  it("读方向 1/3:tombstoned='alive' → 下拉选中 'active',statusSuffix 为空", async () => {
    const w = await mountFiles() // 默认 tombstoned==='alive'
    expect((w.findAll('.k-filt select')[1].element as HTMLSelectElement).value).toBe('active')
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件')
  })

  it("读方向 2/3:tombstoned='tombstoned' → 下拉选中 'tombstoned',statusSuffix ' (已删除)'", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.tombstoned = 'tombstoned'
    await flush()
    expect((w.findAll('.k-filt select')[1].element as HTMLSelectElement).value).toBe('tombstoned')
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件 (已删除)')
  })

  it("读方向 3/3:tombstoned='all' → 下拉选中 'all',statusSuffix ' (全部)'", async () => {
    const w = await mountFiles()
    useKnowledgeStore().indexedFiles.filters.tombstoned = 'all'
    await flush()
    expect((w.findAll('.k-filt select')[1].element as HTMLSelectElement).value).toBe('all')
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件 (全部)')
  })

  it("写方向 1/3:选「已启用」(option value='active')→ store 存的是 'alive',不是直传 'active'(RED 探针③的钉子)", async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.tombstoned = 'tombstoned' // 先偏离,确保下面真的是这次改动写回去的
    await flush()
    await w.findAll('.k-filt select')[1].setValue('active')
    await flush()
    expect(store.indexedFiles.filters.tombstoned).toBe('alive')
    expect(store.indexedFiles.filters.tombstoned).not.toBe('active')
  })

  it("写方向 2/3:选 '已删除'(tombstoned)→ 原样直传 'tombstoned'", async () => {
    const w = await mountFiles()
    const store = useKnowledgeStore()
    await w.findAll('.k-filt select')[1].setValue('tombstoned')
    await flush()
    expect(store.indexedFiles.filters.tombstoned).toBe('tombstoned')
  })

  it("写方向 3/3:选 '全部'(all)→ 原样直传 'all'", async () => {
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
describe('IndexedFilesView — derivedRoots(best-effort)与 rootSelect 反查', () => {
  it('多 root:排序后去重,没有第二个斜杠的路径不计入(RED 探针①的钉子)', async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const options = w.findAll('.k-filt select')[0].findAll('option')
    // options[0] 固定是 "all",其余是 derivedRoots 排序后的结果
    const optionValues = options.slice(1).map((o) => o.attributes('value'))
    expect(optionValues).toEqual(['DATA', 'Wiki']) // 去重(a.log/b.log 都是 DATA)+ 排序,/lonely 不计入
  })

  it("rootSelect 反查:path_prefix='/DATA/' 命中 derivedRoots → 下拉回显 'DATA'", async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/'
    await flush()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('DATA')
  })

  it("rootSelect 反查:path_prefix 不匹配任何 derivedRoots → 回落 'all'", async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/Unknown/'
    await flush()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('all')
  })

  it("rootSelect 反查:path_prefix 不是 '/seg/' 整体形状(有更多层级)→ 回落 'all'", async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 4, files: MULTI_ROOT_FILES })
    const w = await mountFiles()
    const store = useKnowledgeStore()
    store.indexedFiles.filters.path_prefix = '/DATA/sub/'
    await flush()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('all')
  })

  it("rootSelect 反查:path_prefix 为空 → 'all'", async () => {
    const w = await mountFiles()
    expect((w.findAll('.k-filt select')[0].element as HTMLSelectElement).value).toBe('all')
  })
})

// ──────────────────────────────────────────────────────────────────────
// 表头 meta
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 表头 meta(蓝本 :60-90)', () => {
  it('ready 态文件计数文案:{n} indexed files(千分位)', async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: 12345, files: FILES_ALL_8 })
    const w = await mountFiles()
    expect(w.find('.k-files-count').text()).toBe('共 12,345 个文件')
  })

  it('isAnyIndexing=true(FILES_ALL_8 含 5 行 indexing)时显示自动刷新提示', async () => {
    const w = await mountFiles()
    expect(w.find('.k-poll').exists()).toBe(true)
    expect(w.find('.k-poll').text()).toContain('自动刷新中 · 30s')
    expect(w.find('.k-poll').attributes('title')).toBe('只要还有索引中的行，每 30 秒自动刷新')
  })

  it('isAnyIndexing=false(全部 ok)时不显示自动刷新提示(两侧对照)', async () => {
    ai.parserFiles.mockResolvedValueOnce({ total: ALL_OK_FILES.length, files: ALL_OK_FILES })
    const w = await mountFiles()
    expect(w.find('.k-poll').exists()).toBe(false)
  })

  it('排序下拉三个选项文案正确', async () => {
    const w = await mountFiles()
    const opts = w.find('.k-sort select').findAll('option')
    expect(opts.map((o) => o.text())).toEqual(['索引时间', '大小', '向量数'])
  })

  it('升降序按钮:desc 时不旋转,asc 时旋转 180deg(内联样式,两侧对照)', async () => {
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
// 错误横幅 —— K14 / K19 + 反向断言
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 错误横幅(K14/K19,反向断言)', () => {
  it('K19: load-error 分支不回显 e.message,改用固定 aiKbLoadErrorBody(反向断言,RED 探针④的钉子)', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('ECONNREFUSED super-secret-backend-stack-trace'))
    const w = await mountFiles()
    const banner = w.find('.k-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.attributes('data-tone')).toBe('warn')
    expect(banner.text()).toContain('加载失败：')
    expect(banner.text()).toContain('无法读取已收录文件列表，请稍后重试。')
    // 反向断言:e.message 的原文一个字都不能出现
    expect(banner.text()).not.toContain('ECONNREFUSED')
    expect(banner.text()).not.toContain('super-secret-backend-stack-trace')
  })

  it('K14: rebuild-all 400 分支不回显后端 detail,只留固定 "400 Bad Request" + aiKbRebuildCapHint(反向断言)', async () => {
    const w = await mountFiles()
    // errorBanner 的赋值函数 doRebuildAll()(蓝本 :791-808/确认弹窗 :356-381)是
    // T9/T10 才落地的动作条功能,本刀先把「errorBanner 被填充后怎么渲染」这条
    // 展示链路做对。技术手法:<script setup> 顶层 ref 即便未 defineExpose,
    // @vue/test-utils 的 wrapper.vm 在测试环境下仍可读写(instance.proxy 走
    // setupState 双向读写,已实测验证),用它直接驱动这个分支,不是新增功能、
    // 也不是绕过组件公开行为——只是本刀没有可点击的 UI 入口能到达这个分支。
    ;(w.vm as unknown as { errorBanner: string | null }).errorBanner =
      'too many file_ids (max 500)'
    await nextTick()
    const banner = w.find('.k-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('400 Bad Request')
    expect(banner.text()).toContain('重建匹配文件超过 10,000 上限')
    // 反向断言:后端 detail 原文一个字都不能出现
    expect(banner.text()).not.toContain('too many file_ids')
    expect(banner.text()).not.toContain('max 500')
  })

  it('storeError 与 errorBanner 都为空时不渲染横幅', async () => {
    const w = await mountFiles()
    expect(w.find('.k-banner').exists()).toBe(false)
  })

  it('errorBanner 优先于 storeError(两者都非空时走 400 分支,不是 load-error 分支)', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('some load error'))
    const w = await mountFiles()
    expect(w.find('.k-banner').text()).toContain('加载失败：')
    ;(w.vm as unknown as { errorBanner: string | null }).errorBanner = 'too many file_ids (max 500)'
    await nextTick()
    expect(w.find('.k-banner').text()).toContain('400 Bad Request')
    expect(w.find('.k-banner').text()).not.toContain('加载失败：')
  })

  it('点击「关闭」同时清空本地 errorBanner 与 store 侧的 error', async () => {
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
// 骨架屏
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 骨架屏(蓝本 :106-132)', () => {
  it('pageState=loading 时渲染假表头 + 8 行骨架占位,文件计数区也是骨架条', async () => {
    let resolveFiles: (v: unknown) => void = () => {}
    ai.parserFiles.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFiles = resolve
        }),
    )
    const w = mount(IndexedFilesView, { global: { plugins: [i18n] } })
    mountedWrappers.push(w)
    // 只 nextTick,不 flushPromises——promise 本来就没 resolve,flush 也没意义,
    // 这里是要抓住「loading=true 但数据还没回来」这一帧。
    await nextTick()
    expect(w.find('.k-ftable').exists()).toBe(true)
    expect(w.findAll('.k-frow-skel')).toHaveLength(8)
    expect(w.find('.k-frow-fhead').exists()).toBe(true)
    expect(w.find('.k-files-count .k-skel').exists()).toBe(true)
    expect(w.find('.k-files-count').text()).toBe('') // loading 分支不显示计数文案(两侧对照)

    resolveFiles!({ total: FILES_ALL_8.length, files: FILES_ALL_8 })
    await flush()
    // T9 订正:ready 态现在也渲染 `.k-ftable`(真实文件行),所以「加载完成后
    // .k-ftable 消失」这条断言在 T8 落地时是对的(那时 ready 态还没有表格),
    // 但 T9 补上 ready 态表格后就不成立了——改成断言骨架占位行(仅 loading
    // 态独有)确实消失,这才是这条用例原本要守住的东西(骨架 → 真数据的切
    // 换,而不是"表格容器整体消失")。
    expect(w.findAll('.k-frow-skel')).toHaveLength(0)
    expect(w.find('.k-ftable').exists()).toBe(true)
    expect(w.find('.k-files-count').text()).toBe('共 8 个文件')
  })

  it('假表头文案:状态/路径/类型/大小/已收录/向量数/类型(Action 撞车)', async () => {
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
    expect(spans[6].text()).toBe('类型') // aiKbColAction 的⚠️N 错译,照抄
    resolveFiles!({ total: 0, files: [] })
    await flush()
  })
})

// ──────────────────────────────────────────────────────────────────────
// 空态
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 空态(蓝本 :135-142,N10)', () => {
  it('total=0 时渲染空态,文案与图标正确', async () => {
    ai.parserFiles.mockResolvedValueOnce(EMPTY_RESULT)
    const w = await mountFiles()
    expect(w.find('.k-empty').exists()).toBe(true)
    expect(w.find('.k-empty-title').text()).toBe('没有匹配的文件')
    expect(w.find('.k-empty-sub').text()).toBe(
      '没有匹配的文件。试着放宽路径 / 类型前缀，或把状态切到「全部」。',
    )
  })

  it('filtersDirty=false 时空态不出「清空筛选」按钮;filtersDirty=true 时才出(N10 的 .k-empty-btn,两侧对照)', async () => {
    ai.parserFiles.mockResolvedValueOnce(EMPTY_RESULT)
    const w = await mountFiles()
    expect(w.find('.k-empty-btn').exists()).toBe(false)
    // 直接改 store 的 filters 不会触发任何重载(重载只走 @change → _applyFilter),
    // 这里只是要驱动 filtersDirty 这个 computed 重新求值,不需要也不应该再排一次
    // mock response(修复轮 1,M-5:此前这里排了一个永远不会被消费的
    // mockResolvedValueOnce,会让读者误以为改 filters 能自动重载)。
    useKnowledgeStore().indexedFiles.filters.has_error = true
    await flush()
    expect(w.find('.k-empty-btn').exists()).toBe(true)
    expect(w.find('.k-empty-btn').text()).toContain('清空筛选')
  })

  // N10 报告显式说明:.k-empty-btn 是蓝本自身的未定义类(git grep 全仓只命中
  // IndexedFilesView.vue:139 这一行模板,knowledge.scss 里没有对应规则),渲染
  // 成无样式按钮与 Vue2 一致,不进 knowledgeStyles.test.ts 的白名单——本文件
  // 不为它另写样式存在性断言,这里只确认功能行为(点击调用 clearFilters,已在
  // 「过滤条 7 件」describe 的用例 12 覆盖)。
})

// ──────────────────────────────────────────────────────────────────────
// 属性态(附录 D.3 覆盖本刀范围内的那些)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 属性态(附录 D.3)', () => {
  it('.k-filt-check data-on 两侧都覆盖(true/false),直接比字符串值,不用 toBeUndefined', async () => {
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

  it('.k-banner data-tone 静态 "warn"', async () => {
    ai.parserFiles.mockRejectedValueOnce(new Error('x'))
    const w = await mountFiles()
    expect(w.find('.k-banner').attributes('data-tone')).toBe('warn')
  })
})

// ──────────────────────────────────────────────────────────────────────
// 生命周期
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 生命周期(created→refresh,beforeDestroy→停轮询)', () => {
  it('挂载即触发一次 loadIndexedFiles(ai.parserFiles 恰好一次)', async () => {
    await mountFiles()
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)
  })

  it('卸载会停掉 store 模块级轮询定时器,不会残留触发下一个实例的守卫(与 T5 M-4 同一教训)', async () => {
    // 修复轮 1,M-4(评审指出):w1/w2 与 vi.useFakeTimers() 此前没有
    // try/finally 兜底 —— 中间任一断言抛错,`vi.useRealTimers()` 与
    // `w2.unmount()` 都不会执行,真定时器状态 + 一个带 30s interval 的组件
    // 实例会泄漏到后续用例(与 T5 M-4 完全同一教训)。现在两个 wrapper 都推进
    // `mountedWrappers`(afterEach 兜底 unmount),`vi.useRealTimers()` 放进
    // finally,任何一步失败都不会遗留假计时器。
    vi.useFakeTimers()
    try {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      ai.parserFiles.mockResolvedValue({ total: FILES_ALL_8.length, files: FILES_ALL_8 }) // 含 indexing 行,会真起轮询
      const w1 = mount(IndexedFilesView, { global: { plugins: [i18n] } })
      mountedWrappers.push(w1)
      await flushPromises()
      expect(ai.parserFiles).toHaveBeenCalledTimes(1)

      w1.unmount() // onUnmounted → store.stopIndexedPolling()

      ai.parserFiles.mockClear()
      vi.advanceTimersByTime(30000)
      await flushPromises()
      expect(ai.parserFiles).not.toHaveBeenCalled() // 卸载后轮询确实停了

      // 关键回归钉子:换一个全新的 Pinia + 组件实例,它必须能起自己的轮询——
      // 如果上面忘了停轮询,`indexedPollTimer` 这个 store 模块级变量会一直非
      // null,下面这次 startIndexedPolling() 的 `if (indexedPollTimer) return`
      // 守卫会让它直接短路,永远起不来。
      setActivePinia(createPinia())
      ai.parserFiles.mockResolvedValue({ total: FILES_ALL_8.length, files: FILES_ALL_8 })
      const w2 = mount(IndexedFilesView, { global: { plugins: [i18n] } })
      mountedWrappers.push(w2)
      await flushPromises()
      ai.parserFiles.mockClear()
      vi.advanceTimersByTime(30000)
      await flushPromises()
      expect(ai.parserFiles).toHaveBeenCalledTimes(1) // 新实例的轮询真的起来了
    } finally {
      vi.useRealTimers()
    }
  })
})

// ──────────────────────────────────────────────────────────────────────
// 守卫缺口③:<template> 块零裸色字面量(照 T5 QueueView.test.ts 同款做法)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 守卫缺口③:<template> 块零裸色字面量', () => {
  it('<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量(RED 探针⑤的钉子)', () => {
    const src: string = readFileSync(resolve(__dirname, './IndexedFilesView.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]

    // 剥掉 var(...) 与 color-mix(...) 的内部(照 color-guard.test.ts / QueueView.test.ts
    // 的同款手法:逐字符扫描配对括号深度,支持嵌套 fallback)。
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
// SP8-P5b Task 9 —— 第 2 刀:表头行 + 文件行 · 行内详情面板 · 分页
// (蓝本 :146-317)。以下全部是本刀新增。
//
// 新增 mock 数据来源说明(治理 §4,禁手编,逐个说明):
//   FILE_OK / FILE_INDEXING —— 直接复用上面 FILES_ALL_8[1] / FILES_ALL_8[0]
//     (真实 fixture 行,不是新造)。
//   FILE_ERROR / FILE_TOMBSTONED / FILE_ZEROHINT —— 人工构造。治理文件 §4.5
//     已实测登记:真机 8 个文件只有 ok(3)/indexing(5) 两种 status,没有
//     error/tombstoned 行;vector_count===0 的唯一一行 status 是 indexing
//     不是 ok,所以 `status==='ok' && vector_count===0`(zerohint 的判据)
//     真机造不出、必须构造。字段形状与 files-all-8.json 的 file 行 schema
//     (file_id/paths/sha256_full/size/mime/modalities_done/parser_version/
//     indexed_at/tombstoned_at/vector_count/last_error/status)完全一致,
//     只是把值换成能触发 error/tombstoned/zerohint 分支的组合。
//   FILE_UNKNOWN_STATUS —— 人工构造,status 故意给一个 statusBadgeMap 里没
//     有的字符串,用于覆盖蓝本 :190/:194 的兜底分支(治理 §3.5 N14 明确要求)。
// ──────────────────────────────────────────────────────────────────────
const FILE_OK = FILES_ALL_8[1] // 真实 fixture 行,status='ok', vector_count=856
const FILE_INDEXING = FILES_ALL_8[0] // 真实 fixture 行,status='indexing', vector_count=0(zerohint 反例的钉子)

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

// 🔴 zerohint 需要 status==='ok' && vector_count===0 两个条件同时成立——治理
// §4.5 实测:真机唯一一行 vector_count===0 的 status 是 indexing 不是 ok,
// 本机造不出这种行,必须构造(与 FILE_INDEXING 对照,证明单靠 vector_count
// ===0 不够)。
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

// statusBadgeMap 查不到时的兜底分支(蓝本 :190/:194),人工构造。
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
// 表头行(蓝本 :148-165)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 表头行(蓝本 :148-165)', () => {
  it('7 个列标题文字(集合式断言,含 ⚠️N aiKbColAction「类型」撞车)', async () => {
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

  it('全选复选框 title = aiKbSelectAllTip', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-fhead .k-row-check').attributes('title')).toBe('全选当前页可选行')
  })

  it('可选行为 0(全部 tombstoned)时全选复选框禁用', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    expect(w.find('.k-frow-fhead .k-row-check').attributes('disabled')).toBeDefined()
  })

  it('存在可选行时全选复选框不禁用', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-fhead .k-row-check').attributes('disabled')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────
// N14 —— statusBadgeMap 四态 + 兜底分支,🔴 title 英文原串 + 反向断言
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — N14: statusBadgeMap 四态(data-s/icon/中文文案/title 英文原串)', () => {
  it('ok:data-s="ok"、图标 check(RED 探针①的钉子)、文案「已收录」、title="Indexed"(英文原串,RED 探针④的钉子)', async () => {
    const w = await mountWithFiles([FILE_OK])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('ok')
    expect(badge.findComponent(KIcon).props('name')).toBe('check')
    expect(badge.find('.k-status-badge-cn').text()).toBe('已收录')
    expect(badge.attributes('title')).toBe('Indexed')
    // 反向断言:title 不是中文,也不是键名
    expect(badge.attributes('title')).not.toBe('已收录')
    expect(badge.attributes('title')).not.toBe('aiKbStatusIndexed')
  })

  it('indexing:data-s="indexing"、图标 spinner、文案「Indexing」(K20 无译文回落英文)、title="Indexing"', async () => {
    const w = await mountWithFiles([FILE_INDEXING])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('indexing')
    expect(badge.findComponent(KIcon).props('name')).toBe('spinner')
    expect(badge.find('.k-status-badge-cn').text()).toBe('Indexing')
    expect(badge.attributes('title')).toBe('Indexing')
    // K20 特例:title 与徽标文字巧合都是英文 "Indexing"(Vue2 语言包本来就没
    // 有这个键的译文)——这不是 bug,反向断言改成对键名的排除。
    expect(badge.attributes('title')).not.toBe('aiKbStatusIndexing')
  })

  it('error:data-s="error"、图标 x、文案「错误」、title="Error"(英文原串)', async () => {
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

  it('N13:`.k-status-badge-cn` 类名照抄蓝本 :197(蓝本自身未定义类,不进白名单,渲染无样式 span)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-status-badge-cn').exists()).toBe(true)
    expect(w.find('.k-status-badge-cn').text()).toBe('已收录')
  })

  it('兜底分支:statusBadgeMap 里查不到的 status → data-s 回落 "ok"、title/文字都回落 file.status 原串、图标回落 check', async () => {
    const w = await mountWithFiles([FILE_UNKNOWN_STATUS])
    const badge = w.find('.k-status-badge')
    expect(badge.attributes('data-s')).toBe('ok')
    expect(badge.attributes('title')).toBe('quarantined')
    expect(badge.find('.k-status-badge-cn').text()).toBe('quarantined')
    // 修复轮 1,I-1:用例名声称覆盖了「图标回落 check」,但此前用例体只断言了
    // data-s/title/文案三项,没有 props('name') ——评审探针⑩把 badgeFor() 兜底
    // 分支的 icon 从 'check' 换成 'danger' 后 107 例全绿,证明这条是假覆盖。
    expect(badge.findComponent(KIcon).props('name')).toBe('check')
  })
})

// ──────────────────────────────────────────────────────────────────────
// 路径单元格 —— errhint(error 行)/ zerohint(ok && vector_count===0)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 路径单元格:errhint / zerohint', () => {
  it('路径文字 = filePath(file)(取 paths[0].path)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-pathtxt').text()).toBe(FILE_OK.paths[0].path)
    expect(w.find('.k-frow-pathtxt').attributes('title')).toBe(FILE_OK.paths[0].path)
  })

  it('errhint:status===error 且有 last_error 时渲染,title/文字都是 last_error 原文', async () => {
    const w = await mountWithFiles([FILE_ERROR])
    const hint = w.find('.k-frow-errhint')
    expect(hint.exists()).toBe(true)
    expect(hint.attributes('title')).toBe(FILE_ERROR.last_error)
    expect(hint.text()).toContain(FILE_ERROR.last_error)
  })

  it('errhint 反面:status=ok 时不渲染(两侧对照)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-errhint').exists()).toBe(false)
  })

  it('zerohint:status==="ok" && vector_count===0 时渲染,title=aiKbZeroVecTip、文字=aiKbZeroVec', async () => {
    const w = await mountWithFiles([FILE_ZEROHINT])
    const hint = w.find('.k-frow-zerohint')
    expect(hint.exists()).toBe(true)
    expect(hint.attributes('title')).toBe('已索引但没有可搜索内容（不是错误）')
    expect(hint.text()).toBe('无可搜索内容')
  })

  it('zerohint 反面:vector_count===0 但 status=indexing(FILE_INDEXING 真实数据)→ 不渲染(证明两个条件都要成立,RED 探针⑤的钉子)', async () => {
    const w = await mountWithFiles([FILE_INDEXING])
    expect(FILE_INDEXING.vector_count).toBe(0) // 前提确认:这行 vector_count 确实是 0
    expect(FILE_INDEXING.status).toBe('indexing') // 前提确认:但 status 不是 ok
    expect(w.find('.k-frow-zerohint').exists()).toBe(false)
  })

  it('zerohint 反面:status=ok 但 vector_count 非零(FILE_OK)→ 不渲染', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-zerohint').exists()).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────
// 类型标签 —— simplifyMime 的 5 个 data-kind + Legacy 角标
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 类型标签(simplifyMime 5 个 data-kind + Legacy 角标)', () => {
  const mk = (mime: string) => ({ ...FILE_OK, file_id: 'mk-' + mime, mime })

  it('data-kind="doc"(docx,非 legacy):wordprocessing mime', async () => {
    const w = await mountWithFiles([
      mk('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('doc')
    expect(tag.text()).toContain('DOCX')
    expect(tag.find('.k-type-legacy').exists()).toBe(false)
  })

  it('data-kind="doc"(旧 .doc,legacy=true):application/legacy-office mime', async () => {
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

  it('data-kind="txt"(text/plain)', async () => {
    const w = await mountWithFiles([mk('text/plain')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('txt')
    expect(tag.text()).toContain('TXT')
  })

  it('data-kind="code"(旧 .ppt,legacy=true):ms-powerpoint mime', async () => {
    const w = await mountWithFiles([mk('application/vnd.ms-powerpoint')])
    const tag = w.find('.k-type-tag')
    expect(tag.attributes('data-kind')).toBe('code')
    expect(tag.text()).toContain('PPT')
    expect(tag.find('.k-type-legacy').exists()).toBe(true)
  })

  it('data-kind="md"(text/markdown)', async () => {
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
// 大小 / 时间(fmtBytes/fmtRel/fmtAbs 的边界已在 util/indexedFilesView.test.ts
// (T7)覆盖,这里只验证组件把正确的字段接线到这些函数)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 大小/时间单元格(接线验证,边界见 T7 util 测试)', () => {
  it('大小单元格:文字=fmtBytes(size),title=千分位字节数+" bytes"', async () => {
    const w = await mountWithFiles([FILE_OK])
    // 限定在文件行内查找(表头「向量数」列标题 span 也带 .k-frow-num,不能整
    // 页 findAll,否则下标会被表头那个 span 顶掉)。
    const row = w.find('.k-frow-f:not(.k-frow-fhead)')
    const cell = row.findAll('.k-frow-num')[0] // 行内第一个 .k-frow-num 是大小列(向量数列另有 k-frow-vec 复合类)
    expect(cell.text()).toBe(fmtBytesRef(FILE_OK.size))
    expect(cell.attributes('title')).toBe(FILE_OK.size.toLocaleString() + ' bytes')
  })

  it('时间单元格:title=fmtAbs(indexed_at)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-time').attributes('title')).toBe(fmtAbsRef(FILE_OK.indexed_at))
  })
})

// ──────────────────────────────────────────────────────────────────────
// 向量数 —— data-zero
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 向量数(data-zero,RED 探针③的钉子)', () => {
  it('vector_count=0 → data-zero="true"', async () => {
    const w = await mountWithFiles([FILE_ZEROHINT])
    expect(w.find('.k-frow-vec').attributes('data-zero')).toBe('true')
    expect(w.find('.k-frow-vec').text().trim()).toBe('0')
  })

  it('vector_count!=0 → data-zero="false"(两侧对照)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-vec').attributes('data-zero')).toBe('false')
    expect(w.find('.k-frow-vec').text().trim()).toBe(FILE_OK.vector_count.toLocaleString())
  })
})

// ──────────────────────────────────────────────────────────────────────
// 重建按钮 —— 禁用条件 + 三种 title(文档化占位,见文件头注释)
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 重建按钮(禁用条件 + 三种 title)', () => {
  it('status=ok → 不禁用,title/文字=「强制重建本行」/「恢复」,图标 refresh', async () => {
    const w = await mountWithFiles([FILE_OK])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBe('强制重建本行')
    expect(btn.text()).toContain('恢复')
  })

  it('status=error → 不禁用,title/文字与 ok 相同(默认分支,不是 indexing/tombstoned 两条特例)', async () => {
    const w = await mountWithFiles([FILE_ERROR])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBe('强制重建本行')
    expect(btn.text()).toContain('恢复')
  })

  it('status=indexing → 禁用,title/文字=「重建中…」,图标 spinner(特例 1/3)', async () => {
    const w = await mountWithFiles([FILE_INDEXING])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('重建中…')
    expect(btn.text()).toContain('重建中…')
  })

  it('status=tombstoned → 禁用,title=「已删除，需 rescan 复活」,文字仍是「恢复」(特例 2/3,只有 title 特殊,按钮文字走 else 分支)', async () => {
    const w = await mountWithFiles([FILE_TOMBSTONED])
    const btn = w.find('.k-rebuild-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('已删除，需 rescan 复活')
    expect(btn.text()).toContain('恢复')
  })
})

// ──────────────────────────────────────────────────────────────────────
// 展开按钮 + 行内详情面板
// ──────────────────────────────────────────────────────────────────────
describe('IndexedFilesView — 展开按钮(data-open,K13 expSet)+ 行内详情面板', () => {
  it('默认收起:data-open="false",详情面板不渲染', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-expand').attributes('data-open')).toBe('false')
    expect(w.find('.k-file-detail').exists()).toBe(false)
  })

  it('点击展开:data-open="true",详情面板渲染;再点一次收起(两侧对照)', async () => {
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

  it('展开按钮 title = aiKbMore(「浏览更多」)', async () => {
    const w = await mountWithFiles([FILE_OK])
    expect(w.find('.k-frow-expand').attributes('title')).toBe('浏览更多')
  })

  // 修复轮 1,I-2/M-3:定位到具体字段格再比值,不靠"存在即真"的选择器
  // (`.k-fd-v.mono[title]` 会连 `.k-fd-sha` 一起命中,详见 I-2 说明)。
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
// 分页 —— currentPage/pageCount/pageFrom/pageTo 四个计算的边界
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
// 多选复选框(read+write,本刀范围;selectedCount/动作条/确认弹窗是 T10)
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
// RED 探针②的钉子(pageTo 的 Math.min)与探针③(data-zero)已挂在上面对应
// describe 里(见注释标注),此处不重复。
// ──────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════
// SP8-P5b Task 10 —— 第 3 刀(收官):重建三入口 + 双上限 + K7 确认弹窗 +
// 底部动作条 + 轮询收口。以下全部是本刀新增。
//
// mock 形状来源(治理 §4,禁手编,逐个说明):
//   ai.parserReindexFiles 成功 → `REINDEX_OK`,逐字取自
//     `p5b-fixtures/reindex-one.http` 的 200 响应体
//     (`{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`,snake_case,
//      §4.1 该端点包内零转换)。
//   ai.parserReindexFiles 400(file_ids 超限)→ `CAP_400_FILE_IDS`,逐字取自
//     `p5b-fixtures/reindex-cap-400.http`(`{"detail":"too many file_ids (max 500)"}`,
//      **已实测**)。⚠️ 后端把「空数组」与「>500」用了同一条消息(§4.4)。
//   ai.parserReindexFiles 400(filter 超限)→ `CAP_400_FILTER`,形状取自
//     fixture README「未实测 · 源码推定的形状」那一节
//     (`{"detail":"filter matches {n} files (> 10000); narrow it or raise
//      max_reindex_by_filter"}`,`service_reindex.py:53-58`)。
//     🔴 本机只有 8 个文件,10000 上限触发不了,这一条**是源码推定、未实测**,
//     按 README 记的形状用(报告里已注明)。
//   CAP_ROW_TEMPLATE / capIds() —— 500/501 条选中的边界要 501 个不同的
//     file_id。行形状仍是 `files-all-8.json` 的 ok 行(直接 spread FILE_OK
//     只换 file_id),不是新编的 schema。
//
// 501 行边界的驱动方式:`overExplicitCap` 只读 `selSet.size`(蓝本 :484-485),
// 与「这些 id 是否在当前页」无关,所以边界用例直接写内部 `selSet`(T8/T9 已确立
// 的 `w.vm` 读写 `<script setup>` 顶层 ref 技巧),不去挂载 501 个真实行 ——
// 断言仍然落在真实 DOM(动作条的 `data-active` / `.k-ab-warn` / 按钮 `disabled`)
// 上,不是读组件内部状态自证。
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
