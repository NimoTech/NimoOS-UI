# SP12 Plan A — 上传架构换代 + 裂开角标闭环

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 New-UI 的上传从「浏览器用 IndexedDB 存字节做跨刷新续传」换成 Vue2 现行的「服务端批次对账 + 裂开角标」，并做出角标 → 批次详情 → 放弃/重传的完整闭环。

**Architecture:** 入队时向 NAS 上报批次清单（`POST /v2/nimoos/file/upload-batches`），关窗时用 `fetch keepalive` 发中断信号；NAS 在文件列表的 `extensions.upload` 里回 `{broken, batchId}`，前端据此在网格/列表条目上挂角标，点击进批次详情弹窗，出口是「放弃这批」或「重传缺失文件」。浏览器不再存文件字节，tus 协议层（分片 + 同页面会话内断网重连）原样保留。

**Tech Stack:** Vue 3 `<script setup>` · TypeScript strict · Pinia · vitest + @vue/test-utils · reka-ui（经 `components/ui/Dialog.vue`）· 内联共享包 `@nimotech/nimoos-service`（源码在 `packages/service/`）

## Global Constraints

- **包管理器 pnpm**，勿用 yarn/npm。测试 `pnpm test`，类型检查 `pnpm exec vue-tsc --noEmit`
- **颜色一律用 theme token**（`var(--…)`，定义在 `src/styles/theme.css`）。禁止写死 `#fff`/`rgba(...)`/具名色。新语义需在 `:root` 与 `:root[data-theme="light"]` **两个块**都给值
- **i18n 新键必须同时加到 `src/i18n/zh_cn.base.ts` 和 `src/i18n/en_us.base.ts`**，`src/i18n/parity.test.ts` 断言两侧键集完全一致，漏一个即红
- **commit message 全英文**（imperative subject，body 讲 why 不复述 diff）
- **commit 必须带 pathspec**：主工作树里有 3 个 `design-export/*.html` 的 staged 删除，`git commit -a` 会把它们卷走
- **改 `packages/service/` 后**：重启 dev server + 浏览器硬刷新才生效（`vite.config.ts` 的 `optimizeDeps.exclude` 不要删）
- **不推 origin、不 `deploy.sh`**。验收方式是 `pnpm dev --host --port 5273`
- 移植纪律：界面照 Vue2 1:1，Vue2 的 bug/竞态不照抄，改对并注释登记；禁无关重构

---

## 后端契约（已逐字核对，勿手编 fixture）

四个端点均为**裸 JSON，无标准 `{success,data}` 信封** —— 不要 `unwrap()`。

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| POST | `/v2/nimoos/file/upload-batches` | `{id, targetPath, items:[{relativePath,size}]}` | `201 {"id":"<id>"}` |
| GET | `/v2/nimoos/file/upload-batches/:id` | — | `200 {"batch":{...},"missing":[...]}` |
| POST | `/v2/nimoos/file/upload-batches/:id/interrupt` | — | 幂等 |
| POST | `/v2/nimoos/file/upload-batches/:id/abandon` | — | 幂等；**批次不存在返回 404** |

`batch` 字段（`service/upload/batch.go:20`）：
`id` · `owner_user_id` · `target_path` · `status` · `total` · `done` · `last_progress_at` · `interrupted_at` · `created_at` · `updated_at`

`missing[]` 字段（同文件 `:39`）：`batch_id` · `relative_path` · `size` · `done`

文件列表里的角标来源（`route/v1/file.go:441`）：
`entry.extensions.upload = {"broken": true, "batchId": "<id>"}` —— 注意 Vue2 的判定同时认布尔 `true` 和字符串 `'true'`。

**已知后端行为（不在本 plan 修，见 Task 7 的记账）**：`last_progress_at` 只在**单个文件整体传完**时刷新（`MarkItemDone`），分片进度不刷新 ⇒ 单文件传输超过 120s 会被 sweeper 判为 interrupted、角标提前出现；传完会自动拉回 active（后端明确设计为可逆）。但超过 720s（120s + 600s 宽限）staging 会被清、任务被终止。后端没有续期端点，前端无法用心跳规避。

---

## File Structure

**新建**
- `packages/service/src/uploadBatches.ts` — 四个批次端点。独立成文件而不是塞进 `file.ts`：`interruptBatch` 走原生 `fetch`（不是共享 axios 实例），与 `file.ts` 里其余方法的依赖形态不同
- `packages/service/src/uploadBatches.test.ts`
- `src/files/util/uploadBadge.ts` — 从 `FileEntry` 读角标状态的两个纯函数
- `src/files/util/uploadBadge.test.ts`
- `src/files/components/UploadBatchModal.vue` — 批次详情弹窗
- `src/files/components/UploadBatchModal.test.ts`

**修改**
- `packages/service/src/types.ts` — 批次相关类型
- `packages/service/src/index.ts` — 装配 `service.uploadBatches`
- `src/files/upload/types.ts` — `UploadStatus` 去 `needs_file`，`UploadItem` 去 `restored`/`oversize`
- `src/files/stores/uploads.ts` — 去持久化与 needs_file 路径，加 `createBatch`
- `src/files/upload/unloadGuard.ts` — 加 `pagehide` → `interruptBatch`
- `src/files/components/UploadPanel.vue` — 去重选横幅与 needs_file 分支
- `src/files/stores/files.ts` — `FileEntry.extensions` 扩展 `upload`
- `src/files/components/FileTile.vue` / `FileRow.vue` — 角标
- `src/views/Files.vue` — 挂载弹窗、接角标点击、`installUnloadGuard` 传参变化
- `src/i18n/zh_cn.base.ts` / `en_us.base.ts`

