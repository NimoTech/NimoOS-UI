// SP8-P5c Task 8 —— `SettingsView.vue`(上半)的组件测试。
// 蓝本 `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/SettingsView.vue`(322 行)。
// 🔴 本文件只覆盖 T8 范围:服务卡 · 运行档三行(并发/设备/OCR)· 沙盒入口 · 危险区 +
//    对应 script(`controlState` / `deviceLabel` / `togglePause` / `setConcurrency` /
//    `setDevice` / `toggleOcr` / `goSandbox`)。**下半(笔记根目录 + 迁移弹窗)归 T9**,
//    本文件不为它写任何用例、也不写「将来会有」的占位断言。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 **mock 共享包 `service.ai.parserStats/parserState/parserControl`,走真 `knowledgeStore`**,
//   不 mock store。理由同 T6 `ParserStatus.test.ts`:本页每一格都要穿过 K1 降层
//   (蓝本 `store.state.controlState` → 本仓 `store.controlState`),mock store 会把
//   「降层与字段名到底对不对得上」这件最容易翻车的事整个绕开;走真 store 则每条渲染
//   断言天然是集成断言 —— 少降一层或字段名错一个字母,对应那格立刻空/undefined。
// 🔴 形状:`service.ai.parserStats` / `parserState` 在包里都只 `return res.data`
//   (`NimoOS-Service/src/ai.ts:591-596`,零转换)→ 一律 mock 成 **HTTP 原样 snake_case**,
//   就是 fixture 原文。`parserControl` 的响应体本页不消费,mock 成 `{}`,与
//   `parserStore.test.ts:207` / `knowledgeStore.parser.test.ts:136` / `ParserStatus.test.ts:182`
//   逐字一致(治理 §4.1 的 red flag 自查:同一方法在两个测试文件里形状不同 = 定时炸弹)。
// 🔴 `service.notes.*` 本文件**一个都不 mock,也不抄 `notes-settings.json` fixture** ——
//   笔记那半整个归 T9,本刀的组件根本不调它(治理 §4.4:用不到就不抄,别为凑数抄)。
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
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

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
// ═══════════════════════════════════════════════════════════════════════════

/** 两发全成功,喂 fixture 原文;控制动作返回 `{}`。 */
function mockAllOk(): void {
  ai.parserStats.mockResolvedValue(STATS)
  ai.parserState.mockResolvedValue(STATE)
  ai.parserControl.mockResolvedValue({})
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

  it('源码侧:四个 catch 一个都不读 `e`(零 `e.message` / 零 `e.response`)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).not.toMatch(/\.message\b/)
    expect(code).not.toMatch(/\.response\b/)
    expect(code).not.toMatch(/\.detail\b/)
    // 四个 catch 都是无参 `catch {`(连错误对象都不接)
    expect((code.match(/\}\s*catch\s*\{/g) || []).length).toBe(4)
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
    const head = w.find('.k-section .k-section-head')
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
