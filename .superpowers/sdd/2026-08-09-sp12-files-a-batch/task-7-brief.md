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

