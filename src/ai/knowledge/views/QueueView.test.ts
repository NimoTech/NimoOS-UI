// SP8-P5b Task 5 —— QueueView.vue「任务队列」页测试。
// 测试脚手架照 KnowledgeLayout.test.ts 的既有写法(治理文件 §9 明令:P5a T10 自己造的
// makeRouter 曾自递归致 DOM/生命周期翻倍,别自己造)——真 router(createWebHashHistory)
// + 真 Pinia + 真 i18n(不手写子集)+ vi.hoisted 的 @nimotech/nimoos-service mock(否则
// onMounted 会真发请求)。异步断言一律 flushPromises() + nextTick()。
//
// mock 形状来源(治理文件 §4,禁手编,逐个说明):
//   ai.parserJobs({status,limit})       —— pending/running 两桶取自 p5b-fixtures/
//     jobs-pending.json / jobs-running.json 原样(snake_case,service.ai.* 零转换,见 §4.1);
//     failed 桶真机是空的(jobs-failed.json:{"jobs":[]}),FAILED_JOBS 是本文件按同一 schema
//     (id/root_id/path/op/sub_modality/priority/attempts/last_error/locked_until/created_at/
//     picked_at/done_at,与 pending/running 两个真 fixture 逐字同一套字段名)人工构造的非空
//     场景,专门覆盖「{n}× retried」/last_error/重试按钮几条真机验不了的分支(治理 §4.5 已
//     登记:failed 桶真机恒空,只能 mock)。
//   ai.parserRetryJobs / parserDeleteJob / parserClearFailedJobs —— 分别照
//     jobs-retry-empty.http({"retried":0})· §4.1 axios 204 空体推定(mockResolvedValue(''))·
//     README「未实测 · 源码推定」段的 {"cleared": n} 形状(mockResolvedValue({cleared:0})）。
//   notes.listDistillJobs / getDistillStatus —— camelCase(包内已归一化,§4.2),真机队列为空
//     (distill-jobs.json/distill-status.json),DISTILL_PENDING/RUNNING/FAILED 三个非空数组按
//     README「distill job 行的字段(队列非空时)」段给出的字段名(filePath/status/origin/
//     attempts/lastError/enqueuedAt/updatedAt)人工构造,同样标注「源码推定,真机验不了」。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import QueueView from './QueueView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
// 守卫缺口③(附录 B §B.0.4)的定向断言要读 .vue 源文件本身 —— 一律 node:fs,不用
// Vite 的 ?raw(vitest 的 CSSEnablerPlugin 会把样式源整体替换成空串,断言会对空
// 字符串"假通过";先例见 knowledgeStyles.test.ts 头注释③)。本仓 package.json 是
// "type": "module" → __dirname 在 ESM 下不可用,改用 fileURLToPath + node:path 的
// 等价写法;本仓已装 @types/node(SP8-P6 合流自 master),逐行 @ts-expect-error 抑制 TS2307(照
// knowledgeStyles.test.ts 头注释①②的既定手法逐字复用)。
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const ai = vi.hoisted(() => ({
  parserJobs: vi.fn(),
  parserRetryJobs: vi.fn(),
  parserDeleteJob: vi.fn(),
  parserClearFailedJobs: vi.fn(),
}))
const notes = vi.hoisted(() => ({
  listDistillJobs: vi.fn(),
  getDistillStatus: vi.fn(),
  distillFile: vi.fn(),
  cancelDistillJob: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai, notes } }))

// ── fixture 数据(逐字取自 p5b-fixtures/jobs-pending.json / jobs-running.json)──
const PENDING_JOBS = [
  {
    id: 348, root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log', op: 'index', sub_modality: null,
    priority: 100, attempts: 0, last_error: null, locked_until: null,
    created_at: 1784776422853, picked_at: null, done_at: null,
  },
  {
    id: 347, root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log', op: 'index', sub_modality: null,
    priority: 100, attempts: 0, last_error: null, locked_until: null,
    created_at: 1784776420537, picked_at: null, done_at: null,
  },
  {
    id: 346, root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/opt/qdrant/storage/collections/agent_memory/0/wal/.atomicwritewmbpAO',
    op: 'delete', sub_modality: null, priority: 100, attempts: 0, last_error: null,
    locked_until: null, created_at: 1784776420537, picked_at: null, done_at: null,
  },
]
const RUNNING_JOBS = [
  {
    id: 10, root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log', op: 'index', sub_modality: null,
    priority: 100, attempts: 5, last_error: null, locked_until: 1785414048100,
    created_at: 1784424392938, picked_at: 1784438018718, done_at: null,
  },
]
// 人工构造(README 登记:failed 桶真机恒空,只能 mock),同一套字段名。
const FAILED_JOBS = [
  {
    id: 500, root_id: 'root-a', path: '/DATA/Docs/broken-1.pdf', op: 'index', sub_modality: null,
    priority: 100, attempts: 3, last_error: 'timeout talking to bge-m3', locked_until: null,
    created_at: 1784770000000, picked_at: null, done_at: 1784771000000,
  },
  {
    id: 501, root_id: 'root-a', path: '/DATA/Docs/broken-2.pdf', op: 'index', sub_modality: null,
    priority: 100, attempts: 0, last_error: null, locked_until: null,
    created_at: 1784772000000, picked_at: null, done_at: 1784772500000,
  },
]

