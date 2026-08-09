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

