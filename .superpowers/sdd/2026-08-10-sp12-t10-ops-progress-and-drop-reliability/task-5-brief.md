### Task 5: 下线 `OperationStatusBar`

**Files:**
- Delete: `src/files/components/OperationStatusBar.vue`, `src/files/components/OperationStatusBar.test.ts`
- Modify: `src/views/Files.vue`(删 `:17` 的 import 与 `:739` 的挂载)

⚠️ **只删组件。** `Files.vue:578` 的 socket 接线(`bus.on('nimoos:file:operate', ...)`)与 `src/files/stores/fileOps.ts` **一行都不许动** —— 它们本就在组件之外,是 Vue2 #89 要求「把 socket 处理器搬出组件」的既成结果。

- [ ] **Step 1: 先确认没有别的消费者**

Run: `grep -rn "OperationStatusBar" src/`
Expected: 只剩 `src/views/Files.vue` 两处 + 组件自身 + 它自己的测试。**若出现第三处消费者,停下来报告,不要自行处置。**
(注:`src/apps/views/AppSettingsPage.vue` 与 `src/files/util/fileOps.ts` 里各有一处**注释**提到这个名字 —— 那是历史说明不是引用,本任务把它们改写成不指向已删文件的措辞。)

- [ ] **Step 2: 删组件与其测试**

```bash
git rm src/files/components/OperationStatusBar.vue src/files/components/OperationStatusBar.test.ts
```

- [ ] **Step 3: 改 `Files.vue`**

删掉这一行 import:

```ts
import OperationStatusBar from '../files/components/OperationStatusBar.vue'
```

删掉模板里这一行:

```vue
    <OperationStatusBar />
```

- [ ] **Step 4: 改写两处悬空注释**

`src/files/util/fileOps.ts` 里 `parseFileOperate` 上方那句「(移植 Vue2 OperationStatusBar)」改成:

```ts
// socket props.file_operate is a JSON string -> { data: FileTask[] } (ported
// from Vue2's FilePanel socket handler).
```

`src/apps/views/AppSettingsPage.vue:190` 附近那句提到 `OperationStatusBar.vue` 的注释,把该文件名换成 `UploadPanel.vue`(同类先例仍然成立,只是宿主换了)。

- [ ] **Step 5: 跑类型检查 + 全量测试(前台)**

Run: `pnpm exec vue-tsc --noEmit && pnpm exec vitest run`
Expected: exit 0,零失败。**这一步会跑约 3 分钟,前台等它跑完,不要丢后台。**

- [ ] **Step 6: 提交**

```bash
git add -A src/files/components src/views/Files.vue src/files/util/fileOps.ts src/apps/views/AppSettingsPage.vue
git commit -m "refactor(files): retire the standalone operation status bar

Its content now lives in the upload panel. The socket wiring stays where it
already was, outside the component, so nothing about the data path changes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

# Part B —— #90 可靠性核心

