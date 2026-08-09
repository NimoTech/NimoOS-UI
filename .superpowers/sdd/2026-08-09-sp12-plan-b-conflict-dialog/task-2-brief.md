## Task 2: 上传冲突的分组与检测

**Files:**
- Create: `src/files/upload/uploadConflict.ts`
- Test: `src/files/upload/uploadConflict.group.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `findConflicts`、`ConflictCandidate`
- Produces:
  - `interface UploadEntry { file: File; relativePath: string }`
  - `interface UploadGroup { entries: UploadEntry[]; isFolderGroup: boolean }`
  - `groupByTopSegment(entries: UploadEntry[]): Map<string, UploadGroup>`
  - `computeUploadConflicts(entries: UploadEntry[], existing: Map<string, boolean>): ConflictCandidate[]`
  - `splitConflictsByKind(conflicts: ConflictCandidate[], entries: UploadEntry[], existing: Map<string, boolean>): { folderConflicts: ConflictCandidate[]; fileConflicts: ConflictCandidate[] }`（`folderConflicts` 的每项都带 `mergeable: boolean`）

- [ ] **Step 1: 写失败的测试**

创建 `src/files/upload/uploadConflict.group.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { groupByTopSegment, computeUploadConflicts, splitConflictsByKind } from './uploadConflict'
import type { UploadEntry } from './uploadConflict'

const f = (name: string) => new File(['x'], name)
const e = (relativePath: string): UploadEntry => ({ file: f(relativePath.split('/').pop()!), relativePath })

describe('groupByTopSegment', () => {
  it('groups nested paths under their first segment', () => {
    const groups = groupByTopSegment([e('Trip/Day1/1.jpg'), e('Trip/Day2/2.jpg')])
    expect([...groups.keys()]).toEqual(['Trip'])
    expect(groups.get('Trip')!.entries).toHaveLength(2)
    expect(groups.get('Trip')!.isFolderGroup).toBe(true)
  })

  it('a bare file is its own group and is not a folder group', () => {
    const groups = groupByTopSegment([e('a.txt')])
    expect(groups.get('a.txt')!.isFolderGroup).toBe(false)
  })

  it('one nested entry is enough to make the whole group a folder group', () => {
    const groups = groupByTopSegment([e('Trip'), e('Trip/1.jpg')])
    expect(groups.get('Trip')!.isFolderGroup).toBe(true)
    expect(groups.get('Trip')!.entries).toHaveLength(2)
  })

  it('tolerates a null entry list', () => {
    expect(groupByTopSegment(null as unknown as UploadEntry[]).size).toBe(0)
  })
})

describe('computeUploadConflicts', () => {
  it('flags only groups whose top name is already taken', () => {
    const existing = new Map([['Trip', true]])
    const out = computeUploadConflicts([e('Trip/1.jpg'), e('new.txt')], existing)
    expect(out.map((c) => c.name)).toEqual(['Trip'])
    expect(out[0].groupKey).toBe('Trip')
  })

  it('isDir is true when the EXISTING entry is a directory', () => {
    const out = computeUploadConflicts([e('Trip')], new Map([['Trip', true]]))
    expect(out[0].isDir).toBe(true)
  })

  it('isDir is true when the INCOMING group is a folder, even against an existing file', () => {
    const out = computeUploadConflicts([e('Trip/1.jpg')], new Map([['Trip', false]]))
    expect(out[0].isDir).toBe(true)
  })

  it('isDir is false for a plain file landing on an existing file', () => {
    const out = computeUploadConflicts([e('a.txt')], new Map([['a.txt', false]]))
    expect(out[0].isDir).toBe(false)
  })
})