**删除**（Task 2/3）
- `src/files/upload/idb.ts` + `idb.test.ts`
- `src/files/upload/persist.ts` + `persist.test.ts`
- `src/files/upload/budget.ts` + `budget.test.ts`
- `src/files/upload/serverSync.ts` + `serverSync.test.ts`

**本 plan 不动**（留 Plan B）：`src/files/upload/conflict.ts` 与 `UploadPanel.vue` 里的逐文件冲突 Dialog。Plan A 结束时上传冲突仍是现有形态，不留功能空窗；Plan B 的 T7/T8 才用「按顶层分组 + 统一冲突弹窗」整体替换它。

---

### Task 1: service 包的批次 API

**Files:**
- Create: `packages/service/src/uploadBatches.ts`
- Create: `packages/service/src/uploadBatches.test.ts`
- Modify: `packages/service/src/types.ts`（文件末尾追加）
- Modify: `packages/service/src/index.ts`

**Interfaces:**
- Produces:
  - `createUploadBatches(http: AxiosInstance, getToken: () => string | null)` 返回对象，含
    `createBatch(input: CreateBatchInput): Promise<void>`、
    `getBatch(id: string): Promise<BatchDetail>`、
    `abandonBatch(id: string): Promise<void>`、
    `interruptBatch(id: string): void`
  - 类型 `CreateBatchInput` / `UploadBatch` / `UploadBatchItem` / `BatchDetail`
  - 装配后调用点为 `service.uploadBatches.*`

- [ ] **Step 1: 写失败的测试**

创建 `packages/service/src/uploadBatches.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createUploadBatches } from './uploadBatches'

function fakeHttp(response: unknown) {
  return {
    post: vi.fn().mockResolvedValue(response),
    get: vi.fn().mockResolvedValue(response),
  } as unknown as AxiosInstance
}

describe('upload batches REST', () => {
  it('createBatch posts the manifest', async () => {
    const http = fakeHttp({ data: { id: 'b1' } })
    const api = createUploadBatches(http, () => 'tok')
    await api.createBatch({ id: 'b1', targetPath: '/DATA/x', items: [{ relativePath: 'a.txt', size: 5 }] })
    expect(http.post).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches', {
      id: 'b1',
      targetPath: '/DATA/x',
      items: [{ relativePath: 'a.txt', size: 5 }],
    })
  })

  it('getBatch returns the RAW envelope without unwrapping', async () => {
    // 后端裸 JSON:{batch, missing},没有 success/data 包装。
    const http = fakeHttp({
      data: {
        batch: { id: 'b1', target_path: '/DATA/x', status: 'interrupted', total: 3, done: 1 },
        missing: [{ batch_id: 'b1', relative_path: 'a.txt', size: 5, done: false }],
      },
    })
    const api = createUploadBatches(http, () => 'tok')
    const out = await api.getBatch('b1')
    expect(http.get).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches/b1')
    expect(out.batch.done).toBe(1)
    expect(out.missing[0].relative_path).toBe('a.txt')
  })

  it('getBatch degrades to an empty manifest when the body has no batch', async () => {
    const http = fakeHttp({ data: {} })
    const api = createUploadBatches(http, () => 'tok')
    const out = await api.getBatch('b1')
    expect(out.batch).toBeNull()
    expect(out.missing).toEqual([])
  })

  it('abandonBatch posts to the abandon path', async () => {
    const http = fakeHttp({ data: {} })
    const api = createUploadBatches(http, () => 'tok')
    await api.abandonBatch('b1')
    expect(http.post).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches/b1/abandon')
  })

  it('interruptBatch uses fetch keepalive with the bearer token, not axios', () => {
    const fetchSpy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', fetchSpy)
    const http = fakeHttp({ data: {} })
    const api = createUploadBatches(http, () => 'tok')
    api.interruptBatch('b1')
    expect(http.post).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith('/v2/nimoos/file/upload-batches/b1/interrupt', {
      method: 'POST',
      keepalive: true,
      headers: { Authorization: 'tok' },
    })
  })

  it('interruptBatch swallows a fetch that throws synchronously', () => {
    vi.stubGlobal('fetch', () => { throw new Error('no keepalive') })
    const api = createUploadBatches(fakeHttp({ data: {} }), () => 'tok')
    expect(() => api.interruptBatch('b1')).not.toThrow()
  })

  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => vi.clearAllMocks())
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run packages/service/src/uploadBatches.test.ts
```
Expected: FAIL — `Failed to resolve import "./uploadBatches"`

- [ ] **Step 3: 加类型**

在 `packages/service/src/types.ts` 末尾追加：

