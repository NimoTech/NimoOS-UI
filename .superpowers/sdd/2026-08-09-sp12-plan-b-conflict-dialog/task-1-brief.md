## Task 1: 通用冲突纯函数层 `fileConflict.ts`

**Files:**
- Create: `src/files/upload/fileConflict.ts`
- Test: `src/files/upload/fileConflict.test.ts`

**Interfaces:**
- Consumes: `service.folder.getList` 的返回形状 `{ content: { name: string; is_dir: boolean }[] }`（**依赖注入**，本模块不 import service）
- Produces:
  - `type ConflictAction = 'overwrite' | 'keep_both' | 'skip' | 'merge' | 'cancelled'`
  - `interface ConflictCandidate { name: string; isDir: boolean; groupKey: string; mergeable?: boolean }`
  - `interface ConflictChoice { action: Exclude<ConflictAction, 'cancelled'>; applyToAll?: boolean }`
  - `interface ConflictResolution { conflict: ConflictCandidate; action: ConflictAction }`
  - `fetchExistingNames(path: string, listFolder: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>): Promise<Map<string, boolean>>`
  - `findConflicts<T extends { name: string }>(candidates: T[], existingByName: Map<string, boolean>): T[]`
  - `resolveConflictQueue(conflicts: ConflictCandidate[], decide: (c: ConflictCandidate, ctx: { index: number; total: number }) => Promise<ConflictChoice | null | undefined>): Promise<ConflictResolution[]>`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/upload/fileConflict.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchExistingNames, findConflicts, resolveConflictQueue } from './fileConflict'
import type { ConflictCandidate, ConflictChoice } from './fileConflict'

const cand = (name: string, isDir = false): ConflictCandidate => ({ name, isDir, groupKey: name })

describe('fetchExistingNames', () => {
  it('builds a name -> isDir map from a folder listing', async () => {
    const listFolder = vi.fn().mockResolvedValue({
      content: [
        { name: 'a.txt', is_dir: false },
        { name: 'Trip', is_dir: true },
      ],
    })
    const map = await fetchExistingNames('/DATA/Documents', listFolder)
    expect(listFolder).toHaveBeenCalledWith('/DATA/Documents')
    expect(map.get('a.txt')).toBe(false)
    expect(map.get('Trip')).toBe(true)
    expect(map.size).toBe(2)
  })

  it('returns an empty map when the listing has no content', async () => {
    expect((await fetchExistingNames('/DATA', vi.fn().mockResolvedValue(null))).size).toBe(0)
    expect((await fetchExistingNames('/DATA', vi.fn().mockResolvedValue({}))).size).toBe(0)
  })

  it('keeps hidden entries — a dotfile still collides', async () => {
    const map = await fetchExistingNames('/DATA', vi.fn().mockResolvedValue({
      content: [{ name: '.env', is_dir: false }],
    }))
    expect(map.has('.env')).toBe(true)
  })
})

describe('findConflicts', () => {
  it('keeps only candidates whose name is already taken', () => {
    const existing = new Map([['a.txt', false], ['Trip', true]])
    const out = findConflicts([cand('a.txt'), cand('b.txt'), cand('Trip', true)], existing)
    expect(out.map((c) => c.name)).toEqual(['a.txt', 'Trip'])
  })

  it('tolerates a null candidate list', () => {
    expect(findConflicts(null as unknown as ConflictCandidate[], new Map())).toEqual([])
  })
})

