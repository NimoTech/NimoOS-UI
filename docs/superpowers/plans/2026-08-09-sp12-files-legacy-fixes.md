# SP12 Files 遗留三条修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修掉 Files 区三条遗留缺陷 —— 侧栏/面包屑跟着列表滚走（F17）、右键未选中项时动作作用于当前选区（F11）、多选批量共享不门控已共享项（F12）。

**Architecture:** 两条业务缺陷（F11/F12）各抽一个纯函数放 `src/files/util/`，让判定逻辑可单测且**单一来源**（F11 的目标集同时喂动作分发与菜单形态；F12 的已共享判定同时喂单项门控与批量过滤），调用侧只做接线。F17 是纯 CSS 布局改动 + 一道源文本防复发闸。

**Tech Stack:** Vue 3 `<script setup>` · TypeScript strict · Pinia · vue-i18n · Vitest + @vue/test-utils（jsdom）

## Global Constraints

- **工作目录：`/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-files-fixes`**（分支 `sp12-files-fixes`）。所有命令从这里跑。
- **代码注释一律英文**（工作区 CLAUDE.md 硬要求）。本计划、spec、台账仍中文。
- **颜色一律 theme token**，禁止色值字面量。本期不新增颜色。
- **i18n 新键必须同时加到 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts`**，否则 `src/i18n/parity.test.ts` 红。
- **测试里读 `.css`/`.vue` 源文本一律用 `node:fs`** —— `?raw` 在本仓测试环境恒空（历史坑：color-guard 曾因此空转）。
- **不碰上传管线**：`src/files/upload/**`、`src/files/components/UploadPanel.vue`、`src/files/stores/uploads.ts`、`src/files/composables/useUploadConflicts.ts` 是并行分支 `sp12-plan-b` 的地盘，本期一行都不改。
- **`pnpm test` 约 3 分钟，前台跑，等它跑完**。不要丢后台就结束 turn（SP12 Plan A 有四个实现者栽在这上面）。
- 已知非缺陷，别去追：全量套件会打 jsdom `Not implemented: navigation` 噪声（来自不相干的 photos 测试）；`src/home/components/DesktopContextMenu.test.ts` 单独跑那一个文件时失败，全量套件里是绿的。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `src/files/util/contextTarget.ts`（新建） | 纯函数：由「被点项 + 当前选区」算出右键操作的**有效目标集** |
| `src/files/util/contextTarget.test.ts`（新建） | 上者的单测 |
| `src/files/util/shareGate.ts`（新建） | 纯函数：已共享判定 + 批量共享的可share/跳过分流 |
| `src/files/util/shareGate.test.ts`（新建） | 上者的单测 |
| `src/views/Files.contextTarget.test.ts`（新建） | 端到端：右键动作真的接到了有效目标集 |
| `src/views/Files.share.test.ts`（新建） | 端到端：批量共享的三种分流（请求内容 + toast） |
| `src/views/__tests__/filesLayoutHeightCap.test.ts`（新建） | F17 防复发的源文本双向闸 |
| `src/views/Files.vue`（改） | 接线：目标集喂动作分发与菜单 prop；`onShare` 加过滤；`.files-layout`/`.files-main`/`.files-listwrap` 三条 CSS |
| `src/files/components/FileContextMenu.vue`（改） | `alreadyShared` 改调 `shareGate` 的判定，消掉第二处实现 |
| `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts`（改） | 两个新文案键 |

---

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
  it('acts on the clicked entry alone when it is outside the selection (the F11 regression)', () => {
    expect(contextTargets(A, [B, C])).toEqual([A])
  })

  it('acts on the entire selection when the clicked entry is in it and selection has >1 item', () => {
    expect(contextTargets(B, [B, C])).toEqual([B, C])
  })

  it('acts on the clicked entry only when selection has exactly one item, even if the clicked entry is that one item', () => {
    // Vue2 ContextMenu.vue:274 gates on length > 1; when selection has one item we take the single-item path,
    // so the menu renders its single-item shape (rename/copy path enabled).
    expect(contextTargets(B, [B])).toEqual([B])
  })

  it('acts on the clicked entry when selection is empty', () => {
    expect(contextTargets(A, [])).toEqual([A])
  })

  it('returns the selection unchanged when there is no clicked entry (toolbar batch entry point)', () => {
    expect(contextTargets(null, [B, C])).toEqual([B, C])
  })

  it('returns empty array when there is no clicked entry and selection is empty', () => {
    expect(contextTargets(null, [])).toEqual([])
  })

  it('membership in selection is determined by path, not object identity', () => {
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

## Task 2: 把有效目标集接进动作分发与菜单形态

**Files:**
- Modify: `src/views/Files.vue`（`selectedOr` 及其 5 个调用点、delete 分支、`FileContextMenu` 的 prop）
- Test: `src/views/Files.contextTarget.test.ts`（新建）

**Interfaces:**
- Consumes: `contextTargets` from Task 1
- Produces: 无新导出。`FileContextMenu` 的 `selected-count` prop 语义从「原始选区条数」变为「有效目标集条数」

- [ ] **Step 1: 写失败的端到端测试**

`contextTargets` 单测绿**不代表** `onCtxAction` 每个分支都接对了 —— 这是 SP12 Plan A 终审总结过的「手工转发链」盲区（三跳转发，少写一行功能静默死掉而全套测试照绿）。所以必须有一条走真实组件的断言。

创建 `src/views/Files.contextTarget.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useClipboardStore } from '../files/stores/clipboard'
import FileContextMenu from '../files/components/FileContextMenu.vue'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
          { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
          { name: 'c.txt', path: '/DATA/c.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
}

async function mountFiles() {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => {
    folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any
  })
  const router = makeRouter()
  router.push('/files/NimoOS-HD')
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

describe('Files.vue context-menu target (F11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('Copy on unselected a when b,c are selected → clipboard contains only a', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    ;(w.vm as any).onCtxAction('copy', a)

    const clip = useClipboardStore()
    expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a.txt' }] })
  })

  it('Copy on selected b when b,c are selected → clipboard contains b,c', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const b = files.entries.find((e) => e.path === '/DATA/b.txt')!

    ;(w.vm as any).ctxEntry = b
    ;(w.vm as any).onCtxAction('copy', b)

    const clip = useClipboardStore()
    expect(clip.operateObject!.item.map((i) => i.from)).toEqual(['/DATA/b.txt', '/DATA/c.txt'])
  })

  it('Delete branch also acts on clicked entry only (delete was once a second inline implementation)', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    ;(w.vm as any).onCtxAction('delete', a)

    expect((w.vm as any).deleteDlg.entries.map((e: any) => e.path)).toEqual(['/DATA/a.txt'])
  })

  it('Menu prop reflects the effective target set, not the original selection count', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    await w.vm.$nextTick()

    // The menu shown for a must render as single-item shape — otherwise the UI lies:
    // showing multi-select shape while only acting on a.
    // Read the prop off the CHILD, not the parent's computed: a template-only
    // regression on the binding must fail this test, and asserting the parent's
    // `ctxTargetCount` cannot see the binding at all.
    expect(w.findComponent(FileContextMenu).props('selectedCount')).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/Files.contextTarget.test.ts`
Expected: FAIL —— 第 1 例剪贴板里是 b、c 而非 a；第 4 例收到的 selectedCount 是 2 而非 1

- [ ] **Step 3: 改 `Files.vue` 的 script**

① 加导入（挨着已有的 `../files/util/...` 导入放）：

```ts
import { contextTargets } from '../files/util/contextTarget'
```

② 把现有的 `selectedOr`（约 `:93-96`）整块换掉：

```ts
// Current selection (in listing order), shared by context-menu target set and batch entry points
const selectedEntries = computed(() => files.entries.filter((e) => files.isSelected(e.path)))

// Effective target set for context-menu actions — the determination logic is in util/contextTarget.ts,
// and both menu shape and all actions read the same set to avoid "menu shows multi-select, action acts on one item" mismatches.
function ctxTargets(entry: FileEntry | null): FileEntry[] {
  return contextTargets(entry, selectedEntries.value)
}

// Menu prop: must be the count of the effective target set, not the original selection count
const ctxTargetCount = computed(() => ctxTargets(ctxEntry.value).length)
```

③ 把 `onCtxAction` 里 `delete` 分支的内联逻辑（约 `:136-137`）换成走同一条路：

```ts
    case 'delete': deleteDlg.value = { open: true, entries: ctxTargets(entry) }; break
```

④ `copy` / `cut` / `download` 三个分支（约 `:140-142`）：

```ts
    case 'copy': ops.copy(ctxTargets(entry)); break
    case 'cut': ops.cut(ctxTargets(entry)); break
    case 'download': ops.download(ctxTargets(entry)); break
```

⑤ `onShare`（约 `:106`）里的 `selectedOr(entry)` 换成 `ctxTargets(entry)`：

```ts
  const folders = ctxTargets(entry).filter((e) => e.is_dir)
```

⑥ `selectionHasFolder`（约 `:99`）改用 `selectedEntries`，消掉重复的 filter：

```ts
const selectionHasFolder = computed(() => selectedEntries.value.some((e) => e.is_dir))
```

⑦ `snapshotSelection`（约 `:102`）同样改用 `selectedEntries`：

```ts
const snapshotSelection = computed(() => selectedEntries.value)
```

⑧ 确认 `selectedOr` 已无引用后删掉它。

Run 自查：`grep -n "selectedOr" src/views/Files.vue` 必须无输出。

- [ ] **Step 4: 改模板的 prop**

`src/views/Files.vue:598`：

```
        <FileContextMenu :entry="ctxEntry" :selected-count="ctxTargetCount" @action="onCtxAction">
```

- [ ] **Step 5: 跑测试确认它绿**

Run: `pnpm exec vitest run src/views/Files.contextTarget.test.ts src/files/util/contextTarget.test.ts`
Expected: PASS，11 例

- [ ] **Step 6: 强制 RED 自证(必做)**

把 Step 4 改的 prop 临时改回 `:selected-count="files.selectedCount"`，重跑：

Run: `pnpm exec vitest run src/views/Files.contextTarget.test.ts`
Expected: 第 4 例 FAIL

确认红了之后**改回来**再跑一次确认绿。这一步是在证明这条测试真的守着接线，而不是碰巧通过。

- [ ] **Step 7: 跑既有的 Files 测试确认没打破**

Run: `pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/files/components/FileContextMenu.test.ts`
Expected: 全 PASS。（`FileContextMenu.test.ts` 直接传 `selectedCount` prop，不经 `Files.vue`，语义未变，应当不受影响。）

- [ ] **Step 8: 提交**

```bash
git add src/views/Files.vue src/views/Files.contextTarget.test.ts
git commit -m "fix(files): act on the clicked entry when it is outside the selection

Right-clicking an unselected file and choosing Copy/Cut/Download/Delete used
to operate on the previous selection, with the menu still rendering its
multi-select shape. Both the dispatch and the menu prop now read the same
effective target set."
```

---

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
Expected: PASS，9 例（isAlreadyShared 4 + shareableFolders 5）

- [ ] **Step 5: 提交**

```bash
git add src/files/util/shareGate.ts src/files/util/shareGate.test.ts
git commit -m "feat(files): add the share gating helpers

One place decides 'already shared', so the single-entry menu and the batch
path cannot drift apart again."
```

---

## Task 4: 批量共享门控接线 + i18n

**Files:**
- Modify: `src/views/Files.vue`（`onShare`）
- Modify: `src/files/components/FileContextMenu.vue:22`
- Modify: `src/i18n/zh_cn.base.ts`、`src/i18n/en_us.base.ts`
- Test: `src/views/Files.share.test.ts`（新建）

**Interfaces:**
- Consumes: `isAlreadyShared` / `shareableFolders`（Task 3）、`ctxTargets`（Task 2）
- Produces: 无新导出。新 i18n 键 `filesShareSkippedShared`、`filesShareAllAlreadyShared`

- [ ] **Step 1: 加 i18n 键**

`src/i18n/zh_cn.base.ts`，紧跟 `filesShareBatchDone`（`:182`）之后：

```ts
  filesShareSkippedShared: '已跳过 {count} 个已共享项',
  filesShareAllAlreadyShared: '所选文件夹都已共享',
```

`src/i18n/en_us.base.ts`，同样位置（`:182` 之后）：

```ts
  filesShareSkippedShared: 'Skipped {count} already-shared item(s)',
  filesShareAllAlreadyShared: 'All selected folders are already shared',
```

- [ ] **Step 2: 跑 parity 闸确认两边对齐**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS，9/9。（漏加一边这里会红。）

- [ ] **Step 3: 写失败的端到端测试**

创建 `src/views/Files.share.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useToast } from '../stores/toast'

// vi.hoisted is required: vitest hoists vi.mock() above module-level consts, so a
// plain `const createShare = vi.fn()` referenced inside the factory throws a
// ReferenceError at load. Same convention as src/files/stores/shares.test.ts.
const { createShare } = vi.hoisted(() => ({ createShare: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'plain', path: '/DATA/plain', is_dir: true, extensions: null },
          { name: 'shared', path: '/DATA/shared', is_dir: true, extensions: { share: { shared: 'true' } } },
          { name: 'plain2', path: '/DATA/plain2', is_dir: true, extensions: null },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: {
      listConnections: vi.fn().mockResolvedValue([]),
      listShares: vi.fn().mockResolvedValue([]),
      createShare,
    },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
}

async function mountFiles() {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => {
    folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any
  })
  const router = makeRouter()
  router.push('/files/NimoOS-HD')
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

describe('Files.vue batch share gating (F12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createShare.mockClear()
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('Selection with already-shared mixed in → only share the unshareable, do not send already-shared to backend', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/shared', '/DATA/plain2'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare).toHaveBeenCalledTimes(1)
    expect(createShare.mock.calls[0][0]).toEqual(['/DATA/plain', '/DATA/plain2'])
  })

  it('Selection with already-shared mixed in → toast says how many were skipped', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/shared'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    // Toasts stack (the `toasts` array in stores/toast.ts:31), so the success and skipped notices
    // are on screen at the same time — assert the whole stack contains this one, not just "the last one".
    expect(useToast().toasts.map((x) => x.text)).toContain('已跳过 1 个已共享项')
  })

  it('Selection with all already-shared → send no request, explain why directly', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/shared'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare).not.toHaveBeenCalled()
    expect(useToast().toasts.map((x) => x.text)).toEqual(['所选文件夹都已共享'])
  })

  it('Selection with no already-shared → behavior same as before, no skipped notice', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/plain2'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare.mock.calls[0][0]).toEqual(['/DATA/plain', '/DATA/plain2'])
    expect(useToast().toasts.map((x) => x.text).join('|')).not.toContain('已跳过')
  })
})
```

> **Toast 形态已查证**（`src/stores/toast.ts:30-44`）：`show()` **push 进 `toasts` 数组**、各自计时移除，`msg` 只是「最后一条」的向后兼容 computed。所以「共享成功」与「已跳过 N 个」是**两条同时在屏的 toast**，不是后者覆盖前者。
>
> 本期**有意选择两条 toast**而不是合成一句：合成需要给 `shares.create` 加参数或让它不发 toast，而它是通用入口（共享列表页也在用），为一个调用点改它的签名不划算。堆叠设计本就支持这种叠加，两条都读得到。

- [ ] **Step 4: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/Files.share.test.ts`
Expected: FAIL —— 第 1 例 `createShare` 收到三条路径（含已共享的）；第 3 例 `createShare` 被调用了

- [ ] **Step 5: 改 `Files.vue` 的 `onShare`**

加导入：

```ts
import { shareableFolders } from '../files/util/shareGate'
```

把整个 `onShare`（约 `:105-115`）换成：

```ts
// Initiate sharing: right-click single folder (entry non-null, outside selection) → show link dialog after creation;
// batch multi-select (entry null) → only share unshared folders in batch, do not show link dialog (multiple names to display to user).
// Already-shared members are filtered here — backend returns SHARE_ALREADY_EXISTS for them and the whole batch fails,
// but the single-item context menu already hides the action for already-shared items (FileContextMenu's showShare),
// so batch must follow the same logic to keep the semantics consistent.
async function onShare(entry: FileEntry | null) {
  const { targets, skipped } = shareableFolders(ctxTargets(entry))
  if (!targets.length) {
    // The selection really is all folders, just all already shared — explain why so user doesn't think the button is broken
    if (skipped) toast.show(t('filesShareAllAlreadyShared'))
    return
  }
  const ok = await shares.create(targets.map((f) => f.path))
  if (!ok) return
  ops.refresh() // Refresh the listing so shared folders get their extensions.share.shared updated (else context menu still shows "Share to LAN")
  if (skipped) toast.show(t('filesShareSkippedShared', { count: skipped }))
  if (targets.length === 1) shareDlg.value = { open: true, name: shareName(targets[0].path) }
}
```

> `shares.create` 成功时自己会弹一条 toast（`stores/shares.ts:39`），跳过提示是在它之后**再弹一条**，两条同时在屏（见上方 Step 3 的说明）。
>
> `toast` 与 `t` 在 `Files.vue` 里**已经有了**（`:65` `const toast = useToast()`、`:67` `const { t } = useI18n()`），别重复声明。

- [ ] **Step 6: 消掉 `FileContextMenu` 里的第二处判定**

`src/files/components/FileContextMenu.vue`：加导入

```ts
import { isAlreadyShared } from '../util/shareGate'
```

把 `:22` 换成：

```ts
const alreadyShared = computed(() => (props.entry ? isAlreadyShared(props.entry) : false))
```

- [ ] **Step 7: 跑测试确认它绿**

Run: `pnpm exec vitest run src/views/Files.share.test.ts src/files/util/shareGate.test.ts src/files/components/FileContextMenu.test.ts`
Expected: 全 PASS

- [ ] **Step 8: 提交**

```bash
git add src/views/Files.vue src/files/components/FileContextMenu.vue src/views/Files.share.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "fix(files): skip already-shared folders in a batch share

A batch containing an already-shared folder used to fail as a whole on the
backend's SHARE_ALREADY_EXISTS. Share what can be shared, say how many were
skipped, and send nothing at all when every folder is already shared."
```

---

## Task 5: F17 布局封顶 + 防复发闸

**Files:**
- Modify: `src/views/Files.vue`（`<style scoped>` 的 `.files-layout` / `.files-main` / `.files-listwrap`）
- Test: `src/views/__tests__/filesLayoutHeightCap.test.ts`（新建）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 写失败的守卫测试**

创建 `src/views/__tests__/filesLayoutHeightCap.test.ts`：

```ts
// Bidirectional regression guard for the Files area .files-layout height capping —
// same origin and logic as photosLayoutHeightCap.test.ts in the photos area,
// except Files has only one page.
//
// Background: .files-layout originally had `min-height: 100%` (at least one viewport height,
// can grow unbounded) instead of `height: 100%`. The sidebar with align-self:stretch then
// stretched to content height instead of viewport height, and the only scroller became
// AreaShell's .area-body ⇒ sidebar and breadcrumb scrolled away with the file listing,
// and the sidebar's own overflow-y:auto never engaged (can't reach favorites when there are many).
//
// Unlike the photos area: photos had 11 pages each with an inner scroll container already,
// Files has none — so capping must be done together with building the container. Changing
// .files-layout alone would clip the listing. The three CSS rules are one unit: if any is
// missing the layout breaks, so this guard locks all three.
//
// jsdom doesn't do layout (getBoundingClientRect always 0), actual behavior is verified on device;
// this guard only locks source text and prevents regressions. Always read files with node:fs —
// `?raw` is always empty in this repo's test environment.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/views/Files.vue', 'utf8')

describe('Files area .files-layout height capping', () => {
  it('forward: .files-layout uses height: 100% to cap', () => {
    expect(SRC).toContain('.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }')
  })

  it('backward: must not regress to min-height: 100%', () => {
    expect(
      SRC.includes('.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }'),
      '.files-layout regressed to min-height:100%, sidebar and breadcrumb will scroll away with the file listing again',
    ).toBe(false)
  })

  it('.files-main has explicit min-height: 0 (without it child elements burst the parent, capping does nothing)', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-main {'))
    expect(rule, 'could not find .files-main rule').toBeTruthy()
    expect(rule).toContain('min-height: 0')
  })

  it('.files-listwrap has overflow-y: auto (after capping, it takes over scrolling)', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-listwrap {'))
    expect(rule, 'could not find .files-listwrap rule').toBeTruthy()
    expect(rule).toContain('overflow-y: auto')
  })

  it('.files-listwrap no longer uses min-height: 200px to prop up height', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-listwrap {'))
    expect(rule).not.toContain('min-height: 200px')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/__tests__/filesLayoutHeightCap.test.ts`
Expected: FAIL，5 例中 4 例红（只有「反向不许回退」那条此刻是红的反面——它现在就该红，因为文件里正是 `min-height`）

- [ ] **Step 3: 改三条 CSS**

`src/views/Files.vue` 的 `<style scoped>`，`:687-688` 与 `:695`：

```css
/* Height capping (not min-height) + .files-main's min-height:0 unblocks the flex shrinking chain
   + .files-listwrap takes over scrolling — these three are one unit. Without min-height:0, child
   elements burst the parent; without overflow-y, the listing gets clipped. After the change:
   sidebar and breadcrumb stay put, only the file listing scrolls, and FilesSidebar's own
   overflow-y:auto finally engages. */