```ts
// Upload-batch reconciliation (SP12). Backend shapes are RAW JSON with no
// standard {success,data} envelope — see service/upload/batch.go in NimoOS.
export interface CreateBatchInput {
  id: string
  targetPath: string
  items: { relativePath: string; size: number }[]
}

export interface UploadBatch {
  id: string
  owner_user_id: string
  target_path: string
  status: string
  total: number
  done: number
  last_progress_at: number
  interrupted_at: number
  created_at: number
  updated_at: number
}

export interface UploadBatchItem {
  batch_id: string
  relative_path: string
  size: number
  done: boolean
}

export interface BatchDetail {
  batch: UploadBatch | null
  missing: UploadBatchItem[]
}
```

- [ ] **Step 4: 实现**

创建 `packages/service/src/uploadBatches.ts`：

```ts
import type { AxiosInstance } from 'axios'
import type { BatchDetail, CreateBatchInput, UploadBatch, UploadBatchItem } from './types.js'

const BASE = '/v2/nimoos/file/upload-batches'

export function createUploadBatches(http: AxiosInstance, getToken: () => string | null) {
  return {
    // Registers the manifest before the upload starts. Idempotent server-side:
    // resubmitting the same id returns 201 without creating a duplicate.
    async createBatch(input: CreateBatchInput): Promise<void> {
      await http.post(BASE, { id: input.id, targetPath: input.targetPath, items: input.items })
    },

    // RAW envelope {batch, missing} — no `success` field, so unwrap() would
    // always throw. Degrade to an empty manifest rather than propagating a
    // shape error; the caller renders "failed to load" off batch === null.
    async getBatch(id: string): Promise<BatchDetail> {
      const res = await http.get(`${BASE}/${id}`)
      const raw = res.data as { batch?: unknown; missing?: unknown } | null
      const missing = raw?.missing
      return {
        batch: (raw?.batch as UploadBatch | undefined) ?? null,
        missing: Array.isArray(missing) ? (missing as UploadBatchItem[]) : [],
      }
    },

    async abandonBatch(id: string): Promise<void> {
      await http.post(`${BASE}/${id}/abandon`)
    },

    // Sent from pagehide, where axios/XHR is unreliable during page unload and
    // sendBeacon cannot carry an Authorization header — hence raw fetch with
    // keepalive. Fire-and-forget: if the signal is lost (no keepalive support,
    // process killed), the server's idle-timeout sweep covers it.
    interruptBatch(id: string): void {
      const token = getToken() || ''
      try {
        void fetch(`${BASE}/${id}/interrupt`, {
          method: 'POST',
          keepalive: true,
          headers: { Authorization: token },
        })
      } catch {
        /* old browsers without keepalive: give up the signal, rely on the server timeout */
      }
    },
  }
}
```

- [ ] **Step 5: 装配进 service**

在 `packages/service/src/index.ts`：

1. 加 import：`import { createUploadBatches } from './uploadBatches.js'`
2. 在 `:36` 那一长行 `export type { … } from './types.js'` 的**末尾**追加四个类型名：
   `CreateBatchInput, UploadBatch, UploadBatchItem, BatchDetail`
3. 紧挨着 `get file()`（`:62-64`）加访问器，逐字照它的依赖取法：

```ts
  get uploadBatches(): ReturnType<typeof createUploadBatches> {
    return createUploadBatches(getHttp() as AxiosInstance, () => getConfig().getToken())
  },
```

> **注意别叫 `batch`** —— `index.ts:65` 已经有一个 `get batch()`（`/v1/batch` 的批量文件操作），
> 与上传批次是两回事。访问器名必须是 `uploadBatches`。

- [ ] **Step 6: 运行测试确认通过**

```bash
pnpm exec vitest run packages/service/src/uploadBatches.test.ts
pnpm exec vue-tsc --noEmit
```
Expected: 6 passed；tsc 0 error

- [ ] **Step 7: 提交**

```bash
git add packages/service/src/uploadBatches.ts packages/service/src/uploadBatches.test.ts \
        packages/service/src/types.ts packages/service/src/index.ts
git commit -m "feat(service): add the upload-batch reconciliation endpoints

The four endpoints return raw JSON with no standard envelope, so they
deliberately skip unwrap(). interruptBatch goes through fetch keepalive
rather than the shared axios instance: it is sent from pagehide, where XHR
is unreliable, and sendBeacon cannot carry an Authorization header."
```

---

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

### Task 4: 批次生命周期接线

**Files:**
- Modify: `src/files/stores/uploads.ts`
- Modify: `src/files/upload/unloadGuard.ts`
- Modify: `src/views/Files.vue`
- Test: `src/files/upload/unloadGuard.test.ts`（已存在，追加用例）
- Test: `src/files/stores/uploads.batch.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1 的 `service.uploadBatches.createBatch` / `interruptBatch`
- Produces: `activeBatchIds(queue: UploadItem[]): string[]`（从 `unloadGuard.ts` 导出）；
  `installUnloadGuard(getQueue, win?)` 签名不变，但内部多注册一个 `pagehide` 监听

- [ ] **Step 1: 写失败的测试（store 侧）**

创建 `src/files/stores/uploads.batch.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUploadsStore } from './uploads'

const createBatch = vi.fn().mockResolvedValue(undefined)
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: { createBatch: (...a: unknown[]) => createBatch(...a) },
    file: { cancelUpload: vi.fn(), uploadPrecheck: vi.fn().mockResolvedValue({ results: [] }) },
  },
  refreshAccessToken: vi.fn().mockResolvedValue(null),
}))

