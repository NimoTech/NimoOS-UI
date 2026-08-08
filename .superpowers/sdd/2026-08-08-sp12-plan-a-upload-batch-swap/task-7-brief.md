### Task 7: 重传缺失文件

**Files:**
- Modify: `src/files/components/UploadBatchModal.vue`, `src/files/components/UploadBatchModal.test.ts`
- Modify: `src/views/Files.vue`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`

**Interfaces:**
- Consumes: Task 6 的弹窗；Task 4 的 `addFilesToQueue`
- Produces: 弹窗新增 emit
  `(e: 'refill', payload: { targetPath: string; missing: string[] }): void`

- [ ] **Step 1: 写失败的测试**

在 `UploadBatchModal.test.ts` 追加：

```ts
  it('emits refill with the target path and missing relative paths', async () => {
    getBatch.mockResolvedValue(detail)
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-refill').trigger('click')
    expect(w.emitted('refill')?.[0]).toEqual([
      { targetPath: '/DATA/x', missing: ['Trip/a.jpg', 'Trip/b.jpg'] },
    ])
    expect(w.emitted('close')).toBeTruthy()
  })

  it('disables refill when nothing is missing', async () => {
    getBatch.mockResolvedValue({ batch: detail.batch, missing: [] })
    const w = mountModal()
    await flushPromises()
    expect(w.find('.ubm-refill').attributes('disabled')).toBeDefined()
  })
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
```
Expected: FAIL — 找不到 `.ubm-refill`

- [ ] **Step 3: 加 i18n 键**

`zh_cn.base.ts`：`filesBatchRefill: '重传缺失文件',`
`en_us.base.ts`：`filesBatchRefill: 'Re-upload missing files',`

- [ ] **Step 4: 实现**

`UploadBatchModal.vue` 的 emits 加一行：

```ts
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'abandoned'): void
  (e: 'refill', payload: { targetPath: string; missing: string[] }): void
}>()
```

script 加：

```ts
function refill(): void {
  emit('refill', {
    targetPath: batch.value?.target_path || '',
    missing: missing.value.map((m) => m.relative_path),
  })
  emit('close')
}
```

footer 里在放弃按钮**之前**加：

```html
      <button class="ui-btn ubm-refill" :disabled="!missing.length" @click="refill">
        {{ t('filesBatchRefill') }}
      </button>
```

- [ ] **Step 5: 运行确认通过**

```bash
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
```
Expected: 7 passed

- [ ] **Step 6: Files.vue 接线**

浏览器拿不到原文件，只能让用户重新选。挑出与缺失清单对得上的那些，其余忽略。

现有入队路径（已读实现，`src/views/Files.vue:170-200`）：
`triggerFolderSelect()` → `onInputChange` → `handleSelectedFiles(FileList)` →
`commitSelectedFiles(entries)` → `toSelectedFiles(entries, targetPath)` → `addFilesToQueue`。
`entries` 的形状是 `{ file: File; relativePath: string }`，`relativePath` 取自
`webkitRelativePath || f.name`。

在 `commitSelectedFiles` **之前**加状态与回调：

```ts
// 重传缺失文件:弹窗只给出"要哪些",文件本身必须用户重新选(浏览器拿不到原字节)。
const refillPending = ref<{ targetPath: string; missing: Set<string> } | null>(null)

