// SP8-P5f Task 6 —— `WikiView.vue`(**上半**)的组件测试。
// 蓝本 `NimoOS-UI` @ `7a6ee6b7` `src/views/AI/Knowledge/WikiView.vue`(314 行)。
// 🔴 T7 会**续写本文件**(摘要 / 目录 / 最近变更 / 源码切换 / 重扫 / §9.15 的 XSS 用例)。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 **mock 共享包的 `service.wiki.*` 四个方法,走真 `knowledgeStore`**,不 mock store。
//   理由同 `RootsView.test.ts` / `AllowlistView.test.ts`,而本页还多一条**决定性的**:
//   🔴 **N48 的「404 → null、其余上抛」分层就在 store 里**(`knowledgeStore.ts:715` / `:725`)——
//   mock 掉 store 的话,那一层分层等于被测试自己重写了一份影子实现,
//   「404 走业务态、500 走 catch」这两条就退化成「我说它回 null 它就回 null」。
// 🔴 形状(§4.1 的表 + `p5f-fixtures/README.md` §3):
//   · `service.wiki.getRoots` → **共享包已归一化**(`NimoOS-Service/src/wiki.ts:85`
//     `normalizeRoot`)⇒ 🔴 **camelCase**,**不是** HTTP 原文的 PascalCase(N46)。
//   · `service.wiki.getTree`  → **扁平数组**,已归一化成 camelCase
//     (`wiki.ts:102 normalizeTreeNode`:`aiLabel` / `lastModified` / `userNotesUpdatedAt`)。
//     🔴 抄进来的 fixture 是 **snake_case 的 HTTP 原文**,本文件用 `toStoreShape()`
//     显式过一遍归一化 —— 这一步是**刻意保留**的:直接抄 camelCase 会让「fixture 记录的
//     是后端真形状」这件事丢失(同 `wikiViewHelpers.test.ts` 的既定做法)。
//   · `service.wiki.getNode` → camelCase `WikiNode`(`wiki.ts:112 normalizeNode`)。
//   · `service.wiki.getRaw`  → `string`。
//   404 一律由 mock **reject 一个带 `response.status = 404` 的错误**,让 store 那层真的去转 `null`。
//
// ═══ fixture 是抄本,不是运行时读(治理 §4 / P5c §4.4) ═══
// 数据逐字抄进下面 `FIXTURE-COPY-BEGIN/END` 块并注明**三级出处标签**(裁定 R3 约束 1),
// **不用 `node:fs` 读 `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次)。
// 🔴 **只取数据字段,`__meta` 转成注释**(裁定 R14 / `p5f-fixtures/README.md` §0.2)。
// 🔴 Wiki 侧样本**全部是 `.CONSTRUCTED`**,🔴 **不是真机数据**(D1:`/v1/wiki/{roots,tree,node}`
//   本机 90 秒 0 字节超时)—— 也不许拿它去推翻 N46 的命名结论(治理 §9.18-2)。
// 抄本等价性由**程序化逐字节校验**确认(见「fixture 抄本自检」一组),不是肉眼比。
// 读 `.vue` 源文件一律 `node:fs`,**不许用 Vite 的 `?raw`**(vitest 下恒空 → 假通过)。
//
// ═══ 环境坑(逐字沿用 `wikiViewHelpers.test.ts` 的既定解法)═══
// 本仓 `package.json` 是 `"type": "module"` ⇒ `__dirname` 不可用,改 `import.meta.url`;
// 未装 `@types/node` ⇒ `node:fs` / `node:path` / `node:url` 逐行 `@ts-expect-error`。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { WikiNode, WikiRoot, WikiTreeNode } from '@nimotech/nimoos-service'
// i18n 由 `vitest.setup.ts` 全局装好,本文件不再自己装 —— 也**不许**另建 `createI18n`
// (与 setup 的单例重复安装,记忆 `vitest-reporter-hides-warnings`)。
import { useKnowledgeStore } from '../stores/knowledgeStore'
import WikiView from './WikiView.vue'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC: string = readFileSync(resolve(__dirname, './WikiView.vue'), 'utf8')

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const wiki = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getTree: vi.fn(),
  getNode: vi.fn(),
  getRaw: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { wiki } }
})

