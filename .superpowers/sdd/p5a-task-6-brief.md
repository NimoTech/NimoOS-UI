## Task 6: `knowledgeStore` —— Parser 组

**Files:**
- Create: `src/ai/knowledge/stores/knowledgeStore.ts`
- Create: `src/ai/knowledge/stores/knowledgeStore.parser.test.ts`

**Interfaces:**
- Consumes: `service.ai.parser*`(P0 已备齐,签名见 `.sp8/NimoOS-Service/src/ai.ts:589-680`)
- Produces(本任务部分,T7 在同文件续写):
  ```ts
  export const DISTILL_JOBS_LIMIT = 500
  export function fmtAgo(ms: number): string
  export const useKnowledgeStore = defineStore('ai-knowledge', () => ({
    stats, controlState, unreachable, overviewLoaded, lastSyncFmt, extensions, folderRules,
    jobs, backlogPeak, indexedFiles,           // state(ref)
    toast, loadOverview, loadJobs, loadAllJobs, retryFailed, cancelJob, clearFailed,
    loadAllowlist, toggleExtension, addFolderRule, deleteFolderRule, setControl,
    loadIndexedFiles, reindexIndexedByIds, reindexIndexedByFilter,
    startIndexedPolling, stopIndexedPolling,
  }))
  ```

