// SP8-P5a Task 7 —— 单测取自任务 brief `.superpowers/sdd/p5a-task-7-brief.md`
// Step 2 骨架(逐字照用)。覆盖 knowledgeStore 的 notes + distill + wiki 组:
// setNotesDraftCount / refreshNotesDraftCount / loadNotesSummary / runSearch /
// loadChunkContext / loadDistillJobs / retryDistill / cancelDistill /
// loadRoots / loadCandidates / createRoot / deleteRoot / rescanRoot /
// loadWikiTree / loadWikiNode / loadWikiRaw / setRootEnabled。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const notes = vi.hoisted(() => ({
  list: vi.fn(),
  listDistillJobs: vi.fn(),
  getDistillStatus: vi.fn(),
  distillFile: vi.fn(),
  cancelDistillJob: vi.fn(),
}))
const wiki = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getCandidates: vi.fn(),
  createRoot: vi.fn(),
  deleteRoot: vi.fn(),
  rescanRoot: vi.fn(),
  patchRootEnabled: vi.fn(),
  getTree: vi.fn(),
  getNode: vi.fn(),
  getRaw: vi.fn(),
}))
const ai = vi.hoisted(() => ({ searchText: vi.fn(), searchChunk: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { notes, wiki, ai } }))
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('../../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))

import { useKnowledgeStore, DISTILL_JOBS_LIMIT } from './knowledgeStore'

const ROOT = {
  id: 'r1',
  path: '/DATA',
  level: 'space',
  watchMode: 'auto',
  storageMode: 'inline',
  enabled: true,
  scanIntervalS: 21600,
  createdAt: 1,
  lastScanAt: 0,
  needsReconcile: false,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('notes 组', () => {
  it('refreshNotesDraftCount 用 status=draft&limit=200,写 draft 计数', async () => {
    notes.list.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    const s = useKnowledgeStore()
    await s.refreshNotesDraftCount()
    expect(notes.list).toHaveBeenCalledWith({ status: 'draft', limit: 200 })
    expect(s.notesDraftCount).toBe(2)
  })

  it('refreshNotesDraftCount 在 agent 离线时静默保留旧值', async () => {
    const s = useKnowledgeStore()
    s.setNotesDraftCount(5)
    notes.list.mockRejectedValue(new Error('offline'))
    await s.refreshNotesDraftCount()
    expect(s.notesDraftCount).toBe(5)
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('loadNotesSummary 用 limit=500,写 summary 并同步 draft 计数', async () => {
    notes.list.mockResolvedValue([{ status: 'draft' }, { status: 'curated' }, { status: 'archived' }])
    const s = useKnowledgeStore()
    await s.loadNotesSummary()
    expect(notes.list).toHaveBeenCalledWith({ limit: 500 })
    expect(s.notesSummary).toEqual({ total: 3, draft: 1, curated: 1, archived: 1 })
    expect(s.notesDraftCount).toBe(1)
  })

  it('loadNotesSummary 失败时保留旧值且不 toast', async () => {
    notes.list.mockResolvedValue([{ status: 'draft' }])
    const s = useKnowledgeStore()
    await s.loadNotesSummary()
    notes.list.mockRejectedValue(new Error('offline'))
    await s.loadNotesSummary()
    expect(s.notesSummary.total).toBe(1)
    expect(toastShow).not.toHaveBeenCalled()
  })
})

describe('distill 队列(N4/N5)', () => {
  const JOBS = (rows: unknown[], counts = { pending: 1, running: 2, failed: 3 }) => ({ jobs: rows, counts })

  it('无过滤时刷新三个桶,skipped 归进 failed 桶', async () => {
    notes.listDistillJobs.mockResolvedValue(
      JOBS([
        { filePath: '/p', status: 'pending' },
        { filePath: '/r', status: 'running' },
        { filePath: '/f', status: 'failed' },
        { filePath: '/s', status: 'skipped' },
      ]),
    )
    notes.getDistillStatus.mockResolvedValue({ distilled: 7 })
    const s = useKnowledgeStore()
    await s.loadDistillJobs()
    expect(notes.listDistillJobs).toHaveBeenCalledWith('', DISTILL_JOBS_LIMIT)
    expect(s.distillJobs.pending).toHaveLength(1)
    expect(s.distillJobs.running).toHaveLength(1)
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f', '/s'])
    expect(s.distillJobs.counts).toEqual({ pending: 1, running: 2, failed: 3 })
    expect(s.distillJobs.done).toBe(7)
    expect(s.distillJobs.total).toBe(4)
  })

  it('有过滤时只刷该桶,另两桶保留上次结果(N4 的不对称,照抄)', async () => {
    notes.getDistillStatus.mockResolvedValue({ distilled: 0 })
    notes.listDistillJobs.mockResolvedValue(
      JOBS([
        { filePath: '/p', status: 'pending' },
        { filePath: '/f', status: 'failed' },
      ]),
    )
    const s = useKnowledgeStore()
    await s.loadDistillJobs()
    expect(s.distillJobs.pending).toHaveLength(1)
    notes.listDistillJobs.mockResolvedValue(JOBS([{ filePath: '/f2', status: 'failed' }]))
    await s.loadDistillJobs('failed')
    expect(s.distillJobs.failed.map((j) => j.filePath)).toEqual(['/f2'])
    expect(s.distillJobs.pending).toHaveLength(1) // ← 没被清掉
  })

  it('retryDistill / cancelDistill 之后按当前过滤重载', async () => {
    notes.listDistillJobs.mockResolvedValue(JOBS([]))
    notes.getDistillStatus.mockResolvedValue({ distilled: 0 })
    notes.distillFile.mockResolvedValue({})
    notes.cancelDistillJob.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.retryDistill({ filePath: '/a' }, 'failed')
    expect(notes.distillFile).toHaveBeenCalledWith('/a')
    expect(notes.listDistillJobs).toHaveBeenLastCalledWith('failed', DISTILL_JOBS_LIMIT)
    await s.cancelDistill({ filePath: '/b' }, 'pending')
    expect(notes.cancelDistillJob).toHaveBeenCalledWith('/b')
    expect(notes.listDistillJobs).toHaveBeenLastCalledWith('pending', DISTILL_JOBS_LIMIT)
  })
})

describe('搜索转发', () => {
  it('runSearch 组装固定的 body 字段', async () => {
    ai.searchText.mockResolvedValue({ groups: {} })
    const s = useKnowledgeStore()
    await s.runSearch({ query: 'q', filters: { mime: 'pdf' }, topK: 5, rerank: true })
    expect(ai.searchText).toHaveBeenCalledWith({
      query: 'q',
      filters: { mime: 'pdf' },
      top_k: 5,
      rerank: true,
      group_by_file: true,
      max_chunks_per_file: 8,
    })
  })

  it('runSearch 的默认值(filters {}、topK 10、rerank false)', async () => {
    ai.searchText.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.runSearch({ query: 'q' })
    expect(ai.searchText).toHaveBeenCalledWith({
      query: 'q',
      filters: {},
      top_k: 10,
      rerank: false,
      group_by_file: true,
      max_chunks_per_file: 8,
    })
  })

  it('loadChunkContext 的 window 默认 2、kind 默认 body', async () => {
    ai.searchChunk.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.loadChunkContext({ fileId: 'f', chunkNo: 3 })
    expect(ai.searchChunk).toHaveBeenCalledWith({ file_id: 'f', kind: 'body', chunk_no: 3, window: 2 })
  })
})

describe('wiki 索引根(移植 Vue2 knowledgeStoreRoots.spec.js)', () => {
  it('loadRoots 写入列表并收尾 loading', async () => {
    wiki.getRoots.mockResolvedValue([ROOT])
    const s = useKnowledgeStore()
    await s.loadRoots()
    expect(s.wikiRoots).toEqual([ROOT])
    expect(s.wikiRootsLoading).toBe(false)
  })

  it('loadRoots 失败时 toast 报错并把 loading 归位', async () => {
    wiki.getRoots.mockRejectedValue(new Error('timeout'))
    const s = useKnowledgeStore()
    await s.loadRoots()
    expect(toastShow).toHaveBeenCalled()
    expect(String(toastShow.mock.calls[0][0])).not.toContain('timeout') // K5:不回显后端原文
    expect(s.wikiRootsLoading).toBe(false)
  })

  // 验收反馈修正(2026-08-01):后台加载失败不该弹 toast。
  it('loadRoots({ silent: true }) 失败时不 toast，但 loading 照样归位', async () => {
    wiki.getRoots.mockRejectedValue(new Error('timeout'))
    const s = useKnowledgeStore()
    await s.loadRoots({ silent: true })
    expect(toastShow).not.toHaveBeenCalled()
    expect(s.wikiRootsLoading).toBe(false)
  })

  it('silent 只静默失败，成功路径照常写入列表', async () => {
    wiki.getRoots.mockResolvedValue([ROOT])
    const s = useKnowledgeStore()
    await s.loadRoots({ silent: true })
    expect(s.wikiRoots).toEqual([ROOT])
  })

  // 过期守卫:来回切页会让多发 loadRoots 并存。先发的那一发落地更晚(设备上
  // 就是 60 s 超时的那一发),不许覆盖后发的结果、不许提前把 loading 归位、
  // 也不许替后发去弹 toast。
  it('过期守卫:先发后至的失败既不 toast 也不动 loading', async () => {
    let rejectFirst: (e: Error) => void = () => {}
    wiki.getRoots.mockReturnValueOnce(
      new Promise((_res, rej) => {
        rejectFirst = rej
      }),
    )
    const s = useKnowledgeStore()
    const first = s.loadRoots() // 非 silent —— 若守卫失效,这一发会弹 toast
    let resolveSecond: (v: unknown[]) => void = () => {}
    wiki.getRoots.mockReturnValueOnce(
      new Promise((res) => {
        resolveSecond = res as (v: unknown[]) => void
      }),
    )
    const second = s.loadRoots({ silent: true })
    resolveSecond([ROOT])
    await second
    expect(s.wikiRoots).toEqual([ROOT])
    expect(s.wikiRootsLoading).toBe(false)
    rejectFirst(new Error('timeout'))
    await first
    expect(toastShow).not.toHaveBeenCalled()
    expect(s.wikiRoots).toEqual([ROOT]) // 没被过期那一发清掉
  })

  it('过期守卫:先发后至的成功不覆盖后发的结果', async () => {
    let resolveFirst: (v: unknown[]) => void = () => {}
    wiki.getRoots.mockReturnValueOnce(
      new Promise((res) => {
        resolveFirst = res as (v: unknown[]) => void
      }),
    )
    const s = useKnowledgeStore()
    const first = s.loadRoots()
    wiki.getRoots.mockResolvedValueOnce([ROOT])
    await s.loadRoots()
    resolveFirst([{ ...ROOT, id: 'stale' }])
    await first
    expect(s.wikiRoots).toEqual([ROOT])
  })

  it('loadCandidates 失败时静默清空', async () => {
    wiki.getCandidates.mockRejectedValue(new Error('x'))
    const s = useKnowledgeStore()
    await s.loadCandidates()
    expect(s.wikiCandidates).toEqual([])
  })

  it('setRootEnabled 乐观更新,成功保留', async () => {
    wiki.getRoots.mockResolvedValue([{ ...ROOT }])
    wiki.patchRootEnabled.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.loadRoots()
    await s.setRootEnabled('r1', false)
    expect(s.wikiRoots[0].enabled).toBe(false)
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('r1', false)
  })

  it('setRootEnabled 失败时回滚并上抛', async () => {
    wiki.getRoots.mockResolvedValue([{ ...ROOT }])
    wiki.patchRootEnabled.mockRejectedValue(new Error('boom'))
    const s = useKnowledgeStore()
    await s.loadRoots()
    await expect(s.setRootEnabled('r1', false)).rejects.toThrow('boom')
    expect(s.wikiRoots[0].enabled).toBe(true)
  })

  it('setRootEnabled 对未知 id 直接返回,不发请求', async () => {
    const s = useKnowledgeStore()
    await s.setRootEnabled('nope', false)
    expect(wiki.patchRootEnabled).not.toHaveBeenCalled()
  })

  it('createRoot 单层取数:直接返回包给的 body 并重载列表', async () => {
    wiki.createRoot.mockResolvedValue({ id: 'r2' }) // ← 包已剥壳,不是 { data: { id } }
    wiki.getRoots.mockResolvedValue([ROOT])
    const s = useKnowledgeStore()
    expect(await s.createRoot({ Path: '/DATA' })).toEqual({ id: 'r2' })
    expect(wiki.getRoots).toHaveBeenCalled()
  })

  it('createRoot 的错误原样上抛(RootsView 要接 409 走 mirror 重试)', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    wiki.createRoot.mockRejectedValue(err)
    const s = useKnowledgeStore()
    await expect(s.createRoot({ Path: '/ro' })).rejects.toBe(err)
  })

  it('deleteRoot 透传 purge 并重载;rescanRoot 不重载', async () => {
    wiki.deleteRoot.mockResolvedValue({})
    wiki.rescanRoot.mockResolvedValue({})
    wiki.getRoots.mockResolvedValue([])
    const s = useKnowledgeStore()
    await s.deleteRoot('r1', true)
    expect(wiki.deleteRoot).toHaveBeenCalledWith('r1', true)
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
    await s.rescanRoot('r1')
    expect(wiki.getRoots).toHaveBeenCalledTimes(1) // ← 蓝本刻意不重载
  })
})

describe('wiki 导航(N6:404 → null,其余上抛)', () => {
  it('loadWikiNode / loadWikiRaw 把 404 转成 null', async () => {
    const e404 = Object.assign(new Error('nf'), { response: { status: 404 } })
    wiki.getNode.mockRejectedValue(e404)
    wiki.getRaw.mockRejectedValue(e404)
    const s = useKnowledgeStore()
    expect(await s.loadWikiNode('/x')).toBe(null)
    expect(await s.loadWikiRaw('/x')).toBe(null)
  })

  it('非 404 错误原样上抛', async () => {
    const e500 = Object.assign(new Error('boom'), { response: { status: 500 } })
    wiki.getNode.mockRejectedValue(e500)
    wiki.getRaw.mockRejectedValue(e500)
    const s = useKnowledgeStore()
    await expect(s.loadWikiNode('/x')).rejects.toBe(e500)
    await expect(s.loadWikiRaw('/x')).rejects.toBe(e500)
  })

  it('loadWikiTree 直接转发', async () => {
    wiki.getTree.mockResolvedValue([{ path: '/DATA' }])
    const s = useKnowledgeStore()
    expect(await s.loadWikiTree('r1')).toEqual([{ path: '/DATA' }])
    expect(wiki.getTree).toHaveBeenCalledWith('r1')
  })
})