// `openDirInNewTab` 是 P5a-T5 的既有产出(全期零改动清单),这里只 spy「有没有以正确
// 入参被调到」,不测它自己的行为(先例 `NotesView.test.ts:68`)。
const openDirInNewTab = vi.hoisted(() => vi.fn())
vi.mock('../../services/openInApp', () => ({
  openDirInNewTab: (...args: unknown[]) => openDirInNewTab(...args),
}))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-tree.CONSTRUCTED.json  (只取 `normal` / `crossLevel` 两组)
// 三级出处标签:**`.CONSTRUCTED`** —— 🔴 **不是真机数据**。`__meta` 转成本注释(裁定 R14),
// 原文要点:
//   · label      : .CONSTRUCTED
//   · why        : GET /v1/wiki/tree 本机实测 90 秒超时、0 字节(D1)⇒ 无真机样本。
//   · built_from : NimoOS-Wiki/route/v1/wiki.go:126-132 的匿名 struct `sk`
//                  (**snake_case json tag**):path / level / ai_label /
//                  user_notes_updated_at / last_modified
//   · value_units: ai_label 空串合法;last_modified 是 RFC3339 本地时区字符串,
//                  后端 formatTS(ms<=0) 返回**空串**(wiki.go:47-52)—— 不是 '1970'
//   · normalized_shape: 经 NimoOS-Service/src/wiki.ts:102 normalizeTreeNode → camelCase
// 🔴 本机 D1:`/v1/wiki/tree` 90 s 零字节超时 ⇒ §9.17 判定「整棵左树恒走 `treeError` 分支」,
//   本机只能验「加载失败 + 重试」。**这不是缺陷,是 D1。**
const TREE_RAW_NORMAL = [
  { "path": "/DATA",           "level": "space",   "ai_label": "主数据盘",   "user_notes_updated_at": "", "last_modified": "2026-08-05T11:32:01+08:00" },
  { "path": "/DATA/Documents", "level": "project", "ai_label": "文档",       "user_notes_updated_at": "", "last_modified": "2026-08-05T10:12:00+08:00" },
  { "path": "/DATA/Documents/Specs", "level": "project", "ai_label": "", "user_notes_updated_at": "", "last_modified": "" }
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json  (只取 `wikiRoots` 数组)
// 三级出处标签:**`.CONSTRUCTED`**。`__meta` 转成本注释(裁定 R14):
//   · why        : 同 wiki-roots.CONSTRUCTED.json —— /roots 本机超时,无真机样本。
//   · built_from : 把 wiki-roots.CONSTRUCTED.json 的 raw_response 逐字段过
//                  NimoOS-Service/src/wiki.ts:85 normalizeRoot。
//   · shape      : 🔴 camelCase —— 这就是 store.state.wikiRoots 的出口形状(N46)。
//   · note       : enabled 经 `!!r.Enabled` 归一成 boolean;
//                  scanIntervalS/createdAt/lastScanAt 经 `|| 0` 兜底。
const ROOTS_NORMALIZED: WikiRoot[] = [
  {
    "id": "dfcd1840f5dab439cd9d7050aa5bafd0",
    "path": "/DATA",
    "level": "space",
    "watchMode": "auto",
    "storageMode": "inline",
    "enabled": true,
    "scanIntervalS": 21600,
    "createdAt": 1754280000000,
    "lastScanAt": 1754386321000,
    "needsReconcile": false
  },
  {
    "id": "9b1c77e0aa2f4d3e8c5106b4f7d2a318",
    "path": "/DATA/Documents",
    "level": "project",
    "watchMode": "scan_only",
    "storageMode": "inline",
    "enabled": false,
    "scanIntervalS": 3600,
    "createdAt": 1754281000000,
    "lastScanAt": 0,
    "needsReconcile": false
  }
]
// FIXTURE-COPY-END

/**
 * 共享包 `wiki.ts:102 normalizeTreeNode` 的等价物 —— 把 HTTP 原文 snake_case 过成
 * store 出口的 camelCase。🔴 **本文件不许把 fixture 直接抄成 camelCase**:
 * fixture 记录的是**后端真形状**,归一化这一步必须留在视线里(N46 是本期最容易搞错的一点)。
 */
function toStoreShape(n: Record<string, string>): WikiTreeNode {
  return {
    path: n.path,
    level: n.level || '',
    aiLabel: n.ai_label || '',
    userNotesUpdatedAt: n.user_notes_updated_at || '',
    lastModified: n.last_modified || '',
  }
}
const TREE_NORMAL: WikiTreeNode[] = TREE_RAW_NORMAL.map(toStoreShape)

/** `/wiki/node` 的最小归一化形状(T6 不渲染它,只需要一个非 null 的合法值)。 */
function nodeFor(path: string): WikiNode {
  return {
    path,
    level: 'space',
    aiLabel: '',
    summary: null,
    childMap: [],
    recentChanges: [],
    userNotes: '',
    parentWiki: '',
    subwikis: [],
    etag: '',
  }
}

/** 造一个带 HTTP 状态码的 axios 风格错误(store 的 `isNotFound` 读的就是 `e.response.status`)。 */
function httpError(status: number, message = 'boom'): Error & { response: { status: number } } {
  const e = new Error(message) as Error & { response: { status: number } }
  e.response = { status }
  return e
}

/** 可控 promise —— 交错 / 门控判别用。 */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []
const flush = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/knowledge/wiki', name: 'KnowledgeWiki', component: WikiView },
      // 「管理知识根」按钮 push 的目标 —— 不注册这条,vue-router 会打 "No match found" 告警。
      { path: '/ai/knowledge/roots', name: 'KnowledgeRoots', component: { template: '<div/>' } },
    ],
  })
}

interface MountOpts {
  query?: Record<string, string>
  /** 预置进 store 的 `wikiRoots`(测 `created` 的 `if (!wikiRoots.length)` 那一侧)。 */
  seedRoots?: WikiRoot[]
}

/** 挂载。组件 `onMounted` 自己发 `loadRoots()` + `loadTree()`(蓝本 `created()`),
 *  所以这里不预热 —— 让那两发真的跑,顺带守住「挂载即拉」。 */
async function mountPage(opts: MountOpts = {}) {
  const router = makeRouter()
  await router.push({ path: '/ai/knowledge/wiki', query: opts.query ?? {} })
  await router.isReady()
  // 🔴 spy 必须在 mount 之前装:`select()` 拿到的 `router` 就是这个实例,
  //   spyOn 换掉的是实例上的方法 ⇒ 组件那一发也走 spy(默认 callThrough)。
  const replaceSpy = vi.spyOn(router, 'replace')
  const store = useKnowledgeStore()
  if (opts.seedRoots) store.wikiRoots = opts.seedRoots
  // 🔴 **不传 `plugins: [i18n]`** —— `vitest.setup.ts` 已把**同一个** i18n 单例装进
  //   `config.global.plugins`,再传一次会打 `Plugin has already been applied` 告警。
  const w = mount(WikiView, { global: { plugins: [router] } })
  mountedWrappers.push(w)
  await flush()
  return { w, router, store, replaceSpy }
}

/** VTU 的 `.text()` 只 trim 不折叠内部空白;跨行拼接的文案统一归一后再比。 */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

