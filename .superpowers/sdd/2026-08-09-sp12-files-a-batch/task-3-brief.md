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

