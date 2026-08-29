// SP8-P5b Task 5 — QueueView.vue "Task Queue" page tests.
// Test scaffolding follows the existing pattern in KnowledgeLayout.test.ts (governance
// document §9 explicitly requires: P5a T10 custom makeRouter once caused recursive DOM/
// lifecycle doubling, don't create your own) — true router(createWebHashHistory)
// + true Pinia + true i18n (not hardcoded subset) + vi.hoisted @nimotech/nimoos-service
// mock (otherwise onMounted will actually make requests). All async assertions use
// flushPromises() + nextTick().
//
// Mock shape sources (governance document §4, no hardcoding, each explained):
//   ai.parserJobs({status,limit})       — pending/running buckets taken as-is from
//     p5b-fixtures/jobs-pending.json / jobs-running.json (snake_case, no service.ai.*
//     transform, see §4.1); failed bucket is empty on device (jobs-failed.json:{"jobs":[]}),
//     FAILED_JOBS is this file's non-empty scenario manually constructed per the same
//     schema (id/root_id/path/op/sub_modality/priority/attempts/last_error/locked_until/
//     created_at/picked_at/done_at, identical field names to the two real fixtures), to
//     cover "{n}× retried"/last_error/retry button branches that cannot be tested on device
//     (governance §4.5 registered: failed bucket always empty on device, mock only).
//   ai.parserRetryJobs / parserDeleteJob / parserClearFailedJobs — follow jobs-retry-empty.http
//     ({"retried":0}) · §4.1 axios 204 empty-body assumption (mockResolvedValue('')) ·
//     README "untested · inferred from source" section's {"cleared": n} shape
//     (mockResolvedValue({cleared:0})).
//   notes.listDistillJobs / getDistillStatus — camelCase (normalized in package, §4.2),
//     device queue empty (distill-jobs.json/distill-status.json), DISTILL_PENDING/RUNNING/
//     FAILED three non-empty arrays manually constructed per README "distill job row fields
//     (when queue non-empty)" section's field names (filePath/status/origin/attempts/
//     lastError/enqueuedAt/updatedAt), likewise marked "inferred from source, untested on device".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import QueueView from './QueueView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
// Guard gap ③ (appendix B §B.0.4) assertions must read .vue source files themselves — all
// use node:fs, not Vite's ?raw (vitest's CSSEnablerPlugin replaces the style source with
// an empty string entirely, assertions will "falsely pass" on empty string; example in
// knowledgeStyles.test.ts top comment ③). This repo's package.json is "type": "module"
// → __dirname unavailable under ESM, use fileURLToPath + node:path equivalent instead.
// Type declarations for node: prefixed modules provided by `@types/node`, already installed
// in this repo (SP8-P6 merged from master), vue-tsc passes directly, **does not need**
// any `@ts-expect-error` suppression (the original suppression lines on the sp8-ai branch
// were deleted at merge;
// see knowledgeStyles.test.ts top comments ①②).
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) ──
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

// ── fixture data (taken verbatim from p5b-fixtures/jobs-pending.json / jobs-running.json) ──
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
// Manually constructed (README registered: failed bucket always empty on device, mock only), same set of field names.
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

// Manually constructed distill queue non-empty scenario (README "distill job row fields" section's field names, inferred from source).
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
  ai.parserDeleteJob.mockResolvedValue('') // §4.1: 204 empty body, axios res.data === ''
  ai.parserClearFailedJobs.mockResolvedValue({ cleared: 0 }) // README's "inferred from source" section

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

// K7: modal portal target — when QueueView is mounted independently, it's not in the
// .knowledge-app subtree (provided by KnowledgeLayout.vue in production); tests must first
// place a same-named host in body (example SkillDetail.test.ts::withHost()).
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

function makeRouter(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHashHistory('/'),
    routes: [{ path: '/ai/knowledge/queue', name: 'KnowledgeQueue', component: QueueView }],
  })
  router.push({ path: '/ai/knowledge/queue', query })
  return router
}

