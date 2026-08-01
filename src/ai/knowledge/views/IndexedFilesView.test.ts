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
const ai = vi.hoisted(() => ({ parserFiles: vi.fn() }))
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

function setupServiceMocks(): void {
  ai.parserFiles.mockResolvedValue({ total: FILES_ALL_8.length, limit: 100, offset: 0, files: FILES_ALL_8 })
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
    expect(w.find('.k-ftable').exists()).toBe(false)
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
