### Task 3: `photosTrash` Pinia store

**Files:**
- Create: `src/photos/stores/trash.ts`
- Test: `src/photos/stores/__tests__/trash.test.ts`

**Interfaces:**
- Consumes:`service.photos.listTrash()`(裸数组,`?? []`)、`restoreTrashBatch(ids)`、`restoreAllTrash()`、`purgeTrash(id)`、`emptyTrash()`、`deleteAsset(id)`(undo 重删用)、`getConfig()`(读 `retentionDays`/`watchDirs`)、`updateConfig(watchDirs, retentionDays)`;Task 2 `trashAssetToPhoto`/`TrashPhoto`;P1 时间线 store `useTimelineStore`(恢复后刷新时间线,`src/photos/stores/timeline.ts`,`fetchTimeline`)。
- Produces(T9 消费,`defineStore('photosTrash', () => {...})`):
  - state:`items: Ref<TrashPhoto[]>`、`loaded: Ref<boolean>`、`retentionDays: Ref<number>`(默认 30)。
  - actions(**均无乐观更新,`await` 后端后 `fetchTrash` 全量重拉**,忠于 Vue2):
    - `fetchTrash(): Promise<void>`(`listTrash` → `trashAssetToPhoto(a, retentionDays.value)` 映射)
    - `restore(ids: Array<string|number>): Promise<void>`(`restoreTrashBatch` → `fetchTrash` + timeline `fetchTimeline`)
    - `restoreAll(): Promise<void>`(`restoreAllTrash` → `fetchTrash` + timeline)
    - `purge(ids: Array<string|number>): Promise<void>`(逐个 `purgeTrash(id)` catch 吞错 → `fetchTrash`)
    - `empty(): Promise<void>`(`emptyTrash` → `fetchTrash`)
    - `undoRestore(ids: Array<string|number>): Promise<void>`(逐个 `deleteAsset(id)` catch 吞错 → `fetchTrash` + timeline;忠于 Vue2 `PhotosTrashView.vue:267-275`)
    - `fetchRetention(): Promise<void>`(`getConfig` → `retentionDays`)
    - `setRetention(days: number): Promise<void>`(**先 `getConfig` 取 `watchDirs` 再 `updateConfig(watchDirs, days)`**,忠于 Vue2 `photos.js:1419-1425` 后端非空校验;P3 只建 action,编辑 UI 归 P8)
    - `__resetForTest(): void`

- [ ] **Step 1: 写失败测试**
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: {
    listTrash: vi.fn(() => Promise.resolve([{ id: 't1', mimeType: 'image/jpeg', deletedAt: '2026-07-20T00:00:00Z', fileSize: 1048576 }])),
    restoreTrashBatch: vi.fn(() => Promise.resolve()),
    restoreAllTrash: vi.fn(() => Promise.resolve()),
    purgeTrash: vi.fn(() => Promise.resolve()),
    emptyTrash: vi.fn(() => Promise.resolve()),
    deleteAsset: vi.fn(() => Promise.resolve()),
    getConfig: vi.fn(() => Promise.resolve({ watchDirs: ['/DATA/Gallery'], retentionDays: 15 })),
    updateConfig: vi.fn(() => Promise.resolve()),
  } },
}))
// timeline store 依赖:mock 其 fetchTimeline,避免真跑网络
vi.mock('../timeline', () => ({ useTimelineStore: () => ({ fetchTimeline: vi.fn() }) }))
import { service } from '@nimotech/nimoos-service'
import { usePhotosTrash } from '../trash'

