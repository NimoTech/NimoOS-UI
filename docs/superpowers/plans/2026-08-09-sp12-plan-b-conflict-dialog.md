# SP12 Plan B — 统一冲突弹窗 + 上传同名冲突 + 文件夹合并 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 New-UI 文件区补上 Vue2 已有、New-UI 缺失的「同名冲突」体系 —— 一个通用冲突弹窗（T1 / #77 半），上传时按顶层名分组的第一轮冲突编排（T7 / #85），以及 Windows 式文件夹合并触发的第二轮逐文件决议（T8 / #86）；顺带修掉 Plan A 挂账的两张票。

**Architecture:** 照 Vue2 的三层切分逐层移植 —— **通用纯函数层**（`fileConflict.ts`：列现有名 / 找冲突 / 走队列 + Apply-to-all）、**上传专用纯函数层**（`uploadConflict.ts`：按 relativePath 首段分组、两队列拆分、决议落成 conflictPolicy、第二轮内层决议）、**展示层**（`FileConflictDialog.vue`：只 emit 不算逻辑）。编排放在新 composable `useUploadConflicts.ts` 里（New-UI 没有 FilePanel 这种巨型组件，Files.vue 只负责调用），上传队列 store 从此**只收已决议好的条目**，不再自己 precheck。

**Tech Stack:** Vue 3 `<script setup>` · TypeScript strict · Pinia · vue-i18n · reka-ui（`Dialog.vue` 基元）· vitest + @vue/test-utils · `@nimotech/nimoos-service`（内联在 `packages/service/`）

---

## Global Constraints

以下每条对**每个任务**都成立，不再逐任务重复：

- **代码注释一律英文**（工作区 CLAUDE.md 硬要求）。对话、本计划、台账仍中文。
- **提交信息一律英文**，祈使句主题行 + 说明「为什么」的正文。
- **颜色一律 theme token**（`var(--…)`），禁止写死 `#hex` / `rgb()` / 具名色。新增颜色语义必须在 `src/styles/theme.css` 的 **`:root`**（第 18 行起，深色）与 **`:root[data-theme="light"]`**（第 318 行起，浅色）**两个块都给值**。
- **i18n 新键必须同时进 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts`**，否则 `src/i18n/parity.test.ts` 变红。中文文案**照抄 Vue2 `src/assets/lang/zh_CN.json`**，不要自己译（逐条原文见 Task 5）。
- **移植纪律**：界面严格 1:1 照 Vue2；Vue2 的 bug/竞态/吞错不照抄，改正确逻辑并在注释里登记。禁止无关重构。
- **主工作树的 pathspec 约束在本 worktree 不适用**（本 worktree 干净），但 `git commit` 仍逐任务只 add 该任务涉及的文件。
- **测试必须前台跑**（`pnpm test` 约 3 分钟）。不要丢后台，不要在测试跑完前结束回合。
- **改 `packages/service/` 后** dev server 要重启 + 浏览器硬刷新；`vite.config.ts` 的 `optimizeDeps.exclude` 不要动。
- **CSS 注释里不要出现 `*` 紧贴 `/`**（会提前关闭注释吞掉后面整条规则，五道门全瞎）。
- **变体按钮必须自带 `:hover` 背景**（基类 `:hover` 优先级 (0,2,0) 会压过变体类 (0,1,0)，jsdom 测不出来）。

### 本期任务与 spec 任务号的对应

spec `2026-08-08-vue3-migration-sp12-files-catchup-design.md` 把这块拆成 T1/T7/T8。本计划按**文件的内聚性**重排成 11 个任务，覆盖关系：

| spec 任务 | 本计划任务 |
|---|---|
| T1 统一冲突弹窗 | Task 1（通用纯函数层）+ Task 5（展示组件 + i18n）|
| T7 上传同名冲突（#85）| Task 2（分组/检测）+ Task 3（一轮决议）+ Task 7（编排一轮）|
| T8 文件夹合并（#86）| Task 2（`splitConflictsByKind`）+ Task 3（merge 分支）+ Task 4（二轮决议）+ Task 6（service 类型）+ Task 7（编排二轮）|
| 挂账票 A（unloadGuard 生命周期）| Task 10 |
| 挂账票 B（重试撞死 URL）| Task 11 |
| 拆除旧逐文件冲突弹窗 | Task 8（store/类型手术）+ Task 9（Files.vue 接线）|

---

## File Structure

**新建**

| 文件 | 职责 |
|---|---|
| `src/files/upload/fileConflict.ts` | 通用层：`fetchExistingNames` / `findConflicts` / `resolveConflictQueue` + 共享类型。不认识上传/粘贴/恢复中的任何一个。 |
| `src/files/upload/fileConflict.test.ts` | 同上测试 |
| `src/files/upload/uploadConflict.ts` | 上传专用纯函数：`groupByTopSegment` / `computeUploadConflicts` / `splitConflictsByKind` / `nextAvailableName` / `applyUploadResolutions` / `applyInnerResolutions` |
| `src/files/upload/uploadConflict.group.test.ts` | 分组 + 检测 + 拆队列（Task 2）|
| `src/files/upload/uploadConflict.apply.test.ts` | 一轮决议落盘（Task 3）|
| `src/files/upload/uploadConflict.inner.test.ts` | 二轮内层决议（Task 4）|
| `src/files/components/FileConflictDialog.vue` | 展示组件：四动作 + applyToAll + 队列位置，只 emit |
| `src/files/components/FileConflictDialog.test.ts` | 同上测试 |
| `src/files/composables/useUploadConflicts.ts` | 编排：串行链 + 两轮流程 + 弹窗 promise 桥 + 降级 |
| `src/files/composables/useUploadConflicts.test.ts` | 同上测试 |

**修改**

| 文件 | 改什么 |
|---|---|
| `packages/service/src/types.ts` | `UploadPrecheckResult.results` 补 `size_match` / `is_dir` |
| `src/files/upload/types.ts` | `UploadStatus` 去掉 `'conflict'`；`SelectedFile` 增 `conflictPolicy`；`UploadItem.conflictPolicy` 收窄 |
| `src/files/stores/uploads.ts` | 删 `precheckExisting` 调用与 `resolveConflict`；`addFilesToQueue` 读 `f.conflictPolicy` |
| `src/files/upload/uploadBatches.ts` | 去掉 `conflictCount` |
| `src/files/components/UploadPanel.vue` | 删内嵌逐文件冲突 Dialog |
| `src/views/Files.vue` | `commitSelectedFiles` 走 composable；挂 `FileConflictDialog`；unloadGuard 搬走 |
| `src/App.vue` | 装应用级 unloadGuard（票 A）|
| `src/files/upload/scheduler.ts` | 404/410 清 `tusUploadUrl`（票 B）|
| `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` | 新增冲突弹窗键，删旧的两个 |
| `src/styles/theme.css` | 新增 `--danger-fg` / `--danger-bg` / `--danger-border`（两个主题块）|

**删除**

| 文件 | 为什么 |
|---|---|
| `src/files/upload/conflict.ts` | 整体被 `fileConflict.ts` + `uploadConflict.ts` 取代 |
| `src/files/upload/conflict.test.ts` | 同上 |

---

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

## Task 5: 冲突弹窗组件 `FileConflictDialog.vue` + i18n + danger token

**Files:**
- Create: `src/files/components/FileConflictDialog.vue`
- Test: `src/files/components/FileConflictDialog.test.ts`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`, `src/styles/theme.css`

