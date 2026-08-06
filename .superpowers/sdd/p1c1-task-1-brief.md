### Task 1: store —— 5 个 state 字段 + 3 个 stream-fed 动作接进 `createStreamActions`

**Files:**
- Modify: `src/ai/stores/agentStore.ts`(state 区 111-141;`createStreamActions` 378-399;return 表 723-764)
- Test: `src/ai/stores/agentStore.p1c.test.ts`(新建,本期 store 测试统一放这里)

**Interfaces:**
- Consumes: `src/ai/types.ts:33-36` 已声明的 optional 动作签名;`dispatchEvent.ts:283/296/311/318` 的调用形态。
- Produces:
  ```ts
  // state
  visibleResources: Ref<VisibleResource[]>   // { id?: string|number; path: string; kind: string; has_agent_md?: boolean }
  attachments: Ref<Record<string, unknown>[]>
  stagedChanges: Ref<StagedGroup[]>          // { run_id: string|number; created_at: number; items: StagedItem[] }
  committing: Ref<boolean>
  reverting: Ref<Record<string, boolean>>
  // actions
  appendStagedChange(item: Record<string, unknown>): void
  appendVisibleResource(vr: { id?: string|number; path: string; kind: string }): void
  removeVisibleResourceFromList(path: string): void
  ```
  类型 `VisibleResource` / `StagedItem` / `StagedGroup` 导出自 `src/ai/stores/agentStore.ts`(与 `AgentModel`/`ThinkingState` 并列)。

- [ ] **Step 1: 写失败测试**

在 `src/ai/stores/agentStore.p1c.test.ts` 新建(mock 形态照抄 `agentStore.test.ts:4-16` 的 `vi.hoisted` + `vi.mock('@nimotech/nimoos-service', ...)`,并把本期用到的方法都加进 `svc`):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(), createAgentSession: vi.fn(), deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(), updateAgentSessionTitle: vi.fn(), regenerateAgentSessionTitle: vi.fn(),
  listModels: vi.fn(), listProviders: vi.fn(), cancelAgentRun: vi.fn(), confirmAgentAction: vi.fn(),
  listVisibleResources: vi.fn(), addVisibleResource: vi.fn(), removeVisibleResource: vi.fn(),
  listAttachments: vi.fn(), deleteAttachment: vi.fn(),
  listStagedChanges: vi.fn(), commitStagedChanges: vi.fn(),
  revertStagedRun: vi.fn(), revertStagedBatch: vi.fn(), revertStagedItems: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))
vi.mock('../services/agentTransport', () => ({
  runAgentRun: vi.fn().mockResolvedValue(undefined),
  attachAgentStream: vi.fn().mockResolvedValue({ attached: false }),
}))

import { useAgentStore } from './agentStore'

