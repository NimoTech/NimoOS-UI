## Task 3: 第一轮决议落盘 `applyUploadResolutions`

**Files:**
- Modify: `src/files/upload/uploadConflict.ts`（追加两个导出）
- Test: `src/files/upload/uploadConflict.apply.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `groupByTopSegment` / `UploadEntry`；Task 1 的 `ConflictResolution`
- Produces:
  - `nextAvailableName(name: string, existingNames: Set<string>): string`
  - `interface AcceptedEntry { file: File; relativePath: string; conflictPolicy: '' | 'overwrite' | 'rename'; pendingInnerCheck?: boolean }`
  - `interface ApplyResult { accepted: AcceptedEntry[]; skippedCount: number; cancelledCount: number }`
  - `applyUploadResolutions(entries: UploadEntry[], resolutions: ConflictResolution[], existingNames: Set<string>): ApplyResult`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/upload/uploadConflict.apply.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { applyUploadResolutions, nextAvailableName } from './uploadConflict'
import type { UploadEntry } from './uploadConflict'
import type { ConflictResolution, ConflictAction } from './fileConflict'

const e = (relativePath: string): UploadEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
})
const res = (groupKey: string, action: ConflictAction, over: Partial<{ isDir: boolean; mergeable: boolean }> = {}): ConflictResolution => ({
  conflict: { name: groupKey, groupKey, isDir: over.isDir ?? false, ...(over.mergeable !== undefined ? { mergeable: over.mergeable } : {}) },
  action,
})

describe('nextAvailableName', () => {
  it('returns the name unchanged when it is free', () => {
    expect(nextAvailableName('A', new Set())).toBe('A')
  })
  it('appends the smallest free (n) suffix', () => {
    expect(nextAvailableName('A', new Set(['A']))).toBe('A(1)')
    expect(nextAvailableName('A', new Set(['A', 'A(1)']))).toBe('A(2)')
    expect(nextAvailableName('A', new Set(['A', 'A(1)', 'A(2)']))).toBe('A(3)')
  })
})

describe('applyUploadResolutions', () => {
  it('entries with no resolution land unchanged with an empty policy', () => {
    const out = applyUploadResolutions([e('new.txt')], [], new Set())
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'new.txt', conflictPolicy: '' }])
    expect(out.skippedCount).toBe(0)
    expect(out.cancelledCount).toBe(0)
  })

  it('skip drops the whole group and counts every entry in it', () => {
    const out = applyUploadResolutions([e('Trip/1.jpg'), e('Trip/2.jpg')], [res('Trip', 'skip')], new Set())
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(2)
  })

  it('cancelled drops the group and counts separately from skip', () => {
    const out = applyUploadResolutions([e('a.txt')], [res('a.txt', 'cancelled')], new Set())
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(0)
    expect(out.cancelledCount).toBe(1)
  })

  it('overwrite stamps the overwrite policy and keeps the path', () => {
    const out = applyUploadResolutions([e('a.txt')], [res('a.txt', 'overwrite')], new Set(['a.txt']))
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: 'overwrite' }])
  })

  it('keep_both on a single FILE defers naming to the backend via rename', () => {
    const out = applyUploadResolutions([e('a.txt')], [res('a.txt', 'keep_both')], new Set(['a.txt']))
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: 'rename' }])
  })

  it('keep_both on a FOLDER rewrites every entry to the new top name', () => {
    const names = new Set(['Trip'])
    const out = applyUploadResolutions(
      [e('Trip/Day1/1.jpg'), e('Trip/2.jpg')],
      [res('Trip', 'keep_both', { isDir: true })],
      names,
    )
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['Trip(1)/Day1/1.jpg', 'Trip(1)/2.jpg'])
    expect(out.accepted.every((a) => a.conflictPolicy === '')).toBe(true)
  })

  it('two keep_both folder groups with the same top name do not collide with each other', () => {
    const names = new Set(['Trip'])
    applyUploadResolutions([e('Trip/1.jpg')], [res('Trip', 'keep_both', { isDir: true })], names)
    const second = applyUploadResolutions([e('Trip/2.jpg')], [res('Trip', 'keep_both', { isDir: true })], names)
    expect(second.accepted[0].relativePath).toBe('Trip(2)/2.jpg')
  })

  it('merge on a mergeable folder keeps paths and tags them for the second round', () => {
    const out = applyUploadResolutions(
      [e('Trip/1.jpg')],
      [res('Trip', 'merge', { isDir: true, mergeable: true })],
      new Set(['Trip']),
    )
    expect(out.accepted).toEqual([
      { file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: '', pendingInnerCheck: true },
    ])
  })

  it('merge forced onto a NON-mergeable group degrades to keep_both instead of merging', () => {
    // Reachable only via "apply to all" propagating a previous group's merge
    // choice onto a type-mismatch collision.
    const names = new Set(['Trip'])
    const out = applyUploadResolutions(
      [e('Trip/1.jpg')],
      [res('Trip', 'merge', { isDir: true, mergeable: false })],
      names,
    )
    expect(out.accepted[0].pendingInnerCheck).toBeUndefined()
    expect(out.accepted[0].relativePath).toBe('Trip(1)/1.jpg')
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/upload/uploadConflict.apply.test.ts`
Expected: FAIL —「applyUploadResolutions is not a function」

