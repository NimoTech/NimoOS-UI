# Re-review package — Task 9 fix round 1 (b1f7c2c..1fed2bc)

## Commits
1fed2bc fix(photos): P8a-T9 review fix — retry no longer clears loadError up front

## Stat
 src/photos/stores/__tests__/albums.test.ts    | 16 ++++++++++++
 src/photos/stores/__tests__/favorites.test.ts | 14 +++++++++++
 src/photos/stores/albums.ts                   | 11 +++++++-
 src/photos/stores/favorites.ts                | 14 ++++++++++-
 src/views/PhotosAlbumDetail.vue               | 24 ++++++++++++++----
 src/views/PhotosFavorites.vue                 | 27 ++++++++++++++++----
 src/views/__tests__/PhotosAlbumDetail.test.ts | 18 ++++++++++++++
 src/views/__tests__/PhotosFavorites.test.ts   | 36 +++++++++++++++++++++++++++
 8 files changed, 148 insertions(+), 12 deletions(-)

## Diff (-U14)
```diff
diff --git a/src/photos/stores/__tests__/albums.test.ts b/src/photos/stores/__tests__/albums.test.ts
index 8624126..ac5b573 100644
--- a/src/photos/stores/__tests__/albums.test.ts
+++ b/src/photos/stores/__tests__/albums.test.ts
@@ -64,28 +64,44 @@ describe('photosAlbums store', () => {
       const s = usePhotosAlbums()
       await s.fetchAlbums()
       expect(s.loadError).toBe(true)
       ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 1, name: 'A' }])
       await s.fetchAlbums()
       expect(s.loadError).toBe(false)
       expect(s.albumsLoaded).toBe(true)
       errSpy.mockRestore()
     })
     it('成功路径 loadError 保持假', async () => {
       const s = usePhotosAlbums()
       await s.fetchAlbums()
       expect(s.loadError).toBe(false)
     })
+    // 评审 Important 1 补的挡门用例:重试本身也失败——loadError 必须仍然是真(不能被
+    // "进入重试"这件事本身清空),albums/albumsLoaded 的状态也要与"一次都没成功过"一致。
+    it('reject → retry → reject:结束后 loadError 仍为真,albums/albumsLoaded 与未成功过一致', async () => {
+      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e1'))
+      const s = usePhotosAlbums()
+      await s.fetchAlbums()
+      expect(s.loadError).toBe(true)
+
+      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e2'))
+      await s.fetchAlbums() // 重试,仍失败
+      expect(s.loadError).toBe(true)
+      expect(s.albums).toEqual([])
+      expect(s.albumsLoaded).toBe(false)
+      errSpy.mockRestore()
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
       ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: '2026-01-01T00:00:00Z' }] })
       await s.fetchAlbumAssets(7)
diff --git a/src/photos/stores/__tests__/favorites.test.ts b/src/photos/stores/__tests__/favorites.test.ts
index 5f77b5c..5cf3eff 100644
--- a/src/photos/stores/__tests__/favorites.test.ts
+++ b/src/photos/stores/__tests__/favorites.test.ts
@@ -96,20 +96,34 @@ describe('photosFavorites store', () => {
   it('重试成功后 loadError 归假', async () => {
     ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('network'))
     const s = usePhotosFavorites()
     await s.fetchFavorites()
     expect(s.loadError).toBe(true)
     await s.fetchFavorites() // 重试:这次成功(mockRejectedValueOnce 只吃一次)
     expect(s.loadError).toBe(false)
     expect(s.favoritesLoaded).toBe(true)
   })
   it('成功路径 loadError 保持/归假(不会被残留的上次失败污染)', async () => {
     const s = usePhotosFavorites()
     await s.fetchFavorites()
     expect(s.loadError).toBe(false)
   })
+  // 评审 Important 1 补的挡门用例:重试本身也失败——loadError 必须仍然是真(不能被"进入
+  // 重试"这件事本身清空),favoritesList/favoritesLoaded 的状态也要与"一次都没成功过"一致。
+  it('reject → retry → reject:结束后 loadError 仍为真,favoritesList/favoritesLoaded 与未成功过一致', async () => {
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e1'))
+    const s = usePhotosFavorites()
+    await s.fetchFavorites()
+    expect(s.loadError).toBe(true)
+
+    ;(service.photos.listFavorites as any).mockRejectedValueOnce(new Error('e2'))
+    await s.fetchFavorites() // 重试,仍失败
+    expect(s.loadError).toBe(true)
+    expect(s.favoritesList).toEqual([])
+    expect(s.favoritesLoaded).toBe(false)
+  })
   it('exportZip 走 exportFavoritesUrl', () => {
     const s = usePhotosFavorites()
     s.exportZip()
     expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
   })
 })
diff --git a/src/photos/stores/albums.ts b/src/photos/stores/albums.ts
index 2eb61d6..8056aa3 100644
--- a/src/photos/stores/albums.ts
+++ b/src/photos/stores/albums.ts
@@ -46,34 +46,43 @@ export const usePhotosAlbums = defineStore('photosAlbums', () => {
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
+  // Task 9 correction: `loadError` used to be reset to false at the top of
+  // this function (before the await). That created a window, on every retry
+  // (success *or* failure), where loadError was already false but
+  // albumsLoaded was still false too — i.e. a transient "nothing failed"
+  // reading during a fetch that hasn't settled yet. Clearing loadError only
+  // on confirmed success means the failure UI stays continuously visible
+  // from the first failure until a retry actually succeeds — no window
+  // where a consumer can observe "not failed, not loaded" and draw the
+  // wrong conclusion.
   async function fetchAlbums(): Promise<void> {
-    loadError.value = false
     try {
       const res = (await service.photos.listAlbums()) as unknown[]
       albums.value = ((res ?? []) as RawAlbum[])
       albumsLoaded.value = true // 仅成功路径
+      loadError.value = false
     } catch (e) {
       loadError.value = true
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
diff --git a/src/photos/stores/favorites.ts b/src/photos/stores/favorites.ts
index ead9560..a9e55e1 100644
--- a/src/photos/stores/favorites.ts
+++ b/src/photos/stores/favorites.ts
@@ -32,37 +32,49 @@ export const usePhotosFavorites = defineStore('photosFavorites', () => {
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
-    loadError.value = false
+    // Task 9 correction: `loadError` used to be reset to false at the top of
+    // this function (before the await), mirroring the "reset before attempt"
+    // instruction this task started with. That was wrong: it created a
+    // window, on every retry (success *or* failure), where loadError was
+    // false but favoritesLoaded was still false too — and the Favorites view
+    // has no dedicated "loading" branch, so during that window it fell
+    // through to the v-else branch and rendered an empty grid, transiently
+    // reproducing the exact P3 defect this task exists to fix. Clearing
+    // loadError only on confirmed success means the failure UI stays
+    // continuously visible from the first failure until a retry actually
+    // succeeds — no window where the view can fall through to the wrong
+    // branch.
     try {
       const list = (await service.photos.listFavorites()) as unknown[]
       favoritesList.value = (list ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
       // Only mark loaded on success — a transient fetch failure must stay
       // distinguishable from "confirmed zero favorites", otherwise consumers
       // gating a refetch on `!favoritesLoaded` (e.g. the Favorites view) would
       // permanently mask real favorites behind an empty state.
       favoritesLoaded.value = true
+      loadError.value = false
     } catch (e) {
       favoritesList.value = []
       loadError.value = true
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
diff --git a/src/views/PhotosAlbumDetail.vue b/src/views/PhotosAlbumDetail.vue
index 73e41ba..8f5ea13 100644
--- a/src/views/PhotosAlbumDetail.vue
+++ b/src/views/PhotosAlbumDetail.vue
@@ -208,30 +208,40 @@ async function commitTitle(): Promise<void> {
   }
 }
 
 // Minor 修正:同 PhotosAlbums.vue:85-87 的具名函数写法,把导航调用从模板内联表达式挪出来——
 // 模板里内联 `@click="router.push(...)"` 会把返回的 promise 挂在事件处理器上不管,导航被
 // 取消/重复时 reject 没人接住(vue-router 的已知坑,console 会打未捕获 rejection);这里额外
 // 加 `void` 显式标记"不关心其 resolve/reject"。
 function goToAlbumsList(): void {
   void router.push('/photos/albums')
 }
 
 // Task 9(P8a,P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释,
 // 刻意不变),旧实现下 `!album && !albums.albumsLoaded` 因此恒真 → 永久停在骨架屏。新增
 // loadError 分支(见模板,优先级在骨架分支之前)+ 这个重试入口,直接重新调用同一个 fetch。
-function retryAlbums(): void {
-  void albums.fetchAlbums()
+// 评审 Important 1 修正:本地 retrying 守卫——fetchAlbums 只在成功时才清 loadError
+// (见 albums.ts 同批修正注释),所以按钮本身不再需要靠"清空态"给用户即时反馈;这个 ref
+// 补上这份反馈(disabled),同时顺带堵住连点两次重试派发两个并发 fetch 的口子。
+const retryingAlbums = ref(false)
+async function retryAlbums(): Promise<void> {
+  if (retryingAlbums.value) return
+  retryingAlbums.value = true
+  try {
+    await albums.fetchAlbums()
+  } finally {
+    retryingAlbums.value = false
+  }
 }
 
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
@@ -354,31 +364,35 @@ watch(gridRef, () => {
   void nextTick(() => drag.refresh())
 })
 </script>
 
 <template>
   <AreaShell :title="album ? album.title : t('photosAlbumsTitle')">
     <div class="photos-layout">
       <PhotosSidebar />
       <main class="photos-main">
         <!-- Task 9(P4 遗留收口):失败态优先级在骨架分支之前——loadError 一旦为真,
              albumsLoaded 仍是假(刻意,见 albums.ts 注释),不该再落进骨架分支永久显示
              "正在加载"。 -->
         <div v-if="albums.loadError" class="empty-state" data-test="album-load-error">
           <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
-          <button type="button" class="bar-btn" data-test="album-retry" @click="retryAlbums">
-            {{ t('photosRetry') }}
-          </button>
+          <button
+            type="button"
+            class="bar-btn"
+            data-test="album-retry"
+            :disabled="retryingAlbums"
+            @click="retryAlbums"
+          >{{ t('photosRetry') }}</button>
         </div>
 
         <!-- 还没加载完:骨架 -->
         <div v-else-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
           <div class="album-hero album-hero-skeleton"></div>
         </div>
 
         <!-- 加载完了确实没有:New-UI 补齐项 -->
         <div v-else-if="notFound" class="empty-state" data-test="album-not-found">
           <div class="empty-state-title">{{ t('photosAlbumNotFoundTitle') }}</div>
           <div class="empty-state-desc">{{ t('photosAlbumNotFoundHint') }}</div>
           <button
             type="button"
             class="bar-btn"
diff --git a/src/views/PhotosFavorites.vue b/src/views/PhotosFavorites.vue
index 920c3ed..aa7eba9 100644
--- a/src/views/PhotosFavorites.vue
+++ b/src/views/PhotosFavorites.vue
@@ -140,30 +140,40 @@ async function onBatchDelete(ids: Array<string | number>) {
   selected.value = []
   await fav.fetchFavorites()
 }
 
 function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
   // 翻页集 = tab 过滤后的收藏集(与所见一致,和下方 PhotosToolbar 计数同一份数据源/谓词)。
   const filtered = fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
   lb.openAt(photo, filtered, startMs)
 }
 
 // Task 9(P8a,P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见
 // favorites.ts 注释,刻意不变),旧实现下 isEmpty 因此恒假 → 落进下面的 v-else 渲染一个
 // 空网格,没有任何失败提示。新增 loadError 分支(见模板,优先级在 isEmpty 之前)+ 这个重试
 // 入口,直接重新调用同一个 fetch。
-function retryFavorites(): void {
-  void fav.fetchFavorites()
+// 评审 Important 1 修正:本地 retrying 守卫——fetchFavorites 只在成功时才清 loadError
+// (见 favorites.ts 同批修正注释),所以按钮本身不再需要靠"清空态"给用户即时反馈;这个
+// ref 补上这份反馈(disabled),同时顺带堵住连点两次重试派发两个并发 fetch 的口子。
+const retryingFavorites = ref(false)
+async function retryFavorites(): Promise<void> {
+  if (retryingFavorites.value) return
+  retryingFavorites.value = true
+  try {
+    await fav.fetchFavorites()
+  } finally {
+    retryingFavorites.value = false
+  }
 }
 
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
 
@@ -188,31 +198,35 @@ onMounted(() => {
           <button
             type="button"
             class="fav-save-album"
             data-test="fav-save-album-btn"
             :disabled="!(fav.favoritesList?.length)"
             @click="openSaveAlbum"
           >{{ t('photosFavSaveAlbum') }}</button>
           <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesList?.length ?? 0 }) }}</span>
         </div>
 
         <!-- Task 9(P3 遗留收口):失败态优先级在空态之前——loadError 一旦为真,就不该
              再落进(旧代码里恒假的)isEmpty 分支渲染一个没有任何提示的空网格。 -->
         <div v-if="fav.loadError" class="empty-state" data-test="fav-load-error">
           <div class="empty-state-title">{{ t('photosFavoritesLoadFailed') }}</div>
-          <button type="button" class="bar-btn" data-test="fav-retry" @click="retryFavorites">
-            {{ t('photosRetry') }}
-          </button>
+          <button
+            type="button"
+            class="bar-btn"
+            data-test="fav-retry"
+            :disabled="retryingFavorites"
+            @click="retryFavorites"
+          >{{ t('photosRetry') }}</button>
         </div>
         <div v-else-if="isEmpty" class="empty-state" data-test="fav-empty">
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
@@ -371,20 +385,23 @@ onMounted(() => {
   width: 100%; height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--chip-border);
   background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13.5px;
 }
 .favsave-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
 .favsave-note { font-size: 11.5px; color: var(--fg-muted); margin-top: 10px; line-height: 1.5; }
 .favsave-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
 .favsave-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
 .favsave-btn-ghost:hover { background: var(--chip-bg-hi); }
 .favsave-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
 .favsave-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }
 
 .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
 .empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
 .empty-state-desc { font-size: 13px; }
+/* 评审 Take-along:与 PhotosAlbumDetail.vue 的同款失败态间距对齐(该文件 .empty-state
+   .bar-btn 已有此规则),否则两个失败屏视觉不一致。 */
+.empty-state .bar-btn { margin-top: 10px; }
 
 /* ≤768px:侧栏已收抽屉(PhotosSidebar.is-drawer 脱离文档流),布局单列 */
 @media (max-width: 768px) {
   .photos-layout { gap: 0; }
 }
 </style>
diff --git a/src/views/__tests__/PhotosAlbumDetail.test.ts b/src/views/__tests__/PhotosAlbumDetail.test.ts
index faceaea..9128044 100644
--- a/src/views/__tests__/PhotosAlbumDetail.test.ts
+++ b/src/views/__tests__/PhotosAlbumDetail.test.ts
@@ -180,28 +180,46 @@ describe('PhotosAlbumDetail.vue', () => {
   })
 
   // 变异验证挡门用例②的姊妹用例:仍在飞行中(未失败)必须继续走骨架态,不能被
   // loadError 分支误吞——若 loadError 在成功路径也被误置真,这条与上面那条会一起说明
   // 分支被合并/语义被破坏。
   it('正在加载(未失败)仍走骨架态,不出失败态', async () => {
     svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
     const { w } = await mountView('999')
     const albums = usePhotosAlbums()
     expect(albums.loadError).toBe(false)
     expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
     expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
   })
 
+  // 评审 Important 1 补的挡门用例(这一条才是真正钉住不变量的那条,不是 store 那条):
+  // 重试本身也失败——失败态必须持续可见,不能落回骨架分支(旧实现的 loadError 上来即清
+  // false 会让骨架分支在 albumsLoaded 仍为假时于重试飞行期短暂命中,见 albums.ts 同批
+  // 修正注释)。
+  it('相册失败态重试仍失败(reject→retry→reject)→ 失败态持续可见,不出现骨架', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e1'))
+    const { w } = await mountView('999')
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e2'))
+    await w.find('[data-test="album-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
+    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
+  })
+
   it('相册失败态的重试按钮重新调 fetchAlbums,成功后失败态消失', async () => {
     svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
     const { w } = await mountView('7')
     const albums = usePhotosAlbums()
     expect(albums.loadError).toBe(true)
     const fetchSpy = vi.spyOn(albums, 'fetchAlbums')
 
     await w.find('[data-test="album-retry"]').trigger('click')
     await flushPromises()
     await w.vm.$nextTick()
 
     expect(fetchSpy).toHaveBeenCalled()
     expect(albums.loadError).toBe(false)
     expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
diff --git a/src/views/__tests__/PhotosFavorites.test.ts b/src/views/__tests__/PhotosFavorites.test.ts
index 1206bff..cda24da 100644
--- a/src/views/__tests__/PhotosFavorites.test.ts
+++ b/src/views/__tests__/PhotosFavorites.test.ts
@@ -124,28 +124,64 @@ describe('PhotosFavorites.vue', () => {
     expect(fav.loadError).toBe(true)
     const fetchSpy = vi.spyOn(fav, 'fetchFavorites')
 
     svc.photos.listFavorites.mockResolvedValueOnce([photo('a')])
     await w.find('[data-test="fav-retry"]').trigger('click')
     await flushPromises()
     await w.vm.$nextTick()
 
     expect(fetchSpy).toHaveBeenCalled()
     expect(fav.loadError).toBe(false)
     expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
     expect(w.find('.photos-grid-root').exists()).toBe(true)
   })
 
+  // 评审 Important 1 补的挡门用例(这一条才是真正钉住不变量的那条,不是 store 那条):
+  // 重试本身也失败——失败态必须持续可见,不能出现"清空态再重新失败"的闪烁,更不能在
+  // in-flight 期间落到网格分支(旧实现的 loadError 上来即清 false 会让这里在重试飞行期
+  // 短暂重演 P3 的裸网格症状,见 favorites.ts 同批修正注释)。
+  // 用受控 promise 卡住重试的 in-flight 窗口——如果 loadError 在进入重试时就被提前清空
+  // (评审纠正前的错误设计),这个窗口里 favoritesLoaded 也还是假,isEmpty 因此为假,会
+  // 落进 v-else 渲染裸网格,原样重演 P3 症状。断言必须卡在 flushPromises 之前才能看见
+  // 这个窗口;等 promise resolve/reject 之后再断言只能看到"最终态",看不见过程,抓不住
+  // 这个缺陷(已在变异验证里踩过一次这个坑,记录见 task-9-report.md 附加修复报告)。
+  it('失败态重试仍失败(reject→retry→reject)→ in-flight 期间与结束后失败态都持续可见,不出现网格', async () => {
+    svc.photos.listFavorites.mockRejectedValueOnce(new Error('e1'))
+    const w = await mountView()
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+
+    let rejectRetry: (e: Error) => void = () => {}
+    svc.photos.listFavorites.mockImplementationOnce(
+      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
+    )
+    await w.find('[data-test="fav-retry"]').trigger('click')
+    await w.vm.$nextTick()
+
+    // in-flight:重试还没落定,失败态必须继续可见,不能落到网格分支。
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+    expect(w.find('.photos-grid-root').exists()).toBe(false)
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
+
+    rejectRetry(new Error('e2'))
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    // 落定后(仍失败):失败态持续可见。
+    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
+    expect(w.find('.photos-grid-root').exists()).toBe(false)
+    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
+  })
+
   // 关键区分(brief 明确要求的挡门用例):成功但列表为空 —— 必须仍走空态,不能被
   // loadError 分支误吞。
   it('确认为零收藏(成功但列表空)仍走空态,不走失败态', async () => {
     const w = await mountView()
     const fav = usePhotosFavorites()
     expect(fav.loadError).toBe(false)
     expect(fav.favoritesLoaded).toBe(true)
     expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
     expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
   })
 
   it('列表非空 → 渲染 PhotosGrid(:months = favoritesMonths),导出按钮启用', async () => {
     svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
     const w = await mountView()
```
