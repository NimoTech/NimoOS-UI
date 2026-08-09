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