// 人工构造的沉淀队列非空场景(README「distill job 行的字段」段给的字段名,源码推定)。
const DISTILL_PENDING = [
  { filePath: '/DATA/Notes/todo.md', status: 'pending', origin: 'auto', attempts: 0, lastError: '', enqueuedAt: 1784770000000, updatedAt: 1784770000000 },
]
const DISTILL_RUNNING = [
  { filePath: '/DATA/Notes/inflight.md', status: 'running', origin: 'manual', attempts: 1, lastError: '', enqueuedAt: 1784770000000, updatedAt: 1784771000000 },
]
const DISTILL_FAILED = [
  { filePath: '/DATA/Notes/failed.md', status: 'failed', origin: 'auto', attempts: 2, lastError: 'llm timeout', enqueuedAt: 1784770000000, updatedAt: 1784772000000 },
  { filePath: '/DATA/Notes/skipped.md', status: 'skipped', origin: 'manual', attempts: 0, lastError: '', enqueuedAt: 1784770000000, updatedAt: 1784772500000 },
]

function setupServiceMocks(): void {
  ai.parserJobs.mockImplementation(({ status }: { status: string }) => {
    if (status === 'pending') return Promise.resolve({ jobs: PENDING_JOBS })
    if (status === 'running') return Promise.resolve({ jobs: RUNNING_JOBS })
    if (status === 'failed') return Promise.resolve({ jobs: FAILED_JOBS })
    return Promise.resolve({ jobs: [] })
  })
  ai.parserRetryJobs.mockResolvedValue({ retried: 0 }) // jobs-retry-empty.http
  ai.parserDeleteJob.mockResolvedValue('') // §4.1:204 空体,axios res.data === ''
  ai.parserClearFailedJobs.mockResolvedValue({ cleared: 0 }) // README「源码推定」段

  notes.listDistillJobs.mockImplementation((filterArg: string) => {
    const counts = { pending: 1, running: 1, failed: 2 }
    if (filterArg === 'pending') return Promise.resolve({ jobs: DISTILL_PENDING, counts })
    if (filterArg === 'running') return Promise.resolve({ jobs: DISTILL_RUNNING, counts })
    if (filterArg === 'failed') return Promise.resolve({ jobs: DISTILL_FAILED, counts })
    return Promise.resolve({ jobs: [], counts })
  })
  notes.getDistillStatus.mockResolvedValue({ pending: 1, distilled: 0, quotaRemaining: 50, backgroundModel: '' })
  notes.distillFile.mockResolvedValue({})
  notes.cancelDistillJob.mockResolvedValue({ cancelled: true })
}

// K7:弹窗 portal 目标 —— QueueView 独立挂载时不在 .knowledge-app 子树里
// (生产环境由 KnowledgeLayout.vue 提供),测试须先在 body 里放一个同名宿主
// (先例 SkillDetail.test.ts::withHost())。
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

function makeRouter(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/ai/knowledge/queue', name: 'KnowledgeQueue', component: QueueView }],
  })
  router.push({ path: '/ai/knowledge/queue', query })
  return router
}

const flush = async () => {
  await flushPromises()
  await nextTick()
}

// 修复轮 1,M-4(评审指出):mountQueue() 挂载后此前从不 unmount ——每个用例都会
// 留下一个真实 setInterval(…, 10000)(QueueView.vue 的 10 秒轮询),定时器持有
// store/router 引用。当前整文件 ~1 秒跑完摸不到 10 秒边界,所以不 flaky;但后面
// T8/T9/T10 会往这个方向加大量用例,推广「生命周期」describe 里 :766 已经在做的
// unmount() 到公共脚手架,防止将来跑慢后漏出的 parserJobs 调用污染别的用例。
const mountedWrappers: Array<ReturnType<typeof mount>> = []

