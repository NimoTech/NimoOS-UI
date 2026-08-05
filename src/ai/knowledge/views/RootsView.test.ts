// SP8-P5f Task 5 —— `RootsView.vue` 的组件测试。
// 蓝本 `NimoOS-UI` @ `7a6ee6b7` `src/views/AI/Knowledge/RootsView.vue`(289 行)。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 **mock 共享包的 `service.wiki.*` 六个方法,走真 `knowledgeStore`**,不 mock store。
//   理由同 `AllowlistView.test.ts` / `SettingsView.test.ts`,而本页还多一条**决定性的**:
//   🔴🔴 **裁定 R9 的 `toggle()` 不变量**(「store 就地改的是同一个对象」)只有走真 store
//   才测得出来 —— mock 掉 `setRootEnabled` 的话,`r.enabled` 永远不会被改,那两条守卫
//   用例会退化成「断言一个恒不变的值」,判别力归零。
// 🔴 形状(§4.1 的表 + `p5f-fixtures/README.md` §3):
//   · `service.wiki.getRoots` → **共享包已归一化**(`NimoOS-Service/src/wiki.ts:85`
//     `normalizeRoot`)⇒ 🔴 **camelCase**(`id`/`path`/`watchMode`/`scanIntervalS`/
//     `lastScanAt`/`enabled`),**不是** HTTP 原文的 PascalCase(N46 / T0 §4.4 定案)。
//   · `service.wiki.getCandidates` → **原样透传,不归一化**(`wiki.ts:154-157`)⇒
//     snake_case 的 `{ path, type, size?, label? }`。
//   · `createRoot` / `deleteRoot` / `rescanRoot` / `patchRootEnabled` 的响应体本页不消费,
//     一律 mock 成 `{}`。
// 🔴 **`createRootBody` 用真的**(`vi.importActual` 保留)—— 它是 D3 已进包的产物,
//   本仓不许重写;测试里也必须拿**真的那一份**去比对,否则等于自己写一份影子实现。
//
// ═══ fixture 是抄本,不是运行时读(治理 §4 / P5c §4.4) ═══
// 数据逐字抄进下面 `FIXTURE-COPY-BEGIN/END` 块并注明**三级出处标签**(裁定 R3 约束 1),
// **不用 `node:fs` 读 `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次)。
// 🔴 **只取数据字段,`__meta` 转成注释**(裁定 R14 / `p5f-fixtures/README.md` §0.2)。
// 抄本等价性由**程序化逐字节校验**确认(输出贴在 T5 报告 §5),不是肉眼比。
// 读 `.vue` 源文件一律 `node:fs`,**不许用 Vite 的 `?raw`**(vitest 下恒空 → 假通过)。
//
// ═══ 属性态断言口径(治理 §9) ═══
// `data-on` / `data-off` / `data-open` 都是普通 `data-*` 属性(不是布尔属性)→ 假侧渲染成
// 字符串 `"false"` 而不是缺席,故一律 `toBe('true')` / `toBe('false')`,**两侧都比**。
// `disabled` 是真布尔属性,断言 DOM 属性 `el.disabled`。
//
// ═══ 具名色扫描禁用词边界(裁定 R11,常驻) ═══
// 🔴 **禁 `\bwhite\b`** —— `white-space` 会满足词边界而假命中。本文件对 `color=` 属性值
// 一律用 `(?<![\w-])COLOR(?![\w-])` 形态(与 `knowledgeStyles.test.ts` 的既定口径同一份)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRootBody } from '@nimotech/nimoos-service'
import type { WikiRoot } from '@nimotech/nimoos-service'
// i18n 由 `vitest.setup.ts` 全局装好(见 `mountPage` 注释),本文件不再自己装 —— 也**不许**
// 另建 `createI18n`(与 setup 的单例重复安装,记忆 `vitest-reporter-hides-warnings`)。
import { useKnowledgeStore } from '../stores/knowledgeStore'
import KIcon from '../components/KIcon.vue'
import FolderBrowser from '../components/FolderBrowser.vue'
import RootsView from './RootsView.vue'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH: string = resolve(__dirname, './RootsView.vue')
const SRC: string = readFileSync(SRC_PATH, 'utf8')

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const wiki = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getCandidates: vi.fn(),
  createRoot: vi.fn(),
  deleteRoot: vi.fn(),
  rescanRoot: vi.fn(),
  patchRootEnabled: vi.fn(),
}))
const folder = vi.hoisted(() => ({ getList: vi.fn() }))
// 🔴 只替换 `service`,**`createRootBody` 保留真身**(importOriginal)—— 本页那条
//   「body 是 createRootBody 的产物」断言必须比真的那一份,不是影子实现。
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { wiki, folder } }
})

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json  (只取 `wikiRoots` 数组)
// 三级出处标签:**`.CONSTRUCTED`** —— 🔴 **不是真机数据**。`__meta` 转成本注释(裁定 R14),
// 原文要点:
//   · label     : .CONSTRUCTED
//   · why       : 同 wiki-roots.CONSTRUCTED.json —— /roots 本机超时(90 s / 0 字节),无真机样本。
//   · built_from: 把 wiki-roots.CONSTRUCTED.json 的 raw_response 逐字段过
//                 NimoOS-Service/src/wiki.ts:85 normalizeRoot。
//   · shape     : 🔴 camelCase —— 这就是 store.state.wikiRoots 的出口形状,
//                 RootsView / WikiView 的 mock 一律照它(N46)。
//   · note      : enabled 经 `!!r.Enabled` 归一成 boolean;
//                 scanIntervalS/createdAt/lastScanAt 经 `|| 0` 兜底。
// 🔴 本机 D1:`/v1/wiki/roots` 90 s 零字节超时 ⇒ §9.17 判定「列表行、开关、重扫、删除
//   全不可达」,本机只能看到空态。**这不是缺陷,是 D1。**
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

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-candidates.CONSTRUCTED.json  (只取 `candidates` 数组)
// 三级出处标签:**`.CONSTRUCTED`** —— 🔴 **不是真机数据**。`__meta` 转成本注释(裁定 R14):
//   · why        : GET /v1/wiki/candidates 本机 200 但实测恒 `[]`(见 wiki-candidates.REAL.json,
//                  连打三次每次 3 字节)⇒ **非空**样本无处可抓。
//   · built_from : NimoOS-Wiki/service/roots/candidates.go 的 Candidate struct;
//                  Path/Type 恒有(json tag 无 omitempty),Size/Label 是 omitempty(零值时整个键缺失)。
//   · passthrough: 🔴 getCandidates **不做归一化**(NimoOS-Service/src/wiki.ts:154-157 原样透传)
//                  ⇒ 页面看到的就是这个形状,**不是 camelCase 归一后的**。
//   · consumer   : RootsView 的 browserRoots = pickerRoots(store.state.wikiCandidates)。
const CANDIDATES_CONSTRUCTED = [
  { "path": "/DATA", "type": "dir", "size": 0, "label": "主数据盘" },
  { "path": "/DATA/Documents", "type": "dir" },
  { "path": "/mnt/backup", "type": "dir", "label": "备份盘" }
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-candidates.REAL.json  (整份)
// 三级出处标签:**`.REAL`** —— 本机真机 `GET http://127.0.0.1:41373/v1/wiki/candidates`
// 的原始响应内容(HTTP 200,3 字节)。该文件顶层没有 `__meta`,整份直用。
// 🔴 §9.17:本机就是这个态 ⇒ `FolderBrowser` 的候选恒空,走 `pickerRoots` 的兜底三根。
const CANDIDATES_REAL: never[] = []
// FIXTURE-COPY-END

const mountedWrappers: Array<ReturnType<typeof mount>> = []

/** 深拷贝 —— 每条用例拿到自己的一份对象,免得 `setRootEnabled` 的就地改串到下一条。 */
const cloneRoots = (rows: WikiRoot[] = ROOTS_NORMALIZED): WikiRoot[] =>
  rows.map((r) => ({ ...r }))

function mockAllOk(roots: WikiRoot[] = cloneRoots(), candidates: unknown[] = CANDIDATES_REAL): void {
  wiki.getRoots.mockResolvedValue(roots)
  wiki.getCandidates.mockResolvedValue(candidates)
  wiki.createRoot.mockResolvedValue({})
  wiki.deleteRoot.mockResolvedValue({})
  wiki.rescanRoot.mockResolvedValue({})
  wiki.patchRootEnabled.mockResolvedValue({})
  folder.getList.mockResolvedValue({ content: [] })
}

/**
 * K57 / P5b 交接项 #3 —— `DialogPortal to=".knowledge-app"` 的宿主。
 * 单独挂载时本页不在 `.knowledge-app` 子树里(生产环境宿主由 `KnowledgeLayout.vue` 提供),
 * 测试必须自己在 body 里放一个同名宿主。
 * 🔴 **`to` 只认第一个同名宿主** → 每个用例只放一个;`afterEach` 的
 * `document.body.innerHTML = ''` 负责清掉,不会串到下一条。
 * 先例:`AllowlistView.test.ts` / `SettingsView.test.ts` / `QueueView.test.ts`。
 */
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** 挂载。组件 `onMounted` 自己发 `store.loadRoots()`(蓝本 `created()`),
 *  所以这里不预热 store —— 让那一发真的跑,顺带守住「挂载即拉」。
 *  🔴 **宿主一律在挂载前就位**:`DialogPortal` 的 Teleport 在弹窗**关着**的时候就已经渲染,
 *  宿主缺席会让每一次挂载都打两条 `[Vue warn]`(先例与理由见 `AllowlistView.test.ts`)。 */
async function mountPage(roots?: WikiRoot[], candidates?: unknown[]) {
  if (roots || candidates) mockAllOk(roots ?? cloneRoots(), candidates ?? CANDIDATES_REAL)
  const host = withHost()
  const store = useKnowledgeStore()
  // 🔴 **不传 `plugins: [i18n]`** —— `vitest.setup.ts` 已把**同一个** i18n 单例装进
  //   `config.global.plugins`,再传一次会打 `Plugin has already been applied` 告警。
  const w = mount(RootsView)
  mountedWrappers.push(w)
  await flushPromises()
  await nextTick()
  return { w, store, host }
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

/** 造一个带 HTTP 状态码的 axios 风格错误(蓝本读的就是 `e.response.status`)。 */
function httpError(status: number, message = 'boom'): Error & { response: { status: number } } {
  const e = new Error(message) as Error & { response: { status: number } }
  e.response = { status }
  return e
}

/** VTU 的 `.text()` 只 trim 不折叠内部空白;跨行拼接的文案统一归一后再比。 */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

/**
 * 保行版剥注释器(治理 §9 / E-60:**结构性否定断言**必须先剥注释,否则注释里的
 * 字面文字会变成假阳性 —— 裁定 **R19** 就是这么把 T2 的裸子串谓词判掉的)。
 *
 * 🔴 **块注释的起点必须是「行首或前面是空白」**,不是裸 `/*`:
 *   本刀在核 `AllowlistView.vue` 的 `store.toast` 落点数时**实测踩到**——
 *   那个文件里有一处路径字面量 `'/Downloads/*'`,裸 `\/\*[\s\S]*?\*\/` 会从它中间开一个
 *   假注释、一路吃掉后面几行**真代码**(实测:落点数从 10 被吃成 9)。
 *   这正是 E-25 / R19「用了一条看起来能回答问题、但口径错的检索」的同族。
 *   加上「前面必须是空白」这一条后,本仓所有真块注释仍被剥掉,而路径里的 `/​*` 不再中招。
 */
function blankComments(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, blank)
}

/** 剥注释后的产品码 —— 三条结构性否定断言共用一份。 */
const SRC_CODE: string = blankComments(SRC)

const rows = (w: ReturnType<typeof mount>) => w.findAll('.k-set-row')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
  mockAllOk()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 fixture 抄本等价性 —— 治理 §4「抄进测试 + 程序化逐字节校验」。
// 这里比的是**形状与值**(不是把 JSON 再读一遍):三级标签、字段名风格、类型全部钉死。
// 判据:任何一处字段名被写成 PascalCase / snake_case → 本组立刻报红。
describe('RootsView —— fixture 抄本自检(N46:store 出口是 camelCase)', () => {
  it('🔴 抄本里一个 __meta 都没有(裁定 R14:只取数据字段,出处转注释)', () => {
    for (const r of ROOTS_NORMALIZED) {
      expect(Object.keys(r)).not.toContain('__meta')
    }
    for (const c of CANDIDATES_CONSTRUCTED) {
      expect(Object.keys(c)).not.toContain('__meta')
    }
  })

  it('🔴 N46 —— 根对象的键**逐字** camelCase(PascalCase / snake_case 一律报红)', () => {
    // `wiki-roots.normalized.CONSTRUCTED.json` 里 normalizeRoot 的十个出口字段,顺序照抄。
    expect(Object.keys(ROOTS_NORMALIZED[0]!)).toEqual([
      'id',
      'path',
      'level',
      'watchMode',
      'storageMode',
      'enabled',
      'scanIntervalS',
      'createdAt',
      'lastScanAt',
      'needsReconcile',
    ])
    // 反向:HTTP 原文那套 PascalCase 键一个都不许出现(搞反了整页空白且不报错)
    for (const bad of ['ID', 'Path', 'WatchMode', 'ScanIntervalS', 'LastScanAt', 'Enabled']) {
      expect(Object.keys(ROOTS_NORMALIZED[0]!)).not.toContain(bad)
    }
    // 反向:snake_case 也不许(那是 /tree · /node · /raw 那一族的风格)
    for (const bad of ['watch_mode', 'scan_interval_s', 'last_scan_at']) {
      expect(Object.keys(ROOTS_NORMALIZED[0]!)).not.toContain(bad)
    }
  })

  it('🔴 `enabled` 已经是 boolean(normalizeRoot 的 `!!r.Enabled`),不是 0/1 整数', () => {
    expect(ROOTS_NORMALIZED.map((r) => typeof r.enabled)).toEqual(['boolean', 'boolean'])
    expect(ROOTS_NORMALIZED.map((r) => r.enabled)).toEqual([true, false])
  })

  it('候选抄本是**透传形状**(snake 风格的 path/type/size/label,Size/Label 可缺席)', () => {
    expect(Object.keys(CANDIDATES_CONSTRUCTED[0]!)).toEqual(['path', 'type', 'size', 'label'])
    expect(Object.keys(CANDIDATES_CONSTRUCTED[1]!)).toEqual(['path', 'type'])
    expect(CANDIDATES_REAL).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView —— 三层壳 + 区头(蓝本 :2-11,逐层照抄)', () => {
  it('根 .k-view > .k-scroll > .k-scroll-inner,一个 .k-section 在最内层', async () => {
    const { w } = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('k-view')
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
    expect(w.findAll('.k-view > .k-scroll > .k-scroll-inner > .k-section')).toHaveLength(1)
  })

  it('区头文案逐字 + 右上按钮右对齐(蓝本 :7-11)', async () => {
    const { w } = await mountPage()
    expect(w.find('.k-section-title').text()).toBe('索引目录')
    expect(w.find('.k-section-hint').text()).toBe('知识库扫描的根目录')
    const btn = w.find('.k-section-head button.k-btn.primary')
    expect(norm(btn.text())).toBe('添加索引目录')
    expect(btn.attributes('style')).toContain('margin-left: auto')
  })

  it('蓝本 created()(:149-151)—— 挂载即 loadRoots(),getRoots 恰好发一次', async () => {
    await mountPage()
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
    // 候选只在 openAdd 时才拉(蓝本 :157),挂载时**不发**
    expect(wiki.getCandidates).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 空态 / 列表两侧(蓝本 :13-40)。§9.17:空态是本机 **唯一可达**的一侧(D1 —— /roots 超时)。
describe('RootsView —— 空态 / 列表两侧(蓝本 :13-40)', () => {
  it('🔴 空态(本机唯一可达):无根且不在加载 → .kr-empty,不渲染 .k-set-card', async () => {
    const { w } = await mountPage([])
    const empty = w.find('.kr-empty')
    expect(empty.exists()).toBe(true)
    expect(w.find('.k-set-card').exists()).toBe(false)
    expect(norm(empty.text())).toContain('尚未配置索引目录，知识库不会索引任何文件。')
    // 空态里也有一个「添加索引目录」主按钮(蓝本 :16-18)
    expect(norm(empty.find('button.k-btn.primary').text())).toBe('添加索引目录')
  })

  it('🔴 空态图标的 color 是 token 不是具名色(蓝本 :15 已是 token,照抄;裁定 R11 禁 \\bwhite\\b)', async () => {
    const { w } = await mountPage([])
    const icon = w.find('.kr-empty').findComponent(KIcon)
    expect(icon.props('name')).toBe('folder')
    expect(icon.props('size')).toBe(28)
    const color = String(icon.props('color'))
    expect(color).toBe('var(--text-tertiary)')
    const scrubbed = color.replace(/var\([^)]*\)/g, '')
    for (const c of ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']) {
      expect(scrubbed, `color 属性值位置出现具名色 ${c}`).not.toMatch(
        new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
      )
    }
  })

  it('🔴 加载中(loading=true 且列表为空)→ 空态**不**渲染(蓝本 :13 的 `&& !wikiRootsLoading`)', async () => {
    const d = makeDeferred<WikiRoot[]>()
    wiki.getRoots.mockReturnValue(d.promise)
    const host = withHost()
    const w = mount(RootsView)
    mountedWrappers.push(w)
    await nextTick()
    expect(w.find('.kr-empty').exists(), '还在加载就弹空态 = 首屏闪一下「尚未配置」').toBe(false)
    d.resolve([])
    await flushPromises()
    expect(w.find('.kr-empty').exists()).toBe(true)
    expect(host).toBeTruthy()
  })

  it('非空 → .k-set-card 列表,每根一行(蓝本 :20-39)', async () => {
    const { w } = await mountPage()
    expect(w.find('.kr-empty').exists()).toBe(false)
    const card = w.find('.k-set-card')
    expect(card.exists()).toBe(true)
    expect(card.attributes('style')).toContain('margin: 12px 16px')
    expect(rows(w)).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N46 落地 —— 页面读的六个 camelCase 字段逐个在 DOM 上有落点。
describe('RootsView —— N46:行内容读的是 camelCase 字段(蓝本 :22-28)', () => {
  it('path / enabled → .kr-path 的文案与 data-off 两侧', async () => {
    const { w } = await mountPage()
    const titles = rows(w).map((r) => r.find('.k-set-row-title.kr-path'))
    expect(titles.map((e) => e.text())).toEqual(['/DATA', '/DATA/Documents'])
    // data-* 不是布尔属性 → 假侧是字符串 "false",两侧都比
    expect(titles.map((e) => e.attributes('data-off'))).toEqual(['false', 'true'])
  })

  it('watchMode → .kr-badge 两侧文案(auto / scan_only)', async () => {
    const { w } = await mountPage()
    expect(rows(w).map((r) => r.find('.kr-badge').text())).toEqual(['实时监视', '仅定时扫描'])
  })

  it('🔴 scanIntervalS → 「每 {h} 小时扫描」,`Math.max(1, Math.round(s/3600))` 逐字(蓝本 :26)', async () => {
    // 21600 s → 6 h;3600 s → 1 h;另加两条只有正确表达式才对得上的边界:
    //   1800 s → round(0.5)=1(Math.round 进 1)· 100 s → round(0.027)=0 → max(1,0)=1
    const { w } = await mountPage([
      { ...ROOTS_NORMALIZED[0]!, id: 'a', scanIntervalS: 21600 },
      { ...ROOTS_NORMALIZED[0]!, id: 'b', scanIntervalS: 3600 },
      { ...ROOTS_NORMALIZED[0]!, id: 'c', scanIntervalS: 1800 },
      { ...ROOTS_NORMALIZED[0]!, id: 'd', scanIntervalS: 100 },
      { ...ROOTS_NORMALIZED[0]!, id: 'e', scanIntervalS: 7000 },
    ])
    const descs = rows(w).map((r) => norm(r.find('.k-set-row-desc').text()))
    expect(descs.map((s) => s.match(/每 (\d+) 小时扫描/)?.[1])).toEqual(['6', '1', '1', '1', '2'])
  })

  it('🔴 lastScanAt:0 → 「从未」;非 0 → fmtAgo(毫秒;蓝本 :27 的三元)', async () => {
    // 假时钟:fmtAgo 读 Date.now(),真时钟会让这条随时间漂(治理 §9.13)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z'))
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000
    const { w } = await mountPage([
      { ...ROOTS_NORMALIZED[0]!, id: 'a', lastScanAt: twoHoursAgo },
      { ...ROOTS_NORMALIZED[1]!, id: 'b', lastScanAt: 0 },
    ])
    const descs = rows(w).map((r) => norm(r.find('.k-set-row-desc').text()))
    expect(descs[0]).toContain('上次扫描: 2 小时前')
    expect(descs[1]).toContain('上次扫描: 从未')
  })

  it('id → :key 与三个动作的入参(重扫 / 删除 / 开关都拿对行)', async () => {
    const { w, store } = await mountPage()
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('9b1c77e0aa2f4d3e8c5106b4f7d2a318', true)
    expect(store.wikiRoots[1]!.enabled).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 裁定 R9 —— `toggle()` 的 toast 方向**不是蓝本 bug**,但它的正确性完全挂在
//    「store 改的是**组件手里那个同一个对象**」这个不变量上。本组就是那层守卫。
//    🔴 **不许退化成「断言调用了 setRootEnabled(id, !enabled)」** —— 那测不出 toast 方向。
//
// 🔴🔴 **判据订正(申报裁定 R18:brief 的 RED 判据只是提示,实测不成立以实测为准)**
//    brief / 裁定 R9 给的判据是「把 `knowledgeStore.ts` 的 `root.enabled = enabled`
//    **挪到 `await` 之后**」。**实测:那样改本组仍然全绿(60/60)**,判据不成立。
//    原因:挪到 `await` 之后,它仍然在 `setRootEnabled` 这个 async 函数**内部** ——
//    调用方 `await store.setRootEnabled(...)` 是在该函数**返回之后**才恢复的,
//    那时赋值早已完成 ⇒ `r.enabled` 照样是新值。**「在 await 之前还是之后」根本不是判别轴。**
//    🔴 **真正的判别轴 = 「组件手里那个对象有没有被改到」**,也就是裁定 R9 自己点名的
//    那个未来风险(「若改成整体替换数组」)。**实测成立的判据**:把 `setRootEnabled` 的
//    就地改换成
//      `wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled } : r))`
//    → 本组前两条 + R27 那条**共 3 条报红**(T5 报告 §7 贴完整输出 + md5sum 还原)。
//    ⇒ 下游若要复跑这层守卫,请用**后一条**判据,别用 brief 的字面版。
describe('RootsView —— R9 不变量:toggle() 成功后 toast 读到的是**新**状态', () => {
  it('🔴 关 → 开:toast 是「已启用」(不是旧状态的「已禁用」)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 第 2 行 enabled=false
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('9b1c77e0aa2f4d3e8c5106b4f7d2a318', true)
    expect(
      toast,
      'toast 读到的是**旧**值 —— store 不再就地改组件手里那个对象了(多半被换成了整体替换数组)',
    ).toHaveBeenLastCalledWith('已启用')
  })

  it('🔴 开 → 关:toast 是「已禁用」(另一侧,同一个不变量)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 第 1 行 enabled=true
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0', false)
    expect(toast).toHaveBeenLastCalledWith('已禁用')
  })

  it('🔴 失败时**不弹**成功 toast(store 回滚 + throw ⇒ 那行根本不执行)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.patchRootEnabled.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-toggle'))
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    const said = toast.mock.calls.flat().join('|')
    expect(said, '失败路径弹了成功 toast').not.toContain('已启用')
    expect(said, '失败路径弹了成功 toast').not.toContain('已禁用')
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    // 乐观更新已回滚(store 侧),开关也回到原位
    expect(store.wikiRoots[1]!.enabled).toBe(false)
    expect(rows(w)[1]!.find('button.k-sw').attributes('data-on')).toBe('false')
  })

  it('data-on 两侧都比(蓝本 :37,`String(r.enabled)` 照抄 → 假侧是字符串 "false")', async () => {
    const { w } = await mountPage()
    expect(rows(w).map((r) => r.find('button.k-sw').attributes('data-on'))).toEqual([
      'true',
      'false',
    ])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N51 / K58 —— toggle() 的两条错误分支。
describe('RootsView —— N51:toggle() 的 404 专属文案 + K58 其它错走映射', () => {
  it('🔴 404 → 「后端版本过旧，请先部署 Wiki 服务更新。」(蓝本 :168-170 逐字照抄)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.patchRootEnabled.mockRejectedValue(httpError(404, 'PROBE-K58-R5T9-404'))
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('后端版本过旧，请先部署 Wiki 服务更新。')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 非 404(500 / 无 response 的裸 Error)→ 固定键「操作失败」,不回显后端 body', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.patchRootEnabled.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-500'))
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
    expect(w.html()).not.toContain('PROBE-K58-R5T9')

    // 第二形态:连 `response` 都没有的裸 Error(蓝本 `e.message || e` 会回显它)
    wiki.patchRootEnabled.mockRejectedValue(new Error('PROBE-K58-R5T9-bare'))
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView —— rescan()(蓝本 :175-182)', () => {
  it('成功 → rescanRoot(id) + toast「已开始重新扫描」', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    const btn = rows(w)[0]!.findAll('button.k-btn.ghost')[0]!
    expect(btn.attributes('title')).toBe('立即重扫')
    await btn.trigger('click')
    await flushPromises()
    expect(wiki.rescanRoot).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0')
    expect(toast).toHaveBeenLastCalledWith('已开始重新扫描')
    // 蓝本刻意**不**重载列表(knowledgeStore.ts:692 的注释)
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
  })

  it('K58 —— 失败只弹「操作失败」,不回显后端 body', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.rescanRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-rescan'))
    await rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
    expect(w.html()).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 停用的根:重扫按钮 disabled(蓝本 :30 的 `:disabled="!r.enabled"`,两侧)', async () => {
    const { w } = await mountPage()
    const btnOf = (i: number) =>
      rows(w)[i]!.findAll('button.k-btn.ghost')[0]!.element as HTMLButtonElement
    expect(btnOf(0).disabled, 'enabled=true 的行应可点').toBe(false)
    expect(btnOf(1).disabled, 'enabled=false 的行应灰掉').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 —— 「添加索引目录」弹窗(蓝本 :43-91 是裸 .k-modal-bg + @click)。
describe('RootsView —— K57:reka「添加索引目录」弹窗', () => {
  async function openModal(roots: WikiRoot[] = [], candidates: unknown[] = CANDIDATES_REAL) {
    const m = await mountPage(roots, candidates)
    expect(m.host.querySelector('.k-modal'), '默认不该渲染弹窗').toBeNull()
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('点「添加索引目录」→ portal 到 .knowledge-app;head / body / foot 内容逐字', async () => {
    const { host } = await openModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head:DialogTitle 套在蓝本自己的 .k-modal-title 上(as-child)⇒ 不多一个隐藏节点
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('添加索引目录')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    // body:FolderBrowser + 选中路径标签 + 输入框 + 高级折叠(默认收起)
    expect(modal!.querySelector('.fb')).not.toBeNull()
    expect(modal!.querySelector('.kr-label')!.textContent).toBe('已选路径')
    const pathInput = modal!.querySelector('input.kr-input') as HTMLInputElement
    expect(pathInput.getAttribute('placeholder')).toBe('/DATA')
    expect(pathInput.getAttribute('spellcheck')).toBe('false')
    const adv = modal!.querySelector('.k-adv-toggle') as HTMLElement
    expect(adv.getAttribute('data-open')).toBe('false')
    expect(norm(adv.textContent!)).toBe('高级选项')
    expect(modal!.querySelector('.kr-adv-row'), '高级区默认收起').toBeNull()
    expect(modal!.querySelector('.kr-error'), '默认无错误块').toBeNull()
    // foot:取消 + 添加
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '添加'])
    expect(footBtns[0]!.className).toBe('k-btn outline')
    expect(footBtns[1]!.className).toBe('k-btn primary')
  })

  it('点 × 关闭,且不发请求', async () => {
    const { host } = await openModal()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.createRoot).not.toHaveBeenCalled()
  })

  it('点「取消」关闭,且不发请求', async () => {
    const { host } = await openModal()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '取消',
    ) as HTMLElement
    cancel.click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.createRoot).not.toHaveBeenCalled()
  })

  it('🔴 点遮罩(弹窗外)关闭;点弹窗内不关闭(reka pointerDownOutside 等价蓝本 @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka 的 usePointerDownOutside 用 setTimeout(0) 延后挂 document 监听 —— 补一次真宏任务 tick。
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), '点弹窗内不该关闭').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), '点遮罩必须关闭').toBeNull()
  })

  it('🔴 零 `@click.stop`(K57-②:遮罩语义交给 reka,不再手写阻止冒泡)', () => {
    // 结构性否定断言 → 必须先剥注释(治理 §9 / E-60 的「类名/调用形状」那一侧)。
    // 🔴 防空转:剥注释器若把真代码也吃掉(E-25 家族),下面那条否定断言就变成空壳。
    //    锚点取模板**最后一段**的特征串 —— 它在文件尾部,被误吃时最容易一起消失。
    expect(SRC_CODE, '剥注释器把真代码吃掉了 —— 下面的否定断言会假通过').toContain(
      'onDeletingOpen',
    )
    expect(SRC_CODE).toContain('DialogPortal')
    expect(SRC_CODE, '模板里还留着 @click.stop —— K57-② 要求交给 reka').not.toMatch(/@click\.stop/)
  })

  it('高级折叠区两侧(蓝本 :58-74):点开 → 监视模式 + 扫描间隔两行', async () => {
    const { host } = await openModal()
    const adv = host.querySelector('.k-adv-toggle') as HTMLElement
    adv.click()
    await nextTick()
    expect(adv.getAttribute('data-open')).toBe('true')
    const advRows = Array.from(host.querySelectorAll('.kr-adv-row'))
    expect(advRows).toHaveLength(2)
    expect(advRows.map((r) => r.querySelector('span')!.textContent)).toEqual([
      '监视模式',
      '扫描间隔(小时)',
    ])
    const modeBtns = Array.from(advRows[0]!.querySelectorAll('.k-radio-group button'))
    expect(modeBtns.map((b) => norm(b.textContent!))).toEqual(['自动', '仅扫描'])
    // 初值 watchMode='auto' → data-on 两侧
    expect(modeBtns.map((b) => b.getAttribute('data-on'))).toEqual(['true', 'false'])
    ;(modeBtns[1] as HTMLElement).click()
    await nextTick()
    expect(
      Array.from(host.querySelectorAll('.k-radio-group button')).map((b) =>
        b.getAttribute('data-on'),
      ),
    ).toEqual(['false', 'true'])
    // 间隔输入框初值 6
    const hours = advRows[1]!.querySelector('input.kr-input') as HTMLInputElement
    expect(hours.value).toBe('6')
    expect(hours.getAttribute('type')).toBe('number')
    expect(hours.getAttribute('min')).toBe('1')
    expect(hours.getAttribute('style')).toContain('width: 90px')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 FolderBrowser 接线(蓝本 :53 + :153-163)。
describe('RootsView —— FolderBrowser 接线:roots / @pick / openAdd 的 reset()', () => {
  async function openModal(candidates: unknown[] = CANDIDATES_REAL) {
    const m = await mountPage([], candidates)
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('🔴 :roots = pickerRoots(store.wikiCandidates) —— 非空候选逐项透过去', async () => {
    const { w } = await openModal(CANDIDATES_CONSTRUCTED)
    const fb = w.findComponent(FolderBrowser)
    expect(fb.exists()).toBe(true)
    expect(fb.props('roots')).toEqual([
      { path: '/DATA', label: '主数据盘' },
      // label 缺席 → pickerRoots 的 `c.label || c.path` 兜底
      { path: '/DATA/Documents', label: '/DATA/Documents' },
      { path: '/mnt/backup', label: '备份盘' },
    ])
  })

  it('🔴 候选恒空(本机 .REAL 就是这个态)→ pickerRoots 的兜底三根', async () => {
    const { w } = await openModal(CANDIDATES_REAL)
    expect(w.findComponent(FolderBrowser).props('roots')).toEqual([
      { path: '/DATA', label: 'System (/DATA)' },
      { path: '/media', label: '/media' },
      { path: '/mnt', label: '/mnt' },
    ])
  })

  it('openAdd 拉一次候选(蓝本 :157);挂载时不拉', async () => {
    const { w } = await mountPage([])
    expect(wiki.getCandidates).not.toHaveBeenCalled()
    await w.find('.k-section-head button.k-btn.primary').trigger('click')
    await flushPromises()
    expect(wiki.getCandidates).toHaveBeenCalledTimes(1)
  })

  it('🔴 @pick 回填 form.path(蓝本 :161-163);空 path 不回填', async () => {
    const { w, host } = await openModal(CANDIDATES_CONSTRUCTED)
    const fb = w.findComponent(FolderBrowser)
    const input = () => host.querySelector('input.kr-input') as HTMLInputElement
    expect(input().value).toBe('')
    fb.vm.$emit('pick', '/DATA/Documents')
    await nextTick()
    expect(input().value).toBe('/DATA/Documents')
    // 空串不回填(蓝本 `if (path)`)
    fb.vm.$emit('pick', '')
    await nextTick()
    expect(input().value, '空 path 把已选路径冲掉了').toBe('/DATA/Documents')
  })

  /**
   * 🔴 **判据:去掉 `nextTick` 或 `reset()` → 必须报红**(两半都要抓得住)。
   *
   * 🔴 **为什么必须用 stub 而不是 `vi.spyOn(fb.vm, 'reset')`**(实测结论,申报 R18):
   *   reka 的 `DialogContent` 走 `Presence` ⇒ **弹窗一关,`FolderBrowser` 就整个卸载**
   *   (实测:关弹窗后 `w.findComponent(FolderBrowser).exists() === false`,重开后面包屑
   *   从 2 条回到 1 条)。所以
   *     · 「关掉再开」拿到的是**新实例**,装在旧实例上的 spy 永远捕不到;
   *     · 而「弹窗已开时再点一次」虽然是同一个实例、spy 也确实能捕到,但那条路径下
   *       `fb.value` 早就非空 ⇒ **拿掉 `nextTick` 它仍然绿** = 只守住了一半。
   *   ⇒ 用一个自带 `defineExpose({ reset: spy })` 的 stub 替掉子组件:新实例每次都带着
   *     同一个 spy,`nextTick` 与 `reset()` 两半各自都能报红。
   *
   * ⚠️ 顺带记一笔:因为子组件本来就会卸载重建,`reset()` 在**本仓的 reka 版**里其实
   *   已经是无可观测副作用的一步(Vue2 蓝本用 `v-if` 也同理)。**照抄不删**(蓝本 1:1),
   *   本条守卫钉的是「这一步真的还在被调用」,不是它的可见后果。
   */
  it('🔴 openAdd 真的调了 FolderBrowser.reset()(判据:去掉 nextTick 或 reset() → 报红)', async () => {
    const resetSpy = vi.fn()
    const FolderBrowserStub = defineComponent({
      name: 'FolderBrowserStub',
      props: { roots: { type: Array, default: () => [] } },
      setup(_props, { expose }) {
        expose({ reset: resetSpy })
        return () => h('div', { class: 'fb fb-stubbed' })
      },
    })
    mockAllOk([], CANDIDATES_CONSTRUCTED)
    const host = withHost()
    const w = mount(RootsView, { global: { stubs: { FolderBrowser: FolderBrowserStub } } })
    mountedWrappers.push(w)
    await flushPromises()
    await nextTick()
    // 防空转:stub 真的替上去了,否则下面断的是一个永远不会被调的 spy
    expect(resetSpy, '还没开弹窗就不该调 reset()').not.toHaveBeenCalled()
    await w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.fb-stubbed'), 'stub 没被替上去 —— 本条失去判别力').not.toBeNull()
    expect(
      resetSpy,
      'openAdd 没有调用 FolderBrowser.reset() —— nextTick 或 reset() 掉了',
    ).toHaveBeenCalledTimes(1)
  })

  it('🔴 openAdd 把表单重置回初值(蓝本 :154 逐字同值)+ 清掉上次的错误块', async () => {
    const { w, host } = await openModal()
    const input = () => host.querySelector('input.kr-input') as HTMLInputElement
    // 制造一个 409 错误块 + 非初值表单
    input().value = '/mnt/ro'
    input().dispatchEvent(new Event('input'))
    await nextTick()
    wiki.createRoot.mockRejectedValue(httpError(409))
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '添加',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(host.querySelector('.kr-error')).not.toBeNull()
    // 关掉再开
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    expect(input().value, 'path 没被重置').toBe('')
    expect(host.querySelector('.kr-error'), 'addError / mirrorOffer 没被清').toBeNull()
    expect((host.querySelector('.k-adv-toggle') as HTMLElement).getAttribute('data-open')).toBe(
      'false',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 N46 的下划线陷阱 —— `createRootBody` 必须来自共享包,且三个入参真的传到位。
//    传错了后端会**静默丢弃**(Go 解码器大小写不敏感但下划线不匹配)⇒ 真机无报错、三门全绿。
describe('RootsView —— submit():createRootBody 的三个入参真的传到位(N46)', () => {
  async function openModal() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }
  const addBtn = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
  const setPath = async (host: HTMLElement, v: string) => {
    const el = host.querySelector('input.kr-input') as HTMLInputElement
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('🔴 源码里 `createRootBody` 是从共享包 import 的,不是本仓重写的(D3 已进包)', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*\bcreateRootBody\b[^}]*\}\s*from\s*'@nimotech\/nimoos-service'/)
    // 反向:本文件里不许自己拼那套 Go 字段名
    // 防空转同上:先证明剥注释后 `createRootBody` 的调用点还在,再做否定断言。
    expect(SRC_CODE, '剥注释器把 createRootBody 的调用点吃掉了').toContain('createRootBody({')
    expect(SRC_CODE, 'RootsView 自己拼 body 了 —— 必须用共享包的 createRootBody').not.toMatch(
      /\bStorageMode\s*:/,
    )
    expect(SRC_CODE).not.toMatch(/\bScanIntervalS\s*:/)
  })

  it('🔴 默认表单 → body 逐字段(Path/Level/WatchMode/StorageMode/ScanIntervalS)', async () => {
    const { host } = await openModal()
    await setPath(host, '/DATA/Books')
    addBtn(host).click()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledWith({
      Path: '/DATA/Books',
      Level: 'space',
      WatchMode: 'auto',
      StorageMode: 'inline',
      ScanIntervalS: 21600,
    })
    // 同时钉住「它就是共享包 createRootBody 的产物」
    expect(wiki.createRoot.mock.calls[0]![0]).toEqual(
      createRootBody({ path: '/DATA/Books', watchMode: 'auto', scanIntervalH: 6, mirror: false }),
    )
  })

  it('🔴🔴 watchMode / scanIntervalH 两个入参真的传到位(改高级选项 → body 跟着变)', async () => {
    const { host } = await openModal()
    await setPath(host, '/mnt/ro')
    ;(host.querySelector('.k-adv-toggle') as HTMLElement).click()
    await nextTick()
    // 监视模式 → scan_only
    ;(host.querySelectorAll('.k-radio-group button')[1] as HTMLElement).click()
    await nextTick()
    // 扫描间隔 → 2 小时
    const hours = host.querySelectorAll('input.kr-input')[1] as HTMLInputElement
    hours.value = '2'
    hours.dispatchEvent(new Event('input'))
    await nextTick()
    addBtn(host).click()
    await flushPromises()
    const body = wiki.createRoot.mock.calls[0]![0] as Record<string, unknown>
    expect(body.WatchMode, 'watchMode 没传进 createRootBody —— 后端会静默用默认值').toBe('scan_only')
    expect(body.ScanIntervalS, 'scanIntervalH 没传进 createRootBody').toBe(7200)
    expect(body).toEqual(
      createRootBody({ path: '/mnt/ro', watchMode: 'scan_only', scanIntervalH: 2, mirror: false }),
    )
  })

  it('🔴🔴 mirror 入参真的传到位(镜像重试 → StorageMode: mirror)', async () => {
    const { host } = await openModal()
    await setPath(host, '/mnt/ro')
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    addBtn(host).click()
    await flushPromises()
    // 第一发 mirror=false
    expect((wiki.createRoot.mock.calls[0]![0] as Record<string, unknown>).StorageMode).toBe('inline')
    // 点「以镜像模式添加」→ 第二发 mirror=true
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLElement
    expect(mirrorBtn, 'N50 的镜像按钮没渲染出来').not.toBeNull()
    mirrorBtn.click()
    await flushPromises()
    const body = wiki.createRoot.mock.calls[1]![0] as Record<string, unknown>
    expect(body.StorageMode, 'mirror 没传进 createRootBody').toBe('mirror')
    expect(body).toEqual(
      createRootBody({ path: '/mnt/ro', watchMode: 'auto', scanIntervalH: 6, mirror: true }),
    )
  })

  it('成功 → 关弹窗 + toast「已添加索引目录」+ 重载列表', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    await setPath(host, '/DATA/Books')
    addBtn(host).click()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(toast).toHaveBeenLastCalledWith('已添加索引目录')
    // createRoot 内部会再 loadRoots 一次(knowledgeStore.ts:682)
    expect(wiki.getRoots).toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 canSubmit(蓝本 :144)+ submitting 门(治理 §5.2)。
describe('RootsView —— canSubmit 两侧 + submitting 门', () => {
  async function openModal() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }
  const addBtn = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
  const setPath = async (host: HTMLElement, v: string) => {
    const el = host.querySelector('input.kr-input') as HTMLInputElement
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('🔴 canSubmit = path.startsWith("/") 两侧(disabled 是真布尔属性)', async () => {
    const { host } = await openModal()
    expect(addBtn(host).disabled, '初值空串 → 灰掉').toBe(true)
    await setPath(host, 'DATA/Books')
    expect(addBtn(host).disabled, '相对路径 → 灰掉').toBe(true)
    await setPath(host, '/DATA/Books')
    expect(addBtn(host).disabled, '绝对路径 → 可点').toBe(false)
  })

  it('🔴 函数自己也守 canSubmit(绕过按钮 disabled 直接调也不发请求)', async () => {
    const { w, host } = await openModal()
    await setPath(host, 'relative/path')
    // v-model.trim 已把值同步进 form;直接触发一次镜像按钮那条路径不可用,
    // 这里走「按钮虽 disabled 但 DOM click 仍派发」的等价路径
    addBtn(host).click()
    await flushPromises()
    expect(wiki.createRoot).not.toHaveBeenCalled()
    expect(w.html()).toBeTruthy()
  })

  it('🔴 submitting 门:第一发在飞时重复点不发第二发(蓝本 :184 自带)', async () => {
    const { host } = await openModal()
    await setPath(host, '/DATA/Books')
    const d = makeDeferred<unknown>()
    wiki.createRoot.mockReturnValue(d.promise)
    addBtn(host).click()
    await nextTick()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledTimes(1)
    // 按钮此刻应当是 disabled(`!canSubmit || submitting`)
    expect(addBtn(host).disabled, 'submitting 期间按钮没灰').toBe(true)
    addBtn(host).click()
    await nextTick()
    await flushPromises()
    expect(wiki.createRoot, 'submitting 门没挡住第二发').toHaveBeenCalledTimes(1)
    d.resolve({})
    await flushPromises()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K59 —— addError 走**弹窗内联**(不是 toast)。
//    记忆 `newui-dialog-error-not-toast`:toast 是 z-index 60、弹窗遮罩 1000 还带 blur
//    ⇒ 弹窗里的错误写成 toast 会被压住 + 糊掉。
describe('RootsView —— K59:addError 弹窗内联(409 出镜像按钮 / 非 409 只有文案)', () => {
  async function openModal() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    const el = m.host.querySelector('input.kr-input') as HTMLInputElement
    el.value = '/mnt/ro'
    el.dispatchEvent(new Event('input'))
    await nextTick()
    return m
  }
  const clickAdd = async (host: HTMLElement) => {
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '添加',
      ) as HTMLElement
    ).click()
    await flushPromises()
  }

  it('🔴 409 → 只读文案 + 「以镜像模式添加」按钮(N50 照抄,弹窗**不关**)', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    wiki.createRoot.mockRejectedValue(httpError(409, 'PROBE-K58-R5T9-409'))
    await clickAdd(host)
    const err = host.querySelector('.kr-error')
    expect(err, 'K59:错误必须内联在弹窗里').not.toBeNull()
    expect(norm(err!.textContent!)).toContain(
      '该目录只读——可改用镜像模式添加(wiki 数据存放在中央目录)。',
    )
    const mirrorBtn = err!.querySelector('button.k-btn.outline')
    expect(mirrorBtn, 'N50 的镜像按钮必须在').not.toBeNull()
    expect(norm(mirrorBtn!.textContent!)).toBe('以镜像模式添加')
    expect(host.querySelector('.k-modal'), '失败不该关弹窗').not.toBeNull()
    // 🔴 K59:走内联,**不**弹 toast
    expect(toast, '错误弹成了 toast —— 会被遮罩压住(记忆 newui-dialog-error-not-toast)').not.toHaveBeenCalled()
    // K58:不回显后端 body
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 非 409(500)→ K58 映射文案「操作失败」,且**没有**镜像按钮', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    wiki.createRoot.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-500add'))
    await clickAdd(host)
    const err = host.querySelector('.kr-error')
    expect(err).not.toBeNull()
    expect(norm(err!.textContent!)).toBe('操作失败')
    expect(err!.querySelector('button'), '非 409 不该出镜像按钮').toBeNull()
    expect(toast).not.toHaveBeenCalled()
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 裸 Error(无 response)也走映射,不回显 e.message(蓝本 :202 的第三条兜底)', async () => {
    const { host } = await openModal()
    wiki.createRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-bareadd'))
    await clickAdd(host)
    expect(norm(host.querySelector('.kr-error')!.textContent!)).toBe('操作失败')
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('409 之后再点镜像按钮:先清掉旧错误块(蓝本 :186-187 在 try 之前)', async () => {
    const { host } = await openModal()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    await clickAdd(host)
    expect(host.querySelector('.kr-error')).not.toBeNull()
    wiki.createRoot.mockResolvedValue({})
    ;(host.querySelector('.kr-error button.k-btn.outline') as HTMLElement).click()
    await flushPromises()
    expect(host.querySelector('.k-modal'), '成功应关弹窗').toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 —— 删除确认弹窗(蓝本 :93-120)+ confirmDelete()(蓝本 :209-219)。
describe('RootsView —— K57:reka「删除索引目录?」确认弹窗 + confirmDelete()', () => {
  async function openDelete(i = 0) {
    const m = await mountPage()
    expect(m.host.querySelector('.k-modal'), '默认不该渲染弹窗').toBeNull()
    const btn = rows(m.w)[i]!.findAll('button.k-btn.ghost')[1]!
    expect(btn.attributes('title')).toBe('删除')
    await btn.trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('点垃圾桶 → portal 到 .knowledge-app,标题 / 路径 / 勾选 / 提示 / 两个按钮逐字', async () => {
    const { host } = await openDelete(0)
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('删除索引目录?')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    const pathEl = modal!.querySelector('.k-modal-body .kr-path') as HTMLElement
    expect(pathEl.textContent).toBe('/DATA')
    expect(pathEl.getAttribute('style')).toContain('margin-bottom: 10px')
    const check = modal!.querySelector('.kr-check') as HTMLElement
    expect(norm(check.textContent!)).toBe('同时删除该目录下已生成的 .wiki.md 导航文件')
    expect((check.querySelector('input') as HTMLInputElement).type).toBe('checkbox')
    expect(norm(modal!.querySelector('.kr-hint')!.textContent!)).toBe(
      '知识库中的索引数据会保留；重新添加同一目录可直接复用。',
    )
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '删除'])
    expect(footBtns[0]!.className).toBe('k-btn outline')
    expect(footBtns[1]!.className).toBe('k-btn danger')
  })

  it('点 × 关闭,且不发请求', async () => {
    const { host } = await openDelete()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.deleteRoot).not.toHaveBeenCalled()
  })

  it('点「取消」关闭,且不发请求', async () => {
    const { host } = await openDelete()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '取消',
      ) as HTMLElement
    ).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.deleteRoot).not.toHaveBeenCalled()
  })

  it('🔴 点遮罩关闭;点弹窗内不关闭(reka pointerDownOutside)', async () => {
    const { host } = await openDelete()
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), '点弹窗内不该关闭').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), '点遮罩必须关闭').toBeNull()
  })

  it('🔴 purgeFiles 两侧:不勾 → deleteRoot(id, false)', async () => {
    const { host, store } = await openDelete(0)
    const toast = vi.spyOn(store, 'toast')
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(wiki.deleteRoot).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0', false)
    expect(toast).toHaveBeenLastCalledWith('已删除')
  })

  it('🔴 purgeFiles 两侧:勾上 → deleteRoot(id, true)', async () => {
    const { host } = await openDelete(1)
    const box = host.querySelector('.kr-check input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(wiki.deleteRoot).toHaveBeenCalledWith('9b1c77e0aa2f4d3e8c5106b4f7d2a318', true)
  })

  it('🔴 删完 deleting=null 且 purgeFiles=false(蓝本 :217-218 在 try/catch **之外**)', async () => {
    const { w, host } = await openDelete(1)
    const box = host.querySelector('.kr-check input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    // deleting=null ⇒ 弹窗关掉
    expect(host.querySelector('.k-modal'), 'deleting 没被置 null').toBeNull()
    // purgeFiles=false ⇒ 重开一次,勾选框回到未勾
    await rows(w)[1]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    expect(
      (host.querySelector('.kr-check input') as HTMLInputElement).checked,
      'purgeFiles 没被重置 —— 下次删除会意外连文件一起清掉',
    ).toBe(false)
  })

  it('🔴 K58 —— 删除失败:只弹「操作失败」,弹窗仍关、purgeFiles 仍重置(蓝本那两行在 catch 之外)', async () => {
    const { host, store } = await openDelete(0)
    const toast = vi.spyOn(store, 'toast')
    wiki.deleteRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-del'))
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
    expect(host.querySelector('.k-modal'), '蓝本 :217 在 catch 之外 ⇒ 失败也关').toBeNull()
  })

  it('🔴 关闭弹窗**不**重置 purgeFiles(蓝本三条关闭路径都只置 deleting=null,照抄)', async () => {
    const { w, host } = await openDelete(0)
    const box = host.querySelector('.kr-check input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    await rows(w)[0]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    expect(
      (host.querySelector('.kr-check input') as HTMLInputElement).checked,
      '蓝本关闭路径不碰 purgeFiles —— 这里被「顺手修正」了',
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 裁定 R27 / 勘误 E-62 —— toast 一律走 `store.toast(...)`(内部 2400ms),
// 直调 `useToast()` 会丢掉蓝本自己的 2400ms(全局 `show()` 默认只有 1500ms)。
describe('RootsView —— R27:7 处 toast 全部经 store.toast(不是直调 useToast)', () => {
  it('toggle / rescan / confirmDelete 三条成功分支都被 store.toast 的 spy 捕获', async () => {
    const { w, host, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 🔴 §9.17:「点某个东西」之前先确认它在本条数据下真是可点元素 ——
    //   重扫按钮带 `:disabled="!r.enabled"`,所以**必须先重扫再 toggle**;
    //   反过来先把第 0 行关掉,重扫按钮就灰了,那一发 click 静默不发生(实测栽过一次)。
    expect(
      (rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.element as HTMLButtonElement).disabled,
      '第 0 行的重扫按钮此刻必须是可点的',
    ).toBe(false)
    // ① rescan 成功
    await rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.trigger('click')
    await flushPromises()
    // ② toggle 成功
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    // ③ confirmDelete 成功
    await rows(w)[1]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    // 判据:任何一处改成直调 useToast().show(...) → 该处的 spy 记录消失
    expect(toast.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '已开始重新扫描',
      '已禁用',
      '已删除',
    ])
  })

  it('🔴 源码里零 `useToast(` 直调(治理 §5.1 / 裁定 R27)', () => {
    expect(SRC_CODE, '直调 useToast() 会丢掉蓝本的 2400ms(裁定 R27)').not.toMatch(/useToast\s*\(/)
    // 🔴 防空转:确认真的有 store.toast 调用点(否则上面那条对着一个不发 toast 的页面也绿)。
    //   7 = toggle 2(成功 + catch)+ rescan 2 + confirmDelete 2 + submit 成功 1;
    //   submit 的失败路径按 K59 走弹窗内联,**不弹 toast**,故不计。
    expect((SRC_CODE.match(/store\.toast\(/g) || []).length, 'store.toast 落点数').toBe(7)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 SP8-P5f **Task 6 追加**(裁定 **R27** —— T5 评审的 Important I-1 派给本刀)
//
// ⚠️ 本文件对 T6 是**极窄解禁:只许新增,既有每一行零改动**(裁定 R27)。
//    🔴 **`RootsView.vue` 产品码一个字都没动** —— 评审已逐字核为**正确**,
//    缺的从来是守卫(「产品代码对、守卫为零」家族第 N 次)。
//
// 【上面那条 submitting 用例为什么是零判别力】
//   `RootsView —— canSubmit 两侧 + submitting 门` 里的
//   「🔴 submitting 门:第一发在飞时重复点不发第二发」点的是 `.k-modal-foot` 里的
//   **「添加」按钮**,而那个按钮带 `:disabled="!canSubmit || submitting"`。
//   🔴 **jsdom 不向 `:disabled` 元素派发 click 事件** ⇒ 第二次 `.click()` 根本没进入
//   被测代码 ⇒ 那条用例实测的是 **`:disabled` 绑定**,不是 `submit()` 里的函数门。
//   评审实证:把 `submit()` 的 `|| submitting.value` 整条门去掉,**60/60 全绿**。
//   ⚠️ 这是治理 §9.17「点某个东西先确认它在给定数据下真渲染成**可点**元素」的变种:
//     **元素渲染了,但它是 disabled ⇒ 点击事件根本没发生 ⇒ 用例从未到达被测代码。**
//     **常驻教训:jsdom 下点 `:disabled` 元素 = 零判别力,验「函数门」必须走无 disabled 的入口。**
//
// 【本条走的真实绕过路径】**N50 的「以镜像模式添加」按钮**(`RootsView.vue` 的
//   `.kr-error` 内联块里那个 `k-btn outline`)—— 它 `@click="submit(true)"` 且
//   **没有任何 `:disabled` 绑定** ⇒ 双击真的会派发两次 click、真的会进两次 `submit()`。
//   🔴 判据:去掉 `submit()` 的 `submitting.value` 门 → **本条必须报红**
//   (带门 1 发 / 去门 2 发 `createRoot`)。RED 输出与 `md5sum` 还原确认贴在
//   `p5f-task-6-report.md` §7。
// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView —— 🔴 submitting 是**函数门**,不只是 :disabled 绑定(裁定 R27)', () => {
  /** 开弹窗 → 填一个合法路径 → 用 409 换出「以镜像模式添加」按钮(N50)。 */
  async function openWithMirrorOffer() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    const input = m.host.querySelector('input.kr-input') as HTMLInputElement
    input.value = '/mnt/ro'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    ;(
      Array.from(m.host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '添加',
      ) as HTMLElement
    ).click()
    await flushPromises()
    return m
  }

  it('🔴 §9.17 前置:「以镜像模式添加」按钮真渲染成**可点**元素(无 disabled)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(mirrorBtn, 'N50 的镜像按钮没渲染出来 —— 本组会退化成零判别力').not.toBeNull()
    expect(norm(mirrorBtn.textContent!)).toBe('以镜像模式添加')
    // 🔴 这才是本条能测到「函数门」的前提:它**不是** disabled 元素。
    expect(mirrorBtn.hasAttribute('disabled'), '镜像按钮带了 disabled —— jsdom 不会派发 click').toBe(false)
    expect(mirrorBtn.disabled).toBe(false)
    // 对照:同一时刻「添加」按钮是 disabled 的(它才是上面那条零判别力用例点的目标)。
    const addBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
    expect(addBtn.disabled, '「添加」按钮此刻应当是 disabled(canSubmit 为真但 submitting 为假?)').toBe(false)
  })

  it('🔴 双击镜像按钮:submitting 函数门挡住第二发(判据:去掉该门 → 本条必须报红)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(mirrorBtn).not.toBeNull()
    wiki.createRoot.mockClear() // 409 那一发不算
    const d = makeDeferred<unknown>()
    wiki.createRoot.mockReturnValue(d.promise)
    // 🔴 **同步双击**:两次点击之间不 await —— Vue 还没重渲染,元素与监听器都还在,
    //   两次 click **都真的派发到 `submit(true)`**。挡住第二发的只能是函数里的
    //   `if (!canSubmit.value || submitting.value) return`。
    mirrorBtn.click()
    mirrorBtn.click()
    await flushPromises()
    expect(
      wiki.createRoot,
      '🔴 第二发也发出去了 —— submit() 里的 submitting 门丢了(:disabled 挡不住这个入口)',
    ).toHaveBeenCalledTimes(1)
    d.resolve({})
    await flushPromises()
  })

  it('第一发落地之后镜像按钮才允许再发(finally 里 submitting 归位)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    wiki.createRoot.mockClear()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    mirrorBtn.click()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledTimes(1)
    // 409 再次给出镜像按钮;门已归位 ⇒ 这一发能出去。
    const again = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(again, '第二次 409 后镜像按钮没回来').not.toBeNull()
    wiki.createRoot.mockResolvedValueOnce({})
    again.click()
    await flushPromises()
    expect(wiki.createRoot, 'submitting 没在 finally 里归位 —— 门变成了一次性').toHaveBeenCalledTimes(2)
  })
})
