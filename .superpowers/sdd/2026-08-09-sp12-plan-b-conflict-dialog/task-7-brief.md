## Task 7: 编排 composable `useUploadConflicts.ts`

**Files:**
- Create: `src/files/composables/useUploadConflicts.ts`
- Test: `src/files/composables/useUploadConflicts.test.ts`

**Interfaces:**
- Consumes: Task 1-4 的全部纯函数；`service.folder.getList`；`service.file.uploadPrecheck`
- Produces:
  ```ts
  interface ConflictDialogState {
    open: boolean
    name: string
    targetPath: string
    isDir: boolean
    allowMerge: boolean
    queueIndex: number
    queueTotal: number
  }
  interface ResolvedBatch {
    accepted: AcceptedEntry[]
    skippedCount: number
    cancelledCount: number
  }
  useUploadConflicts(deps?: {
    listFolder?: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>
    precheck?: (targetPath: string, files: { relativePath: string; size: number }[]) => Promise<{ results: InnerPrecheckResult[] }>
  }): {
    dialog: Ref<ConflictDialogState>
    onChoose: (choice: ConflictChoice) => void
    onCancel: () => void
    resolveEntries: (entries: UploadEntry[], targetPath: string) => Promise<ResolvedBatch>
  }
  ```

**设计要点（照 Vue2 `_enqueueUploadEntriesNow`，逐条对应）**

1. **串行链**：`resolveEntries` 之间串行排队。弹窗状态是单例，两批并发会互相覆盖 resolver 让前一批永远挂起。用 `chain = chain.then(run, run)`（`.then(run, run)` 保证前一批抛错也不断链）。
2. **降级范围只包住网络调用**：`fetchExistingNames` 失败 → `console.warn` + 全部按原样通过（后端 rename 兜底）。三个纯函数**故意留在 try 之外** —— 它们出错说明代码有 bug，吞掉会让真故障静默退化成裸入队。
3. **两轮**：一轮拆两队列各自独立走 `resolveConflictQueue`（各有各的 applyToAll）；merge 组进二轮 `uploadPrecheck` + `resolveConflictQueue` + `applyInnerResolutions`。二轮 precheck 失败 → `console.warn` + 这批 merge 条目按原样通过，不弹二轮窗。
4. **弹窗桥**：`decide` 返回一个 promise，`onChoose` / `onCancel` 兑现它。`onCancel` 兑现 `null`。

- [ ] **Step 1: 写失败的测试**

创建 `src/files/composables/useUploadConflicts.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUploadConflicts } from './useUploadConflicts'
import type { UploadEntry } from '../upload/uploadConflict'

const e = (relativePath: string): UploadEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
})
const listing = (content: { name: string; is_dir: boolean }[]) => vi.fn().mockResolvedValue({ content })

// Drives the dialog: waits for it to open, then answers with `choice`.
async function answer(c: ReturnType<typeof useUploadConflicts>, choice: { action: string; applyToAll?: boolean } | null) {
  for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
  expect(c.dialog.value.open).toBe(true)
  if (choice) c.onChoose(choice as never)
  else c.onCancel()
}

describe('useUploadConflicts', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('no collision → everything accepted with an empty policy, dialog never opens', async () => {
    const c = useUploadConflicts({ listFolder: listing([]) })
    const out = await c.resolveEntries([e('a.txt')], '/DATA')
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: '' }])
    expect(c.dialog.value.open).toBe(false)
  })

  it('a file collision opens the dialog and applies the choice', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt')], '/DATA')
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('overwrite')
    expect(c.dialog.value.open).toBe(false)
  })

  it('passes the conflicting name, target path and isDir to the dialog', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]) })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA/Documents')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.name).toBe('Trip')
    expect(c.dialog.value.targetPath).toBe('/DATA/Documents')
    expect(c.dialog.value.isDir).toBe(true)
    expect(c.dialog.value.allowMerge).toBe(true)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('allowMerge is false for a folder group landing on an existing FILE', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: false }]) })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.allowMerge).toBe(false)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('cancel marks this and every remaining conflict cancelled', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt'), e('b.txt')], '/DATA')
    await answer(c, null)
    const out = await p
    expect(out.accepted).toEqual([])
    expect(out.cancelledCount).toBe(2)
  })

  it('merge runs a second precheck round and resolves only the colliding inner files', async () => {
    const precheck = vi.fn().mockResolvedValue({
      results: [
        { relativePath: 'Trip/1.jpg', exists: true, is_dir: false },
        { relativePath: 'Trip/2.jpg', exists: false },
      ],
    })
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const p = c.resolveEntries([e('Trip/1.jpg'), e('Trip/2.jpg')], '/DATA')
    await answer(c, { action: 'merge' })          // round 1: merge the folder
    await answer(c, { action: 'overwrite' })      // round 2: only 1.jpg collides
    const out = await p
    expect(precheck).toHaveBeenCalledTimes(1)
    expect(out.accepted).toEqual([
      { file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: 'overwrite' },
      { file: expect.any(File), relativePath: 'Trip/2.jpg', conflictPolicy: '' },
    ])
  })

  it('a merge whose inner files never collide skips the second dialog entirely', async () => {
    const precheck = vi.fn().mockResolvedValue({ results: [{ relativePath: 'Trip/1.jpg', exists: false }] })
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    await answer(c, { action: 'merge' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('')
    expect(c.dialog.value.open).toBe(false)
  })

  it('a failing listing degrades to accepting everything as-is', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useUploadConflicts({ listFolder: vi.fn().mockRejectedValue(new Error('offline')) })
    const out = await c.resolveEntries([e('a.txt')], '/DATA')
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['a.txt'])
    expect(c.dialog.value.open).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('a failing inner precheck accepts the merged entries as-is without a second dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useUploadConflicts({
      listFolder: listing([{ name: 'Trip', is_dir: true }]),
      precheck: vi.fn().mockRejectedValue(new Error('offline')),
    })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    await answer(c, { action: 'merge' })
    const out = await p
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: '' }])
    expect(warn).toHaveBeenCalled()
  })

  it('two batches queued back to back are resolved serially, not concurrently', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p1 = c.resolveEntries([e('a.txt')], '/DATA')
    const p2 = c.resolveEntries([e('b.txt')], '/DATA')
    await answer(c, { action: 'skip' })
    expect(c.dialog.value.name).toBe('a.txt')   // still the first batch's conflict, not overwritten
    const r1 = await p1
    await answer(c, { action: 'skip' })
    expect(c.dialog.value.name).toBe('b.txt')
    const r2 = await p2
    expect(r1.skippedCount).toBe(1)
    expect(r2.skippedCount).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/composables/useUploadConflicts.test.ts`