async function mountQueue(query: Record<string, string> = {}) {
  const router = makeRouter(query)
  await router.isReady()
  const w = mount(QueueView, { global: { plugins: [router, i18n] }, attachTo: document.body } as never)
  mountedWrappers.push(w)
  await flush()
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setupServiceMocks()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('QueueView — scope 切换(蓝本 :6-13)', () => {
  it('默认 scope=index,两个 pill 的 data-on 恰好一真一假', async () => {
    const { w } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    expect(pills[0].attributes('data-on')).toBe('true') // index
    expect(pills[1].attributes('data-on')).toBe('false') // distill
  })

  it('?scope=distill 深链:distill pill 为 true,index pill 为 false', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const pills = w.findAll('.k-filter-pill')
    expect(pills[0].attributes('data-on')).toBe('false')
    expect(pills[1].attributes('data-on')).toBe('true')
  })

  it('点击 distill pill 走 router.replace 带 scope=distill,再点 index 走回 scope=index', async () => {
    const { w, router } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    await pills[1].trigger('click')
    await flush()
    expect(router.currentRoute.value.query.scope).toBe('distill')
    expect(notes.listDistillJobs).toHaveBeenCalled()

    const pills2 = w.findAll('.k-filter-pill')
    await pills2[0].trigger('click')
    await flush()
    expect(router.currentRoute.value.query.scope).toBe('index')
  })

  it('已在当前 scope 时再点不重复加载(setScope 提前 return)', async () => {
    const { w } = await mountQueue()
    ai.parserJobs.mockClear()
    const pills = w.findAll('.k-filter-pill')
    await pills[0].trigger('click') // 已经是 index
    await flush()
    expect(ai.parserJobs).not.toHaveBeenCalled()
  })
})

describe('QueueView — 三桶 pill + 完成统计(蓝本 :16-39)', () => {
  it('index scope:三桶计数取自 store.stats.queue_depth,完成数取自 queue_depth.done', async () => {
    const { w } = await mountQueue()
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 5, running: 2, failed: 3, done: 1234 } }
    await flush()
    const pills = w.findAll('.k-filter-pill')
    expect(pills[2].find('.k-filter-pill-count').text()).toBe('5')
    expect(pills[3].find('.k-filter-pill-count').text()).toBe('2')
    expect(pills[4].find('.k-filter-pill-count').text()).toBe('3')
    expect(w.find('.k-done-stat-num b').text()).toBe('1,234')
  })

  it('distill scope:三桶计数取自 store.distillJobs.counts(由 loadDistillJobs 真实写入)', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const pills = w.findAll('.k-filter-pill')
    // notes.listDistillJobs mock 的 counts 固定 {pending:1,running:1,failed:2}
    expect(pills[2].find('.k-filter-pill-count').text()).toBe('1')
    expect(pills[3].find('.k-filter-pill-count').text()).toBe('1')
    expect(pills[4].find('.k-filter-pill-count').text()).toBe('2')
  })

  it('failed pill 静态 data-tone="danger",其余两个 pill 没有这个属性', async () => {
    const { w } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    expect(pills[4].attributes('data-tone')).toBe('danger')
    expect(pills[2].attributes('data-tone')).toBeUndefined()
    expect(pills[3].attributes('data-tone')).toBeUndefined()
  })

  it('切 filter pill:data-on 三选一互斥(五个 pill 逐一核对,不只测两项)', async () => {
    const { w } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    await pills[3].trigger('click') // running
    await flush()
    const after = w.findAll('.k-filter-pill')
    expect(after.map((p) => p.attributes('data-on'))).toEqual(['true', 'false', 'false', 'true', 'false'])
  })
})

describe('QueueView — 工具条(index scope,蓝本 :44-75)', () => {
  it('未选中态:data-selecting 为 false;filter!==failed 时不出批量按钮', async () => {
    const { w } = await mountQueue()
    const toolbar = w.find('.k-toolbar')
    expect(toolbar.attributes('data-selecting')).toBe('false')
    expect(w.find('.k-btn.outline').exists()).toBe(false)
  })

  it('filter=pending 未选中态文案:{n} pending jobs', async () => {
    const { w } = await mountQueue()
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 7, running: 0, failed: 0, done: 0 } }
    await flush()
    expect(w.find('.k-toolbar-label').text()).toBe('显示 7 个待处理任务')
  })

  it('filter=failed 未选中态:失败数为 0 时两个按钮都禁用', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const outline = w.find('.k-btn.outline')
    const ghost = w.find('.k-btn.ghost')
    expect(outline.attributes('disabled')).toBeDefined()
    expect(ghost.attributes('disabled')).toBeDefined()
  })

  it('filter=failed 未选中态:失败数 > 0 时两个按钮启用,清空按钮变红', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    const outline = w.find('.k-btn.outline')
    const ghost = w.find('.k-btn.ghost')
    expect(outline.attributes('disabled')).toBeUndefined()
    expect(ghost.attributes('disabled')).toBeUndefined()
    expect(ghost.attributes('style')).toContain('color: var(--danger)')
  })

  it('选中 >0 行:data-selecting 变 true,标签显示已选数', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w.find('.k-toolbar').attributes('data-selecting')).toBe('true')
    expect(w.find('.k-toolbar-label').text()).toBe('已选 1 项')
  })

  it('选中态:filter=failed 才出「重试选中」;非 failed 不出', async () => {
    const s = useKnowledgeStore()
    // pending 场景
    const { w } = await mountQueue()
    s.stats = { ...s.stats, queue_depth: { pending: 3, running: 0, failed: 0, done: 0 } }
    await flush()
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w.find('.k-btn.primary').exists()).toBe(false)

    // failed 场景
    const { w: w2 } = await mountQueue({ filter: 'failed' })
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    await w2.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w2.find('.k-btn.primary').exists()).toBe(true)
  })

  it('选中态:filter=failed 时次按钮文案是「清空选中」,否则是「取消选中」', async () => {
    const s = useKnowledgeStore()
    const { w } = await mountQueue()
    s.stats = { ...s.stats, queue_depth: { pending: 3, running: 0, failed: 0, done: 0 } }
    await flush()
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w.find('.k-toolbar .k-btn.ghost').text()).toContain('取消选中')

    const { w: w2 } = await mountQueue({ filter: 'failed' })
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    await w2.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w2.find('.k-toolbar .k-btn.ghost').text()).toContain('清空选中')
  })

  it('「取消」按钮清空选择', async () => {
    const s = useKnowledgeStore()
    const { w } = await mountQueue()
    s.stats = { ...s.stats, queue_depth: { pending: 3, running: 0, failed: 0, done: 0 } }
    await flush()
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w.find('.k-toolbar').attributes('data-selecting')).toBe('true')
    const ghosts = w.findAll('.k-toolbar .k-btn.ghost')
    const cancelBtn = ghosts[ghosts.length - 1]
    await cancelBtn.trigger('click')
    await flush()
    expect(w.find('.k-toolbar').attributes('data-selecting')).toBe('false')
  })
})

