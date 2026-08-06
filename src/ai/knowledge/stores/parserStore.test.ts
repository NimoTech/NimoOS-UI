// SP8-P5c Task 5 —— `parserStore.ts` 的单测。覆盖:初值(蓝本 :5-18)· `loadAll`
// 四发并行 + K1 单层取数 + N7 兜底 · `unreachable` 两个方向 · 五个控制动作 ·
// 🔴 K33 过期守卫的**两件事**(治理 §9.1):① 守卫逻辑(先发后至不覆盖)
// ② 守卫变量的作用域(必须 store 实例局部,不能模块级)。
//
// 🔴 **mock 层次**(治理 §4.1):`service.ai.parser*` 六个方法在共享包里都只
// `return res.data`(`NimoOS-Service/src/ai.ts:591-620`,零转换)→ 这里一律 mock 成
// **HTTP 原样 snake_case**,就是 fixture 原文,一字不改。
//
// 🔴 **fixture 是抄本,不是运行时读**(治理 §4.4;沿用 P5b/T3 的既定做法):
// 数据逐字抄进本文件的 `FIXTURE-COPY-BEGIN/END` 块并注明出处,**不用 `node:fs` 读
// `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次),本分支将来要
// 合 master,`src/` 下的测试跨界依赖它会以「找不到文件」的形式神秘挂掉。
// 抄本与 fixture 的**逐字节等价性由一次性脚本程序化校验**(见 T5 报告 §5),不是肉眼比。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