- [ ] **Step 3: 写最小实现**

在 `src/files/upload/uploadConflict.ts` 末尾追加（并在顶部 import 里补 `type ConflictResolution`）：

```ts
export interface AcceptedEntry {
  file: File
  relativePath: string
  conflictPolicy: '' | 'overwrite' | 'rename'
  /** Set by a Merge choice: this entry still needs a second, per-file
   *  conflict round against the target folder's actual contents. Never
   *  reaches the upload queue. */
  pendingInnerCheck?: boolean
}

export interface ApplyResult {
  accepted: AcceptedEntry[]
  skippedCount: number
  cancelledCount: number
}

/**
 * Directory-naming helper for Keep both on a FOLDER group: appends the
 * smallest "(n)" suffix not already taken. Files get the simpler 'rename'
 * policy instead and let the backend pick name(1).ext.
 */
export function nextAvailableName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name
  let n = 1
  let candidate = `${name}(${n})`
  while (existingNames.has(candidate)) {
    n++
    candidate = `${name}(${n})`
  }
  return candidate
}

/**
 * Applies one resolution per GROUP back onto the FULL entry list, producing
 * the per-entry conflictPolicy the upload queue submits.
 *
 * `existingNames` is MUTATED: every folder group's newly picked name is added
 * immediately, so a second keep_both group with the same top name picks the
 * next free suffix instead of colliding. Callers must reuse ONE set across
 * every group of a batch.
 *
 * Skipped and cancelled groups are dropped HERE, before the batch manifest is
 * ever reported — so reconciliation never lists them and the interrupted-
 * upload badge cannot misreport them as missing.
 */
export function applyUploadResolutions(
  entries: UploadEntry[],
  resolutions: ConflictResolution[],
  existingNames: Set<string>,
): ApplyResult {
  const groups = groupByTopSegment(entries)
  // Carries the action AND the conflict's own mergeable flag, so the merge
  // branch can tell a real Merge choice from one that only arrived via
  // "apply to all" propagating onto a group the dialog never offered Merge for.
  const resolutionByGroup = new Map<string, { action: ConflictAction; mergeable: boolean }>()
  for (const { conflict, action } of resolutions || []) {
    resolutionByGroup.set(conflict.groupKey, { action, mergeable: !!conflict.mergeable })
  }

  const accepted: AcceptedEntry[] = []
  let skippedCount = 0
  let cancelledCount = 0

  for (const [topName, group] of groups) {
    const resolution = resolutionByGroup.get(topName)
    const action = resolution?.action

    if (!action) {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: '' })
      }
      continue
    }
    if (action === 'skip') {
      skippedCount += group.entries.length
      continue
    }
    if (action === 'cancelled') {
      cancelledCount += group.entries.length
      continue
    }
    if (action === 'merge' && resolution!.mergeable) {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: '', pendingInnerCheck: true })
      }
      continue
    }
    // A non-mergeable 'merge' falls through to keep_both below: it can only
    // arrive from "apply to all" propagating onto a type-mismatch collision,
    // which can be neither merged nor overwritten. Degrading to keep_both is
    // what the dialog would have produced had Merge simply not been offered.
    if (action === 'overwrite') {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: 'overwrite' })
      }
      continue
    }

    // keep_both
    if (!group.isFolderGroup) {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: 'rename' })
      }
      continue
    }
    // Folder: the front end picks the new top-level name, because the backend
    // has no concept of "this whole tree is one renamed unit" — every entry is
    // an independent tus upload with its own relativePath.
    const newTop = nextAvailableName(topName, existingNames)
    existingNames.add(newTop)
    for (const entry of group.entries) {
      const rel = entry.relativePath || ''
      const slashIdx = rel.indexOf('/')
      const rest = slashIdx !== -1 ? rel.slice(slashIdx) : ''
      accepted.push({ file: entry.file, relativePath: `${newTop}${rest}`, conflictPolicy: '' })
    }
  }

  return { accepted, skippedCount, cancelledCount }
}
```

顶部 import 改为：

```ts
import { findConflicts, type ConflictCandidate, type ConflictResolution, type ConflictAction } from './fileConflict'
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/upload/uploadConflict.apply.test.ts src/files/upload/uploadConflict.group.test.ts`
Expected: PASS（两个文件都绿）

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/uploadConflict.ts src/files/upload/uploadConflict.apply.test.ts
git commit -m "feat(files): turn conflict choices into per-entry upload policies

Skipped and cancelled groups are dropped before the batch manifest is
reported, so reconciliation never counts them as missing. Keep-both on a
folder renames the top segment client-side and claims the new name in the
shared set, so two same-named folder groups in one batch cannot collide."
```

---

