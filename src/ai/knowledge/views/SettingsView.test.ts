// SP8-P5c Task 8 + Task 9 —— `SettingsView.vue` 的组件测试。
// 蓝本 `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/SettingsView.vue`(322 行)。
// **T8** 覆盖上半:服务卡 · 运行档三行(并发/设备/OCR)· 沙盒入口 · 危险区 + 对应 script
//   (`controlState` / `deviceLabel` / `togglePause` / `setConcurrency` / `setDevice` /
//   `toggleOcr` / `goSandbox`)。
// **T9** 覆盖下半:笔记区(目录行 + `openRootPicker` 折叠区 + `FolderBrowser` 接入 +
//   `onPick`/`dirProbe` 四态 + 两个按钮的 disabled + 自动捕获开关)· K29 的 reka 迁移弹窗 ·
//   `browserRoots` / `created` / `applyRoot` / `doMigrate` / `closeMigrate` /
//   `toggleAutoExtract`。T9 的用例全部在文件末尾的 `═══ T9 ═══` 分隔线之后。
//
// 🔴 **T9 对 T8 既有代码的改动仅 4 处,全部是「插入下半」被迫的机械后果**(逐处见 T9 报告 §3):
//   ① `vi.hoisted` mock 骨架 +3 个域(`notes` / `wiki` / `folder`)—— 组件现在真的调它们;
//   ② `mockAllOk()` **+5 行**默认值(纯新增,既有 3 行零改动)—— 否则 T8 既有用例挂载时
//      `getSettings()` 返回 undefined,
//      模板读 `notesSettings.notesRoot` 当场 TypeError;
//   ③ 危险区那条断言的**定位器**(不是断言值):插入笔记区后 `.k-section` 有两个、
//      `w.find('.k-section .k-section-head')` 会先命中笔记区(登记为 E-22);
//   ④ 「四个 catch 都是无参 catch」那条的**计数** 4 → 8(下半新增 4 个 catch,登记为 E-23)。
//   除此之外 T8 的每一条 `expect` 与每一个 DOM 断言**一字未动**。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 **mock 共享包 `service.ai.parserStats/parserState/parserControl`,走真 `knowledgeStore`**,
//   不 mock store。理由同 T6 `ParserStatus.test.ts`:本页每一格都要穿过 K1 降层
//   (蓝本 `store.state.controlState` → 本仓 `store.controlState`),mock store 会把
//   「降层与字段名到底对不对得上」这件最容易翻车的事整个绕开;走真 store 则每条渲染
//   断言天然是集成断言 —— 少降一层或字段名错一个字母,对应那格立刻空/undefined。
//   T9 的 `browserRoots`(K1 第二处降层,读 `store.wikiCandidates`)与 `store.loadCandidates()`
//   同样走真 store + 真 `service.wiki.getCandidates` mock。
// 🔴 形状:`service.ai.parserStats` / `parserState` 在包里都只 `return res.data`
//   (`NimoOS-Service/src/ai.ts:591-596`,零转换)→ 一律 mock 成 **HTTP 原样 snake_case**,
//   就是 fixture 原文。`parserControl` 的响应体本页不消费,mock 成 `{}`,与
//   `parserStore.test.ts:207` / `knowledgeStore.parser.test.ts:136` / `ParserStatus.test.ts:182`
//   逐字一致(治理 §4.1 的 red flag 自查:同一方法在两个测试文件里形状不同 = 定时炸弹)。
// 🔴 **T9 的四个新 mock 层次,逐个与 §4.1 那张表对齐**:
//   · `service.notes.getSettings` / `putSettings` → **camelCase 且只有
//     `{ notesRoot, autoExtract }` 两个字段**(包内 `normalizeSettings`,
//     `NimoOS-Service/src/notes.ts:131-137`)。**HTTP 层是 `notes_root` / `auto_extract`,
//     而且还多带 `distill_roots` / `distill_daily_cap` / `background_model` 三个字段 ——
//     那个归一函数把它们全丢掉了**。写 snake_case 或多带字段都是错的。
//   · `service.notes.dirInfo` → `{ exists: boolean, empty: boolean }`(包内 `!!` 归一,`:264-267`)。
//   · `service.wiki.getCandidates` → 已归一化数组(空时 `[]`,`wiki.ts:154-156`)。
//   · `service.folder.getList`(经 `FolderBrowser`)→ 🔴 **`unwrap()` 后的单层
//     `{ content: FolderEntry[] }`**(`folder.ts:7-10`),**不是** fixture 里那个三层信封。
//     与 `FolderBrowser.test.ts:185` 的 `{ content: [] }` 逐字同形状(red flag 自查通过)。
//
// ═══ fixture 是抄本,不是运行时读(治理 §4.4) ═══
// 数据逐字抄进下面 `FIXTURE-COPY-BEGIN/END` 块并注明出处,**不用 `node:fs` 读
// `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次),本分支将来要合
// master,`src/` 下的测试跨界依赖它会以「找不到文件」的形式神秘挂掉。
// 抄本等价性由**程序化逐字节校验**确认(输出贴在 T8 报告 §5),不是肉眼比。
// 读 `.vue` 源文件(A-1 / 零裸色那几条)一律 `node:fs`,**不许用 Vite 的 `?raw`**
//   (vitest 的 CSSEnablerPlugin 会把样式源换成空串 → 断言对空字符串「假通过」;
//    先例 `knowledgeStyles.test.ts` 头注释③)。
//
// ═══ 属性态断言口径(治理 §9 / 附录 D §D.3.1) ═══
// `data-state` / `data-on` 都是普通 `data-*` 属性(不是布尔属性)→ 假侧渲染成字符串
// `"false"` 而不是缺席,故一律 `toBe('true')` / `toBe('false')`,**两侧都比**,
// 禁 `toBeUndefined()`。`disabled` 是真布尔属性,断言 DOM 属性 `el.disabled`。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import zhCn from '../../../i18n/zh_cn'
import enUs from '../../../i18n/en_us'
import { useToast } from '../../../stores/toast'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { ParserControlState, ParserStats } from '../stores/knowledgeStore'
import type { NotesSettings } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import SettingsView from './SettingsView.vue'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = resolve(__dirname, './SettingsView.vue')

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const ai = vi.hoisted(() => ({
  parserStats: vi.fn(),
  parserState: vi.fn(),
  parserControl: vi.fn(),
}))
// T9 新增三域:组件下半真的调 `service.notes.*`,`store.loadCandidates()` 真的调
// `service.wiki.getCandidates`,`FolderBrowser` 真的调 `service.folder.getList`。
const notes = vi.hoisted(() => ({
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  dirInfo: vi.fn(),
}))
const wiki = vi.hoisted(() => ({ getCandidates: vi.fn() }))
const folder = vi.hoisted(() => ({ getList: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai, notes, wiki, folder } }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-control-state.json  (整份,GET /v1/parser/state)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-control-state.json`(2026-08-03 13:22 真机抓取)。
// 🔴 本机当前是**暂停态**(治理 §4.3)→ 服务卡是橙灯 `[data-state="paused"]` + `⏸ 已暂停`
// + `primary` 档的「恢复」按钮;`device:"auto"` + `resolved_device:"cpu"` → deviceLabel
// 渲染「自动（当前 CPU）」;`ocr_enabled:false` → 开关灰档。「运行中 / 绿灯」那一档在本机
// 看不到(点一次「恢复」会真的恢复索引),靠下面的 fixture 变体覆盖。
const STATE: ParserControlState = {
  "paused": true,
  "concurrency": 2,
  "device": "auto",
  "ocr_enabled": false,
  "resolved_device": "cpu"
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-stats.json  (整份,GET /v1/parser/stats)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-stats.json`(2026-08-03 13:22)。
// 本页**不渲染 stats 里的任何字段**,但 `store.loadOverview()` 是 `Promise.all` 两发
// (stats + state),缺一发就整体走 catch 置 `unreachable` → controlState 停在默认值。
// 故这份 fixture 是「让 state 那一发能落地」的必需前提,不是装饰。
// 🔴 `models[1].dim` 真机是 `null`,而 `ParserModel.dim` 是 `dim?: number`
//   (`knowledgeStore.ts:76`;T5 的 `parserStore.ts:78` 放宽成 `number | null`,两个 store
//   各自的类型,不在本刀范围)→ 直接标注 `: ParserStats` 会 TS 报错。**fixture 原文优先**
//   (治理 §4.4「逐字抄」),故走 `as unknown as ParserStats` ——「后端真会回 null」正是
//   mock 要模拟的 HTTP 原样,不许为了迁就类型而改数据。
const STATS = {
  "queue_depth": {
    "pending": 339,
    "running": 1,
    "failed": 0,
    "done": 9
  },
  "indexed_files": 7,
  "total_vectors_text": 5592,
  "total_vectors_visual": 0,
  "last_cursor_ms": 1784775953391,
  "models": [
    {
      "name": "bge-m3",
      "version": "v1",
      "modality": "text",
      "dim": 1024
    },
    {
      "name": "bge-reranker-v2-m3",
      "version": "v1",
      "modality": "rerank",
      "dim": null
    }
  ]
} as unknown as ParserStats
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/notes-settings.json  (GET /v1/notes/settings)
// HTTP 原文(逐字节):{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}
// 取自 `.superpowers/sdd/p5c-fixtures/notes-settings.json`(2026-08-03 13:22 真机抓取)。
// 🔴 **降层动作(治理 §4.1 / §4.4:降层要在注释里留证)**:`service.notes.getSettings` 包内走
//   `normalizeSettings`(`NimoOS-Service/src/notes.ts:131-137`):
//       notesRoot   = (r.notes_root as string) || ''
//       autoExtract = r.auto_extract !== false        ← undefined 也归一成 true
//   → 组件拿到的是 **camelCase 且只有下面这两个字段**;上面那三个 `distill_*` /
//   `background_model` 被归一函数**整个丢掉**,mock 里多带一个都是错的。
const NOTES_SETTINGS: NotesSettings = { notesRoot: '/DATA/Notes', autoExtract: true }
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/notes-dir-info-notes.json  (GET /v1/notes/dir-info?path=/DATA/Notes)
// HTTP 原文(逐字节):{"exists":true,"empty":false}
// 🔴 本机 `/DATA/Notes` 实测**存在且非空** → `migratable = !exists || empty` = false
//   → 选它时「搬文件到新目录…」按钮**是灰的**(治理 §4.3 / §13,是正确行为)。
//   包内 `dirInfo`(`notes.ts:264-267`)只做 `!!` 归一,字段名与层次都不变。
const DIR_INFO_NOTES = { exists: true, empty: false }
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/wiki-candidates.json  (GET /v1/wiki/candidates)
// HTTP 原文(逐字节):[]
// 🔴 本机实测空数组(HTTP 200,秒回)→ `pickerRoots([])` 走**兜底三根**
//   (`System (/DATA)` / `/media` / `/mnt`),这是真机走到的路径,不是死代码。
//   包内 `getCandidates`(`wiki.ts:154-156`)已 `|| []` 归一,层次不变。
const WIKI_CANDIDATES: never[] = []
// FIXTURE-COPY-END
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `service.folder.getList` 的返回形状 —— 🔴 **单层** `{ content: FolderEntry[] }`
 * (`folder.ts:7-10` 已 `unwrap()`),与 `FolderBrowser.test.ts:185` 逐字同形状。
 * 🔴 **不抄 `folder-list-DATA.json` 那 18 项**:本文件没有一条断言依赖目录列表的内容
 * (列表渲染、排序、隐藏项过滤全部由 `FolderBrowser.test.ts` 用真 18 项 fixture 覆盖);
 * 这里只需要「点根目录那一行能走通」,喂空目录即可(治理 §4.4:用不到就不抄)。
 */
const EMPTY_LISTING = { content: [] }

/** 两发全成功,喂 fixture 原文;控制动作返回 `{}`。 */
function mockAllOk(): void {
  ai.parserStats.mockResolvedValue(STATS)
  ai.parserState.mockResolvedValue(STATE)
  ai.parserControl.mockResolvedValue({})
  // T9:下半的四个只读/写入口默认全成功,喂 fixture 抄本(层次见文件头 mock 策略)。
  notes.getSettings.mockResolvedValue(NOTES_SETTINGS)
  notes.putSettings.mockResolvedValue(NOTES_SETTINGS)
  notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
  wiki.getCandidates.mockResolvedValue(WIKI_CANDIDATES)
  folder.getList.mockResolvedValue(EMPTY_LISTING)
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

function makeRouter() {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/knowledge/settings', name: 'KnowledgeSettings', component: SettingsView },
      // 蓝本 `:318` 的 `goSandbox()` 目标。生产环境这条路由此刻仍指占位页
      // (`knowledgeRoutes.ts:63`,T10 才反转)—— 跳过去看到占位页是预期。
      { path: '/ai/parser/test', name: 'AIParserTest', component: { template: '<div />' } },
    ],
  })
  router.push('/ai/knowledge/settings')
  return router
}

