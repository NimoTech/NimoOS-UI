### Task 2: 拆掉 IndexedDB 持久化层

**Files:**
- Delete: `src/files/upload/idb.ts`, `src/files/upload/idb.test.ts`
- Delete: `src/files/upload/persist.ts`, `src/files/upload/persist.test.ts`
- Delete: `src/files/upload/budget.ts`, `src/files/upload/budget.test.ts`
- Modify: `src/files/upload/types.ts`
- Modify: `src/files/stores/uploads.ts`
- Modify: `src/files/components/UploadPanel.vue`

**Interfaces:**
- Consumes: 无（不依赖 Task 1）
- Produces: `UploadItem` 不再有 `oversize`/`restored` 字段；`useUploadsStore()` 不再暴露
  `restoreQueue` / `pruneOldItems` / `restoreNoticeCount`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/upload/noPersistence.test.ts`（这是一条**守卫测试**，防止续传层被无意重新引入）：

```ts
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SP12: the IndexedDB resume path was retired in favour of server-side batch
// reconciliation. These two are the load-bearing assertions — a reintroduced
// idb/persist module, or a lingering indexedDB call in the upload layer, means
// the old and new models are both live and will fight over what "unfinished"
// means.
describe('upload layer carries no client-side byte persistence', () => {
  const dir = resolve(__dirname)

  it('has no idb/persist/budget modules', () => {
    const names = readdirSync(dir)
    expect(names).not.toContain('idb.ts')
    expect(names).not.toContain('persist.ts')
    expect(names).not.toContain('budget.ts')
  })

  it('never touches indexedDB', () => {
    const hits = readdirSync(dir)
      .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
      .filter((n) => readFileSync(resolve(dir, n), 'utf8').includes('indexedDB'))
    expect(hits).toEqual([])
  })
})
```

> 用 `node:fs` 读文件，**不要**用 `import ... ?raw`（本仓实测 `?raw` 恒空，color-guard 曾因此空转）。

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run src/files/upload/noPersistence.test.ts
```
Expected: FAIL — `expected [ …, 'idb.ts', … ] not to contain 'idb.ts'`

- [ ] **Step 3: 删除三个模块及其测试**

```bash
git rm src/files/upload/idb.ts src/files/upload/idb.test.ts \
       src/files/upload/persist.ts src/files/upload/persist.test.ts \
       src/files/upload/budget.ts src/files/upload/budget.test.ts
```

- [ ] **Step 4: 改 `src/files/upload/types.ts`**

`UploadItem` 里删掉这两行：

```ts
  restored: boolean
  oversize: boolean
```

`UploadStatus` **本步不动**（`needs_file` 在 Task 3 删）。

- [ ] **Step 5: 改 `src/files/stores/uploads.ts`**

1. 删这两行 import：
```ts
import { canStoreBlob } from '../upload/budget'
import { persistNewItem, persistItemMeta, dropPersisted, restoreFromIDB, pruneOldItems as prunePersisted } from '../upload/persist'
```
2. 删 `const restoreNoticeCount = ref(0)`
3. `patch()` 里删掉整段持久化（`const VOLATILE` 那个常量、`const keys = …` 到 `}` 为止的 volatile/persist 块）。`patch` 只保留：找到 item → `Object.assign` → 重置 toast 标记 → `settleBatch`
4. `addFilesToQueue` 的 item 构造里删 `restored: false,` 与 `oversize: …,` 两行；删掉 `queue.value.push(...items)` 之后那行 `for (const it of items) persistNewItem(it)`
5. `settleBatch` 的 5 秒清理里删掉 `for (…) dropPersisted(i.id)` 那行
6. `cancelItem` / `cancelBatch` / `cancelAll` / `clearDone` 里各删一处 `dropPersisted(...)`
7. 整个删掉 `restoreQueue()` 与 `pruneOldItems()` 两个函数
8. `initUploads()` 改为：

```ts
  async function initUploads(): Promise<void> {
    // 一次性闩:Files.vue 每次 SPA 导航都会 onMounted 调用本函数,而 Pinia store 是
    // 应用级单例。真正的页面刷新会重建 store(闩复位),所以这仍是"每次页面加载一次"。
    if (initialized.value) return
    initialized.value = true
    try {
      await syncServerTasks()
      resumePending()
    } catch (e) {
      console.warn('[uploads] initUploads failed', e)
    }
  }
```
9. `return {…}` 里删掉 `restoreNoticeCount`、`restoreQueue`、`pruneOldItems`

- [ ] **Step 6: 改 `src/files/components/UploadPanel.vue`**

删掉引用 `restoreNoticeCount` 的恢复提示横幅，以及任何读 `item.oversize` / `item.restored` 的分支。

```bash
grep -n "restoreNoticeCount\|oversize\|restored" src/files/components/UploadPanel.vue
```
按命中逐处删。**只删这三个标识相关的分支**，不要顺手改别的。

- [ ] **Step 7: 修其余被牵连的测试**

```bash
pnpm test 2>&1 | tail -40
```
把引用了 `oversize`/`restored`/`restoreQueue`/`pruneOldItems` 的测试逐个修掉。
**判断标准：删的必须是「为已废除形态写的断言」，不是「挡路的断言」。** 一条测试若在验证
"上传本身"而只是顺带构造了 `oversize` 字段，改字段构造、保留断言。

- [ ] **Step 8: 运行测试与类型检查**

```bash
pnpm exec vitest run src/files/upload/noPersistence.test.ts
pnpm test
pnpm exec vue-tsc --noEmit
```
Expected: 守卫 2 passed；全量 0 failed；tsc 0 error

- [ ] **Step 9: 提交**

```bash
git add -A src/files/upload src/files/stores/uploads.ts src/files/components/UploadPanel.vue
git commit -m "refactor(files): retire the IndexedDB upload resume path

Storing whole file bytes in the browser cost quota and, once the bytes were
gone after a refresh, forced the user to re-pick the files by hand. Vue 2
dropped this model in favour of server-side batch reconciliation, which the
following commits wire up; keeping both would leave two definitions of what
an unfinished upload is.

The tus layer is untouched — chunking and same-session reconnect stay. Adds
a guard test so the modules cannot quietly come back."
```

---

