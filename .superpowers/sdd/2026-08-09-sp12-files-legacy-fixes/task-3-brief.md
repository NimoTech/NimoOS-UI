## Task 3: `shareGate` 纯函数

**Files:**
- Create: `src/files/util/shareGate.ts`
- Test: `src/files/util/shareGate.test.ts`

**Interfaces:**
- Consumes: `FileEntry` from `src/files/stores/files.ts`
- Produces:
  - `isAlreadyShared(e: FileEntry): boolean` — Task 4 里 `FileContextMenu.vue` 要用
  - `shareableFolders(entries: FileEntry[]): { targets: FileEntry[]; skipped: number }` — Task 4 里 `Files.vue` 的 `onShare` 要用

- [ ] **Step 1: 写失败的测试**

创建 `src/files/util/shareGate.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { isAlreadyShared, shareableFolders } from './shareGate'
import type { FileEntry } from '../stores/files'

const dir = (name: string, shared?: string): FileEntry => ({
  name,
  path: `/DATA/${name}`,
  is_dir: true,
  extensions: shared === undefined ? null : { share: { shared } },
})
const file = (name: string): FileEntry => ({ name, path: `/DATA/${name}`, is_dir: false })

describe('isAlreadyShared', () => {
  it('only entries with extensions.share.shared === "true" count as already shared', () => {
    expect(isAlreadyShared(dir('x', 'true'))).toBe(true)
  })

  it('string "false" does not count as already shared', () => {
    expect(isAlreadyShared(dir('x', 'false'))).toBe(false)
  })

  it('entries without extensions are not already shared', () => {
    expect(isAlreadyShared(dir('x'))).toBe(false)
  })

  it('extensions being null does not count as already shared (backend really returns null)', () => {
    expect(isAlreadyShared({ name: 'x', path: '/DATA/x', is_dir: true, extensions: null })).toBe(false)
  })
})

describe('shareableFolders', () => {
  it('all shareable → all go into targets, skipped is 0', () => {
    const r = shareableFolders([dir('a'), dir('b')])
    expect(r.targets.map((e) => e.name)).toEqual(['a', 'b'])
    expect(r.skipped).toBe(0)
  })

  it('some already shared → only unshareable remain, skipped counts the already-shared', () => {
    const r = shareableFolders([dir('a'), dir('b', 'true'), dir('c'), dir('d', 'true')])
    expect(r.targets.map((e) => e.name)).toEqual(['a', 'c'])
    expect(r.skipped).toBe(2)
  })

  it('all already shared → targets empty, skipped counts all', () => {
    const r = shareableFolders([dir('a', 'true'), dir('b', 'true')])
    expect(r.targets).toEqual([])
    expect(r.skipped).toBe(2)
  })

  it('non-folders are dropped and not counted in skipped (skipped only means "would be shared but already is")', () => {
    const r = shareableFolders([dir('a'), file('b.txt')])
    expect(r.targets.map((e) => e.name)).toEqual(['a'])
    expect(r.skipped).toBe(0)
  })

  it('empty input → empty targets, skipped is 0', () => {
    expect(shareableFolders([])).toEqual({ targets: [], skipped: 0 })
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/files/util/shareGate.test.ts`
Expected: FAIL —— `Failed to resolve import "./shareGate"`

- [ ] **Step 3: 写实现**

创建 `src/files/util/shareGate.ts`：

```ts
import type { FileEntry } from '../stores/files'

/**
 * Whether the backend already exposes this entry as a Samba share.
 *
 * The flag rides in as a *string* on the listing entry, so compare against
 * 'true' rather than truthiness. Single-entry menu gating and batch filtering
 * must both call this -- they used to disagree, which is how a batch share
 * could hit SHARE_ALREADY_EXISTS while the single-entry menu correctly hid
 * the action (pending-ledger F12).
 */
export function isAlreadyShared(e: FileEntry): boolean {
  return e.extensions?.share?.shared === 'true'
}

/**
 * Split a selection into the folders a batch share should actually create,
 * and a count of those skipped because they are already shared.
 *
 * Non-folders are dropped silently: sharing has always been folder-only, so
 * their presence is not something to report back to the user. `skipped` means
 * "would have been shared but already is", nothing else.
 */
export function shareableFolders(entries: FileEntry[]): { targets: FileEntry[]; skipped: number } {
  const folders = entries.filter((e) => e.is_dir)
  const targets = folders.filter((e) => !isAlreadyShared(e))
  return { targets, skipped: folders.length - targets.length }
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/files/util/shareGate.test.ts`
Expected: PASS，10 例

- [ ] **Step 5: 提交**

```bash
git add src/files/util/shareGate.ts src/files/util/shareGate.test.ts
git commit -m "feat(files): add the share gating helpers

One place decides 'already shared', so the single-entry menu and the batch
path cannot drift apart again."
```

---