**Interfaces:**
- Consumes: `src/components/ui/Dialog.vue`（reka-ui 基元）；Task 1 的 `ConflictChoice`
- Produces: 组件 props `{ open, name, targetPath, isDir, allowMerge, queueIndex, queueTotal }`，events `(e: 'choose', v: ConflictChoice)` / `(e: 'cancel')`

**新增 i18n 键（中文照抄 Vue2 `zh_CN.json`，英文照抄 Vue2 的英文 key 本身）**

| 键 | zh_cn | en_us |
|---|---|---|
| `filesConflictTitle` | `已存在同名项目` | `An item with this name already exists` |
| `filesConflictQueuePos` | `第 {index} 项，共 {total} 项` | `Item {index} of {total}` |
| `filesConflictHint` | `请选择如何处理这个同名冲突` | `Choose how to handle this name conflict` |
| `filesConflictDirNote` | `文件夹不支持覆盖 — 请选择保留两者或跳过` | `Folders cannot be overwritten — choose Keep both or Skip instead` |
| `filesConflictDirNoteMerge` | `合并进已有文件夹，或选择保留两者/跳过` | `Merge into the existing folder, or keep both / skip` |
| `filesConflictOverwriteDisabled` | `文件夹不支持覆盖` | `Folders cannot be overwritten` |
| `filesConflictApplyAll` | `应用于剩余全部项目` | `Apply to all remaining items` |
| `filesConflictMerge` | `合并` | `Merge` |
| `filesConflictKeepBoth` | `保留两者` | `Keep both` |
| `filesConflictSkip` | `跳过` | `Skip` |
| `filesConflictOverwrite` | `覆盖` | `Overwrite` |
| `filesUploadSkipped` | `已跳过 {count} 项` | `Skipped {count} item(s)` |

**删除的键**（旧的逐文件弹窗，Task 8 会一并把用它的模板删掉；两个 locale 都要删）：`filesUploadConflictTitle`、`filesUploadConflictMsg`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/components/FileConflictDialog.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileConflictDialog from './FileConflictDialog.vue'
import { i18n } from '../../i18n'