/**
 * 挂载。`controlState` 在生产里由 `KnowledgeLayout.vue:186` 的 `loadOverview()` 填充
 * (本页自己不发只读请求),测试里显式先跑一次同一个 action —— 走真 store、真 service
 * mock,K1 降层与 snake_case 字段名都在这条路径上被验到。
 */
async function mountPage(state?: Partial<ParserControlState>) {
  if (state) ai.parserState.mockResolvedValue({ ...STATE, ...state })
  const router = makeRouter()
  await router.isReady()
  const store = useKnowledgeStore()
  await store.loadOverview()
  const w = mount(SettingsView, { global: { plugins: [router, i18n] } } as never)
  mountedWrappers.push(w)
  await nextTick()
  return { w, store, router }
}

/** VTU 的 `.text()` 只 trim 不折叠内部空白;跨行拼接的文案统一归一后再比。 */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

// ── 定位小工具 ──
// 🔴 不用 `:nth-of-type()`:危险区那张卡里的 `.k-set-row` 也是它父元素的第 1 个 div,
//   选择器会同时命中(现在恰好因为它没有 `.k-radio-group` 而不出错,那是运气不是设计)。
//   改成「先取运行档那张卡,再在卡内取行」。T9 往「运行档卡」与「沙盒入口」之间插入笔记区
//   之后,`.k-set-card` 的下标 1 仍是运行档卡(笔记那张卡在它之后),本组定位不受影响。
const knobCard = (w: ReturnType<typeof mount>) => w.findAll('.k-set-card')[1]!
const knobRows = (w: ReturnType<typeof mount>) => knobCard(w).findAll('.k-set-row')
const concBtns = (w: ReturnType<typeof mount>) => knobRows(w)[0]!.findAll('.k-radio-group button')
const devBtns = (w: ReturnType<typeof mount>) => knobRows(w)[1]!.findAll('.k-radio-group button')
const devLabelB = (w: ReturnType<typeof mount>) => knobRows(w)[1]!.find('.k-set-row-desc b')
/** 危险区那个 `.k-section` —— 按语义(卡上有 `.k-set-danger`)定位,不用下标。
 *  T9 插入笔记区后 `.k-section` 有两个,`find('.k-section …')` 会先命中笔记区(E-22)。 */