Expected: FAIL —「Failed to resolve import "./useUploadConflicts"」

- [ ] **Step 3: 写实现**

创建 `src/files/composables/useUploadConflicts.ts`：

```ts
// Orchestrates the upload same-name-conflict flow: fetches the target
// directory's current names, works out which top-level groups collide, walks
// the user through the dialog, and turns the answers into per-entry upload
// policies. Ported from Vue2 FilePanel.vue's _enqueueUploadEntriesNow.
import { ref, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { fetchExistingNames, resolveConflictQueue, type ConflictChoice, type ConflictCandidate } from '../upload/fileConflict'
import {
  computeUploadConflicts, splitConflictsByKind, applyUploadResolutions, applyInnerResolutions,
  type UploadEntry, type AcceptedEntry, type InnerPrecheckResult,
} from '../upload/uploadConflict'

export interface ConflictDialogState {
  open: boolean
  name: string
  targetPath: string
  isDir: boolean
  allowMerge: boolean
  queueIndex: number
  queueTotal: number
}

export interface ResolvedBatch {
  accepted: AcceptedEntry[]
  skippedCount: number
  cancelledCount: number
}

const CLOSED: ConflictDialogState = {
  open: false, name: '', targetPath: '', isDir: false, allowMerge: false, queueIndex: 0, queueTotal: 1,
}

export interface UploadConflictDeps {
  listFolder?: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>
  precheck?: (
    targetPath: string,
    files: { relativePath: string; size: number }[],
  ) => Promise<{ results: InnerPrecheckResult[] }>
}

export function useUploadConflicts(deps: UploadConflictDeps = {}) {
  const listFolder = deps.listFolder || ((p: string) => service.folder.getList(p))
  const precheck = deps.precheck || ((t: string, f: { relativePath: string; size: number }[]) => service.file.uploadPrecheck(t, f))

  const dialog: Ref<ConflictDialogState> = ref({ ...CLOSED })
  let resolver: ((c: ConflictChoice | null) => void) | null = null

  // Batches are resolved strictly one after another. The dialog state and its
  // resolver are singletons: two concurrent batches would overwrite the
  // resolver and leave the first batch awaiting forever, silently losing its
  // upload. `.then(run, run)` keeps the chain alive even if a batch throws.
  let chain: Promise<unknown> = Promise.resolve()

  function ask(conflict: ConflictCandidate, targetPath: string, ctx: { index: number; total: number }): Promise<ConflictChoice | null> {
    dialog.value = {
      open: true,
      name: conflict.name,
      targetPath,
      isDir: !!conflict.isDir,
      allowMerge: !!conflict.mergeable,
      queueIndex: ctx.index,
      queueTotal: ctx.total,
    }
    return new Promise<ConflictChoice | null>((res) => { resolver = res })
  }

  function settle(choice: ConflictChoice | null) {
    const r = resolver
    resolver = null
    dialog.value = { ...CLOSED }
    r?.(choice)
  }

  function onChoose(choice: ConflictChoice) { settle(choice) }
  function onCancel() { settle(null) }

  async function run(entries: UploadEntry[], targetPath: string): Promise<ResolvedBatch> {
    const passthrough = (): ResolvedBatch => ({
      accepted: entries.map((e) => ({ file: e.file, relativePath: e.relativePath, conflictPolicy: '' as const })),
      skippedCount: 0,
      cancelledCount: 0,
    })
    if (!entries.length) return { accepted: [], skippedCount: 0, cancelledCount: 0 }

    // Only the network call is guarded. The pure functions below are
    // deliberately outside the try: an error there means an actual bug, and
    // swallowing it would quietly degrade into a bare enqueue.
    let existing: Map<string, boolean> | null = null
    try {
      existing = await fetchExistingNames(targetPath, listFolder)
    } catch (err) {
      console.warn('[upload] listing the target directory failed — conflict detection degraded, everything enqueued as-is', err)
    }
    if (!existing) return passthrough()

    const conflicts = computeUploadConflicts(entries, existing)
    if (!conflicts.length) return passthrough()

    // Round 1: two independent queues, each with its own apply-to-all.
    const { folderConflicts, fileConflicts } = splitConflictsByKind(conflicts, entries, existing)
    const folderResolutions = folderConflicts.length
      ? await resolveConflictQueue(folderConflicts, (c, ctx) => ask(c, targetPath, ctx))
      : []
    const fileResolutions = fileConflicts.length
      ? await resolveConflictQueue(fileConflicts, (c, ctx) => ask(c, targetPath, ctx))
      : []

    const existingNames = new Set(existing.keys())
    const applied = applyUploadResolutions(entries, [...folderResolutions, ...fileResolutions], existingNames)
    let skippedCount = applied.skippedCount
    let cancelledCount = applied.cancelledCount

    const mergeEntries = applied.accepted.filter((e) => e.pendingInnerCheck)
    let settled = applied.accepted.filter((e) => !e.pendingInnerCheck)

    if (mergeEntries.length) {
      let innerResults: InnerPrecheckResult[] | null = null
      try {
        const res = await precheck(targetPath, mergeEntries.map((e) => ({ relativePath: e.relativePath, size: e.file.size })))
        innerResults = res?.results ?? []
      } catch (err) {
        console.warn('[upload] inner precheck failed — merged-folder conflict detection degraded, entries enqueued as-is', err)
      }

      if (!innerResults) {
        settled = settled.concat(mergeEntries.map((e) => ({ file: e.file, relativePath: e.relativePath, conflictPolicy: '' as const })))
      } else {
        // Round 2: only the paths the backend reports as existing become a
        // second queue. The displayed name is the relativePath itself so the
        // user can tell which inner file this is.
        const resultByPath = new Map(innerResults.map((r) => [r.relativePath, r]))
        const innerConflicts: ConflictCandidate[] = mergeEntries
          .filter((e) => resultByPath.get(e.relativePath)?.exists)
          .map((e) => ({ name: e.relativePath, isDir: !!resultByPath.get(e.relativePath)!.is_dir, groupKey: e.relativePath }))

        const innerResolutions = innerConflicts.length
          ? await resolveConflictQueue(innerConflicts, (c, ctx) => ask(c, targetPath, ctx))
          : []

        const innerApplied = applyInnerResolutions(mergeEntries, innerResults, innerResolutions)
        settled = settled.concat(innerApplied.accepted)
        skippedCount += innerApplied.skippedCount
        cancelledCount += innerApplied.cancelledCount
      }
    }

    return { accepted: settled, skippedCount, cancelledCount }
  }

  function resolveEntries(entries: UploadEntry[], targetPath: string): Promise<ResolvedBatch> {
    const next = chain.then(() => run(entries, targetPath), () => run(entries, targetPath))
    // Swallow on the CHAIN copy only, so a rejected batch never breaks the
    // queue; the caller's own promise still rejects normally.
    chain = next.then(() => undefined, () => undefined)
    return next
  }

  return { dialog, onChoose, onCancel, resolveEntries }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/composables/useUploadConflicts.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/composables/useUploadConflicts.ts src/files/composables/useUploadConflicts.test.ts
git commit -m "feat(files): orchestrate the two-round upload conflict flow

Batches resolve strictly serially because the dialog and its resolver are
singletons — two concurrent batches would overwrite the resolver and leave the
first awaiting forever. Only the two network calls degrade on failure; the
pure functions stay outside the try so a real bug cannot masquerade as a
graceful degradation."
```

---

