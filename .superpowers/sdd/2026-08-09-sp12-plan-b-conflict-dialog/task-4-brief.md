## Task 4: 第二轮内层决议 `applyInnerResolutions`

**Files:**
- Modify: `src/files/upload/uploadConflict.ts`（追加一个导出）
- Test: `src/files/upload/uploadConflict.inner.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `AcceptedEntry` / `ApplyResult`；Task 1 的 `ConflictResolution`
- Produces:
  - `interface InnerPrecheckResult { relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }`
  - `applyInnerResolutions(entries: AcceptedEntry[], innerResults: InnerPrecheckResult[], resolutions: ConflictResolution[]): ApplyResult`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/upload/uploadConflict.inner.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { applyInnerResolutions } from './uploadConflict'
import type { AcceptedEntry, InnerPrecheckResult } from './uploadConflict'
import type { ConflictResolution, ConflictAction } from './fileConflict'

const e = (relativePath: string): AcceptedEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
  conflictPolicy: '',
  pendingInnerCheck: true,
})
const hit = (relativePath: string, isDir = false): InnerPrecheckResult => ({ relativePath, exists: true, is_dir: isDir })
const miss = (relativePath: string): InnerPrecheckResult => ({ relativePath, exists: false })
const res = (groupKey: string, action: ConflictAction): ConflictResolution => ({
  conflict: { name: groupKey, groupKey, isDir: false }, action,
})

describe('applyInnerResolutions', () => {
  it('a path with no counterpart inside the folder lands untouched', () => {
    const out = applyInnerResolutions([e('Trip/new.jpg')], [miss('Trip/new.jpg')], [])
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/new.jpg', conflictPolicy: '' }])
    expect(out.skippedCount).toBe(0)
  })

  it('a path the backend never reported on is also treated as non-colliding', () => {
    const out = applyInnerResolutions([e('Trip/new.jpg')], [], [])
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['Trip/new.jpg'])
  })

  it('overwrite on a colliding inner file stamps the overwrite policy', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'overwrite')])
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: 'overwrite' }])
  })

  it('keep_both on a colliding inner file defers naming to the backend', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'keep_both')])
    expect(out.accepted[0].conflictPolicy).toBe('rename')
  })

  it('skip drops the inner file and counts it', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'skip')])
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(1)
  })

  it('cancelled drops the inner file and counts separately', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'cancelled')])
    expect(out.cancelledCount).toBe(1)
  })

  it('a colliding path with NO resolution is skipped, never silently accepted', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [])
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(1)
  })

  it('resolves each path independently — no grouping in the second round', () => {
    const out = applyInnerResolutions(
      [e('Trip/1.jpg'), e('Trip/2.jpg')],
      [hit('Trip/1.jpg'), hit('Trip/2.jpg')],
      [res('Trip/1.jpg', 'overwrite'), res('Trip/2.jpg', 'skip')],
    )
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['Trip/1.jpg'])
    expect(out.skippedCount).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/upload/uploadConflict.inner.test.ts`
Expected: FAIL —「applyInnerResolutions is not a function」

- [ ] **Step 3: 写最小实现**

在 `src/files/upload/uploadConflict.ts` 末尾追加：

```ts
/** One entry of the backend's per-path precheck response. */
export interface InnerPrecheckResult {
  relativePath: string
  exists: boolean
  size_match?: boolean
  is_dir?: boolean
}

/**
 * The SECOND round of the merge flow: takes the pendingInnerCheck entries, the
 * backend's per-path precheck results for them, and the user's resolutions for
 * whichever actually collided, and produces the final policies.
 *
 * There is no grouping here — a merge entry's relativePath is already unique
 * inside the tree being merged in, so each one resolves on its own. A path
 * with no collision always lands unchanged: not touching files that have no
 * counterpart is the whole point of Merge. A colliding path with no matching
 * resolution is treated as skipped rather than silently accepted (defensive —
 * every exists:true path was fed into the queue, so this should not happen).
 */
export function applyInnerResolutions(
  entries: AcceptedEntry[],
  innerResults: InnerPrecheckResult[],
  resolutions: ConflictResolution[],
): ApplyResult {
  const resultByPath = new Map((innerResults || []).map((r) => [r.relativePath, r]))
  const actionByPath = new Map<string, ConflictAction>()
  for (const { conflict, action } of resolutions || []) actionByPath.set(conflict.groupKey, action)

  const accepted: AcceptedEntry[] = []
  let skippedCount = 0
  let cancelledCount = 0

  for (const entry of entries || []) {
    const rel = entry.relativePath
    const result = resultByPath.get(rel)

    if (!result || !result.exists) {
      accepted.push({ file: entry.file, relativePath: rel, conflictPolicy: '' })
      continue
    }

    const action = actionByPath.get(rel)
    if (!action || action === 'skip') {
      skippedCount++
      continue
    }
    if (action === 'cancelled') {
      cancelledCount++
      continue
    }
    if (action === 'overwrite') {
      accepted.push({ file: entry.file, relativePath: rel, conflictPolicy: 'overwrite' })
      continue
    }
    // keep_both — always a single file here, so the backend's name(1).ext
    // auto-rename applies, same as a single-file keep_both in round one.
    accepted.push({ file: entry.file, relativePath: rel, conflictPolicy: 'rename' })
  }

  return { accepted, skippedCount, cancelledCount }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/upload/uploadConflict.inner.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/uploadConflict.ts src/files/upload/uploadConflict.inner.test.ts
git commit -m "feat(files): resolve per-file conflicts inside a merged folder

Merge defers each file inside the folder to a second round: paths with no
counterpart land untouched, colliding ones get their own overwrite/keep-both/
skip decision. A colliding path with no decision is skipped rather than
silently accepted."
```

---

