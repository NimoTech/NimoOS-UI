## Task 1: `contextTargets` 纯函数

**Files:**
- Create: `src/files/util/contextTarget.ts`
- Test: `src/files/util/contextTarget.test.ts`

**Interfaces:**
- Consumes: `FileEntry` from `src/files/stores/files.ts`
- Produces: `contextTargets(entry: FileEntry | null, selected: FileEntry[]): FileEntry[]` — Task 2 与 Task 4 都要用

- [ ] **Step 1: 写失败的测试**

创建 `src/files/util/contextTarget.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { contextTargets } from './contextTarget'
import type { FileEntry } from '../stores/files'

const f = (name: string): FileEntry => ({ name, path: `/DATA/${name}`, is_dir: false })
const A = f('a.txt')
const B = f('b.txt')
const C = f('c.txt')

describe('contextTargets', () => {
  it('被点项不在选区内 → 只作用于被点项(F11 的核心回归)', () => {
    expect(contextTargets(A, [B, C])).toEqual([A])
  })

  it('被点项在选区内且选区多于一项 → 作用于整个选区', () => {
    expect(contextTargets(B, [B, C])).toEqual([B, C])
  })

  it('选区只有一项 → 只作用于被点项,即便被点项就是那一项', () => {
    // Vue2 ContextMenu.vue:274 的判据是 length > 1;选区仅一项时走单项分支,
    // 菜单因此呈单项态(重命名/复制路径可用)。
    expect(contextTargets(B, [B])).toEqual([B])
  })

  it('空选区 → 只作用于被点项', () => {
    expect(contextTargets(A, [])).toEqual([A])
  })

  it('没有被点项(工具栏批量入口)→ 原样返回选区', () => {
    expect(contextTargets(null, [B, C])).toEqual([B, C])
  })

  it('没有被点项且选区为空 → 空数组', () => {
    expect(contextTargets(null, [])).toEqual([])
  })

  it('按 path 判断"在选区内",不依赖对象同一性', () => {
    const bCopy = { ...B }
    expect(contextTargets(bCopy, [B, C])).toEqual([B, C])
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/files/util/contextTarget.test.ts`
Expected: FAIL —— `Failed to resolve import "./contextTarget"`

- [ ] **Step 3: 写实现**

创建 `src/files/util/contextTarget.ts`：

```ts
import type { FileEntry } from '../stores/files'

/**
 * The effective target set of a context-menu action.
 *
 * Ported verbatim from Vue2 `ContextMenu.vue:271-279`: the current selection
 * wins only when it holds more than one entry AND the right-clicked entry is
 * part of it. Otherwise the action applies to the clicked entry alone.
 *
 * New-UI had regressed to "any non-empty selection wins", so right-clicking an
 * unselected file and hitting Copy operated on the previous selection instead
 * (pending-ledger F11). Both the action dispatch and the menu's single-vs-multi
 * shape must read this same set, or the menu keeps lying about what it acts on.
 *
 * @param entry the right-clicked entry, or null for toolbar batch entry points
 * @param selected the current selection, in listing order
 */
export function contextTargets(entry: FileEntry | null, selected: FileEntry[]): FileEntry[] {
  if (!entry) return selected
  const inSelection = selected.some((e) => e.path === entry.path)
  if (selected.length > 1 && inSelection) return selected
  return [entry]
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/files/util/contextTarget.test.ts`
Expected: PASS，7 例

- [ ] **Step 5: 提交**

```bash
git add src/files/util/contextTarget.ts src/files/util/contextTarget.test.ts
git commit -m "feat(files): add the context-menu effective target set

Vue2 gates on 'selection wins only if it holds >1 entry and contains the
clicked one'; New-UI had regressed to 'any non-empty selection wins'."
```

---