describe('QueueView — 工具条(distill scope,蓝本 :76-82)', () => {
  it('只有一行 label,没有任何批量操作按钮', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const toolbar = w.find('.k-toolbar')
    expect(toolbar.attributes('data-selecting')).toBeUndefined()
    expect(toolbar.findAll('button')).toHaveLength(0)
    expect(toolbar.find('.k-toolbar-label').text()).toBe('显示 1 个待处理任务')
  })
})

describe('QueueView — 空态(蓝本 :85-98,K16)', () => {
  it('failed 桶空(index scope):🎉 全部处理完了 + 索引服务正常提示', async () => {
    // 真机 failed 桶恒空(jobs-failed.json:{"jobs":[]}),覆盖这条空态分支须临时
    // 把默认 mock(为其它用例准备的 FAILED_JOBS 非空场景)换回真机原样的空数组。
    ai.parserJobs.mockImplementation(({ status }: { status: string }) => {
      if (status === 'pending') return Promise.resolve({ jobs: PENDING_JOBS })
      if (status === 'running') return Promise.resolve({ jobs: RUNNING_JOBS })
      return Promise.resolve({ jobs: [] })
    })
    const { w } = await mountQueue({ filter: 'failed' })
    expect(w.find('.k-empty-title').text()).toBe('🎉 全部处理完了')
    expect(w.find('.k-empty-sub').text()).toBe('全部正常，索引服务运行中。')
  })

  it('failed 桶空(distill scope):文案换成「没有沉淀失败的任务」', async () => {
    notes.listDistillJobs.mockImplementation((f: string) =>
      Promise.resolve({ jobs: [], counts: { pending: 1, running: 1, failed: 0 } }),
    )
    const { w } = await mountQueue({ scope: 'distill', filter: 'failed' })
    expect(w.find('.k-empty-sub').text()).toBe('没有沉淀失败的任务。')
  })

  it('K16:pending 桶空 → 「队列为空」+ 英文原文 aiKbQueueAllPendingDone(两档同填英文)', async () => {
    ai.parserJobs.mockImplementation(({ status }: { status: string }) => Promise.resolve({ jobs: [] }))
    const { w } = await mountQueue()
    expect(w.find('.k-empty-title').text()).toBe('队列为空')
    expect(w.find('.k-empty-sub').text()).toBe('All pending jobs are done.')
  })

  it('K16:running 桶空 → 「暂无处理中任务」+ 英文原文 aiKbQueueNoRunningNow(两侧对照,非 pending 分支)', async () => {
    ai.parserJobs.mockImplementation(({ status }: { status: string }) => Promise.resolve({ jobs: [] }))
    const { w } = await mountQueue({ filter: 'running' })
    expect(w.find('.k-empty-title').text()).toBe('暂无处理中任务')
    expect(w.find('.k-empty-sub').text()).toBe('No jobs running right now.')
  })
})

