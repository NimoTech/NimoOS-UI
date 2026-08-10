### Task 4: 粘贴冲突的纯函数

严格照 Vue2 `origin/main:src/components/filebrowser/pasteConflict.js` 移植。**唯一的适配**：New-UI 的 `ConflictCandidate` 是 `{ name, isDir, groupKey }`（不带 `item` 字段），所以用 `groupKey = item.from` 当回指键，`splitPasteItems` 按 `groupKey` 匹配回原条目。

**关键语义（Vue2 注释里写明、必须保留）**：完全没有冲突的条目和用户选了「保留两者」的条目**落进同一个 rename 组**。后端的 style **只在真撞名时才生效**，所以一个不撞名的条目带着 `style='rename'` 提交，与旧的静默默认逐字节等价。

**Files:**
- Create: `src/files/upload/pasteConflict.ts`
- Test: `src/files/upload/pasteConflict.test.ts`

**Interfaces:**
- Consumes: `fetchExistingNames`、`findConflicts`、`ConflictCandidate`、`ConflictResolution`（均来自 `./fileConflict`）；`OperateItem`（来自 `../stores/clipboard`）
- Produces:
  - `baseName(path: string): string`
  - `computePasteConflicts(args: { items: OperateItem[]; destDir: string; listFolder: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null> }): Promise<ConflictCandidate[]>`
  - `splitPasteItems(items: OperateItem[], resolutions: ConflictResolution[]): { overwriteItems: OperateItem[]; renameItems: OperateItem[]; skippedCount: number }`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import { baseName, computePasteConflicts, splitPasteItems } from './pasteConflict'
import type { ConflictResolution } from './fileConflict'
import type { OperateItem } from '../stores/clipboard'

const listing = (names: [string, boolean][]) => async () => ({
  content: names.map(([name, is_dir]) => ({ name, is_dir })),
})

describe('baseName', () => {
  it('returns the last segment', () => {
    expect(baseName('/DATA/a/b.txt')).toBe('b.txt')
    expect(baseName('/DATA/a/b/')).toBe('b')
  })
  it('never throws on empty input', () => {
    expect(baseName('')).toBe('')
  })
})

describe('computePasteConflicts', () => {
  it('flags only the items whose name is already taken in the destination', async () => {
    const items: OperateItem[] = [
      { from: '/DATA/src/a.txt', is_dir: false },
      { from: '/DATA/src/Trip', is_dir: true },
    ]
    const conflicts = await computePasteConflicts({
      items, destDir: '/DATA/dst', listFolder: listing([['a.txt', false]]),
    })
    expect(conflicts.map((c) => c.name)).toEqual(['a.txt'])
  })

  it('marks a directory source as isDir so the dialog can disable Overwrite', async () => {
    const items: OperateItem[] = [{ from: '/DATA/src/Trip', is_dir: true }]
    const conflicts = await computePasteConflicts({
      items, destDir: '/DATA/dst', listFolder: listing([['Trip', true]]),
    })
    expect(conflicts[0]).toMatchObject({ name: 'Trip', isDir: true, groupKey: '/DATA/src/Trip' })
  })
})

