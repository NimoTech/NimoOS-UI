// Ported from the Vue 2 panel src/store/modules/photos.js:272-274 (state),
// :455-473 (mutations), :756-761 + :900-994 (album actions).
// Each action has different optimistic strategies, kept faithful one by one—see comments throughout the file.
// Photos v1 backend has no envelope: all lists use `?? []`.
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
// SP15-P2b final fix wave: the two conversion actions are mirror images living in the two
// stores they create into, so each has to evict the source object from the other store. That
// makes this import pair mutual (smartViews.ts imports this file for the same reason). Safe
// because neither side touches the other's binding at module-evaluation time -- both calls sit
// inside an async action body, by which point both modules are fully initialised.
import { usePhotosSmartViews } from './smartViews'

type RawAlbum = Record<string, unknown>

export const usePhotosAlbums = defineStore('photosAlbums', () => {
  // Vue2 state.albums stores **raw backend objects** (view layer maps them to AlbumView), copied verbatim.
  const albums = ref<RawAlbum[]>([])
  // New-UI addition: empty state gating. Set to true only on fetchAlbums success path, leave false on failure for retry
  // (P3 hard lesson: unconditional setting makes transient failure indistinguishable from "confirmed zero albums").
  const albumsLoaded = ref(false)
  // Task 9 (P8a, P4 legacy closure): independent failure flag—never merge/reuse with albumsLoaded.
  // albumsLoaded set to true only on success path is intentional (see comment above); a transient failure must be distinguishable
  // by view as "load failure" not "still in skeleton screen", that is the sole reason loadError exists.
  const loadError = ref(false)
  const albumAssetsByID = ref<Record<string, Photo[]>>({})
  const albumAssetsLoading = ref<Record<string, boolean>>({})

  // ── Read helpers (all String normalization: route params.id always string, backend id may be numeric)—
  function key(id: string | number): string { return String(id) }
  function albumById(id: string | number): RawAlbum | null {
    return albums.value.find((a) => key(a.id as string | number) === key(id)) ?? null
  }
  function assetsOf(id: string | number): Photo[] { return albumAssetsByID.value[key(id)] ?? [] }
  function isLoadingAssets(id: string | number): boolean { return albumAssetsLoading.value[key(id)] === true }

  // ── Internal writes (corresponding to Vue2's four mutations)—
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
  // Vue2 UPDATE_ALBUM_LOCAL: find by id then shallow merge replace; not found silent no-op.
  function updateAlbumLocal(id: string | number, patch: RawAlbum): void {
    const idx = albums.value.findIndex((a) => key(a.id as string | number) === key(id))
    if (idx < 0) return
    const next = albums.value.slice()
    next[idx] = { ...next[idx], ...patch }
    albums.value = next
  }
  // SP15-P2b final fix wave: drop an album the server no longer has, without a refetch.
  // Exported because the *smart views* store needs it -- convertFromAlbum deletes the source
  // album server-side, and leaving it in this list keeps a detail route alive for an object
  // that is gone (albumsLoaded stays true, so PhotosAlbumDetail.vue:442 never refetches).
  // Replaces the ref immutably, matching this file's convention throughout.
  function dropAlbumLocal(id: string | number): void {
    albums.value = albums.value.filter((a) => key(a.id as string | number) !== key(id))
    removeAlbumAssets(id)
  }

  // ── actions—

  // Vue2 :910-917—full replace, catch only logs not throws (the only "swallowed-error" album action).
  // Task 9 correction: `loadError` used to be reset to false at the top of
  // this function (before the await). That created a window, on every retry
  // (success *or* failure), where loadError was already false but
  // albumsLoaded was still false too — i.e. a transient "nothing failed"
  // reading during a fetch that hasn't settled yet. Clearing loadError only
  // on confirmed success means the failure UI stays continuously visible
  // from the first failure until a retry actually succeeds — no window
  // where a consumer can observe "not failed, not loaded" and draw the
  // wrong conclusion.
  async function fetchAlbums(): Promise<void> {
    try {
      const res = (await service.photos.listAlbums()) as unknown[]
      albums.value = ((res ?? []) as RawAlbum[])
      albumsLoaded.value = true // success path only
      loadError.value = false
    } catch (e) {
      loadError.value = true
      console.error('[photos-albums] fetchAlbums', e)
    }
  }

  // Vue2 :900-904—no try/catch, exception throws up to view for toast; after success re-fetch list and return new album.
  async function createAlbum(name: string): Promise<RawAlbum> {
    const created = (await service.photos.createAlbum(name)) as RawAlbum
    await fetchAlbums()
    return created
  }

  // Vue2 :905-909—delete backend first, after success clear local asset cache + re-fetch list (no optimistic delete). Exception throws up.
  async function deleteAlbum(id: string | number): Promise<void> {
    await service.photos.deleteAlbum(id)
    removeAlbumAssets(id)
    await fetchAlbums()
  }

  // Vue2 :918-932—prevent re-entry (if same album is loading return directly); on failure **clear to []** (not keep old value).
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

  // Vue2 :933-936—**not optimistic**: after backend succeeds, use **backend-returned name** (not input param) to write back locally. Exception throws up.
  // Line-by-line review of Vue2 :934-935 found divergence: Vue2 is `res.data.name` no fallback (if backend omits name
  // writes undefined); brief snapshot added `?? name` fallback. Following Vue2 source, drop fallback, strictly use
  // backend return value only (see task-2-report.md divergence record).
  async function renameAlbum(id: string | number, name: string): Promise<void> {
    const res = (await service.photos.updateAlbum(id, { name })) as RawAlbum
    updateAlbumLocal(id, { name: res.name })
  }

  // Vue2 :937-946—optimistic + **precise single-value rollback** (record prev, not whole snapshot). Exception throws up.
  // Line-by-line review of Vue2 :938-939 found divergence: Vue2 is `album ? album.coverAssetId : null` (when album exists
  // but coverAssetId field missing prev=undefined); brief snapshot uses `?? null` which also normalizes this case to
  // null. Following Vue2 source, preserve three states (album not found→null, found but field missing→undefined).
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

  // Vue2 :948-959—optimistic reorder + **whole snapshot rollback**. Items in assetIds not found are discarded (filter(Boolean)). Exception throws up.
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

  // Vue2 :960-974—optimistic count +N; after success re-fetch album assets, then use **real length** to reconcile count;
  // on failure rollback count. Asset list itself not optimistically inserted. Exception throws up.
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

  // Vue2 :975-994—optimistic remove + count; backend **no batch remove endpoint**, DELETE each concurrently;
  // after success re-fetch **album list** (not assets)—because backend falls back to first when cover is removed,
  // local coverAssetId must keep up. On failure roll back whole assets + count. Exception throws up.
  // Line-by-line review of Vue2 :979-980 found divergence: Vue2 is `album ? (album.assetCount || 0) : snapshot.length`—
  // when album exists but assetCount missing fallback to 0, only when album **entirely not found** fallback to snapshot.length;
  // brief snapshot uses `?? snapshot.length` which also fallbacks "exists but field missing" to snapshot.length. Following Vue2 source.
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

  // Vue2 :756-761—create album + batch insert + re-fetch list, return new album. No try/catch, exceptions (including 409 duplicate name) throw up.
  async function saveAsAlbum(name: string, assetIds: Array<string | number>): Promise<RawAlbum> {
    const created = (await service.photos.createAlbum(name)) as RawAlbum
    await service.photos.batchAddToAlbum(created.id as string | number, assetIds)
    await fetchAlbums()
    return created
  }

  // SP15-P2c Task 2. Vue2 does this purely on the front end -- there is no duplicate endpoint.
  // Read the target (33b05636 PhotosAlbumDetail.vue :708-730, `duplicateAlbum` method): it
  // computes `${this.album.title} copy` and the source album's member ids, then just dispatches
  // the existing `photos/saveAsAlbum` action -- it is a thin wrapper, not a fresh
  // create+addAssets combination. Reuse decision (this task's brief left it open): reuse
  // `saveAsAlbum` rather than `createAlbum` + `addAssetsToAlbum`, because that is exactly what
  // Vue2 does and their sequencing matches (create -> batchAdd -> refetch -> return); the
  // store's own `addAssetsToAlbum` action has different semantics (optimistic count patch +
  // per-album asset refetch) that Vue2's duplicateAlbum never exercises. No cover copying is
  // done -- the target has no such step either.
  //
  // `source.name` mirrors albumView.ts:61's `(a.name as string) || (a.title as string)`
  // fallback -- this store keeps raw backend objects (field `name`), and the view layer is
  // what maps that to the `.title` Vue2's `this.album.title` reads.
  //
  // The new album's position: saveAsAlbum's own fetchAlbums() already puts it first, because
  // the backend orders ListAlbums by created_at DESC (NimoOS-Photos service/album.go:83) --
  // verified before relying on it, no extra frontend unshift needed.
  const duplicateBusy = ref(false)
  async function duplicateAlbum(id: string | number): Promise<RawAlbum> {
    // Re-entry guard, same shape as smartViews.ts:170's duplicateBusy. Without it a double
    // click creates two albums, and P1's final review caught exactly this class of bug on the
    // one write path that lacked a guard.
    if (duplicateBusy.value) throw new Error('duplicate already in flight')
    duplicateBusy.value = true
    try {
      const source = albumById(id)
      if (!source) throw new Error('album not found')
      const rawName = (source.name as string) || (source.title as string) || ''
      const name = `${rawName} copy`
      const assetIds = assetsOf(id).map((p) => p.id)
      return await saveAsAlbum(name, assetIds)
    } finally {
      // Always clear, so a failed attempt does not wedge the button for the rest of the session.
      duplicateBusy.value = false
    }
  }

  // SP15-P2b: a smart view solidifies into a manual album in place. Mirror image of
  // smartViews.convertFromAlbum — see its comment for why there is no refetch. The raw backend
  // object is stored as-is, matching this store's convention of keeping albums unmapped (the
  // views map them through albumToView).
  //
  // The source smart view MUST leave the other store (final fix wave): the backend deletes it,
  // but smartViews.listLoaded stays true and PhotosSmartViewDetail.vue:96 skips its own fetch
  // when it is, so one browser Back press after a successful conversion would otherwise land on
  // a fully interactive detail page for a smart view the server has already deleted.
  //
  // Rethrows on failure. Note this store's fetchAlbums deliberately swallows errors;
  // that is not the pattern to follow for a user-initiated write.
  async function convertFromSmartView(smartViewId: string): Promise<RawAlbum> {
    const raw = await service.photos.convertSmartToAlbum(smartViewId)
    const album = (raw ?? {}) as RawAlbum
    albums.value = [album, ...albums.value]
    usePhotosSmartViews().dropSmartViewLocal(smartViewId)
    return album
  }

  function __resetForTest(): void {
    albums.value = []
    albumsLoaded.value = false
    loadError.value = false
    albumAssetsByID.value = {}
    albumAssetsLoading.value = {}
    duplicateBusy.value = false
  }

  return {
    albums, albumsLoaded, loadError, albumAssetsByID, albumAssetsLoading, duplicateBusy,
    albumById, assetsOf, isLoadingAssets,
    fetchAlbums, createAlbum, deleteAlbum, fetchAlbumAssets,
    renameAlbum, setAlbumCover, reorderAlbumAssets, duplicateAlbum,
    addAssetsToAlbum, removeAssetsFromAlbum, saveAsAlbum, convertFromSmartView, dropAlbumLocal,
    __resetForTest,
  }
})