describe('photosTrash store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  afterEach(() => vi.restoreAllMocks())

  it('fetchTrash 映射 trashAssetToPhoto,容忍 null', async () => {
    const s = usePhotosTrash()
    await s.fetchTrash()
    expect(s.items.length).toBe(1)
    expect(s.items[0].id).toBe('t1')
    ;(service.photos.listTrash as any).mockResolvedValueOnce(null)
    await s.fetchTrash()
    expect(s.items.length).toBe(0)
  })
  it('restore 调 batch 后重拉', async () => {
    const s = usePhotosTrash()
    await s.restore(['t1'])
    expect(service.photos.restoreTrashBatch).toHaveBeenCalledWith(['t1'])
    expect(service.photos.listTrash).toHaveBeenCalled()
  })
  it('empty 调 emptyTrash 后重拉', async () => {
    const s = usePhotosTrash()
    await s.empty()
    expect(service.photos.emptyTrash).toHaveBeenCalled()
  })
  it('purge 逐个删后重拉', async () => {
    const s = usePhotosTrash()
    await s.purge(['t1', 't2'])
    expect(service.photos.purgeTrash).toHaveBeenCalledTimes(2)
  })
  it('undoRestore 逐个 deleteAsset 后重拉', async () => {
    const s = usePhotosTrash()
    await s.undoRestore(['t1'])
    expect(service.photos.deleteAsset).toHaveBeenCalledWith('t1')
  })
  it('fetchRetention 读 config', async () => {
    const s = usePhotosTrash()
    await s.fetchRetention()
    expect(s.retentionDays).toBe(15)
  })
  it('setRetention 先 GET watchDirs 再 PUT', async () => {
    const s = usePhotosTrash()
    await s.setRetention(60)
    expect(service.photos.updateConfig).toHaveBeenCalledWith(['/DATA/Gallery'], 60)
    expect(s.retentionDays).toBe(60)
  })
})
```

- [ ] **Step 2: RED**;**Step 3: 实现**（骨架如下,忠于 Vue2 `photos.js:1413-1468` + `PhotosTrashView.vue:267-275`）
```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { trashAssetToPhoto, type TrashPhoto } from '../util/trashAssetToPhoto'
import { useTimelineStore } from './timeline'

export const usePhotosTrash = defineStore('photosTrash', () => {
  const items = ref<TrashPhoto[]>([])
  const loaded = ref(false)
  const retentionDays = ref(30)

  async function fetchTrash(): Promise<void> {
    try {
      const list = (await service.photos.listTrash()) as unknown[]
      items.value = (list ?? []).map((a) => trashAssetToPhoto(a as Record<string, unknown>, retentionDays.value))
    } catch {
      items.value = []
    }
    loaded.value = true
  }
  async function restore(ids: Array<string | number>): Promise<void> {
    await service.photos.restoreTrashBatch(ids)
    await fetchTrash()
    void useTimelineStore().fetchTimeline()
  }
  async function restoreAll(): Promise<void> {
    await service.photos.restoreAllTrash()
    await fetchTrash()
    void useTimelineStore().fetchTimeline()
  }
  async function purge(ids: Array<string | number>): Promise<void> {
    await Promise.all(ids.map((id) => service.photos.purgeTrash(id).then(undefined, () => {})))
    await fetchTrash()
  }
  async function empty(): Promise<void> {
    await service.photos.emptyTrash()
    await fetchTrash()
  }
  async function undoRestore(ids: Array<string | number>): Promise<void> {
    await Promise.all(ids.map((id) => service.photos.deleteAsset(id).then(undefined, () => {})))
    await fetchTrash()
    void useTimelineStore().fetchTimeline()
  }
  async function fetchRetention(): Promise<void> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const d = Number(cfg?.retentionDays)
      if (d > 0) retentionDays.value = d
    } catch { /* keep default */ }
  }
  async function setRetention(days: number): Promise<void> {
    const cfg = (await service.photos.getConfig()) as Record<string, unknown>
    const watchDirs = (cfg?.watchDirs as string[]) || []
    await service.photos.updateConfig(watchDirs, days)
    if (days > 0) retentionDays.value = days
  }
  function __resetForTest(): void { items.value = []; loaded.value = false; retentionDays.value = 30 }

  return { items, loaded, retentionDays, fetchTrash, restore, restoreAll, purge, empty, undoRestore, fetchRetention, setRetention, __resetForTest }
})
```
- [ ] **Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): photosTrash store(恢复/清空/永久删除/undo/保留天数)`

---