const dangerSection = (w: ReturnType<typeof mount>) =>
  w.findAll('.k-section').find((s) => s.find('.k-set-card.k-set-danger').exists())!

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockAllOk()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 三层壳(蓝本 :2-4,逐层照抄)', () => {
  it('根 .k-view > .k-scroll > .k-scroll-inner,四块内容都在最内层', async () => {
    const { w } = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('k-view')
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
    // 本刀四块:服务卡 / 运行档卡 / 沙盒入口 / 危险区(两张 .k-set-card 在最内层直挂)
    // (子选择器写全路径 —— jsdom 的 querySelectorAll 不接受以 `>` 开头的相对选择器)
    expect(w.findAll('.k-scroll-inner > .k-set-card')).toHaveLength(2)
    expect(w.find('.k-scroll-inner > .k-sandbox-link').exists()).toBe(true)
    expect(w.find('.k-scroll-inner > .k-section').exists()).toBe(true)
  })

  it('不挂 .parser-app(治理 §6.1 落地约束 4:本页在 KnowledgeLayout 下,不自建滚动容器)', async () => {
    const { w } = await mountPage()
    expect(w.find('.parser-app').exists()).toBe(false)
    expect((w.element as HTMLElement).classList.contains('parser-app')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 服务卡两态(蓝本 :7-19)', () => {
  it('本机实测 paused:true —— 灯 data-state="paused"、文案「⏸ 已暂停」+ 副行、按钮 primary + play + 「恢复」', async () => {
    const { w } = await mountPage()
    const card = w.find('.k-set-card.k-set-svc')
    expect(card.exists()).toBe(true)
    expect(card.find('.k-svc-light').attributes('data-state')).toBe('paused')
    expect(card.find('.k-svc-name').text()).toBe('⏸ 已暂停')
    expect(card.find('.k-svc-cn').text()).toBe('新文件不会被自动收录')
    const btn = card.find('.k-svc-state button')
    expect(btn.classes()).toEqual(['k-btn', 'primary'])
    expect(btn.findComponent(KIcon).props('name')).toBe('play')
    expect(btn.findComponent(KIcon).props('size')).toBe(12)
    expect(btn.text()).toBe('恢复')
  })

  it('fixture 变体 paused:false —— 灯 data-state="running"、文案「✅ 运行中」+ 副行、按钮 outline + pause + 「暂停」', async () => {
    const { w } = await mountPage({ paused: false })
    const card = w.find('.k-set-card.k-set-svc')
    expect(card.find('.k-svc-light').attributes('data-state')).toBe('running')
    expect(card.find('.k-svc-name').text()).toBe('✅ 运行中')
    expect(card.find('.k-svc-cn').text()).toBe('正在持续监控并索引新文件')
    const btn = card.find('.k-svc-state button')
    expect(btn.classes()).toEqual(['k-btn', 'outline'])
    expect(btn.findComponent(KIcon).props('name')).toBe('pause')
    expect(btn.text()).toBe('暂停')
  })

  it('N16:`⏸` / `✅` 在 t() **里面** —— 键值自带 emoji(不是模板拼的)', () => {
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    expect(zh.aiKbSetSvcPausedLine).toBe('⏸ 已暂停')
    expect(zh.aiKbSetSvcRunningLine).toBe('✅ 运行中')
    expect(en.aiKbSetSvcPausedLine).toBe('⏸ Paused')
    expect(en.aiKbSetSvcRunningLine).toBe('✅ Running')
    // 反过来:按钮那两个键**不含**任何 emoji(符号一个都没往里挪)
    expect(zh.aiKbResume).toBe('恢复')
    expect(zh.aiKbPause).toBe('暂停')
    expect(zh.aiKbResume).not.toMatch(/[⏸✅▶🧪⚠]/u)
    expect(zh.aiKbPause).not.toMatch(/[⏸✅▶🧪⚠]/u)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 运行档 · 并发行(蓝本 :22-34)', () => {
  it('三行标题 / 中文行 / 描述逐字', async () => {
    const { w } = await mountPage()
    const row = knobRows(w)[0]!
    expect(row.find('.k-set-row-title').text()).toBe('同时处理几个文件')
    expect(row.find('.k-set-row-cn').text()).toBe('并发档位')
    expect(row.find('.k-set-row-desc').text()).toBe('数值越大越快、越占资源。NAS 空闲时建议 4。')
  })

  it('🔴 按钮文字**就是数字** —— 没有档位名称(`Power-saving`/`Balanced`/`Full power` 是 ParserStatus 的)', async () => {
    const { w } = await mountPage()
    const btns = concBtns(w)
    expect(btns).toHaveLength(3)
    expect(btns.map((b) => b.text())).toEqual(['1', '2', '4'])
    // 判据:若有人把 ParserStatus 那套 N17 数组下标写法搬过来,这四条会同时报红
    const page = w.text()
    for (const s of ['省电', '平衡', '全力', 'Power-saving', 'Balanced', 'Full power']) {
      expect(page).not.toContain(s)
    }
  })

  it('🔴 data-on 两侧 —— 本机 concurrency:2 时只有第二档是 "true"', async () => {
    const { w } = await mountPage()
    const btns = concBtns(w)
    expect(btns.map((b) => b.attributes('data-on'))).toEqual(['false', 'true', 'false'])
  })

  it('🔴 data-on 两侧 —— fixture 变体 concurrency:1 / concurrency:4', async () => {
    const { w } = await mountPage({ concurrency: 1 })
    expect(
      concBtns(w).map((b) => b.attributes('data-on')),
    ).toEqual(['true', 'false', 'false'])

    setActivePinia(createPinia())
    const { w: w4 } = await mountPage({ concurrency: 4 })
    expect(
      concBtns(w4).map((b) => b.attributes('data-on')),
    ).toEqual(['false', 'false', 'true'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 运行档 · 设备行(蓝本 :36-49)', () => {
  it('三行标题 / 中文行 + 三档文案(「自动」走 i18n,裸 GPU / CPU 是硬编码技术标识符)', async () => {
    const { w } = await mountPage()
    const row = knobRows(w)[1]!
    expect(row.find('.k-set-row-title').text()).toBe('推理设备')
    expect(row.find('.k-set-row-cn').text()).toBe('推理设备 · 仅维护者关心')
    expect(devBtns(w).map((b) => b.text())).toEqual(['自动', 'GPU', 'CPU'])
    // 蓝本 `:46-47` 那两串刻意不进 i18n(N22 同族)→ 源码里是**裸字面量**,不经 t()
    const src: string = readFileSync(SRC_PATH, 'utf8')
    expect(src).toContain('@click="setDevice(\'cuda\')">GPU<')
    expect(src).toContain('@click="setDevice(\'cpu\')">CPU<')
  })

  it('🔴 data-on 两侧 —— 本机 device:"auto" 时只有第一档 "true"', async () => {
    const { w } = await mountPage()
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['true', 'false', 'false'])
  })

  it('🔴 第二档吃 `cuda` **和** `gpu` 两个值(蓝本 :46)—— cuda 命中', async () => {
    const { w } = await mountPage({ device: 'cuda' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'true', 'false'])
  })

  it('🔴 第二档吃 `cuda` **和** `gpu` 两个值(蓝本 :46)—— gpu 也命中(漏掉后半会渲染成全 false)', async () => {
    const { w } = await mountPage({ device: 'gpu' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'true', 'false'])
  })

  it('🔴 data-on 两侧 —— device:"cpu" 时只有第三档 "true"', async () => {
    const { w } = await mountPage({ device: 'cpu' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'false', 'true'])
  })

  it('未知档位(后端将来加新值)—— 三档全 "false",不误亮', async () => {
    const { w } = await mountPage({ device: 'mps' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'false', 'false'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— deviceLabel 四分支 + 空值兜底(蓝本 :216-223)', () => {
  const label = (w: ReturnType<typeof mount>) =>
    norm(knobRows(w)[1]!.find('.k-set-row-desc').text())

  it('分支①`auto` —— 本机 resolved_device:"cpu" → 「当前用: 自动（当前 CPU）」(toUpperCase)', async () => {
    const { w } = await mountPage()
    expect(label(w)).toBe('当前用： 自动（当前 CPU）')
    expect(devLabelB(w).text()).toBe('自动（当前 CPU）')
  })

  it('分支①边界 —— resolved_device 为空串 → 渲染「自动（当前 ）」不炸', async () => {
    const { w } = await mountPage({ resolved_device: '' })
    expect(devLabelB(w).text()).toBe('自动（当前 ）')
  })

  it('🔴 分支①边界 —— 后端漏 `resolved_device` 字段时,蓝本的 `(r || "")` 兜底才真正起作用', async () => {
    // 判据:去掉 `(r || '')` → `undefined.toUpperCase()` 抛 TypeError → 本条报红。
    // (空串那条**验不到**这个兜底:`''.toUpperCase()` 本来就合法 —— 第一版就是只有空串那条,
    //  探针当场发现它对「删掉兜底」零判别力。)
    const { w } = await mountPage({ resolved_device: undefined as unknown as string })
    expect(devLabelB(w).text()).toBe('自动（当前 ）')
  })

  it('分支②`cuda` → 裸 `GPU (CUDA)`(注意与 setDevice toast 里那个裸 `GPU` 不同,蓝本两处不同)', async () => {
    const { w } = await mountPage({ device: 'cuda' })
    expect(devLabelB(w).text()).toBe('GPU (CUDA)')
  })

  it('分支②`gpu` 也走 `GPU (CUDA)`(蓝本 :220 的 `d === "cuda" || d === "gpu"`)', async () => {
    const { w } = await mountPage({ device: 'gpu' })
    expect(devLabelB(w).text()).toBe('GPU (CUDA)')
  })

  it('分支③`cpu` → 裸 `CPU`', async () => {
    const { w } = await mountPage({ device: 'cpu' })
    expect(devLabelB(w).text()).toBe('CPU')
  })

  it('分支④兜底 → 原样返回 `d`(不是空、不是 undefined)', async () => {
    const { w } = await mountPage({ device: 'mps' })
    expect(devLabelB(w).text()).toBe('mps')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 运行档 · OCR 行(蓝本 :51-60)', () => {
  it('标题 / 中文行 + `.warn` 警示行:句号与后半句的位置逐字照抄(蓝本 :56)', async () => {
    const { w } = await mountPage()
    const row = knobRows(w)[2]!
    expect(row.find('.k-set-row-title').text()).toBe('扫描件文字识别 (OCR)')
    expect(row.find('.k-set-row-cn').text()).toBe('扫描 PDF 文字识别 (OCR)')
    const warn = row.find('.k-set-row-desc .warn')
    expect(warn.exists()).toBe(true)
    expect(warn.findComponent(KIcon).props('name')).toBe('danger')
    expect(warn.findComponent(KIcon).props('size')).toBe(11)
    expect(norm(warn.text())).toBe('开启后速度慢 5-10×')
    // 句号在 `</span>` **外面**,后半句紧跟其后 —— 位置错了这条就红
    expect(norm(row.find('.k-set-row-desc').text())).toBe('开启后速度慢 5-10×. 只对扫描 PDF 有用。')
  })

  it('🔴 data-on 两侧 —— 本机 ocr_enabled:false → "false"', async () => {
    const { w } = await mountPage()
    expect(w.find('.k-sw').attributes('data-on')).toBe('false')
  })

  it('🔴 data-on 两侧 —— fixture 变体 ocr_enabled:true → "true"', async () => {
    const { w } = await mountPage({ ocr_enabled: true })
    expect(w.find('.k-sw').attributes('data-on')).toBe('true')
  })

  it('🔴 `!!` 双取反照抄(蓝本 :59)—— 后端漏 `ocr_enabled` 字段时仍是 "false",不是 "undefined"', async () => {
    // 判据:去掉 `!!` → `String(undefined)` === "undefined" → 本条报红
    // (`.k-sw[data-on="true"]` 是 CSS 选择器,`"undefined"` 会让开关卡在灰档且语义不明)
    const { w } = await mountPage({ ocr_enabled: undefined as unknown as boolean })
    expect(w.find('.k-sw').attributes('data-on')).toBe('false')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 四个动作各自的 setControl 载荷(蓝本 :282-315)', () => {
  it('paused:true 点按钮 → setControl("resume")', async () => {
    const { w } = await mountPage()
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledTimes(1)
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'resume' })
  })

  it('paused:false 点按钮 → setControl("pause")', async () => {
    const { w } = await mountPage({ paused: false })
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
  })

  it('🔴 并发 → setControl("set_concurrency", { n })—— 键名是 `n`,不是 `concurrency`', async () => {
    const { w } = await mountPage()
    await concBtns(w)[2]!.trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_concurrency', n: 4 })
  })

  it('设备三档 → setControl("set_device", { device })', async () => {
    const { w } = await mountPage()
    const btns = devBtns(w)
    await btns[0]!.trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_device', device: 'auto' })
    await btns[1]!.trigger('click')
    await flushPromises()
    // 第二个按钮点下去发的是 `cuda`(不是 `gpu`)—— 蓝本 :46 的 @click 是 setDevice('cuda')
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_device', device: 'cuda' })
    await btns[2]!.trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_device', device: 'cpu' })
  })

  it('OCR 开关 → setControl("set_ocr", { enabled: !当前值 })两侧', async () => {
    const { w } = await mountPage()
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: true })

    setActivePinia(createPinia())
    const { w: w2 } = await mountPage({ ocr_enabled: true })
    await w2.find('.k-sw').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: false })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 成功 toast 各自的键(蓝本 :285/:293/:302/:311)', () => {
  it('🔴 恢复 → 「已继续」(不是「已暂停」)—— 见文件头「偏离,§2」:蓝本这里两档全反', async () => {
    // 关键前提:`setControl` 内部 `await loadOverview()` 会把 controlState 换成**新值**。
    // 这里让第二次 `parserState` 返回 `paused:false`(后端真的恢复了)—— 蓝本的写法此时
    // 读到的是新值 false → 会弹「已暂停」;本仓用 `await` 之前存下的 `wasPaused` → 「已继续」。
    // 判据:把 `wasPaused` 换回蓝本的「await 之后再读 controlState.paused」→ 本条报红。
    ai.parserState.mockResolvedValueOnce(STATE).mockResolvedValue({ ...STATE, paused: false })
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(store.controlState.paused).toBe(false) // 后端已刷新(前提成立)
    expect(toast).toHaveBeenCalledWith('已继续')
  })

  it('🔴 暂停 → 「已暂停」(同上,反向)', async () => {
    // 🔴 不能走 `mountPage({ paused: false })`:那个参数内部会再调一次
    // `mockResolvedValue`,把这里排好的「第二发返回 paused:true」冲掉。
    ai.parserState
      .mockResolvedValueOnce({ ...STATE, paused: false })
      .mockResolvedValue({ ...STATE, paused: true })
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(store.controlState.paused).toBe(true)
    expect(toast).toHaveBeenCalledWith('已暂停')
  })

  it('并发 → 「并发改为 4」(`aiKbSetConcurrencySet` 带 {n})', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await concBtns(w)[2]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledWith('并发改为 4')
  })

  it('设备 → 「推理设备：自动 / CPU / GPU」(label 三元照抄:auto 走 i18n,另两个裸串)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    const btns = devBtns(w)
    await btns[0]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('推理设备：自动')
    await btns[2]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('推理设备：CPU')
    await btns[1]!.trigger('click')
    await flushPromises()
    // 🔴 裸 `GPU`,**不是** deviceLabel 里的 `GPU (CUDA)` —— 蓝本 :301 与 :220 刻意不同
    expect(toast).toHaveBeenLastCalledWith('推理设备：GPU')
  })

  it('OCR → 「OCR 已开启」/「OCR 已关闭」两侧', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('OCR 已开启')

    setActivePinia(createPinia())
    const { w: w2, store: s2 } = await mountPage({ ocr_enabled: true })
    const toast2 = vi.spyOn(s2, 'toast')
    await w2.find('.k-sw').trigger('click')
    await flushPromises()
    expect(toast2).toHaveBeenLastCalledWith('OCR 已关闭')
  })

  it('toast 走 store.toast(K27)→ 真的落进全局 toast 栈(2400ms 档,knowledgeStore.ts:311-313)', async () => {
    const { w } = await mountPage()
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(useToast().toasts.map((x) => x.text)).toEqual(['OCR 已开启'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K30(K5 同族)—— 四个 catch **不回显后端文本**。落地判据是**排除式断言**:
// 让 `parserControl` reject 一个带可识别文本的错误,断言 toast 文本、全局 toast 栈、
// 整页 DOM 三处都**不含**那段文本,且 toast **逐字**等于固定键的值。
// ⚠️ 探针文本只出现在本文件里,**故意不出现在 `SettingsView.vue` 的注释里**
// (治理 §9 第九条:否定式断言撞注释 = 假报红,T6 栽过一次)。
describe('SettingsView —— K30:四个 catch 的排除式断言(蓝本 :287/:295/:304/:313 拼 e.message)', () => {
  const PROBE = 'PROBE-BACKEND-DETAIL-7c41f9'

  async function failing(state?: Partial<ParserControlState>) {
    const mounted = await mountPage(state)
    ai.parserControl.mockRejectedValue(new Error(PROBE))
    const toast = vi.spyOn(mounted.store, 'toast')
    return { ...mounted, toast }
  }

  function assertNoLeak(w: ReturnType<typeof mount>, toast: { mock: { calls: unknown[][] } }): void {
    const calls = toast.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls.join(' | ')).not.toContain(PROBE)
    expect(useToast().toasts.map((x) => x.text).join(' | ')).not.toContain(PROBE)
    expect(w.text()).not.toContain(PROBE)
    expect(w.html()).not.toContain(PROBE)
  }

  it('catch① togglePause → 只弹「操作失败」,零后端文本', async () => {
    const { w, toast } = await failing()
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('操作失败')
    assertNoLeak(w, toast)
  })

  it('catch② setConcurrency → 只弹「操作失败」,零后端文本', async () => {
    const { w, toast } = await failing()
    await concBtns(w)[0]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('操作失败')
    assertNoLeak(w, toast)
  })

  it('catch③ setDevice → 只弹「切换失败」(专属键,不是「操作失败」),零后端文本', async () => {
    const { w, toast } = await failing()
    await devBtns(w)[2]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('切换失败')
    expect(toast).not.toHaveBeenCalledWith('操作失败')
    assertNoLeak(w, toast)
  })

  it('catch④ toggleOcr → 只弹「操作失败」,零后端文本', async () => {
    const { w, toast } = await failing()
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('操作失败')
    assertNoLeak(w, toast)
  })

  it('源码侧:每个 catch 都不读 `e`(零 `e.message` / 零 `e.response` / 零 `e.detail`)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).not.toMatch(/\.message\b/)
    expect(code).not.toMatch(/\.response\b/)
    expect(code).not.toMatch(/\.detail\b/)
    // 全部 catch 都是无参 `catch {`(连错误对象都不接)。
    // 🔴 E-23(T9 被迫改的**计数**,断言语义未变):T8 时 4 个(togglePause /
    // setConcurrency / setDevice / toggleOcr),T9 下半再加 4 个(created 的 getSettings
    // 吞错保默认 / onPick / toggleAutoExtract / applyRoot)→ 共 8 个。
    expect((code.match(/\}\s*catch\s*\{/g) || []).length).toBe(8)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 沙盒入口(蓝本 :158-166)', () => {
  it('图标 / 文案 / 副行 / 末尾 chev 逐字(N16:🧪 在 t() 外面)', async () => {
    const { w } = await mountPage()
    const link = w.find('a.k-sandbox-link')
    expect(link.exists()).toBe(true)
    const icons = link.findAllComponents(KIcon)
    expect(icons).toHaveLength(2)
    expect(icons[0]!.props('name')).toBe('test')
    expect(icons[0]!.props('size')).toBe(20)
    expect(link.find('.k-sandbox-icon').exists()).toBe(true)
    // ⚠️ `.text()` 取的是 textContent —— 相邻 <div> 之间**没有**空格,别自己补
    expect(norm(link.text())).toBe('🧪 测试沙盒单文件试解析，不写入索引')
    expect(icons[1]!.props('name')).toBe('chev')
    expect(icons[1]!.props('size')).toBe(14)
    expect(icons[1]!.props('color')).toBe('var(--text-tertiary)')
  })

  it('点一下 → router.push("/ai/parser/test")(蓝本 :316-319)', async () => {
    const { w, router } = await mountPage()
    const push = vi.spyOn(router, 'push')
    await w.find('a.k-sandbox-link').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/ai/parser/test')
    expect(router.currentRoute.value.path).toBe('/ai/parser/test')
  })

  it('`@click.prevent` —— 是裸 `<a>`(无 href),不会触发浏览器导航', async () => {
    const { w } = await mountPage()
    const a = w.find('a.k-sandbox-link')
    expect((a.element as HTMLElement).hasAttribute('href')).toBe(false)
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    ;(a.element as HTMLElement).dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView —— 危险区(蓝本 :168-186)', () => {
  it('区头:⚠️ 标题(内联 var(--danger))+ 「即将上线」提示', async () => {
    const { w } = await mountPage()
    // 🔴 E-22(T9 插入笔记区后被迫改的**定位器**,断言值一字未动):`.k-section` 现在有
    // **两个**(笔记区在前、危险区在后),原来的 `w.find('.k-section .k-section-head')`
    // 会先命中笔记区。改成按语义定位(带 `.k-set-danger` 卡的那个 section),不用下标。
    const head = dangerSection(w).find('.k-section-head')
    const title = head.find('.k-section-title')
    expect(title.text()).toBe('⚠️ 危险区')
    // Vue 会把静态 style 属性重新序列化,故用 toContain 钉 token(内联值本来就已是 var(),零字面量)
    expect(title.attributes('style')).toContain('var(--danger)')
    expect(head.find('.k-section-hint').text()).toBe('即将上线')
  })

  it('🔴 重建按钮硬编码 disabled(蓝本 :181,永远不可点)+ 旁边有「即将上线」徽标', async () => {
    const { w } = await mountPage()
    const card = w.find('.k-set-card.k-set-danger')
    expect(card.exists()).toBe(true)
    expect(card.find('.k-set-row-title').text()).toBe('重建全部索引 即将上线')
    expect(card.find('.k-set-soon').text()).toBe('即将上线')
    expect(card.find('.k-set-row-cn').text()).toBe('重建全部索引')
    expect(card.find('.k-set-row-desc').text()).toBe('会丢弃现有索引重新扫描所有文件')
    const btn = card.find('button.k-btn.danger')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.findComponent(KIcon).props('name')).toBe('danger')
    expect(btn.text()).toBe('重建…')
  })

  it('点它什么都不发生(治理 §13:清单只能验「是灰的 + 有徽标」)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('button.k-btn.danger').trigger('click')
    await flushPromises()
    expect(ai.parserControl).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 治理 §9.2 —— 「必须用键 A、不许用键 B,理由是 en 不同」这类纪律,**只比 zh 的断言
// 零判别力**(T6 评审 I-1 实证:换成被禁键 47/47 全绿)。本页命中 **4 对**同族:
//   ① N21 #1  aiKbResume           en `Resume`        zh 恢复      ← 本页必须用
//              aiKbRebuild          en `Rebuild`       zh 恢复      ← 被禁(Vue2 错译)
//   ② N21 #2  aiKbSetSandboxTitle  en `Test Sandbox`  zh 测试沙盒  ← 本页必须用
//              aiKbPrTestLink       en `Test sandbox`  zh 测试沙盒  ← ParserStatus 的
//   ③ 🔴 T8 全表重扫新发现:aiKbDeviceAuto en `Auto` / aiCfgAutoPlaceholder en `auto`(小写)
//   ④ 🔴 T8 全表重扫新发现:aiKbSwitchFailed en `Switch failed` / aiCfgToggleFailed en `Toggle failed`
// 重扫方法与完整结论见 T8 报告 §6(本页 33 个键 × 全表 1499 键,zh 撞车 15 对,
// 其中 en 不同的 4 对全部落在本组断言里,余零)。
// 🔴 locale 是全局单例 → 必须 try/finally 还原,否则污染同文件后续用例。
describe('SettingsView —— 🔴 §9.2:en 档强断言(zh 撞车、只有 en 能判别)', () => {
  const localeRef = i18n.global.locale as unknown as { value: string }

  async function mountInEn(state?: Partial<ParserControlState>) {
    const prev = localeRef.value
    localeRef.value = 'en_us'
    try {
      const m = await mountPage(state)
      return { ...m, restore: () => { localeRef.value = prev } }
    } catch (e) {
      localeRef.value = prev
      throw e
    }
  }

  it('①正向:en 档恢复按钮逐字 `Resume`;反向:整页不出现 `Rebuild`(=aiKbRebuild 的 en 值)', async () => {
    const { w, restore } = await mountInEn()
    try {
      expect(w.find('.k-svc-state button').text()).toBe('Resume')
      expect(w.find('.k-svc-state button').text()).not.toBe('Rebuild')
      // 整页也扫一遍(危险区那句 `Rebuild all indexes` 是 aiKbSetRebuildAll,不是裸 `Rebuild`)
      expect(w.find('.k-svc-state').text()).not.toContain('Rebuild')
    } finally {
      restore()
    }
  })

  it('①另一侧:paused:false 时 en 档按钮逐字 `Pause`', async () => {
    const { w, restore } = await mountInEn({ paused: false })
    try {
      expect(w.find('.k-svc-state button').text()).toBe('Pause')
    } finally {
      restore()
    }
  })

  it('②正向:en 档沙盒标题逐字 `Test Sandbox`(大写 S);反向:不等于 `Test sandbox`(=aiKbPrTestLink)', async () => {
    const { w, restore } = await mountInEn()
    try {
      // `<a>` 的第 2 个直接子 div 是文案列,其第 1 个 div 是标题行(第 1 个子 div 是图标)
      const line = w.findAll('a.k-sandbox-link > div')[1]!.findAll('div')[0]!.text()
      expect(line).toBe('🧪 Test Sandbox')
      expect(line).not.toContain('Test sandbox')
      expect(norm(w.find('a.k-sandbox-link').text())).toBe(
        '🧪 Test SandboxParse a single file without touching the index',
      )
    } finally {
      restore()
    }
  })

  it('③正向:en 档设备第一档逐字 `Auto`(大写 A);反向:不是 `auto`(=aiCfgAutoPlaceholder 的 en 值)', async () => {
    const { w, restore } = await mountInEn()
    try {
      const first = devBtns(w)[0]!
      expect(first.text()).toBe('Auto')
      expect(first.text()).not.toBe('auto')
      // 同族证据:两个键 zh 逐字相同、en 只差首字母大小写 → 只有 en 档能判别
      expect((zhCn as Record<string, string>).aiCfgAutoPlaceholder).toBe(
        (zhCn as Record<string, string>).aiKbDeviceAuto,
      )
      expect((enUs as Record<string, string>).aiCfgAutoPlaceholder).toBe('auto')
    } finally {
      restore()
    }
  })

  it('④正向:en 档 setDevice 失败 toast 逐字 `Switch failed`;反向:不是 `Toggle failed`(=aiCfgToggleFailed)', async () => {
    const { w, store, restore } = await mountInEn()
    try {
      ai.parserControl.mockRejectedValue(new Error('boom'))
      const toast = vi.spyOn(store, 'toast')
      await devBtns(w)[2]!.trigger('click')
      await flushPromises()
      expect(toast).toHaveBeenCalledWith('Switch failed')
      expect(toast).not.toHaveBeenCalledWith('Toggle failed')
      expect((zhCn as Record<string, string>).aiCfgToggleFailed).toBe(
        (zhCn as Record<string, string>).aiKbSwitchFailed,
      )
      expect((enUs as Record<string, string>).aiCfgToggleFailed).toBe('Toggle failed')
    } finally {
      restore()
    }
  })

  it('切回 zh 后服务卡仍是「恢复」(证明 locale 已还原、无污染)', async () => {
    const { w } = await mountPage()
    expect(w.find('.k-svc-state button').text()).toBe('恢复')
  })

  // 🔴 裁定 A-1(设备「自动」用 `aiKbDeviceAuto`,不复用 `aiKbOriginAuto`)的守卫**只能落在
  // 源码上**:两个键 en 与 zh **双双逐字相同**(`Auto` / `自动`)→ 任何渲染断言都没有判别力。
  // ⚠️ 断言必须钉「`t()` 调用形状」而不是裸子串:本页与本文件的注释里都写着「不复用
  // `aiKbOriginAuto`」,`not.toContain('aiKbOriginAuto')` 会撞上注释而**假报红**
  // (治理 §9 第九条,T6 栽过)。故先 `blankComments()` 再钉调用形状。
  it('🔴 A-1:模板用 `t(\'aiKbDeviceAuto\')`,零 `t(\'aiKbOriginAuto\')` 调用', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).toContain("t('aiKbDeviceAuto')")
    expect(code).not.toMatch(/\bt\(\s*['"]aiKbOriginAuto['"]/)
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    // 实证「为什么必须走源码」:两档都同值,渲染永远分不出来
    expect(zh.aiKbDeviceAuto).toBe(zh.aiKbOriginAuto)
    expect(en.aiKbDeviceAuto).toBe(en.aiKbOriginAuto)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 守卫缺口③ / ③′ —— 「模板零裸色」。
// 🔴 本文件**不复制**那个脆弱的非贪婪正则(治理 §9 缺口③′ 明令「别再复制」);
//   `.vue` 侧的模板零裸色守卫已由 T8 在 `src/ai/styles/knowledgeStyles.test.ts` 里
//   **统一改成贪婪匹配 + 覆盖度自检**,并对 `src/ai/knowledge/**/*.vue` 逐个扫描
//   (本文件对应的 `SettingsView.vue` 在那份清单里)。
//   这里只留两条本文件独有的、与那条中央守卫不重复的断言。
describe('SettingsView —— 零 <style> 块 + 全文件零色字面量', () => {
  it('零 `<style>` 块(设置页整段 scss 由 T2a 搬进 knowledge.scss,本文件不 import 样式)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    expect(src).not.toMatch(/^<style/m)
    expect(src).not.toContain("import '../../styles/")
  })

  it('🔴 整个文件(含注释,剥掉 var()/color-mix() 之后)零 hex / rgb / hsl —— 比只扫模板更严', () => {
    // 本文件零 `<style>` 块 → 全文件扫描是「模板零裸色」的**严格超集**,而且不需要任何
    // `<template>` 边界锚定(缺口③′ 的成因就是那个锚定)。治理 §6 R5:注释里也不许有色字面量。
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const scrubbed = stripCalls(src, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
    expect(scrubbed).not.toMatch(/\b(white|black|red|green|blue|orange|gray|grey)\b/i)
  })
})

// ── 小工具(与 `knowledgeStyles.test.ts` / `ParserStatus.test.ts` 同款手法)──

/**
 * 「保行版」剥注释(治理 §9 第八条):注释内容换成等量空格,**保留所有换行** ——
 * 删除式剥注释会把换行也吃掉,让报出来的行号偏移几十行。
 * 覆盖 `<!-- -->`(SFC 模板/文件头)· `/* *\/`(JSDoc)· `//`(行注释)。
 */
function blankComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length))
}

/** 逐字符扫描配对括号,整段剥掉 `var(...)` / `color-mix(...)`(支持嵌套 fallback)。 */
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

// ═══════════════════════════════════════════════════════════════════════════
// ═════════════════ 以下为 T9(蓝本下半:笔记区 + 迁移弹窗)═════════════════
// ═══════════════════════════════════════════════════════════════════════════

/**
 * K29 / P5b 交接项 #3 —— `DialogPortal to=".knowledge-app"` 的宿主。
 * `SettingsView` 单独挂载时不在 `.knowledge-app` 子树里(生产环境宿主由
 * `KnowledgeLayout.vue` 提供),测试必须自己在 body 里放一个同名宿主。
 * 🔴 **`to` 只认第一个同名宿主** → 每个用例只放一个;`afterEach` 里的
 * `document.body.innerHTML = ''` 负责清掉,不会串到下一条。
 * 先例:`QueueView.test.ts` 的 `withHost()`。
 */
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** 可控 promise —— 交错路径用(同 `FolderBrowser.test.ts` 的手法)。 */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type DirInfo = { exists: boolean; empty: boolean }

// ── 下半的定位小工具 ──
// `.k-set-card` 的下标:0 服务卡 / 1 运行档卡 / **2 笔记卡** / 3 危险区卡。
const notesCard = (w: ReturnType<typeof mount>) => w.findAll('.k-set-card')[2]!
const notesRows = (w: ReturnType<typeof mount>) => notesCard(w).findAll('.k-set-row')
const folderRow = (w: ReturnType<typeof mount>) => notesRows(w)[0]!
const captureRow = (w: ReturnType<typeof mount>) => notesRows(w)[1]!
/** 「更改 / 取消」按钮 —— 折叠区展开时行内还有两个动作按钮,它恒是**最后**一个。 */
const changeBtn = (w: ReturnType<typeof mount>) => {
  const bs = folderRow(w).findAll('button')
  return bs[bs.length - 1]!
}
const adoptBtn = (w: ReturnType<typeof mount>) =>
  folderRow(w).find('.kn-pick-actions button.k-btn.primary')
const moveBtn = (w: ReturnType<typeof mount>) =>
  folderRow(w).find('.kn-pick-actions button.k-btn.outline')
const badge = (w: ReturnType<typeof mount>) => folderRow(w).find('.kn-badge')
const fbRows = (w: ReturnType<typeof mount>) => folderRow(w).findAll('.fb-row')
const captureSw = (w: ReturnType<typeof mount>) => captureRow(w).find('.k-sw')
const isDisabled = (x: { element: Element }) => (x.element as HTMLButtonElement).disabled

/** 点「更改」展开折叠区(等 `loadCandidates` 与 `nextTick` 里的 `fb.reset()` 都落地)。 */
async function openPicker(w: ReturnType<typeof mount>): Promise<void> {
  await changeBtn(w).trigger('click')
  await flushPromises()
  await nextTick()
}

/** 在 `FolderBrowser` 根层点第 `idx` 个卷 → 触发 `@pick`(真 DOM 路径,不是手 emit)。 */
async function pickRoot(w: ReturnType<typeof mount>, idx = 0): Promise<void> {
  await fbRows(w)[idx]!.trigger('click')
  await flushPromises()
}

/** 回到 `FolderBrowser` 根层(点第一个面包屑,`go('')` 不 emit pick、不发请求)。 */
async function backToRoot(w: ReturnType<typeof mount>): Promise<void> {
  await folderRow(w).findAll('.fb-crumb')[0]!.trigger('click')
  await flushPromises()
}

/** 勾上迁移确认框(`v-model` 监听 change)。 */
async function tickAck(host: HTMLElement): Promise<void> {
  const check = host.querySelector('.kn-checkline input') as HTMLInputElement
  check.checked = true
  check.dispatchEvent(new Event('change'))
  await nextTick()
}

const dangerFootBtn = (host: HTMLElement) =>
  host.querySelector('.k-modal-foot button.k-btn.danger') as HTMLButtonElement

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 治理 §4.1 —— mock **层次**的守卫(评审「缺口猎①」,本期第 5 次「产品代码对、守卫为零」)。
// 评审探针:把 `notes.getSettings` 的 mock **多带** `distill_roots` / `distill_daily_cap` /
// `background_model` → **112/112 全绿**。即「camelCase 且**恰好两个字段**」这一半此前只由台账里
// 的 `p5c-task-9-fixture-verify.mjs` 守,**不进三门** → 谁把 fixture 抄本改成 HTTP 原样
// snake_case、或顺手多带几个字段,三门抓不到。这里把键集钉成集合相等断言。
describe('SettingsView/T9 —— §4.1:fixture 抄本的 mock 层次(键集相等)', () => {
  it('🔴 notes 两份抄本是**降层后**的形状:键集恰好相等,一个都不多不少', () => {
    // `service.notes.getSettings/putSettings` 包内走 `normalizeSettings`
    // (`NimoOS-Service/src/notes.ts:131-137`)→ **camelCase 且只有这两个键**;
    // HTTP 层那三个 `distill_roots` / `distill_daily_cap` / `background_model` 被它丢掉了。
    expect(Object.keys(NOTES_SETTINGS)).toEqual(['notesRoot', 'autoExtract'])
    // `dirInfo`(`notes.ts:264-267`)只做 `!!` 归一,键名/层次不变。
    expect(Object.keys(DIR_INFO_NOTES)).toEqual(['exists', 'empty'])
    // 反向:snake_case 一个都不许出现在抄本里(写成 HTTP 原样就是错的层次)
    for (const k of [...Object.keys(NOTES_SETTINGS), ...Object.keys(DIR_INFO_NOTES)]) {
      expect(k).not.toContain('_')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— 笔记区静态渲染(蓝本 :63-102)', () => {
  it('区头:📝 标题 + 提示(N16:emoji 在 t() 外面)', async () => {
    const { w } = await mountPage()
    // 笔记区是第一个 .k-section(危险区在沙盒入口之后)
    const sec = w.findAll('.k-section')[0]!
    expect(sec.find('.k-section-title').text()).toBe('📝 知识笔记')
    expect(sec.find('.k-section-hint').text()).toBe('笔记 = 磁盘上的 Markdown 文件')
    // 反向:那个键本身**不含** emoji(一个符号都没往 t() 里挪)
    const zh = zhCn as Record<string, string>
    expect(zh.aiKbSetNotesSection).toBe('知识笔记')
    expect(zh.aiKbSetNotesSection).not.toMatch(/[📝⏸✅🧪⚠]/u)
  })

  it('笔记目录行:标题 / 中文行 / 描述 + <code> 显示 fixture 的 notesRoot', async () => {
    const { w } = await mountPage()
    const row = folderRow(w)
    expect(row.find('.k-set-row-title').text()).toBe('笔记目录')
    expect(row.find('.k-set-row-cn').text()).toBe('笔记 Markdown 文件的存放位置')
    expect(row.find('.k-set-row-desc code').text()).toBe('/DATA/Notes')
    // 破折号与后半句的位置逐字照抄蓝本 :77
    expect(norm(row.find('.k-set-row-desc').text())).toBe(
      '/DATA/Notes — 每个用户一个子目录;文件是纯 Markdown。',
    )
    // 折叠区默认收起 → 没有 FolderBrowser、没有两个动作按钮
    expect(row.find('.fb').exists()).toBe(false)
    expect(row.find('.kn-pick-actions').exists()).toBe(false)
    expect(changeBtn(w).classes()).toEqual(['k-btn', 'outline'])
    expect(changeBtn(w).text()).toBe('更改')
  })

  it('🔴 N7 同族:notesRoot 为空串时走 `|| "/DATA/Notes"` 兜底(不是渲染成空)', async () => {
    // 判据:删掉 `|| '/DATA/Notes'` → <code> 变空 → 本条报红
    notes.getSettings.mockResolvedValue({ notesRoot: '', autoExtract: true })
    const { w } = await mountPage()
    await flushPromises()
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA/Notes')
  })

  it('🔴 created 的 catch 吞错保默认:getSettings reject 时页面照样渲染 + 走兜底', async () => {
    // 蓝本 `:229` 的 `catch (e) { /* keep defaults */ }`。判据:改成弹 toast / 抛出去 → 报红。
    notes.getSettings.mockRejectedValue(new Error('boom'))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await flushPromises()
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA/Notes')
    expect(captureSw(w).attributes('data-on')).toBe('true') // 默认 autoExtract: true
    expect(toast).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— 自动捕获行两态(蓝本 :104-116)', () => {
  it('标题 / 中文行 / 描述逐字;本机 auto_extract:true → 开关绿档、`.warn` 行**不渲染**', async () => {
    const { w } = await mountPage()
    const row = captureRow(w)
    expect(row.find('.k-set-row-title').text()).toBe('自动沉淀对话洞见')
    expect(row.find('.k-set-row-cn').text()).toBe('对话洞见自动沉淀')
    expect(norm(row.find('.k-set-row-desc').text())).toBe(
      '会话空闲后,值得保留的结论会自动存为「AI 草稿」笔记,等你确认。',
    )
    expect(captureSw(w).attributes('data-on')).toBe('true')
    // 治理 §13:本机数据下这一行不渲染,是**正确行为**
    expect(row.find('.k-set-row-desc .warn').exists()).toBe(false)
  })

  it('autoExtract:false → 开关灰档 + `.warn` 提示行渲染(含 danger 图标与文案)', async () => {
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: false })
    const { w } = await mountPage()
    await flushPromises()
    expect(captureSw(w).attributes('data-on')).toBe('false')
    const warn = captureRow(w).find('.k-set-row-desc .warn')
    expect(warn.exists()).toBe(true)
    expect(warn.findComponent(KIcon).props('name')).toBe('danger')
    expect(warn.findComponent(KIcon).props('size')).toBe(11)
    expect(norm(warn.text())).toBe('已关闭 — 排队中的草稿也会被丢弃')
  })

  it('🔴 `!!` 双取反照抄(蓝本 :115)—— autoExtract 缺席时是 "false",不是 "undefined"', async () => {
    // 判据:去掉 `!!` → `String(undefined)` === "undefined" → 本条报红。
    notes.getSettings.mockResolvedValue({
      notesRoot: '/DATA/Notes',
      autoExtract: undefined,
    } as unknown as NotesSettings)
    const { w } = await mountPage()
    await flushPromises()
    expect(captureSw(w).attributes('data-on')).toBe('false')
  })

  it('autoExtract 为 true 时开关绿档且 `.warn` 行不渲染(蓝本 data() 默认值那一侧)', async () => {
    // 🔴 **本条只声明组件层语义,不再声明「归一化」**(评审 I-1:原用例名写的
    //   「后端漏 `auto_extract` → 包内 `r.auto_extract !== false` 归一成 true」**零判别力** ——
    //   mock 打在**包边界**上,`normalizeSettings` 根本不进回路,本条与上一条的红/绿表现完全相同)。
    //   那条不变量**归上游守**:`NimoOS-Service/src/notes.test.ts:198-203`;评审变异实测
    //   「改 Service 的 `normalizeSettings` → New-UI 112/112 全绿、上游那条报红」。
    //   本仓字面上也补不了:`normalizeSettings` 没从包 index 导出。
    //   → 组件侧能验的就只有「拿到 `true` 就渲染成开」这一条,本条只声明它。
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: true })
    const { w } = await mountPage()
    await flushPromises()
    expect(captureSw(w).attributes('data-on')).toBe('true')
    expect(captureRow(w).find('.warn').exists()).toBe(false)
  })

  it('点开关 → putSettings({ autoExtract: false })(载荷只带这一个字段)+ toast「已关闭」+ 开关翻档', async () => {
    notes.putSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: false })
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await captureSw(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).toHaveBeenCalledTimes(1)
    expect(notes.putSettings).toHaveBeenCalledWith({ autoExtract: false })
    expect(toast).toHaveBeenCalledWith('自动沉淀已关闭')
    expect(captureSw(w).attributes('data-on')).toBe('false')
    expect(captureRow(w).find('.warn').exists()).toBe(true)
  })

  it('反向:autoExtract:false 时点开关 → putSettings({ autoExtract: true }) + toast「已开启」', async () => {
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: false })
    notes.putSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: true })
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await captureSw(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).toHaveBeenCalledWith({ autoExtract: true })
    expect(toast).toHaveBeenCalledWith('自动沉淀已开启')
    expect(captureSw(w).attributes('data-on')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— openRootPicker(蓝本 :232-240,承接 Vue2 既有单测两条行为)', () => {
  it('点「更改」展开:按钮变 ghost + 文案变「取消」、FolderBrowser 出现、loadCandidates 被调', async () => {
    const { w } = await mountPage()
    expect(wiki.getCandidates).not.toHaveBeenCalled()
    await openPicker(w)
    expect(changeBtn(w).classes()).toEqual(['k-btn', 'ghost'])
    expect(changeBtn(w).text()).toBe('取消')
    expect(folderRow(w).find('.fb').exists()).toBe(true)
    // ⚠️ 交接项 #7:`loadCandidates()` **不传 silent**(蓝本也不传参)
    expect(wiki.getCandidates).toHaveBeenCalledTimes(1)
    expect(wiki.getCandidates).toHaveBeenCalledWith()
  })

  it('本机 wiki/candidates = [] → 根层走 pickerRoots 的兜底三根(K1:store.wikiCandidates)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(fbRows(w).map((r) => r.find('.fb-name').text())).toEqual([
      'System (/DATA)',
      '/media',
      '/mnt',
    ])
  })

  it('候选非空时根层用候选(证明 browserRoots 真读的是 store.wikiCandidates)', async () => {
    wiki.getCandidates.mockResolvedValue([
      { path: '/mnt/pool', type: 'volume', label: 'Pool' },
      { path: '/mnt/bare', type: 'volume' },
    ])
    const { w } = await mountPage()
    await openPicker(w)
    // 第二项没有 label → FolderBrowser 模板的 `r.label || r.path` 兜底
    expect(fbRows(w).map((r) => r.find('.fb-name').text())).toEqual(['Pool', '/mnt/bare'])
  })

  it('再点一次收起(承接 Vue2 spec「再点一次关闭不抛错」)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    await changeBtn(w).trigger('click')
    await flushPromises()
    expect(folderRow(w).find('.fb').exists()).toBe(false)
    expect(changeBtn(w).text()).toBe('更改')
    // 关闭那次**不**再拉候选(蓝本的 if 只在打开分支里)
    expect(wiki.getCandidates).toHaveBeenCalledTimes(1)
  })

  it('🔴 承接 Vue2 spec「重开时清掉上次的 path」—— 连带清掉上次的 dirProbe 徽标', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/DATA')
    expect(badge(w).exists()).toBe(true)
    // 收起 → 重开
    await changeBtn(w).trigger('click')
    await flushPromises()
    await openPicker(w)
    // 判据:删掉 `rootPicker.path = ''` → .kn-picked 还在 → 报红;
    //       删掉 `dirProbe = { state: '', … }` → 徽标还在 → 也报红
    expect(folderRow(w).find('.kn-picked').exists()).toBe(false)
    expect(badge(w).exists()).toBe(false)
    expect(wiki.getCandidates).toHaveBeenCalledTimes(2)
  })

  it('🔴 展开时下一帧调 FolderBrowser 的 reset()(蓝本 :238 的 $nextTick + $refs.fb 守卫)', async () => {
    // 只有这一条把 FolderBrowser 换成 stub —— 它是唯一需要观测 `fb.value.reset()` 被调用的
    // 用例;其余用例一律用**真** FolderBrowser(pick 路径要走真组件)。
    const resetSpy = vi.fn()
    const router = makeRouter()
    await router.isReady()
    const store = useKnowledgeStore()
    await store.loadOverview()
    const w = mount(SettingsView, {
      global: {
        plugins: [router, i18n],
        stubs: {
          FolderBrowser: {
            name: 'FolderBrowser',
            template: '<div class="fb fb-stubbed" />',
            methods: { reset: resetSpy },
          },
        },
      },
    } as never)
    mountedWrappers.push(w)
    await nextTick()
    await flushPromises()
    expect(resetSpy).not.toHaveBeenCalled()
    await changeBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    expect(w.find('.fb-stubbed').exists()).toBe(true)
    expect(resetSpy).toHaveBeenCalledTimes(1)
    // 收起那一次**不**调 reset(蓝本的 if 只在打开分支里)
    await changeBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— dirProbe 四态徽标 + migratable 判据三组合(蓝本 :83-85 / :248)', () => {
  it('①loading —— [data-s="archived"]「检查中…」(探针在飞时)', async () => {
    const d = makeDeferred<DirInfo>()
    notes.dirInfo.mockReturnValue(d.promise)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('archived')
    expect(badge(w).text()).toBe('检查中…')
    d.resolve({ exists: false, empty: false })
    await flushPromises()
  })

  it('②done + migratable(目录**不存在**)—— [data-s="curated"]「空目录 · 可迁移」', async () => {
    notes.dirInfo.mockResolvedValue({ exists: false, empty: false })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('curated')
    expect(badge(w).text()).toBe('空目录 · 可迁移')
  })

  it('②done + migratable(目录**存在且空**)—— 同一档', async () => {
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('curated')
  })

  it('③done + !migratable(本机 /DATA/Notes fixture:存在且非空)—— [data-s="draft"]「非空目录 — 只能指向」', async () => {
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('draft')
    expect(badge(w).text()).toBe('非空目录 — 只能指向')
  })

  it('🔴 migratable 判据是 `!exists || empty`(**或**,不是且)—— 改成 && 时两侧会塌成 draft', async () => {
    // 判别力说明:`!exists && empty` 下 {exists:false,empty:false} → false → draft;
    // {exists:true,empty:true} 也 → false → draft。本条把两侧摆在一起当回归锚点。
    notes.dirInfo.mockResolvedValueOnce({ exists: false, empty: false })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('curated')

    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    await backToRoot(w)
    await pickRoot(w, 1)
    expect(badge(w).attributes('data-s')).toBe('curated')
  })

  it('🔴 ④error —— **三档徽标一个都不出**(蓝本没有第四个分支),但 .kn-picked 仍在', async () => {
    notes.dirInfo.mockRejectedValue(new Error('boom'))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(folderRow(w).find('.kn-picked').exists()).toBe(true)
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/DATA')
    expect(badge(w).exists()).toBe(false)
  })

  it('「已选择:」前缀与 <code> 的位置逐字(蓝本 :82,冒号是模板里的裸 ASCII)', async () => {
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    // ⚠️ `</code>` 与徽标 `<span>` 之间**没有空格**:两者在模板里跨行相邻,Vue 的
    //   `whitespace: 'condense'`(默认)把「只含换行的空白节点」整个删掉。蓝本 `:82-83`
    //   是同样的跨行相邻写法、同样的编译口径 → 渲染逐字一致,别自己补空格。
    expect(norm(folderRow(w).find('.kn-picked').text())).toBe('已选择: /DATA空目录 · 可迁移')
    // 冒号后面**有**一个空格(那是模板里 `}}: <code>` 的裸 ASCII 空格,不是换行)
    expect(folderRow(w).find('.kn-picked').text()).toContain('已选择: ')
  })

  it('.kn-pick-note 长说明逐字(带中文引号)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(folderRow(w).find('.kn-pick-note').text()).toBe(
      '「指向」不动文件,直接收编目录里已有的 .md;「迁移」把现有笔记文件移动过去(目标目录必须为空)。',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 治理 §5.2 + §9.1 —— `onPick` 的两处过期守卫。
describe('SettingsView/T9 —— onPick 过期守卫(蓝本 :241-253,两处守卫)', () => {
  it('🔴 交错路径:先点 A 再点 B、**A 的响应后到** → dirProbe 是 B 的结果(成功分支那处守卫)', async () => {
    const dA = makeDeferred<DirInfo>()
    const dB = makeDeferred<DirInfo>()
    notes.dirInfo.mockImplementation((p: string) => (p === '/DATA' ? dA.promise : dB.promise))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0) // A = /DATA(探针在飞)
    await backToRoot(w)
    await pickRoot(w, 1) // B = /media(探针在飞)
    expect(notes.dirInfo.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA', '/media'])
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/media')

    // 后发(B)先回 → 落地
    dB.resolve({ exists: true, empty: true })
    await flushPromises()
    expect(badge(w).attributes('data-s')).toBe('curated')

    // 先发(A)后回 → 🔴 必须被守卫挡住,不许把 B 的 curated 覆盖成 draft
    // 判据:拿掉成功分支那处 `if (rootPicker.path !== path) return` → 变 draft → 报红
    dA.resolve({ exists: true, empty: false })
    await flushPromises()
    expect(badge(w).attributes('data-s')).toBe('curated')
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/media')
  })

  it('🔴 交错路径 · catch 侧:A 后到且是**失败** → 不许把 B 的成功徽标擦成 error(catch 那处守卫)', async () => {
    const dA = makeDeferred<DirInfo>()
    const dB = makeDeferred<DirInfo>()
    notes.dirInfo.mockImplementation((p: string) => (p === '/DATA' ? dA.promise : dB.promise))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    await backToRoot(w)
    await pickRoot(w, 1)
    dB.resolve({ exists: false, empty: false })
    await flushPromises()
    expect(badge(w).attributes('data-s')).toBe('curated')
    // 判据:拿掉 catch 里的 `if (rootPicker.path === path)` → 徽标整个消失 → 报红
    dA.reject(new Error('late failure'))
    await flushPromises()
    expect(badge(w).exists()).toBe(true)
    expect(badge(w).attributes('data-s')).toBe('curated')
  })

  it('同一路径的失败**要**落地成 error 档(守卫是「只挡过期的」,不是「全挡」)', async () => {
    notes.dirInfo.mockRejectedValue(new Error('boom'))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).exists()).toBe(false) // error 档三徽标都不出
    // 且「搬文件」在 error 档下**仍可点**(disabled 的第二个条件要求 state === 'done')
    expect(isDisabled(moveBtn(w))).toBe(false)
  })

  it('🔴 §9.1 —— **两实例交错**:各自拿到自己的结果,互不覆盖(守卫变量必须是组件本地)', async () => {
    // 判据:把 `rootPicker` 挪到模块级(另开一个 `<script>` 块)→ 两个实例串号 →
    // 两边渲染成同一个路径 → 本条报红。
    const dA = makeDeferred<DirInfo>()
    const dB = makeDeferred<DirInfo>()
    notes.dirInfo.mockImplementation((p: string) => (p === '/DATA' ? dA.promise : dB.promise))
    const { w: w1 } = await mountPage()
    const { w: w2 } = await mountPage()
    await openPicker(w1)
    await openPicker(w2)
    await pickRoot(w1, 0) // 实例 1 选 /DATA
    await pickRoot(w2, 1) // 实例 2 选 /media

    // 交错回:实例 2 先回、实例 1 后回
    dB.resolve({ exists: true, empty: true })
    await flushPromises()
    dA.resolve({ exists: true, empty: false })
    await flushPromises()

    expect(folderRow(w1).find('.kn-picked code').text()).toBe('/DATA')
    expect(folderRow(w2).find('.kn-picked code').text()).toBe('/media')
    expect(badge(w1).attributes('data-s')).toBe('draft') // /DATA 非空
    expect(badge(w2).attributes('data-s')).toBe('curated') // /media 空
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— 两个动作按钮的 disabled(蓝本 :88 / :91)', () => {
  it('没选路径 → **两个都灰**(「仅指向」的唯一条件 / 「搬文件」的第一个条件)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(adoptBtn(w).exists()).toBe(true)
    expect(isDisabled(adoptBtn(w))).toBe(true)
    expect(isDisabled(moveBtn(w))).toBe(true)
  })

  it('选了路径 + 探针 done + **可迁移** → 两个都可点', async () => {
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(isDisabled(adoptBtn(w))).toBe(false)
    expect(isDisabled(moveBtn(w))).toBe(false)
  })

  it('🔴 选了路径 + 探针 done + **不可迁移**(本机 /DATA/Notes 那档)→ 「仅指向」可点、「搬文件」灰', async () => {
    // 判据:删掉 disabled 的第二个条件 → 「搬文件」变可点 → 本条报红
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(isDisabled(adoptBtn(w))).toBe(false)
    expect(isDisabled(moveBtn(w))).toBe(true)
  })

  it('选了路径 + 探针仍 loading → 「搬文件」**可点**(第二个条件要求 state === "done")', async () => {
    const d = makeDeferred<DirInfo>()
    notes.dirInfo.mockReturnValue(d.promise)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('archived')
    expect(isDisabled(moveBtn(w))).toBe(false)
    d.resolve({ exists: true, empty: true })
    await flushPromises()
  })

  it('两个按钮的图标 / 文案逐字(蓝本 :89 / :93)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(adoptBtn(w).findComponent(KIcon).props('name')).toBe('folder')
    expect(adoptBtn(w).findComponent(KIcon).props('size')).toBe(12)
    expect(adoptBtn(w).text()).toBe('指向已有目录')
    expect(moveBtn(w).findComponent(KIcon).props('name')).toBe('upload')
    expect(moveBtn(w).findComponent(KIcon).props('size')).toBe(12)
    expect(moveBtn(w).text()).toBe('迁移文件到新目录…')
  })

  it('🔴 点「搬文件」只开弹窗,**一个请求都不发**(蓝本 :92 就是 `migrating = true`)', async () => {
    withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    await moveBtn(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K29 —— 迁移确认弹窗转 reka 原语(蓝本 :120-156 是裸 .k-modal-bg + @click)。
// portal 目标 `.knowledge-app` 只认第一个同名宿主 → 每条用例先 `withHost()`。
describe('SettingsView/T9 —— K29:reka 迁移确认弹窗', () => {
  /** 打开折叠区、选一个目录、点「搬文件」→ 弹窗开。 */
  async function openModal(dirInfo: DirInfo = { exists: true, empty: true }) {
    const host = withHost()
    notes.dirInfo.mockResolvedValue(dirInfo)
    const m = await mountPage()
    await flushPromises()
    await openPicker(m.w)
    await pickRoot(m.w, 0)
    await moveBtn(m.w).trigger('click')
    await nextTick()
    await flushPromises()
    return { ...m, host }
  }

  it('默认不渲染;点「搬文件」后 portal 到 .knowledge-app,head/body/foot 内容逐字', async () => {
    const host = withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await flushPromises()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(host.querySelector('.k-modal')).toBeNull()

    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    // 遮罩类名照抄蓝本 :121
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head:标题 + × 按钮
    expect(modal!.querySelector('.k-modal-head .k-modal-title')!.textContent).toBe('迁移笔记文件?')
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    // body:旧路径 → 新路径
    const path = modal!.querySelector('.kn-mig-path')!
    expect(path.querySelector('span')!.textContent).toBe('/DATA/Notes')
    expect(path.querySelector('b')!.textContent).toBe('/DATA')
    // body:三条要求
    const lis = Array.from(modal!.querySelectorAll('.kn-mig-req li'))
    expect(lis).toHaveLength(3)
    expect(norm(lis[0]!.textContent!)).toBe('目标目录必须为空 — 非空目录后端会拒绝迁移。')
    expect(norm(lis[1]!.textContent!)).toBe('文件会被移动(不是复制),原目录随后为空。')
    expect(norm(lis[2]!.textContent!)).toBe('迁移期间笔记短暂只读,通常几秒内完成。')
    // body:勾选行
    const check = modal!.querySelector('.kn-checkline input') as HTMLInputElement
    expect(check.type).toBe('checkbox')
    expect(norm(modal!.querySelector('.kn-checkline')!.textContent!)).toBe(
      '我已了解这是移动磁盘文件的操作',
    )
    // foot:取消 + danger 开始迁移
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '开始迁移'])
    expect(footBtns[0]!.className).toBe('k-btn ghost')
    expect(footBtns[1]!.className).toBe('k-btn danger')
  })

  it('🔴 N7 同族第二处:notesRoot 为空串时弹窗旧路径也走 `|| "/DATA/Notes"` 兜底(蓝本 :129)', async () => {
    // 第一版漏了这条 —— 探针 P10b(只删弹窗那处兜底)当时 111/111 全绿,**零判别力**。
    // 蓝本把同一个兜底写了**两处**(:77 目录行 + :129 弹窗旧路径),两处都要有用例。
    notes.getSettings.mockResolvedValue({ notesRoot: '', autoExtract: true })
    const { host } = await openModal()
    expect(host.querySelector('.kn-mig-path span')!.textContent).toBe('/DATA/Notes')
  })

  it('弹窗内的 KIcon 逐个:× 的 x/13 · 箭头 arrowRight/13/var(--warning) · 底部 upload/12', async () => {
    const { w } = await openModal()
    const icons = w.findAllComponents(KIcon)
    const head = icons.find((i) => i.props('name') === 'x')!
    expect(head.props('size')).toBe(13)
    const arrow = icons.find((i) => i.props('name') === 'arrowRight')!
    expect(arrow.props('size')).toBe(13)
    expect(arrow.props('color')).toBe('var(--warning)')
    // upload 有两个(折叠区那个按钮 + 弹窗底部),两个 size 都是 12
    const uploads = icons.filter((i) => i.props('name') === 'upload')
    expect(uploads).toHaveLength(2)
    expect(uploads.map((i) => i.props('size'))).toEqual([12, 12])
  })

  it('🔴 第一条 <li> 的 :color 三元 —— 可迁移侧三个 check 全 var(--success),且无红色 <b>', async () => {
    const { w, host } = await openModal({ exists: true, empty: true })
    const checks = w.findAllComponents(KIcon).filter((i) => i.props('name') === 'check')
    expect(checks).toHaveLength(3)
    expect(checks.map((i) => i.props('size'))).toEqual([13, 13, 13])
    expect(checks.map((i) => i.props('color'))).toEqual([
      'var(--success)',
      'var(--success)',
      'var(--success)',
    ])
    expect(host.querySelector('.kn-mig-req li b')).toBeNull()
  })

  it('🔴 三元另一侧 —— 目标非空时第一个 check 变 var(--danger) + 渲染红色 <b> 补充句', async () => {
    // 🔴 这一档要绕过「搬文件」按钮(非空时它是灰的)—— 先在**可迁移**目录上打开弹窗,
    // 再把探针换成非空重新 pick(弹窗已开,`migrating` 不受 pick 影响)。
    const { w, host } = await openModal({ exists: true, empty: true })
    expect(host.querySelector('.kn-mig-req li b')).toBeNull()
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    await backToRoot(w)
    await pickRoot(w, 1)
    await nextTick()
    const checks = w.findAllComponents(KIcon).filter((i) => i.props('name') === 'check')
    expect(checks.map((i) => i.props('color'))).toEqual([
      'var(--danger)',
      'var(--success)',
      'var(--success)',
    ])
    const b = host.querySelector('.kn-mig-req li b')
    expect(b).not.toBeNull()
    expect(b!.textContent).toBe('当前所选目录非空。')
    expect(b!.getAttribute('style')).toContain('var(--danger)')
  })

  it('🔴 migrateAck 门控 danger 按钮两侧:未勾选 → 灰;勾选后 → 可点', async () => {
    const { host } = await openModal()
    expect(dangerFootBtn(host).disabled).toBe(true)
    await tickAck(host)
    expect(dangerFootBtn(host).disabled).toBe(false)
  })

  it('点 × 关闭弹窗且不发请求', async () => {
    const { host } = await openModal()
    await tickAck(host)
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(notes.putSettings).not.toHaveBeenCalled()
  })

  it('🔴 closeMigrate 清 migrateAck:关掉再打开,勾选框是**未勾**、danger 按钮回到灰', async () => {
    // 判据:`closeMigrate` 只清 `migrating` 不清 `migrateAck` → 重开后 danger 直接可点 → 报红
    const { w, host } = await openModal()
    await tickAck(host)
    expect(dangerFootBtn(host).disabled).toBe(false)
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    // 重开
    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    expect((host.querySelector('.kn-checkline input') as HTMLInputElement).checked).toBe(false)
    expect(dangerFootBtn(host).disabled).toBe(true)
  })

  it('点「取消」关闭且不发请求', async () => {
    const { host } = await openModal()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '取消',
    ) as HTMLElement
    cancel.click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(notes.putSettings).not.toHaveBeenCalled()
  })

  it('点遮罩(弹窗外)关闭;点弹窗内不关闭(reka pointerDownOutside 等价蓝本 @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka 的 usePointerDownOutside 用 setTimeout(0) 延后挂 document 监听(见
    // node_modules/reka-ui/dist/DismissableLayer/utils.js 头注释)—— 补一次真宏任务 tick。
    await new Promise((resolve) => setTimeout(resolve, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— applyRoot 两个 mode + doMigrate 的先关后发(蓝本 :267-281)', () => {
  it('「仅指向」→ putSettings({ notesRoot, mode: "adopt" })、关折叠区、toast「笔记目录已更新」', async () => {
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    notes.putSettings.mockResolvedValue({ notesRoot: '/DATA', autoExtract: true })
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await adoptBtn(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).toHaveBeenCalledTimes(1)
    expect(notes.putSettings).toHaveBeenCalledWith({ notesRoot: '/DATA', mode: 'adopt' })
    expect(toast).toHaveBeenCalledWith('笔记目录已更新')
    // 折叠区收起 + <code> 换成后端返回的新值
    expect(folderRow(w).find('.fb').exists()).toBe(false)
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA')
  })

  it('🔴 「开始迁移」→ mode: "migrate"(第二个取值),且**先关弹窗再发请求**(蓝本 :268-269 的顺序)', async () => {
    // 🔴 判别「先关后发」的**唯一可观测差别**是「请求在飞的那段时间弹窗在不在」——
    //   所以 `putSettings` 必须挂在一个可控 promise 上。
    //   (第一版在 mockImplementation 里查 DOM,查到的是**尚未 flush** 的 DOM:
    //    `closeMigrate()` 与 `putSettings()` 之间没有 await,Vue 还没重渲染 → 恒 false。
    //    那不是「顺序错」,是「探针问对象错了」。)
    const host = withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const d = makeDeferred<NotesSettings>()
    notes.putSettings.mockReturnValue(d.promise)
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    await tickAck(host)
    dangerFootBtn(host).click()
    // reka 的 FocusScope 卸载要多走一轮微任务(`data-focus-scope-unmounting`),
    // 只 `nextTick()` 的话节点还挂着(`data-state="closed"`)。`flushPromises()`
    // 只排微任务,**不会**让 `d.promise` 兑现 —— 请求仍在飞。
    await nextTick()
    await flushPromises()
    await nextTick()
    // 请求还在飞 —— 弹窗**已经关了**。
    // 判据:把 doMigrate 里的 closeMigrate() 挪到 await 之后 → 弹窗此刻仍在 → 报红。
    expect(notes.putSettings).toHaveBeenCalledWith({ notesRoot: '/DATA', mode: 'migrate' })
    expect(host.querySelector('.k-modal')).toBeNull()

    d.resolve({ notesRoot: '/DATA', autoExtract: true })
    await flushPromises()
    expect(toast).toHaveBeenCalledWith('笔记目录已更新')
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K30 —— 下半的两处 catch **不回显后端文本**(蓝本 `applyRoot` 读
// `e.response.data.detail`、`toggleAutoExtract` 读 `e.message`)。
// 判据是**排除式断言**:让 `putSettings` reject 一个**既带 response.data.detail 又带
// message** 的错误,断言 toast / 全局 toast 栈 / 整页 DOM 三处都不含那两段文本。
// ⚠️ 探针文本只出现在本文件里,**故意不出现在 `SettingsView.vue` 的注释里**
// (治理 §9 第九条:否定式断言撞注释 = 假报红,T6 栽过一次)。
describe('SettingsView/T9 —— K30:下半两处 catch 的排除式断言', () => {
  const PROBE_DETAIL = 'PROBE-NOTES-DETAIL-3b9d20'
  const PROBE_MSG = 'PROBE-NOTES-MESSAGE-8e15af'

  function rejectingPut(): void {
    const err = new Error(PROBE_MSG) as Error & { response: { data: { detail: string } } }
    err.response = { data: { detail: PROBE_DETAIL } }
    notes.putSettings.mockRejectedValue(err)
  }

  function assertNoLeak(
    w: ReturnType<typeof mount>,
    toast: { mock: { calls: unknown[][] } },
  ): void {
    const calls = toast.mock.calls.map((c: unknown[]) => String(c[0])).join(' | ')
    for (const probe of [PROBE_DETAIL, PROBE_MSG]) {
      expect(calls).not.toContain(probe)
      expect(useToast().toasts.map((x) => x.text).join(' | ')).not.toContain(probe)
      expect(w.text()).not.toContain(probe)
      expect(w.html()).not.toContain(probe)
      expect(document.body.innerHTML).not.toContain(probe)
    }
  }

  it('catch⑤ applyRoot("adopt")→ 只弹「操作失败」,零后端 detail / 零 e.message', async () => {
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    const { w, store } = await mountPage()
    await flushPromises()
    rejectingPut()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await adoptBtn(w).trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('操作失败')
    // 失败时折叠区**不关**(蓝本的 `rootPicker.open = false` 在 await 之后、catch 之外)
    expect(folderRow(w).find('.fb').exists()).toBe(true)
    assertNoLeak(w, toast)
  })

  it('catch⑥ toggleAutoExtract → 只弹「操作失败」,零后端文本,且开关不翻档', async () => {
    const { w, store } = await mountPage()
    await flushPromises()
    rejectingPut()
    const toast = vi.spyOn(store, 'toast')
    await captureSw(w).trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('操作失败')
    expect(captureSw(w).attributes('data-on')).toBe('true') // 失败 → 值不动
    assertNoLeak(w, toast)
  })

  it('catch⑤ 的 migrate 分支同样只弹固定键(400 非空目标那条真实路径)', async () => {
    const host = withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w, store } = await mountPage()
    await flushPromises()
    rejectingPut()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    await tickAck(host)
    dangerFootBtn(host).click()
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('操作失败')
    assertNoLeak(w, toast)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 治理 §9.2 + §9.3 —— **双向**同族扫描的常驻守卫。
// T9 用到的 29 个键 × 全表(真实模块导入,1503 键)双向比对:
//   方向 1(§9.2):zh 撞车 → en 是否不同   → 实测 9 对撞车,en **全部相同**
//   方向 2(§9.3):en 撞车 → zh 是否不同   → 实测 9 对撞车,zh **全部相同**
// → **本刀余零同族对**(不需要新的 en 档正/反向断言;T8 那四对的断言原样保留、一字未动)。
// 下面两条把「零」钉成常驻断言:将来谁加一个「zh 同 / en 不同」的键,必须按 N21 登记。
describe('SettingsView/T9 —— §9.2/§9.3 双向同族扫描:本刀余零对', () => {
  const T9_KEYS = [
    'aiKbSetNotesSection', 'aiKbSetNotesSectionHint', 'aiKbSetNotesFolder',
    'aiKbSetNotesFolderCn', 'aiKbSetNotesFolderDesc', 'aiKbSetSelected',
    'aiKbSetChecking', 'aiKbSetDirEmptyMigratable', 'aiKbSetDirNotEmpty',
    'aiKbSetPointToExisting', 'aiKbSetMoveFiles', 'aiKbSetPickNote',
    'aiKbCancel', 'aiKbSetChange', 'aiKbSetAutoCapture', 'aiKbSetAutoCaptureCn',
    'aiKbSetAutoCaptureDesc', 'aiKbSetAutoCaptureOffWarn', 'aiKbSetAutoCaptureOn',
    'aiKbSetAutoCaptureOff', 'aiKbSetMigrateTitle', 'aiKbSetMigrateReq1',
    'aiKbSetMigrateReq2', 'aiKbSetMigrateReq3', 'aiKbSetMigrateNotEmpty',
    'aiKbSetMigrateAck', 'aiKbSetMigrateStart', 'aiKbSetNotesFolderUpdated',
    'aiKbOpFailed',
  ]
  const zh = zhCn as Record<string, string>
  const en = enUs as Record<string, string>

  it('本刀 29 个键在两档都存在(键名回附录 A + 语言包双向核准过 —— E-18 的教训)', () => {
    expect(T9_KEYS).toHaveLength(29)
    for (const k of T9_KEYS) {
      expect(typeof zh[k], `zh_cn.ts 缺 ${k}`).toBe('string')
      expect(typeof en[k], `en_us.ts 缺 ${k}`).toBe('string')
    }
    // 全表键数用**真实模块导入**计(治理 §9.3 第 2 条:文本解析会少算)
    expect(Object.keys(zh)).toHaveLength(1503)
    expect(Object.keys(en)).toHaveLength(1503)
  })

  it('🔴 方向 1(§9.2):zh 撞车的对里,en **没有**一对不同(有就必须按 N21 登记)', () => {
    const bad: string[] = []
    for (const k of T9_KEYS) {
      for (const o of Object.keys(zh)) {
        if (o === k) continue
        if (zh[o] === zh[k] && en[o] !== en[k]) bad.push(`${k}(${en[k]}) vs ${o}(${en[o]})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('🔴 方向 2(§9.3):en 撞车的对里,zh **没有**一对不同(镜像方向,T8 评审加的)', () => {
    const bad: string[] = []
    for (const k of T9_KEYS) {
      for (const o of Object.keys(en)) {
        if (o === k) continue
        if (en[o] === en[k] && zh[o] !== zh[k]) bad.push(`${k}(${zh[k]}) vs ${o}(${zh[o]})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('实测的 9 对撞车确实存在且两档同值(证明上面两条不是「扫不到东西」的空转)', () => {
    const pairs: Array<[string, string]> = [
      ['aiKbCancel', 'filesCancel'],
      ['aiKbCancel', 'startAppCancel'],
      ['aiKbCancel', 'appsCancel'],
      ['aiKbCancel', 'appsSettingsCancel'],
      ['aiKbCancel', 'aiCancel'],
      ['aiKbCancel', 'aiCfgCancel'],
      ['aiKbSetChange', 'aiChange'],
      ['aiKbOpFailed', 'filesOpFailed'],
      ['aiKbOpFailed', 'filesShareFailed'],
    ]
    for (const [a, b] of pairs) {
      expect(zh[a], `${a} vs ${b}`).toBe(zh[b])
      expect(en[a], `${a} vs ${b}`).toBe(en[b])
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 —— 源码侧:K29 的 reka 原语与 portal 目标真的用上了', () => {
  it('DialogPortal 的 to 指向 .knowledge-app + 遮罩/内容用 reka 原语(K7 同族,SP8 已爆三次)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).toContain('<DialogPortal to=".knowledge-app" defer>')
    expect(code).toContain('<DialogOverlay class="k-modal-bg">')
    expect(code).toContain('style="width: min(460px, 100%)"')
    // 反面:蓝本那套裸 div 写法不许残留(先剥注释,否则会撞上文件头的引述而假报红)
    expect(code).not.toMatch(/v-if="migrating"/)
    expect(code).not.toMatch(/@click\.stop/)
  })

  it('弹窗任何关闭路径都走 closeMigrate(不是直接写 migrating = $event)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).toContain('@update:open="onMigrateOpenChange"')
    expect(code).not.toMatch(/@update:open="migrating\s*=/)
  })
})
