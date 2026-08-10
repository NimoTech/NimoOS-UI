### Task 1: `opsRow.ts` 三个渲染纯函数

**Files:**
- Create: `src/files/util/opsRow.ts`
- Test: `src/files/util/opsRow.test.ts`

**Interfaces:**
- Consumes: `FileTask` from `src/files/util/fileOps.ts`
- Produces: `opsTaskPercent(task: FileTask): number | null` · `opsTaskLabelKey(task: FileTask): string` · `opsTaskBasename(path: string): string`

- [ ] **Step 1: 写失败测试**

```ts
// src/files/util/opsRow.test.ts
import { describe, it, expect } from 'vitest'
import { opsTaskPercent, opsTaskLabelKey, opsTaskBasename } from './opsRow'
import type { FileTask } from './fileOps'

function task(over: Partial<FileTask> = {}): FileTask {
  return {
    id: 't1', type: 'copy', finished: false, status: 'PROCESSING',
    processing_path: '/DATA/Documents/report.pdf',
    processed_size: 50, total_size: 200, to: '/DATA/Downloads',
    ...over,
  }
}

describe('opsTaskPercent', () => {
  it('floors the processed/total ratio to a whole percent', () => {
    expect(opsTaskPercent(task({ processed_size: 50, total_size: 200 }))).toBe(25)
    expect(opsTaskPercent(task({ processed_size: 1, total_size: 3 }))).toBe(33)
  })

  it('returns null when the total size is unknown, so callers do not draw a false 0%', () => {
    expect(opsTaskPercent(task({ total_size: 0 }))).toBeNull()
    expect(opsTaskPercent(task({ total_size: -1 }))).toBeNull()
  })

  it('returns 0 when the size is known but nothing has been processed yet', () => {
    expect(opsTaskPercent(task({ processed_size: 0, total_size: 200 }))).toBe(0)
  })

  it('never exceeds 100 even if the backend overshoots', () => {
    expect(opsTaskPercent(task({ processed_size: 300, total_size: 200 }))).toBe(100)
  })
})

describe('opsTaskLabelKey', () => {
  it('maps copy and move onto their i18n keys', () => {
    expect(opsTaskLabelKey(task({ type: 'copy' }))).toBe('filesOpCopy')
    expect(opsTaskLabelKey(task({ type: 'move' }))).toBe('filesOpMove')
  })

  it('falls back to the move key for any unknown type, matching the old ternary', () => {
    expect(opsTaskLabelKey(task({ type: 'something-else' }))).toBe('filesOpMove')
  })
})

describe('opsTaskBasename', () => {
  it('keeps only the last segment so the full /DATA path is not shown', () => {
    expect(opsTaskBasename('/DATA/Documents/report.pdf')).toBe('report.pdf')
  })

  it('ignores trailing slashes on directories', () => {
    expect(opsTaskBasename('/DATA/Documents/')).toBe('Documents')
  })

  it('returns the input unchanged when there is no separator to strip', () => {
    expect(opsTaskBasename('report.pdf')).toBe('report.pdf')
    expect(opsTaskBasename('')).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts`
Expected: FAIL —— `Failed to resolve import "./opsRow"`

- [ ] **Step 3: 写实现**

```ts
// src/files/util/opsRow.ts
import type { FileTask } from './fileOps'

/**
 * Percentage for one file-operation row, or null when the backend has not told
 * us how big the job is.
 *
 * Deliberately NOT the same as `taskPercent` in ./fileOps.ts, which returns 0
 * for an unknown total. Returning 0 draws a progress bar that claims "0% done"
 * when the truth is "size unknown, in progress" -- two different states that
 * must not render the same. `taskPercent` keeps its own semantics for its own
 * callers; do not "unify" the two.
 */
export function opsTaskPercent(task: FileTask): number | null {
  if (!task.total_size || task.total_size <= 0) return null
  const pct = Math.floor((task.processed_size / task.total_size) * 100)
  return Math.min(100, Math.max(0, pct))
}

/** i18n key (not text) for a task's verb, so the caller owns translation. */
export function opsTaskLabelKey(task: FileTask): string {
  return task.type === 'copy' ? 'filesOpCopy' : 'filesOpMove'
}

/** Last path segment only -- the panel must never leak the full /DATA path. */
export function opsTaskBasename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts`
Expected: PASS,13 例全绿

- [ ] **Step 5: 变异验证**

把 `opsTaskPercent` 的 null 分支改成 `return 0`,重跑 → 「returns null when the total size is unknown」必须真红。恢复后全绿。**在任务报告里写明这条变异的实际输出。**

- [ ] **Step 6: 提交**

```bash
git add src/files/util/opsRow.ts src/files/util/opsRow.test.ts
git commit -m "feat(files): add pure helpers for file-operation progress rows

opsTaskPercent returns null rather than 0 for an unknown total size: a 0%
bar claims progress the backend never reported. taskPercent in fileOps.ts
keeps its old semantics for its own callers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

