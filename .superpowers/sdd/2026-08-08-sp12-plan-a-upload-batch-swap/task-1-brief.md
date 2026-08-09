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

