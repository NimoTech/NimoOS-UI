### Task 3: 拆掉 needs_file 重选路径

**Files:**
- Delete: `src/files/upload/serverSync.ts`, `src/files/upload/serverSync.test.ts`
- Modify: `src/files/upload/types.ts`
- Modify: `src/files/stores/uploads.ts`
- Modify: `src/files/components/UploadPanel.vue`

**Interfaces:**
- Consumes: Task 2 的 `UploadItem`（已无 `restored`/`oversize`）
- Produces: `UploadStatus` 不再有 `'needs_file'`；store 不再暴露 `reattachFiles` / `syncServerTasks`

- [ ] **Step 1: 写失败的测试**

在 `src/files/upload/noPersistence.test.ts` 里追加一个 `it`：

```ts
  it('has no needs_file status left in the upload layer', () => {
    const hits = readdirSync(dir)
      .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
      .filter((n) => readFileSync(resolve(dir, n), 'utf8').includes('needs_file'))
    expect(hits).toEqual([])
  })
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run src/files/upload/noPersistence.test.ts
```
Expected: FAIL — `expected [ 'types.ts' ] to deeply equal []`

- [ ] **Step 3: 删 serverSync**

```bash
git rm src/files/upload/serverSync.ts src/files/upload/serverSync.test.ts
```

- [ ] **Step 4: 改 `types.ts`**

```ts
export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'conflict' | 'paused'
```

- [ ] **Step 5: 改 `uploads.ts`**

1. 删 import：`import { planServerSync } from '../upload/serverSync'` 与
   `import type { ServerUploadTask } from '@nimotech/nimoos-service'`
2. 整个删掉 `reattachFiles()` 与 `syncServerTasks()`
3. `initUploads()` 里删掉 `await syncServerTasks()`，只剩 `resumePending()`：

```ts
  async function initUploads(): Promise<void> {
    if (initialized.value) return
    initialized.value = true
    resumePending()
  }
```
4. `return {…}` 里删掉 `reattachFiles`、`syncServerTasks`

- [ ] **Step 6: 改 `UploadPanel.vue`**

```bash
grep -n "needs_file\|reattach\|重选" src/files/components/UploadPanel.vue
```
删掉「重选文件」按钮与所有 `needs_file` 分支；连带删掉只服务于它的 i18n 键
（`filesUploadReselect` 等）—— **两个 locale 文件都要删**，否则 parity 测试会红。

- [ ] **Step 7: 修被牵连的测试并跑全量**

`UploadPanel.mixed-batch.test.ts` 等构造了 `status: 'needs_file'` 的用例要改或删。

```bash
pnpm test
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/i18n/parity.test.ts
```
Expected: 全量 0 failed；tsc 0；parity passed

- [ ] **Step 8: 提交**

```bash
git add -A src/files src/i18n
git commit -m "refactor(files): drop the needs_file re-pick flow

Server-side tasks no longer become local rows the user has to re-attach a
file to. With byte persistence gone this state had no way to recover
anyway, and the batch badge now covers the same ground: an interrupted
upload is reported by the NAS, not reconstructed in the browser."
```

---