.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.files-main { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; align-self: stretch; display: flex; flex-direction: column; } /* Stretches to fill right-side height, so whitespace below the listing can be a right-click target */
```

以及 `.files-listwrap`：

```css
.files-listwrap { position: relative; flex: 1 1 auto; min-height: 0; overflow-y: auto; user-select: none; } /* flex:1 makes whitespace below the listing part of the reka-ui right-click trigger area; after capping, this container takes over scrolling */
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/views/__tests__/filesLayoutHeightCap.test.ts`
Expected: PASS，5 例

- [ ] **Step 5: 跑全部 Files 相关测试确认没打破虚拟滚动/框选的既有断言**

Run: `pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/views/Files.contextTarget.test.ts src/views/Files.share.test.ts src/files/components/FileGridView.test.ts src/files/util/gridVirtual.test.ts`
Expected: 全 PASS

（两个测试文件都已确认存在：`src/files/components/FileGridView.test.ts`、`src/files/util/gridVirtual.test.ts`。）

- [ ] **Step 6: 提交**

```bash
git add src/views/Files.vue src/views/__tests__/filesLayoutHeightCap.test.ts
git commit -m "fix(files): pin the sidebar and breadcrumb, scroll the listing itself

.files-layout faked its height with min-height, so the sidebar stretched to
content height and AreaShell's .area-body became the only scroller -- sidebar
and breadcrumb scrolled away with the listing and the sidebar's own overflow
never engaged. Capping alone would clip the listing, so the listing wrapper
takes over scrolling in the same change."
```

---

## Task 6: 收尾门 + 台账

**Files:**
- Create: `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`

**Interfaces:**
- Consumes: Task 1-5 的全部产出
- Produces: 交接文档

- [ ] **Step 1: 类型检查**

Run: `pnpm exec vue-tsc --noEmit`
Expected: clean，零输出

- [ ] **Step 2: 全量测试(前台跑,约 3 分钟,等它跑完)**

Run: `pnpm test`
Expected: 全绿。**把文件数与用例数抄下来**写进交接文档 —— 不要转述"应该是多少"，抄实际输出。

- [ ] **Step 3: i18n parity**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS，9/9

- [ ] **Step 4: 构建**

Run: `pnpm build`
Expected: 成功

- [ ] **Step 5: 开源导出闸**

Run: `node oss/export.mjs --out /tmp/claude-1000/oss-check --no-commit --allow-dirty-oss`
Expected: 零真实泄漏（几个二进制跳过是预期内的）

- [ ] **Step 6: 与 sp12-plan-b 的合并预演**

```bash
git merge-tree --write-tree sp12-files-fixes sp12-plan-b > /tmp/claude-1000/merge-preview.txt; echo "exit=$?"
head -3 /tmp/claude-1000/merge-preview.txt
```

Expected: `exit=0` 且输出是单行 tree OID ⇒ 无冲突。若非 0，把冲突文件记进交接文档，**不要在本期解决** —— 合并顺序由控制器定。

- [ ] **Step 7: 写交接文档**

创建 `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`，必须包含：

1. **三条改了什么**，各一段：用户能看到的变化 + 代码坐标
2. **F14 判为不成立**的取证链（照抄 spec §0 的表，供下一轮审计免于重复开工）
3. **收尾门实测数字**（Step 1-6 的真实输出，不是预期值）
4. **真机验收清单**：照抄 spec §5 的 10 步，一步不删
5. **未做的相邻项**：F10（多选删除 all-or-nothing）—— 与 F12 同属「批量操作遇不合格成员」语义，本期定下的「过滤 + 告知跳过数」可直接复用；F3/F4 仍在清单上
6. **合并纪律**：与 `sp12-plan-b` 的重叠面 + Step 6 的预演结果 + 「后合的一方必须在合并结果上重跑全套门」

- [ ] **Step 8: 提交**

```bash
git add docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md
git commit -m "docs(sp12): hand off the Files legacy-fix batch"
```

---

## Self-Review

**Spec 覆盖**：spec §1（F17）→ Task 5；§2（F11）→ Task 1+2；§3（F12）→ Task 3+4，i18n 在 Task 4 Step 1；§4（测试策略）六行分别落在 Task 1 Step 1、Task 3 Step 1、Task 2 Step 1（菜单形态 + 端到端）、Task 4 Step 3、Task 5 Step 1；§5（真机验收 10 步）→ Task 6 Step 7 要求原样抄进交接文档；§6（边界）→ Global Constraints 的「不碰上传管线」+ Task 6 Step 7 第 5 点；§7（合并纪律）→ Task 6 Step 6。§0 的 F14 证伪 → Task 6 Step 7 第 2 点。无遗漏。

**占位符扫描**：无 TBD/TODO；每个代码步骤都给了可直接落地的完整代码。初稿留的两处「先查证」已在定稿前查掉并写死结论 —— toast 是堆叠数组（`stores/toast.ts:30-44`，断言改读 `toasts`，并据此明确「两条 toast」是有意选择）、两个网格测试文件均确认存在。计划里不再有待定项。

**类型一致性**：`contextTargets(entry, selected)` 在 Task 1 定义、Task 2 经 `ctxTargets` 包装消费；`isAlreadyShared` / `shareableFolders` 在 Task 3 定义，Task 4 分别在 `FileContextMenu.vue` 与 `Files.vue` 消费，返回的 `{ targets, skipped }` 字段名两处一致；`ctxTargetCount` 在 Task 2 Step 3 定义、Step 4 模板消费、Step 1 测试断言，三处同名。