function pick(name: string, size: number) {
  return { file: new File(['x'.repeat(size)], name), targetPath: '/DATA/x', relativePath: name }
}

describe('addFilesToQueue reports the batch manifest', () => {
  beforeEach(() => { setActivePinia(createPinia()); createBatch.mockClear() })

  it('posts one manifest carrying every surviving item', async () => {
    const s = useUploadsStore()
    await s.addFilesToQueue([pick('a.txt', 3), pick('b.txt', 4)])
    expect(createBatch).toHaveBeenCalledTimes(1)
    const arg = createBatch.mock.calls[0][0] as { id: string; targetPath: string; items: unknown[] }
    expect(arg.targetPath).toBe('/DATA/x')
    expect(arg.items).toEqual([
      { relativePath: 'a.txt', size: 3 },
      { relativePath: 'b.txt', size: 4 },
    ])
    expect(arg.id).toBe(s.queue[0].batchId)
  })

  it('still queues the upload when the manifest call fails', async () => {
    createBatch.mockRejectedValueOnce(new Error('offline'))
    const s = useUploadsStore()
    await s.addFilesToQueue([pick('a.txt', 3)])
    // 对账不可用 ≠ 传不了:批次上报失败只 warn,不阻断上传。
    expect(s.queue).toHaveLength(1)
    expect(s.queue[0].status).toBe('pending')
  })

  it('does not report a manifest when every file was rejected as protected', async () => {
    const s = useUploadsStore()
    await s.addFilesToQueue([{ file: new File(['x'], 'a'), targetPath: '/DATA', relativePath: 'AppData/a' }])
    expect(createBatch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```
Expected: FAIL — `expected "createBatch" to be called 1 times, but got 0 times`

- [ ] **Step 3: 实现 store 侧**

在 `uploads.ts` 的 `addFilesToQueue` 里，`queue.value.push(...items)` **之前**插入：

```ts
    // 先上报清单再入队:清单是服务端判定"这批该有哪些文件"的唯一依据,必须早于第一个
    // 分片到达。失败只 warn —— 对账不可用不等于传不了(Vue2 fileUpload.js:193 同口径)。
    if (items.length > 0) {
      try {
        await service.uploadBatches.createBatch({
          id: batchId,
          targetPath: items[0].targetPath,
          items: items.map((i) => ({ relativePath: i.relativePath, size: i.size })),
        })
      } catch (e) {
        console.warn('[uploads] createBatch failed — batch reconciliation unavailable', e)
      }
    }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm exec vitest run src/files/stores/uploads.batch.test.ts
```
Expected: 3 passed

- [ ] **Step 5: 写失败的测试（unloadGuard 侧）**

在 `src/files/upload/unloadGuard.test.ts` 追加：

```ts
import { activeBatchIds } from './unloadGuard'

describe('pagehide interrupt signal', () => {
  it('collects batch ids of unfinished items only, deduped', () => {
    const q = [
      { batchId: 'b1', status: 'uploading', file: new Blob() },
      { batchId: 'b1', status: 'pending', file: new Blob() },
      { batchId: 'b2', status: 'done', file: null },
      { batchId: '', status: 'uploading', file: new Blob() },
    ] as unknown as UploadItem[]
    expect(activeBatchIds(q)).toEqual(['b1'])
  })

  it('sends one interrupt per active batch on pagehide', () => {
    const interruptBatch = vi.fn()
    const listeners: Record<string, EventListener> = {}
    const win = {
      addEventListener: (t: string, h: EventListener) => { listeners[t] = h },
      removeEventListener: () => {},
    } as unknown as Window
    const q = [
      { batchId: 'b1', status: 'uploading', file: new Blob() },
      { batchId: 'b2', status: 'pending', file: new Blob() },
    ] as unknown as UploadItem[]

    installUnloadGuard(() => q, win, interruptBatch)
    listeners.pagehide(new Event('pagehide'))

    expect(interruptBatch.mock.calls.map((c) => c[0])).toEqual(['b1', 'b2'])
  })
})
```

顶部按需补 `import type { UploadItem } from './types'` 与 `vi`。

- [ ] **Step 6: 运行测试确认失败**

```bash
pnpm exec vitest run src/files/upload/unloadGuard.test.ts
```
Expected: FAIL — `activeBatchIds is not a function`

- [ ] **Step 7: 实现 unloadGuard**

在 `src/files/upload/unloadGuard.ts` 加：

```ts
/**
 * Batch ids that still have unfinished work — the set that gets an interrupt
 * signal when the page goes away. Deduped; items with no batchId are ignored.
 */
export function activeBatchIds(queue: UploadItem[]): string[] {
  const ids = new Set<string>()
  if (!Array.isArray(queue)) return []
  for (const it of queue) {
    if ((it.status === 'uploading' || it.status === 'pending') && it.batchId) ids.add(it.batchId)
  }
  return [...ids]
}
```

`installUnloadGuard` 增加第三个参数并注册 `pagehide`：

```ts
export function installUnloadGuard(
  getQueue: () => UploadItem[],
  win?: Window,
  interruptBatch?: (id: string) => void,
): () => void {
  const targetWindow = win || (typeof window !== 'undefined' ? window : null)
  if (!targetWindow || typeof targetWindow.addEventListener !== 'function') {
    return () => {}
  }

  const handler = (e: BeforeUnloadEvent) => {
    if (!hasActiveUploads(getQueue())) return undefined
    e.preventDefault()
    e.returnValue = ''
    return ''
  }

  // 用户确认离开(或直接关窗)→ pagehide 一定会触发:给每个未完成批次发中断信号,NAS 立刻
  // 标记中断并清 staging,角标马上出现。信号丢了(断电/进程被杀)由服务端 120s 空闲兜底。
  const onPageHide = () => {
    if (!interruptBatch) return
    for (const id of activeBatchIds(getQueue())) interruptBatch(id)
  }

  targetWindow.addEventListener('beforeunload', handler as EventListener)
  targetWindow.addEventListener('pagehide', onPageHide)

  return () => {
    targetWindow.removeEventListener('beforeunload', handler as EventListener)
    targetWindow.removeEventListener('pagehide', onPageHide)
  }
}
```

- [ ] **Step 8: 接线 Files.vue**

找到 `installUnloadGuard(` 的调用处，补第三个实参：

```ts
installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))
```

确认 `service` 已在该文件 import；没有就加 `import { service } from '@nimotech/nimoos-service'`。

- [ ] **Step 9: 跑测试与类型检查**

```bash
pnpm exec vitest run src/files/upload/unloadGuard.test.ts src/files/stores/uploads.batch.test.ts
pnpm test
pnpm exec vue-tsc --noEmit
```
Expected: 全绿

- [ ] **Step 10: 提交**

```bash
git add src/files/stores/uploads.ts src/files/stores/uploads.batch.test.ts \
        src/files/upload/unloadGuard.ts src/files/upload/unloadGuard.test.ts src/views/Files.vue
git commit -m "feat(files): report upload batches and signal interruption

The manifest goes up before the first chunk, because it is what the NAS
compares the arriving files against. A failed manifest call only warns:
losing reconciliation is not a reason to refuse the upload.

pagehide is the one event that fires on both 'confirm leave' and an outright
window close, so the interrupt signal rides on it."
```

---

### Task 5: 裂开角标

**Files:**
- Create: `src/files/util/uploadBadge.ts`, `src/files/util/uploadBadge.test.ts`
- Modify: `src/files/stores/files.ts`
- Modify: `src/files/components/FileTile.vue`, `src/files/components/FileRow.vue`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`

**Interfaces:**
- Consumes: 无
- Produces: `isUploadBroken(entry: FileEntry): boolean`、`uploadBatchIdOf(entry: FileEntry): string`；
  `FileTile` / `FileRow` 新增 emit `(e: 'open-batch', batchId: string): void`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/util/uploadBadge.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { isUploadBroken, uploadBatchIdOf } from './uploadBadge'
import type { FileEntry } from '../stores/files'

function entry(ext: unknown): FileEntry {
  return { name: 'a.txt', path: '/DATA/x/a.txt', is_dir: false, extensions: ext as FileEntry['extensions'] }
}

describe('upload badge state', () => {
  it('reads a boolean broken flag', () => {
    expect(isUploadBroken(entry({ upload: { broken: true, batchId: 'b1' } }))).toBe(true)
  })

  // 后端 JSON 可能给字符串:Vue2 IconContainerMixin.js:71 两种都认,照搬。
  it('reads a string broken flag', () => {
    expect(isUploadBroken(entry({ upload: { broken: 'true', batchId: 'b1' } }))).toBe(true)
  })

  it('is false for broken:false, missing upload, null extensions', () => {
    expect(isUploadBroken(entry({ upload: { broken: false } }))).toBe(false)
    expect(isUploadBroken(entry({ share: { shared: 'true' } }))).toBe(false)
    expect(isUploadBroken(entry(null))).toBe(false)
  })

  it('extracts the batch id, empty string when absent', () => {
    expect(uploadBatchIdOf(entry({ upload: { broken: true, batchId: 'b1' } }))).toBe('b1')
    expect(uploadBatchIdOf(entry({ upload: { broken: true } }))).toBe('')
    expect(uploadBatchIdOf(entry(null))).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm exec vitest run src/files/util/uploadBadge.test.ts
```
Expected: FAIL — 无法解析 `./uploadBadge`

- [ ] **Step 3: 扩展 FileEntry 类型**

`src/files/stores/files.ts` 的 `FileEntry`：

```ts
export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number | string
  date?: string
  write?: boolean
  extensions?: {
    share?: { shared?: string }
    // 后端在文件列表里挂的上传批次状态(NimoOS route/v1/file.go:441)。
    // broken 可能是布尔也可能是字符串 —— 判定见 util/uploadBadge.ts。
    upload?: { broken?: boolean | string; batchId?: string }
  } | null
}
```

- [ ] **Step 4: 实现纯函数**

创建 `src/files/util/uploadBadge.ts`：

```ts
import type { FileEntry } from '../stores/files'

/**
 * True when the NAS reports this entry as belonging to an interrupted upload
 * batch. The backend may serialize the flag as a boolean or as the string
 * 'true' — both count (ported from Vue2 IconContainerMixin.js:71).
 */
export function isUploadBroken(entry: FileEntry | null | undefined): boolean {
  const up = entry?.extensions?.upload
  return !!up && (up.broken === true || up.broken === 'true')
}

/** Batch id behind the badge; '' when the entry carries none. */
export function uploadBatchIdOf(entry: FileEntry | null | undefined): string {
  return entry?.extensions?.upload?.batchId || ''
}
```

- [ ] **Step 5: 运行确认通过**

```bash
pnpm exec vitest run src/files/util/uploadBadge.test.ts
```
Expected: 4 passed

- [ ] **Step 6: 加 i18n 键**

`src/i18n/zh_cn.base.ts` 加：
```ts
  filesUploadBrokenBadge: '上传中断 —— 点击查看详情',
```
`src/i18n/en_us.base.ts` 加：
```ts
  filesUploadBrokenBadge: 'Upload interrupted — click for details',
```

- [ ] **Step 7: 写组件测试**

创建 `src/files/components/FileTile.badge.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import FileTile from './FileTile.vue'
import FileRow from './FileRow.vue'
import { i18n } from '../../i18n'
import type { FileEntry } from '../stores/files'

const broken: FileEntry = {
  name: 'a.txt', path: '/DATA/x/a.txt', is_dir: false,
  extensions: { upload: { broken: true, batchId: 'b1' } },
}
const clean: FileEntry = { name: 'b.txt', path: '/DATA/x/b.txt', is_dir: false, extensions: null }

describe.each([['FileTile', FileTile], ['FileRow', FileRow]] as const)('%s torn badge', (_n, Comp) => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the badge only for a broken entry', () => {
    const w = mount(Comp, { props: { entry: broken }, global: { plugins: [i18n] } })
    expect(w.find('.upload-broken-badge').exists()).toBe(true)
    const w2 = mount(Comp, { props: { entry: clean }, global: { plugins: [i18n] } })
    expect(w2.find('.upload-broken-badge').exists()).toBe(false)
  })

  it('emits open-batch and does NOT emit open/select when the badge is clicked', async () => {
    const w = mount(Comp, { props: { entry: broken }, global: { plugins: [i18n] } })
    await w.find('.upload-broken-badge').trigger('click')
    expect(w.emitted('open-batch')?.[0]).toEqual(['b1'])
    // 角标长在卡片上,不 stop 就会连带触发卡片的打开/选中 —— Vue2 #91 的根因。
    expect(w.emitted('open')).toBeUndefined()
    expect(w.emitted('select')).toBeUndefined()
  })
})
```

- [ ] **Step 8: 运行确认失败**

```bash
pnpm exec vitest run src/files/components/FileTile.badge.test.ts
```
Expected: FAIL — 找不到 `.upload-broken-badge`

- [ ] **Step 9: 两个组件加角标**

`FileTile.vue`：script 里加

```ts
import { isUploadBroken, uploadBatchIdOf } from '../util/uploadBadge'
```
emits 里加 `(e: 'open-batch', batchId: string): void`，模板里在 `.tile-check` 之后加：

```html
    <button
      v-if="isUploadBroken(props.entry)"
      type="button"
      class="upload-broken-badge"
      :title="$t('filesUploadBrokenBadge')"
      @click.stop.prevent="emit('open-batch', uploadBatchIdOf(props.entry))"
    >!</button>
```

样式（**颜色必须走 token**）：

```css
.upload-broken-badge {
  position: absolute; right: 6px; top: 6px; width: 20px; height: 20px;
  display: grid; place-items: center; padding: 0;
  border-radius: 999px; border: 1px solid var(--card-border);
  background: var(--remove-bg); color: var(--remove-fg);
  font-size: 13px; font-weight: 700; line-height: 1; cursor: pointer;
}
.upload-broken-badge:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
```

> 已核实 `--remove-bg` / `--remove-fg` / `--card-border` 在 `theme.css` 的深浅两套主题块里
> 都有值（`:149` `:281` `:402` `:493`），直接用即可。**`--remove-bg-hi` 不存在** ——
> hover 改用 `color-mix(in srgb, var(--remove-fg) 22%, transparent)`，与
> `SelectionToolbar.vue` 的 danger 按钮同一套写法。
> `FileTile` 的根元素需要 `position: relative` 才能定位角标 —— 检查现有样式，没有就补。

`FileRow.vue` 同样处理，角标尺寸改 16px、插在 `.file-icon` 之后。

- [ ] **Step 10: 运行确认通过 + 全量**

```bash
pnpm exec vitest run src/files/components/FileTile.badge.test.ts
pnpm test
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/i18n/parity.test.ts
```
Expected: 全绿

- [ ] **Step 11: 提交**

```bash
git add src/files/util/uploadBadge.ts src/files/util/uploadBadge.test.ts \
        src/files/stores/files.ts src/files/components/FileTile.vue \
        src/files/components/FileRow.vue src/files/components/FileTile.badge.test.ts \
        src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): show the torn badge on entries from interrupted batches

The badge state comes straight off the listing — the NAS already annotates
entries with extensions.upload — so nothing needs to be tracked client-side.

The click handler stops propagation: the badge sits inside the card, and
without that the card's own open/select fires alongside it. That exact wiring
is what Vue 2 had to go back and fix."
```

---

### Task 6: 批次详情弹窗（查看 + 放弃）

**Files:**
- Create: `src/files/components/UploadBatchModal.vue`, `src/files/components/UploadBatchModal.test.ts`
- Modify: `src/views/Files.vue`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`

**Interfaces:**
- Consumes: Task 1 的 `service.uploadBatches.getBatch` / `abandonBatch`；Task 5 的 `open-batch` 事件
- Produces: 组件 props `{ batchId: string }`，emits `(e:'close'):void` 与 `(e:'abandoned'):void`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/components/UploadBatchModal.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UploadBatchModal from './UploadBatchModal.vue'
import { i18n } from '../../i18n'

const getBatch = vi.fn()
const abandonBatch = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: {
      getBatch: (...a: unknown[]) => getBatch(...a),
      abandonBatch: (...a: unknown[]) => abandonBatch(...a),
    },
  },
}))