describe('QueueView — index 表格(蓝本 :100-140)', () => {
  it('表头文案与列数正确', async () => {
    const { w } = await mountQueue()
    const head = w.find('.k-row-head')
    const spans = head.findAll('span')
    expect(spans[1].text()).toBe('文件')
    expect(spans[2].text()).toBe('路径')
    expect(spans[3].text()).toBe('时间')
  })

  it('filter=failed 时表头第 5 列显示「重试」,否则为空', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const head = w.find('.k-row-head')
    expect(head.findAll('span')[4].text()).toBe('重试')

    const { w: w2 } = await mountQueue()
    const head2 = w2.find('.k-row-head')
    expect(head2.findAll('span')[4].text()).toBe('')
  })

  it('全选 checkbox:两侧(全选/取消全选)都覆盖', async () => {
    const { w } = await mountQueue()
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    expect(rows).toHaveLength(3) // PENDING_JOBS 3 行
    const selectAll = w.find('.k-row-head .k-row-check')
    expect((selectAll.element as HTMLInputElement).checked).toBe(false)
    await selectAll.trigger('change')
    await flush()
    expect((w.find('.k-row-head .k-row-check').element as HTMLInputElement).checked).toBe(true)
    await w.find('.k-row-head .k-row-check').trigger('change')
    await flush()
    expect((w.find('.k-row-head .k-row-check').element as HTMLInputElement).checked).toBe(false)
  })

  it('data-selected 两侧都覆盖:选中行为 true,未选中行为 false', async () => {
    const { w } = await mountQueue()
    const bodyRows = () => w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    bodyRows().forEach((r) => expect(r.attributes('data-selected')).toBe('false'))
    await bodyRows()[0].find('.k-row-check').trigger('change')
    await flush()
    const after = bodyRows()
    expect(after[0].attributes('data-selected')).toBe('true')
    expect(after[1].attributes('data-selected')).toBe('false')
  })

  it('basename/dirname/fmtAgo 渲染正确(K11:fmtAgo 来自 store,非 util)', async () => {
    const { w } = await mountQueue()
    const row = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    expect(row.find('.k-row-name').text()).toBe('nimoos_panic.log')
    expect(row.find('.k-row-path').text()).toBe('/DATA/.system_data/tmp/')
    // created_at 1784776422853 是很久以前的时间戳,应落在「N 天前」档
    expect(row.find('.k-row-time').text()).toMatch(/天前$/)
  })

  it('filter=failed:{n}× retried 与 last_error 只在 attempts>0 / last_error 非空时渲染', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    expect(rows[0].find('.k-row-retry').text()).toContain('3× 重试')
    expect(rows[0].find('.k-row-retry').text()).toContain('timeout talking to bge-m3')
    // FAILED_JOBS[1] attempts=0 且 last_error=null —— 两侧都要有对照
    expect(rows[1].find('.k-row-retry').text()).toBe('')
  })

  it('行操作:pending→取消按钮(data-tone=danger)调用 store.cancelJob,failed→重试按钮触发 K18 全桶重试', async () => {
    const { w } = await mountQueue()
    const row = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    const cancelBtn = row.find('.k-row-action')
    expect(cancelBtn.attributes('data-tone')).toBe('danger')
    await cancelBtn.trigger('click')
    await flush()
    expect(ai.parserDeleteJob).toHaveBeenCalledWith(348)

    const { w: w2 } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    const row2 = w2.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    const retryBtn = row2.find('.k-row-action')
    expect(retryBtn.attributes('data-tone')).toBeUndefined() // 重试按钮没有这个属性,两侧对照
    await retryBtn.trigger('click')
    await flush()
    // K18:retryOne 不再拼 row.file_id/row.id,一律 retryFailed(null)
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: null })
  })

  it('data-state 三态各自渲染正确的图标(pending/running/failed)', async () => {
    const { w } = await mountQueue()
    expect(w.find('.k-row-status').attributes('data-state')).toBe('pending')
    const { w: w2 } = await mountQueue({ filter: 'running' })
    expect(w2.find('.k-row-status').attributes('data-state')).toBe('running')
    const { w: w3 } = await mountQueue({ filter: 'failed' })
    expect(w3.find('.k-row-status').attributes('data-state')).toBe('failed')
  })

  it('截断提示:边界 199/200 两侧都覆盖(rows.length >= 200)', async () => {
    const make = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: i, path: `/DATA/f${i}.txt`, created_at: 1784776422853,
      }))
    const { w } = await mountQueue()
    const s = useKnowledgeStore()
    s.jobs = { ...s.jobs, pending: make(199) as never }
    await flush()
    expect(w.find('.k-table-foot').exists()).toBe(false)
    s.jobs = { ...s.jobs, pending: make(200) as never }
    await flush()
    expect(w.find('.k-table-foot').exists()).toBe(true)
    expect(w.find('.k-table-foot').text()).toContain('仅展示前 200 条')
  })
})