describe('agentStore P1c Task1:stream-fed 三动作', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('appendStagedChange:同 run 归组、(seq,path) 去重就地替换', () => {
    const s = useAgentStore('t1a')
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a' })
    s.appendStagedChange({ run_id: 'r1', seq: 2, op: 'write', path: '/b' })
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a', size_bytes: 9 })
    expect(s.stagedChanges).toHaveLength(1)
    expect(s.stagedChanges[0].items).toHaveLength(2)
    expect(s.stagedChanges[0].items[0]).toMatchObject({ seq: 1, size_bytes: 9 })
    expect(typeof s.stagedChanges[0].created_at).toBe('number')
  })

  it('appendStagedChange:不同 run 追加到末尾(newest-run-last)', () => {
    const s = useAgentStore('t1b')
    s.appendStagedChange({ run_id: 'r1', seq: 1, op: 'mkdir', path: '/a' })
    s.appendStagedChange({ run_id: 'r2', seq: 1, op: 'mkdir', path: '/c' })
    expect(s.stagedChanges.map((g) => g.run_id)).toEqual(['r1', 'r2'])
  })

  it('appendVisibleResource:按 path 去重、浅拷贝入列', () => {
    const s = useAgentStore('t1c')
    s.appendVisibleResource({ path: '/DATA/x', kind: 'folder' })
    s.appendVisibleResource({ path: '/DATA/x', kind: 'folder' })
    s.appendVisibleResource({ path: '/DATA/y', kind: 'file' })
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/DATA/x', '/DATA/y'])
  })

  it('removeVisibleResourceFromList:按 path 整表过滤', () => {
    const s = useAgentStore('t1d')
    s.appendVisibleResource({ path: '/a', kind: 'folder' })
    s.appendVisibleResource({ path: '/b', kind: 'folder' })
    s.removeVisibleResourceFromList('/a')
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/b'])
  })

  it('createStreamActions:暴露 1c 三动作(reducer 不再 no-op)', () => {
    const s = useAgentStore('t1e')
    const a = s.createStreamActions()
    expect(typeof a.appendStagedChange).toBe('function')
    expect(typeof a.appendVisibleResource).toBe('function')
    expect(typeof a.removeVisibleResourceFromList).toBe('function')
    a.appendVisibleResource!({ path: '/z', kind: 'folder' })
    expect(s.visibleResources.map((r) => r.path)).toEqual(['/z'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts`
Expected: FAIL —— `s.appendStagedChange is not a function` / `stagedChanges` undefined。

- [ ] **Step 3: 实现**

在 state 区(`agentStore.ts` 141 行 `pendingSkillId` 之后)加 —— 类型先在文件顶部导出区(`ThinkingState` 附近)声明:

```ts
/** agentStore.js:54 —— 会话已授权的可见资源。stream 注入的条目没有 id(见 dispatchEvent 'visible_resource_added')。 */
export interface VisibleResource { id?: string | number; path: string; kind: string; has_agent_md?: boolean; [k: string]: unknown }
/** agentStore.js:56 —— staged 项;loose 项(无 batch_id/staged_id)不可单项回滚。 */
export interface StagedItem { seq: number; staged_id?: string | number; batch_id?: string | number | null; op: string; path: string; dst_path?: string | null; size_bytes?: number; snapshot_missing?: boolean; [k: string]: unknown }
export interface StagedGroup { run_id: string | number; created_at: number; items: StagedItem[]; [k: string]: unknown }
```

```ts
    // ── 1c:资源 / 附件 / 暂存区(agentStore.js:54-59)──
    const visibleResources = ref<VisibleResource[]>([])
    const attachments = ref<Record<string, unknown>[]>([])
    const stagedChanges = ref<StagedGroup[]>([])
    const committing = ref(false)
    /** 三种键命名空间共用一张表:raw run_id / raw batch_id / 'item:'+staged_id(agentStore.js:59)。 */
    const reverting = ref<Record<string, boolean>>({})
```

三个动作(逐字港 `agentStore.js:702-732`,放在 `markRunningStepDone` 之后、`createStreamActions` 之前):

```ts
    /**
     * agentStore.js:702-720 —— 流式 staged 项入组。按 run_id 归组(不存在则新建,
     * created_at 用**秒**浮点以对齐服务端 unix 秒);组内按 (seq, path) 对去重,
     * 命中则就地替换保位置。无上限、不排序、新组追加在末尾。
     */
    function appendStagedChange(item: Record<string, unknown>) {
      const runId = item.run_id as string | number
      let group = stagedChanges.value.find((g) => g.run_id === runId)
      if (!group) {
        group = { run_id: runId, created_at: Date.now() / 1000, items: [] }
        stagedChanges.value.push(group)
      }
      const existingIdx = group.items.findIndex((x) => x.seq === item.seq && x.path === item.path)
      if (existingIdx >= 0) group.items.splice(existingIdx, 1, item as unknown as StagedItem)
      else group.items.push(item as unknown as StagedItem)
    }

    /** agentStore.js:722-726 —— 仅按 path 去重(不看 id),浅拷贝入列。 */
    function appendVisibleResource(vr: { id?: string | number; path: string; kind: string }) {
      if (!visibleResources.value.some((r) => r.path === vr.path)) visibleResources.value.push({ ...vr })
    }

    /** agentStore.js:728-732 —— 按 path 整表过滤。 */
    function removeVisibleResourceFromList(path: string) {
      visibleResources.value = visibleResources.value.filter((r) => r.path !== path)
    }
```

`createStreamActions()`(386-399)返回对象末尾补三项,并删掉 378-385 那段"1b 故意不给"的注释、换成一行说明:

```ts
      appendStagedChange,
      appendVisibleResource,
      removeVisibleResourceFromList,
```

return 表(723-764)补:`visibleResources, attachments, stagedChanges, committing, reverting, appendStagedChange, appendVisibleResource, removeVisibleResourceFromList`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts`
Expected: 5 例 PASS。
再跑 `pnpm test -- src/ai/services/dispatchEvent.test.ts src/ai/stores/agentStore.test.ts`,Expected: 全绿(1b 的 reducer 与 store 测试零回归)。

- [ ] **Step 5: Commit**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
git add src/ai/stores/agentStore.ts src/ai/stores/agentStore.p1c.test.ts
git commit -m "SP8-P1c1: store 5 state + 3 stream-fed actions into createStreamActions"
```

---