- [ ] **Step 1: 读蓝本**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/store/knowledgeStore.js
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/indexedFiles.js
```
本任务只做:`state` 里 Dashboard/topbar/Allowlist/Queue(parser 半)/`indexedFiles` 五块 + `toast` + `loadOverview` + Jobs 五个 action + Allowlist 四个 + `setControl` + IndexedFiles 五个。**notes/wiki/distill 留给 T7。**
`indexedFiles.js` 的 `buildListParams`/`anyIndexing` 也要移植 → `src/ai/knowledge/util/indexedFiles.ts`(**P5b 会用同一个文件**,本任务只搬这两个函数与它们的原测试 `__tests__/indexedFiles.spec.js`)。

- [ ] **Step 2: 写失败测试**

`knowledgeStore.parser.test.ts`(节选骨架 + 必须有的用例;每条都要能单独判别):
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

const ai = vi.hoisted(() => ({
  parserStats: vi.fn(), parserState: vi.fn(), parserJobs: vi.fn(),
  parserRetryJobs: vi.fn(), parserDeleteJob: vi.fn(), parserClearFailedJobs: vi.fn(),
  parserAllowlistExtensions: vi.fn(), parserAllowlistFolders: vi.fn(),
  patchParserAllowlistExtensions: vi.fn(), addParserAllowlistFolder: vi.fn(),
  deleteParserAllowlistFolder: vi.fn(), parserControl: vi.fn(),
  parserFiles: vi.fn(), parserReindexFiles: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))
const toastShow = vi.hoisted(() => vi.fn())
vi.mock('../../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))

import { useKnowledgeStore, fmtAgo } from './knowledgeStore'

// 后端实测形状(设计 §6.1)——**裸 body,不带 { data: … } 外壳**
const STATS = { queue_depth: { pending: 338, running: 1, failed: 0, done: 9 },
  indexed_files: 8, total_vectors_text: 5592, total_vectors_visual: 0,
  last_cursor_ms: 1784775953391 }
const STATE = { paused: true, concurrency: 2, device: 'auto', ocr_enabled: false, resolved_device: 'cpu' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('loadOverview', () => {
  it('单层取数写入 stats/controlState,并算出 lastSyncFmt 与 backlogPeak', async () => {
    ai.parserStats.mockResolvedValue(STATS); ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    await s.loadOverview()
    expect(s.stats).toEqual(STATS)              // ← mock 是裸 body:若实现多剥一层 .data 这里必红
    expect(s.controlState).toEqual(STATE)
    expect(s.unreachable).toBe(false)
    expect(s.overviewLoaded).toBe(true)
    expect(s.backlogPeak).toBe(339)             // 338 + 1
  })

  it('backlogPeak 是滚动最大值,不会回落', async () => {
    ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    ai.parserStats.mockResolvedValue({ ...STATS, queue_depth: { pending: 100, running: 0, failed: 0, done: 0 } })
    await s.loadOverview()
    expect(s.backlogPeak).toBe(100)
    ai.parserStats.mockResolvedValue({ ...STATS, queue_depth: { pending: 10, running: 0, failed: 0, done: 0 } })
    await s.loadOverview()
    expect(s.backlogPeak).toBe(100)
  })

  it('任一请求失败 → unreachable=true,且不动既有 stats', async () => {
    ai.parserStats.mockResolvedValue(STATS); ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    await s.loadOverview()
    ai.parserStats.mockRejectedValue(new Error('boom'))
    await s.loadOverview()
    expect(s.unreachable).toBe(true)
    expect(s.stats).toEqual(STATS)          // 保留上一次的值
    expect(s.overviewLoaded).toBe(true)     // 已加载过就不回退
  })
})

describe('Jobs 组', () => {
  it('loadAllJobs 三个桶各发一次请求并按状态归位', async () => {
    ai.parserJobs.mockImplementation(async (p: { status: string }) => ({ jobs: [{ id: 1, path: '/' + p.status }] }))
    const s = useKnowledgeStore()
    await s.loadAllJobs()
    expect(ai.parserJobs.mock.calls.map((c) => c[0])).toEqual([
      { status: 'pending', limit: 200 }, { status: 'running', limit: 200 }, { status: 'failed', limit: 200 }])
    expect(s.jobs.pending[0].path).toBe('/pending')
    expect(s.jobs.failed[0].path).toBe('/failed')
  })

  it('loadJobs 对缺 jobs 键的响应兜底成空数组(N7)', async () => {
    ai.parserJobs.mockResolvedValue({})
    const s = useKnowledgeStore()
    expect(await s.loadJobs('pending')).toEqual([])
  })

  it('retryFailed / cancelJob / clearFailed 都在动作后重载三桶', async () => {
    ai.parserJobs.mockResolvedValue({ jobs: [] })
    ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue({})
    ai.parserClearFailedJobs.mockResolvedValue({ cleared: 3 })
    const s = useKnowledgeStore()
    await s.retryFailed(['f1'])
    expect(ai.parserRetryJobs).toHaveBeenCalledWith({ file_ids: ['f1'] })
    await s.retryFailed()
    expect(ai.parserRetryJobs).toHaveBeenLastCalledWith({ file_ids: null })   // 蓝本默认 null
    await s.cancelJob(7)
    expect(ai.parserDeleteJob).toHaveBeenCalledWith(7)
    expect(await s.clearFailed()).toEqual({ cleared: 3 })
    expect(ai.parserJobs).toHaveBeenCalledTimes(12)   // 4 个动作 × 3 桶
  })
})

describe('Allowlist 组', () => {
  it('N1:enabled 的 0/1 被归一化成布尔', async () => {
    ai.parserAllowlistExtensions.mockResolvedValue({ extensions: [
      { ext: '.md', enabled: 1, source: 'default' }, { ext: '.png', enabled: 0, source: 'default' }] })
    ai.parserAllowlistFolders.mockResolvedValue({ rules: [{ id: 1, path_glob: '/a/*' }] })
    const s = useKnowledgeStore()
    await s.loadAllowlist()
    expect(s.extensions).toEqual([
      { ext: '.md', enabled: true, source: 'default' }, { ext: '.png', enabled: false, source: 'default' }])
    expect(s.folderRules).toHaveLength(1)
  })

  it('缺键响应兜底成空数组', async () => {
    ai.parserAllowlistExtensions.mockResolvedValue({}); ai.parserAllowlistFolders.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.loadAllowlist()
    expect(s.extensions).toEqual([]); expect(s.folderRules).toEqual([])
  })

  it('toggle / add / delete 都在动作后重载白名单', async () => {
    ai.parserAllowlistExtensions.mockResolvedValue({ extensions: [] })
    ai.parserAllowlistFolders.mockResolvedValue({ rules: [] })
    ai.patchParserAllowlistExtensions.mockResolvedValue({})
    ai.addParserAllowlistFolder.mockResolvedValue({ id: 9 })
    ai.deleteParserAllowlistFolder.mockResolvedValue({})
    const s = useKnowledgeStore()
    await s.toggleExtension('.md', false)
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.md', enabled: false })
    expect(await s.addFolderRule({ root_id: 'r', path_glob: '/a/*', action: 'deny' })).toEqual({ id: 9 })
    await s.deleteFolderRule(9)
    expect(ai.deleteParserAllowlistFolder).toHaveBeenCalledWith(9)
    expect(ai.parserAllowlistExtensions).toHaveBeenCalledTimes(3)
  })
})

describe('setControl', () => {
  it('把 action 与附加字段合并进 body,并重载 overview', async () => {
    ai.parserControl.mockResolvedValue({}); ai.parserStats.mockResolvedValue(STATS)
    ai.parserState.mockResolvedValue(STATE)
    const s = useKnowledgeStore()
    await s.setControl('pause')
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
    await s.setControl('set_concurrency', { concurrency: 4 })
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_concurrency', concurrency: 4 })
    expect(ai.parserStats).toHaveBeenCalledTimes(2)
  })
})

describe('IndexedFiles 组', () => {
  it('loadIndexedFiles 走 buildListParams,写 files/total,收尾 loading=false', async () => {
    ai.parserFiles.mockResolvedValue({ total: 8, files: [{ file_id: 'a', status: 'ok' }] })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    expect(s.indexedFiles.files).toHaveLength(1)
    expect(s.indexedFiles.total).toBe(8)
    expect(s.indexedFiles.loading).toBe(false)
    expect(s.indexedFiles.error).toBe(null)
  })

  it('失败时写 error 且 loading 归位', async () => {
    ai.parserFiles.mockRejectedValue(new Error('nope'))
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    expect(s.indexedFiles.error).toBe('nope')
    expect(s.indexedFiles.loading).toBe(false)
  })

  it('startIndexedPolling:无 indexing 行时不起定时器;有则 30 s 后重载并在完工后自停', async () => {
    vi.useFakeTimers()
    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'ok' }] })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    s.startIndexedPolling()
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(1)      // 没起来

    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'indexing' }] })
    await s.loadIndexedFiles()
    s.startIndexedPolling()
    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'ok' }] })
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(3)      // 轮询拉了一次
    vi.advanceTimersByTime(60000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(3)      // 完工后自停
    vi.useRealTimers()
  })

  it('startIndexedPolling 重复调用不叠定时器', async () => {
    vi.useFakeTimers()
    ai.parserFiles.mockResolvedValue({ total: 1, files: [{ file_id: 'a', status: 'indexing' }] })
    const s = useKnowledgeStore()
    await s.loadIndexedFiles()
    s.startIndexedPolling(); s.startIndexedPolling(); s.startIndexedPolling()
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(ai.parserFiles).toHaveBeenCalledTimes(2)      // 只多了一次
    s.stopIndexedPolling()
    vi.useRealTimers()
  })
})

describe('toast(偏离 P4)', () => {
  it('转调全局 useToast().show,时长照蓝本 2400ms', () => {
    const s = useKnowledgeStore()
    s.toast('已刷新')
    expect(toastShow).toHaveBeenCalledWith('已刷新', 2400)
  })
})

describe('fmtAgo', () => {
  it('分钟/小时/天三档 + 0 值', () => {
    const now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtAgo(0)).toBe('—')
    expect(fmtAgo(now - 30_000)).toBe(/* i18n aiKbJustNow 的中文值 */ '刚刚')
    expect(fmtAgo(now - 5 * 60_000)).toBe('5 分钟前')
    expect(fmtAgo(now - 3 * 3_600_000)).toBe('3 小时前')
    expect(fmtAgo(now - 50 * 3_600_000)).toBe('2 天前')
    vi.restoreAllMocks()
  })
})
```
> `fmtAgo` 要走 i18n(蓝本用 `i18n.t`),本仓写法照 `agentStore.ts:6` 的既有先例 `i18n.global.t(...)`。测试里的中文断言值必须与 §附录 A 的 `aiKbJustNow`/`aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo` 逐字一致 —— **T8 先落 i18n,本任务才能写这几条断言**;若 T8 未完成,先跳过这一 describe 并在报告里明说,由 T8 补齐(**不许硬编码英文绕过**)。

- [ ] **Step 3: 跑测试确认失败**

- [ ] **Step 4: 实现**

`knowledgeStore.ts` 头注释必须包含:1:1 来源 + 【取数口径】(照 `settingsStore.ts:6-10` 的措辞)+ 【Vue2 响应式 API 机械替换表】+ 【偏离 P2 定时器句柄】+ 【偏离 P4 toast】。
`util/indexedFiles.ts` 移植 `buildListParams`/`anyIndexing` + 把 Vue2 `__tests__/indexedFiles.spec.js` 一并移植成 `util/indexedFiles.test.ts`。

- [ ] **Step 5: 跑测试 + 三门**(不新增 `.vue` → color-guard 用例数不变)

- [ ] **Step 6: 提交**

```bash
git add src/ai/knowledge/stores/knowledgeStore.ts \
        src/ai/knowledge/stores/knowledgeStore.parser.test.ts \
        src/ai/knowledge/util/indexedFiles.ts src/ai/knowledge/util/indexedFiles.test.ts
git commit -m "feat(knowledge): SP8-P5a knowledgeStore parser 组 + indexedFiles 纯函数"
```

---