describe('QueueView — distill 表格(蓝本 :145-185)', () => {
  it('专属栅格 data-scope="distill" 出现在表头与每一行;index 行完全没有这个属性(两侧对照)', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    expect(w.find('.k-row-head').attributes('data-scope')).toBe('distill')
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    rows.forEach((r) => expect(r.attributes('data-scope')).toBe('distill'))

    const { w: w2 } = await mountQueue()
    const indexRow = w2.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    expect(indexRow.attributes('data-scope')).toBeUndefined()
  })

  it('没有 checkbox 列', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    expect(w.find('.k-row-check').exists()).toBe(false)
  })

  it('表头文案:File/Path/Status/Error/Time(Error 复用 aiKbStatusError,Vue2 同一个 $t("Error") 字面量)', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const spans = w.find('.k-row-head').findAll('span')
    expect(spans[1].text()).toBe('文件')
    expect(spans[2].text()).toBe('路径')
    expect(spans[3].text()).toBe('状态')
    expect(spans[4].text()).toBe('错误')
    expect(spans[5].text()).toBe('时间')
  })

  it('kn-badge 徽标:manual→curated,auto→archived(两侧对照)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    const badge = w.find('.kn-badge')
    expect(badge.attributes('data-s')).toBe('archived') // DISTILL_PENDING[0].origin='auto'
    expect(badge.text()).toBe('自动')

    const { w: w2 } = await mountQueue({ scope: 'distill', filter: 'running' })
    const badge2 = w2.find('.kn-badge')
    expect(badge2.attributes('data-s')).toBe('curated') // DISTILL_RUNNING[0].origin='manual'
    expect(badge2.text()).toBe('手动')
  })

  it('failed 桶两行:一行 status=failed 出「已失败」徽标,一行 status=skipped 出「已跳过」徽标(两侧对照)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'failed' })
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    const badges0 = rows[0].findAll('.kn-badge')
    expect(badges0[1].attributes('data-s')).toBe('failed')
    expect(badges0[1].text()).toBe('已失败')
    const badges1 = rows[1].findAll('.kn-badge')
    expect(badges1[1].attributes('data-s')).toBe('draft')
    expect(badges1[1].text()).toBe('已跳过')
  })

  it('data-state 用 distillIconState:pending/running 直读,failed 与 skipped 共用 failed(K12 照抄)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    expect(w.find('.k-row-status').attributes('data-state')).toBe('pending')
    const { w: w2 } = await mountQueue({ scope: 'distill', filter: 'running' })
    expect(w2.find('.k-row-status').attributes('data-state')).toBe('running')
    const { w: w3 } = await mountQueue({ scope: 'distill', filter: 'failed' })
    const states = w3.findAll('.k-row-status').map((el) => el.attributes('data-state'))
    expect(states).toEqual(['failed', 'failed']) // status=failed 与 status=skipped 都落 'failed'
  })

  it('行操作:pending→取消调用 cancelDistillJob,failed/skipped→重试调用 distillFile', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    await w.find('.k-row-action').trigger('click')
    await flush()
    expect(notes.cancelDistillJob).toHaveBeenCalledWith('/DATA/Notes/todo.md')

    const { w: w2 } = await mountQueue({ scope: 'distill', filter: 'failed' })
    const rows = w2.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    await rows[0].find('.k-row-action').trigger('click')
    await flush()
    expect(notes.distillFile).toHaveBeenCalledWith('/DATA/Notes/failed.md')
    await rows[1].find('.k-row-action').trigger('click')
    await flush()
    expect(notes.distillFile).toHaveBeenCalledWith('/DATA/Notes/skipped.md')
  })

  // 修复轮 1,M-1(协调者裁定):409 分支保留蓝本 `'Cancel failed: ' + msg` 前缀,
  // 不是纯 aiKbCannotCancel 独立一句。钉住完整拼接文案,防止将来又被"顺手简化"。
  it('cancelDistillRow 409(已不可取消):toast 是完整拼接 "取消失败: 该任务已无法取消。"(M-1)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    const s = useKnowledgeStore()
    const toast = vi.spyOn(s, 'toast')
    notes.cancelDistillJob.mockRejectedValueOnce({ response: { status: 409 } })
    await w.find('.k-row-action').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('取消失败: 该任务已无法取消。')
  })

  it('cancelDistillRow 其它错误(非 409):按 K5 只出固定 aiKbCancelFailed,不拼接前缀(两侧对照)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    const s = useKnowledgeStore()
    const toast = vi.spyOn(s, 'toast')
    notes.cancelDistillJob.mockRejectedValueOnce(new Error('network down'))
    await w.find('.k-row-action').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('取消失败')
  })

  it('截断提示 distillTruncated 边界:total=499 不出,total=500(DISTILL_JOBS_LIMIT)才出 —— RED 探针②的钉子', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const s = useKnowledgeStore()
    s.distillJobs = { ...s.distillJobs, total: 499 }
    await flush()
    expect(w.find('.k-table-foot').exists()).toBe(false)
    s.distillJobs = { ...s.distillJobs, total: 500 }
    await flush()
    expect(w.find('.k-table-foot').exists()).toBe(true)
    expect(w.find('.k-table-foot').text()).toContain('仅展示前 500 条')
  })
})

