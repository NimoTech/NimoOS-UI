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
  // 逐行核对 Vue2 :934-935 发现出入:Vue2 是 `res.data.name` 无兜底(后端若漏返回 name
  // 会写入 undefined);brief 快照加了 `?? name` 兜底。以 Vue2 源为准,去掉兜底,严格只用
  // 后端返回值(见 task-2-report.md 出入记录)。
  async function renameAlbum(id: string | number, name: string): Promise<void> {
    const res = (await service.photos.updateAlbum(id, { name })) as RawAlbum
    updateAlbumLocal(id, { name: res.name })
  }

  // Vue2 :937-946 —— 乐观 + **精确单值回滚**(记 prev,不是整份快照)。异常上抛。
  // 逐行核对 Vue2 :938-939 发现出入:Vue2 是 `album ? album.coverAssetId : null`(相册存在
  // 但 coverAssetId 字段缺失时 prev=undefined);brief 快照用 `?? null` 会把这种情况也归一成
  // null。以 Vue2 源为准,保留三态(相册不存在→null,存在但字段缺失→undefined)。
  async function setAlbumCover(id: string | number, assetId: string | number): Promise<void> {
    const found = albumById(id)
    const prev = found ? (found.coverAssetId as string | number | undefined) : null
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
  // 逐行核对 Vue2 :979-980 发现出入:Vue2 是 `album ? (album.assetCount || 0) : snapshot.length`——
  // 相册存在但 assetCount 缺失时兜底 0,只有相册**整个找不到**时才兜底 snapshot.length;brief 快照
  // 用 `?? snapshot.length` 会把「存在但字段缺失」也兜底成 snapshot.length。以 Vue2 源为准。
  async function removeAssetsFromAlbum(id: string | number, assetIds: Array<string | number>): Promise<void> {
    const snapshot = assetsOf(id).slice()
    const remove = new Set(assetIds.map((x) => key(x)))
    const remaining = snapshot.filter((p) => !remove.has(key(p.id)))
    const found = albumById(id)
    const prevCount = found ? ((found.assetCount as number | undefined) || 0) : snapshot.length
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