const treeRows = (w: ReturnType<typeof mount>) => w.findAll('.kw-tree-scroll .kw-node')
const rowPaths = (w: ReturnType<typeof mount>) => treeRows(w).map((r) => r.find('.kw-node-name').text())

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
  wiki.getRoots.mockResolvedValue(ROOTS_NORMALIZED.map((r) => ({ ...r })))
  wiki.getTree.mockResolvedValue(TREE_NORMAL.map((n) => ({ ...n })))
  wiki.getNode.mockImplementation((p: string) => Promise.resolve(nodeFor(p)))
  wiki.getRaw.mockImplementation((p: string) => Promise.resolve('# ' + p))
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 fixture 抄本等价性 —— 治理 §4「抄进测试 + 程序化逐字节校验」。
// 比的是**形状与值**(不是把 JSON 再读一遍):三级标签、字段名风格、类型全部钉死。
// 判据:任何一处字段名被写成 camelCase(树侧)/ PascalCase(根侧)→ 本组立刻报红。
describe('WikiView —— fixture 抄本自检(N46:HTTP 原文 snake_case → store 出口 camelCase)', () => {
  it('🔴 抄本里一个 __meta 都没有(裁定 R14:只取数据字段,出处转注释)', () => {
    for (const n of TREE_RAW_NORMAL) expect(Object.keys(n)).not.toContain('__meta')
    for (const r of ROOTS_NORMALIZED) expect(Object.keys(r)).not.toContain('__meta')
    expect(TREE_RAW_NORMAL.length, '抄本为空 —— 防空转').toBe(3)
    expect(ROOTS_NORMALIZED.length, '抄本为空 —— 防空转').toBe(2)
  })

  it('🔴 树抄本是 HTTP 原文 snake_case(`ai_label` / `last_modified`),不是 camelCase', () => {
    for (const n of TREE_RAW_NORMAL) {
      expect(Object.keys(n).sort()).toEqual([
        'ai_label',
        'last_modified',
        'level',
        'path',
        'user_notes_updated_at',
      ])
      expect(Object.keys(n)).not.toContain('aiLabel')
      expect(Object.keys(n)).not.toContain('lastModified')
    }
  })

  it('🔴 根抄本是 store 出口 camelCase(不是 HTTP 原文的 PascalCase)', () => {
    for (const r of ROOTS_NORMALIZED) {
      expect(Object.keys(r)).toContain('watchMode')
      expect(Object.keys(r)).toContain('scanIntervalS')
      expect(Object.keys(r)).not.toContain('WatchMode')
      expect(Object.keys(r)).not.toContain('ScanIntervalS')
      expect(typeof r.enabled, 'enabled 必须已归一成 boolean').toBe('boolean')
    }
  })

  it('toStoreShape 与共享包 normalizeTreeNode 同解(空值一律兜底成空串)', () => {
    expect(TREE_NORMAL[0]).toEqual({
      path: '/DATA',
      level: 'space',
      aiLabel: '主数据盘',
      userNotesUpdatedAt: '',
      lastModified: '2026-08-05T11:32:01+08:00',
    })
    // 第三条 last_modified 是空串(后端 formatTS(ms<=0) 的真形态)—— updatedFmt 兜底用它。
    expect(TREE_NORMAL[2].lastModified).toBe('')
    expect(TREE_NORMAL[2].aiLabel).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 左树四态(计划书 T6-3)+ 治理 §5.2 的「loadTree 不加过期守卫」论证守卫。
describe('WikiView —— 左树四态(蓝本 :6-31)', () => {
  it('treeLoading → 6 个 k-skel(蓝本 :6-8,`v-for="i in 6"`)', async () => {
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    const { w } = await mountPage()
    expect(w.findAll('.kw-tree-scroll .k-skel')).toHaveLength(6)
    expect(w.find('.kw-tree-note').exists(), 'loading 期间不该出现任何 tree-note').toBe(false)
    expect(treeRows(w)).toHaveLength(0)
    d.resolve([])
    await flush()
  })

  it('treeError → kw-tree-note + 重试按钮,点它真的重发一次(蓝本 :9-14)', async () => {
    wiki.getTree.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountPage()
    const note = w.find('.kw-tree-note')
    expect(note.exists()).toBe(true)
    expect(norm(note.text())).toContain('加载 Wiki 树失败')
    const retry = note.find('button.k-btn.outline')
    expect(retry.exists(), '重试按钮没渲染').toBe(true)
    expect(norm(retry.text())).toBe('重试')
    expect(wiki.getTree).toHaveBeenCalledTimes(1)
    await retry.trigger('click')
    await flush()
    expect(wiki.getTree, '重试按钮没重发 loadTree').toHaveBeenCalledTimes(2)
    // 第二发成功 ⇒ 回到有树态
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
  })

  it('🔴 treeLoading 期间「重试」按钮整块不渲染(治理 §5.2:loadTree 不加过期守卫的依据)', async () => {
    // 【为什么这条是「不加过期守卫」的守卫】重试按钮是 `loadTree` 除 onMounted 之外的
    // 唯一触发点。第一发一开始就把 treeLoading 置 true,而按钮所在的 `v-else-if="treeError"`
    // 分支排在 `v-if="treeLoading"` 之后 ⇒ 请求在飞时按钮**不存在** ⇒ 无法并发两发
    // ⇒ 不存在「先发后至覆盖后发」的场景。谁把三态排布改成「重试按钮常驻」,本条先报红。
    wiki.getTree.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountPage()
    const retry = w.find('.kw-tree-note button.k-btn.outline')
    expect(retry.exists()).toBe(true)
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    await retry.trigger('click')
    await nextTick()
    expect(wiki.getTree).toHaveBeenCalledTimes(2)
    expect(w.find('.kw-tree-note').exists(), '第二发在飞时 tree-note 仍在 —— 按钮可被点第二次').toBe(false)
    expect(
      w.find('.kw-tree-note button').exists(),
      '🔴 loading 期间重试按钮仍可点 ⇒ loadTree 必须补过期守卫',
    ).toBe(false)
    expect(w.findAll('.kw-tree-scroll .k-skel')).toHaveLength(6)
    d.resolve([])
    await flush()
  })

  it('空树 → 左栏「尚未生成」提示 + 右栏 onboarding(蓝本 :15-17 / :39-46)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w } = await mountPage()
    expect(norm(w.find('.kw-tree-note').text())).toBe('还没有生成任何 wiki')
    expect(w.find('.kw-tree-note button').exists(), '空树态不该有重试按钮').toBe(false)
    const pending = w.find('.kw-pending')
    expect(pending.exists()).toBe(true)
    expect(norm(pending.find('.kw-pending-title').text())).toBe('还没有生成任何 wiki')
    expect(norm(pending.find('.kw-pending-sub').text())).toBe(
      '添加知识根后,Wiki 导航会自动从你的目录生成。',
    )
    expect(norm(pending.find('button.k-btn.primary').text())).toBe('管理知识根')
  })

  it('空树 onboarding 的「管理知识根」按钮 push 到 /ai/knowledge/roots(蓝本 :43)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w, router } = await mountPage()
    await w.find('.kw-pending button.k-btn.primary').trigger('click')
    await flush()
    expect(router.currentRoute.value.path).toBe('/ai/knowledge/roots')
  })

  it('有树 → kw-node 列表(蓝本 :18-31),且 onboarding 那屏不出现', async () => {
    const { w } = await mountPage()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
    expect(w.find('.kw-pending').exists(), '有树时不该出现 onboarding').toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 visibleNodes / isOpen / toggle / nodeClick(计划书 T6-4)
describe('WikiView —— 树的展开折叠与缩进(蓝本 :178-186 / :239-248)', () => {
  it('顶层根挂载即展开,深层节点默认折叠(蓝本 :228 `openPaths = roots.map(...)`)', async () => {
    const { w } = await mountPage()
    // /DATA 展开 ⇒ 看得到 Documents;Documents 折叠 ⇒ 看不到 Specs。
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
    expect(treeRows(w)[0].find('.kw-node-chev').attributes('data-open')).toBe('true')
    expect(treeRows(w)[1].find('.kw-node-chev').attributes('data-open')).toBe('false')
  })

  it('🔴 缩进逐字照抄 `paddingLeft: (8 + depth * 14) + "px"`(蓝本 :22)', async () => {
    const { w } = await mountPage()
    expect(treeRows(w)[0].attributes('style')).toContain('padding-left: 8px')
    expect(treeRows(w)[1].attributes('style')).toContain('padding-left: 22px')
    // 展开第二层后第三层是 8 + 2*14 = 36px。
    await treeRows(w)[1].find('.kw-node-chev').trigger('click')
    await flush()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
    expect(treeRows(w)[2].attributes('style')).toContain('padding-left: 36px')
  })

  it('toggle 是纯翻转:再点一次收起(蓝本 :240-244)', async () => {
    const { w } = await mountPage()
    const chev = () => treeRows(w)[1].find('.kw-node-chev')
    await chev().trigger('click')
    await flush()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
    await chev().trigger('click')
    await flush()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
  })

  it('🔴 chevron 的 @click.stop:点它只折叠/展开,**不**触发整行选中(蓝本 :26)', async () => {
    const { w } = await mountPage()
    // 初始选中是 roots[0] = /DATA。
    expect(treeRows(w)[0].attributes('data-active')).toBe('true')
    expect(treeRows(w)[1].attributes('data-active')).toBe('false')
    const nodeCallsBefore = wiki.getNode.mock.calls.length
    await treeRows(w)[1].find('.kw-node-chev').trigger('click')
    await flush()
    // 展开生效,但选中没变、也没有为 Documents 发新的取文章请求。
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
    expect(treeRows(w)[0].attributes('data-active'), '点 chevron 把选中挪走了 —— @click.stop 丢了').toBe('true')
    expect(treeRows(w)[1].attributes('data-active')).toBe('false')
    expect(wiki.getNode.mock.calls.length, '点 chevron 触发了 fetchArticle —— @click.stop 丢了').toBe(
      nodeCallsBefore,
    )
  })

  it('无子节点的行渲染一个空 chevron 占位(蓝本 :27),有子节点的才带 data-open', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].find('.kw-node-chev').trigger('click')
    await flush()
    const specChev = treeRows(w)[2].find('.kw-node-chev')
    expect(specChev.exists()).toBe(true)
    expect(specChev.attributes('data-open'), 'Specs 无子节点 ⇒ 不带 data-open').toBeUndefined()
    expect(specChev.element.children.length, '空占位里不该有图标').toBe(0)
  })

  it('顶层根用 drive 图标、子节点用 folder 图标(蓝本 :28 的 `depth === 0 ? …`)', async () => {
    const { w } = await mountPage()
    const icoTitles = treeRows(w).map((r) => r.find('.kw-node-ico svg').attributes('data-glyph'))
    // KIcon 没有 data-glyph 时退化成 undefined —— 用 path 数据比更稳:只断两行的图标不同。
    const html0 = treeRows(w)[0].find('.kw-node-ico').html()
    const html1 = treeRows(w)[1].find('.kw-node-ico').html()
    expect(icoTitles.length).toBe(2)
    expect(html0, '顶层根与子节点用了同一个图标 —— `depth === 0` 三元丢了').not.toBe(html1)
  })

  it('🔴 nodeClick 点整行:选中 + 展开(蓝本 :245-248)', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(treeRows(w)[1].attributes('data-active')).toBe('true')
    expect(treeRows(w)[0].attributes('data-active')).toBe('false')
    // 展开:Specs 出现。⚠️ 这一半的实际提供者是 `select()` 的祖先循环
    // (蓝本 :247 那行是不可达分支,见 WikiView.vue 里 nodeClick 的申报注释)。
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K56 —— 面包屑的 `:key` 挪到 `<template v-for>` 自身(Vue 3 编译器要求),
//    渲染出的 DOM 序列必须与蓝本 :50-53 逐个一致。
describe('WikiView —— K56 面包屑 DOM 序列(蓝本 :48-55)', () => {
  it('🔴 button / span("/") 交替,末尾是 span.cur', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const crumb = w.find('.kw-crumb')
    expect(crumb.exists()).toBe(true)
    const kids = Array.from(crumb.element.children)
    expect(kids.length, '面包屑子元素数不对 —— 防空转').toBe(5)
    expect(kids.map((el) => el.tagName)).toEqual(['BUTTON', 'SPAN', 'BUTTON', 'SPAN', 'SPAN'])
    expect(kids.map((el) => norm(el.textContent || ''))).toEqual([
      '/DATA', // 顶层根显示全路径(buildWikiTree 的 `t.name = n.path`)
      '/',
      'Documents',
      '/',
      'Specs',
    ])
    expect(kids[1].className).toBe('')
    expect(kids[3].className).toBe('')
    expect(kids[4].className, '末尾必须是 .cur').toBe('cur')
  })

  it('面包屑只列**祖先**,当前节点不出现在按钮里(蓝本 :188 的 `slice(0, -1)`)', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const btns = w.findAll('.kw-crumb button')
    expect(btns.map((b) => norm(b.text()))).toEqual(['/DATA', 'Documents'])
  })

  it('点面包屑按钮回跳到那一级(蓝本 :51)', async () => {
    const { w, router } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    await w.findAll('.kw-crumb button')[1].trigger('click')
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
  })

  it('选中顶层根时面包屑只有 .cur 一项(crumbParents 为空)', async () => {
    const { w } = await mountPage()
    const kids = Array.from(w.find('.kw-crumb').element.children)
    expect(kids.length).toBe(1)
    expect(kids[0].className).toBe('cur')
    expect(norm(kids[0].textContent || '')).toBe('/DATA')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 select() 的三件事(计划书 T6-5)
describe('WikiView —— select() 三件事(蓝本 :249-260)', () => {
  it('🔴 ② 展开**每一个**祖先(判据:去掉 trailFor 循环 → 本条必须报红)', async () => {
    // 深链直达三层节点:loadTree 只把顶层根放进 openPaths,中间那层
    // `/DATA/Documents` 全靠 select() 的祖先循环展开。少了循环 ⇒ Specs 那行在树里看不见。
    const { w } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    expect(rowPaths(w), '祖先没被展开 ⇒ 选中的节点在树里根本看不见').toEqual([
      '/DATA',
      'Documents',
      'Specs',
    ])
    expect(treeRows(w)[2].attributes('data-active')).toBe('true')
  })

  it('🔴 ③ 写 `?path=`(router.replace,值与初始值不同 —— §9.14-3 防零判别力)', async () => {
    // 初始:无 query ⇒ loadTree 选 roots[0] 并 replace 成 ?path=/DATA。
    const { w, router, replaceSpy } = await mountPage()
    expect(router.currentRoute.value.query.path).toBe('/DATA')
    replaceSpy.mockClear()
    // 🔴 回写值必须**与当前值不同**,否则 Vue watch 的 Object.is 前置去重让回调压根不执行。
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(replaceSpy, 'select() 没写 query').toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
    expect(router.currentRoute.value.query.path).not.toBe('/DATA')
  })

  it('🔴 `fromRoute: true` 时**不**写 query(防 watch → replace → watch 回环)', async () => {
    // 深链命中 ⇒ loadTree 里 `fromRoute: q === initial` 为 true ⇒ 一发 replace 都不该有。
    const { router, replaceSpy } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(replaceSpy, 'fromRoute 那一支仍写了 query —— 会和 watch 互弹').not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
  })

  it('`?path=` 未命中时初始选 roots[0],并把 query 改写成它(fromRoute 为 false 那一支)', async () => {
    const { router, replaceSpy } = await mountPage({ query: { path: '/not/in/tree' } })
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.path).toBe('/DATA')
  })

  it('select() 对 byPath 里没有的路径直接早退(蓝本 :250)', async () => {
    const { w, store } = await mountPage()
    const before = wiki.getNode.mock.calls.length
    const toast = vi.spyOn(store, 'toast')
    // 只能从「query 变成树外路径」这条路走到 select 的调用点之前;这里直接验
    // 「树外 query 不改变任何东西」——两层守卫(watch 的 byPath 条件 + select 的早退)同解。
    await w.vm.$router.replace({ query: { path: '/nope/nope' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), '选中被树外路径改掉了').toBe('/DATA')
    expect(wiki.getNode.mock.calls.length).toBe(before)
    expect(toast).not.toHaveBeenCalled()
  })

  it('🔴 N57 —— `router.replace` reject 被 `.catch(() => {})` 吞掉,后续照常取文章', async () => {
    const { w, replaceSpy } = await mountPage()
    replaceSpy.mockClear() // 挂载时那一发(初始选中写 ?path=/DATA)不算
    replaceSpy.mockImplementation(() => Promise.reject(new Error('NavigationDuplicated')))
    const before = wiki.getNode.mock.calls.length
    await treeRows(w)[1].trigger('click')
    await flush()
    // 没有抛出(用例走到这里就说明没炸),且 fetchArticle 照常发了。
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(wiki.getNode.mock.calls.length).toBe(before + 1)
    expect(treeRows(w)[1].attributes('data-active')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N56 —— 深链的两半(计划书 T6-6)。**不许统一成 `immediate: true`**。
describe('WikiView —— N56 深链第一半:loadTree 里读一次 route.query.path(蓝本 :230-232)', () => {
  it('query 命中 → 选它(不是 roots[0])', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
    expect(norm(w.find('.kw-title').text())).toBe('TREEDocuments')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA/Documents')
  })

  it('query 未命中 → 退回 roots[0]', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Nope' } })
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA')
  })

  it('无 query 且无 roots → initial 为 "",什么都不选(右栏走 onboarding)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w } = await mountPage()
    expect(w.find('.kw-crumb').exists(), 'sel 为空时不该渲染面包屑').toBe(false)
    expect(w.find('.kw-pending').exists()).toBe(true)
    expect(wiki.getNode, '没有选中却发了取文章请求').not.toHaveBeenCalled()
  })
})

describe('WikiView —— N56 深链第二半:watch 无 immediate(蓝本 :210-214)', () => {
  it('🔴 挂载后改地址栏 query → 真的切换(判据:删掉 watch → 本条必须报红)', async () => {
    // 记忆 `newui-router-query-only-no-remount`:只在 onMounted 里读一次 query 的写法,
    // 用户改地址栏一行都不跑。这里走的是**挂载之后**的一次 query 变更。
    const { w, router } = await mountPage()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    await router.replace({ query: { path: '/DATA/Documents/Specs' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), 'watch 没接住 query 变更').toBe('Specs')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA/Documents/Specs')
    // 祖先也被展开(select 的第 ② 件事在 watch 这条路径上同样生效)。
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
  })

  it('🔴 `v !== sel` 那一条:select() 自己写回的 query 不会再触发一次取文章(防回环)', async () => {
    // 🔴 §9.14-3 —— 这才是「相同值不重复」**有判别力**的形态:
    //   点树行 → select() 设 sel 并 router.replace 写 query → watch 被这次写触发,
    //   此时 `v === sel` ⇒ 守卫拦住,不再 select 第二次。
    //   判据:去掉 `v !== sel.value` → fetchArticle 会被再发一次(getNode 多一发)。
    //   ⚠️ 反面写法(「把 query 设成和现在一样的值」)零判别力:Vue watch 的 Object.is
    //   前置去重让回调**压根不执行**,产品码有没有守卫都一样绿。
    const { w } = await mountPage()
    wiki.getNode.mockClear()
    wiki.getRaw.mockClear()
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(wiki.getNode.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA/Documents'])
    expect(wiki.getRaw.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA/Documents'])
  })

  it('`byPath[v]` 那一条:query 指向树外路径时一动不动', async () => {
    // ⚠️ 申报:watch 的 `byPath[v]` 与 `select()` 自己的 `if (!byPath[path]) return` 是
    //   两层同解的防御 —— 单独去掉 watch 那一层不会改变可观测行为。本条钉的是
    //   **合起来的可观测行为**(树外 query 不改选中、不发请求),两层都被破才会红。
    const { w, router } = await mountPage()
    wiki.getNode.mockClear()
    await router.replace({ query: { path: '/DATA/Documents/Nope' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    expect(wiki.getNode).not.toHaveBeenCalled()
  })

  it('watch **不是** immediate —— 挂载那一刻 byPath 还没建好,靠的是 loadTree 那一半', async () => {
    // 判别形态:getTree 迟迟不回包时,query 里已经有一个合法路径,但树还没建
    //   ⇒ 若 watch 是 immediate,它会在 byPath 为空时白跑一次(静默什么都不做),
    //     真正生效的仍然只有 loadTree 那一半 —— 本条钉住「回包之前不选中、回包之后才选中」。
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(w.find('.kw-crumb').exists(), '树还没回包就选中了').toBe(false)
    expect(wiki.getNode).not.toHaveBeenCalled()
    d.resolve(TREE_NORMAL.map((n) => ({ ...n })))
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 N55 —— fetchArticle 的三处过期守卫(计划书 T6-7)。**四条各自独立报红。**
//    治理 §9.1:两件事都要守 —— ① 逻辑(交错);② **变量作用域**(两实例)。
describe('WikiView —— N55 fetchArticle 过期守卫(蓝本 :261-281)', () => {
  /** 按路径分发的可控 promise —— 交错用。 */
  function deferredByPath<T>() {
    const map = new Map<string, ReturnType<typeof makeDeferred<T>>>()
    const get = (p: string) => {
      if (!map.has(p)) map.set(p, makeDeferred<T>())
      return map.get(p)!
    }
    return { get, impl: (p: string) => get(p).promise }
  }

  it('🔴 ① 逻辑交错:A → B,B 先回、A 后回 ⇒ 最终状态是 B 的(蓝本 :270)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w } = await mountPage() // 初始选 /DATA(A),两发都挂起
    await treeRows(w)[1].trigger('click') // 选 /DATA/Documents(B)
    await flush()
    // B 先回
    nodes.get('/DATA/Documents').resolve({ ...nodeFor('/DATA/Documents'), aiLabel: 'B' })
    raws.get('/DATA/Documents').resolve('# B')
    await flush()
    // A 后回 —— 迟到的成功响应必须被守卫丢弃
    nodes.get('/DATA').resolve({ ...nodeFor('/DATA'), aiLabel: 'A' })
    raws.get('/DATA').resolve('# A')
    await flush()
    // `node` / `raw` 在 T6 的模板里还没有渲染面(归 T7)⇒ 直接读 setup 绑定。
    const vm = w.vm as unknown as { node: WikiNode | null; raw: string | null; sel: string }
    expect(vm.sel).toBe('/DATA/Documents')
    expect(vm.raw, '迟到的 A 覆盖了 B 的原文 —— try 里的过期守卫丢了').toBe('# B')
    expect(vm.node?.aiLabel, '迟到的 A 覆盖了 B 的节点').toBe('B')
  })

  it('🔴 ② 两实例交错守**作用域**(判据:把 `sel` 挪到模块级 → 本条必须报红)', async () => {
    // 模块级 `sel` 会让 inst1 的响应去比 inst2 的选中 ⇒ inst1 的 finally 守卫判假
    // ⇒ inst1 的骨架**永远关不掉**。
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const inst1 = await mountPage() // 选 /DATA
    const inst2 = await mountPage({ query: { path: '/DATA/Documents' } }) // 选 /DATA/Documents
    expect(inst1.w.find('.kw-crumb .cur').text()).toBe('/DATA')
    expect(inst2.w.find('.kw-crumb .cur').text()).toBe('Documents')
    // 只回 inst1 那条路径的响应
    nodes.get('/DATA').resolve(nodeFor('/DATA'))
    raws.get('/DATA').resolve('# A')
    await flush()
    const skels = inst1.w.findAll('.kw-article-inner .k-skel')
    expect(
      skels.length,
      '🔴 inst1 的文章骨架没关掉 —— `sel` 变成模块级了(被 inst2 的选中污染)',
    ).toBe(0)
    // inst2 的还挂着(它的响应没回),证明两个实例真的各算各的。
    expect(inst2.w.findAll('.kw-article-inner .k-skel').length).toBe(4)
  })

  it('🔴 ③ catch 分支也有守卫:迟到的**失败**不弹 toast、不清空(蓝本 :274)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await treeRows(w)[1].trigger('click') // 切到 B
    await flush()
    // B 成功
    nodes.get('/DATA/Documents').resolve({ ...nodeFor('/DATA/Documents'), aiLabel: 'B' })
    raws.get('/DATA/Documents').resolve('# B')
    await flush()
    // A(已过期)失败
    nodes.get('/DATA').reject(httpError(500, 'stale-failure'))
    raws.get('/DATA').resolve('# A')
    await flush()
    expect(toast, '迟到的失败弹了 toast —— catch 里的过期守卫丢了').not.toHaveBeenCalled()
    const vm = w.vm as unknown as { node: WikiNode | null; raw: string | null }
    expect(vm.raw, '迟到的失败把 B 的原文清空了').toBe('# B')
    expect(vm.node?.aiLabel).toBe('B')
  })

  it('🔴 ④ finally 的 nodeLoading 也带守卫:迟到的响应不许提前收掉新选中的骨架(蓝本 :279)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click') // 切到 B,B 的两发挂起
    await flush()
    expect(w.findAll('.kw-article-inner .k-skel').length, 'B 的骨架该在').toBe(4)
    // A(已过期)回来 —— 不许把 B 的骨架关掉
    nodes.get('/DATA').resolve(nodeFor('/DATA'))
    raws.get('/DATA').resolve('# A')
    await flush()
    expect(
      w.findAll('.kw-article-inner .k-skel').length,
      '🔴 迟到的响应把新选中的骨架收掉了 —— finally 的过期守卫丢了',
    ).toBe(4)
    // B 自己回来才收掉
    nodes.get('/DATA/Documents').resolve(nodeFor('/DATA/Documents'))
    raws.get('/DATA/Documents').resolve('# B')
    await flush()
    expect(w.findAll('.kw-article-inner .k-skel').length).toBe(0)
  })

  it('🔴 `Promise.all` 照抄:node 与 raw **并发**发,不串行(蓝本 :266-269)', async () => {
    const order: string[] = []
    const nodeD = makeDeferred<WikiNode>()
    wiki.getNode.mockImplementation((p: string) => {
      order.push('node:' + p)
      return nodeD.promise
    })
    wiki.getRaw.mockImplementation((p: string) => {
      order.push('raw:' + p)
      return Promise.resolve('# ' + p)
    })
    await mountPage()
    // 串行写法下 raw 那发要等 node 落地才发出;这里 node 一直挂着而 raw 已发出。
    expect(order).toEqual(['node:/DATA', 'raw:/DATA'])
    nodeD.resolve(nodeFor('/DATA'))
    await flush()
  })

  it('🔴 N48:404 在 store 层转 null,是**业务态**不是错误(不 toast、骨架照常收掉)', async () => {
    wiki.getNode.mockRejectedValue(httpError(404))
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await flush()
    const vm = w.vm as unknown as { node: WikiNode | null; raw: string | null }
    expect(vm.node).toBeNull()
    expect(vm.raw).toBeNull()
    expect(toast, '404 走成了错误分支 —— N48 的分层被拉平了').not.toHaveBeenCalled()
    expect(w.findAll('.kw-article-inner .k-skel').length).toBe(0)
  })

  it('🔴 K58 形态 A:非 404 走 catch,只弹固定键,**不回显后端 body**', async () => {
    wiki.getNode.mockRejectedValue(httpError(500, 'PROBE-K58-T6WV-500'))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 重新触发一次(挂载那发的 spy 装晚了)
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toBe('操作失败')
    expect(String(toast.mock.calls[0][0])).not.toContain('PROBE-K58-T6WV')
    expect(w.html(), '后端串漏进了页面').not.toContain('PROBE-K58-T6WV')
    const vm = w.vm as unknown as { node: WikiNode | null; raw: string | null }
    expect(vm.node).toBeNull()
    expect(vm.raw).toBeNull()
  })

  it('每次取文章都把 showSource 重置回 false(蓝本 :264)', async () => {
    const { w } = await mountPage()
    const vm = w.vm as unknown as { showSource: boolean }
    vm.showSource = true
    await nextTick()
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(vm.showSource, 'fetchArticle 没重置 showSource —— 换文章后仍停在源码视图').toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 selName / selAiLabel / updatedFmt 的兜底(计划书 T6-8)
describe('WikiView —— 三个 computed 的兜底(蓝本 :190-195)', () => {
  it('🔴 selTreeNode 为 null 时 selName 退化成整条 `sel`(蓝本 :190)', async () => {
    // ⚠️ 申报:这是**防御分支**,走 UI 到不了 —— `sel` 只能经 `select()` 设置,而
    //   `select()` 第一行就是 `if (!byPath[path]) return` ⇒ 正常路径下 `byPath[sel]` 必然存在。
    //   本条直接改 setup 绑定制造该状态,并钉住「退化成整条路径」而不是空白。
    const { w } = await mountPage()
    const vm = w.vm as unknown as { byPath: Record<string, unknown>; sel: string }
    vm.byPath = {}
    await nextTick()
    expect(vm.sel).toBe('/DATA')
    expect(norm(w.find('.kw-crumb .cur').text()), 'selName 兜底成了空白').toBe('/DATA')
    expect(norm(w.find('.kw-title').text())).toBe('TREE/DATA')
  })

  it('🔴 parseTs 返 0 时 updatedFmt 为 ""(整块 span 不渲染)—— 两侧', async () => {
    // 反面(有时间戳):/DATA 的 last_modified 是真 RFC3339 ⇒ 「摘要更新于 …」出现。
    const withTs = await mountPage()
    const meta1 = withTs.w.find('.kw-meta')
    expect(meta1.exists()).toBe(true)
    expect(norm(meta1.text())).toContain('摘要更新于')
    // 正面(空串):Specs 的 last_modified 是空串(后端 formatTS(ms<=0) 的真形态)⇒ 整块不渲染。
    const noTs = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const meta2 = noTs.w.find('.kw-meta')
    expect(norm(meta2.text())).not.toContain('摘要更新于')
    expect(norm(meta2.text())).toBe('由 Nimo 自动维护')
  })

  it('selAiLabel 两侧:有 aiLabel 渲染 <b>,空串整块不渲染(蓝本 :191)', async () => {
    const withLabel = await mountPage()
    expect(withLabel.w.find('.kw-meta b').exists()).toBe(true)
    expect(norm(withLabel.w.find('.kw-meta b').text())).toBe('主数据盘')
    const noLabel = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    expect(noLabel.w.find('.kw-meta b').exists(), 'aiLabel 为空串时不该渲染 <b>').toBe(false)
  })

  it('selName:顶层根显示全路径、子节点显示 basename(buildWikiTree 的两支)', async () => {
    const root = await mountPage()
    expect(norm(root.w.find('.kw-crumb .cur').text())).toBe('/DATA')
    const child = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(norm(child.w.find('.kw-crumb .cur').text())).toBe('Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 openFolder(计划书 T6-9)
describe('WikiView —— openFolder(蓝本 :292-294)', () => {
  it('🔴 点「打开文件夹」→ openDirInNewTab(sel)', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    const btn = w.findAll('.kw-actions button').find((b) => norm(b.text()) === '打开文件夹')
    expect(btn, '「打开文件夹」按钮没渲染出来(§9.17:先确认它真是可点元素)').toBeTruthy()
    await btn!.trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledTimes(1)
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Documents')
  })

  it('换选中之后传的是新的 sel(不是挂载时那个)', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click')
    await flush()
    await w.findAll('.kw-actions button')[0].trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 created() 的 `if (!wikiRoots.length) loadRoots()`(计划书 T6-10)—— 两侧
describe('WikiView —— created 的 loadRoots 门(蓝本 :215-218)', () => {
  it('store 里没有 roots → 挂载时拉一次', async () => {
    await mountPage()
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
  })

  it('🔴 store 里已有 roots → **不重复拉**(照抄蓝本的 `if (!…length)`)', async () => {
    await mountPage({ seedRoots: ROOTS_NORMALIZED.map((r) => ({ ...r })) })
    expect(wiki.getRoots, '已有根列表却又拉了一次 —— `if (!wikiRoots.length)` 丢了').not.toHaveBeenCalled()
  })

  it('挂载即拉树(loadTree 那一发无条件)', async () => {
    await mountPage({ seedRoots: ROOTS_NORMALIZED.map((r) => ({ ...r })) })
    expect(wiki.getTree).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 「自动上膛」守卫(治理 §9.19 / 计划书 T6-12)
//
// 本条**现在惰性通过**(断言仍被执行,不是 `it.skip` / `it.todo`);
// **T7 一写下 `kw-summary` 的 markup 就立刻上膛**,强制它同时给出 `showSource` 切换按钮。
//
// §9.19 跨刀冲突论证:**不冲突** —— 计划书 T7 的第 3、4 条本来就要求
// 「`kw-summary` / `kw-rawsrc` 按 `showSource` 二选一」与「`:137` 的切换按钮文案在
// `Rendered view` / `View source` 之间翻转」⇒ 本守卫不向 T7 索要任何它无权写的东西
// (与 P5e 的 T5↔T6 冲突形成对照:那次是守卫索要 T6 无权写的 markup,靠裁定 R25 才解开)。
//
// 🔴 谓词禁裸子串(承裁定 **R19**):`WikiView.vue` 的文件头注释与模板里的 T7 占位注释
// **都写了 `kw-summary` 与 `showSource` 这两个字面串** —— 裸子串谓词会当场把本条判成
// 「已上膛」,然后再拿注释里的 `showSource` 判成「已满足」= 双向假阳性、零判别力。
// ⇒ 先**剥注释**、再把 `kw-summary` 锚定到 **class 属性值位置**。
// 🔴 剥注释器要求 `/*` 前是**空白或行首**(承裁定 **R26-3**):裸 `/\*[\s\S]*?\*\//`
// 会被 `'/Downloads/*'` 这类**路径字面量**骗开一个假注释、一路吃掉后面的真代码。
// 🔴 读文件一律 `node:fs`(Vite 的 `?raw` 在 vitest 下恒空 → 断言对空串假通过)。
// ═══════════════════════════════════════════════════════════════════════════

/** 保行版剥注释器 —— 覆盖 `<!-- -->`(模板)· `/* *​/`(script)· 整行 `//`。 */
function blankComments(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, blank)
    .replace(/^[ \t]*\/\/.*$/gm, blank)
}

/** 贪婪抽取根 `<template>` 块(取**最后一个**第 0 列 `</template>`,防嵌套截断)。 */
function extractTemplate(src: string): string {
  const start = src.indexOf('<template>')
  const end = src.lastIndexOf('\n</template>')
  if (start < 0 || end < 0 || end <= start) return ''
  return src.slice(start, end + '\n</template>'.length)
}

describe('WikiView —— 自动上膛守卫:模板出现 kw-summary ⇒ 必须同时有 showSource 切换按钮', () => {
  const TMPL_RAW = extractTemplate(SRC)
  const TMPL = blankComments(TMPL_RAW)

  it('防空转① —— 模板真的抽出来了,且剥注释后**真 markup 仍在**(不是把整块吃空)', () => {
    expect(SRC.length, 'WikiView.vue 读出来是空的 —— node:fs 读法失效了').toBeGreaterThan(0)
    expect(TMPL_RAW.length, '根 <template> 块没抽出来').toBeGreaterThan(0)
    // 🔴 真 markup 锚点:这三个 class 是本刀写下的、绝不在注释里独占的结构。
    expect(TMPL, '剥注释把真 markup 也吃掉了(R26-3 的路径字面量坑)').toMatch(
      /class="kw-node"/,
    )
    expect(TMPL).toMatch(/class="kw-crumb"/)
    expect(TMPL).toMatch(/class="kw-meta"/)
    // 剥掉的确实只是注释:原文里有 HTML 注释,剥完一个都不剩。
    expect(TMPL_RAW).toMatch(/<!--/)
    expect(TMPL).not.toMatch(/<!--/)
  })

  it('防空转② —— 谓词双向可分辨(注释里写了不算;真 class 属性才算)', () => {
    const commentOnly = [
      '<template>',
      '  <!-- 摘要区 class="kw-summary kw-md" 与 showSource 切换按钮归 T7 -->',
      '  <div class="kw-meta"/>',
      '</template>',
    ].join('\n')
    expect(hasSummaryMarkup(blankComments(extractTemplate(commentOnly)))).toBe(false)
    // 对照:裸子串谓词在同一份源码上会判真 —— 这正是 R19 要防的形态。
    expect(commentOnly.includes('kw-summary')).toBe(true)

    const realMarkup = [
      '<template>',
      '  <div class="kw-summary kw-md" v-html="html"/>',
      '</template>',
    ].join('\n')
    expect(hasSummaryMarkup(blankComments(extractTemplate(realMarkup)))).toBe(true)
    // `kw-summary-foo` 这类同名开头的类不许蒙混过关(E-25 的词边界坑)。
    const lookalike = '<template>\n  <div class="kw-summary-note"/>\n</template>'
    expect(hasSummaryMarkup(blankComments(extractTemplate(lookalike)))).toBe(false)
  })

  it('🔴 本体条件断言:模板尚无 kw-summary ⇒ 惰性通过(非 skip/todo);一旦写了则必须有 showSource 按钮', () => {
    if (!hasSummaryMarkup(TMPL)) {
      // 惰性分支:断言仍被执行到,只是判据真空成立。T7 写下 markup 的那一刻本条自动上膛。
      expect(
        hasSummaryMarkup(TMPL),
        'kw-summary 尚未写入模板(T7 的活)—— 本条处于「上膛待发」状态',
      ).toBe(false)
      return
    }
    expect(
      /showSource/.test(TMPL),
      '模板里出现了 kw-summary 摘要区,却没有任何 showSource 切换入口 —— ' +
        '蓝本 :137 的「查看原文 / 渲染视图」按钮是摘要区的唯一逃生口,漏了就再也切不回源码视图',
    ).toBe(true)
    // 按钮而不是别的元素:切换必须是可点的。
    expect(/<button[^>]*showSource|showSource[^<]*<\/button>|@click="showSource/.test(TMPL)).toBe(true)
  })
})

/** `kw-summary` 是否**真的**作为 class 属性里的一个完整 token 出现(不是子串、不是注释)。 */
function hasSummaryMarkup(strippedTmpl: string): boolean {
  return /class="[^"]*(?<![\w-])kw-summary(?![\w-])[^"]*"/.test(strippedTmpl)
}
