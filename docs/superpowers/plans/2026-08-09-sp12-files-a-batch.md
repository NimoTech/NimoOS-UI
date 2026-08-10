# SP12 Files A 组实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐文件区五块「用户能看到、且不依赖后端与真机条件」的缺口：`cut` 的 all-or-nothing、粘贴同名冲突无检测无弹窗、框选监听泄漏、F9 三条可见 minor、时间机器 4 条残留。

**Architecture:** 粘贴冲突严格照 Vue2 上游 `pasteConflict.js` 移植，复用 plan-b 已搬来的冲突机器（`fetchExistingNames` / `findConflicts` / `resolveConflictQueue` / `FileConflictDialog.vue`），把整批拆成 overwrite 组与 rename 组、最多发两个 `batch.task` —— 这是后端 `style` 为**整批一个**所强制的形状。冲突弹窗与上传冲突共用同一条串行链与同一个 App 级宿主，保证任何时刻屏幕上只有一个冲突框。其余四块是就地修复，不引入新架构。

**Tech Stack:** Vue 3 `<script setup>` · TypeScript strict · Pinia · vue-i18n · Vitest + jsdom · `@nimotech/nimoos-service`（内联在 `packages/service/`）

## Global Constraints

- 分支 `sp12-files-fixes`，worktree `.claude/worktrees/sp12-files-fixes`。**不要合并 master、不要部署。**
- **提交信息一律英文**，祈使句主题行，正文讲「为什么」而非复述 diff。
- **代码注释一律英文**（含测试断言消息、日志、错误文案）。**测试描述（`describe`/`it` 字符串）一律英文。**
- **界面 1:1 照 Vue2，逻辑照正确**：Vue2 的 bug/竞态/吞错不照抄，改对并在注释里登记原因。禁止无关重构。
- **颜色必须走 theme token**（`var(--x)`），禁止任何 `#hex` / `rgb()` / `rgba()` / 具名色字面量。新增语义要在 `:root` 与 `:root[data-theme="light"]` 两块都给值。
- **新增 i18n 键必须同时写进 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts`**（`parity.test.ts` 会断言两侧键集合完全一致）。中文文案以 Vue2 `zh_CN.json` 为准，不要自己译。
- 每个任务自带测试，TDD：先写红的测试，跑一次确认它红，再实现，再跑绿，然后提交。
- 每个任务结束前跑 `pnpm exec vitest run <本任务涉及的测试文件>`；**收尾门由控制器统一跑**，任务内不必跑全量。
- 测试里读 `.css` 一律用 `node:fs`（`?raw` 在本仓恒空）。

---

## 已被取证推翻、**不要做**的事

| 清单条目 | 判定 | 证据 |
|---|---|---|
| F9「收藏列表里 USB 盘和普通文件夹图标一样」需**扩 `Favorite` 数据结构** | **描述错误**。Vue2 收藏项零 USB 概念 —— `TreeList.vue:49` 是 `FAVORITE_ICON_MAP[item.name] \|\| 'data-outline'`，一张**按名字**的表（Downloads/Gallery/Media/Documents）。真正的缺口是「按名字给专属图标」，而 New-UI 早有同款映射 `icons.ts:59-66`，侧栏没调用而已。**不扩数据结构**，见 Task 9 | Vue2 `origin/main:src/components/filebrowser/sidebar/TreeList.vue:32-37,49` |
| 粘贴冲突开 `merge`（合并进已有文件夹） | **后端不支持**。`NimoOS/service/file.go` 的 move(`:680`)/copy(`:789`) 两个分支只有 `skip` / `replace`+`overwrite` / `rename` 三个 case，全仓 `grep '"merge"' --include=*.go` 零命中。开了就是画一个按下去没用的按钮 ⇒ `allowMerge` 保持默认 `false` | `NimoOS/service/file.go:689,692,726,758` |

**后端能力已核实（含设备上跑的二进制）**：`style: 'rename'` = keep-both 真能用 —— `strings /usr/bin/nimoos | grep "conflict resolved via rename"` 命中；未知/空 style 被后端保守当作 skip（`file.go:758-764`），所以拆批必须显式给 style。

---

## 文件结构

**新建**
- `src/files/upload/pasteConflict.ts` —— 粘贴冲突的纯函数（`baseName` / `computePasteConflicts` / `splitPasteItems`）。放在 `upload/` 下与 `fileConflict.ts`、`uploadConflict.ts` 同级，因为它复用的是同一套冲突机器；目录名是历史遗留，不在本期改。
- `src/files/upload/pasteConflict.test.ts`

**改名（Task 5，纯机械，无行为变化）**
- `src/files/composables/useUploadConflicts.ts` → `useFileConflicts.ts`（含 `.test.ts`）
- `src/files/stores/uploadConflicts.ts` → `fileConflicts.ts`
- `src/files/components/UploadConflictHost.vue` → `FileConflictHost.vue`

**修改**
- `src/views/Files.vue` —— 框选卸载清理（T1）、粘贴接线与菜单动作收敛（T7）
- `src/files/composables/useFileOps.ts` —— `cut` 改筛选（T2）、`paste` 改冲突流程（T7）
- `src/files/util/protect.ts` —— `deletableEntries` 更名为中性的 `operableEntries`（T2）
- `src/files/stores/clipboard.ts` —— `OperateItem` 带上 `is_dir`（T3）
- `src/files/util/fileOps.ts` —— `buildPastePayload` 的 style 联合类型加 `'rename'`（T3）
- `src/files/components/FileContextMenu.vue` —— 两档粘贴收成一个（T7）
- `src/files/components/Breadcrumb.vue`、`src/files/components/FileListView.vue`（T8）
- `src/files/components/FilesSidebar.vue`（T9）
- `src/files/snapshot/TimeMachineRail.vue`（T10）
- `src/files/stores/snapshotBrowse.ts`、`src/files/snapshot/SnapshotSelectionToolbar.vue`（T11）
- `src/files/composables/useDeckPreview.ts`（T12）
- `src/styles/theme.css`（T13）
- `src/i18n/zh_cn.base.ts` + `src/i18n/en_us.base.ts`（T2、T7、T11）

---

### Task 1: 框选监听在卸载时不回收

**用户看到什么**：在文件列表里按住左键拉框，拖到一半点了侧栏跳去别的目录（或路由离开文件区）—— 此后**整个页面的文字都选不中了**，只能刷新。

**根因**：`onMarqueeDown` 在 `window` 上挂 `mousemove`/`mouseup`，`onMarqueeMove` 越过阈值后在 `document` 上挂 `selectstart`（`preventSelectStart` 无条件 `preventDefault`）。三者的移除**只写在 `onMarqueeUp` 里**（`Files.vue:546-548`）。组件卸载走的是另一条路：`Files.vue` 的 5 个 `onUnmounted` 块没有一个管框选。

**Files:**
- Modify: `src/views/Files.vue:520-555`（`onMarqueeDown` / `onMarqueeMove` / `onMarqueeUp`）
- Test: `src/views/Files.marqueeTeardown.test.ts`（新建）

**Interfaces:**
- Produces: 无对外导出。内部新增 `teardownMarquee()`，由 `onMarqueeUp` 与一个新的 `onUnmounted` 共同调用。

- [ ] **Step 1: 写失败的测试**

新建 `src/views/Files.marqueeTeardown.test.ts`。断言落在**用户可见症状**上（`selectstart` 是否还被压制），不去断言 `removeEventListener` 被调用了几次 —— 后者是实现细节，重构就会假红。

```ts
// Unmounting mid-marquee used to leave three listeners behind. The nastiest is
// `selectstart` on document: preventSelectStart cancels it unconditionally, so
// text selection stayed dead page-wide until a reload.
import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import Files from './Files.vue'
// 挂载所需的 stub/mock 照抄同目录 Files.test.ts 顶部的既有写法（router / service / i18n）。