function open(props: Record<string, unknown> = {}) {
  return mount(FileConflictDialog, {
    props: { open: true, name: 'a.txt', targetPath: '/DATA/Documents', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}
const btn = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

describe('FileConflictDialog', () => {
  it('shows the conflicting name and its target directory', () => {
    open()
    expect(document.body.textContent).toContain('a.txt')
    expect(document.body.textContent).toContain('/DATA/Documents')
  })

  it('emits the chosen action', async () => {
    const w = open()
    btn('覆盖')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')![0]).toEqual([{ action: 'overwrite', applyToAll: false }])
  })

  it('offers keep both and skip for a plain file conflict, and no merge', () => {
    open()
    expect(btn('保留两者')).toBeTruthy()
    expect(btn('跳过')).toBeTruthy()
    expect(btn('合并')).toBeFalsy()
  })

  it('disables Overwrite for a directory conflict and explains why', () => {
    open({ isDir: true })
    expect((btn('覆盖') as HTMLButtonElement).disabled).toBe(true)
    expect(document.body.textContent).toContain('文件夹不支持覆盖')
  })

  it('a programmatic overwrite on a directory conflict emits nothing', async () => {
    const w = open({ isDir: true })
    ;(w.vm as unknown as { choose: (a: string) => void }).choose('overwrite')
    await w.vm.$nextTick()
    expect(w.emitted('choose')).toBeUndefined()
  })

  it('shows Merge only when allowMerge AND isDir are both true', () => {
    open({ isDir: true, allowMerge: true })
    expect(btn('合并')).toBeTruthy()
    document.body.innerHTML = ''
    open({ isDir: false, allowMerge: true })
    expect(btn('合并')).toBeFalsy()
  })

  it('a programmatic merge without allowMerge emits nothing', async () => {
    const w = open({ isDir: true, allowMerge: false })
    ;(w.vm as unknown as { choose: (a: string) => void }).choose('merge')
    await w.vm.$nextTick()
    expect(w.emitted('choose')).toBeUndefined()
  })

  it('hides the queue position and apply-to-all for a single conflict', () => {
    open({ queueIndex: 0, queueTotal: 1 })
    expect(document.body.textContent).not.toContain('共 1 项')
    expect(document.body.querySelector('input[type="checkbox"]')).toBeFalsy()
  })

  it('shows a 1-based queue position for a multi-conflict queue', () => {
    open({ queueIndex: 1, queueTotal: 3 })
    expect(document.body.textContent).toContain('第 2 项，共 3 项')
  })

  it('carries applyToAll through with the chosen action', async () => {
    const w = open({ queueTotal: 2 })
    const cb = document.body.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.click()
    await w.vm.$nextTick()
    btn('跳过')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')![0]).toEqual([{ action: 'skip', applyToAll: true }])
  })

  it('resets applyToAll every time it reopens', async () => {
    const w = open({ queueTotal: 2 })
    ;(document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    btn('跳过')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')!.at(-1)).toEqual([{ action: 'skip', applyToAll: false }])
  })

  it('closing the dialog emits cancel', async () => {
    const w = open()
    await w.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
```

> **注意**：测试断言用中文字面量是因为 i18n 默认 locale 是 `zh_cn`；不要另建 `createI18n`（会与 setup 的单例重复安装），直接 import `src/i18n` 的单例。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts`
Expected: FAIL —「Failed to resolve import "./FileConflictDialog.vue"」

- [ ] **Step 3a: 加 danger token**

在 `src/styles/theme.css` 的 `:root` 块（深色，`--toast-danger-*` 附近）加：

```css
  /* SP12 Plan B: ghost-red destructive button (conflict dialog's Overwrite).
     Distinct from --toast-danger-* which is a filled toast surface. */
  --danger-fg: #ff8a8a;
  --danger-bg: rgba(255, 80, 100, 0.10);
  --danger-border: rgba(255, 80, 100, 0.40);
```

在 `:root[data-theme="light"]` 块（浅色，`--toast-danger-*` 附近）加：

```css
  --danger-fg: #c0392b;
  --danger-bg: rgba(192, 57, 43, 0.08);
  --danger-border: rgba(192, 57, 43, 0.35);
```

- [ ] **Step 3b: 加 i18n 键**

`src/i18n/zh_cn.base.ts`：把第 111-112 行的 `filesUploadConflictTitle` / `filesUploadConflictMsg` **删掉**，在同一位置加入：

```ts
  filesConflictTitle: '已存在同名项目',
  filesConflictQueuePos: '第 {index} 项，共 {total} 项',
  filesConflictHint: '请选择如何处理这个同名冲突',
  filesConflictDirNote: '文件夹不支持覆盖 — 请选择保留两者或跳过',
  filesConflictDirNoteMerge: '合并进已有文件夹，或选择保留两者/跳过',
  filesConflictOverwriteDisabled: '文件夹不支持覆盖',
  filesConflictApplyAll: '应用于剩余全部项目',
  filesConflictMerge: '合并',
  filesConflictKeepBoth: '保留两者',
  filesConflictSkip: '跳过',
  filesConflictOverwrite: '覆盖',
  filesUploadSkipped: '已跳过 {count} 项',
```

`src/i18n/en_us.base.ts`：同样删掉那两个键，加入：

```ts
  filesConflictTitle: 'An item with this name already exists',
  filesConflictQueuePos: 'Item {index} of {total}',
  filesConflictHint: 'Choose how to handle this name conflict',
  filesConflictDirNote: 'Folders cannot be overwritten — choose Keep both or Skip instead',
  filesConflictDirNoteMerge: 'Merge into the existing folder, or keep both / skip',
  filesConflictOverwriteDisabled: 'Folders cannot be overwritten',
  filesConflictApplyAll: 'Apply to all remaining items',
  filesConflictMerge: 'Merge',
  filesConflictKeepBoth: 'Keep both',
  filesConflictSkip: 'Skip',
  filesConflictOverwrite: 'Overwrite',
  filesUploadSkipped: 'Skipped {count} item(s)',
```

- [ ] **Step 3c: 写组件**

创建 `src/files/components/FileConflictDialog.vue`：

```vue
<!--
  Generic same-name-conflict dialog: shows ONE conflicting item at a time and
  lets the user pick Overwrite / Keep both / Skip (plus Merge for a
  folder-into-folder collision), with an "apply to all remaining items"
  checkbox for batches. Deliberately carries no upload-specific language — it
  only knows a name / isDir / targetPath / queue position to display and an
  action to emit. Ported from Vue2 FileConflictDialog.vue.

  Queue usage: the CALLER walks the queue (fileConflict.ts's
  resolveConflictQueue), opening this dialog fresh for each conflict. This
  component holds no queue state beyond the checkbox for the current decision.

  Directory conflicts: the backend cannot overwrite a directory, so Overwrite
  is disabled rather than hidden — a disabled control with an inline
  explanation reads clearer than a button that silently vanishes.

  Cancel (Esc / outside click) means "stop asking about the rest of this
  batch"; the caller marks this and every remaining conflict as cancelled.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import type { ConflictChoice } from '../upload/fileConflict'

const props = withDefaults(
  defineProps<{
    open: boolean
    name: string
    targetPath: string
    isDir?: boolean
    /** Shows Merge — only meaningful together with isDir. Defaults to false so
     *  a plain file conflict never offers it. */
    allowMerge?: boolean
    /** 0-based position in the caller's queue; drives the "Item N of M" line
     *  and gates the apply-to-all checkbox (meaningless for one conflict). */
    queueIndex?: number
    queueTotal?: number
  }>(),
  { isDir: false, allowMerge: false, queueIndex: 0, queueTotal: 1 },
)

const emit = defineEmits<{ (e: 'choose', v: ConflictChoice): void; (e: 'cancel'): void }>()
const { t } = useI18n()

// Scoped to THIS dialog invocation only — reset on every (re)open so a stale
// tick from a previous conflict never leaks into the next decision.
const applyToAll = ref(false)
watch(() => props.open, (v) => { if (v) applyToAll.value = false })

function choose(action: ConflictChoice['action']) {
  // Defensive only — the Overwrite button is already disabled for a directory
  // conflict and Merge only renders when it is allowed. These guard a stray
  // programmatic call.
  if (action === 'overwrite' && props.isDir) return
  if (action === 'merge' && !(props.allowMerge && props.isDir)) return
  emit('choose', { action, applyToAll: applyToAll.value })
}

function onOpenChange(v: boolean) {
  if (!v) emit('cancel')
}

defineExpose({ choose })
</script>

<template>
  <Dialog :open="open" :title="t('filesConflictTitle')" @update:open="onOpenChange">
    <div v-if="queueTotal > 1" class="fc-queue-pos">
      {{ t('filesConflictQueuePos', { index: queueIndex + 1, total: queueTotal }) }}
    </div>

    <div class="fc-item">
      <span class="fc-item-icon" aria-hidden="true">{{ isDir ? '📁' : '📄' }}</span>
      <div class="fc-item-text">
        <div class="fc-item-name" :title="name">{{ name }}</div>
        <div class="fc-item-path" :title="targetPath">{{ targetPath }}</div>
      </div>
    </div>

    <p class="fc-hint">{{ t('filesConflictHint') }}</p>

    <div v-if="isDir" class="fc-dir-note">
      {{ allowMerge ? t('filesConflictDirNoteMerge') : t('filesConflictDirNote') }}
    </div>

    <label v-if="queueTotal > 1" class="fc-apply-all">
      <input v-model="applyToAll" type="checkbox" />
      <span>{{ t('filesConflictApplyAll') }}</span>
    </label>

    <template #footer>
      <button v-if="allowMerge && isDir" class="fc-btn fc-primary" @click="choose('merge')">
        {{ t('filesConflictMerge') }}
      </button>
      <button class="fc-btn" @click="choose('skip')">{{ t('filesConflictSkip') }}</button>
      <button class="fc-btn" :class="{ 'fc-primary': !(allowMerge && isDir) }" @click="choose('keep_both')">
        {{ t('filesConflictKeepBoth') }}
      </button>
      <button
        class="fc-btn fc-danger"
        :disabled="isDir"
        :title="isDir ? t('filesConflictOverwriteDisabled') : ''"
        @click="choose('overwrite')"
      >
        {{ t('filesConflictOverwrite') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.fc-queue-pos { font-size: 11px; font-weight: 500; color: var(--fg-muted); margin-bottom: 10px; }
.fc-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px;
  border: 1px solid var(--chip-border); border-radius: 10px;
}
.fc-item-icon { flex-shrink: 0; font-size: 20px; line-height: 1.2; }
.fc-item-text { min-width: 0; flex: 1 1 auto; }
.fc-item-name {
  font-size: 13px; font-weight: 600; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-item-path {
  font-size: 11px; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-hint { margin: 12px 0 0; font-size: 12px; color: var(--fg-muted); }
.fc-dir-note {
  margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-size: 11px;
  color: var(--warn-fg); background: var(--warn-bg); border: 1px solid var(--warn-border);
}
.fc-apply-all {
  display: flex; align-items: center; gap: 6px; margin-top: 14px;
  font-size: 12px; color: var(--fg-muted); cursor: pointer;
}

.fc-btn {
  padding: 7px 16px; border-radius: 999px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.fc-btn:hover:not(:disabled) { background: var(--chip-bg-hover, var(--chip-border)); }
.fc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Every variant redeclares its own :hover background. A bare .fc-btn:hover is
   (0,2,0) and would otherwise beat a variant class at (0,1,0), washing the
   variant colour out on hover. */
.fc-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.fc-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }

.fc-danger { background: transparent; border-color: var(--danger-border); color: var(--danger-fg); }
.fc-danger:hover:not(:disabled) { background: var(--danger-bg); border-color: var(--danger-fg); }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts src/i18n/parity.test.ts`
Expected: 两个都 PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/components/FileConflictDialog.vue src/files/components/FileConflictDialog.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css
git commit -m "feat(files): add the shared same-name conflict dialog

One conflict at a time with overwrite/keep both/skip, plus merge for a
folder-into-folder collision and an apply-to-all checkbox for batches.
Overwrite is disabled rather than hidden on a directory conflict, with an
inline note explaining why. Adds ghost-red danger tokens to both themes."
```

---

## Task 6: service 层补齐 precheck 结果字段

**Files:**
- Modify: `packages/service/src/types.ts`
- Test: `packages/service/src/file.upload.test.ts`（追加一例）

**Interfaces:**
- Produces: `UploadPrecheckResult.results` 的元素类型变为 `{ relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }`

**背景**：后端 `NimoOS/route/v2/precheck_file.go:25-30` 已经在返回 `size_match` 与 `is_dir`，只是本仓类型里没写出来。第二轮内层决议要用 `is_dir` 判断能不能覆盖。

- [ ] **Step 1: 写失败的测试**

在 `packages/service/src/file.upload.test.ts` 里追加：

```ts
  it('uploadPrecheck passes through size_match and is_dir', async () => {
    const { file, post } = makeFile()   // 与该文件既有用例同款的 helper,照抄邻近用例的构造方式
    post.mockResolvedValue({ data: { results: [{ relativePath: 'a.txt', exists: true, size_match: true, is_dir: false }] } })
    const out = await file.uploadPrecheck('/DATA/x', [{ relativePath: 'a.txt', size: 5 }])
    expect(out.results[0].size_match).toBe(true)
    expect(out.results[0].is_dir).toBe(false)
  })
```

> 实现者注意：先读 `packages/service/src/file.upload.test.ts` 顶部，照该文件既有的 mock 构造方式写，不要照搬上面的 `makeFile()` 名字 —— 那只是占位，实际名字以文件里为准。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run packages/service/src/file.upload.test.ts`
Expected: FAIL — TS 报 `Property 'size_match' does not exist`（或断言 undefined）

- [ ] **Step 3: 改类型**

`packages/service/src/types.ts` 第 81-83 行改为：

```ts
export interface UploadPrecheckResult {
  // size_match / is_dir are optional in the type but always present from the
  // NimoOS core handler (route/v2/precheck_file.go) — optional only so an old
  // or degraded body can't break the type contract.
  results: { relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }[]
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/file.upload.test.ts packages/service/src/file.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 测试 PASS，vue-tsc clean

- [ ] **Step 5: 提交**

```bash
git add packages/service/src/types.ts packages/service/src/file.upload.test.ts
git commit -m "feat(service): surface size_match and is_dir from upload precheck

The core handler has always returned both fields; the type dropped them. The
merged-folder conflict round needs is_dir to decide whether overwrite can be
offered for a colliding inner path."
```

---

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

## Task 8: 拆掉旧的逐文件冲突路径（store / 类型 / UploadPanel）

**Files:**
- Modify: `src/files/upload/types.ts`, `src/files/stores/uploads.ts`, `src/files/upload/uploadBatches.ts`, `src/files/components/UploadPanel.vue`
- Delete: `src/files/upload/conflict.ts`, `src/files/upload/conflict.test.ts`
- Test: 更新 `src/files/stores/uploads.test.ts`, `src/files/components/UploadPanel.test.ts`, `src/files/upload/uploadBatches.test.ts`

**Interfaces:**
- Produces:
  - `UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'paused'`（去掉 `'conflict'`）
  - `SelectedFile = { file: File; targetPath: string; relativePath: string; conflictPolicy?: '' | 'overwrite' | 'rename' }`
  - `UploadItem.conflictPolicy: '' | 'overwrite' | 'rename'`
  - `useUploadsStore` 不再导出 `resolveConflict`

- [ ] **Step 1: 先改测试（表达新契约）**

`src/files/stores/uploads.test.ts` 第 63 行附近那条断言「precheck 命中的条目进 `conflict` 状态」整例删掉，换成：

```ts
  it('carries a per-entry conflictPolicy straight into the queue', async () => {
    const s = useUploadsStore()
    await s.addFilesToQueue([
      { file: new File(['x'], 'a.txt'), targetPath: '/DATA', relativePath: 'a.txt', conflictPolicy: 'overwrite' },
      { file: new File(['x'], 'b.txt'), targetPath: '/DATA', relativePath: 'b.txt' },
    ])
    expect(s.queue.find((i) => i.relativePath === 'a.txt')?.conflictPolicy).toBe('overwrite')
    expect(s.queue.find((i) => i.relativePath === 'b.txt')?.conflictPolicy).toBe('')
    expect(s.queue.every((i) => i.status !== 'conflict')).toBe(true)
  })

  it('does not precheck on its own — conflict resolution happens before enqueue', async () => {
    const spy = vi.spyOn(service.file, 'uploadPrecheck')
    const s = useUploadsStore()
    await s.addFilesToQueue([{ file: new File(['x'], 'a.txt'), targetPath: '/DATA', relativePath: 'a.txt' }])
    expect(spy).not.toHaveBeenCalled()
  })
```

`src/files/components/UploadPanel.test.ts`：删掉第 46 行与第 67-71 行那两例（`seed('conflict')` 与「点覆盖后 conflictPolicy 变 overwrite」）—— 逐文件冲突弹窗已不存在。同时加一例守住它不再出现：

```ts
  it('no longer renders an inline per-file conflict dialog', () => {
    seed('error')
    expect(document.body.textContent).not.toContain('文件已存在')
  })
```

`src/files/upload/uploadBatches.test.ts` 第 56 行 `isBatchSettled([mk({ status: 'conflict' })])` 整例删掉。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/stores/uploads.test.ts src/files/components/UploadPanel.test.ts src/files/upload/uploadBatches.test.ts`
Expected: FAIL —「uploadPrecheck 被调用了」/ 新加的 conflictPolicy 断言拿到 `''`

- [ ] **Step 3: 改实现**

**3a. `src/files/upload/types.ts`**

```ts
export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'paused'
```

`UploadItem.conflictPolicy` 改为：

```ts
  // Decided BEFORE enqueue by the conflict dialog flow (see
  // composables/useUploadConflicts.ts). 'skip' is not a policy — a skipped
  // entry never reaches the queue at all.
  conflictPolicy: '' | 'overwrite' | 'rename'
```

`SelectedFile` 改为：

```ts
export interface SelectedFile {
  file: File
  targetPath: string
  relativePath: string
  /** Already-resolved policy from the conflict dialog; absent means no conflict. */
  conflictPolicy?: '' | 'overwrite' | 'rename'
}
```

**3b. `src/files/stores/uploads.ts`**

- 删掉 `import { precheckExisting, conflictKey, decideConflictPolicy } from '../upload/conflict'`
- `addFilesToQueue` 里 `conflictPolicy: ''` 改为 `conflictPolicy: f.conflictPolicy || ''`（注意 `items` 的 map 回调已经拿到 `f`）
- 删掉第 159-167 行整段 precheck try/catch
- 删掉 `resolveConflict` 函数与 return 里的 `resolveConflict`

**3c. `src/files/upload/uploadBatches.ts`**

删掉第 54 行的 `conflictCount`，并检查它是否被 `BatchView` 类型/消费方引用；一并删干净（`grep -rn conflictCount src/`）。

**3d. `src/files/components/UploadPanel.vue`**

- 删掉第 36 行 `conflictItem` computed
- 删掉第 139-142 行 `resolve()` 函数
- 删掉模板第 227-228 行那整个 `<Dialog :open="!!conflictItem" …>` 块
- 如果 `Dialog` 至此在本文件已无引用，一并删掉第 13 行的 import（`grep -n "<Dialog" src/files/components/UploadPanel.vue` 确认）

**3e. 删文件**

```bash
git rm src/files/upload/conflict.ts src/files/upload/conflict.test.ts
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/ && pnpm exec vue-tsc --noEmit`
Expected: files 区全绿；vue-tsc clean（若报 `'conflict'` 残留引用，按报错逐处清）

- [ ] **Step 5: 提交**

```bash
git add -A src/files packages/service
git commit -m "refactor(files): resolve upload conflicts before enqueue, not in the queue

The queue no longer prechecks or holds a 'conflict' status: entries arrive
with their policy already decided, so the per-file dialog inside the upload
panel is gone. Replaces conflict.ts wholesale rather than layering the new
grouped flow on top of it."
```

---

## Task 9: 接线到 Files.vue

**Files:**
- Modify: `src/views/Files.vue`
- Test: `src/views/__tests__/Files.uploadConflict.test.ts`（新建）

**Interfaces:**
- Consumes: Task 7 的 `useUploadConflicts`；Task 5 的 `FileConflictDialog.vue`

**要点**

- `commitSelectedFiles` 在**两条分支**（refill 与普通上传）都要先过 `resolveEntries`。
- 受保护目录：`addFilesToQueue` 仍是最后一道闸并返回 `rejected` 用于 toast，**不要**在 composable 里重复这条策略。
- `skippedCount + cancelledCount > 0` 时弹 `filesUploadSkipped` toast；`accepted` 为空时**只**弹这个 toast 并返回。
- 弹窗必须挂在模板里并把 `dialog` 的每个字段传下去 —— 这是一条**手工转发链**，按上期教训必须有端到端测试（删掉 `@choose` 转发要变红）。

- [ ] **Step 1: 写失败的测试**

创建 `src/views/__tests__/Files.uploadConflict.test.ts`。**实现者先读同目录既有的 Files 测试**，照它的 mock/挂载方式来（service、router、pinia 的桩），下面只给必须断到的行为：

```ts
// 骨架:照 src/views/__tests__/ 下既有 Files 测试的挂载方式补齐 mock。
it('a colliding upload opens the conflict dialog and enqueues with the chosen policy', async () => {
  // 1. mock service.folder.getList 返回 { content: [{ name: 'a.txt', is_dir: false }] }
  // 2. 触发 handleSelectedFiles([File('a.txt')])
  // 3. 断言 FileConflictDialog 存在且 open 为 true
  // 4. 在该组件上 emit('choose', { action: 'overwrite', applyToAll: false })
  // 5. 断言 uploads.addFilesToQueue 收到的 SelectedFile[] 里 conflictPolicy === 'overwrite'
})

it('skipping every conflicting entry enqueues nothing and toasts the skipped count', async () => {
  // 同上,但 emit('choose', { action: 'skip' }) → addFilesToQueue 不被调用,
  // toast.show 收到含「已跳过」的文案
})

it('cancelling the dialog cancels the batch', async () => {
  // emit('cancel') → addFilesToQueue 不被调用
})

it('a refill also goes through conflict resolution', async () => {
  // 走 onRefill 分支,断言 getList 被以该批次的 targetPath 调用过
})

it('forwards the dialog choose event — deleting the handler must fail this test', async () => {
  // 端到端断言:choose 事件必须真正驱动到 addFilesToQueue。
  // 强制 RED 自证:实现完成后手动删掉模板里的 @choose 一行,本例必须变红,再还原。
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts`
Expected: FAIL（弹窗组件不存在 / addFilesToQueue 拿到的 policy 为空）

- [ ] **Step 3: 改实现**

`src/views/Files.vue`：

新增 import：

```ts
import FileConflictDialog from '../files/components/FileConflictDialog.vue'
import { useUploadConflicts } from '../files/composables/useUploadConflicts'
```

script 里：

```ts
const conflicts = useUploadConflicts()
```

`commitSelectedFiles` 改为（保留原有注释与只读快照拦截，只替换入队前的部分）：

```ts
async function commitSelectedFiles(entries: { file: File; relativePath: string }[]) {
  const pending = refillPending.value
  refillPending.value = null

  if (browse.isSnapshotView) { toast.show(t('snapBrowseWriteBlocked')); return }

  // Both branches resolve same-name conflicts BEFORE enqueuing: skipped and
  // cancelled entries must never reach the batch manifest, or reconciliation
  // would report them as missing.
  const wanted = pending
    ? entries.filter((e) => pending.missing.has(e.relativePath))
    : entries
  if (pending && !wanted.length) { toast.show(t('filesBatchRefillNoMatch')); return }

  const targetPath = pending ? pending.targetPath : files.currentPath
  const resolved = await conflicts.resolveEntries(wanted, targetPath)
  const dropped = resolved.skippedCount + resolved.cancelledCount

  if (!resolved.accepted.length) {
    if (dropped > 0) toast.show(t('filesUploadSkipped', { count: dropped }))
    return
  }

  const sel = resolved.accepted.map((a) => ({
    file: a.file,
    targetPath,
    relativePath: a.relativePath,
    conflictPolicy: a.conflictPolicy,
  }))
  const { rejected } = await uploads.addFilesToQueue(sel)
  for (const name of rejected) toast.show(t('filesUploadProtected', { name }))
  if (dropped > 0) toast.show(t('filesUploadSkipped', { count: dropped }))
}
```

> 注意 `toSelectedFiles` 若只是做同样的 map，改用上面的直接构造即可；若它还做了别的（如路径归一化），保留它并把 `conflictPolicy` 补上，**不要**丢掉它原有的逻辑 —— 实现前先读一遍。

模板里（放在 `AreaShell` 内、与 `UploadPanel` 同级）：

```vue
      <FileConflictDialog
        :open="conflicts.dialog.value.open"
        :name="conflicts.dialog.value.name"
        :target-path="conflicts.dialog.value.targetPath"
        :is-dir="conflicts.dialog.value.isDir"
        :allow-merge="conflicts.dialog.value.allowMerge"
        :queue-index="conflicts.dialog.value.queueIndex"
        :queue-total="conflicts.dialog.value.queueTotal"
        @choose="conflicts.onChoose"
        @cancel="conflicts.onCancel"
      />
```

- [ ] **Step 4: 跑测试确认通过 + 强制 RED 自证**

Run: `pnpm exec vitest run src/views/__tests__/Files.uploadConflict.test.ts`
Expected: PASS

然后**手动删掉模板里 `@choose="conflicts.onChoose"` 那一行**，重跑，确认最后一例变红；还原后重跑确认变绿。把这次自证写进任务报告。

- [ ] **Step 5: 提交**

```bash
git add src/views/Files.vue src/views/__tests__/Files.uploadConflict.test.ts
git commit -m "feat(files): route uploads through conflict resolution before enqueue

Both the regular upload and the batch-refill path now resolve same-name
conflicts first, so skipped entries never enter the batch manifest. Adds an
end-to-end test over the hand-written FileConflictDialog event forwarding —
vue-tsc cannot catch a missing @choose line, only a test can."
```

---

## Task 10: 票 A —— unloadGuard 搬到应用级

**Files:**
- Modify: `src/App.vue`, `src/views/Files.vue`
- Test: `src/App.unloadGuard.test.ts`（新建）

**问题**：`installUnloadGuard` 装在 `Files.vue` 的 `onMounted`、拆在 `onUnmounted`，但上传队列是**应用级** Pinia store（导航走了照传，也没有任何东西在 unmount 时取消队列）。开着上传离开 `/files` 再关标签页 → 中断信号不发、离站提示也不弹，只能等服务端 120s 空闲兜底，Plan A「关窗即刻标中断」的目标在这条路径上直接落空。

- [ ] **Step 1: 写失败的测试**

创建 `src/App.unloadGuard.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import { useUploadsStore } from './files/stores/uploads'

// 实现者:照 src/ 下既有的 App/router 测试补齐 router 与 service 的 mock。

describe('App-level unload guard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('signals every active batch on pagehide even when Files is not mounted', async () => {
    const interrupt = vi.fn()
    // mock service.uploadBatches.interruptBatch -> interrupt
    mount(App, { /* global mocks */ })
    const uploads = useUploadsStore()
    uploads.queue.push({ /* 一条 status:'uploading'、batchId:'b1' 的 UploadItem */ } as never)
    window.dispatchEvent(new Event('pagehide'))
    expect(interrupt).toHaveBeenCalledWith('b1')
  })

  it('warns before leaving while an upload is in flight', async () => {
    mount(App, { /* global mocks */ })
    const uploads = useUploadsStore()
    uploads.queue.push({ /* status:'uploading' */ } as never)
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})
```

并在 `src/views/__tests__/` 下加一例守住它**不再**装在 Files.vue（防止将来有人装回去，变成双份中断信号）：

```ts
  it('does not install its own unload guard — that lives at app level now', () => {
    // 断言 Files.vue 挂载/卸载不改变 window 上 beforeunload 监听的数量,
    // 或直接断言 Files.vue 源码不再 import installUnloadGuard(用 node:fs 读源文件)。
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/App.unloadGuard.test.ts`
Expected: FAIL — `interrupt` 没被调用（App.vue 还没装）

- [ ] **Step 3: 改实现**

`src/App.vue` script 里加：

```ts
import { onMounted, onUnmounted } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { installUnloadGuard } from './files/upload/unloadGuard'
import { useUploadsStore } from './files/stores/uploads'

const uploads = useUploadsStore()

// App level, not the Files view: the upload queue is an app-lifetime Pinia
// store and keeps transferring after navigating away from /files. Installing
// this in Files.vue meant closing the tab from any other route sent no
// interrupt signal and showed no leave-site prompt, leaving the batch to the
// server's 120s idle sweep.
let offUnloadGuard: (() => void) | null = null
onMounted(() => {
  offUnloadGuard = installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))
})
onUnmounted(() => { offUnloadGuard?.() })
```

`src/views/Files.vue`：删掉第 32 行的 import、第 495-497 行的 `offUnloadGuard` 三行；顺带检查 `service` import 是否还有别的用处（有就留）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/App.unloadGuard.test.ts src/files/upload/unloadGuard.test.ts src/views/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/App.vue src/views/Files.vue src/App.unloadGuard.test.ts src/views/__tests__/
git commit -m "fix(files): install the upload unload guard at app level

The upload queue is an app-lifetime store that keeps transferring after
leaving /files, but the guard was mounted and unmounted with the Files view —
so closing the tab from any other route sent no interrupt signal and showed no
leave-site prompt, silently falling back to the server's 120s idle sweep."
```

---

## Task 11: 票 B —— 重试不再撞死 URL

**Files:**
- Modify: `src/files/upload/scheduler.ts`, `src/files/stores/uploads.ts`
- Test: `src/files/upload/scheduler.test.ts`（追加）, `src/files/stores/uploads.retryBatch.test.ts`（追加）

**问题**：`retryItem` / `retryBatch` 重置了 `progress` / `bytesSent`（等于对用户承诺「重来一次」），**却不清 `item.tusUploadUrl`**。`scheduler.ts` 仍把它当 `resumeUrl` 传下去，对已删的 staging 发 HEAD 拿 404；`isRetryableTusError` 正确地不重试（<500），`humanize(404)` 把它标成「网络错误」。于是每次点继续都在敲同一个死 URL，唯一出路是取消 + 重选，而提示还在把用户往网络问题上引。SP12 让 staging 被清成为常态（中断即清 + sweeper 120s/600s），所以这条从边角变成常见路径。复现：暂停一个批次 → 等 >12 分钟 → 按继续。

- [ ] **Step 1: 写失败的测试**

`src/files/upload/scheduler.test.ts` 追加：

```ts
  it('drops a dead resume URL on 404 so the next attempt creates a fresh upload', async () => {
    const patches: Partial<UploadItem>[] = []
    const item = mk({ id: 'fq_1', tusUploadUrl: 'http://nas/upload-tus/gone' })
    const upload = vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { originalResponse: { getStatus: () => 404 } }))
    // 实现者:错误形状照该文件既有用例里 tusErrorStatus 能识别的那种构造,别自己发明。
    const s = createScheduler({
      claimNext: () => (patches.length ? null : item),
      patch: (_id, p) => { Object.assign(item, p); patches.push(p) },
      refresh: async () => null,
      concurrency: 1,
      upload,
      sleepFn: async () => {},
    })
    await s.run()
    expect(patches.some((p) => p.tusUploadUrl === null)).toBe(true)
  })

  it('does the same for 410 Gone', async () => {
    // 同上,状态码换 410
  })

  it('keeps the resume URL on a retryable 5xx', async () => {
    // 状态码 503 → patches 里不应出现 tusUploadUrl: null
  })
```

`src/files/stores/uploads.retryBatch.test.ts` 追加：

```ts
  it('retry clears the stale tus URL so a cleared staging area is recreated', () => {
    const s = useUploadsStore()
    s.queue.push(mk({ id: 'i1', status: 'error', tusUploadUrl: 'http://nas/upload-tus/gone', batchId: 'b1' }))
    s.retryBatch('b1')
    expect(s.queue[0].tusUploadUrl).toBeNull()
  })

  it('retryItem clears it too', () => {
    // 同上,走 retryItem
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/upload/scheduler.test.ts src/files/stores/uploads.retryBatch.test.ts`
Expected: FAIL — `tusUploadUrl` 仍是旧字符串

- [ ] **Step 3: 改实现**

`src/files/upload/scheduler.ts`，在 `catch` 里 `const status = tusErrorStatus(err)` 之后、`if (status === 409)` 之前插入：

```ts
        // The staging area this URL points at is gone (interrupt clears it
        // immediately; the server's sweeper clears it after the idle grace
        // period). Keeping the URL would make every retry HEAD the same dead
        // endpoint forever, reported as a bare "network error" — drop it so
        // the next attempt creates a fresh upload instead.
        if (status === 404 || status === 410) {
          deps.patch(item.id, { tusUploadUrl: null, bytesSent: 0, progress: 0 })
          item.tusUploadUrl = null
        }
```

> `item.tusUploadUrl = null` 是必要的：本轮 `for` 循环下一次 attempt 直接读 `item`，只 patch store 追不上。

`src/files/stores/uploads.ts`：

```ts
  function retryItem(id: string): void {
    // Also clears tusUploadUrl: the staging area behind it may already be gone
    // (interrupt clears it at once, the sweeper after the idle grace period),
    // and resuming a dead URL loops forever on a misleading "network error".
    patch(id, { status: 'pending', progress: 0, bytesSent: 0, error: '', tusUploadUrl: null })
    startUpload()
  }
```

`retryBatch` 里那行 patch 同样加上 `tusUploadUrl: null`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/upload/ src/files/stores/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/scheduler.ts src/files/stores/uploads.ts src/files/upload/scheduler.test.ts src/files/stores/uploads.retryBatch.test.ts
git commit -m "fix(files): drop a dead tus resume URL instead of retrying it forever

Retry reset progress but kept tusUploadUrl, so every attempt re-HEADed staging
the server had already cleared — a 404 the error mapper reports as a plain
network error, leaving cancel-and-reselect as the only way out. SP12 made
cleared staging the normal case, so this went from an edge case to a routine
dead end."
```

---

## 收尾门（全部任务完成后，由控制器亲自复跑，不转述实现者的话）

- [ ] `pnpm exec vue-tsc --noEmit` → clean
- [ ] `pnpm test` → 全绿，记下文件数/例数
- [ ] `pnpm exec vitest run src/i18n/parity.test.ts` → 9/9
- [ ] `pnpm build` → 成功
- [ ] `node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/f09c058e-ef8d-4819-9a3f-e1d2e27fd055/scratchpad/oss-check --no-commit --allow-dirty-oss` → 零真实泄漏
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/files/components/FileConflictDialog.vue` → 只应命中注释以外的零处（颜色全走 token）
- [ ] 已知非缺陷，不要去追：全量套件的 jsdom `Not implemented: navigation` 噪声（来自 photos 测试）；`src/home/components/DesktopContextMenu.test.ts` 单独跑会红、全量里是绿的（SP11 遗留的 reka-ui 隔离 flake）

## 真机验收清单（起 dev server，非 cutover 期不 deploy.sh）

验收方式：`pnpm dev --host --port <本 worktree 专用端口，避开 5273/5277/5288>`

1. 传一个目标目录**已存在同名**的**单文件** → 弹窗出现，标题「已存在同名项目」，显示文件名与目标目录，**没有**「合并」按钮，「覆盖」可点。
2. 选「覆盖」→ 上传完成后目标文件被替换（大小/时间变了），目录里**没有**多出 `xxx(1)`。
3. 同一场景选「保留两者」→ 目录里出现后端自动改名的第二份。
4. 同一场景选「跳过」→ 不上传，右下角 toast 显示「已跳过 1 项」。
5. 传一个目标目录**已存在同名文件夹**的**文件夹** → 弹窗出现「合并」按钮，且黄色提示是「合并进已有文件夹，或选择保留两者/跳过」，「覆盖」是**灰的**（悬停提示「文件夹不支持覆盖」）。
6. 选「合并」→ 文件夹里**不冲突的文件**直接落进已有文件夹；**冲突的那些**逐个再弹一次窗（弹窗里显示的是 `Trip/1.jpg` 这种完整相对路径，不是裸文件名）。
7. 一次拖入**多个**都冲突的文件 → 弹窗显示「第 1 项，共 N 项」，勾上「应用于剩余全部项目」再选一个动作 → **不再弹**，其余全部按该动作处理。
8. 冲突弹窗按 **Esc**（或点遮罩）→ 本次及剩余全部取消，toast 显示已跳过的条数，**已经开始传的不回滚**。
9. 传一个文件夹，其**同名的是一个文件**（不是文件夹）→ 弹窗**没有**「合并」按钮，黄色提示是「文件夹不支持覆盖 — 请选择保留两者或跳过」。
10. 浅色 / 深色主题各看一遍弹窗：四个按钮、黄色提示条、勾选框都不能出现白底白字或看不见的情况；鼠标悬停在「覆盖」上不能变白。
11. **票 A**：开始一个大文件上传 → 导航到 `/apps`（离开文件区）→ 关标签页 → 浏览器弹「离开此网站？」；确认离开后回到文件区，该批次的文件夹条目上**立刻**出现裂开角标（不用等 2 分钟）。
12. **票 B**：暂停一个批次 → 等 >12 分钟（让服务端 sweeper 清掉 staging）→ 按「继续」→ 应当**重新开始传并成功**，而不是反复报「网络错误」。

---

## Self-Review 记录

**1. spec 覆盖**：spec §4.3 的四动作 + `applyToAll` + 目录禁 overwrite「同时落在纯函数和按钮禁用两处」→ Task 3 的 `applyUploadResolutions`（overwrite 只对非文件夹组可达）+ Task 5 的 `:disabled` 与 `choose()` 防御，两处都有。§4.4 的两轮编排、按首段分组、`isDir` 任一侧为真、两队列 + `mergeable` → Task 2/3/4/7 逐条覆盖。spec T1「接入点本期只接上传」→ 已照办，粘贴/快照恢复接入仍是另开的票。

**2. 占位扫描**：Task 6/9/10/11 的部分测试写成了「照既有文件的 mock 方式补齐」的骨架而不是可直接粘贴的完整代码 —— 这是**有意为之**：这四处依赖本仓既有测试文件里的 helper（`makeFile`、Files 视图的 router/service 桩、`mk` 工厂），凭空写一份新的反而会与既有约定打架。每处都写明了「先读哪个文件、照什么来、必须断到什么」。其余任务的测试代码均可直接粘贴。

**3. 类型一致性**：`ConflictCandidate` / `ConflictChoice` / `ConflictResolution` / `ConflictAction` 只在 Task 1 定义，Task 2-7 一律 import；`AcceptedEntry` / `ApplyResult` / `InnerPrecheckResult` 只在 `uploadConflict.ts` 定义。`conflictPolicy` 的取值域在 `AcceptedEntry`（`'' | 'overwrite' | 'rename'`）、`SelectedFile`、`UploadItem` 三处一致 —— Task 8 专门把 `UploadItem` 从含 `'skip'` 的旧联合收窄到这三个值。