const ai = vi.hoisted(() => ({
  parserStats: vi.fn(),
  parserState: vi.fn(),
  parserFolders: vi.fn(),
  parserJobs: vi.fn(),
  parserControl: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

import { useParserStore } from './parserStore'
import type { ParserStatsBody, ParserControlStateBody, ParserFoldersBody, ParserFailedJob } from './parserStore'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-stats.json  (整份,GET /v1/parser/stats)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-stats.json`(2026-08-03 13:22 真机抓取)。
// 抄本由脚本从 fixture 生成后插入,零人工转写;等价校验见报告 §5。
const STATS_NOW: ParserStatsBody = {
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

// FIXTURE-COPY-BEGIN  p5b-fixtures/stats.json  (整份,同一端点的**更早一次**真抓)
// 取自 `.superpowers/sdd/p5b-fixtures/stats.json`(P5b 期真机抓取)。
// 🔴 用途:交错用例需要两份**可区分**的真响应体。这两份是同一个 `GET /v1/parser/stats`
// 在两个时刻的真实回包(`pending` 338→339 / `indexed_files` 8→7,治理 §12.1 已登记
// 这个漂移),正好就是「轮询两发在飞、先发后至」的真实剧情 —— 不是手编数据。
const STATS_EARLIER: ParserStatsBody = {
  "queue_depth": {
    "pending": 338,
    "running": 1,
    "failed": 0,
    "done": 9
  },
  "indexed_files": 8,
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
// 🔴 实测只有这 5 个字段;本机当前是**暂停态**(治理 §4.3)。
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
// 一个没精简、顺序一个没改;`total_groups: 119` 与列表长度 20 的关系有专门用例守着。
const FOLDERS: ParserFoldersBody = {
  "folders": [
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/workflows", "count": 18 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/projects/-home-nimo-NimoTech/9c3e7a5c-f2fc-409c-9ca3-7f46a47e1d81/subagents", "count": 16 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1", "count": 15 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/text_chunks", "count": 12 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/tmp", "count": 11 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude", "count": 11 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/discord", "count": 10 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/imessage", "count": 10 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/fakechat", "count": 8 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/visual_chunks", "count": 8 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-security/agents", "count": 7 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins", "count": 6 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/scripts", "count": 6 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-code-setup/skills/claude-automation-recommender/references", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/text_chunks/0", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/opt/qdrant/storage/collections/visual_chunks/0", "count": 5 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/.docker/containers/2e55949f61fe879896fedd0334339c31d1cd962691358c56bf3ca0b03781e983", "count": 4 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/greptile", "count": 4 },
    { "root_id": "dfcd1840f5dab439cd9d7050aa5bafd0", "folder": "/DATA/.system_data/.docker/containers/aade3000de2889facb1f7ba7789d6f2c2fe6acdaf1a9adc7433242648d5c47e7", "count": 4 },
  ],
  "total_groups": 119,
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-jobs-failed-5.json  (整份,GET /v1/parser/jobs?status=failed&limit=5)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-jobs-failed-5.json`(2026-08-03 13:22)。
// 🔴 本机失败桶**是空的** → 光靠它区分不出「真读了 `.jobs`」与「走了 `|| []` 兜底」,
// 所以另借一行真行(见下一个块)做判别。
const FAILED_EMPTY: { jobs: ParserFailedJob[] } = {
  "jobs": []
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5b-fixtures/jobs-pending.json  jobs[0]  (真行一行,整行照抄)
// 取自 `.superpowers/sdd/p5b-fixtures/jobs-pending.json` 的 `jobs[0]`(id 348)。
// 🔴 为什么借 pending 桶的行:本机 failed 桶实测为空(`parser-jobs-failed-5.json` 与
// P5b 的 `jobs-failed.json` 都是 `{"jobs":[]}`),而 `/v1/parser/jobs` 是同一张表、同一个
// 序列化器,行形状与 status 无关 → 借它当判别用真行。**先例:`knowledgeStore.staleGuard.test.ts`
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

// 蓝本 `parserStore.js:6-11` / `:12` 的初值,逐字照抄(**这两个不是 fixture,是蓝本
// 源码**)—— 初值改了这两条用例必须报红。
const INITIAL_STATS = {
  queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
  indexed_files: 0,
  total_vectors_text: 0,
  last_cursor_ms: 0,
}
const INITIAL_CONTROL_STATE = {
  paused: false,
  concurrency: 2,
  device: 'auto',
  resolved_device: 'cpu',
  ocr_enabled: false,
}

/** 可控 deferred —— 交错路径测试的标准工具(先例 `knowledgeStore.staleGuard.test.ts:37`)。 */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 四发全成功,全部喂 fixture 原文。 */
function mockAllOk() {
  ai.parserStats.mockResolvedValue(STATS_NOW)
  ai.parserState.mockResolvedValue(STATE)
  ai.parserFolders.mockResolvedValue(FOLDERS)
  ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
  // `parserControl` 的返回体本 store 不消费(蓝本 :46 也只 `await`),本期 fixture 未抓
  // `POST /v1/parser/control` 的响应体(治理 §8.2 第 8 条同款「不依赖」口径)——
  // 形状与 `knowledgeStore.parser.test.ts:136` 保持一致(同一方法两文件两形状 = red flag)。
  ai.parserControl.mockResolvedValue({})
}

/** 三发(state/folders/jobs)固定成功,只让 `parserStats` 那一发受调用方控制 ——
 * `Promise.all` 会等最慢的一发,所以整发的落地顺序由 `parserStats` 决定。 */
function mockStatsDeferred(...promises: Promise<unknown>[]) {
  ai.parserState.mockResolvedValue(STATE)
  ai.parserFolders.mockResolvedValue(FOLDERS)
  ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
  for (const p of promises) ai.parserStats.mockReturnValueOnce(p)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('初值(蓝本 parserStore.js:5-18,逐字照抄)', () => {
  it('七个 state 字段的初值与蓝本一致(concurrency 默认 2 / device 默认 auto)', () => {
    const s = useParserStore()
    expect(s.stats).toEqual(INITIAL_STATS)
    expect(s.controlState).toEqual(INITIAL_CONTROL_STATE)
    expect(s.folders).toEqual({ folders: [], total_groups: 0 })
    expect(s.failedJobs).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.error).toBe(null)
    expect(s.unreachable).toBe(false)
  })
})

describe('loadAll —— 四发并行 + K1 单层取数', () => {
  it('四个包方法各发一次,参数逐字照蓝本(folders limit 20 / jobs status=failed limit 5)', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    expect(ai.parserStats).toHaveBeenCalledTimes(1)
    expect(ai.parserStats).toHaveBeenCalledWith()
    expect(ai.parserState).toHaveBeenCalledTimes(1)
    expect(ai.parserState).toHaveBeenCalledWith()
    expect(ai.parserFolders).toHaveBeenCalledWith({ limit: 20 })
    expect(ai.parserJobs).toHaveBeenCalledWith({ status: 'failed', limit: 5 })
  })

  it('🔴 K1:fixture 原样 snake_case 直接写进 state(没有 .data 那一层)', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    // ← mock 是裸 body:实现若多剥一层 `.data`,这四条全红
    expect(s.stats).toEqual(STATS_NOW)
    expect(s.controlState).toEqual(STATE)
    expect(s.folders).toEqual(FOLDERS)
    expect(s.failedJobs).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.unreachable).toBe(false)
    expect(s.error).toBe(null)
  })

  it('🔴 K1 反向:mock 多包一层 { data } 时,写进 state 的就是那个外壳(证明实现零剥壳)', async () => {
    ai.parserStats.mockResolvedValue({ data: STATS_NOW })
    ai.parserState.mockResolvedValue({ data: STATE })
    ai.parserFolders.mockResolvedValue({ data: FOLDERS })
    ai.parserJobs.mockResolvedValue({ data: FAILED_EMPTY })
    const s = useParserStore()
    await s.loadAll()
    expect(s.stats).toEqual({ data: STATS_NOW })
    expect(s.stats.queue_depth).toBeUndefined()
    expect(s.folders).toEqual({ data: FOLDERS })
    // 外壳里的 `jobs` 取不到 → 走 N7 兜底成空数组(不抛)
    expect(s.failedJobs).toEqual([])
  })

  it('本机实测形状:20 项文件夹 + total_groups 119(列表长度 ≠ 总组数,标题两个数字各有来源)', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    expect(s.folders.folders).toHaveLength(20)
    expect(s.folders.total_groups).toBe(119)
    expect(s.folders.folders[0]).toEqual({
      root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
      folder:
        '/DATA/.system_data/home/nimo/.claude/plugins/marketplaces/claude-plugins-official/.github/workflows',
      count: 18,
    })
    // count 递减(蓝本 barWidth 拿首项当最大值的前提)
    expect(s.folders.folders.map((f) => f.count)[19]).toBe(4)
  })

  it('failedJobs 真的读了 .jobs(非空桶,借 jobs-pending.json 的真行)', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue({ jobs: [FAILED_ROW] })
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([FAILED_ROW])
    // 蓝本 `ParserStatus.vue:97-99` 只读这三个字段
    expect(s.failedJobs[0].id).toBe(348)
    expect(s.failedJobs[0].path).toBe('/DATA/.system_data/tmp/nimoos_panic.log')
    expect(s.failedJobs[0].last_error).toBe(null)
  })

  it('【N7 兜底】failed 响应缺 jobs 键 → 空数组', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue({})
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([])
  })

  it('【N7 兜底】failed 响应 jobs 为 null(Go nil slice 序列化结果)→ 空数组', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue({ jobs: null })
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([])
  })

  it('【N7 兜底】failed 响应整体为 null → 空数组,不抛(蓝本 :34 的 `failed.data &&` 那一半)', async () => {
    mockAllOk()
    ai.parserJobs.mockResolvedValue(null)
    const s = useParserStore()
    await s.loadAll()
    expect(s.failedJobs).toEqual([])
    expect(s.unreachable).toBe(false)
  })
})