function dispatchSelectStart(): boolean {
  const ev = new Event('selectstart', { cancelable: true, bubbles: true })
  document.dispatchEvent(ev)
  return ev.defaultPrevented
}

describe('Files marquee teardown', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('stops suppressing text selection after the view unmounts mid-drag', async () => {
    const wrapper = mount(Files, { attachTo: document.body /* 其余 options 照 Files.test.ts */ })

    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    // 越过 DRAG_THRESHOLD 才会挂上 selectstart
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))
    expect(dispatchSelectStart()).toBe(true) // 拖拽中：压制生效，这是正常行为

    wrapper.unmount()

    expect(dispatchSelectStart()).toBe(false) // 卸载后：必须放行
  })

  it('stops tracking pointer movement after the view unmounts mid-drag', async () => {
    const wrapper = mount(Files, { attachTo: document.body })
    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))

    wrapper.unmount()
    // 卸载后再动鼠标不得抛错（onMarqueeMove 会碰已销毁的 store）
    expect(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }))).not.toThrow()
  })
})
```

> **实现者注意**：如果 `Files.vue` 上还没有 `data-marquee-surface` 这个选择器，就在框选容器元素上加一个（`@mousedown="onMarqueeDown"` 所在的那个元素），别去依赖 class 名 —— class 会被样式改动带跑。加属性属于本任务范围。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
预期：第一个用例在 `expect(dispatchSelectStart()).toBe(false)` 处 FAIL（实际为 `true`）。

- [ ] **Step 3: 实现**

在 `Files.vue` 的框选段落里抽出清理函数，并在卸载时调用：

```ts
// Teardown is reachable from two directions: the drag ending normally
// (onMarqueeUp) and the view going away underneath an unfinished drag.
// Only the first one used to exist, which left `selectstart` cancelled on
// document for the rest of the session -- the whole page became unselectable
// and only a reload brought it back.
function teardownMarquee() {
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeUp)
  document.removeEventListener('selectstart', preventSelectStart)
}
```

`onMarqueeUp` 里那三行 `removeEventListener` 换成 `teardownMarquee()`（其余逻辑一字不动），并新增：

```ts
onUnmounted(() => {
  armed = false
  dragging = false
  teardownMarquee()
})
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts src/views/Files.test.ts
```
预期：全绿（既有 `Files.test.ts` 不得回归）。

- [ ] **Step 5: 变异验证**

把 `onUnmounted` 里的 `teardownMarquee()` 临时注释掉，重跑 —— 两个用例都必须变红。确认后改回。

- [ ] **Step 6: 提交**

```bash
git add src/views/Files.vue src/views/Files.marqueeTeardown.test.ts
git commit -m "fix(files): release marquee listeners when the view unmounts mid-drag

