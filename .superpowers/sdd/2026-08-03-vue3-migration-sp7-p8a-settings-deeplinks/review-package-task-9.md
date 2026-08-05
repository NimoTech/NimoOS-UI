# Review package — Task 9 (4b94094..b1f7c2c)

## Commits
b1f7c2c fix(photos): 收藏静默空网格 / 相册详情永久骨架 两处错误态收口(P8a-T9)

## Stat
 src/photos/stores/__tests__/albums.test.ts    | 28 +++++++++++++++
 src/photos/stores/__tests__/favorites.test.ts | 23 ++++++++++++
 src/photos/stores/albums.ts                   |  9 ++++-
 src/photos/stores/favorites.ts                | 10 +++++-
 src/views/PhotosAlbumDetail.vue               | 19 +++++++++-
 src/views/PhotosFavorites.vue                 | 18 +++++++++-
 src/views/__tests__/PhotosAlbumDetail.test.ts | 52 +++++++++++++++++++++++++++
 src/views/__tests__/PhotosFavorites.test.ts   | 41 +++++++++++++++++++++
 8 files changed, 196 insertions(+), 4 deletions(-)

## Diff (-U12)
```diff
diff --git a/src/photos/stores/__tests__/albums.test.ts b/src/photos/stores/__tests__/albums.test.ts
index 2d76fd0..8624126 100644
--- a/src/photos/stores/__tests__/albums.test.ts
+++ b/src/photos/stores/__tests__/albums.test.ts
@@ -38,24 +38,52 @@ describe('photosAlbums store', () => {
       await s.fetchAlbums()
       expect(s.albums).toEqual([])
     })
     it('reject → albumsLoaded 仍为 false + console.error 被调', async () => {
       const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
       ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
       const s = usePhotosAlbums()
       await s.fetchAlbums()
       expect(s.albumsLoaded).toBe(false)
       expect(errSpy).toHaveBeenCalled()
       errSpy.mockRestore()
     })
+    // Task 9(P4 遗留收口):新增 loadError,语义与 albumsLoaded 完全独立——失败时
+    // loadError=true 但 albumsLoaded 仍保持 false(不可合并/不可互相替代)。
+    it('fetchAlbums 失败:loadError 置真,albumsLoaded 保持假', async () => {
+      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(true)
+      expect(s.albumsLoaded).toBe(false)
+      errSpy.mockRestore()
+    })
+    it('重试成功后 loadError 归假', async () => {
+      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(true)
+      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 1, name: 'A' }])
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(false)
+      expect(s.albumsLoaded).toBe(true)
+      errSpy.mockRestore()
+    })
+    it('成功路径 loadError 保持假', async () => {
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(false)
+    })
   })
 
   describe('跨类型 String 归一(铁律)', () => {
     it("albumById('7') 命中后端返回的数字 id 7", async () => {
       ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'A' }])
       const s = usePhotosAlbums()
       await s.fetchAlbums()
       expect(s.albumById('7')).toEqual({ id: 7, name: 'A' })
       expect(s.albumById(7)).toEqual({ id: 7, name: 'A' })
     })
     it('assetsOf 按 key 归一(数字 id 存,字符串查命中)', async () => {
       const s = usePhotosAlbums()
diff --git a/src/photos/stores/__tests__/favorites.test.ts b/src/photos/stores/__tests__/favorites.test.ts
index bcb8a80..5f77b5c 100644
--- a/src/photos/stores/__tests__/favorites.test.ts
+++ b/src/photos/stores/__tests__/favorites.test.ts
@@ -75,18 +75,41 @@ describe('photosFavorites store', () => {
     const s = usePhotosFavorites()
     await s.fetchFavorites()
     expect(s.favoritesList?.length).toBe(1)
     expect(s.favoritesMonths[0].key).toBe('2026-05')
   })
   it('fetchFavorites 失败:favoritesList 置空但 favoritesLoaded 保持 false(与"确认零收藏"可区分,留给视图重试)', async () => {
     ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
     const s = usePhotosFavorites()
     await s.fetchFavorites()
     expect(s.favoritesList).toEqual([])
     expect(s.favoritesLoaded).toBe(false)
   })
+  // Task 9(P3 遗留收口):新增 loadError 标志,语义与 favoritesLoaded 完全独立——
+  // 失败时 loadError=true 但 favoritesLoaded 仍保持 false(两者不可合并/不可互相替代)。
+  it('fetchFavorites 失败:loadError 置真,favoritesLoaded 保持假(两者语义不同)', async () => {
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(true)
+    expect(s.favoritesLoaded).toBe(false)
+  })
+  it('重试成功后 loadError 归假', async () => {
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(true)
+    await s.fetchFavorites() // 重试:这次成功(mockRejectedValueOnce 只吃一次)
+    expect(s.loadError).toBe(false)
+    expect(s.favoritesLoaded).toBe(true)
+  })
+  it('成功路径 loadError 保持/归假(不会被残留的上次失败污染)', async () => {
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(false)
+  })
   it('exportZip 走 exportFavoritesUrl', () => {
     const s = usePhotosFavorites()
     s.exportZip()
     expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
   })
 })
diff --git a/src/photos/stores/albums.ts b/src/photos/stores/albums.ts
index 78bc89a..2eb61d6 100644
--- a/src/photos/stores/albums.ts
+++ b/src/photos/stores/albums.ts
@@ -6,24 +6,28 @@ import { ref } from 'vue'
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
+  // Task 9 (P8a, P4 遗留收口): 独立失败标志——绝不与 albumsLoaded 合并/复用。
+  // albumsLoaded 仅成功路径置真是刻意的(见上方注释);一次瞬时失败必须能被视图区分出
+  // 「加载失败」而不是「还在骨架屏」,这就是 loadError 存在的唯一理由。
+  const loadError = ref(false)
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
@@ -45,29 +49,31 @@ export const usePhotosAlbums = defineStore('photosAlbums', () => {
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
+    loadError.value = false
     try {
       const res = (await service.photos.listAlbums()) as unknown[]
       albums.value = ((res ?? []) as RawAlbum[])
       albumsLoaded.value = true // 仅成功路径
     } catch (e) {
+      loadError.value = true
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
@@ -173,25 +179,26 @@ export const usePhotosAlbums = defineStore('photosAlbums', () => {
 
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
+    loadError.value = false
     albumAssetsByID.value = {}
     albumAssetsLoading.value = {}
   }
 
   return {
-    albums, albumsLoaded, albumAssetsByID, albumAssetsLoading,
+    albums, albumsLoaded, loadError, albumAssetsByID, albumAssetsLoading,
     albumById, assetsOf, isLoadingAssets,
     fetchAlbums, createAlbum, deleteAlbum, fetchAlbumAssets,
     renameAlbum, setAlbumCover, reorderAlbumAssets,
     addAssetsToAlbum, removeAssetsFromAlbum, saveAsAlbum,
     __resetForTest,
   }
 })
diff --git a/src/photos/stores/favorites.ts b/src/photos/stores/favorites.ts
index 6e7b589..ead9560 100644
--- a/src/photos/stores/favorites.ts
+++ b/src/photos/stores/favorites.ts
@@ -8,55 +8,62 @@ import { ref, computed } from 'vue'
 import { defineStore } from 'pinia'
 import { service } from '@nimotech/nimoos-service'
 import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
 import { groupPhotosByMonth } from '../util/groupPhotosByMonth'
 
 const VIEW_THROTTLE_MS = 60_000
 
 export const usePhotosFavorites = defineStore('photosFavorites', () => {
   const favIds = ref<Set<string>>(new Set())
   const favIdsLoaded = ref(false)
   const favoritesList = ref<Photo[] | null>(null)
   const favoritesLoaded = ref(false)
+  // Task 9 (P8a, P3 遗留收口): 独立失败标志——绝不与 favoritesLoaded 合并/复用。
+  // favoritesLoaded 仅成功路径置真是刻意的(见下方 fetchFavorites 注释);一次瞬时失败
+  // 必须能被视图区分出「加载失败」而不是「正在加载」或「确认为空」,这就是 loadError 存在
+  // 的唯一理由。
+  const loadError = ref(false)
   // Non-reactive view-report throttle ledger — mirrors Vue2's non-reactive
   // `state._viewReportTs`, avoiding a render trigger on every photo view.
   const _viewTs = new Map<string, number>()
 
   function isFav(id: string | number): boolean {
     return favIds.value.has(String(id))
   }
   const favoritesMonths = computed<Month[]>(() => groupPhotosByMonth(favoritesList.value ?? []))
 
   async function reconcileFavIds(): Promise<void> {
     try {
       const ids = await service.photos.listFavoriteIds()
       favIds.value = new Set(((ids as unknown[]) ?? []).map((v) => String(v)))
       favIdsLoaded.value = true
     } catch (e) {
       // leave favIds as-is on failure
       console.error('[photos-favorites] reconcileFavIds', e)
     }
   }
 
   async function fetchFavorites(): Promise<void> {
+    loadError.value = false
     try {
       const list = (await service.photos.listFavorites()) as unknown[]
       favoritesList.value = (list ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
       // Only mark loaded on success — a transient fetch failure must stay
       // distinguishable from "confirmed zero favorites", otherwise consumers
       // gating a refetch on `!favoritesLoaded` (e.g. the Favorites view) would
       // permanently mask real favorites behind an empty state.
       favoritesLoaded.value = true
     } catch (e) {
       favoritesList.value = []
+      loadError.value = true
       console.error('[photos-favorites] fetchFavorites', e)
     }
   }
 
   // Single-item optimistic flip + failure rollback (true to Vue2 toggleFav:
   // flips again to roll back, not a snapshot restore).
   async function toggle(id: string | number): Promise<void> {
     const key = String(id)
     const wasFav = favIds.value.has(key)
     const flipped = new Set(favIds.value)
     if (wasFav) flipped.delete(key)
     else flipped.add(key)
@@ -93,21 +100,22 @@ export const usePhotosFavorites = defineStore('photosFavorites', () => {
   }
 
   function exportZip(): void {
     const url = service.photos.exportFavoritesUrl()
     if (typeof window !== 'undefined') window.location.href = url
   }
 
   function __resetForTest(): void {
     favIds.value = new Set()
     favIdsLoaded.value = false
     favoritesList.value = null
     favoritesLoaded.value = false
+    loadError.value = false
     _viewTs.clear()
   }
 
   return {
-    favIds, favIdsLoaded, favoritesList, favoritesLoaded,
+    favIds, favIdsLoaded, favoritesList, favoritesLoaded, loadError,
     isFav, favoritesMonths,
     reconcileFavIds, fetchFavorites, toggle, recordView, exportZip, __resetForTest,
   }
 })
diff --git a/src/views/PhotosAlbumDetail.vue b/src/views/PhotosAlbumDetail.vue
index bbb0a1f..73e41ba 100644
--- a/src/views/PhotosAlbumDetail.vue
+++ b/src/views/PhotosAlbumDetail.vue
@@ -207,24 +207,31 @@ async function commitTitle(): Promise<void> {
     titleEditing.value = false
   }
 }
 
 // Minor 修正:同 PhotosAlbums.vue:85-87 的具名函数写法,把导航调用从模板内联表达式挪出来——
 // 模板里内联 `@click="router.push(...)"` 会把返回的 promise 挂在事件处理器上不管,导航被
 // 取消/重复时 reject 没人接住(vue-router 的已知坑,console 会打未捕获 rejection);这里额外
 // 加 `void` 显式标记"不关心其 resolve/reject"。
 function goToAlbumsList(): void {
   void router.push('/photos/albums')
 }
 
+// Task 9(P8a,P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释,
+// 刻意不变),旧实现下 `!album && !albums.albumsLoaded` 因此恒真 → 永久停在骨架屏。新增
+// loadError 分支(见模板,优先级在骨架分支之前)+ 这个重试入口,直接重新调用同一个 fetch。
+function retryAlbums(): void {
+  void albums.fetchAlbums()
+}
+
 // ── Hero:编辑态/⋯菜单 ──
 function toggleEditMode(): void {
   edit.value = !edit.value
   if (!edit.value) selected.value.clear()
 }
 function askConfirmDelete(): void {
   menuOpen.value = false
   confirmDelete.value = true
 }
 
 // ── 工具条:批量移除 ──
 async function removeSelected(): Promise<void> {
@@ -344,26 +351,36 @@ watch([edit, sortBy], () => {
 // 值 → 但没有 watch 命中这个时机,Sortable 永远不会被创建,拖拽静默失效。这里专门加一个键在
 // 容器本身上的 watch 补上这个触发点。
 watch(gridRef, () => {
   void nextTick(() => drag.refresh())
 })
 </script>
 
 <template>
   <AreaShell :title="album ? album.title : t('photosAlbumsTitle')">
     <div class="photos-layout">
       <PhotosSidebar />
       <main class="photos-main">
+        <!-- Task 9(P4 遗留收口):失败态优先级在骨架分支之前——loadError 一旦为真,
+             albumsLoaded 仍是假(刻意,见 albums.ts 注释),不该再落进骨架分支永久显示
+             "正在加载"。 -->
+        <div v-if="albums.loadError" class="empty-state" data-test="album-load-error">
+          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
+          <button type="button" class="bar-btn" data-test="album-retry" @click="retryAlbums">
+            {{ t('photosRetry') }}
+          </button>
+        </div>
+
         <!-- 还没加载完:骨架 -->
-        <div v-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
+        <div v-else-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
           <div class="album-hero album-hero-skeleton"></div>
         </div>
 
         <!-- 加载完了确实没有:New-UI 补齐项 -->
         <div v-else-if="notFound" class="empty-state" data-test="album-not-found">
           <div class="empty-state-title">{{ t('photosAlbumNotFoundTitle') }}</div>
           <div class="empty-state-desc">{{ t('photosAlbumNotFoundHint') }}</div>
           <button
             type="button"
             class="bar-btn"
             data-test="album-not-found-back"
             @click="goToAlbumsList"
diff --git a/src/views/PhotosFavorites.vue b/src/views/PhotosFavorites.vue
index 6854299..920c3ed 100644
--- a/src/views/PhotosFavorites.vue
+++ b/src/views/PhotosFavorites.vue
@@ -138,24 +138,32 @@ async function onBatchDelete(ids: Array<string | number>) {
   const count = await store.deleteAssets(ids.map(String))
   toast.show(t('photosDeletedToast', { count }), 4000)
   selected.value = []
   await fav.fetchFavorites()
 }
 
 function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
   // 翻页集 = tab 过滤后的收藏集(与所见一致,和下方 PhotosToolbar 计数同一份数据源/谓词)。
   const filtered = fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
   lb.openAt(photo, filtered, startMs)
 }
 
+// Task 9(P8a,P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见
+// favorites.ts 注释,刻意不变),旧实现下 isEmpty 因此恒假 → 落进下面的 v-else 渲染一个
+// 空网格,没有任何失败提示。新增 loadError 分支(见模板,优先级在 isEmpty 之前)+ 这个重试
+// 入口,直接重新调用同一个 fetch。
+function retryFavorites(): void {
+  void fav.fetchFavorites()
+}
+
 function onExport() {
   fav.exportZip()
   toast.show(t('photosFavExporting'), 4000)
 }
 
 async function onLightboxDelete(id: string | number) {
   // 灯箱已在用户确认删除时自行 close(PhotoLightbox.vue doDelete),这里不重复关闭。
   await store.deleteAssets([String(id)])
   toast.show(t('photosDeletedToast', { count: 1 }), 4000)
   void fav.fetchFavorites()
 }
 
@@ -178,25 +186,33 @@ onMounted(() => {
             @click="onExport"
           >{{ t('photosFavExport') }}</button>
           <button
             type="button"
             class="fav-save-album"
             data-test="fav-save-album-btn"
             :disabled="!(fav.favoritesList?.length)"
             @click="openSaveAlbum"
           >{{ t('photosFavSaveAlbum') }}</button>
           <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesList?.length ?? 0 }) }}</span>
         </div>
 
-        <div v-if="isEmpty" class="empty-state" data-test="fav-empty">
+        <!-- Task 9(P3 遗留收口):失败态优先级在空态之前——loadError 一旦为真,就不该
+             再落进(旧代码里恒假的)isEmpty 分支渲染一个没有任何提示的空网格。 -->
+        <div v-if="fav.loadError" class="empty-state" data-test="fav-load-error">
+          <div class="empty-state-title">{{ t('photosFavoritesLoadFailed') }}</div>
+          <button type="button" class="bar-btn" data-test="fav-retry" @click="retryFavorites">
+            {{ t('photosRetry') }}
+          </button>
+        </div>
+        <div v-else-if="isEmpty" class="empty-state" data-test="fav-empty">
           <div class="empty-state-title">{{ t('photosFavEmptyTitle') }}</div>
           <div class="empty-state-desc">{{ t('photosFavEmptyHint') }}</div>
         </div>
         <template v-else>
           <!-- Task 15A: hero 统计三卡 —— 照 Vue2 PhotosFavoritesView.vue:56-84,只在非空分支渲染
                (Vue2 :47-53/:54 的 v-if/v-else,空态整页走别的分支,三卡不渲染)。 -->
           <div class="fav-stats">
             <div class="fav-stat-card">
               <div class="label">{{ t('photosFavStatTopPerson') }}</div>
               <div class="value">{{ byPerson[0] ? byPerson[0][0] : '—' }}</div>
               <div class="meta">{{ byPerson[0] ? t('photosPeoplePhotosCount', { n: byPerson[0][1] }) : t('photosFavNoFaces') }}</div>
               <div class="fav-stat-bar">
diff --git a/src/views/__tests__/PhotosAlbumDetail.test.ts b/src/views/__tests__/PhotosAlbumDetail.test.ts
index ff1e428..faceaea 100644
--- a/src/views/__tests__/PhotosAlbumDetail.test.ts
+++ b/src/views/__tests__/PhotosAlbumDetail.test.ts
@@ -147,24 +147,76 @@ describe('PhotosAlbumDetail.vue', () => {
     expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('cover-1', 'large')
     const hero = w.find('.album-hero-bg')
     expect(hero.attributes('style')).toContain('mock://thumb/cover-1/large')
   })
 
   it('albumsLoaded=false(还没加载完)→ 渲染加载骨架,不是"相册不存在"', async () => {
     svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
     const { w } = await mountView('999')
     expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
     expect(w.find('[data-test="album-not-found"]').exists()).toBe(false)
   })
 
+  // Task 9(P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释),
+  // 旧实现下 `!album && !albums.albumsLoaded` 恒真 → 永久停在骨架屏。新增 loadError 分支
+  // 必须拦在骨架分支之前。
+  it('相册列表加载失败时渲染失败态而非永久骨架(P4 遗留)', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
+    const { w } = await mountView('7')
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+    expect(w.text()).toContain('相册加载失败')
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
+  })
+
+  // 变异验证挡门用例①:失败态分支若被挪到骨架分支之后,本用例应变红
+  // (loadError=true 时骨架仍会先命中 v-if,失败态永远出不来)。
+  it('失败态优先于骨架态(loadError 真 + albumsLoaded 假 ⇒ 出失败态,不出骨架)', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
+    const { w } = await mountView('999')
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(true)
+    expect(albums.albumsLoaded).toBe(false)
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
+  })
+
+  // 变异验证挡门用例②的姊妹用例:仍在飞行中(未失败)必须继续走骨架态,不能被
+  // loadError 分支误吞——若 loadError 在成功路径也被误置真,这条与上面那条会一起说明
+  // 分支被合并/语义被破坏。
+  it('正在加载(未失败)仍走骨架态,不出失败态', async () => {
+    svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
+    const { w } = await mountView('999')
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(false)
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
+  })
+
+  it('相册失败态的重试按钮重新调 fetchAlbums,成功后失败态消失', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
+    const { w } = await mountView('7')
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(true)
+    const fetchSpy = vi.spyOn(albums, 'fetchAlbums')
+
+    await w.find('[data-test="album-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(albums.loadError).toBe(false)
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
+    expect(w.text()).toContain('Trip')
+  })
+
   it('fetchAlbums 完成后仍找不到该 id → 渲染"相册不存在"+返回按钮,点击返回 /photos/albums', async () => {
     svc.photos.listAlbums.mockResolvedValue([rawAlbum(1, { name: 'Other' })])
     const { w, router } = await mountView('999')
     expect(w.find('[data-test="album-not-found"]').exists()).toBe(true)
     const pushSpy = vi.spyOn(router, 'push')
     await w.find('[data-test="album-not-found-back"]').trigger('click')
     expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
   })
 
   it('资产加载中且无数据 → 渲染 6 个骨架瓦片', async () => {
     svc.photos.getAlbum.mockImplementation(() => new Promise(() => {}))
     const { w } = await mountView('7')
diff --git a/src/views/__tests__/PhotosFavorites.test.ts b/src/views/__tests__/PhotosFavorites.test.ts
index 44a03a6..1206bff 100644
--- a/src/views/__tests__/PhotosFavorites.test.ts
+++ b/src/views/__tests__/PhotosFavorites.test.ts
@@ -96,24 +96,65 @@ afterEach(() => {
 
 describe('PhotosFavorites.vue', () => {
   it('favoritesLoaded 且列表空 → 渲染空态,不渲染 PhotosGrid', async () => {
     const w = await mountView()
     const fav = usePhotosFavorites()
     expect(fav.favoritesLoaded).toBe(true)
     expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
     expect(w.text()).toContain('暂无收藏')
     expect(w.find('.photos-grid-root').exists()).toBe(false)
     expect(w.find('.fav-export').attributes('disabled')).toBeDefined()
   })
 
+  // Task 9(P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见 favorites.ts
+  // 注释),旧实现下 isEmpty 因此恒假 → 落进 v-else 渲染一个空网格,没有任何失败提示。
+  // 新增 loadError 分支必须拦在最前面。
+  it('加载失败时渲染失败态而非空网格(P3 遗留)', async () => {
+    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
+    const w = await mountView()
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+    expect(w.text()).toContain('收藏加载失败')
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
+    expect(w.find('.photos-grid-root').exists()).toBe(false)
+  })
+
+  it('失败态的重试按钮重新调 fetchFavorites,成功后失败态消失', async () => {
+    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
+    const w = await mountView()
+    const fav = usePhotosFavorites()
+    expect(fav.loadError).toBe(true)
+    const fetchSpy = vi.spyOn(fav, 'fetchFavorites')
+
+    svc.photos.listFavorites.mockResolvedValueOnce([photo('a')])
+    await w.find('[data-test="fav-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(fav.loadError).toBe(false)
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
+    expect(w.find('.photos-grid-root').exists()).toBe(true)
+  })
+
+  // 关键区分(brief 明确要求的挡门用例):成功但列表为空 —— 必须仍走空态,不能被
+  // loadError 分支误吞。
+  it('确认为零收藏(成功但列表空)仍走空态,不走失败态', async () => {
+    const w = await mountView()
+    const fav = usePhotosFavorites()
+    expect(fav.loadError).toBe(false)
+    expect(fav.favoritesLoaded).toBe(true)
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
+  })
+
   it('列表非空 → 渲染 PhotosGrid(:months = favoritesMonths),导出按钮启用', async () => {
     svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
     const w = await mountView()
     expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
     expect(w.find('.photos-grid-root').exists()).toBe(true)
     expect(w.findAll('.tile')).toHaveLength(2)
     expect(w.find('.fav-export').attributes('disabled')).toBeUndefined()
   })
 
   it('点导出按钮 → fav.exportZip 被调 + toast', async () => {
     svc.photos.listFavorites.mockResolvedValue([photo('a')])
     const w = await mountView()
```