describe('unreachable 两个方向(蓝本 :37-42)', () => {
  it('四发里任一 reject → unreachable=true + error=e.message,既有值不动,loading 归位', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.loadAll()
    expect(s.stats).toEqual(STATS_NOW)

    ai.parserFolders.mockRejectedValue(new Error('parser down'))
    await s.loadAll()
    expect(s.unreachable).toBe(true)
    expect(s.error).toBe('parser down')
    expect(s.loading).toBe(false)
    expect(s.stats).toEqual(STATS_NOW) // catch 分支不动既有数据(蓝本也不动)
    expect(s.folders).toEqual(FOLDERS)
  })

  it('恢复后 unreachable 回 false 且 error 清成 null(蓝本 :35-36)', async () => {
    ai.parserStats.mockRejectedValue(new Error('boom'))
    ai.parserState.mockResolvedValue(STATE)
    ai.parserFolders.mockResolvedValue(FOLDERS)
    ai.parserJobs.mockResolvedValue(FAILED_EMPTY)
    const s = useParserStore()
    await s.loadAll()
    expect(s.unreachable).toBe(true)
    expect(s.error).toBe('boom')

    mockAllOk()
    await s.loadAll()
    expect(s.unreachable).toBe(false)
    expect(s.error).toBe(null)
    expect(s.stats).toEqual(STATS_NOW)
  })

  it('抛出的不是 Error 时走 String(e) 兜底(蓝本 :39 的 `|| String(e)`)', async () => {
    mockAllOk()
    ai.parserState.mockRejectedValue('net down')
    const s = useParserStore()
    await s.loadAll()
    expect(s.unreachable).toBe(true)
    expect(s.error).toBe('net down')
  })
})