describe('QueueView — 6 种 scope × filter 组合(DoD 明确要求)', () => {
  // 修复轮 1,M-2(评审指出):原来的 `hasTable !== hasEmpty` 是恒真断言 ——
  // 模板 `:387`/`:423`/`:497` 是 v-if/v-else-if/v-else 的三选一互斥链,结构上
  // 永远恰好渲染 .k-table 与 .k-empty 中的一个,无论实现怎么错都不会红(治理
  // §9「禁空转用例」)。且默认 mock 让六种组合全部有行,空态侧从没被走到过。
  // 改成每种组合各自的判别性断言(行数 / 首行内容 / 徽标值),外加一条独立的
  // 空态侧组合用例。
  type W = Awaited<ReturnType<typeof mountQueue>>['w']
  const combos: Array<{ scope?: string; filter: string; assertRows: (w: W) => void }> = [
    {
      filter: 'pending',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(3) // PENDING_JOBS 长度
      },
    },
    {
      filter: 'running',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(1) // RUNNING_JOBS 长度
      },
    },
    {
      filter: 'failed',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(2) // FAILED_JOBS 长度
        expect(rows[0].find('.k-row-retry').text()).toContain('3× 重试') // FAILED_JOBS[0].attempts=3
      },
    },
    {
      scope: 'distill',
      filter: 'pending',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(1) // DISTILL_PENDING 长度
        expect(rows[0].find('.kn-badge').attributes('data-s')).toBe('archived') // origin='auto'
      },
    },
    {
      scope: 'distill',
      filter: 'running',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(1) // DISTILL_RUNNING 长度
        expect(rows[0].find('.kn-badge').attributes('data-s')).toBe('curated') // origin='manual'
      },
    },
    {
      scope: 'distill',
      filter: 'failed',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(2) // DISTILL_FAILED:一行 failed,一行 skipped
        const tones = rows.map((r) => r.findAll('.kn-badge')[1].attributes('data-s'))
        expect(tones).toEqual(['failed', 'draft'])
      },
    },
  ]
  for (const c of combos) {
    it(`scope=${c.scope || 'index'} filter=${c.filter}:pill 状态一致 + 行数/内容判别性断言(不是二选一恒真式)`, async () => {
      const query: Record<string, string> = { filter: c.filter }
      if (c.scope) query.scope = c.scope
      const { w } = await mountQueue(query)
      const pills = w.findAll('.k-filter-pill')
      const expectedScopeIdx = c.scope === 'distill' ? 1 : 0
      expect(pills[expectedScopeIdx].attributes('data-on')).toBe('true')
      const filterIdx = { pending: 2, running: 3, failed: 4 }[c.filter as 'pending' | 'running' | 'failed']
      expect(pills[filterIdx].attributes('data-on')).toBe('true')
      c.assertRows(w)
    })
  }

  it('空态侧组合(补 M-2):三桶全空时 .k-empty 出现、.k-table 不出现,文案正确', async () => {
    ai.parserJobs.mockImplementation(() => Promise.resolve({ jobs: [] }))
    const { w } = await mountQueue({ filter: 'pending' })
    expect(w.find('.k-empty').exists()).toBe(true)
    expect(w.find('.k-table').exists()).toBe(false)
    expect(w.find('.k-empty-title').text()).toBe('队列为空')
  })
})

describe('QueueView — K18:三个重试入口统一调用 store.retryFailed(null)', () => {
  it('retryOne(单行重试按钮)', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    const toast = vi.spyOn(s, 'toast')
    const row = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    await row.find('.k-row-action').trigger('click')
    await flush()
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: null })
    expect(toast).toHaveBeenCalledWith('已重试全部失败任务')
  })

  it('bulkRetry(批量重试按钮)—— 与蓝本原文「fileIds 恒空数组、一个请求都不发」的假成功不同,真发请求', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    const toast = vi.spyOn(s, 'toast')
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    await w.find('.k-btn.primary').trigger('click')
    await flush()
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: null })
    expect(toast).toHaveBeenCalledWith('已重试全部失败任务')
  })

  it('retryAllFailed(工具条「重试所有失败的」按钮)', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    const toast = vi.spyOn(s, 'toast')
    await w.find('.k-btn.outline').trigger('click')
    await flush()
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: null })
    expect(toast).toHaveBeenCalledWith('已重试全部失败任务')
  })
})