Dragging a selection box and navigating away left mousemove/mouseup on
window and selectstart on document. The last one cancels the event
unconditionally, so text selection stayed dead page-wide until reload."
```

---

### Task 2: `cut` 跟上 F10，改筛选而非整批拒绝

**用户看到什么**：选一批文件按剪切，只要里面混进一个受保护项（系统文件夹 / 已共享 / 挂载点），**整批都剪不动**，剪贴板里什么都没有。上一批已经把「删除」改成筛选了，剪切漏了。

**Files:**
- Modify: `src/files/util/protect.ts:28-40`（`deletableEntries` 更名 + JSDoc 改写）
- Modify: `src/files/composables/useFileOps.ts:61-70`（`remove` 跟着改调用名）、`:89-92`（`cut`）
- Modify: `src/i18n/zh_cn.base.ts`、`src/i18n/en_us.base.ts`
- Test: `src/files/util/protect.test.ts`、`src/files/composables/useFileOps.test.ts`

**Interfaces:**
- Produces: `operableEntries(entries: FileEntry[]): { targets: FileEntry[]; skipped: number }`（原 `deletableEntries` 更名，签名与行为一字不变）
- Produces: i18n 键 `filesCutSkippedProtected`

- [ ] **Step 1: 写失败的测试**

`src/files/util/protect.test.ts` 追加（把既有 `deletableEntries` 的用例整体改用新名，行为断言不动）：

```ts
it('operableEntries keeps the operable ones and counts the rest', () => {
  const entries = [
    { name: 'notes.txt', path: '/DATA/notes.txt', is_dir: false },
    { name: 'Documents', path: '/DATA/Documents', is_dir: true },
  ] as FileEntry[]
  const { targets, skipped } = operableEntries(entries)
  expect(targets.map((e) => e.name)).toEqual(['notes.txt'])
  expect(skipped).toBe(1)
})
```

`src/files/composables/useFileOps.test.ts` 追加三个用例（fixture 里的受保护目录**用 `Downloads`，不要用 `Gallery`** —— `Gallery` 是开源导出守卫的敏感词，上一批已因此改过一次）：

```ts
it('cut copies the operable subset to the clipboard instead of refusing the batch', () => {
  const entries = [
    { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
    { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
  ] as FileEntry[]
  ops.cut(entries)
  expect(clipboard.operateObject?.item.map((i) => i.from)).toEqual(['/DATA/a.txt'])
})

it('cut reports how many protected items it skipped', () => {
  const entries = [
    { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
    { name: 'Downloads', path: '/DATA/Downloads', is_dir: true },
  ] as FileEntry[]
  ops.cut(entries)
  expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1'))
})

it('cut still refuses outright when nothing in the selection can be moved', () => {
  const entries = [{ name: 'Downloads', path: '/DATA/Downloads', is_dir: true }] as FileEntry[]
  ops.cut(entries)
  expect(clipboard.operateObject).toBeNull()
})
```

> `ops` / `clipboard` / `toastSpy` 的搭建照该文件顶部既有的 `remove` 用例写法，不要新造一套。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts
```
预期：`operableEntries is not defined` + 三个 cut 用例 FAIL。

- [ ] **Step 3: 实现**

`protect.ts`：把 `deletableEntries` 更名为 `operableEntries`，注释改写成中性说法：

```ts
// Split a selection into what a destructive batch may actually touch and a
// count of what it must leave alone.
//
// Both delete and cut used to be all-or-nothing: one protected member -- a
// system folder, a shared folder, a mount point -- and the whole batch was
// refused, so selecting everything in /DATA and pressing delete removed
// nothing at all (pending-ledger F10). Filtering lets the rest through and
// leaves the caller to say how many were skipped, in its own wording: delete
// and cut are different verbs and cannot share one message.
export function operableEntries(entries: FileEntry[]): { targets: FileEntry[]; skipped: number } {
  const targets = entries.filter((e) => canOperate(e))
  return { targets, skipped: entries.length - targets.length }
}
```

`useFileOps.ts` 的 `remove` 把 `deletableEntries(` 换成 `operableEntries(`（其余不动），`cut` 改成：

```ts
function cut(entries: FileEntry[]) {
  const { targets, skipped } = operableEntries(entries)
  if (!targets.length) { toast.show(t('filesProtectedMove')); return }
  if (skipped > 0) toast.show(t('filesCutSkippedProtected', { count: skipped }))
  clipboard.operate('move', targets)
}
```

> `clipboard.operate` 的第二参在 Task 3 之前仍是 `string[]`。**本任务里先写成 `targets.map((e) => e.path)`**，Task 3 会把它改成传 entry。

i18n 双写（中文照 `filesDeleteSkippedProtected` 的句式）：

```ts
// zh_cn.base.ts —— 紧挨 filesDeleteSkippedProtected 那行
filesCutSkippedProtected: '已跳过 {count} 个受保护项',
// en_us.base.ts —— 同一位置
filesCutSkippedProtected: 'Skipped {count} protected item(s)',
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts src/i18n/parity.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/util/protect.ts src/files/composables/useFileOps.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/util/protect.test.ts src/files/composables/useFileOps.test.ts
git commit -m "fix(files): cut the operable subset instead of refusing the whole batch

Delete stopped being all-or-nothing last batch; cut kept the old rule, so
one protected member still emptied the clipboard for everything selected."
```

---

### Task 3: 剪贴板条目带上 `is_dir`

**为什么**：粘贴冲突弹窗要对**文件夹**冲突禁用「覆盖」（后端确实覆盖不了目录）。New-UI 的 `OperateItem` 只有 `{ from }`，判不出目录。Vue2 当年正是为这个功能才给 `operateObject.item` 加的 `is_dir`。

**Files:**
- Modify: `src/files/stores/clipboard.ts:4,12-14`
- Modify: `src/files/composables/useFileOps.ts`（`copy` / `cut` 两个调用点）
- Modify: `src/files/util/fileOps.ts:33`（style 联合类型加 `'rename'`）
- Test: `src/files/stores/clipboard.test.ts`、`src/files/util/fileOps.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `operableEntries`
- Produces: `OperateItem = { from: string; is_dir: boolean }`
- Produces: `operate(type: 'copy' | 'move', entries: { path: string; is_dir: boolean }[]): void`
- Produces: `buildPastePayload(o, to, style: 'overwrite' | 'skip' | 'rename')`

- [ ] **Step 1: 写失败的测试**

```ts
// src/files/stores/clipboard.test.ts
it('records is_dir alongside the path so paste can tell folders from files', () => {
  const store = useClipboardStore()
  store.operate('copy', [
    { path: '/DATA/Trip', is_dir: true },
    { path: '/DATA/a.txt', is_dir: false },
  ])
  expect(store.operateObject?.item).toEqual([
    { from: '/DATA/Trip', is_dir: true },
    { from: '/DATA/a.txt', is_dir: false },
  ])
})

it('isCut still matches on the real path only', () => {
  const store = useClipboardStore()
  store.operate('move', [{ path: '/DATA/Trip', is_dir: true }])
  expect(store.isCut('/DATA/Trip')).toBe(true)
  expect(store.isCut('/DATA/other')).toBe(false)
})
```

```ts
// src/files/util/fileOps.test.ts
it('buildPastePayload accepts the keep-both style the backend calls "rename"', () => {
  const o = { type: 'copy' as const, item: [{ from: '/DATA/a', is_dir: false }] }
  expect(buildPastePayload(o, '/DATA/dst', 'rename')).toEqual({
    type: 'copy', item: [{ from: '/DATA/a', is_dir: false }], to: '/DATA/dst', style: 'rename',
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts
```
预期：clipboard 用例 FAIL（`item` 少了 `is_dir`）；`buildPastePayload` 那条是 vue-tsc 层面的类型错，运行时可能先绿 —— 另跑 `pnpm exec vue-tsc --noEmit` 确认它报错。

- [ ] **Step 3: 实现**

`clipboard.ts`：

```ts
// `is_dir` rides along because paste's conflict dialog has to disable Overwrite
// for a directory collision -- the backend cannot overwrite a directory (see
// NimoOS service/file.go's move/copy style switch, which has no such case).
// Vue2 added the same field to operateObject.item for exactly this reason.
export interface OperateItem { from: string; is_dir: boolean }
export interface OperateObject { type: 'copy' | 'move'; item: OperateItem[] }
```

```ts
function operate(type: 'copy' | 'move', entries: { path: string; is_dir: boolean }[]) {
  operateObject.value = { type, item: entries.map((e) => ({ from: e.path, is_dir: !!e.is_dir })) }
}
```

`useFileOps.ts`：`copy` 与 `cut` 改成直接传 entry。

```ts
function copy(entries: FileEntry[]) {
  clipboard.operate('copy', entries)
}
```
`cut` 里 `clipboard.operate('move', targets.map((e) => e.path))` 改回 `clipboard.operate('move', targets)`。

`fileOps.ts:33`：

```ts
export function buildPastePayload(o: OperateObject, to: string, style: 'overwrite' | 'skip' | 'rename') {
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts src/files/composables/useFileOps.test.ts
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/files/stores/clipboard.ts src/files/util/fileOps.ts src/files/composables/useFileOps.ts src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts
git commit -m "feat(files): carry is_dir on clipboard items

Paste's conflict dialog has to disable Overwrite for directory collisions,
and a bare path cannot say whether it is one."
```

---

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

### Task 5: 把上传冲突编排改名成通用件（纯机械，零行为变化）

**为什么**：粘贴冲突要复用同一个弹窗**和同一条串行链** —— 屏幕上任何时刻只能有一个冲突框，两个独立 store 各开各的会同时弹两个。改名先行，功能在 Task 6。

**Files:**
- Rename: `src/files/composables/useUploadConflicts.ts` → `useFileConflicts.ts`（导出 `useUploadConflicts` → `useFileConflicts`，`UploadConflictDeps` → `FileConflictDeps`）
- Rename: `src/files/composables/useUploadConflicts.test.ts` → `useFileConflicts.test.ts`
- Rename: `src/files/stores/uploadConflicts.ts` → `fileConflicts.ts`（`useUploadConflictsStore` → `useFileConflictsStore`，`defineStore('uploadConflicts')` → `defineStore('fileConflicts')`）
- Rename: `src/files/components/UploadConflictHost.vue` → `FileConflictHost.vue`
- Modify: 所有引用点（用下面的命令找全）

- [ ] **Step 1: 找全引用点**

```bash
grep -rn "useUploadConflicts\|UploadConflictHost\|uploadConflicts" src/ --include=*.ts --include=*.vue
```
把命中清单记下来，逐个改。至少包含 `src/App.vue`、`src/views/Files.vue`、`src/files/stores/uploadConflicts.ts` 自身、两个测试文件。

- [ ] **Step 2: 用 `git mv` 改名，再改标识符**

```bash
git mv src/files/composables/useUploadConflicts.ts src/files/composables/useFileConflicts.ts
git mv src/files/composables/useUploadConflicts.test.ts src/files/composables/useFileConflicts.test.ts
git mv src/files/stores/uploadConflicts.ts src/files/stores/fileConflicts.ts
git mv src/files/components/UploadConflictHost.vue src/files/components/FileConflictHost.vue
```

`fileConflicts.ts` 的文件头注释补一句（保留原有全部说明，只加这一段）：

```
 * Named for conflicts in general, not uploads: paste reuses this same instance
 * so the two flows share one dialog and one serial chain. Two independent
 * stores would each be free to open a dialog, and the user would get two.
```

- [ ] **Step 3: 跑测试确认零行为变化**

```bash
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts src/views/Files.test.ts src/files/components/
pnpm exec vue-tsc --noEmit
grep -rn "useUploadConflicts\|UploadConflictHost\|uploadConflicts" src/ --include=*.ts --include=*.vue
```
预期：测试全绿、类型干净、最后一条 grep **零命中**。

- [ ] **Step 4: 提交**

```bash
git add -A src/
git commit -m "refactor(files): rename the upload-conflict orchestration to file-conflict

Paste is about to reuse the same dialog and the same serial chain, so the
name should not claim it is upload-only. No behaviour change."
```

---

### Task 6: 给编排件加 `resolvePaste`

**Files:**
- Modify: `src/files/composables/useFileConflicts.ts`
- Test: `src/files/composables/useFileConflicts.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `computePasteConflicts` / `splitPasteItems`；Task 3 的 `OperateItem`
- Produces（新增在既有返回对象上，既有导出一个不动）：
  `resolvePaste(items: OperateItem[], destDir: string): Promise<{ overwriteItems: OperateItem[]; renameItems: OperateItem[]; skippedCount: number }>`

- [ ] **Step 1: 写失败的测试**

```ts
describe('resolvePaste', () => {
  it('splits by the answers the user gives to each collision', async () => {
    const c = useFileConflicts({
      listFolder: async () => ({ content: [{ name: 'a.txt', is_dir: false }] }),
    })
    const items = [
      { from: '/DATA/src/a.txt', is_dir: false },
      { from: '/DATA/src/b.txt', is_dir: false },
    ]
    const p = c.resolvePaste(items, '/DATA/dst')
    await flushPromises()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt')
    c.answer({ action: 'overwrite' })
    const out = await p
    expect(out.overwriteItems.map((i) => i.from)).toEqual(['/DATA/src/a.txt'])
    expect(out.renameItems.map((i) => i.from)).toEqual(['/DATA/src/b.txt'])
  })

  it('never opens the dialog when nothing collides', async () => {
    const c = useFileConflicts({ listFolder: async () => ({ content: [] }) })
    const items = [{ from: '/DATA/src/a.txt', is_dir: false }]
    const out = await c.resolvePaste(items, '/DATA/dst')
    expect(c.dialog.value.open).toBe(false)
    expect(out.renameItems).toEqual(items)
  })

  it('never offers Merge for a paste collision', async () => {
    // The backend's move/copy style switch has no merge case; offering it
    // would render a button that does nothing.
    const c = useFileConflicts({
      listFolder: async () => ({ content: [{ name: 'Trip', is_dir: true }] }),
    })
    const p = c.resolvePaste([{ from: '/DATA/src/Trip', is_dir: true }], '/DATA/dst')
    await flushPromises()
    expect(c.dialog.value.allowMerge).toBe(false)
    expect(c.dialog.value.isDir).toBe(true)
    c.answer({ action: 'skip' })
    await p
  })

  it('runs on the same serial chain as upload batches', async () => {
    // Two flows must never have a dialog open at once.
    const c = useFileConflicts({
      listFolder: async () => ({ content: [{ name: 'a.txt', is_dir: false }] }),
    })
    const first = c.resolvePaste([{ from: '/DATA/x/a.txt', is_dir: false }], '/DATA/dst')
    const second = c.resolvePaste([{ from: '/DATA/y/a.txt', is_dir: false }], '/DATA/dst')
    await flushPromises()
    expect(c.dialog.value.targetPath).toBe('/DATA/dst')
    expect(c.dialog.value.name).toBe('a.txt')
    c.answer({ action: 'skip' })
    await flushPromises()
    // The second batch only gets the dialog after the first one is answered.
    expect(c.dialog.value.open).toBe(true)
    c.answer({ action: 'skip' })
    await Promise.all([first, second])
  })
})
```

> `answer` / `flushPromises` 的用法照该文件既有的上传用例；若既有测试用的是别的方法名（如 `choose`），照既有的来，别新造。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts
```

- [ ] **Step 3: 实现**

在 `useFileConflicts` 内部新增（复用既有的 `ask` / `chain` / `listFolder`，一个都不要新造）：

```ts
/**
 * Paste's counterpart to `run()`. Shares this composable's dialog, resolver and
 * serial chain, so an upload batch and a paste can never both be asking.
 *
 * `allowMerge` is deliberately never set: the backend's move/copy conflict
 * switch (NimoOS service/file.go) implements skip / overwrite / rename only.
 */
async function resolvePaste(items: OperateItem[], destDir: string) {
  const task = async () => {
    const conflicts = await computePasteConflicts({ items, destDir, listFolder })
    const resolutions = conflicts.length
      ? await resolveConflictQueue(conflicts, (conflict, ctx) => ask(conflict, destDir, ctx))
      : []
    return splitPasteItems(items, resolutions)
  }
  const p = chain.then(task, task)
  chain = p.then(() => undefined, () => undefined)
  return p
}
```

把 `resolvePaste` 加进 return 对象。

> **注意**：`ask` 目前用 `conflict.mergeable` 推 `allowMerge`。`computePasteConflicts` 产出的候选**不带 `mergeable`**（可选字段留空），所以 `!!undefined === false`，自动就是不给 merge —— 不需要改 `ask`。测试第三条就是钉这一点的。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts
```

- [ ] **Step 5: 变异验证**

把 `chain` 那两行临时改成直接 `return task()`（绕开串行链），重跑 —— 「runs on the same serial chain」那条必须变红。确认后改回。

- [ ] **Step 6: 提交**

```bash
git add src/files/composables/useFileConflicts.ts src/files/composables/useFileConflicts.test.ts
git commit -m "feat(files): resolve paste collisions through the shared conflict chain

Paste asks the same questions uploads do, so it reuses the same dialog and
the same serial chain rather than being free to open a second one."
```

---

### Task 7: 接线 —— 粘贴走冲突流程，右键两档收成一个

**用户看到什么**：右键空白处不再是「粘贴(覆盖)」「粘贴(跳过)」两个让人瞎猜的选项，而是一个**「粘贴」**。真撞名时才弹冲突框，逐项问、带「应用于剩余全部项目」；文件夹冲突时「覆盖」置灰并说明原因。跳过的条目走完后 toast 报数。

**Files:**
- Modify: `src/files/composables/useFileOps.ts:95-104`（`paste`）
- Modify: `src/views/Files.vue:169-170`（动作分发）、`:631`（工具栏粘贴按钮）
- Modify: `src/files/components/FileContextMenu.vue:62-66`
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`（新增 1 键、删除 2 键）
- Test: `src/files/composables/useFileOps.test.ts`、`src/files/components/FileContextMenu.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `resolvePaste`；Task 3 的 `buildPastePayload(..., 'rename')`
- Produces: `paste(): Promise<void>`（**不再收 style 参数**）
- Produces: i18n 键 `filesPasteSkipped`
- 删除 i18n 键 `filesCtxPasteOverwrite`、`filesCtxPasteSkip`

- [ ] **Step 1: 写失败的测试**

```ts
// useFileOps.test.ts
it('paste submits one overwrite task and one keep-both task', async () => {
  // resolvePaste 用 store 打桩：overwriteItems 一条、renameItems 一条
  await ops.paste()
  expect(taskSpy).toHaveBeenCalledTimes(2)
  expect(taskSpy.mock.calls.map((c) => JSON.parse(JSON.stringify(c[0])).style).sort())
    .toEqual(['overwrite', 'rename'])
})

it('paste submits a single task when nothing was overwritten', async () => {
  await ops.paste()
  expect(taskSpy).toHaveBeenCalledTimes(1)
  expect(taskSpy.mock.calls[0][0]).toMatchObject({ style: 'rename' })
})

it('paste tells the user how many items it skipped', async () => {
  await ops.paste()
  expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2'))
})

it('paste clears the clipboard and submits nothing when every item was skipped', async () => {
  await ops.paste()
  expect(taskSpy).not.toHaveBeenCalled()
  expect(clipboard.operateObject).toBeNull()
})
```

```ts
// FileContextMenu.test.ts
it('offers a single Paste entry, not a pre-chosen overwrite/skip pair', () => {
  const w = mountMenu({ entry: null, hasPasteData: true })
  expect(w.findAll('.ctx-paste')).toHaveLength(1)
  expect(w.find('.ctx-paste-overwrite').exists()).toBe(false)
  expect(w.find('.ctx-paste-skip').exists()).toBe(false)
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/composables/useFileOps.test.ts src/files/components/FileContextMenu.test.ts
```

- [ ] **Step 3: 实现**

`useFileOps.ts` 的 `paste`：

```ts
// Paste used to make the user pre-choose "overwrite" or "skip" from the context
// menu, before anything had looked at whether a collision existed at all. Now
// it checks first and asks only about real collisions, the same way uploads do.
//
// Two tasks, not one: the backend's `style` applies to a whole batch, so the
// items the user chose to overwrite and the items that keep both have to be
// submitted separately.
async function paste() {
  if (blockedInSnapshot()) return
  const o = clipboard.operateObject
  if (!o) return
  const conflicts = useFileConflictsStore()
  try {
    const { overwriteItems, renameItems, skippedCount } = await conflicts.resolvePaste(o.item, files.currentPath)
    if (skippedCount > 0) toast.show(t('filesPasteSkipped', { count: skippedCount }))
    if (overwriteItems.length) await service.batch.task(buildPastePayload({ ...o, item: overwriteItems }, files.currentPath, 'overwrite'))
    if (renameItems.length) await service.batch.task(buildPastePayload({ ...o, item: renameItems }, files.currentPath, 'rename'))
    clipboard.clear()
  } catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
}
```

`FileContextMenu.vue:62-66`：两个 `ContextMenuItem` 换成一个。

```vue
<template v-if="clipboard.hasPasteData && !inSnapshot">
  <ContextMenuSeparator class="ui-ctx-sep" />
  <ContextMenuItem class="ui-ctx-item ctx-paste" @select="fire('paste')">{{ t('filesPaste') }}</ContextMenuItem>
</template>
```

`Files.vue`：`:169-170` 两个 case 合成 `case 'paste': ops.paste(); break`；`:631` 的工具栏按钮 `@click="ops.paste('overwrite')"` 改成 `@click="ops.paste()"`。

i18n：新增

```ts
// zh_cn.base.ts
filesPasteSkipped: '已跳过 {count} 项',
// en_us.base.ts
filesPasteSkipped: 'Skipped {count} item(s)',
```

删除两侧的 `filesCtxPasteOverwrite`、`filesCtxPasteSkip`。

> **删键前先自查**：`grep -rn "filesCtxPasteOverwrite\|filesCtxPasteSkip" src/` 必须只剩两个 locale 文件自己。上一批删孤儿键时踩过 `messageSyntax.test.ts` 拿键名当夹具的坑 —— 本次已确认这两个键没被当夹具，但**改完仍要跑一次 `messageSyntax.test.ts`**。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/composables/useFileOps.test.ts src/files/components/FileContextMenu.test.ts src/views/Files.test.ts src/i18n/
```

- [ ] **Step 5: 提交**

```bash
git add -A src/
git commit -m "feat(files): detect paste collisions instead of pre-choosing a policy

The context menu used to ask for overwrite-or-skip before anything had
checked whether a name was even taken. Paste now lists the destination
first and prompts only for real collisions, reusing the upload dialog."
```

---

### Task 8: F9 —— 面包屑最后一段与表头空列不再假装可点

**用户看到什么**：① 面包屑最后一段（当前目录）鼠标移上去有 hover 反馈、点了会白导航一次到自己。② 列表表头最左的复选框列和最右的星标列鼠标变手型，点了没反应。

**Files:**
- Modify: `src/files/components/Breadcrumb.vue:26,35`
- Modify: `src/files/components/FileListView.vue:52`
- Test: `src/files/components/Breadcrumb.test.ts`、`src/files/components/FileListView.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// Breadcrumb.test.ts
it('does not navigate when the current directory segment is clicked', async () => {
  const w = mountCrumb({ path: '/DATA/a/b' })
  const crumbs = w.findAll('.crumb')
  await crumbs[crumbs.length - 1].trigger('click')
  expect(w.emitted('navigate')).toBeUndefined()
})

it('still navigates from an ancestor segment', async () => {
  const w = mountCrumb({ path: '/DATA/a/b' })
  await w.findAll('.crumb')[0].trigger('click')
  expect(w.emitted('navigate')).toBeTruthy()
})
```

```ts
// FileListView.test.ts —— 用 cssCascade 工具算优先级，jsdom 不做样式计算
it('does not give the non-sortable header cells a pointer cursor', () => {
  const css = fs.readFileSync(new URL('./FileListView.vue', import.meta.url), 'utf8')
  // cursor:pointer 必须挂在真能排序的格子上，不能挂在通吃的 .head-cell 上
  expect(css).not.toMatch(/\.head-cell\s*\{[^}]*cursor:\s*pointer/)
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts
```

- [ ] **Step 3: 实现**

`Breadcrumb.vue`：最后一段渲染成不可交互元素。

```vue
<!-- The last segment is where you already are: it used to be a live button
     that navigated to the current directory, with hover feedback promising
     something would happen. -->
<span v-if="i === segments.length - 1" class="crumb current">{{ seg.label }}</span>
<button v-else class="crumb" @click="emit('navigate', seg.vpath)">{{ seg.label }}</button>
```

样式里 `.crumb.current` 保留原有配色/字重不动；确认 `.crumb:hover` 只对 `button.crumb` 生效（`<span>` 不再是 button，但 `.crumb:hover` 仍会命中它）—— 把 hover 规则收窄：

```css
button.crumb:hover { background: var(--chip-bg); color: var(--fg); }
```

> 注意原文里 `.crumb` 与 `.crumb:hover` 用了 `var(--fg-muted, #9aa4bf)` / `var(--chip-bg, rgba(255,255,255,0.06))` 这种**带硬编码兜底色**的写法。本任务既然动到这两条规则，**顺手把兜底字面量去掉**（token 在两套主题里都有值，兜底是死的），符合仓库的颜色硬约束。

`FileListView.vue:52`：

```css
/* Only the sortable columns react to clicks; the checkbox and star columns
   are spacers and used to inherit a pointer cursor that promised nothing. */
.head-cell { user-select: none; }
.head-cell.is-sortable { cursor: pointer; }
```

并在 `:32` 那个 `v-for` 渲染的可排序格子上补 `is-sortable` 类。

- [ ] **Step 4: 跑测试确认它绿 + 守卫门**

```bash
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts src/styles/
```
（`src/styles/` 下有 color-guard 与注释完整性守卫，动过 CSS 必须跑。）

- [ ] **Step 5: 提交**

```bash
git add -A src/
git commit -m "fix(files): stop advertising clicks that do nothing

The breadcrumb's last segment navigated to the directory you were already
in, and the two spacer header cells inherited a pointer cursor from the
sortable ones."
```

---

### Task 9: F9 —— 收藏项用按名字的专属图标

**用户看到什么**：侧栏收藏里的 Downloads / Gallery / Media / Documents / AppData 显示各自的专属图标，而不是清一色的通用文件夹图标。

**⚠️ 这不是「USB 图标」**。取证见本计划开头的推翻表：Vue2 `TreeList.vue:49` 用的是按名字的 `FAVORITE_ICON_MAP`，零 USB 概念。New-UI 的等价物是 `icons.ts:59-66` 的 `FOLDER_BY_NAME`，经 `iconNameFor` 暴露 —— **不要扩 `Favorite` 类型**。

**Files:**
- Modify: `src/files/components/FilesSidebar.vue`（收藏项那条 `<img>`，`:235` 附近）
- Test: `src/files/components/FilesSidebar.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
it('gives a favourite the icon its name maps to, not the generic folder', () => {
  const w = mountSidebar({ favorites: [{ name: 'Downloads', path: '/DATA/Downloads' }] })
  const src = w.find('.side-fav .side-icon').attributes('src')
  expect(src).toContain('folder-download')
})

it('falls back to the generic folder icon for an unmapped name', () => {
  const w = mountSidebar({ favorites: [{ name: 'Trip 2026', path: '/DATA/Trip 2026' }] })
  const src = w.find('.side-fav .side-icon').attributes('src')
  expect(src).toContain('folder-default')
})
```

> 若收藏 `<li>` 上没有 `.side-fav` 这样可定位的类，就加一个（属于本任务范围），别用 `findAll('.side-item')[n]` 这种靠顺序的脆弱定位。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/components/FilesSidebar.test.ts
```

- [ ] **Step 3: 实现**

`FilesSidebar.vue` 引入 `iconNameFor`（同文件已引 `iconUrl`），收藏项的 `<img>` 改成：

```vue
<!-- Favourites are always folders, so the name map in icons.ts is the whole
     story -- same as Vue2's FAVORITE_ICON_MAP. -->
<img class="side-icon" :src="iconUrl(iconNameFor({ name: fav.name, is_dir: true }))" alt="" />
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/components/FilesSidebar.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/components/FilesSidebar.vue src/files/components/FilesSidebar.test.ts
git commit -m "fix(files): give sidebar favourites their per-name folder icons

The name-to-icon map already existed and the file listing already used it;
the sidebar hardcoded the generic folder icon instead."
```

---

### Task 10: 时间机器 —— 刻度尺把选中刻度滚进视野

**用户看到什么**：快照有上百条时，刻度尺装不下会出现自己的滚动条。按 ↑/↓ 拨到屏幕外的快照后，**刻度尺看不出在动**（卡堆和底栏是对的，只有刻度尺没跟上）。

**Files:**
- Modify: `src/files/snapshot/TimeMachineRail.vue`
- Test: `src/files/snapshot/TimeMachineRail.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
it('scrolls the newly selected tick into view', async () => {
  const spy = vi.fn()
  // jsdom 不实现 scrollIntoView
  Element.prototype.scrollIntoView = spy
  const w = mount(TimeMachineRail, { props: { groups: manyGroups(), selectedIndex: 0 } })
  spy.mockClear()
  await w.setProps({ selectedIndex: 40 })
  await nextTick()
  expect(spy).toHaveBeenCalled()
})

it('does not scroll when the selection did not change', async () => {
  const spy = vi.fn()
  Element.prototype.scrollIntoView = spy
  const w = mount(TimeMachineRail, { props: { groups: manyGroups(), selectedIndex: 3 } })
  spy.mockClear()
  await w.setProps({ groups: manyGroups() })
  await nextTick()
  expect(spy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts
```

- [ ] **Step 3: 实现**

在 `TimeMachineRail.vue` 的 `<script setup>` 里新增（`watch` 已在 import 之外，需补进 vue 的 import 列表）：

```ts
// The rail scrolls once the snapshots outgrow its height, and the deck/bottom
// bar were the only things following the selection -- pressing up/down past the
// visible range moved everything except the rail, which looked frozen.
//
// `block: 'nearest'` so an already-visible tick is left exactly where it is;
// anything else would yank the whole rail on every keypress.
watch(() => props.selectedIndex, async (index) => {
  await nextTick()
  const root = railEl.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-flat-index="${index}"]`)
  el?.scrollIntoView({ block: 'nearest' })
})
```

> **不要**给 `scrollIntoView` 传 `behavior: 'smooth'`：拨刻度是连按的，平滑滚动会互相打断并落后于选择。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/snapshot/TimeMachineRail.vue src/files/snapshot/TimeMachineRail.test.ts
git commit -m "fix(files): keep the selected tick in view on the time machine rail

With a hundred snapshots the rail scrolls, and stepping past the visible
range moved the deck and the bar but left the rail looking frozen."
```

---

### Task 11: 时间机器 —— 批量恢复给出进度

**用户看到什么**：在快照里选几十项点恢复，后端一次只收一个 path，前端串行提交 —— 全程只有一个禁用态按钮，看不出还要多久、也看不出是不是卡死了。改完后能看到 `正在恢复 3/40`。

**串行本身改不了**（后端 `POST /v2/snapshot/restore` 一次一个 path，这是它的形状），本任务只让进度可见。

**Files:**
- Modify: `src/files/stores/snapshotBrowse.ts:94-137`
- Modify: `src/files/snapshot/SnapshotSelectionToolbar.vue`（显示进度）
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`
- Test: `src/files/stores/snapshotBrowse.test.ts`、`src/files/snapshot/SnapshotSelectionToolbar.test.ts`

**Interfaces:**
- Produces: store 新增 `restoreProgress: Ref<{ done: number; total: number } | null>`（不在恢复中时为 `null`）
- Produces: i18n 键 `snapBrowseRestoringProgress`

- [ ] **Step 1: 写失败的测试**

```ts
// snapshotBrowse.test.ts
it('reports how far a batch restore has got', async () => {
  // 每条 restore 都挂在一个受测试控制的 deferred 上，好在中途断言进度。
  const gates: Array<() => void> = []
  const restore = vi.fn(() => new Promise((res) => {
    gates.push(() => res({ restored_path: '/DATA/x.restored-1' }))
  }))
  const store = useSnapshotBrowseStore(/* 注入 restore，装配照该文件既有用例 */)

  const p = store.restoreEntries(threeEntries)
  await flushPromises()
  expect(store.restoreProgress).toEqual({ done: 0, total: 3 })

  gates[0]!(); await flushPromises()
  expect(store.restoreProgress).toEqual({ done: 1, total: 3 })

  gates[1]!(); await flushPromises()
  expect(store.restoreProgress).toEqual({ done: 2, total: 3 })

  gates[2]!(); await p
  expect(store.restoreProgress).toBeNull()
})

it('clears the progress even when a restore throws', async () => {
  const store = useSnapshotBrowseStore()
  await store.restoreEntries(entriesThatFail)
  expect(store.restoreProgress).toBeNull()
})
```

```ts
// SnapshotSelectionToolbar.test.ts
it('shows the running count while a batch restore is in flight', () => {
  const w = mountToolbar({ restoreProgress: { done: 2, total: 5 } })
  expect(w.text()).toContain('2')
  expect(w.text()).toContain('5')
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/stores/snapshotBrowse.test.ts src/files/snapshot/SnapshotSelectionToolbar.test.ts
```

- [ ] **Step 3: 实现**

`snapshotBrowse.ts`：新增 ref 并在循环里推进。

```ts
// The backend takes one path per call, so the loop below stays serial. What
// it cannot stay is silent: picking forty files meant a disabled button and
// no sign of life until every one of them had come back.
const restoreProgress = ref<{ done: number; total: number } | null>(null)
```

循环改成：

```ts
const results = []
restoreProgress.value = { done: 0, total: list.length }
for (const item of list) {
  results.push(await performSnapshotRestore({ /* 既有四个参数一字不动 */ }))
  restoreProgress.value = { done: results.length, total: list.length }
}
```

`finally` 块里补 `restoreProgress.value = null`（与既有的 `restoring.value = false` 并列 —— 抛错路径也必须清）。把 `restoreProgress` 加进 store 的 return。

> **Pinia 陷阱**：setup store 的 ref **必须写进 return 才能被外部读到**，漏写不报错、外部读恒 `undefined`。加完自己 grep 一遍 return 列表。

`SnapshotSelectionToolbar.vue`：恢复按钮在 `restoreProgress` 非空时显示进度文案，颜色/尺寸沿用按钮既有 token，不新增样式语义。

i18n：

```ts
// zh_cn.base.ts
snapBrowseRestoringProgress: '正在恢复 {done}/{total}',
// en_us.base.ts
snapBrowseRestoringProgress: 'Restoring {done}/{total}',
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/stores/snapshotBrowse.test.ts src/files/snapshot/ src/i18n/
```

- [ ] **Step 5: 提交**

```bash
git add -A src/
git commit -m "feat(files): show progress while restoring a batch from a snapshot

The backend restores one path per call, so the loop is serial by
necessity; forty files meant a disabled button and no sign of life."
```

---

### Task 12: 时间机器 —— 预览失败允许自愈

**用户看到什么**：卡堆里某张卡的预览因为网络抖动加载失败，退成纯文字卡后**永远不会自己恢复**，哪怕网络早就好了；只有拨到别的刻度再拨回来（换掉可见集合）才绕得开。

**根因**：`useDeckPreview.ts:96` 的守卫是 `if (!previews.value[name]) fetchOne(...)` —— `failed` 也是一个真值条目，于是被当成「已经拉过」。

**Files:**
- Modify: `src/files/composables/useDeckPreview.ts:93-99`
- Test: `src/files/composables/useDeckPreview.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
it('retries a preview that failed once the visible set changes again', async () => {
  const getList = vi.fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({ content: [{ name: 'a.txt', is_dir: false }] })
  // 装配照该文件既有用例
  const visible = ref(['snapA'])
  const { previews } = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => '', visibleNames: () => visible.value })
  await flushPromises()
  expect(previews.value.snapA.status).toBe('failed')

  visible.value = ['snapA', 'snapB'] // 拨一格刻度
  await flushPromises()
  expect(previews.value.snapA.status).toBe('ready')
})

it('does not retry a preview that came back 404 (missing)', async () => {
  // "那时候还没有这个文件夹" 是稳定事实，不是抖动 —— 重试只是白打请求
  const getList = vi.fn().mockRejectedValue({ code: 404 })
  const visible = ref(['snapA'])
  const { previews } = useDeckPreview({
    mountPoint: () => '/DATA', relPath: () => '', visibleNames: () => visible.value,
  })
  const snapACalls = () => getList.mock.calls.filter((c) => String(c[0]).includes('snapA')).length

  await flushPromises()
  expect(previews.value.snapA.status).toBe('missing')
  expect(snapACalls()).toBe(1)

  visible.value = ['snapA', 'snapB'] // 拨一格刻度
  await flushPromises()
  expect(snapACalls()).toBe(1) // 仍然是 1：missing 不重试
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```

- [ ] **Step 3: 实现**

```ts
for (const name of opts.visibleNames()) {
  const cached = previews.value[name]
  // A `failed` entry means the request blew up -- usually a blip. It used to
  // count as "already fetched" and the card stayed a text card for as long as
  // it remained visible, even after the network came back. `missing` (404) is
  // a stable fact about that snapshot and is never retried.
  if (!cached || cached.status === 'failed') fetchOne(name, epoch)
}
```

> **不会变成重试风暴**：`previews` 不在这个 `watch` 的来源里，所以写入 `failed` 不会自触发。重试只发生在下一次真的换目录/换卷/拨刻度时。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/composables/useDeckPreview.ts src/files/composables/useDeckPreview.test.ts
git commit -m "fix(files): retry snapshot card previews that failed

A failed entry counted as already-fetched, so a card that lost one request
to a network blip stayed a plain text card until the folder changed."
```

---

### Task 13: 删掉 `--tm-star` 死 token

**用户看到什么**：什么都看不到 —— 这是纯清理。星空效果**有意没有实现**（`timeMachineMath.ts:6` 写明 Vue2 的 `generateStarfieldShadow` 有意不移植，星点由 CSS 承担、浅色主题没有星空），但两套主题各留了一个从未被引用的 token。

**Files:**
- Modify: `src/styles/theme.css:200`、`:545-550`
- Test: `src/styles/`（既有守卫）

- [ ] **Step 1: 确认它真的是死的**

```bash
grep -rn "tm-star" src/
```
预期：只有 `src/styles/theme.css` 两处定义，零引用。**若出现任何第三处命中，停下来汇报，不要删。**

- [ ] **Step 2: 删除**

删 `:200` 的 `--tm-star: rgba(255, 255, 255, 0.85);` 与浅色块里的 `--tm-star: transparent;`。

`:545` 那条说明性注释里提到「没有星空(--tm-star 透明)」，把括号里对 token 的引用去掉，保留「浅色纸感:没有星空,背景是米白 + 极淡光晕」这个仍然成立的说明。

> **CSS 注释红线**：改注释时确认没有 `*` 紧贴 `/` —— 那会提前关闭注释块，错误恢复会吃掉后面整条规则，而五道门全瞎。`src/styles/` 下有专门守卫这个的测试，务必跑。

- [ ] **Step 3: 跑守卫**

```bash
pnpm exec vitest run src/styles/
pnpm exec vitest run src/files/snapshot/
```

- [ ] **Step 4: 提交**

```bash
git add src/styles/theme.css
git commit -m "chore(styles): drop the unused --tm-star token

The starfield was deliberately never ported (timeMachineMath.ts says so);
both themes kept defining a colour nothing reads."
```

---

## 收尾门（控制器统一跑，不在任务内）

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run
pnpm exec vitest run src/i18n/parity.test.ts
pnpm build
node oss/export.mjs --out /tmp/claude-1000/oss-preview --no-commit --allow-dirty-oss
```

**跑 oss 门前必须先提交** —— 未提交的 `src/**` 改动会让 `checkClean` 拒绝导出，表现成另外几条 export 测试变红，容易误判成新缺陷。

---

## 真机验收清单（交付时给出，本期不跑）

前四项起 dev server 验（`pnpm dev --host --port 5299`，避开 5273/5277/5288）。**非 cutover 期不要 `deploy.sh`。**

**粘贴冲突**
1. 复制一个文件到已有同名文件的目录 → 弹冲突框 → 选「覆盖」→ 目标被替换（不是多出 `xxx(1)`）
2. 同上选「保留两者」→ 出现 `xxx(1)`，原文件不动
3. 复制**文件夹**到已有同名文件夹的目录 → 弹窗里「覆盖」**置灰**并写明「文件夹不支持覆盖」
4. 一次复制 3 个都撞名的 → 第一个勾「应用于剩余全部项目」选跳过 → 不再弹第 2、3 个，toast 说「已跳过 3 项」
5. 复制一批**不撞名**的 → **完全不弹窗**，直接粘贴成功
6. 弹窗出现时按 Esc → 该项及其余全部按取消处理，已回答过的不回滚
7. 右键空白处只有一个「粘贴」，没有「粘贴(覆盖)/粘贴(跳过)」
8. 弹窗出现时点浏览器后退离开文件区 → 弹窗**仍在**且仍能回答（与票 E 同一条链）

**剪切**
9. 选一批含 1 个受保护项剪切 → 剪贴板拿到其余项，toast 说「已跳过 1 个受保护项」；粘贴过去只移动了那些
10. 选区全是受保护项剪切 → toast「此项目受保护,无法移动」，剪贴板为空

**框选**
11. 在列表里拉框到一半，不松手直接点侧栏跳走 → 落地后**页面文字能正常选中**（这是本条的全部意义）

**F9**
12. 面包屑最后一段：鼠标移上去**无** hover 反馈，点了不发生任何事
13. 表头最左复选框列 / 最右星标列：鼠标**不变手型**
14. 侧栏收藏里的 Downloads/Gallery/Media/Documents 各自显示专属图标

**时间机器**（需先起 `scripts/tmlab/`：`node scripts/tmlab/server.mjs` + `pnpm exec vite --config vite.config.tmlab.ts`，`?tmlab_set=default`）
15. 造一个快照上百条的数据集，连按 ↑ 拨到屏幕外 → **刻度尺跟着滚**，选中刻度始终可见
16. 选 10 项以上点恢复 → 看得到 `正在恢复 n/N` 在涨
17. 断网让某张卡预览失败 → 恢复网络后拨一格刻度再拨回 → 该卡**自己恢复**成有内容的预览

**主题**
18. 浅色 / 深色各看一遍冲突弹窗与恢复进度：按钮、置灰态、危险色不得白底白字或看不见

---

## 边界与不做的事

- **不做 `merge`**：后端 move/copy 无此 case（取证见开头推翻表）。
- **不改恢复的串行性**：需要后端批量接口，超出本期。
- **不做 F4 视频封面**：需要 core 加 ffmpeg 抽帧，是后端票。
- **不扩 `Favorite` 数据结构**：F9 的 USB 说法已被推翻。
- **不合并 master、不部署、不推 origin。**