const flush = async () => {
  await flushPromises()
  await nextTick()
}

// Fix round 1, M-4 (review feedback): mountQueue() previously never unmounted after
// mounting — each test case would leave behind one real setInterval(…, 10000) (QueueView.vue's
// 10-second polling), with the timer holding store/router references. Currently the whole
// file runs in ~1 second, so we don't hit the 10-second boundary and avoid flakiness; but
// T8/T9/T10 will add many test cases in this direction, promoting the unmount() that the
// "lifecycle" describe block at :766 already does to common scaffolding, to prevent slower
// runs later from leaking parserJobs calls that pollute other test cases.
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

describe('QueueView — scope toggle (spec :6-13)', () => {
  it('default scope=index, two pills data-on is exactly one true, one false', async () => {
    const { w } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    expect(pills[0].attributes('data-on')).toBe('true') // index
    expect(pills[1].attributes('data-on')).toBe('false') // distill
  })

  it('?scope=distill deep link: distill pill is true, index pill is false', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const pills = w.findAll('.k-filter-pill')
    expect(pills[0].attributes('data-on')).toBe('false')
    expect(pills[1].attributes('data-on')).toBe('true')
  })

  it('click distill pill goes via router.replace with scope=distill, click index again returns to scope=index', async () => {
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

  it('when already at current scope, clicking again does not reload (setScope returns early)', async () => {
    const { w } = await mountQueue()
    ai.parserJobs.mockClear()
    const pills = w.findAll('.k-filter-pill')
    await pills[0].trigger('click') // already at that index
    await flush()
    expect(ai.parserJobs).not.toHaveBeenCalled()
  })
})

describe('QueueView — three buckets pill + completion stats (spec :16-39)', () => {
  it('index scope: three bucket counts from store.stats.queue_depth, completion count from queue_depth.done', async () => {
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

  it('distill scope: three bucket counts from store.distillJobs.counts (written by loadDistillJobs)', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const pills = w.findAll('.k-filter-pill')
    // notes.listDistillJobs mock's counts fixed {pending:1,running:1,failed:2}
    expect(pills[2].find('.k-filter-pill-count').text()).toBe('1')
    expect(pills[3].find('.k-filter-pill-count').text()).toBe('1')
    expect(pills[4].find('.k-filter-pill-count').text()).toBe('2')
  })

  it('failed pill has static data-tone="danger", other two pills do not have this attribute', async () => {
    const { w } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    expect(pills[4].attributes('data-tone')).toBe('danger')
    expect(pills[2].attributes('data-tone')).toBeUndefined()
    expect(pills[3].attributes('data-tone')).toBeUndefined()
  })

  it('switch filter pill: data-on is mutually exclusive three-way (check five pills individually, not just two)', async () => {
    const { w } = await mountQueue()
    const pills = w.findAll('.k-filter-pill')
    await pills[3].trigger('click') // running
    await flush()
    const after = w.findAll('.k-filter-pill')
    expect(after.map((p) => p.attributes('data-on'))).toEqual(['true', 'false', 'false', 'true', 'false'])
  })
})

describe('QueueView — toolbar (index scope, spec :44-75)', () => {
  it('unselected state: data-selecting is false; no batch buttons when filter!==failed', async () => {
    const { w } = await mountQueue()
    const toolbar = w.find('.k-toolbar')
    expect(toolbar.attributes('data-selecting')).toBe('false')
    expect(w.find('.k-btn.outline').exists()).toBe(false)
  })

  it('filter=pending unselected state text: {n} pending jobs', async () => {
    const { w } = await mountQueue()
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 7, running: 0, failed: 0, done: 0 } }
    await flush()
    expect(w.find('.k-toolbar-label').text()).toBe('显示 7 个待处理任务')
  })

  it('filter=failed unselected state: both buttons disabled when failed count is 0', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const outline = w.find('.k-btn.outline')
    const ghost = w.find('.k-btn.ghost')
    expect(outline.attributes('disabled')).toBeDefined()
    expect(ghost.attributes('disabled')).toBeDefined()
  })

  it('filter=failed unselected state: both buttons enabled when failed count > 0, clear button turns red', async () => {
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

  it('select >0 rows: data-selecting becomes true, label shows selection count', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w.find('.k-toolbar').attributes('data-selecting')).toBe('true')
    expect(w.find('.k-toolbar-label').text()).toBe('已选 1 项')
  })

  it('selected state: "retry selection" only appears for filter=failed; absent otherwise', async () => {
    const s = useKnowledgeStore()
    // pending scenario
    const { w } = await mountQueue()
    s.stats = { ...s.stats, queue_depth: { pending: 3, running: 0, failed: 0, done: 0 } }
    await flush()
    await w.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w.find('.k-btn.primary').exists()).toBe(false)

    // failed scenario
    const { w: w2 } = await mountQueue({ filter: 'failed' })
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 2, done: 0 } }
    await flush()
    await w2.findAll('.k-row-check')[1].trigger('change')
    await flush()
    expect(w2.find('.k-btn.primary').exists()).toBe(true)
  })

  it('selected state: when filter=failed, secondary button text is "clear selection"; otherwise "deselect"', async () => {
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

  it('"cancel" button clears selection', async () => {
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

describe('QueueView — toolbar (distill scope, spec :76-82)', () => {
  it('only one label row, no batch operation buttons at all', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const toolbar = w.find('.k-toolbar')
    expect(toolbar.attributes('data-selecting')).toBeUndefined()
    expect(toolbar.findAll('button')).toHaveLength(0)
    expect(toolbar.find('.k-toolbar-label').text()).toBe('显示 1 个待处理任务')
  })
})

describe('QueueView — empty state (spec :85-98, K16)', () => {
  it('failed bucket empty (index scope): 🎉 all done + indexing service running normally', async () => {
    // device failed bucket always empty (jobs-failed.json:{"jobs":[]}), to cover this empty
    // state branch must temporarily swap default mock (non-empty FAILED_JOBS scenario for other
    // tests) back to device's empty array.
    ai.parserJobs.mockImplementation(({ status }: { status: string }) => {
      if (status === 'pending') return Promise.resolve({ jobs: PENDING_JOBS })
      if (status === 'running') return Promise.resolve({ jobs: RUNNING_JOBS })
      return Promise.resolve({ jobs: [] })
    })
    const { w } = await mountQueue({ filter: 'failed' })
    expect(w.find('.k-empty-title').text()).toBe('🎉 全部处理完了')
    expect(w.find('.k-empty-sub').text()).toBe('全部正常，索引服务运行中。')
  })

  it('failed bucket empty (distill scope): text changes to "no distill failed tasks"', async () => {
    notes.listDistillJobs.mockImplementation((f: string) =>
      Promise.resolve({ jobs: [], counts: { pending: 1, running: 1, failed: 0 } }),
    )
    const { w } = await mountQueue({ scope: 'distill', filter: 'failed' })
    expect(w.find('.k-empty-sub').text()).toBe('没有沉淀失败的任务。')
  })

  it('K16: pending bucket empty → "queue empty" + English original aiKbQueueAllPendingDone (both filled with English)', async () => {
    ai.parserJobs.mockImplementation(({ status }: { status: string }) => Promise.resolve({ jobs: [] }))
    const { w } = await mountQueue()
    expect(w.find('.k-empty-title').text()).toBe('队列为空')
    expect(w.find('.k-empty-sub').text()).toBe('All pending jobs are done.')
  })

  it('K16: running bucket empty → "no running tasks" + English original aiKbQueueNoRunningNow (compare both, non-pending branch)', async () => {
    ai.parserJobs.mockImplementation(({ status }: { status: string }) => Promise.resolve({ jobs: [] }))
    const { w } = await mountQueue({ filter: 'running' })
    expect(w.find('.k-empty-title').text()).toBe('暂无处理中任务')
    expect(w.find('.k-empty-sub').text()).toBe('No jobs running right now.')
  })
})

describe('QueueView — index table (spec :100-140)', () => {
  it('table header text and column count correct', async () => {
    const { w } = await mountQueue()
    const head = w.find('.k-row-head')
    const spans = head.findAll('span')
    expect(spans[1].text()).toBe('文件')
    expect(spans[2].text()).toBe('路径')
    expect(spans[3].text()).toBe('时间')
  })

  it('when filter=failed, header column 5 shows "retry"; otherwise empty', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const head = w.find('.k-row-head')
    expect(head.findAll('span')[4].text()).toBe('重试')

    const { w: w2 } = await mountQueue()
    const head2 = w2.find('.k-row-head')
    expect(head2.findAll('span')[4].text()).toBe('')
  })

  it('select all checkbox: both sides (select all / deselect all) covered', async () => {
    const { w } = await mountQueue()
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    expect(rows).toHaveLength(3) // PENDING_JOBS 3 rows
    const selectAll = w.find('.k-row-head .k-row-check')
    expect((selectAll.element as HTMLInputElement).checked).toBe(false)
    await selectAll.trigger('change')
    await flush()
    expect((w.find('.k-row-head .k-row-check').element as HTMLInputElement).checked).toBe(true)
    await w.find('.k-row-head .k-row-check').trigger('change')
    await flush()
    expect((w.find('.k-row-head .k-row-check').element as HTMLInputElement).checked).toBe(false)
  })

  it('data-selected both sides covered: selected row is true, unselected row is false', async () => {
    const { w } = await mountQueue()
    const bodyRows = () => w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    bodyRows().forEach((r) => expect(r.attributes('data-selected')).toBe('false'))
    await bodyRows()[0].find('.k-row-check').trigger('change')
    await flush()
    const after = bodyRows()
    expect(after[0].attributes('data-selected')).toBe('true')
    expect(after[1].attributes('data-selected')).toBe('false')
  })

  it('basename/dirname/fmtAgo render correctly (K11: fmtAgo from store, not util)', async () => {
    const { w } = await mountQueue()
    const row = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    expect(row.find('.k-row-name').text()).toBe('nimoos_panic.log')
    expect(row.find('.k-row-path').text()).toBe('/DATA/.system_data/tmp/')
    // created_at 1784776422853 is a timestamp from long ago, should fall in "N days ago" bucket
    expect(row.find('.k-row-time').text()).toMatch(/天前$/)
  })

  it('filter=failed: {n}× retried and last_error only render when attempts>0 / last_error non-empty', async () => {
    const { w } = await mountQueue({ filter: 'failed' })
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    expect(rows[0].find('.k-row-retry').text()).toContain('3× 重试')
    expect(rows[0].find('.k-row-retry').text()).toContain('timeout talking to bge-m3')
    // FAILED_JOBS[1] attempts=0 and last_error=null — both sides need comparison
    expect(rows[1].find('.k-row-retry').text()).toBe('')
  })

  it('row action: pending → cancel button (data-tone=danger) calls store.cancelJob, failed → retry button triggers K18 retry all buckets', async () => {
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
    expect(retryBtn.attributes('data-tone')).toBeUndefined() // retry button does not have this attribute, compare both sides
    await retryBtn.trigger('click')
    await flush()
    // K18: retryOne no longer builds row.file_id/row.id, always retryFailed(null)
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: null })
  })

  it('data-state three states each render correct icon (pending/running/failed)', async () => {
    const { w } = await mountQueue()
    expect(w.find('.k-row-status').attributes('data-state')).toBe('pending')
    const { w: w2 } = await mountQueue({ filter: 'running' })
    expect(w2.find('.k-row-status').attributes('data-state')).toBe('running')
    const { w: w3 } = await mountQueue({ filter: 'failed' })
    expect(w3.find('.k-row-status').attributes('data-state')).toBe('failed')
  })

  it('truncation hint: boundary 199/200 both sides covered (rows.length >= 200)', async () => {
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

describe('QueueView — distill table (spec :145-185)', () => {
  it('exclusive grid data-scope="distill" appears in header and every row; index rows completely lack this attribute (compare both sides)', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    expect(w.find('.k-row-head').attributes('data-scope')).toBe('distill')
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    rows.forEach((r) => expect(r.attributes('data-scope')).toBe('distill'))

    const { w: w2 } = await mountQueue()
    const indexRow = w2.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))[0]
    expect(indexRow.attributes('data-scope')).toBeUndefined()
  })

  it('no checkbox column', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    expect(w.find('.k-row-check').exists()).toBe(false)
  })

  it('header text: File/Path/Status/Error/Time (Error reuses aiKbStatusError, Vue2 same $t("Error") literal)', async () => {
    const { w } = await mountQueue({ scope: 'distill' })
    const spans = w.find('.k-row-head').findAll('span')
    expect(spans[1].text()).toBe('文件')
    expect(spans[2].text()).toBe('路径')
    expect(spans[3].text()).toBe('状态')
    expect(spans[4].text()).toBe('错误')
    expect(spans[5].text()).toBe('时间')
  })

  it('kn-badge badge: manual → curated, auto → archived (compare both sides)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    const badge = w.find('.kn-badge')
    expect(badge.attributes('data-s')).toBe('archived') // DISTILL_PENDING[0].origin='auto'
    expect(badge.text()).toBe('自动')

    const { w: w2 } = await mountQueue({ scope: 'distill', filter: 'running' })
    const badge2 = w2.find('.kn-badge')
    expect(badge2.attributes('data-s')).toBe('curated') // DISTILL_RUNNING[0].origin='manual'
    expect(badge2.text()).toBe('手动')
  })

  it('failed bucket two rows: one row status=failed shows "failed" badge, one row status=skipped shows "skipped" badge (compare both sides)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'failed' })
    const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
    const badges0 = rows[0].findAll('.kn-badge')
    expect(badges0[1].attributes('data-s')).toBe('failed')
    expect(badges0[1].text()).toBe('已失败')
    const badges1 = rows[1].findAll('.kn-badge')
    expect(badges1[1].attributes('data-s')).toBe('draft')
    expect(badges1[1].text()).toBe('已跳过')
  })

  it('data-state uses distillIconState: pending/running direct read, failed and skipped share failed (K12 literal copy)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    expect(w.find('.k-row-status').attributes('data-state')).toBe('pending')
    const { w: w2 } = await mountQueue({ scope: 'distill', filter: 'running' })
    expect(w2.find('.k-row-status').attributes('data-state')).toBe('running')
    const { w: w3 } = await mountQueue({ scope: 'distill', filter: 'failed' })
    const states = w3.findAll('.k-row-status').map((el) => el.attributes('data-state'))
    expect(states).toEqual(['failed', 'failed']) // status=failed and status=skipped both fall to 'failed'
  })

  it('row action: pending → cancel calls cancelDistillJob, failed/skipped → retry calls distillFile', async () => {
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

  // Fix round 1, M-1 (coordinator decision): 409 branch preserves spec's `'Cancel failed: ' + msg` prefix,
  // not just standalone aiKbCannotCancel sentence. Nail down complete concatenated text, prevent future
  // "convenience simplification".
  it('cancelDistillRow 409 (cannot cancel): toast is complete concatenation "cancel failed: task cannot be cancelled." (M-1)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    const s = useKnowledgeStore()
    const toast = vi.spyOn(s, 'toast')
    notes.cancelDistillJob.mockRejectedValueOnce({ response: { status: 409 } })
    await w.find('.k-row-action').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('取消失败: 该任务已无法取消。')
  })

  it('cancelDistillRow other errors (non-409): per K5 only show fixed aiKbCancelFailed, no prefix concatenation (compare both sides)', async () => {
    const { w } = await mountQueue({ scope: 'distill', filter: 'pending' })
    const s = useKnowledgeStore()
    const toast = vi.spyOn(s, 'toast')
    notes.cancelDistillJob.mockRejectedValueOnce(new Error('network down'))
    await w.find('.k-row-action').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledWith('取消失败')
  })

  it('truncation hint distillTruncated boundary: total=499 absent, total=500 (DISTILL_JOBS_LIMIT) present — RED probe ② anchor', async () => {
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

describe('QueueView — 6 kinds of scope × filter combinations (DoD explicitly requires)', () => {
  // Fix round 1, M-2 (review feedback): original `hasTable !== hasEmpty` is always-true assertion —
  // template `:387`/`:423`/`:497` is v-if/v-else-if/v-else three-way mutually exclusive chain,
  // structurally always renders exactly one of .k-table / .k-empty, never fails no matter how
  // implementation is wrong (governance §9 "ban vacuous test cases"). Default mock makes all six
  // combinations have rows, empty state side never exercised. Changed to discriminatory assertions
  // per combination (row count / first row content / badge value), plus separate empty-state
  // combination test case.
  type W = Awaited<ReturnType<typeof mountQueue>>['w']
  const combos: Array<{ scope?: string; filter: string; assertRows: (w: W) => void }> = [
    {
      filter: 'pending',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(3) // PENDING_JOBS length
      },
    },
    {
      filter: 'running',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(1) // RUNNING_JOBS length
      },
    },
    {
      filter: 'failed',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(2) // FAILED_JOBS length
        expect(rows[0].find('.k-row-retry').text()).toContain('3× 重试') // FAILED_JOBS[0].attempts=3
      },
    },
    {
      scope: 'distill',
      filter: 'pending',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(1) // DISTILL_PENDING length
        expect(rows[0].find('.kn-badge').attributes('data-s')).toBe('archived') // origin='auto'
      },
    },
    {
      scope: 'distill',
      filter: 'running',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(1) // DISTILL_RUNNING length
        expect(rows[0].find('.kn-badge').attributes('data-s')).toBe('curated') // origin='manual'
      },
    },
    {
      scope: 'distill',
      filter: 'failed',
      assertRows: (w) => {
        const rows = w.findAll('.k-row').filter((r) => !r.classes().includes('k-row-head'))
        expect(rows).toHaveLength(2) // DISTILL_FAILED: one row failed, one row skipped
        const tones = rows.map((r) => r.findAll('.kn-badge')[1].attributes('data-s'))
        expect(tones).toEqual(['failed', 'draft'])
      },
    },
  ]
  for (const c of combos) {
    it(`scope=${c.scope || 'index'} filter=${c.filter}: pill state consistent + row count/content discriminatory assertion (not two-choice always-true)`, async () => {
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

  it('empty state combination (supplement M-2): when all three buckets empty, .k-empty appears, .k-table absent, text correct', async () => {
    ai.parserJobs.mockImplementation(() => Promise.resolve({ jobs: [] }))
    const { w } = await mountQueue({ filter: 'pending' })
    expect(w.find('.k-empty').exists()).toBe(true)
    expect(w.find('.k-table').exists()).toBe(false)
    expect(w.find('.k-empty-title').text()).toBe('队列为空')
  })
})

describe('QueueView — K18: three retry entry points all call store.retryFailed(null)', () => {
  it('retryOne (single row retry button)', async () => {
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

  it('bulkRetry (batch retry button) — unlike spec\'s original "fileIds always empty array, never send request" false success, actually sends request', async () => {
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

  it('retryAllFailed (toolbar "retry all failed" button)', async () => {
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

describe('QueueView — K7: clear failed confirmation modal (reka Dialog primitive)', () => {
  it('click "clear failed records" opens modal (portal to .knowledge-app), title/body/button correct', async () => {
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

  it('click "cancel" closes modal and does not call clearFailed', async () => {
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

  it('click "confirm clear" calls store.clearFailed, closes modal, shows toast', async () => {
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

  // Fix round 1, M-3 (review feedback): spec `:190-191` relies on `.k-modal-bg`
  // `@click="confirmClear=false"` + `.k-modal` `@click.stop` to implement "click overlay closes,
  // click modal content doesn't close"; after switching to reka, DialogContent's pointerDownOutside
  // provides equivalent behavior, but previous three test cases (open/cancel/confirm) none covered
  // this mechanism itself. Add it.
  it('click overlay (outside modal) closes; click inside modal does not close (reka pointerDownOutside equivalent spec @click/@click.stop)', async () => {
    const host = withHost()
    const { w } = await mountQueue({ filter: 'failed' })
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 1, done: 0 } }
    await flush()
    await w.find('.k-btn.ghost').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    // reka's usePointerDownOutside uses setTimeout(0) to defer attaching document's pointerdown
    // listener (avoid that initial pointerdown from opening modal bubbling to document and
    // closing itself immediately, see node_modules/reka-ui/dist/DismissableLayer/utils.js top
    // comment). This is a real macrotask; flushPromises()/nextTick() only flush microtasks,
    // so add one real setTimeout tick.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // click inside modal (.k-confirm-title, DialogContent subtree) should not close.
    const titleEl = host.querySelector('.k-confirm-title') as HTMLElement
    titleEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    // click overlay (.k-modal-bg itself, DialogOverlay, outside modal) should close.
    const overlayEl = host.querySelector('.k-modal-bg') as HTMLElement
    overlayEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
  })
})

describe('QueueView — deep link contract (?filter= watcher takes effect immediately)', () => {
  it('after mount, router.replace changes query.filter, pill and content switch accordingly (not just initial immediate)', async () => {
    const { w, router } = await mountQueue()
    expect(w.findAll('.k-filter-pill')[2].attributes('data-on')).toBe('true') // pending
    await router.replace({ query: { filter: 'running' } })
    await flush()
    expect(w.findAll('.k-filter-pill')[3].attributes('data-on')).toBe('true') // running
    expect(w.findAll('.k-filter-pill')[2].attributes('data-on')).toBe('false')
  })
})

describe('QueueView — lifecycle: 10-second polling', () => {
  it('mount, load once; 10s polling; skip when document.hidden; unmount, clear timer', async () => {
    // following existing pattern in KnowledgeLayout.test.ts: loadForScope() in onMounted is
    // sync call initiation (service.ai.parserJobs(...) three calls inside Promise.all are sync
    // triggered, only their individual resolves go microtask), no need runOnlyPendingTimersAsync
    // to "nudge" it — that API would fire even-not-due setInterval early, causing false 6-call
    // count.
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const router = makeRouter()
    await router.isReady()
    const w = mount(QueueView, { global: { plugins: [router, i18n] } } as never)
    expect(ai.parserJobs).toHaveBeenCalledTimes(3) // pending+running+failed three buckets parallel

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

describe('QueueView — guard gap ③: <template> block contains zero bare color literals', () => {
  // Governance appendix B §B.0.4: color-guard.test.ts's styleLines() scans .vue <style> block
  // only, never scans template style="…" attributes; this file adds targeted assertion to plug
  // this blind spot. File-reading technique in top comment (node:fs + fileURLToPath; @types/node
  // installed post-merge, no suppression needed).
  it('<template> block (after stripping var()/color-mix()) contains no bare hex / rgb / hsl literals', () => {
    const src: string = readFileSync(resolve(__dirname, './QueueView.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]

    // strip var(...) and color-mix(...) contents (same technique as color-guard.test.ts's stripVar:
    // char-by-char scan paired parenthesis depth, supports nested fallback), prevent token names /
    // keywords inside color-mix(in srgb, var(--success) 20%, transparent) from being mismatched
    // against bare color regex.
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1 // lands on opening parenthesis
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