const detail = {
  batch: { id: 'b1', target_path: '/DATA/x', status: 'interrupted', total: 3, done: 1 },
  missing: [
    { batch_id: 'b1', relative_path: 'Trip/a.jpg', size: 1024, done: false },
    { batch_id: 'b1', relative_path: 'Trip/b.jpg', size: 2048, done: false },
  ],
}

function mountModal() {
  return mount(UploadBatchModal, { props: { batchId: 'b1' }, global: { plugins: [i18n] } })
}

describe('UploadBatchModal', () => {
  beforeEach(() => { getBatch.mockReset(); abandonBatch.mockReset() })

  it('lists the missing files and the done/total count', async () => {
    getBatch.mockResolvedValue(detail)
    const w = mountModal()
    await flushPromises()
    expect(getBatch).toHaveBeenCalledWith('b1')
    const rows = w.findAll('.ubm-missing-item')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Trip/a.jpg')
    expect(w.text()).toContain('1')
    expect(w.text()).toContain('3')
  })

  it('shows a load-failure message when the batch cannot be read', async () => {
    getBatch.mockRejectedValue(new Error('boom'))
    const w = mountModal()
    await flushPromises()
    expect(w.find('.ubm-load-error').exists()).toBe(true)
    expect(w.find('.ubm-missing-item').exists()).toBe(false)
  })

  it('abandons and closes on success', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockResolvedValue(undefined)
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(abandonBatch).toHaveBeenCalledWith('b1')
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
  })

  // #122:批次早被清扫掉 → 404。用户的目标本来就是"让角标消失",不该弹错误把人堵住。
  it('treats a 404 on abandon as already abandoned', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockRejectedValue({ response: { status: 404 } })
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
    expect(w.find('.ubm-error').exists()).toBe(false)
  })

  it('keeps the dialog open and shows the error on a non-404 failure', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockRejectedValue({ response: { status: 500 } })
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeFalsy()
    expect(w.emitted('close')).toBeFalsy()
    // 弹窗内联报错,不用 toast:toast 是 z-index 60,会被遮罩(1000)压住且被 blur 糊掉。
    expect(w.find('.ubm-error').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
```
Expected: FAIL — 无法解析 `./UploadBatchModal.vue`

- [ ] **Step 3: 加 i18n 键**

`zh_cn.base.ts`：
```ts
  filesBatchTitle: '上传中断',
  filesBatchProgress: '已上传 {done} / {total} 个文件',
  filesBatchMissing: '缺失的文件',
  filesBatchLoadFailed: '无法加载批次详情',
  filesBatchAbandon: '放弃这批',
  filesBatchAbandonFailed: '放弃失败,请重试',
```
`en_us.base.ts`：
```ts
  filesBatchTitle: 'Upload interrupted',
  filesBatchProgress: 'Uploaded {done} of {total} files',
  filesBatchMissing: 'Missing files',
  filesBatchLoadFailed: 'Failed to load batch details',
  filesBatchAbandon: 'Abandon this batch',
  filesBatchAbandonFailed: 'Could not abandon the batch — try again',
```

- [ ] **Step 4: 实现组件**

创建 `src/files/components/UploadBatchModal.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { UploadBatch, UploadBatchItem } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { renderSize } from '../util/format'

const props = defineProps<{ batchId: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'abandoned'): void }>()
const { t } = useI18n()

const loading = ref(true)
const batch = ref<UploadBatch | null>(null)
const missing = ref<UploadBatchItem[]>([])
const abandoning = ref(false)
const errorText = ref('')

onMounted(async () => {
  try {
    const d = await service.uploadBatches.getBatch(props.batchId)
    batch.value = d.batch
    missing.value = d.missing
  } catch {
    batch.value = null
  } finally {
    loading.value = false
  }
})

async function abandon(): Promise<void> {
  if (abandoning.value) return
  abandoning.value = true
  errorText.value = ''
  try {
    await service.uploadBatches.abandonBatch(props.batchId)
    emit('abandoned')
    emit('close')
  } catch (e) {
    // 批次在服务端已不存在(过期被清扫 / 陈旧角标竞态)时返回 404。用户点这个按钮的目标
    // 就是"让角标消失",所以走成功路径刷新列表,而不是报服务器错误把人堵在弹窗里。
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      emit('abandoned')
      emit('close')
    } else {
      // 弹窗内报错必须内联:toast 的 z-index 低于遮罩,会被压住并被 blur 糊掉。
      errorText.value = t('filesBatchAbandonFailed')
    }
  } finally {
    abandoning.value = false
  }
}
</script>

