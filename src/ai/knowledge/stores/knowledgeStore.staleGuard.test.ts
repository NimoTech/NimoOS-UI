// SP8-P5b Task 3 —— K15:`loadAllJobs` / `loadIndexedFiles` / `loadDistillJobs`
// 三个 action 各自的 store 实例局部 epoch 过期守卫（异步过期守卫纪律第 6 次命中）。
//
// 本文件只测「交错路径」本身：先发后至 / 先发先至 两种到达顺序下守卫是否正确
// 生效。三个 action 各自的正常行为（单桶归位、N4 按 filter 只刷对应桶等）已经
// 在 `knowledgeStore.parser.test.ts` / `knowledgeStore.notesWiki.test.ts` 里覆盖
// 过，这里不重复。
//
// mock 形状来源（全部回 `.superpowers/sdd/p5b-fixtures/`，禁手编，见治理 §4）：
//   - `ai.parserJobs` → `jobs-pending.json` / `jobs-running.json` / `jobs-failed.json`
//     的原样 snake_case（`service.ai.parser*` 零转换，§4.1）。
//   - `ai.parserFiles` → `files-default.json` / `files-mime-prefix-legacy.json` /
//     `files-sort-size-asc.json` 的原样 snake_case。
//   - `notes.listDistillJobs` / `notes.getDistillStatus` → 队列本机为空
//     （`distill-jobs.json`/`distill-status.json` 实测都是空），行形状按治理
//     §4.2 表格右列（包已归一化的 camelCase：`filePath`/`lastError`/…）与
//     `knowledgeStore.notesWiki.test.ts` 里已有的 `JOBS()` 写法同一模具（README
//     「未实测·源码推定」表登记过的形状，非手编）。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const ai = vi.hoisted(() => ({
  parserJobs: vi.fn(),
  parserFiles: vi.fn(),
}))
const notes = vi.hoisted(() => ({
  listDistillJobs: vi.fn(),
  getDistillStatus: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai, notes } }))
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('../../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))

import { useKnowledgeStore } from './knowledgeStore'

/** 可控 deferred promise —— 交错路径测试的标准工具（治理 §9「异步断言」）。 */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

// ══════════════════════════════════════════════════════════════════════
// loadAllJobs —— 竞态实证:QueueView 10 秒轮询 + `setScope('index')` 手动
// 触发,两路并存。行内容取自 `jobs-pending.json`（同一份真实响应体里的
// 第 0/1 行,分别当"新鲜"/"过期"两次调用的 pending 桶用,字段逐字未改）与
// `jobs-running.json`（唯一一行,两次调用共用不影响判别力,判别力全部落在
// pending 桶）。failed 桶本机实测为空（`jobs-failed.json`），POISON_FAILED_ROW
// 借用 `jobs-pending.json` 的 `jobs[2]`（id 346）整行照抄当判别用假行（见下方
// 常量注释，修复轮 1 M-2）。
// ══════════════════════════════════════════════════════════════════════
describe('loadAllJobs 过期守卫(K15)', () => {
  // jobs-pending.json 的 jobs[0]（id 348）与 jobs[1]（id 347），逐字段照抄。
  const FRESH_PENDING_ROW = {
    id: 348,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log',
    op: 'index',
    sub_modality: null,
    priority: 100,
    attempts: 0,
    last_error: null,
    locked_until: null,
    created_at: 1784776422853,
    picked_at: null,
    done_at: null,
  }
  const STALE_PENDING_ROW = {
    id: 347,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log',
    op: 'index',
    sub_modality: null,
    priority: 100,
    attempts: 0,
    last_error: null,
    locked_until: null,
    created_at: 1784776420537,
    picked_at: null,
    done_at: null,
  }
  // jobs-running.json 的唯一一行。
  const RUNNING_ROW = {
    id: 10,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/tmp/nimoos_panic.log',
    op: 'index',
    sub_modality: null,
    priority: 100,
    attempts: 5,
    last_error: null,
    locked_until: 1785414048100,
    created_at: 1784424392938,
    picked_at: 1784438018718,
    done_at: null,
  }
  const EMPTY = { jobs: [] } // jobs-failed.json 原样
  // 【修复轮 1,M-2】本机 failed 桶实测为空(`jobs-failed.json` = `{"jobs":[]}`），
  // 取不到真实的 failed 行；用同一份 `jobs-pending.json` 的 `jobs[2]`（id 346，
  // `op:"delete"`）整行照抄当 failed 桶的判别用假行 —— 字段形状仍是实测过的，
  // 不是手编残缺对象（原来的 `{ id: 999 }` 已删）。
  const POISON_FAILED_ROW = {
    id: 346,
    root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA/.system_data/opt/qdrant/storage/collections/agent_memory/0/wal/.atomicwritewmbpAO',
    op: 'delete',
    sub_modality: null,
    priority: 100,
    attempts: 0,
    last_error: null,
    locked_until: null,
    created_at: 1784776420537,
    picked_at: null,
    done_at: null,
  }

  it('交错:先发(轮询)后至,不覆盖后发(手动 setScope)已写入的三桶', async () => {
    const d1p = deferred<{ jobs: unknown[] }>()
    const d1r = deferred<{ jobs: unknown[] }>()
    const d1f = deferred<{ jobs: unknown[] }>()
    const d2p = deferred<{ jobs: unknown[] }>()
    const d2r = deferred<{ jobs: unknown[] }>()
    const d2f = deferred<{ jobs: unknown[] }>()
    // Promise.all([loadJobs('pending'), loadJobs('running'), loadJobs('failed')])
    // 三个子调用按数组字面量顺序同步发出 —— 每次 loadAllJobs() 调用对应连续
    // 三次 mockImplementationOnce。
    ai.parserJobs
      .mockImplementationOnce(() => d1p.promise) // 第一发(轮询) pending
      .mockImplementationOnce(() => d1r.promise) // 第一发 running
      .mockImplementationOnce(() => d1f.promise) // 第一发 failed
      .mockImplementationOnce(() => d2p.promise) // 第二发(手动) pending
      .mockImplementationOnce(() => d2r.promise) // 第二发 running
      .mockImplementationOnce(() => d2f.promise) // 第二发 failed

    const s = useKnowledgeStore()
    const first = s.loadAllJobs() // 轮询那一路,先发出
    const second = s.loadAllJobs() // setScope('index') 手动触发,后发出,应该赢

    // 后发先至:手动触发的这一路先落地。
    d2p.resolve({ jobs: [FRESH_PENDING_ROW] })
    d2r.resolve({ jobs: [RUNNING_ROW] })
    d2f.resolve(EMPTY)
    await second
    expect(s.jobs.pending.map((j) => j.id)).toEqual([348])
    expect(s.jobs.running.map((j) => j.id)).toEqual([10])
    expect(s.jobs.failed).toEqual([])

    // 先发后至:轮询那一路才落地，必须被整发丢弃，不许覆盖上面已经生效的结果。
    d1p.resolve({ jobs: [STALE_PENDING_ROW] })
    d1r.resolve({ jobs: [] })
    d1f.resolve({ jobs: [POISON_FAILED_ROW] })
    await first
    expect(s.jobs.pending.map((j) => j.id)).toEqual([348]) // 没被 347 覆盖
    expect(s.jobs.running.map((j) => j.id)).toEqual([10]) // 没被清空
    expect(s.jobs.failed).toEqual([]) // 没被 stale 的 346 号行污染
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('反向对照:非重叠调用(先发先落地再发下一次),两发都真实生效', async () => {
    ai.parserJobs.mockImplementation(async (p: { status: string }) => {
      if (p.status === 'pending') return { jobs: [FRESH_PENDING_ROW] }
      if (p.status === 'running') return { jobs: [RUNNING_ROW] }
      return EMPTY
    })
    const s = useKnowledgeStore()
    await s.loadAllJobs() // 第一次调用，完全落地
    expect(s.jobs.pending.map((j) => j.id)).toEqual([348])

    ai.parserJobs.mockImplementation(async (p: { status: string }) => {
      if (p.status === 'pending') return { jobs: [STALE_PENDING_ROW] }
      if (p.status === 'running') return EMPTY
      return { jobs: [POISON_FAILED_ROW] }
    })
    await s.loadAllJobs() // 第二次调用，不与第一次重叠，理应正常生效
    expect(s.jobs.pending.map((j) => j.id)).toEqual([347])
    expect(s.jobs.running).toEqual([])
    expect(s.jobs.failed.map((j) => j.id)).toEqual([346])
  })
})

// ══════════════════════════════════════════════════════════════════════
// loadIndexedFiles —— 竞态实证:`onPathPrefixInput`/`onMimePrefixInput` 每敲
// 一键整发重载,无 debounce（N9，照抄不改，只修先发后至覆盖的正确性）。
// 用 `files-default.json`（键入 "/DATA/tmp" 时的结果，8 个文件）模拟先发
// （stale），`files-mime-prefix-legacy.json`（再敲一个字符后收窄到旧版
// office mime 前缀，命中 0 个文件）模拟后发（fresh）—— 与蓝本叙事一致：
// 键入越多字符，范围收得越窄。
// ══════════════════════════════════════════════════════════════════════
describe('loadIndexedFiles 过期守卫(K15)', () => {
  // files-default.json 原样（截取判别所需字段，逐字照抄）。
  const STALE_FILES = [
    { file_id: '2685dfba774c87b77b9ca4af44e691f6', status: 'indexing' },
    { file_id: '05d732586959ea3f480b5feb4b0d17c8', status: 'ok' },
    { file_id: '4018267c2ec373cddb244ac220a06cc2', status: 'ok' },
  ]
  const STALE_TOTAL = 8
  // files-mime-prefix-legacy.json 原样：{"total":0,...,"files":[]}
  const FRESH_FILES: unknown[] = []
  const FRESH_TOTAL = 0

  it('交错:先发(输入较短前缀)后至,不覆盖后发(输入更长前缀)的结果,loading 不提前归位', async () => {
    const d1 = deferred<{ files: unknown[]; total: number }>()
    const d2 = deferred<{ files: unknown[]; total: number }>()
    ai.parserFiles.mockImplementationOnce(() => d1.promise).mockImplementationOnce(() => d2.promise)

    const s = useKnowledgeStore()
    const first = s.loadIndexedFiles() // 敲下 "/DATA" 触发的一发
    const second = s.loadIndexedFiles() // 紧接着敲下更长前缀触发的一发，更新
    expect(s.indexedFiles.loading).toBe(true)

    // 先发(stale)先落地：不该提前把 loading 撤掉、不该把 files 写成它的结果，
    // 否则用户会在过滤条已经显示更长前缀的情况下，先看到一帧"完成"的旧数据。
    d1.resolve({ files: STALE_FILES, total: STALE_TOTAL })
    await first
    expect(s.indexedFiles.loading).toBe(true) // 没被提前归位
    expect(s.indexedFiles.files).toEqual([]) // 没被写成 stale 数据（仍是初值）
    expect(s.indexedFiles.total).toBe(0)
    expect(toastShow).not.toHaveBeenCalled()

    // 后发(fresh)落地：此时才真正归位 + 写数据。
    d2.resolve({ files: FRESH_FILES, total: FRESH_TOTAL })
    await second
    expect(s.indexedFiles.loading).toBe(false)
    expect(s.indexedFiles.files).toEqual(FRESH_FILES)
    expect(s.indexedFiles.total).toBe(FRESH_TOTAL)
  })

  // 【修复轮 1,I-1 补】评审变异 M8:只删 catch 分支里的
  // `if (epoch !== indexedFilesEpoch) return`，`src/ai/knowledge/stores/` 52 例
  // 全绿——因为原三组交错用例全走成功路径，catch 分支的守卫没有任何用例证明。
  // 真实后果：过期的一发失败（请求被中止/后端瞬时 500），而最新一发已经成功
  // 写入数据时，没有这条守卫会把 `s.error` 补写上去——正确数据之上又叠一条
  // 错误横幅。本例专测这条路径。
  it('交错:过期的一发失败,最新一发成功 → error 不被污染,loading 归位到成功值', async () => {
    const d1 = deferred<{ files: unknown[]; total: number }>()
    const d2 = deferred<{ files: unknown[]; total: number }>()
    ai.parserFiles.mockImplementationOnce(() => d1.promise).mockImplementationOnce(() => d2.promise)

    const s = useKnowledgeStore()
    const first = s.loadIndexedFiles() // 过期的一发，最终会失败
    const second = s.loadIndexedFiles() // 最新的一发，会成功

    // 最新一发先成功落地。
    d2.resolve({ files: FRESH_FILES, total: FRESH_TOTAL })
    await second
    expect(s.indexedFiles.error).toBe(null)
    expect(s.indexedFiles.files).toEqual(FRESH_FILES)
    expect(s.indexedFiles.loading).toBe(false)

    // 过期的一发才失败落地：不许把 error 写上去，也不许再动 loading。
    d1.reject(new Error('boom'))
    await first
    expect(s.indexedFiles.error).toBe(null) // 没被 stale 的失败污染
    expect(s.indexedFiles.files).toEqual(FRESH_FILES) // 仍是最新一发的数据
    expect(s.indexedFiles.loading).toBe(false) // 没被 stale 分支再动一次
  })

  it('反向对照:非重叠调用(先发先落地再发下一次),两发都真实生效且各自归位 loading', async () => {
    ai.parserFiles.mockResolvedValueOnce({ files: STALE_FILES, total: STALE_TOTAL })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    expect(s.indexedFiles.files).toEqual(STALE_FILES)
    expect(s.indexedFiles.total).toBe(STALE_TOTAL)
    expect(s.indexedFiles.loading).toBe(false)

    // files-sort-size-asc.json 原样（sort=size&order=asc，同样 8 个文件里的另
    // 一个 3 行切片，与上面那组文件不同，用来证明第二发确实生效）。
    const SECOND_FILES = [
      { file_id: '6e1be7c24c4cdb09e1bf1a8318e8ca27', status: 'indexing' },
      { file_id: 'ae3894193e56d181e90b23712f1e3081', status: 'indexing' },
      { file_id: '721c340b1dc3b982cdb4ea6c9783103e', status: 'indexing' },
    ]
    ai.parserFiles.mockResolvedValueOnce({ files: SECOND_FILES, total: 8 })
    await s.loadIndexedFiles()
    expect(s.indexedFiles.files).toEqual(SECOND_FILES)
    expect(s.indexedFiles.total).toBe(8)
    expect(s.indexedFiles.loading).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
// loadDistillJobs —— 竞态实证:10 秒轮询 + `setFilter(f)` + `setScope('distill')`
// + `retryDistill`/`cancelDistill` 内部重载，四路并存；且按 filter 只刷对应
// 桶（N4），串号会让 pending 的结果落进 failed 桶（或反过来，把 failed 桶
// 已经刷新的最新结果被 stale 的 pending 请求带来的全量 counts/done/total
// 覆盖掉）。
// distill 队列本机为空（`distill-jobs.json`/`distill-status.json` 实测都是
// 空），行内容按治理 §4.2 表格右列（包已归一化 camelCase）与既有
// `knowledgeStore.notesWiki.test.ts` 的 `JOBS()` 写法同一模具（README 里
// 「未实测·源码推定」登记过的形状）。
// ══════════════════════════════════════════════════════════════════════
describe('loadDistillJobs 过期守卫(K15)', () => {
  it('交错:先发(pending pill)后至,不覆盖后发(failed pill)已写入的桶与全量 counts', async () => {
    const d1jobs = deferred<{ jobs: unknown[]; counts: Record<string, number> }>()
    const d1status = deferred<{ distilled: number }>()
    const d2jobs = deferred<{ jobs: unknown[]; counts: Record<string, number> }>()
    const d2status = deferred<{ distilled: number }>()
    notes.listDistillJobs
      .mockImplementationOnce(() => d1jobs.promise) // 第一发：用户点了 pending pill
      .mockImplementationOnce(() => d2jobs.promise) // 第二发：紧接着点了 failed pill
    notes.getDistillStatus
      .mockImplementationOnce(() => d1status.promise)
      .mockImplementationOnce(() => d2status.promise)

    const s = useKnowledgeStore()
    const first = s.loadDistillJobs('pending')
    const second = s.loadDistillJobs('failed')

    // 后发(failed pill)先落地。
    d2jobs.resolve({
      jobs: [{ filePath: '/f2', status: 'failed' }],
      counts: { pending: 9, running: 9, failed: 2 },
    })
    d2status.resolve({ distilled: 20 })
    await second
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f2'])
    expect(s.distillJobs.counts).toEqual({ pending: 9, running: 9, failed: 2 })
    expect(s.distillJobs.done).toBe(20)
    expect(s.distillJobs.total).toBe(1)

    // 先发(pending pill)后落地：必须整发丢弃 —— 既不能往 pending 桶写入
    // stale 数据,也不能用它的全量 counts/done/total 冲掉上面刚写入的最新值。
    d1jobs.resolve({
      jobs: [{ filePath: '/p1', status: 'pending' }],
      counts: { pending: 1, running: 0, failed: 0 },
    })
    d1status.resolve({ distilled: 1 })
    await first
    expect(s.distillJobs.pending).toEqual([]) // stale 的 pending 桶没被写入
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f2']) // failed 桶没被冲掉
    expect(s.distillJobs.counts).toEqual({ pending: 9, running: 9, failed: 2 }) // 全量计数没被 stale 覆盖
    expect(s.distillJobs.done).toBe(20)
    expect(s.distillJobs.total).toBe(1)
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('反向对照:非重叠调用(pill 依次点两次),两次都真实生效', async () => {
    notes.listDistillJobs.mockResolvedValueOnce({
      jobs: [{ filePath: '/p1', status: 'pending' }],
      counts: { pending: 1, running: 0, failed: 0 },
    })
    notes.getDistillStatus.mockResolvedValueOnce({ distilled: 3 })
    const s = useKnowledgeStore()
    await s.loadDistillJobs('pending')
    expect(s.distillJobs.pending.map((j) => j.filePath)).toEqual(['/p1'])
    expect(s.distillJobs.done).toBe(3)

    notes.listDistillJobs.mockResolvedValueOnce({
      jobs: [{ filePath: '/f1', status: 'failed' }],
      counts: { pending: 0, running: 0, failed: 1 },
    })
    notes.getDistillStatus.mockResolvedValueOnce({ distilled: 4 })
    await s.loadDistillJobs('failed')
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f1'])
    expect(s.distillJobs.pending.map((j) => j.filePath)).toEqual(['/p1']) // N4：另一桶保留上次结果
    expect(s.distillJobs.done).toBe(4)
  })
})