function onRefill(p: { targetPath: string; missing: string[] }): void {
  refillPending.value = { targetPath: p.targetPath, missing: new Set(p.missing) }
  // 用文件夹选择器:缺失项可能带子路径(如 Trip/a.jpg),只有 webkitdirectory 那个
  // input 才会给出 webkitRelativePath,单文件选择器拿到的 relativePath 只有文件名。
  triggerFolderSelect()
}
```

改 `commitSelectedFiles`，在既有逻辑**之前**插入 refill 分支：

```ts
async function commitSelectedFiles(entries: { file: File; relativePath: string }[]) {
  if (browse.isSnapshotView) { toast.show(t('snapBrowseWriteBlocked')); return }

  // refill:目标目录取批次的 target_path(不是当前目录 —— 用户可能已经导航走了),
  // 并且只放行缺失清单里点名的那些条目。
  const pending = refillPending.value
  if (pending) {
    refillPending.value = null
    const wanted = entries.filter((e) => pending.missing.has(e.relativePath))
    if (!wanted.length) { toast.show(t('filesBatchRefillNoMatch')); return }
    const sel = toSelectedFiles(wanted, pending.targetPath)
    const { rejected } = await uploads.addFilesToQueue(sel)
    for (const name of rejected) toast.show(t('filesUploadProtected', { name }))
    return
  }

  const targetPath = files.currentPath // REAL 路径,受保护目录判断按此展开
  const sel = toSelectedFiles(entries, targetPath)
  const { rejected } = await uploads.addFilesToQueue(sel)
  for (const name of rejected) toast.show(t('filesUploadProtected', { name }))
}
```

弹窗挂载处加监听：

```html
      @refill="onRefill"
```

补 i18n 键 `filesBatchRefillNoMatch` —— 中文「选中的文件与缺失清单对不上」/
英文 `Picked files do not match the missing list`。

- [ ] **Step 6b: 给 refill 分支补回归测试**

在 `src/views/Files.upload.test.ts`（已存在）追加：`refillPending` 生效时
`addFilesToQueue` 只收到缺失清单里的条目、且 `targetPath` 用的是批次的 `target_path`
而不是 `files.currentPath`。断言必须落在 `addFilesToQueue` 的**入参**上 —— 这是
"过滤真的生效了"的唯一生效载体。

- [ ] **Step 7: 全量与类型检查**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/i18n/parity.test.ts
```
Expected: 全绿

- [ ] **Step 8: 提交**

```bash
git add src/files/components/UploadBatchModal.vue src/files/components/UploadBatchModal.test.ts \
        src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): re-upload only the files a batch is missing

The browser cannot recover the bytes, so the user re-picks; what this adds is
the filter, so re-picking a whole folder re-sends only what the manifest says
is still missing."
```

---

## 收尾门（全部任务完成后跑一次）

```bash
pnpm test                                   # 全量 vitest
pnpm exec vue-tsc --noEmit                  # 类型
pnpm exec vitest run src/i18n/parity.test.ts
pnpm build                                  # 构建
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/95eb041e-9f29-4fc1-8c8f-2171d6d9f277/scratchpad/oss-check --no-commit --allow-dirty-oss
```

> **`oss/export.mjs` 必须带这三个参数**：它的 `DEFAULT_OUT` 指向真实公开镜像仓且会自动提交，
> SP11 期间一次不带参数的探测调用直接 amend 了公开仓的 HEAD。

## 真机验收（`pnpm dev --host --port 5273`）

1. 传一个小文件 → 正常完成，无角标
2. 传一个大文件，传到一半关掉标签页 → 重开文件区，该文件条目上出现角标
3. 点角标 → 弹窗列出缺失文件与 `已上传 x / y`
4. 点「放弃这批」→ 弹窗关闭，角标消失
5. 重复 2，改点「重传缺失文件」→ 选同一个文件 → 只传缺失那些，完成后角标消失
6. 列表视图与网格视图**都要看**（角标是两处独立实现）
7. 浅色主题与深色主题**都要看**（角标颜色走 token，jsdom 照不出）
8. **刷新页面时不再恢复上传队列**——这是本期有意删除的能力，不是 bug

## 记账（不在本 plan 修）

- **后端票**：`last_progress_at` 只被「单个文件传完」刷新，分片进度不刷新。单文件传输
  超过 120s 会被 sweeper 提前判为 interrupted（角标提前出现，传完自动回 active）；
  超过 720s（120s + 600s 宽限）staging 会被清、任务被终止。**后端没有续期端点，
  前端无法用心跳规避**。建议后端在 tus 分片写入时也刷新 `last_progress_at`。
- **Plan B**：`src/files/upload/conflict.ts` 与 `UploadPanel.vue` 里的逐文件冲突 Dialog
  在本 plan 保持原样，由 Plan B 的统一冲突弹窗整体替换。