<template>
  <Dialog :open="true" :title="t('filesBatchTitle')" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <div v-if="loading" class="ubm-loading">…</div>
    <template v-else-if="batch">
      <p class="ubm-progress">{{ t('filesBatchProgress', { done: batch.done, total: batch.total }) }}</p>
      <p class="ubm-missing-title">{{ t('filesBatchMissing') }}</p>
      <ul class="ubm-missing-list">
        <li v-for="m in missing" :key="m.relative_path" class="ubm-missing-item">
          <span class="ubm-path" :title="m.relative_path">{{ m.relative_path }}</span>
          <span class="ubm-size">{{ renderSize(m.size) }}</span>
        </li>
      </ul>
    </template>
    <p v-else class="ubm-load-error">{{ t('filesBatchLoadFailed') }}</p>
    <p v-if="errorText" class="ubm-error">{{ errorText }}</p>

    <template #footer>
      <button class="ubm-btn ubm-danger ubm-abandon" :disabled="abandoning" @click="abandon">
        {{ t('filesBatchAbandon') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.ubm-progress { margin-bottom: 12px; color: var(--fg); }
.ubm-missing-title { font-weight: 600; margin-bottom: 6px; color: var(--fg); }
.ubm-missing-list { max-height: 240px; overflow-y: auto; }
.ubm-missing-item { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; }
.ubm-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.ubm-size { flex: 0 0 auto; color: var(--fg-muted); }
.ubm-load-error { color: var(--fg-muted); }
.ubm-error { margin-top: 10px; color: var(--remove-fg); }

/* 本仓没有全局 .ui-btn(已核:src/styles/*.css 零命中),按钮样式一律组件内定义 ——
   照 SelectionToolbar.vue 的 .sel-btn 写法。 */
.ubm-btn {
  padding: 4px 12px; border-radius: 999px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--chip-border); background: transparent; color: var(--fg);
}
.ubm-btn:hover { background: var(--chip-bg-hi); }
.ubm-btn:disabled { opacity: 0.5; cursor: default; }
/* 变体必须自带 :hover 背景 —— 基类 .ubm-btn:hover 的优先级(0,2,0)会压过变体
   .ubm-danger(0,1,0),不写这条就会 hover 成白底白字(本仓栽过)。 */
.ubm-danger { color: var(--remove-fg); border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent); }
.ubm-danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
</style>
```

> 已核实：`renderSize` 在 `src/files/util/format.ts:3`，签名 `(bytes: number | string) => string`，
> 上面的 import 路径正确。`--remove-fg` / `--remove-bg` / `--chip-border` / `--chip-bg-hi`
> 在 `theme.css` 的深浅两套主题块里都有值。

- [ ] **Step 5: 运行确认通过**

```bash
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
```
Expected: 5 passed

- [ ] **Step 6: 接线 Files.vue**

1. import 组件与 `useFilesStore`（已有则跳过）
2. 加状态：
```ts
const batchModalId = ref('')
```
3. **两个中间层必须各加一次转发** —— 已核实 `FileGridView.vue` 与 `FileListView.vue`
   都是显式列举 emits 再逐个 `@x="emit('x', $event)"` 转发的，不透传未声明的事件，
   不补这一步事件到不了 `Files.vue`：

   两个文件的 `defineEmits` 各加一行：
```ts
  (e: 'open-batch', batchId: string): void
