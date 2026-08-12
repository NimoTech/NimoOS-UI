import type { AxiosInstance } from 'axios'
import type { PhotoAsset } from './types.js'
import { unwrap } from './unwrap.js'
import type { StdEnvelope } from './types.js'

// Photos v1 后端(同 KVM)不走系统标准信封:裸数组/裸对象直接返回,部分端点 204 空体。
// 防御性兼容:万一某端点包了标准信封(带数字 success 字段)仍解开。
function body<T>(d: unknown): T {
  if (d && typeof d === 'object' && !Array.isArray(d) && typeof (d as { success?: unknown }).success === 'number') {
    return unwrap<T>(d as StdEnvelope<T>)
  }
  return (d === '' || d == null ? undefined : d) as T
}

export function createPhotos(http: AxiosInstance, getToken: () => string | null) {
  // 统一口径:媒体/导出 URL 一律追加 token(后端对媒体路径本就豁免 JWT,带上无害且兼容转发场景)
  const tokenQ = (sep: '?' | '&') => {
    const t = getToken()
    return t ? `${sep}token=${encodeURIComponent(t)}` : ''
  }
  return {
    async listAssets(limit = 60, offset = 0): Promise<PhotoAsset[]> {
      const res = await http.get('/photos/assets', { params: { limit, offset } })
      return body<PhotoAsset[]>(res.data)
    },
    async getTimeline(): Promise<unknown> {
      const res = await http.get('/photos/timeline')
      return body<unknown>(res.data)
    },
    // Bucketed timeline (SP15-P3). The directory is the cheap half: one row per
    // month, so the grid can render structure before any asset arrives. Bare
    // camelCase array from the backend, no envelope.
    async getTimelineBuckets(): Promise<unknown> {
      const res = await http.get('/photos/timeline/buckets')
      return body<unknown>(res.data)
    },
    // One month's assets. The backend clamps limit to 500 (limit <= 0 or > 500
    // both become 500), so 500 is the honest default rather than "unlimited".
    // year and month must be zero together for the unknown-date bucket — the
    // backend rejects a half-zero key with 400.
    async getTimelineBucket(year: number, month: number, limit = 500, offset = 0): Promise<unknown> {
      const res = await http.get('/photos/timeline/bucket', { params: { year, month, limit, offset } })
      return body<unknown>(res.data)
    },
    async getAsset(id: string | number): Promise<PhotoAsset> {
      const res = await http.get(`/photos/assets/${id}`)
      return body<PhotoAsset>(res.data)
    },
    // OCR 行坐标:q 为搜索词时只返回命中行;不带 q 返回全部行(对齐 Vue2 注释)
    async getAssetOcr(id: string | number, q?: string): Promise<unknown> {
      const res = await http.get(`/photos/assets/${id}/ocr`, q ? { params: { q } } : undefined)
      return body<unknown>(res.data)
    },
    async deleteAsset(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/assets/${id}`)
      return body<unknown>(res.data)
    },
    async getConfig(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/config')
      return body<Record<string, unknown>>(res.data)
    },
    // extra: { scenesEnabled, ocrEnabled, smartViewEnabled, scanInterval } — 省略的字段后端保持现值
    async updateConfig(
      watchDirs: string[],
      retentionDays?: number | null,
      facesEnabled?: boolean | null,
      extra: Record<string, unknown> = {},
    ): Promise<unknown> {
      const reqBody: Record<string, unknown> = { watchDirs }
      if (retentionDays != null) reqBody.retentionDays = retentionDays
      if (facesEnabled != null) reqBody.facesEnabled = facesEnabled
      for (const k of ['scenesEnabled', 'ocrEnabled', 'smartViewEnabled', 'scanInterval']) {
        if (extra[k] != null) reqBody[k] = extra[k]
      }
      const res = await http.put('/photos/config', reqBody)
      return body<unknown>(res.data)
    },
    async getStorage(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/storage')
      return body<Record<string, unknown>>(res.data)
    },
    async getAbout(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/about')
      return body<Record<string, unknown>>(res.data)
    },
    async getStatus(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/status')
      return body<Record<string, unknown>>(res.data)
    },
    // 后端返回 {tasks:[...]} 对象包裹(非裸数组);Vue2 store 自行解包,包内不抽取。
    async listTasks(): Promise<unknown> {
      const res = await http.get('/photos/tasks')
      return body<unknown>(res.data)
    },
    async pruneCache(): Promise<unknown> {
      const res = await http.post('/photos/cache/prune', {})
      return body<unknown>(res.data)
    },
    async rebuildIndex(): Promise<unknown> {
      const res = await http.post('/photos/index/rebuild', {})
      return body<unknown>(res.data)
    },
    async triggerScan(): Promise<unknown> {
      const res = await http.post('/photos/scan', {})
      return body<unknown>(res.data)
    },
    thumbnailUrl(id: string | number, size = 'small'): string {
      return `/v1/photos/assets/${id}/thumbnail?size=${size}${tokenQ('&')}`
    },
    originalUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/original${tokenQ('?')}`
    },
    liveUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/live${tokenQ('?')}`
    },
    // ─── 搜索 ───
    // offset 须为 limit 整数倍;深页由后端标记 belowCut(对齐 Vue2 注释)
    async smartSearch(query: string, limit = 50, offset = 0, filters: Record<string, unknown> = {}): Promise<unknown> {
      const res = await http.post('/photos/search/smart', { query, limit, offset, filters })
      return body<unknown>(res.data)
    },
    async searchFaces(personId: string | number, limit = 50, offset = 0): Promise<unknown> {
      const res = await http.get(`/photos/search/faces/${personId}`, { params: { limit, offset } })
      return body<unknown>(res.data)
    },
    // ─── 收藏 ───
    async listFavoriteIds(): Promise<unknown[]> {
      const res = await http.get('/photos/favorites/ids')
      return body<unknown[]>(res.data)
    },
    async listFavorites(limit = 0, offset = 0): Promise<unknown> {
      const params: Record<string, number> = {}
      if (limit > 0) { params.limit = limit; params.offset = offset }
      const res = await http.get('/photos/favorites', { params })
      return body<unknown>(res.data)
    },
    async favorite(assetId: string | number): Promise<unknown> {
      const res = await http.post(`/photos/favorites/${assetId}`, {})
      return body<unknown>(res.data)
    },
    async unfavorite(assetId: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/favorites/${assetId}`)
      return body<unknown>(res.data)
    },
    async recordView(assetId: string | number): Promise<unknown> {
      const res = await http.post(`/photos/views/${assetId}`, {})
      return body<unknown>(res.data)
    },
    // Vue2 此处误传 { params: { limit } } 作 params(发出 params[limit]=N,后端走默认)——包内修正为正确形态
    async topFavorites(limit = 5): Promise<unknown> {
      const res = await http.get('/photos/favorites/top', { params: { limit } })
      return body<unknown>(res.data)
    },
    // 浏览器原生下载用,token 走注入的 getToken(Vue2 版直读 localStorage)
    exportFavoritesUrl(): string {
      return `/v1/photos/favorites/export${tokenQ('?')}`
    },
    // ─── 相册 ───
    // SP15-P2c Task 2. Same GET + token shape as exportFavoritesUrl above: the backend serves
    // this as a plain download URL the browser navigates to, and Photos exempts the
    // `/albums/:id/export` suffix from JWT so the query token is the only credential
    // (NimoOS-Photos route/router.go:52, :178). The Vue2 comment claiming this endpoint was
    // "in parallel development" is stale -- the handler already exists (route/v1/albums.go:84).
    exportAlbumZipUrl(id: string | number): string {
      return `/v1/photos/albums/${id}/export${tokenQ('?')}`
    },
    async listAlbums(): Promise<unknown[]> {
      const res = await http.get('/photos/albums')
      return body<unknown[]>(res.data)
    },
    async createAlbum(name: string): Promise<unknown> {
      const res = await http.post('/photos/albums', { name })
      return body<unknown>(res.data)
    },
    async getAlbum(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/albums/${id}`)
      return body<unknown>(res.data)
    },
    async deleteAlbum(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/albums/${id}`)
      return body<unknown>(res.data)
    },
    async addToAlbum(albumId: string | number, assetId: string | number): Promise<unknown> {
      const res = await http.post(`/photos/albums/${albumId}/assets`, { assetId })
      return body<unknown>(res.data)
    },
    async removeFromAlbum(albumId: string | number, assetId: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/albums/${albumId}/assets/${assetId}`)
      return body<unknown>(res.data)
    },
    async batchAddToAlbum(albumId: string | number, assetIds: Array<string | number>): Promise<unknown> {
      const res = await http.post(`/photos/albums/${albumId}/assets/batch`, { assetIds })
      return body<unknown>(res.data)
    },
    async updateAlbum(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.patch(`/photos/albums/${id}`, patch)
      return body<unknown>(res.data)
    },
    async reorderAlbumAssets(id: string | number, assetIds: Array<string | number>): Promise<unknown> {
      const res = await http.patch(`/photos/albums/${id}/assets/order`, { assetIds })
      return body<unknown>(res.data)
    },
    // ─── 人物 ───
    // 后端返回 {persons, facesIndexedUpTo} 对象包裹(非裸数组);Vue2 store 自行解包,包内不抽取。
    async listPersons(): Promise<unknown> {
      const res = await http.get('/photos/persons')
      return body<unknown>(res.data)
    },
    async getPerson(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}`)
      return body<unknown>(res.data)
    },
    async updatePerson(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`/photos/persons/${id}`, patch)
      return body<unknown>(res.data)
    },
    async setPersonCover(id: string | number, assetId: string | number): Promise<unknown> {
      const res = await http.put(`/photos/persons/${id}/cover`, { assetId })
      return body<unknown>(res.data)
    },
    async resetPersonCover(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/persons/${id}/cover`)
      return body<unknown>(res.data)
    },
    async deletePerson(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/persons/${id}`)
      return body<unknown>(res.data)
    },
    async purgePerson(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/persons/${id}?purge=true`)
      return body<unknown>(res.data)
    },
    async restorePerson(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/persons/${id}/restore`, {})
      return body<unknown>(res.data)
    },
    async getPersonAssets(id: string | number, limit = 100, offset = 0): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}/assets`, { params: { limit, offset } })
      return body<unknown>(res.data)
    },
    async personRelations(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}/relations`)
      return body<unknown>(res.data)
    },
    async personPlaces(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/persons/${id}/places`)
      return body<unknown>(res.data)
    },
    async mergePersons(fromId: string | number, intoId: string | number): Promise<unknown> {
      const res = await http.post('/photos/persons/merge', { from_id: fromId, into_id: intoId })
      return body<unknown>(res.data)
    },
    async mergeSuggestions(): Promise<unknown[]> {
      const res = await http.get('/photos/persons/merge-suggestions')
      return body<unknown[]>(res.data)
    },
    async rejectMergeSuggestion(fromId: string | number, intoId: string | number): Promise<unknown> {
      const res = await http.post('/photos/persons/merge-suggestions/reject', { from_id: fromId, into_id: intoId })
      return body<unknown>(res.data)
    },
    async reclusterFaces(): Promise<unknown> {
      const res = await http.post('/photos/persons/recluster', {})
      return body<unknown>(res.data)
    },
    async detachAssetsFromPerson(personId: string | number, assetIds: Array<string | number>): Promise<unknown> {
      const res = await http.post(`/photos/persons/${personId}/detach`, { assetIds })
      return body<unknown>(res.data)
    },
    personFaceThumbnailUrl(id: string | number, ver?: string | number | null): string {
      // ver = coverFaceId,换封面后用于打破浏览器缓存(Vue2 peopleUtils.js:37-41 的 personAvatarUrl)。
      // Vue2 判空是 `ver != null && ver !== ''`——数字 0 是合法 ver,不能用 falsy 判断。
      const v = ver != null && ver !== '' ? `?v=${encodeURIComponent(String(ver))}` : ''
      return `/v1/photos/persons/${id}/face-thumbnail${v}${tokenQ(v ? '&' : '?')}`
    },
    // ─── 地点 ───
    // 后端返回 {regions, places, stats} 对象包裹(非裸数组;见 service/places_types.go PlacesResponse)。
    async listPlaces(params: Record<string, unknown> = {}): Promise<unknown> {
      const res = await http.get('/photos/places', { params })
      return body<unknown>(res.data)
    },
    async listAssetsByPlace(placeKey: string, spotKey = '', limit = 500, lat: number | null = null, lon: number | null = null): Promise<unknown> {
      const params: Record<string, unknown> = { place_key: placeKey, limit }
      if (spotKey) params.spot_key = spotKey
      // 质心钉住精确 spot 簇(避免网格 key 撞车);仅与 spotKey 成对时有意义,后端要求成对
      if (spotKey && lat != null && lon != null) { params.spot_lat = lat; params.spot_lon = lon }
      const res = await http.get('/photos/assets', { params })
      return body<unknown>(res.data)
    },
    async getPlace(key: string): Promise<unknown> {
      const res = await http.get(`/photos/places/${key}`)
      return body<unknown>(res.data)
    },
    async placeCoverCandidates(key: string, { tab = 'recent', q = '', page = 0 }: { tab?: string; q?: string; page?: number } = {}): Promise<unknown> {
      const res = await http.get(`/photos/places/${key}/cover-candidates`, { params: { tab, q, page } })
      return body<unknown>(res.data)
    },
    async setPlaceCover(key: string, assetId: string | number): Promise<unknown> {
      const res = await http.put(`/photos/places/${key}/cover`, { assetId })
      return body<unknown>(res.data)
    },
    async resetPlaceCover(key: string): Promise<unknown> {
      const res = await http.delete(`/photos/places/${key}/cover`)
      return body<unknown>(res.data)
    },
    async setSpotName(key: string, spotKey: string, name: string): Promise<unknown> {
      const res = await http.put(`/photos/places/${key}/spot-name`, { spotKey, name })
      return body<unknown>(res.data)
    },
    async resetSpotName(key: string, spotKey: string): Promise<unknown> {
      const res = await http.delete(`/photos/places/${key}/spot-name`, { data: { spotKey } })
      return body<unknown>(res.data)
    },
    async createPlaceAlbum(key: string, { name, from = '', to = '' }: { name: string; from?: string; to?: string }): Promise<unknown> {
      const res = await http.post(`/photos/places/${key}/album`, { name, from, to })
      return body<unknown>(res.data)
    },
    // ─── 智能视图 ───
    async listSmartViews(): Promise<unknown[]> {
      const res = await http.get('/photos/smart-views')
      return body<unknown[]>(res.data)
    },
    async createSmartView(payload: Record<string, unknown>): Promise<unknown> {
      const res = await http.post('/photos/smart-views', payload)
      return body<unknown>(res.data)
    },
    async getSmartView(id: string | number): Promise<unknown> {
      const res = await http.get(`/photos/smart-views/${id}`)
      return body<unknown>(res.data)
    },
    async updateSmartView(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`/photos/smart-views/${id}`, patch)
      return body<unknown>(res.data)
    },
    async deleteSmartView(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/smart-views/${id}`)
      return body<unknown>(res.data)
    },
    async duplicateSmartView(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/smart-views/${id}/duplicate`, {})
      return body<unknown>(res.data)
    },
    async getSmartViewAssets(id: string | number, { limit = 60, offset = 0, recent = false }: { limit?: number; offset?: number; recent?: boolean } = {}): Promise<unknown> {
      const res = await http.get(`/photos/smart-views/${id}/assets`, { params: { limit, offset, recent } })
      return body<unknown>(res.data)
    },
    async getSmartViewActivity(id: string | number, limit = 10): Promise<unknown> {
      const res = await http.get(`/photos/smart-views/${id}/activity`, { params: { limit } })
      return body<unknown>(res.data)
    },
    async previewSmartView({ condsRaw, description, threshold, includeVideos }: { condsRaw?: unknown; description?: string; threshold?: number; includeVideos?: boolean }): Promise<unknown> {
      const res = await http.post('/photos/smart-views/preview', { condsRaw, description, threshold, includeVideos })
      return body<unknown>(res.data)
    },
    // ─── Album <-> smart view conversion (SP15-P2b) ───
    // Both endpoints convert in place and delete the source object, and both answer
    // with the full new object rather than a change count — the callers push straight
    // into their store and navigate to the new detail route, so a count would be
    // useless. `conds` is deliberately optional: leaving it out lets the backend's
    // svparser derive the conditions from `description`, the same path Create takes.
    async convertAlbumToSmart(
      albumId: string | number,
      payload: { description: string; threshold: number; name?: string; conds?: string[]; includeVideos?: boolean },
    ): Promise<unknown> {
      const res = await http.post('/photos/smart-views/from-album', { albumId, ...payload })
      return body<unknown>(res.data)
    },
    async convertSmartToAlbum(smartViewId: string | number): Promise<unknown> {
      const res = await http.post('/photos/albums/from-smartview', { smartViewId })
      return body<unknown>(res.data)
    },
    // ─── Smart view manual asset actions (SP15-P2a) ───
    // Re-verified against NimoOS-Photos/route/v1/smartviews.go: the shared request
    // body is svAssetIDsReq {assetIds}, and an empty array is rejected with 400, so
    // callers must not send one. The three write endpoints return only the counts of
    // what changed — never the view's own statistics — which is why the store has to
    // refetch the view afterwards.
    async pinSmartViewAssets(id: string | number, assetIds: string[]): Promise<{ added?: number }> {
      const res = await http.post(`/photos/smart-views/${id}/assets`, { assetIds })
      return body<{ added?: number }>(res.data) ?? {}
    },
    // Removal is tiered on the backend: a pinned row is deleted (unpinned), an
    // automatically matched row is flagged excluded. Hence two counters, not one.
    async removeSmartViewAssets(id: string | number, assetIds: string[]): Promise<{ unpinned?: number; excluded?: number }> {
      const res = await http.post(`/photos/smart-views/${id}/assets/remove`, { assetIds })
      return body<{ unpinned?: number; excluded?: number }>(res.data) ?? {}
    },
    async restoreSmartViewAssets(id: string | number, assetIds: string[]): Promise<{ restored?: number }> {
      const res = await http.post(`/photos/smart-views/${id}/assets/restore`, { assetIds })
      return body<{ restored?: number }>(res.data) ?? {}
    },
    // Bare array, no envelope key — unlike most of the list endpoints in this file.
    // Deviation from the brief's literal snippet: `body() ?? []` alone only guards
    // against null/undefined, not against a non-array truthy value (e.g. `{}`) —
    // Array.isArray() is the correct guard for a "bare array" endpoint.
    async getSmartViewExcluded(id: string | number): Promise<unknown[]> {
      const res = await http.get(`/photos/smart-views/${id}/excluded`)
      const b = body<unknown>(res.data)
      return Array.isArray(b) ? b : []
    },
    exportSmartViewUrl(id: string | number, format: string): string {
      return `/v1/photos/smart-views/${id}/export?format=${format}${tokenQ('&')}`
    },
    async exportSmartViewAlbum(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/smart-views/${id}/export?format=album`, {})
      return body<unknown>(res.data)
    },
    // ─── Moments (auto-clustered highlights, the "For You" section on the smart-views page) ───
    // Checked against the backend source: NimoOS-Photos/route/v1/moments.go:List wraps its
    // payload in a {moments:[…]} key (unlike every other bare-array endpoint in this file);
    // fields are snake_case (the backend comment there says this is deliberate). Normalising
    // to camelCase is left to the store layer — this layer only unwraps the envelope key.
    async listMoments(): Promise<unknown[]> {
      const res = await http.get('/photos/moments')
      return body<{ moments?: unknown[] } | undefined>(res.data)?.moments ?? []
    },
    // When withMembers=true the backend returns {assets,members,places}; otherwise a bare array.
    // Both shapes are passed through as-is for the store to distinguish — normalising here
    // would let the two callers' expectations drift apart.
    async getMomentAssets(id: string, featured = false, withMembers = false): Promise<unknown> {
      const params: Record<string, number> = {}
      if (featured) params.featured = 1
      if (withMembers) params.with_members = 1
      const res = await http.get(`/photos/moments/${id}/assets`, { params })
      return body<unknown>(res.data)
    },
    async pinMomentAssets(id: string, ids: string[]): Promise<{ ok?: boolean; asset_count?: number }> {
      const res = await http.post(`/photos/moments/${id}/assets`, { ids })
      return body<{ ok?: boolean; asset_count?: number }>(res.data) ?? {}
    },
    // axios's delete() has no body positional parameter — the request body must go through config.data.
    async excludeMomentAssets(id: string, ids: string[]): Promise<{ ok?: boolean; asset_count?: number }> {
      const res = await http.delete(`/photos/moments/${id}/assets`, { data: { ids } })
      return body<{ ok?: boolean; asset_count?: number }>(res.data) ?? {}
    },
    async deleteMoment(id: string): Promise<unknown> {
      const res = await http.delete(`/photos/moments/${id}`)
      return body<unknown>(res.data)
    },
    async exportMomentAlbum(id: string): Promise<{ albumId?: string; name?: string; count?: number }> {
      const res = await http.post(`/photos/moments/${id}/album`, {})
      return body<{ albumId?: string; name?: string; count?: number }>(res.data) ?? {}
    },
    async reorderMoments(ids: string[]): Promise<unknown> {
      const res = await http.put('/photos/moments/order', { ids })
      return body<unknown>(res.data)
    },
    // Backend replies 202 and recomputes asynchronously. This phase deliberately does **not**
    // wire up a UI entry point (neither does Vue2 — see spec §1.2); the method is kept around
    // so it can be invoked from the browser console during acceptance testing.
    async recomputeMoments(): Promise<unknown> {
      const res = await http.post('/photos/moments/recompute', {})
      return body<unknown>(res.data)
    },
    // ─── 回收站 ───
    // limit/offset mirror listFavorites: omitted (limit = 0) leaves the backend
    // to apply its own default, which since NimoOS-Photos#54 is 500 rather than
    // "everything" — callers that must see the whole list have to page.
    async listTrash(limit = 0, offset = 0): Promise<unknown[]> {
      const params: Record<string, number> = {}
      if (limit > 0) { params.limit = limit; params.offset = offset }
      const res = await http.get('/photos/trash', { params })
      return body<unknown[]>(res.data)
    },
    async restoreFromTrash(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/trash/${id}/restore`, {})
      return body<unknown>(res.data)
    },
    async restoreTrashBatch(ids: Array<string | number>): Promise<unknown> {
      const res = await http.post('/photos/trash/restore', { ids })
      return body<unknown>(res.data)
    },
    async restoreAllTrash(): Promise<unknown> {
      const res = await http.post('/photos/trash/restore', { ids: [] })
      return body<unknown>(res.data)
    },
    async purgeTrash(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/trash/${id}`)
      return body<unknown>(res.data)
    },
    async emptyTrash(): Promise<unknown> {
      const res = await http.post('/photos/trash/empty', {})
      return body<unknown>(res.data)
    },
    // ─── 视频悬停 sprite(经共享 axios,401 走单飞——SP7 决策:全区唯一裸 fetch 并入共享通道)───
    // 请求 URL 必须与叠加层 <img src="spriteUrl(id)"> 完全一致(同带 tokenQ 片段),
    // 否则浏览器缓存按不同 URL 各存一份,sprite 被下载两次(修 SP7-P1 review 发现的
    // 双下载)。withVersion() 对已带 /v1 前缀的 URL 原样放行,故这里手写 /v1 前缀。
    async spriteMeta(id: string | number): Promise<{ frames: number; durationMs: number; frameW: number; frameH: number }> {
      const res = await http.get(`/v1/photos/assets/${id}/sprite${tokenQ('?')}`, { responseType: 'blob' })
      const h = res.headers as Record<string, string | undefined>
      return {
        frames: parseInt(h['x-sprite-frames'] || '10', 10),
        durationMs: parseInt(h['x-sprite-duration-ms'] || '0', 10),
        frameW: parseInt(h['x-sprite-frame-w'] || '240', 10),
        frameH: parseInt(h['x-sprite-frame-h'] || '135', 10),
      }
    },
    spriteUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/sprite${tokenQ('?')}`
    },
    previewUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/preview${tokenQ('?')}`
    },
  }
}
