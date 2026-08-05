### Task 2: `photosAlbums` Pinia store

**Files:**
- Create: `src/photos/stores/albums.ts`
- Test: `src/photos/stores/__tests__/albums.test.ts`

**Interfaces:**
- Consumes:`service.photos.{listAlbums,createAlbum,getAlbum,deleteAlbum,updateAlbum,batchAddToAlbum,removeFromAlbum,reorderAlbumAssets}`、`assetToPhoto`(`src/photos/util/assetToPhoto.ts:311`)、`Photo`。
- Produces(T5/T6/T7/T8/T9/T10 消费),setup store,`defineStore('photosAlbums', () => {...})`。**完整实现如下,实现者照此落地**(注释保留):

```ts
// Ported from Vue2 NimoOS-UI src/store/modules/photos.js:272-274 (state),
// :455-473 (mutations), :756-761 + :900-994 (album actions).
// 每个 action 的乐观策略都不同,逐个保真——见文件内逐条注释。
// Photos v1 后端无信封:列表一律 `?? []`。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'

type RawAlbum = Record<string, unknown>

export const usePhotosAlbums = defineStore('photosAlbums', () => {
  // Vue2 state.albums 存的是**原始后端对象**(视图层再 map 成 AlbumView),照搬。
  const albums = ref<RawAlbum[]>([])
  // New-UI 增:空态门控。只在 fetchAlbums 成功路径置 true,失败留 false 可重试
  // (P3 血泪:无条件置位会让瞬时失败与「确认零相册」不可区分)。
  const albumsLoaded = ref(false)
  const albumAssetsByID = ref<Record<string, Photo[]>>({})
  const albumAssetsLoading = ref<Record<string, boolean>>({})

  // ── 读取辅助(全部 String 归一:路由 params.id 恒为字符串,后端 id 可能是数字)──
  function key(id: string | number): string { return String(id) }
  function albumById(id: string | number): RawAlbum | null {
    return albums.value.find((a) => key(a.id as string | number) === key(id)) ?? null
  }
  function assetsOf(id: string | number): Photo[] { return albumAssetsByID.value[key(id)] ?? [] }
  function isLoadingAssets(id: string | number): boolean { return albumAssetsLoading.value[key(id)] === true }

  // ── 内部写入(对应 Vue2 的四个 mutation)──
  function setAlbumAssets(id: string | number, assets: Photo[]): void {
    albumAssetsByID.value = { ...albumAssetsByID.value, [key(id)]: assets }
  }
  function setAssetsLoading(id: string | number, loading: boolean): void {
    const next = { ...albumAssetsLoading.value }
    if (loading) next[key(id)] = true
    else delete next[key(id)]
    albumAssetsLoading.value = next
  }
  function removeAlbumAssets(id: string | number): void {
    const next = { ...albumAssetsByID.value }
    delete next[key(id)]
    albumAssetsByID.value = next
  }
  // Vue2 UPDATE_ALBUM_LOCAL:按 id 找到后浅合并替换;找不到静默 no-op。
  function updateAlbumLocal(id: string | number, patch: RawAlbum): void {
    const idx = albums.value.findIndex((a) => key(a.id as string | number) === key(id))
    if (idx < 0) return
    const next = albums.value.slice()
    next[idx] = { ...next[idx], ...patch }
    albums.value = next
  }

  // ── actions ──

  // Vue2 :910-917 —— 全量覆盖,catch 只打日志不抛(唯一「吞错」的 album action)。
  async function fetchAlbums(): Promise<void> {
    try {
      const res = (await service.photos.listAlbums()) as unknown[]
      albums.value = ((res ?? []) as RawAlbum[])
      albumsLoaded.value = true // 仅成功路径
    } catch (e) {
      console.error('[photos-albums] fetchAlbums', e)
    }
  }

  // Vue2 :900-904 —— 无 try/catch,异常上抛给视图层 toast;成功后重拉列表并返回新相册。
  async function createAlbum(name: string): Promise<RawAlbum> {
    const created = (await service.photos.createAlbum(name)) as RawAlbum
    await fetchAlbums()
    return created
  }

  // Vue2 :905-909 —— 先删后端,成功后清本地资产缓存 + 重拉列表(无乐观删除)。异常上抛。
  async function deleteAlbum(id: string | number): Promise<void> {
    await service.photos.deleteAlbum(id)
    removeAlbumAssets(id)
    await fetchAlbums()
  }

  // Vue2 :918-932 —— 防重入(同相册在拉则直接返回);失败**清空为 []**(不是保留旧值)。
  async function fetchAlbumAssets(id: string | number): Promise<void> {
    if (isLoadingAssets(id)) return
    setAssetsLoading(id, true)
    try {
      const res = (await service.photos.getAlbum(id)) as { assets?: unknown[] } | null
      const raw = (res?.assets ?? []) as Array<Record<string, unknown>>
      setAlbumAssets(id, raw.map((a) => assetToPhoto(a)))
    } catch (e) {
      console.error('[photos-albums] fetchAlbumAssets', e)
      setAlbumAssets(id, [])
    } finally {
      setAssetsLoading(id, false)
    }
  }

  // Vue2 :933-936 —— **非乐观**:await 后端成功后,用**后端返回的 name**(不是入参)写回本地。异常上抛。
  async function renameAlbum(id: string | number, name: string): Promise<void> {
    const res = (await service.photos.updateAlbum(id, { name })) as RawAlbum | null
    updateAlbumLocal(id, { name: res?.name ?? name })
  }

  // Vue2 :937-946 —— 乐观 + **精确单值回滚**(记 prev,不是整份快照)。异常上抛。
  async function setAlbumCover(id: string | number, assetId: string | number): Promise<void> {
    const prev = (albumById(id)?.coverAssetId as string | number | undefined) ?? null
    updateAlbumLocal(id, { coverAssetId: assetId })
    try {
      await service.photos.updateAlbum(id, { coverAssetId: assetId })
    } catch (e) {
      updateAlbumLocal(id, { coverAssetId: prev })
      throw e
    }
  }

  // Vue2 :948-959 —— 乐观重排 + **整份快照回滚**。传入的 assetIds 里找不到的项被丢弃(filter(Boolean))。异常上抛。
  async function reorderAlbumAssets(id: string | number, assetIds: Array<string | number>): Promise<void> {
    const snapshot = assetsOf(id).slice()
    const byId = new Map(snapshot.map((p) => [key(p.id), p]))
    const reordered = assetIds.map((aid) => byId.get(key(aid))).filter(Boolean) as Photo[]
    setAlbumAssets(id, reordered)
    try {
      await service.photos.reorderAlbumAssets(id, assetIds)
    } catch (e) {
      setAlbumAssets(id, snapshot)
      throw e
    }
  }

  // Vue2 :960-974 —— 计数乐观 +N;成功后重拉该相册资产,再用**真实长度**回写计数对账;
  // 失败回滚计数。资产列表本身不做乐观插入。异常上抛。
  async function addAssetsToAlbum(id: string | number, assetIds: Array<string | number>): Promise<void> {
    const prevCount = (albumById(id)?.assetCount as number | undefined) ?? 0
    updateAlbumLocal(id, { assetCount: prevCount + assetIds.length })
    try {
      await service.photos.batchAddToAlbum(id, assetIds)
      await fetchAlbumAssets(id)
      updateAlbumLocal(id, { assetCount: assetsOf(id).length })
    } catch (e) {
      updateAlbumLocal(id, { assetCount: prevCount })
      throw e
    }
  }

  // Vue2 :975-994 —— 乐观移除 + 计数;后端**无批量移除端点**,逐条 DELETE 并发;
  // 成功后重拉**相册列表**(不是资产)——因为后端会在封面被移除时 fallback 到第一张,
  // 本地 coverAssetId 要跟上。失败整份回滚 assets + 计数。异常上抛。
  async function removeAssetsFromAlbum(id: string | number, assetIds: Array<string | number>): Promise<void> {
    const snapshot = assetsOf(id).slice()
    const remove = new Set(assetIds.map((x) => key(x)))
    const remaining = snapshot.filter((p) => !remove.has(key(p.id)))
    const prevCount = (albumById(id)?.assetCount as number | undefined) ?? snapshot.length
    setAlbumAssets(id, remaining)
    updateAlbumLocal(id, { assetCount: remaining.length })
    try {
      await Promise.all(assetIds.map((aid) => service.photos.removeFromAlbum(id, aid)))
      await fetchAlbums()
    } catch (e) {
      setAlbumAssets(id, snapshot)
      updateAlbumLocal(id, { assetCount: prevCount })
      throw e
    }
  }

  // Vue2 :756-761 —— 建相册 + 批量塞入 + 重拉列表,返回新相册。无 try/catch,异常(含 409 重名)上抛。
  async function saveAsAlbum(name: string, assetIds: Array<string | number>): Promise<RawAlbum> {
    const created = (await service.photos.createAlbum(name)) as RawAlbum
    await service.photos.batchAddToAlbum(created.id as string | number, assetIds)
    await fetchAlbums()
    return created
  }

  function __resetForTest(): void {
    albums.value = []
    albumsLoaded.value = false
    albumAssetsByID.value = {}
    albumAssetsLoading.value = {}
  }

  return {
    albums, albumsLoaded, albumAssetsByID, albumAssetsLoading,
    albumById, assetsOf, isLoadingAssets,
    fetchAlbums, createAlbum, deleteAlbum, fetchAlbumAssets,
    renameAlbum, setAlbumCover, reorderAlbumAssets,
    addAssetsToAlbum, removeAssetsFromAlbum, saveAsAlbum,
    __resetForTest,
  }
})
```

