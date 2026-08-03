// SP8-P5c Task 6 —— `ParserStatus.vue` 的组件测试。
// 蓝本 `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/ParserStatus.vue`(164 行)。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 **mock 共享包 `service.ai.parser*`,走真 `parserStore`(T5 产出)**,不 mock store。
//   理由:本页所有数据都要穿过 `parserStore` 的 K1 降层(蓝本 `store.state.xxx` →
//   本仓 `store.xxx`)与 N7 兜底。mock store 会把「降层与字段名到底对不对得上」这件
//   最容易翻车的事整个绕开;走真 store 则每一条渲染断言天然就是一条集成断言 ——
//   模板里少降一层 `.state.`、或者字段名写错一个字母,对应那一格立刻变空/undefined。
//   代价是每个用例要 `flushPromises()` 等四发 `Promise.all` 落地,可接受。
// 🔴 `service.ai.parser*` 六个方法在包里都只 `return res.data`
//   (`NimoOS-Service/src/ai.ts:591-620`,零转换)→ 这里一律 mock 成 **HTTP 原样
//   snake_case**,就是 fixture 原文。**与 `parserStore.test.ts` /
//   `knowledgeStore.parser.test.ts` 的同名方法形状逐字一致**(治理 §4.1 的 red flag 自查:
//   同一方法在两个测试文件里被 mock 成不同形状 = 定时炸弹,§8.3 已有前科)。
//   `parserControl` 同样 mock 成 `{}`,与那两个文件一致。
//
// ═══ fixture 是抄本,不是运行时读(治理 §4.4) ═══
// 数据逐字抄进下面的 `FIXTURE-COPY-BEGIN/END` 块并注明出处,**不用 `node:fs` 读
// `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次),本分支将来要合
// master,`src/` 下的测试跨界依赖它会以「找不到文件」的形式神秘挂掉。
// 🔴 抄本由一次性脚本从 fixture 直接生成(零人工转写),等价性由**程序化逐字节校验**
// 确认(输出贴在 T6 报告 §4)—— 不是肉眼比。
// 读 `.vue` 源文件(守卫缺口③ 那两条)仍一律 `node:fs`,**不许用 Vite 的 `?raw`**
//   (vitest 的 CSSEnablerPlugin 会把样式源换成空串 → 断言对空字符串「假通过」;
//    先例 `knowledgeStyles.test.ts` 头注释③)。
//
// ═══ 属性态断言的口径(治理 §9) ═══
// `:checked` / `:disabled` 是**布尔属性**:为真时 Vue 渲染 `disabled=""`(空串)、
// 为假时属性整个缺席 → `attributes('disabled')` 的假侧只能是 `undefined`,而治理 §9
// **禁 `toBeUndefined()`**。故这两个一律断言 **DOM 属性**(`el.disabled` / `el.checked`),
// 它天然是 `true`/`false` 两个可比字符串值,**两侧都比**。其余文本/href 直接比字符串。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import zhCn from '../../../i18n/zh_cn'
import ParserStatus from './ParserStatus.vue'
import type {
  ParserStatsBody,
  ParserControlStateBody,
  ParserFoldersBody,
  ParserFailedJob,
} from '../stores/parserStore'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const ai = vi.hoisted(() => ({
  parserStats: vi.fn(),
  parserState: vi.fn(),
  parserFolders: vi.fn(),
  parserJobs: vi.fn(),
  parserControl: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-stats.json  (整份,GET /v1/parser/stats)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-stats.json`(2026-08-03 13:22 真机抓取)。
// 治理 §4.3 的本机实测:pending 339 / running 1 / failed 0 / done 9 ·
// total_vectors_text 5592 · last_cursor_ms 1784775953391。
const STATS: ParserStatsBody = {
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
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-control-state.json  (整份,GET /v1/parser/state)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-control-state.json`(2026-08-03 13:22)。
// 🔴 本机当前是**暂停态**(治理 §4.3)→ 灯是 `.paused`、按钮是「▶ 恢复」。
// 「运行中 / 绿灯 / ⏸ 暂停」那一档在本机看不到,靠下面的 fixture 变体覆盖。
const STATE: ParserControlStateBody = {
  "paused": true,
  "concurrency": 2,
  "device": "auto",
  "ocr_enabled": false,
  "resolved_device": "cpu"
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-folders-pending-20.json  (整份 20 项 + total_groups)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-folders-pending-20.json`(2026-08-03 13:22,
// `GET /v1/parser/folders?limit=20`)。🔴 **20 项全抄**、字段(`root_id`/`folder`/`count`)
// 一个没精简、顺序一个没改。首项 count 18 = 最大值(barWidth 的 100% 基准),末项 4。
const FOLDERS: ParserFoldersBody = {
  "folders": [
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/workflows","count":18},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/projects/-home-nimo-NimoTech/9c3e7a5c-f2fc-409c-9ca3-7f46a47e1d81/subagents","count":16},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1","count":15},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/opt/qdrant/storage/collections/text_chunks","count":12},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/tmp","count":11},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude","count":11},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/discord","count":10},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/imessage","count":10},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/fakechat","count":8},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/opt/qdrant/storage/collections/visual_chunks","count":8},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-security/agents","count":7},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins","count":6},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/scripts","count":6},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram","count":5},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-code-setup/skills/claude-automation-recommender/references","count":5},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/opt/qdrant/storage/collections/text_chunks/0","count":5},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/opt/qdrant/storage/collections/visual_chunks/0","count":5},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/.docker/containers/2e55949f61fe879896fedd0334339c31d1cd962691358c56bf3ca0b03781e983","count":4},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/greptile","count":4},
    {"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0","folder":"/DATA/.system_data/.docker/containers/aade3000de2889facb1f7ba7789d6f2c2fe6acdaf1a9adc7433242648d5c47e7","count":4}
  ],
  "total_groups": 119
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-jobs-failed-5.json  (整份,GET /v1/parser/jobs?status=failed&limit=5)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-jobs-failed-5.json`(2026-08-03 13:22)。
// 🔴 本机失败桶**是空的**(治理 §4.3 / §13)→ N19 的「点开后列表整个不渲染」是**正确行为**。
const FAILED_EMPTY: { jobs: ParserFailedJob[] } = {
  "jobs": []
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5b-fixtures/jobs-pending.json  jobs[0]  (真行一行,整行照抄)
// 取自 `.superpowers/sdd/p5b-fixtures/jobs-pending.json` 的 `jobs[0]`(id 348)。
// 🔴 为什么借 pending 桶的行:本机 failed 桶实测为空,而 `/v1/parser/jobs` 是同一张表、
// 同一个序列化器,行形状与 status 无关 → 借它当 N19「非空桶」两态的真行。
// **先例:`parserStore.test.ts` 的 `FAILED_ROW` 与 `knowledgeStore.staleGuard.test.ts`
// 的 `POISON_FAILED_ROW` 同款做法**(T3 修复轮 1 M-2 已认可)。字段一个没改。
const FAILED_ROW: ParserFailedJob = {
  "id": 348,
  "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0",
  "path": "/DATA/.system_data/tmp/nimoos_panic.log",
  "op": "index",
  "sub_modality": null,
  "priority": 100,
  "attempts": 0,
  "last_error": null,
  "locked_until": null,
  "created_at": 1784776422853,
  "picked_at": null,
  "done_at": null
}
// FIXTURE-COPY-END
// ═══════════════════════════════════════════════════════════════════════════

/** 四发全成功,全部喂 fixture 原文。 */
function mockAllOk(): void {
  ai.parserStats.mockResolvedValue(STATS)
  ai.parserState.mockResolvedValue(STATE)
  ai.parserFolders.mockResolvedValue(FOLDERS)
  ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
  // `parserControl` 的响应体本页不消费(蓝本五个动作也只 `await`);形状与
  // `parserStore.test.ts:207` / `knowledgeStore.parser.test.ts:136` 保持一致。
  ai.parserControl.mockResolvedValue({})
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// 每个用例挂载的 wrapper 统一在 afterEach unmount —— 本页 `onMounted` 起了一个真实
// `setInterval(…, 5000)`(N20),不 unmount 会把定时器和 store 引用漏到别的用例
// (先例 `QueueView.test.ts:162-167` 的同款脚手架,那里是 10 秒轮询)。
const mountedWrappers: Array<ReturnType<typeof mount>> = []

function makeRouter() {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/parser', name: 'AIParser', component: ParserStatus },
      // 蓝本 `:6` 的 `router-link to="/ai/parser/test"` 需要目标路由存在才能解析出 href。
      // 生产环境这条路由此刻仍指占位页(`knowledgeRoutes.ts:63`,T10 才反转)。
      { path: '/ai/parser/test', name: 'AIParserTest', component: { template: '<div />' } },
    ],
  })
  router.push('/ai/parser')
  return router
}

/** 挂载但**不 flush** —— 用于观察「四发在飞时」的 `loading` 档。 */
async function mountRaw() {
  const router = makeRouter()
  await router.isReady()
  const w = mount(ParserStatus, { global: { plugins: [router, i18n] } } as never)
  mountedWrappers.push(w)
  return w
}

/** 挂载并等四发落地。 */
async function mountPage() {
  const w = await mountRaw()
  await flushPromises()
  await nextTick()
  return w
}

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
describe('ParserStatus —— K31 两层根元素(滚动容器 + 900px 居中列)', () => {
  // 🔴 治理 §3 K31:`.parser-app` 是**外层包裹**、页面根类 `.parser-status-page` 在**内层**。
  // 压成同一个元素会让 `overflow-y:auto` 的滚动条落在那条 900px 居中列的右缘
  // (宽屏上约在屏幕中间),而 Vue2 是整页滚动、滚动条在视口最右缘 = 用户可见的界面不 1:1。
  // 判据:把两个类写回同一个元素 → 本组两条必须报红。
  it('根元素只有 .parser-app(不带 .parser-status-page)', async () => {
    const w = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('parser-app')
    expect(root.classList.contains('parser-status-page')).toBe(false)
  })

  it('.parser-status-page 是 .parser-app 的直接子元素,且两者各恰好一个', async () => {
    const w = await mountPage()
    expect(w.findAll('.parser-app')).toHaveLength(1)
    expect(w.findAll('.parser-status-page')).toHaveLength(1)
    expect(w.find('.parser-app > .parser-status-page').exists()).toBe(true)
    // 页面内容真的在内层里(不是空壳)
    expect(w.find('.parser-status-page > .page-header').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 页头(蓝本 :3-9)', () => {
  it('标题 / 🧪 测试沙盒链接(含 href)/ 刷新按钮的文案逐字', async () => {
    const w = await mountPage()
    expect(w.find('.page-header h2').text()).toBe('Parser 详情')
    const link = w.find('a.test-link')
    // N16:🧪 在 t() 外面 —— 渲染成「🧪 测试沙盒」(emoji + 空格 + 译文)
    expect(link.text()).toBe('🧪 测试沙盒')
    // hash 路由:jsdom 里 location 是 `http://localhost:3000/`,`createWebHashHistory('/app/')`
    // 解析出的 href 就是纯 hash(生产环境浏览器地址栏里是 `…/app/#/ai/parser/test`)
    expect(link.attributes('href')).toBe('#/ai/parser/test')
    expect(w.find('.refresh-btn').text()).toBe('刷新')
  })

  it('挂载即拉一次(四发各一次,参数照蓝本)', async () => {
    await mountPage()
    expect(ai.parserStats).toHaveBeenCalledTimes(1)
    expect(ai.parserState).toHaveBeenCalledTimes(1)
    expect(ai.parserFolders).toHaveBeenCalledWith({ limit: 20 })
    expect(ai.parserJobs).toHaveBeenCalledWith({ status: 'failed', limit: 5 })
  })

  it('点刷新按钮 → 再拉一次(蓝本 reload() :137)', async () => {
    const w = await mountPage()
    await w.find('.refresh-btn').trigger('click')
    await flushPromises()
    expect(ai.parserStats).toHaveBeenCalledTimes(2)
    expect(ai.parserFolders).toHaveBeenCalledTimes(2)
  })

  it('🔴 :disabled="loading" 两侧 —— 四发在飞时刷新按钮 + 三档单选 + OCR 勾选框全禁用,落地后全解禁', async () => {
    const d = deferred<ParserStatsBody>()
    ai.parserStats.mockReturnValue(d.promise)
    const w = await mountRaw()
    await nextTick()

    const btn = () => w.find('.refresh-btn').element as HTMLButtonElement
    const inputs = () => w.findAll('.control-card input').map((n) => n.element as HTMLInputElement)
    // 在飞:loading 已同步置真(`parserStore.ts:161` 在 await 之前)
    expect(btn().disabled).toBe(true)
    expect(inputs()).toHaveLength(7) // 3 并发 + 3 设备 + 1 OCR
    expect(inputs().every((el) => el.disabled === true)).toBe(true)

    d.resolve(STATS)
    await flushPromises()
    await nextTick()
    expect(btn().disabled).toBe(false)
    expect(inputs().every((el) => el.disabled === false)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— unreachable 两态(蓝本 :11-14)', () => {
  it('四发全成功 → 不出警示卡,四张卡都在', async () => {
    const w = await mountPage()
    expect(w.find('.card.unreachable').exists()).toBe(false)
    expect(w.find('.control-card').exists()).toBe(true)
    expect(w.find('.queue-card').exists()).toBe(true)
    expect(w.find('.folders-card').exists()).toBe(true)
    expect(w.find('.failures-card').exists()).toBe(true)
  })

  it('任一发失败 → 出警示卡并把 store.error 回显在 <small> 里,四张卡整块不渲染(v-else)', async () => {
    // 蓝本 `:13` 的 `<small>{{ store.state.error }}</small>` 回显的是网络层
    // `e.message || String(e)`(`parserStore.ts:184`)—— 蓝本行为,照抄(K5/K30 不适用,
    // 它们管的是「不把后端响应 body 的 detail 拼进 toast」,不是同一件事)。
    ai.parserFolders.mockRejectedValue(new Error('parser down'))
    const w = await mountPage()
    const card = w.find('.card.unreachable')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('Parser 服务未运行或不可达。')
    expect(card.find('small').text()).toBe('parser down')
    expect(w.find('.control-card').exists()).toBe(false)
    expect(w.find('.queue-card').exists()).toBe(false)
    expect(w.find('.folders-card').exists()).toBe(false)
    expect(w.find('.failures-card').exists()).toBe(false)
    // 页头永远在 v-if/v-else 之外
    expect(w.find('.page-header h2').text()).toBe('Parser 详情')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 控制卡:状态灯 + 暂停按钮(蓝本 :19-29)', () => {
  it('本机实测 paused:true → .dot 带 paused 类、文案「已暂停」、按钮「▶ 恢复」', async () => {
    const w = await mountPage()
    const dot = w.find('.status-text .dot')
    expect(dot.classes()).toContain('paused')
    expect(w.find('.status-text').text()).toBe('已暂停')
    // N16:`▶ ` 由 script 拼接,i18n 键值是纯「恢复」
    expect(w.find('.pause-btn').text()).toBe('▶ 恢复')
  })

  it('fixture 变体 paused:false → .dot 不带 paused 类、文案「运行中」、按钮「⏸ 暂停」', async () => {
    // 只改 `paused` 这一个字段(治理 §4.3:本机是暂停态,运行档只能靠变体覆盖)
    ai.parserState.mockResolvedValue({ ...STATE, paused: false })
    const w = await mountPage()
    expect(w.find('.status-text .dot').classes()).not.toContain('paused')
    expect(w.find('.status-text').text()).toBe('运行中')
    expect(w.find('.pause-btn').text()).toBe('⏸ 暂停')
  })

  it('paused 时点按钮 → 走 resume(蓝本三元 :139-141)', async () => {
    const w = await mountPage()
    await w.find('.pause-btn').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledTimes(1)
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'resume' })
  })

  it('未暂停时点按钮 → 走 pause', async () => {
    ai.parserState.mockResolvedValue({ ...STATE, paused: false })
    const w = await mountPage()
    await w.find('.pause-btn').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledTimes(1)
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 控制卡:并发档(N17,蓝本 :30-40)', () => {
  it('N17 数组下标取 i18n → 三档文案顺序「省电 (1)」「平衡 (2)」「全力 (4)」', async () => {
    const w = await mountPage()
    expect(w.find('.concurrency-row > label').text()).toBe('并发档位:')
    const radios = w.findAll('.concurrency-row .radio')
    expect(radios).toHaveLength(3)
    expect(radios.map((r) => r.text())).toEqual(['省电 (1)', '平衡 (2)', '全力 (4)'])
  })

  it('🔴 :checked 两侧 —— concurrency:2 时只有第二档为 true', async () => {
    const w = await mountPage()
    const els = w.findAll('.concurrency-row input').map((n) => n.element as HTMLInputElement)
    expect(els.map((el) => el.checked)).toEqual([false, true, false])
    expect(els.map((el) => el.getAttribute('value'))).toEqual(['1', '2', '4'])
  })

  it('🔴 :checked 两侧 —— fixture 变体 concurrency:4 时只有第三档为 true', async () => {
    ai.parserState.mockResolvedValue({ ...STATE, concurrency: 4 })
    const w = await mountPage()
    const els = w.findAll('.concurrency-row input').map((n) => n.element as HTMLInputElement)
    expect(els.map((el) => el.checked)).toEqual([false, false, true])
  })

  it('@change → setConcurrency(n),载荷键是 `n`(与后端 controlReq 一致)', async () => {
    const w = await mountPage()
    await w.findAll('.concurrency-row input')[2]!.trigger('change')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_concurrency', n: 4 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 控制卡:推理设备(蓝本 :41-55)', () => {
  it('三档文案:「自动」走 i18n,「GPU (CUDA)」/「CPU」是硬编码技术标识符(不进 i18n)', async () => {
    const w = await mountPage()
    expect(w.find('.device-row > label').text()).toBe('推理设备:')
    const radios = w.findAll('.device-row .radio')
    expect(radios).toHaveLength(3)
    expect(radios.map((r) => r.text())).toEqual(['自动', 'GPU (CUDA)', 'CPU'])
    // 蓝本 `:123-124` 那两串刻意不进 i18n(N22 同族)→ 源码里是**裸字面量**,不经 t()。
    // ⚠️ 不能反过来断言「语言包里搜不到 'CPU'」—— 本仓语言包里确实另有键的值恰好是 'CPU'
    //    (硬件相关文案),那与本页无关。判据落在**本页源码怎么写的**上。
    const src: string = readFileSync(resolve(__dirname, './ParserStatus.vue'), 'utf8')
    expect(src).toContain("{ value: 'cuda', label: 'GPU (CUDA)' }")
    expect(src).toContain("{ value: 'cpu', label: 'CPU' }")
    expect(Object.values(zhCn as Record<string, unknown>)).not.toContain('GPU (CUDA)')
  })

  it('🔴 :checked 两侧 —— device:"auto" 时只有第一档为 true', async () => {
    const w = await mountPage()
    const els = w.findAll('.device-row input').map((n) => n.element as HTMLInputElement)
    expect(els.map((el) => el.checked)).toEqual([true, false, false])
    expect(els.map((el) => el.getAttribute('value'))).toEqual(['auto', 'cuda', 'cpu'])
  })

  it('🔴 :checked 两侧 —— fixture 变体 device:"cpu" 时只有第三档为 true', async () => {
    ai.parserState.mockResolvedValue({ ...STATE, device: 'cpu' })
    const w = await mountPage()
    const els = w.findAll('.device-row input').map((n) => n.element as HTMLInputElement)
    expect(els.map((el) => el.checked)).toEqual([false, false, true])
  })

  it('device=auto + resolved_device=cpu → .resolved-hint 渲染「→ 实际 CPU」(toUpperCase)', async () => {
    const w = await mountPage()
    expect(w.find('.device-row .resolved-hint').text()).toBe('→ 实际 CPU')
  })

  it('device 不是 auto 时 .resolved-hint 整个不渲染(v-if 前半)', async () => {
    ai.parserState.mockResolvedValue({ ...STATE, device: 'cpu' })
    const w = await mountPage()
    expect(w.find('.device-row .resolved-hint').exists()).toBe(false)
  })

  it('device=auto 但 resolved_device 为空串时也不渲染(v-if 后半)', async () => {
    ai.parserState.mockResolvedValue({ ...STATE, resolved_device: '' })
    const w = await mountPage()
    expect(w.find('.device-row .resolved-hint').exists()).toBe(false)
  })

  it('@change → setDevice(opt.value)', async () => {
    const w = await mountPage()
    await w.findAll('.device-row input')[1]!.trigger('change')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_device', device: 'cuda' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 控制卡:OCR 开关(蓝本 :56-65)', () => {
  it('文案 + N21 那条错译提示逐字照抄(「真实索引的扫描件」是语言包自身的错译)', async () => {
    const w = await mountPage()
    expect(w.find('.checkbox').text()).toBe('扫描 PDF 启用 OCR (RapidOCR)')
    // 最后一行 .resolved-hint 是 OCR 提示(第一处在 .device-row 里)
    const hints = w.findAll('.control-card .resolved-hint')
    expect(hints[hints.length - 1]!.text()).toBe('慢 5-10x，只对真实索引的扫描件有用')
  })

  it('🔴 :checked 两侧 —— 本机 ocr_enabled:false 为 false,fixture 变体 true 为 true', async () => {
    const w1 = await mountPage()
    expect((w1.find('.checkbox input').element as HTMLInputElement).checked).toBe(false)

    ai.parserState.mockResolvedValue({ ...STATE, ocr_enabled: true })
    setActivePinia(createPinia())
    const w2 = await mountPage()
    expect((w2.find('.checkbox input').element as HTMLInputElement).checked).toBe(true)
  })

  it('@change 从 $event.target.checked 取值 → setOcr(true) / setOcr(false)', async () => {
    const w = await mountPage()
    const box = w.find('.checkbox input')
    ;(box.element as HTMLInputElement).checked = true
    await box.trigger('change')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: true })
    ;(box.element as HTMLInputElement).checked = false
    await box.trigger('change')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: false })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 队列卡 6 格(蓝本 :68-76)', () => {
  it('六格文本逐字(N16:emoji 全在 t() 外面),数字取本机实测值', async () => {
    const w = await mountPage()
    const kvs = w.findAll('.queue-card .kv')
    expect(kvs).toHaveLength(6)
    expect(kvs.map((k) => k.text())).toEqual([
      '⏳ 待处理 339',
      '🔄 处理中 1',
      '✅ 完成 9',
      '❌ 已失败 0',
      '📦 已入向量 5592',
      // formatCursor 走 toLocaleString(),随运行环境的 locale/时区变 → 现算而不是钉死
      `📍 上次同步 ${new Date(1784775953391).toLocaleString()}`,
    ])
  })

  it('六格的数字各自落在 <b> 里(蓝本每格 `<b>{{…}}</b>`)', async () => {
    const w = await mountPage()
    const bs = w.findAll('.queue-card .kv b')
    expect(bs).toHaveLength(6)
    expect(bs.map((b) => b.text())).toEqual([
      '339', '1', '9', '0', '5592', new Date(1784775953391).toLocaleString(),
    ])
  })

  it('formatCursor(0) → U+2014 破折号(蓝本 :147 的 `if (!ms) return "—"`)', async () => {
    ai.parserStats.mockResolvedValue({ ...STATS, last_cursor_ms: 0 })
    const w = await mountPage()
    const last = w.findAll('.queue-card .kv')[5]!
    expect(last.find('b').text()).toBe('—')
    expect(last.text()).toBe('📍 上次同步 —')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 文件夹卡(蓝本 :78-89)', () => {
  it('标题两个占位符各有来源:{top}=列表长度 20、{total}=后端 total_groups 119', async () => {
    const w = await mountPage()
    expect(w.find('.folders-card h3').text()).toBe('待处理文件夹（top 20 / 共 119 组）')
  })

  it('走 v-else 列表分支:20 行,每行 path + count + 进度条', async () => {
    const w = await mountPage()
    expect(w.find('.folders-card .empty').exists()).toBe(false)
    const rows = w.findAll('.folder-row')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.find('.folder-path').text()).toBe(
      '/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/workflows',
    )
    expect(rows[0]!.find('.folder-count').text()).toBe('18')
    expect(rows[19]!.find('.folder-count').text()).toBe('4')
  })

  it('barWidth:最大项 100%、末项 round(4/18*100)=22%', async () => {
    const w = await mountPage()
    const bars = w.findAll('.folder-bar')
    expect(bars).toHaveLength(20)
    expect(bars[0]!.attributes('style')).toBe('width: 100%;')
    expect(bars[19]!.attributes('style')).toBe('width: 22%;')
  })

  it('🔴 barWidth 的 `|| 1` 兜底:所有 count 都是 0 时宽度是 0%(不是 NaN%)', async () => {
    // 判据:去掉 `|| 1` → reduce 得 0 → 0/0 = NaN → `width: NaN%` 被 jsdom 判为无效值
    // → style 属性拿不到 'width: 0%;' → 本条报红。
    ai.parserFolders.mockResolvedValue({
      folders: [
        { root_id: 'r', folder: '/DATA/a', count: 0 },
        { root_id: 'r', folder: '/DATA/b', count: 0 },
      ],
      total_groups: 2,
    })
    const w = await mountPage()
    const bars = w.findAll('.folder-bar')
    expect(bars).toHaveLength(2)
    expect(bars[0]!.attributes('style')).toBe('width: 0%;')
    expect(bars[1]!.attributes('style')).toBe('width: 0%;')
  })

  it('v-if 空态:folders 为空 → 「无待处理」,零 .folder-row(治理 §13:本机验不到,靠 mock 覆盖)', async () => {
    ai.parserFolders.mockResolvedValue({ folders: [], total_groups: 0 })
    const w = await mountPage()
    expect(w.find('.folders-card .empty').text()).toBe('无待处理')
    expect(w.findAll('.folder-row')).toHaveLength(0)
    expect(w.find('.folders-card h3').text()).toBe('待处理文件夹（top 0 / 共 0 组）')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 失败卡 + N19 三态(蓝本 :91-102)', () => {
  // 🔴 N19:`<ul v-show="failedOpen" v-if="store.failedJobs.length">` 两个指令同挂。
  // Vue 里 `v-if` 优先级高于 `v-show` → 空桶时整个 `<ul>` 不渲染、`v-show` 是死的。
  // 判据:合并成单一指令(只留 v-show 或只留 v-if)→ 本组三条里至少一条必须报红。
  it('N19 态①:本机空桶 —— 折叠按钮无条件渲染且能点(「▶ 最近失败（0）」),但点开后 <ul> 整个不渲染', async () => {
    const w = await mountPage()
    const btn = w.find('.failures-card .toggle')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('▶ 最近失败（0）')
    expect(w.find('.failure-list').exists()).toBe(false)

    await btn.trigger('click')
    await nextTick()
    // 箭头翻了(证明 failedOpen 真的置真、按钮真的可点)
    expect(w.find('.failures-card .toggle').text()).toBe('▼ 最近失败（0）')
    // 但列表仍然不存在 —— 这是**正确行为**(v-if 先判掉),不是缺陷(治理 §13)
    expect(w.find('.failure-list').exists()).toBe(false)
  })

  it('N19 态②:非空桶 + 未展开 —— <ul> 渲染出来了,但被 v-show 隐藏(display: none)', async () => {
    ai.parserJobs.mockResolvedValue({ jobs: [FAILED_ROW] })
    const w = await mountPage()
    const ul = w.find('.failure-list')
    expect(ul.exists()).toBe(true)
    expect((ul.element as HTMLElement).style.display).toBe('none')
    expect(w.find('.failures-card .toggle').text()).toBe('▶ 最近失败（1）')
  })

  it('N19 态③:非空桶 + 展开 —— <ul> 可见,行里 path + 截断后的 error', async () => {
    ai.parserJobs.mockResolvedValue({ jobs: [{ ...FAILED_ROW, last_error: 'boom' }] })
    const w = await mountPage()
    await w.find('.failures-card .toggle').trigger('click')
    await nextTick()
    const ul = w.find('.failure-list')
    expect((ul.element as HTMLElement).style.display).toBe('')
    const lis = ul.findAll('li')
    expect(lis).toHaveLength(1)
    expect(lis[0]!.find('.path').text()).toBe('/DATA/.system_data/tmp/nimoos_panic.log')
    expect(lis[0]!.find('.error').text()).toBe('boom')
    expect(w.find('.failures-card .toggle').text()).toBe('▼ 最近失败（1）')
  })

  it('truncateErr 边界:120 字符原样、121 字符截成前 120 + U+2026(蓝本 :156 是严格 `> 120`)', async () => {
    const e120 = 'x'.repeat(120)
    const e121 = 'y'.repeat(121)
    ai.parserJobs.mockResolvedValue({
      jobs: [
        { ...FAILED_ROW, id: 1, last_error: e120 },
        { ...FAILED_ROW, id: 2, last_error: e121 },
      ],
    })
    const w = await mountPage()
    await w.find('.failures-card .toggle').trigger('click')
    await nextTick()
    const errs = w.findAll('.failure-list .error')
    expect(errs).toHaveLength(2)
    expect(errs[0]!.text()).toBe(e120) // 恰好 120 → 不截
    expect(errs[0]!.text()).toHaveLength(120)
    expect(errs[1]!.text()).toBe('y'.repeat(120) + '…') // 121 → 截 + 省略号
    expect(errs[1]!.text()).toHaveLength(121)
  })

  it('truncateErr 空值:last_error 为 null(本机真行的实测值)→ 渲染空串,不渲染 "null"', async () => {
    ai.parserJobs.mockResolvedValue({ jobs: [FAILED_ROW] }) // FAILED_ROW.last_error === null
    const w = await mountPage()
    await w.find('.failures-card .toggle').trigger('click')
    await nextTick()
    expect(w.find('.failure-list .error').text()).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— N20:5 秒轮询 + document.hidden 守卫 + 卸载清理(蓝本 :127-135)', () => {
  // 照 `QueueView.test.ts:859-891` 的既有写法:`onMounted` 里的 `loadAll()` 是同步
  // 发起调用(`Promise.all` 内四个 `service.ai.parser*` 是同步触发,只有各自 resolve
  // 走微任务),不需要 `runOnlyPendingTimersAsync` 去"催"—— 那个 API 会把尚未到期的
  // setInterval 也提前打一次,导致误判成多发一轮。
  it('频率就是 5000ms:推进 4999ms 不发,再推进 1ms 才发一轮', async () => {
    vi.useFakeTimers()
    try {
      const router = makeRouter()
      await router.isReady()
      const w = mount(ParserStatus, { global: { plugins: [router, i18n] } } as never)
      expect(ai.parserStats).toHaveBeenCalledTimes(1) // mounted 立即一发

      ai.parserStats.mockClear()
      vi.advanceTimersByTime(4999)
      expect(ai.parserStats).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(ai.parserStats).toHaveBeenCalledTimes(1)

      // 再一拍(证明是 setInterval 而不是 setTimeout)
      ai.parserStats.mockClear()
      vi.advanceTimersByTime(5000)
      expect(ai.parserStats).toHaveBeenCalledTimes(1)
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 document.hidden 为 true 时跳过这一拍;转回 false 后恢复', async () => {
    // 判据:拿掉 `if (!document.hidden)` 守卫 → 中间那段会发出请求 → 本条报红。
    vi.useFakeTimers()
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    try {
      const router = makeRouter()
      await router.isReady()
      const w = mount(ParserStatus, { global: { plugins: [router, i18n] } } as never)
      ai.parserStats.mockClear()

      hidden.mockReturnValue(true)
      vi.advanceTimersByTime(15000) // 三拍全跳过
      expect(ai.parserStats).not.toHaveBeenCalled()

      hidden.mockReturnValue(false)
      vi.advanceTimersByTime(5000)
      expect(ai.parserStats).toHaveBeenCalledTimes(1)
      w.unmount()
    } finally {
      hidden.mockRestore()
      vi.useRealTimers()
    }
  })

  it('🔴 onBeforeUnmount 清定时器:卸载后再怎么推进都不再发请求', async () => {
    vi.useFakeTimers()
    try {
      const router = makeRouter()
      await router.isReady()
      const w = mount(ParserStatus, { global: { plugins: [router, i18n] } } as never)
      vi.advanceTimersByTime(5000)
      expect(ai.parserStats).toHaveBeenCalledTimes(2) // mounted + 一拍

      w.unmount()
      ai.parserStats.mockClear()
      vi.advanceTimersByTime(60000) // 12 拍
      expect(ai.parserStats).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— N16 emoji / 符号位置核对(一个都不许挪进/挪出 t())', () => {
  it('i18n 键值本身零 emoji / 零箭头符号(证明符号在模板或 script 侧,不在语言包里)', () => {
    const t = i18n.global.t as unknown as (k: string) => string
    // 由 script 拼接的两个(蓝本 :27)
    expect(t('aiKbResume')).toBe('恢复')
    expect(t('aiKbPause')).toBe('暂停')
    // 在 t() 外面的七个 emoji 所属的键值(蓝本 :6 / :70-75)
    expect(t('aiKbPrTestLink')).toBe('测试沙盒')
    expect(t('aiKbPending')).toBe('待处理')
    expect(t('aiKbPrQueueRunning')).toBe('处理中')
    expect(t('aiKbPrQueueDone')).toBe('完成')
    expect(t('aiKbFailed')).toBe('已失败')
    expect(t('aiKbPrIndexedVectors')).toBe('已入向量')
    expect(t('aiKbLastSynced')).toBe('上次同步')
    for (const k of [
      'aiKbResume', 'aiKbPause', 'aiKbPrTestLink', 'aiKbPending', 'aiKbPrQueueRunning',
      'aiKbPrQueueDone', 'aiKbFailed', 'aiKbPrIndexedVectors', 'aiKbLastSynced',
      'aiKbPrRecentFailures',
    ]) {
      expect(t(k)).not.toMatch(/[🧪⏳🔄✅❌📦📍▼▶⏸]/u)
    }
    // 🔴 反过来:`→` **在**键值里(蓝本 :53 的 `$t('→ actual {device}')`),不在模板里。
    //    这里读语言包原串(过 `t()` 会把 `{device}` 当缺失参数吃掉)。
    expect((zhCn as Record<string, string>).aiKbPrResolvedHint).toBe('→ 实际 {device}')
  })

  it('模板里 emoji 与译文之间恰好一个空格,顺序是「符号 → 文案」', async () => {
    const w = await mountPage()
    expect(w.find('a.test-link').text()).toBe('🧪 测试沙盒')
    // ⚠️ 不用 `slice(0, 2)` 取首字符:🔄/📦/📍 是非 BMP 码点(各占 2 个 UTF-16 单元),
    //    ⏳/✅/❌ 是 BMP(各占 1 个)—— 按单元切会切出不同长度。用带 `u` 标志的正则。
    expect(w.findAll('.queue-card .kv').map((k) => k.text())).toEqual([
      expect.stringMatching(/^⏳ \S/u),
      expect.stringMatching(/^🔄 \S/u),
      expect.stringMatching(/^✅ \S/u),
      expect.stringMatching(/^❌ \S/u),
      expect.stringMatching(/^📦 \S/u),
      expect.stringMatching(/^📍 \S/u),
    ])
    expect(w.find('.pause-btn').text().startsWith('▶ ')).toBe(true)
    expect(w.find('.failures-card .toggle').text().startsWith('▶ ')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserStatus —— 守卫缺口③:<template> 块零裸色字面量', () => {
  // 治理 §9 缺口③:`color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` 只取
  // `<style>` 块 → 模板 `style=` / `:style=` 属性零扫描;本文件补一条定向断言堵这个盲区。
  // ⚠️ 沿用现状写法(非贪婪 + 隐式靠「`</template>` 在第 0 列」锚定,先例
  // `QueueView.test.ts` / `IndexedFilesView.test.ts` / `FolderBrowser.test.ts`);
  // 治理 §9 缺口③′ 的「统一改成贪婪匹配 + 覆盖度自检」归 **T8**,本刀不动它。
  // 🔴 读源文件用 `node:fs`,不用 Vite 的 `?raw`。
  it('<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量', () => {
    const src: string = readFileSync(resolve(__dirname, './ParserStatus.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]
    // 覆盖度自检:抽出的片段必须同时含模板**首部**与**尾部**的特征串。
    // 本组件唯一的嵌套 `<template v-else>` 带属性(不是裸 `<template>`)、其闭合标签
    // 也是缩进的 → 不会把第 0 列的 `</template>` 提前截断。
    expect(tmpl).toContain('aiKbPrDetailsTitle') // 首部(页头 h2)
    expect(tmpl).toContain('truncateErr(j.last_error)') // 尾部(失败卡最后一行内容)

    // 剥掉 var(...) 与 color-mix(...) 的内部(照 color-guard.test.ts 的 stripVar
    // 同款手法:逐字符扫描配对括号深度,支持嵌套 fallback)
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1 // 落在开括号上
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

  it('本文件零 <style> 块(K24:样式在 parser-styles.scss,走 JS 侧 import)', () => {
    const src: string = readFileSync(resolve(__dirname, './ParserStatus.vue'), 'utf8')
    expect(src).not.toMatch(/^<style/m)
    expect(src).toContain("import '../../styles/parser-styles.scss'")
  })

  it('零 KIcon(治理 §1.2 / N16:两个 Parser 页蓝本一个 KIcon 都不用)', async () => {
    const src: string = readFileSync(resolve(__dirname, './ParserStatus.vue'), 'utf8')
    expect(src).not.toMatch(/^import KIcon/m)
    const w = await mountPage()
    expect(w.findAll('svg')).toHaveLength(0)
  })
})
