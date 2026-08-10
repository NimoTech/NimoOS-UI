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