**签名偏离登记**:Vue2 的 action 收单个对象参数(`{id, name}` / `{id, assetIds}`),本 store 改**位置参数**(`renameAlbum(id, name)`),与 New-UI 既有 store(`favorites.toggle(id)`、`trash.restore(ids)`)体例一致;调用点全在本期新建,无兼容负担。

- [ ] **Step 1: 写失败测试 — `albums.test.ts`**(`setActivePinia(createPinia())`,mock 共享包;每例 `vi.clearAllMocks()` 防跨用例调用计数泄漏 —— P3 T1 踩过)。覆盖清单(每条都要断言**行为**,不是 smoke):
  - `fetchAlbums` 成功 → `albums` 填充 + `albumsLoaded===true`;返回 `null` → `albums===[]`(`?? []`);**reject → `albumsLoaded` 仍为 false** + `console.error` 被调。
  - `albumById('7')` 能命中后端返回的数字 id `7`(**铁律:跨类型 String 归一**);`assetsOf` / `isLoadingAssets` 同理。
  - `createAlbum` 返回新相册且 `listAlbums` 被再次调用;后端 reject → **抛出**(`await expect(...).rejects`)。
  - `deleteAlbum` → 该 id 的资产缓存被清 + `listAlbums` 再调。
  - `fetchAlbumAssets`:成功 → `assetsOf` 为 `assetToPhoto` 映射结果;**并发二次调用被防重入吞掉**(`getAlbum` 只调 1 次);reject → `assetsOf` 变 `[]` + loading 收尾为 false + `console.error`。
  - `renameAlbum` → `updateAlbum(id,{name})` 被调,本地写回的是**后端返回的 name**(mock 返回 `{name:'服务端名'}`,断言本地为 `'服务端名'`);reject → 抛出且本地未改。
  - `setAlbumCover` → 调用前本地立即变新 cover(乐观);reject → **回滚为 prev** 且抛出。
  - `reorderAlbumAssets` → 立即按传入顺序重排;reject → **整份还原** 且抛出;传入含未知 id → 该项被丢弃。
  - `addAssetsToAlbum` → 立即 `assetCount = prev + n`;成功后 `getAlbum` 被调且 `assetCount` 被真实长度覆盖;reject → 计数回滚为 prev 且抛出。
  - `removeAssetsFromAlbum` → 立即移除 + 计数减;`removeFromAlbum` 被**逐条**调用(断言调用次数 = ids 长度);成功后 `listAlbums` 再调;reject → assets 与计数**整份回滚**且抛出。
  - `saveAsAlbum` → `createAlbum` → `batchAddToAlbum(新id, ids)` → `listAlbums` 顺序调用,返回新相册;`createAlbum` reject(409)→ 抛出且 `batchAddToAlbum` 未被调。
- [ ] **Step 2: RED**;**Step 3: 实现**(照上方代码);**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): photosAlbums store(十个 action 逐个保真 Vue2 乐观策略)`

---