```
   模板里给 `<FileTile>` / `<FileRow>` 各加一行：
```html
      @open-batch="emit('open-batch', $event)"
```
   然后在 `Files.vue` 的 `<FileGridView>` 与 `<FileListView>` 上各加：
```html
@open-batch="(id: string) => (batchModalId = id)"
```
4. 模板底部挂弹窗：
```html
    <UploadBatchModal
      v-if="batchModalId"
      :batch-id="batchModalId"
      @close="batchModalId = ''"
      @abandoned="files.load(files.currentPath)"
    />
```

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
git commit -m "feat(files): add the interrupted-batch dialog

Lists what did not make it and offers a way out. A 404 on abandon is treated
as success: the batch is already gone server-side, which is exactly what the
button was asking for, and reporting a server error would strand the user in
a dialog with nothing left to do.

The failure message is inline rather than a toast — toasts sit below the
dialog backdrop and get blurred by it."
```

---

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
2. 传一个**文件夹**（至少 5 个文件），等其中 1-2 个文件传完后关掉标签页 → 重开文件区，
   **该文件夹**条目上出现角标。**不能只传单个裸文件**：后端只给列表里已经存在的条目打
   角标（`route/v1/file.go:431-443` 按 `info[i].Name` 查 `broken` map），而 tus 只在文件
   传完时才把文件物化到目标目录——一个从未传完的裸文件既没有列表条目也没有父文件夹，
   角标无处可挂，这个批次在 UI 上也就没有任何入口。文件夹角标靠**已完成的兄弟文件**先把
   文件夹建出来，再由后端的 `BrokenChildren` 把角标挂在文件夹条目上。
3. 点角标 → 弹窗列出缺失文件与 `已上传 x / y`
4. 点「放弃这批」→ 弹窗关闭，角标消失
5. 重复步骤 2（传一个新文件夹、中途关标签页），改点「重传缺失文件」→ 选同一个文件夹 →
   只传缺失那些，完成后角标消失
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
