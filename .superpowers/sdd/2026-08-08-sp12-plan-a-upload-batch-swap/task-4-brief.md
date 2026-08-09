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