describe('五个控制动作(蓝本 :45-64)—— 先 parserControl,再 await loadAll()', () => {
  it('pause / resume 的 body 与重载次数', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.pause()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
    expect(ai.parserStats).toHaveBeenCalledTimes(1) // 动作后重载了一次
    await s.resume()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'resume' })
    expect(ai.parserStats).toHaveBeenCalledTimes(2)
  })

  // 键名 `n` 与设置页那条路径**一致**(蓝本 `SettingsView.vue:292` 同样传 `{ n }`),
  // 后端 `controlReq` 也是 `N *int json:"n"` —— 这里钉死它,不是登记「两处不一致」。
  it('🔴 setConcurrency 的键是 `n`(与设置页调用点、后端 controlReq 一致),并重载', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.setConcurrency(4)
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_concurrency', n: 4 })
    expect(ai.parserStats).toHaveBeenCalledTimes(1)
  })

  it('setDevice / setOcr 的 body 逐字照抄,并各自重载', async () => {
    mockAllOk()
    const s = useParserStore()
    await s.setDevice('cuda')
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_device', device: 'cuda' })
    await s.setOcr(true)
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: true })
    await s.setOcr(false)
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: false })
    expect(ai.parserStats).toHaveBeenCalledTimes(3)
    expect(ai.parserControl).toHaveBeenCalledTimes(3)
  })

  it('控制动作里的重载也吃过期守卫:动作触发的那一发比轮询那一发晚发 → 它才是最新的', async () => {
    // 轮询那一发(先发)在飞时用户点了「恢复」→ 动作内部的 loadAll 是后发。
    const dPoll = deferred<ParserStatsBody>()
    const dAction = deferred<ParserStatsBody>()
    mockStatsDeferred(dPoll.promise, dAction.promise)
    ai.parserControl.mockResolvedValue({})
    const s = useParserStore()
    const pPoll = s.loadAll()
    const pAction = s.resume()
    await flushPromises()
    dAction.resolve(STATS_NOW) // 后发(动作)先回
    await flushPromises()
    dPoll.resolve(STATS_EARLIER) // 先发(轮询)后回 → 必须被丢弃
    await Promise.all([pPoll, pAction])
    expect(s.stats).toEqual(STATS_NOW)
    expect(s.loading).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K33 —— 过期守卫。治理 §9.1:**必须同时守两件事**。
// ① 守卫逻辑(先发后至不覆盖 / 不提前清 loading / 不写错误态)
// ② 守卫**变量的作用域**(必须 store 实例局部,不能模块级)
// 判据:① 拿掉守卫必须报红;② 把 `loadAllEpoch` 挪到模块级必须报红。
// ⚠️ 不抽公共 guard(过早抽象,承 K15 的既定口径)。
// ═══════════════════════════════════════════════════════════════════════════

describe('K33 过期守卫 ① —— 守卫逻辑(8 个并发入口:mounted / 5s 轮询 / 刷新按钮 / 五个动作)', () => {
  it('两次 loadAll 交错(后发先回、先发后回)→ state 是后发那次的,loading 收敛 false', async () => {
    const d1 = deferred<ParserStatsBody>()
    const d2 = deferred<ParserStatsBody>()
    mockStatsDeferred(d1.promise, d2.promise)
    const s = useParserStore()
    const p1 = s.loadAll() // 先发
    const p2 = s.loadAll() // 后发
    expect(ai.parserStats).toHaveBeenCalledTimes(2)

    d2.resolve(STATS_NOW) // 后发先回
    await flushPromises()
    expect(s.stats).toEqual(STATS_NOW)

    d1.resolve(STATS_EARLIER) // 先发后回 —— 无守卫时会把更旧的数据盖上去
    await Promise.all([p1, p2])
    expect(s.stats).toEqual(STATS_NOW)
    expect(s.stats.indexed_files).toBe(7) // STATS_EARLIER 是 8,盖上去就红
    expect(s.loading).toBe(false)
  })

  it('🔴 过期那一发先落地时,不许写 state、也不许把 loading 提前关掉(刷新按钮会提前解禁)', async () => {
    const d1 = deferred<ParserStatsBody>()
    const d2 = deferred<ParserStatsBody>()
    mockStatsDeferred(d1.promise, d2.promise)
    const s = useParserStore()
    const p1 = s.loadAll()
    const p2 = s.loadAll()

    d1.resolve(STATS_EARLIER) // 过期的那一发先回
    await flushPromises()
    // ↓ 无 finally 守卫时这里会是 false → 按钮/单选框在最新一发还没落地时就解禁了
    expect(s.loading).toBe(true)
    expect(s.stats).toEqual(INITIAL_STATS) // 也不许把它的数据写进来

    d2.resolve(STATS_NOW)
    await Promise.all([p1, p2])
    expect(s.loading).toBe(false)
    expect(s.stats).toEqual(STATS_NOW)
  })

  it('🔴 过期那一发失败时,不许写 unreachable / error(否则页面会在数据正常时报「不可达」)', async () => {
    const d1 = deferred<ParserStatsBody>()
    const d2 = deferred<ParserStatsBody>()
    mockStatsDeferred(d1.promise, d2.promise)
    const s = useParserStore()
    const p1 = s.loadAll()
    const p2 = s.loadAll()

    d2.resolve(STATS_NOW) // 最新那一发成功落地
    await flushPromises()
    expect(s.unreachable).toBe(false)

    d1.reject(new Error('stale boom')) // 过期那一发随后失败
    await Promise.all([p1, p2])
    expect(s.unreachable).toBe(false)
    expect(s.error).toBe(null)
    expect(s.loading).toBe(false)
    expect(s.stats).toEqual(STATS_NOW)
  })
})

describe('K33 过期守卫 ② —— 守卫变量必须 store 实例局部,不是模块级', () => {
  // 🔴 治理 §9.1(T3 评审 M-1 猎出的缺口):上一刀的产品代码是对的,但「守卫变量必须
  // 实例本地」这条不变量**零用例守着** —— 把 `seq` 挪到真模块级后,三条单实例交错用例
  // 照样全绿。模块级 epoch 的真实后果是:两个同时活着的 store 实例会互相把对方的请求
  // 判成过期(数据永远写不进去、`loading` 永远转)。本用例专守这一条。
  // 判据只有一个:把 `parserStore.ts` 里的 `let loadAllEpoch = 0` 挪到模块级 → 必须报红。
  it('两个 pinia 实例各自 loadAll 交错在飞 → 各自拿到自己的结果、互不覆盖、两边 loading 都收敛', async () => {
    const dA = deferred<ParserStatsBody>()
    const dB = deferred<ParserStatsBody>()
    mockStatsDeferred(dA.promise, dB.promise)

    const piniaA = createPinia()
    const piniaB = createPinia()
    setActivePinia(piniaA)
    const sA = useParserStore()
    setActivePinia(piniaB)
    const sB = useParserStore()
    expect(sA).not.toBe(sB)

    const pA = sA.loadAll() // 实例 A 在飞
    const pB = sB.loadAll() // 实例 B 在飞
    expect(ai.parserStats).toHaveBeenCalledTimes(2)

    // 交错:后发的 B 先回,再轮到 A —— 两个实例都不该被对方影响
    dB.resolve(STATS_NOW)
    await flushPromises()
    dA.resolve(STATS_EARLIER)
    await Promise.all([pA, pB])

    // ↓ 模块级 epoch 时,A 的 epoch(1) !== loadAllEpoch(2) → 整发被丢弃,stats 停在初值
    expect(sA.stats).toEqual(STATS_EARLIER)
    expect(sA.stats.indexed_files).toBe(8)
    expect(sB.stats).toEqual(STATS_NOW)
    expect(sB.stats.indexed_files).toBe(7)
    // ↓ 模块级 epoch 时,A 的 finally 正向判断不成立 → loading 永远转
    expect(sA.loading).toBe(false)
    expect(sB.loading).toBe(false)
  })
})