describe('QueueView — K7:清空失败确认弹窗(reka Dialog 原语)', () => {
  it('点击「清空失败记录」打开弹窗(portal 到 .knowledge-app),标题/正文/按钮正确', async () => {
    const host = withHost()
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 3, done: 0 } }
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
    await w.find('.k-btn.ghost').trigger('click')
    await flush()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(modal!.querySelector('.k-confirm-title')!.textContent).toBe('清空失败记录？')
    expect(modal!.querySelector('.k-confirm-body div:last-child')!.textContent).toBe(
      '这将永久删除 3 条失败记录。',
    )
  })

  it('点「取消」关闭弹窗且不调用 clearFailed', async () => {
    const host = withHost()
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 1, done: 0 } }
    await flush()
    await w.find('.k-btn.ghost').trigger('click')
    await flush()
    const cancelBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => b.textContent === '取消',
    ) as HTMLElement
    cancelBtn.click()
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.parserClearFailedJobs).not.toHaveBeenCalled()
  })

  it('点「确认清空」调用 store.clearFailed 并关闭弹窗、弹 toast', async () => {
    const host = withHost()
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 1, done: 0 } }
    await flush()
    const toast = vi.spyOn(s, 'toast')
    await w.find('.k-btn.ghost').trigger('click')
    await flush()
    const confirmBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('确认清空'),
    ) as HTMLElement
    confirmBtn.click()
    await flush()
    expect(ai.parserClearFailedJobs).toHaveBeenCalled()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(toast).toHaveBeenCalledWith('已清空 1 条失败记录')
  })

  // 修复轮 1,M-3(评审指出):蓝本 `:190-191` 靠 `.k-modal-bg` 的
  // `@click="confirmClear=false"` + `.k-modal` 的 `@click.stop` 实现「点遮罩关闭、
  // 点弹窗内不关闭」;换成 reka 后由 DialogContent 的 pointerDownOutside 提供等价
  // 行为,但此前三条用例(打开/取消/确认)没有一条覆盖这个机制本身。补上。
  it('点遮罩(弹窗外部)关闭;点弹窗内部不关闭(reka pointerDownOutside 等价蓝本 @click/@click.stop)', async () => {
    const host = withHost()
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 1, done: 0 } }
    await flush()
    await w.find('.k-btn.ghost').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    // reka 的 usePointerDownOutside 用 setTimeout(0) 延后挂 document 的 pointerdown
    // 监听(避免打开弹窗那次 pointerdown 冒泡到 document 上把自己立刻关掉,见
    // node_modules/reka-ui/dist/DismissableLayer/utils.js 头注释),这是真实宏任务,
    // flushPromises()/nextTick() 只刷微任务刷不到,补一次真 setTimeout tick。
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 点弹窗内部(.k-confirm-title,DialogContent 子树内)不应关闭。
    const titleEl = host.querySelector('.k-confirm-title') as HTMLElement
    titleEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    // 点遮罩(.k-modal-bg 本身,DialogOverlay,弹窗外部)应关闭。
    const overlayEl = host.querySelector('.k-modal-bg') as HTMLElement
    overlayEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
  })
})

describe('QueueView — 深链契约(?filter= watcher 立即生效)', () => {
  it('挂载后 router.replace 改 query.filter,pill 与内容随之切换(非仅初始 immediate)', async () => {
    const { w, router } = await mountQueue()
    expect(w.findAll('.k-filter-pill')[2].attributes('data-on')).toBe('true') // pending
    await router.replace({ query: { filter: 'running' } })
    await flush()
    expect(w.findAll('.k-filter-pill')[3].attributes('data-on')).toBe('true') // running
    expect(w.findAll('.k-filter-pill')[2].attributes('data-on')).toBe('false')
  })
})

describe('QueueView — 生命周期:10 秒轮询', () => {
  it('挂载即加载一次;10s 轮询;document.hidden 时跳过;卸载清定时器', async () => {
    // 照 KnowledgeLayout.test.ts 的既有写法:onMounted 里的 loadForScope() 是同步
    // 发起调用(Promise.all 内部的 service.ai.parserJobs(...) 三次调用是同步触发的,
    // 只是各自的 resolve 走微任务),不需要 runOnlyPendingTimersAsync 去"催"它——
    // 那个 API 会把尚未到期的 setInterval 也提前打一次,导致误判成 6 次调用。
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const router = makeRouter()
    await router.isReady()
    const w = mount(QueueView, { global: { plugins: [router, i18n] } } as never)
    expect(ai.parserJobs).toHaveBeenCalledTimes(3) // pending+running+failed 三桶并行

    ai.parserJobs.mockClear()
    vi.advanceTimersByTime(10000)
    expect(ai.parserJobs).toHaveBeenCalledTimes(3)

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    ai.parserJobs.mockClear()
    vi.advanceTimersByTime(10000)
    expect(ai.parserJobs).not.toHaveBeenCalled()
    hidden.mockReturnValue(false)

    ai.parserJobs.mockClear()
    vi.advanceTimersByTime(10000)
    expect(ai.parserJobs).toHaveBeenCalledTimes(3)

    w.unmount()
    ai.parserJobs.mockClear()
    vi.advanceTimersByTime(30000)
    expect(ai.parserJobs).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('QueueView — 守卫缺口③:<template> 块零裸色字面量', () => {
  // 治理文件附录 B §B.0.4:color-guard.test.ts 的 styleLines() 对 .vue 只取
  // <style> 块,模板 style="…" 属性零扫描;本文件补一条定向断言堵这个盲区。
  // 读文件手法见文件头注释(node:fs + fileURLToPath,__ts-expect-error 抑制)。
  it('<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量', () => {
    const src: string = readFileSync(resolve(__dirname, './QueueView.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]

    // 剥掉 var(...) 与 color-mix(...) 的内部(照 color-guard.test.ts 的 stripVar 同款
    // 手法:逐字符扫描配对括号深度,支持嵌套 fallback),防止 color-mix(in srgb,
    // var(--success) 20%, transparent) 里的 token 名 / 关键字被拿去和裸色正则误判。
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
})