describe('resolveConflictQueue', () => {
  it('asks once per conflict and records each action', async () => {
    const decide = vi.fn()
      .mockResolvedValueOnce({ action: 'overwrite' } as ConflictChoice)
      .mockResolvedValueOnce({ action: 'skip' } as ConflictChoice)
    const out = await resolveConflictQueue([cand('a'), cand('b')], decide)
    expect(decide).toHaveBeenCalledTimes(2)
    expect(out.map((r) => r.action)).toEqual(['overwrite', 'skip'])
  })

  it('passes the queue position to decide', async () => {
    const decide = vi.fn().mockResolvedValue({ action: 'skip' } as ConflictChoice)
    await resolveConflictQueue([cand('a'), cand('b'), cand('c')], decide)
    expect(decide.mock.calls.map((c) => c[1])).toEqual([
      { index: 0, total: 3 },
      { index: 1, total: 3 },
      { index: 2, total: 3 },
    ])
  })

  it('applyToAll stops asking and reuses the same action for the rest', async () => {
    const decide = vi.fn().mockResolvedValueOnce({ action: 'keep_both', applyToAll: true } as ConflictChoice)
    const out = await resolveConflictQueue([cand('a'), cand('b'), cand('c')], decide)
    expect(decide).toHaveBeenCalledTimes(1)
    expect(out.map((r) => r.action)).toEqual(['keep_both', 'keep_both', 'keep_both'])
  })

  it('a null choice cancels this conflict AND every remaining one', async () => {
    const decide = vi.fn()
      .mockResolvedValueOnce({ action: 'overwrite' } as ConflictChoice)
      .mockResolvedValueOnce(null)
    const out = await resolveConflictQueue([cand('a'), cand('b'), cand('c')], decide)
    expect(decide).toHaveBeenCalledTimes(2)
    expect(out.map((r) => r.action)).toEqual(['overwrite', 'cancelled', 'cancelled'])
  })

  it('returns an empty list for an empty queue without calling decide', async () => {
    const decide = vi.fn()
    expect(await resolveConflictQueue([], decide)).toEqual([])
    expect(decide).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/upload/fileConflict.test.ts`
Expected: FAIL —「Failed to resolve import "./fileConflict"」

- [ ] **Step 3: 写最小实现**

创建 `src/files/upload/fileConflict.ts`：

```ts
// Generic same-name-conflict detection + queue resolution (the Windows-style
// "this already exists — overwrite / keep both / skip, apply to all" flow).
// Dependency-injected on purpose: nothing here knows about uploads, paste or
// snapshot restore, so all three can reuse it (upload is the first and, as of
// SP12, the only caller — paste/restore wiring is a separate ticket).
// Ported from Vue2 src/components/filebrowser/fileConflict.js.

export type ConflictAction = 'overwrite' | 'keep_both' | 'skip' | 'merge' | 'cancelled'

/** One thing that might collide. `mergeable` is only set by the upload layer's
 *  splitConflictsByKind and is absent for plain file conflicts. */
export interface ConflictCandidate {
  name: string
  isDir: boolean
  groupKey: string
  mergeable?: boolean
}

/** What the dialog emits for the CURRENT conflict. */
export interface ConflictChoice {
  action: Exclude<ConflictAction, 'cancelled'>
  applyToAll?: boolean
}

export interface ConflictResolution {
  conflict: ConflictCandidate
  action: ConflictAction
}

/** A directory listing reduced to name -> is_dir. Hidden entries are kept on
 *  purpose: a dotfile the file list filters out still occupies the name. */
export async function fetchExistingNames(
  path: string,
  listFolder: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>,
): Promise<Map<string, boolean>> {
  const res = await listFolder(path)
  const content = res?.content ?? []
  const map = new Map<string, boolean>()
  for (const entry of content) map.set(entry.name, !!entry.is_dir)
  return map
}

/** Filters candidates down to the ones whose name is already taken. */
export function findConflicts<T extends { name: string }>(
  candidates: T[],
  existingByName: Map<string, boolean>,
): T[] {
  return (candidates || []).filter((c) => existingByName.has(c.name))
}

/**
 * Walks a conflict queue one at a time through `decide` (typically wired to
 * opening FileConflictDialog and awaiting the user's choice), honouring the
 * "apply to all" checkbox the instant it is set: every remaining conflict
 * reuses that action and `decide` is never called again.
 *
 * A null/undefined choice means "stop asking" (Esc / close): this conflict and
 * every remaining one are marked 'cancelled'. Earlier decisions are never
 * rolled back — the caller surfaces that distinction to the user.
 */
export async function resolveConflictQueue(
  conflicts: ConflictCandidate[],
  decide: (
    conflict: ConflictCandidate,
    ctx: { index: number; total: number },
  ) => Promise<ConflictChoice | null | undefined>,
): Promise<ConflictResolution[]> {
  const results: ConflictResolution[] = []
  let forcedAction: ConflictAction | null = null
  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i]
    if (forcedAction) {
      results.push({ conflict, action: forcedAction })
      continue
    }
    const choice = await decide(conflict, { index: i, total: conflicts.length })
    if (!choice) {
      for (let j = i; j < conflicts.length; j++) results.push({ conflict: conflicts[j], action: 'cancelled' })
      break
    }
    results.push({ conflict, action: choice.action })
    if (choice.applyToAll) forcedAction = choice.action
  }
  return results
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/upload/fileConflict.test.ts`
Expected: PASS（16 例左右，具体条数以实际为准）

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/fileConflict.ts src/files/upload/fileConflict.test.ts
git commit -m "feat(files): add generic same-name conflict resolution layer

Ports Vue2's fileConflict.js: listing existing names, filtering candidates
down to real collisions, and walking a conflict queue with apply-to-all and
cancel-the-rest semantics. Dependency-injected so upload, paste and snapshot
restore can all reuse it."
```

---