describe('splitConflictsByKind', () => {
  it('file-vs-file goes to fileConflicts and carries no mergeable flag', () => {
    const entries = [e('a.txt')]
    const existing = new Map([['a.txt', false]])
    const { fileConflicts, folderConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(folderConflicts).toEqual([])
    expect(fileConflicts.map((c) => c.name)).toEqual(['a.txt'])
    expect(fileConflicts[0].mergeable).toBeUndefined()
  })

  it('folder-vs-folder is mergeable', () => {
    const entries = [e('Trip/1.jpg')]
    const existing = new Map([['Trip', true]])
    const { folderConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(folderConflicts).toHaveLength(1)
    expect(folderConflicts[0].mergeable).toBe(true)
  })

  it('folder group vs existing FILE is a folder conflict but not mergeable', () => {
    const entries = [e('Trip/1.jpg')]
    const existing = new Map([['Trip', false]])
    const { folderConflicts, fileConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(fileConflicts).toEqual([])
    expect(folderConflicts[0].mergeable).toBe(false)
  })

  it('bare file vs existing FOLDER is a folder conflict but not mergeable', () => {
    const entries = [e('Trip')]
    const existing = new Map([['Trip', true]])
    const { folderConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(folderConflicts[0].mergeable).toBe(false)
  })

  it('does not mutate computeUploadConflicts output', () => {
    const entries = [e('Trip/1.jpg')]
    const existing = new Map([['Trip', true]])
    const conflicts = computeUploadConflicts(entries, existing)
    splitConflictsByKind(conflicts, entries, existing)
    expect(conflicts[0].mergeable).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/upload/uploadConflict.group.test.ts`
Expected: FAIL —「Failed to resolve import "./uploadConflict"」

- [ ] **Step 3: 写最小实现**

创建 `src/files/upload/uploadConflict.ts`：

```ts
// Upload's own same-name-conflict detection + resolution, layered on top of
// fileConflict.ts's generic machinery. Ported from Vue2
// src/components/filebrowser/upload/uploadConflict.js.
//
// Why upload needs grouping at all (paste/restore don't): a picked or dragged
// folder flattens to one entry per file inside it, so an entry can carry a
// multi-level relativePath like "Trip/Day1/1.jpg". Prompting per entry would
// ask about every photo inside "Trip". Instead the conflict is judged on the
// relativePath's TOP segment — the thing that actually lands as a sibling of
// an existing name — and every entry sharing that top segment is resolved as
// one unit.
import { findConflicts, type ConflictCandidate } from './fileConflict'

export interface UploadEntry {
  file: File
  relativePath: string
}

export interface UploadGroup {
  entries: UploadEntry[]
  isFolderGroup: boolean
}

/**
 * Groups entries by the FIRST segment of relativePath. "Trip/Day1/1.jpg" and
 * "Trip/Day2/2.jpg" both land under "Trip"; a bare "a.txt" is its own group.
 * `isFolderGroup` flips true the instant ANY entry in the group has a nested
 * path — that is what lets computeUploadConflicts force isDir even when the
 * target currently holds a same-named FILE.
 */
export function groupByTopSegment(entries: UploadEntry[]): Map<string, UploadGroup> {
  const groups = new Map<string, UploadGroup>()
  for (const entry of entries || []) {
    const rel = entry.relativePath || ''
    const slashIdx = rel.indexOf('/')
    const isNested = slashIdx !== -1
    const topName = isNested ? rel.slice(0, slashIdx) : rel
    if (!groups.has(topName)) groups.set(topName, { entries: [], isFolderGroup: false })
    const group = groups.get(topName)!
    group.entries.push(entry)
    if (isNested) group.isFolderGroup = true
  }
  return groups
}

/**
 * One conflict candidate per group whose top name collides with something
 * already in the target directory. `isDir` is true if EITHER side is a
 * directory, because the dialog disables Overwrite whenever a folder is
 * involved.
 */
export function computeUploadConflicts(
  entries: UploadEntry[],
  existing: Map<string, boolean>,
): ConflictCandidate[] {
  const groups = groupByTopSegment(entries)
  const candidates: ConflictCandidate[] = []
  for (const [topName, group] of groups) {
    candidates.push({
      name: topName,
      isDir: !!existing.get(topName) || group.isFolderGroup,
      groupKey: topName,
    })
  }
  return findConflicts(candidates, existing)
}

/**
 * Splits the conflicts into two independently-resolved queues. `fileConflicts`
 * is the plain file-vs-file case (overwrite / keep both / skip, never merge).
 * `folderConflicts` is everything with a directory on either side, each
 * carrying `mergeable` — true ONLY when both sides are actually folders. A
 * type mismatch (folder group onto an existing file, or a lone file onto an
 * existing folder) sorts into folderConflicts with `mergeable: false`, so the
 * dialog falls back to keep-both / skip.
 *
 * The input conflicts are not mutated — `mergeable` is added onto copies so
 * computeUploadConflicts' own output shape stays untouched.
 */
export function splitConflictsByKind(
  conflicts: ConflictCandidate[],
  entries: UploadEntry[],
  existing: Map<string, boolean>,
): { folderConflicts: ConflictCandidate[]; fileConflicts: ConflictCandidate[] } {
  const groups = groupByTopSegment(entries)
  const folderConflicts: ConflictCandidate[] = []
  const fileConflicts: ConflictCandidate[] = []
  for (const conflict of conflicts || []) {
    const group = groups.get(conflict.groupKey)
    const isFolderGroup = !!group?.isFolderGroup
    const existingIsDir = !!existing?.get(conflict.name)
    if (isFolderGroup || existingIsDir) {
      folderConflicts.push({ ...conflict, mergeable: isFolderGroup && existingIsDir })
    } else {
      fileConflicts.push(conflict)
    }
  }
  return { folderConflicts, fileConflicts }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/upload/uploadConflict.group.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/uploadConflict.ts src/files/upload/uploadConflict.group.test.ts
git commit -m "feat(files): detect upload name conflicts by top path segment

A picked folder flattens to one entry per file, so conflicts are judged on the
relativePath's first segment and the whole group resolves as one unit. Splits
the result into file and folder queues, marking folder-vs-folder collisions
mergeable so the dialog can offer Merge only where it makes sense."
```

---