describe('splitPasteItems', () => {
  const a: OperateItem = { from: '/DATA/src/a.txt', is_dir: false }
  const b: OperateItem = { from: '/DATA/src/b.txt', is_dir: false }
  const c: OperateItem = { from: '/DATA/src/c.txt', is_dir: false }
  const res = (from: string, action: ConflictResolution['action']): ConflictResolution =>
    ({ conflict: { name: baseName(from), isDir: false, groupKey: from }, action })

  it('routes overwrite answers to the overwrite batch', () => {
    const out = splitPasteItems([a, b], [res(a.from, 'overwrite')])
    expect(out.overwriteItems).toEqual([a])
    expect(out.renameItems).toEqual([b])
  })

  it('drops skipped and cancelled items and counts them', () => {
    const out = splitPasteItems([a, b, c], [res(a.from, 'skip'), res(b.from, 'cancelled')])
    expect(out.overwriteItems).toEqual([])
    expect(out.renameItems).toEqual([c])
    expect(out.skippedCount).toBe(2)
  })

  it('sends never-conflicting items with the keep-both style, same as an explicit keep_both', () => {
    // The backend's style only fires ON a real collision, so a conflict-free
    // item submitted as 'rename' behaves exactly like the old silent default.
    const out = splitPasteItems([a, b], [res(a.from, 'keep_both')])
    expect(out.renameItems).toEqual([a, b])
    expect(out.skippedCount).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/upload/pasteConflict.test.ts
```
预期：FAIL，模块不存在。

- [ ] **Step 3: 实现**

```ts
// Paste's own same-name precheck and resolution-splitting. Ported from Vue2
// src/components/filebrowser/pasteConflict.js, which drives the SAME
// fileConflict.ts machinery (fetchExistingNames / findConflicts /
// resolveConflictQueue) and the SAME FileConflictDialog as the upload flow --
// only the item shape differs.
//
// Adaptation note: New-UI's ConflictCandidate carries no `item` field (Vue2's
// did), so the source path doubles as `groupKey` and splitPasteItems matches
// resolutions back to items through it. Paths in one clipboard batch are
// unique, which is what makes that safe.
import { fetchExistingNames, findConflicts, type ConflictCandidate, type ConflictResolution } from './fileConflict'
import type { OperateItem } from '../stores/clipboard'

/** Last path segment: "/a/b/c.txt" -> "c.txt", "/a/b/" -> "b", "" -> "". */
export function baseName(path: string): string {
  if (!path) return ''
  const parts = String(path).split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : String(path)
}

export async function computePasteConflicts(args: {
  items: OperateItem[]
  destDir: string
  listFolder: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>
}): Promise<ConflictCandidate[]> {
  const existing = await fetchExistingNames(args.destDir, args.listFolder)
  const candidates: ConflictCandidate[] = (args.items || []).map((item) => ({
    name: baseName(item.from),
    isDir: !!item.is_dir,
    groupKey: item.from,
  }))
  return findConflicts(candidates, existing)
}

/**
 * Splits the FULL item list into the two batches the backend's per-batch
 * `style` needs.
 *
 * Items the user never saw a conflict for fall through to the rename group by
 * the same default as an explicit 'keep_both': `style` only ever triggers ON an
 * actual collision, so a conflict-free item submitted with style='rename' is
 * byte-for-byte the old silent default. There is nothing to distinguish the two
 * by once both mean "just land it, renaming only if it turns out to collide".
 */
export function splitPasteItems(
  items: OperateItem[],
  resolutions: ConflictResolution[],
): { overwriteItems: OperateItem[]; renameItems: OperateItem[]; skippedCount: number } {
  const skipped = new Set<string>()
  const overwriteSet = new Set<string>()
  for (const { conflict, action } of resolutions || []) {
    if (action === 'skip' || action === 'cancelled') skipped.add(conflict.groupKey)
    else if (action === 'overwrite') overwriteSet.add(conflict.groupKey)
    // 'keep_both' (and 'merge', which paste never offers) need no bookkeeping:
    // they are the renameItems default below.
  }

  const overwriteItems: OperateItem[] = []
  const renameItems: OperateItem[] = []
  let skippedCount = 0
  for (const item of items || []) {
    if (skipped.has(item.from)) { skippedCount++; continue }
    if (overwriteSet.has(item.from)) overwriteItems.push(item)
    else renameItems.push(item)
  }
  return { overwriteItems, renameItems, skippedCount }
}
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/upload/pasteConflict.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/pasteConflict.ts src/files/upload/pasteConflict.test.ts
git commit -m "feat(files): add paste same-name conflict detection and batch splitting

Ported from Vue2 pasteConflict.js. The two-group split is forced by the
backend: style is per-task, not per-item, so overwrite and keep-both have
to go out as separate batch tasks."
```

---

