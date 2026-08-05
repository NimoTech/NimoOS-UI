# Review package — Task 10 (1fed2bc..da90689)

## Commits
da90689 fix(photos): 杂项收口(P8a-T10)

## Stat
 src/photos/composables/usePersonDetail.ts      |  2 ++
 src/photos/composables/usePlaceAssets.ts       |  5 ++++
 src/photos/stores/__tests__/timeline.test.ts   | 38 ++++++++++++++++++++++++++
 src/photos/stores/timeline.ts                  | 34 +++++++++++++++++++++++
 src/photos/util/__tests__/httpErrors.test.ts   |  7 +++++
 src/photos/util/httpErrors.ts                  | 14 +++++-----
 src/views/Photos.vue                           | 17 +++++++++---
 src/views/PhotosPeople.vue                     |  4 ++-
 src/views/PhotosPersonDetail.vue               |  7 ++++-
 src/views/PhotosPlaceAssets.vue                |  4 +++
 src/views/__tests__/Photos.integration.test.ts | 24 ++++++++++++++++
 src/views/__tests__/PhotosPeople.test.ts       | 19 +++++++++++++
 12 files changed, 162 insertions(+), 13 deletions(-)

## Diff (-U14)
```diff
diff --git a/src/photos/composables/usePersonDetail.ts b/src/photos/composables/usePersonDetail.ts
index cc00045..736e1cd 100644
--- a/src/photos/composables/usePersonDetail.ts
+++ b/src/photos/composables/usePersonDetail.ts
@@ -1,23 +1,25 @@
 // 详情页数据编排。Ported from Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:596(watch)、:728-759(loadPerson/groupByMonth)。
 // 偏离登记 6:Vue2 没有任何竞态守卫,快速连点共现横条/关系图跳转别人时,慢的旧响应会覆盖新页面数据。
 // 这里用 useLightbox.hydrateDetail(useLightbox.ts:100-124)的同款 seq:每次 load 自增,回写前比对,过期直接丢弃。
 import { ref, shallowRef } from 'vue'
 import { service } from '@nimotech/nimoos-service'
 import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
 import { toPerson, monthKeyLabel, type Person } from '../util/peopleView'
 
 // Vue2 :741 硬编码 limit:300 / offset:0,无分页。照搬(改分页是新功能,记账留后续)。
+// P8a-T10 挂账登记(只登记不改):这个 300 上限目前仍是唯一实现,没有"加载更多"/滚动分页——
+// 人物资产超过 300 张时,详情页只会显示前 300 张(与 Vue2 行为一致,不是本次回归)。
 const ASSET_LIMIT = 300
 
 export interface PersonRelation { personId: string | number; name?: string; coverFaceId?: string | number | null; count: number }
 export interface PersonPlace { placeName?: string | null; latitude?: number | null; longitude?: number | null }
 
 // 照 Vue2 groupByMonth :749-759:按 takenAt 的**前 7 位字符串**分桶(不解析 Date),
 // 键降序,'unknown' 桶靠稳定排序挪到末位。
 // 注意:**不复用 util/groupPhotosByMonth.ts** —— 那个用 new Date() 解析后取本地时区的年月,
 // 与字符串切片在跨时区/脏数据上结果不同;人物页保真走 Vue2 的字符串切片。
 export function groupPersonAssets(photos: Photo[]): Month[] {
   const map: Record<string, Photo[]> = {}
   for (const p of photos) {
     const raw = typeof p.takenAt === 'string' ? p.takenAt : ''
     const key = raw ? raw.slice(0, 7) : 'unknown'
diff --git a/src/photos/composables/usePlaceAssets.ts b/src/photos/composables/usePlaceAssets.ts
index ac18de8..d0bc443 100644
--- a/src/photos/composables/usePlaceAssets.ts
+++ b/src/photos/composables/usePlaceAssets.ts
@@ -53,18 +53,23 @@ export function usePlaceAssets(): UsePlaceAssetsReturn {
     } catch (e) {
       if (mine !== seq) return // 过期响应,丢弃(catch 路径)
       console.error('[photos-places] loadPlaceAssets', e)
       // 照 Vue2 _loadPlaceAssets :836-838 的"失败清空",与 store 主数据(fetchPlaces)的
       // "失败保留旧数据"口径刻意不同:这里是「照片」标签页每次打开/切换 spot 都会重新
       // 查询的一次性结果,失败后留着上一个 spot 的照片会让用户误以为看到的是当前 spot 的
       // 内容——比展示空态更具误导性,所以清空。
       photos.value = []
       failed.value = true
     } finally {
       if (mine === seq) loading.value = false
     }
   }
 
+  // P8a-T10 挂账登记(只登记不改):这个 `months` 已经是死导出——唯一消费方
+  // views/PhotosPlaceAssets.vue 在 P7b 加 EXIF 筛选时改成自己对 assets.photos.value 现算
+  // 一份筛选后的 gridMonths(该文件 :130-139 有完整理由),不再读这里的 months。按"禁止无关
+  // 重构"保留这个字段(改接口/删字段不是本次任务范围),但下次改这个组合式函数时不要假设
+  // 它还有消费方——先 grep 一遍确认。
   const months = computed(() => groupPhotosByMonth(photos.value))
 
   return { photos, months, loading, loaded, failed, load }
 }
diff --git a/src/photos/stores/__tests__/timeline.test.ts b/src/photos/stores/__tests__/timeline.test.ts
index e1d92c1..19c4999 100644
--- a/src/photos/stores/__tests__/timeline.test.ts
+++ b/src/photos/stores/__tests__/timeline.test.ts
@@ -233,15 +233,53 @@ describe('photos-timeline store', () => {
   })
 
   it('__resetForTest: 清 timer 且 $reset 状态', async () => {
     const s = useTimelineStore()
     svc.photos.getStatus.mockResolvedValue({ pending: 0, indexed: 0, error: 0, queueLen: 0, totalBytes: 0, galleryDir: '', diskTotal: 0, diskAvail: 0, mlReady: null })
     s.startIndexPoll()
     await Promise.resolve()
     s.ingestTaskBus({ id: 't1', type: 'index', status: 'running' })
     s.__resetForTest()
     expect(s.tasks).toEqual([])
     const callsAfterReset = svc.photos.getStatus.mock.calls.length
     await vi.advanceTimersByTimeAsync(20000)
     expect(svc.photos.getStatus.mock.calls.length).toBe(callsAfterReset)
   })
+
+  // P8a-T10(P1 挂账):照 Vue2 scheduleTaskRemove(store/modules/photos.js:50-58,
+  // _onTaskBus :1388-1402)——非 index 类型的 done 任务 5s 后自动从列表移除。
+  it('ingestTaskBus: 非 index 类型 done 任务 5s 后从列表移除(边界:4999ms 仍在,+2ms 已移除)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
+    expect(s.tasks).toHaveLength(1)
+    vi.advanceTimersByTime(4999)
+    expect(s.tasks).toHaveLength(1)
+    vi.advanceTimersByTime(2)
+    expect(s.tasks).toHaveLength(0)
+  })
+
+  it('ingestTaskBus: index 类型的 done 任务不走 5s 过期(留给 fetchIndexStatus 的 idle 对账)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
+    vi.advanceTimersByTime(5001)
+    expect(s.tasks).toHaveLength(1) // 计时器不管 index,只有 idle 对账才会摘掉它
+  })
+
+  it('ingestTaskBus: done 任务的移除计时器在同 id 再次 running 时取消', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
+    vi.advanceTimersByTime(3000)
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'running', current: 1, total: 10 })
+    vi.advanceTimersByTime(5000) // 若旧计时器没被取消,这里会把复活的任务错误摘掉
+    expect(s.tasks).toHaveLength(1)
+    expect(s.tasks[0]).toMatchObject({ status: 'running' })
+  })
+
+  it('__resetForTest 清掉挂起的 done 移除计时器(不留潜在的跨测试污染)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
+    s.__resetForTest()
+    expect(s.tasks).toEqual([])
+    // 计时器已随 reset 清掉;之后即使继续推进时间也不该抛错或访问已重置的 state。
+    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
+  })
 })
diff --git a/src/photos/stores/timeline.ts b/src/photos/stores/timeline.ts
index 1110ce8..6493680 100644
--- a/src/photos/stores/timeline.ts
+++ b/src/photos/stores/timeline.ts
@@ -40,28 +40,41 @@ function emptyIndexStatus(): IndexStatus {
     queueLen: 0,
     totalBytes: 0,
     galleryDir: '',
     diskTotal: 0,
     diskAvail: 0,
     mlReady: null,
   }
 }
 
 // Module-level poll timer (singleton by design, mirroring the Vue2 module-level
 // _pollTimer): survives across store-instance boundaries within one page
 // lifecycle, so __resetForTest() must clear it explicitly between tests.
 let _pollTimer: ReturnType<typeof setInterval> | null = null
 
+// P8a-T10(P1 挂账):照 Vue2 module-scope taskTimers + scheduleTaskRemove
+// (store/modules/photos.js:8,50-58)——done 任务的延迟移除计时器,按 id 去重(同 id 再次
+// 调度会先清掉旧的)。同样是模块级单例,__resetForTest() 必须显式清掉。
+const _doneRemovalTimers = new Map<string | number, ReturnType<typeof setTimeout>>()
+
+function _cancelDoneRemoval(id: string | number): void {
+  const t = _doneRemovalTimers.get(id)
+  if (t !== undefined) {
+    clearTimeout(t)
+    _doneRemovalTimers.delete(id)
+  }
+}
+
 export const useTimelineStore = defineStore('photos-timeline', () => {
   const timelineGroups = ref<TimelineGroup[]>([])
   const loading = ref(false)
   const indexStatus = ref<IndexStatus>(emptyIndexStatus())
   const tasks = ref<TaskBusPayload[]>([])
 
   const months = computed<Month[]>(() => timelineGroups.value.map(g => groupToMonth(g)))
   const allPhotos = computed(() => months.value.flatMap(m => m.photos))
   const isIndexing = computed(() => indexStatus.value.pending > 0 || indexStatus.value.queueLen > 0)
   const photoCount = computed(() => allPhotos.value.filter(p => !p.isVideo).length)
   const videoCount = computed(() => allPhotos.value.filter(p => p.isVideo).length)
 
   async function fetchTimeline() {
     loading.value = true
@@ -146,28 +159,47 @@ export const useTimelineStore = defineStore('photos-timeline', () => {
       console.warn('[photos-timeline] fetchTasks failed', e)
       tasks.value = []
     }
   }
 
   function ingestTaskBus(evt: unknown) {
     const task = unwrapTaskBusPayload(evt)
     if (!task || !task.id) return
     const idx = tasks.value.findIndex(t => t.id === task.id)
     if (idx >= 0) {
       tasks.value.splice(idx, 1, { ...tasks.value[idx], ...task })
     } else {
       tasks.value.push(task)
     }
+
+    // P8a-T10(P1 挂账,照 Vue2 _onTaskBus store/modules/photos.js:1382-1402):非 index 类型
+    // 的 done 任务 5s 后自动从列表移除;running 事件说明任务复活,取消挂起的移除计时器。
+    // index 类型故意不接这套计时器——它由 fetchIndexStatus 的 idle 对账(:118-120,按后端
+    // pending/queueLen 真实进度收尾)负责摘除,两套机制同时管一种任务类型会变成任务列表的
+    // 第二个真相源(违反"不建第二个任务列表源"的约束)。Vue2 源里 index 其实也会走这个计时器
+    // (只在 face 任务已存在时才改成立即摘除),但 New-UI 早在 timeline.ts 落地 fetchIndexStatus
+    // 时就已经用 idle 对账取代了 index 的收尾路径,这里维持既有分工,不重新引入计时器竞争。
+    if (task.status === 'running') {
+      _cancelDoneRemoval(task.id)
+    } else if (task.status === 'done' && task.type !== 'index') {
+      _cancelDoneRemoval(task.id)
+      const id = task.id
+      const timer = setTimeout(() => {
+        _doneRemovalTimers.delete(id)
+        tasks.value = tasks.value.filter(t => t.id !== id)
+      }, 5000)
+      _doneRemovalTimers.set(id, timer)
+    }
   }
 
   async function deleteAssets(ids: string[]): Promise<number> {
     let successCount = 0
     for (const id of ids) {
       try {
         await service.photos.deleteAsset(id)
         successCount++
       } catch (e) {
         console.error('[photos-timeline] deleteAsset', id, e)
       }
     }
     if (successCount > 0) {
       await refreshTimelineQuiet()
@@ -176,28 +208,30 @@ export const useTimelineStore = defineStore('photos-timeline', () => {
   }
 
   // Pinia setup-stores don't get an automatic $reset() (that's option-store
   // only) — implement our own state reset, mirroring how other setup stores
   // in this codebase would if they needed a test-only teardown hook.
   function resetState() {
     timelineGroups.value = []
     loading.value = false
     indexStatus.value = emptyIndexStatus()
     tasks.value = []
   }
 
   function __resetForTest() {
     stopIndexPoll()
+    for (const t of _doneRemovalTimers.values()) clearTimeout(t)
+    _doneRemovalTimers.clear()
     resetState()
   }
 
   return {
     timelineGroups,
     loading,
     indexStatus,
     tasks,
     months,
     allPhotos,
     isIndexing,
     photoCount,
     videoCount,
     fetchTimeline,
diff --git a/src/photos/util/__tests__/httpErrors.test.ts b/src/photos/util/__tests__/httpErrors.test.ts
index 1e045aa..7dce5f8 100644
--- a/src/photos/util/__tests__/httpErrors.test.ts
+++ b/src/photos/util/__tests__/httpErrors.test.ts
@@ -17,15 +17,22 @@ describe('isConflict', () => {
   it('非 409 错误(如网络错误)→ false', () => {
     expect(isConflict(new Error('network error'))).toBe(false)
   })
 
   it('response.status 非 409 → false', () => {
     const err = Object.assign(new Error('bad request'), { response: { status: 400 } })
     expect(isConflict(err)).toBe(false)
   })
 
   it('非对象/null/undefined → false(不假设异常形状,避免二次抛错)', () => {
     expect(isConflict(null)).toBe(false)
     expect(isConflict(undefined)).toBe(false)
     expect(isConflict('plain string error')).toBe(false)
   })
+
+  it('P8a-T10:词边界对齐 isNotFound —— 不把 4090 / 1409 误判成 409', () => {
+    expect(isConflict(new Error('code 4090'))).toBe(false)
+    expect(isConflict(new Error('req 1409 failed'))).toBe(false)
+    expect(isConflict(new Error('HTTP 409'))).toBe(true)
+    expect(isConflict(Object.assign(new Error('x'), { response: { status: 409 } }))).toBe(true)
+  })
 })
diff --git a/src/photos/util/httpErrors.ts b/src/photos/util/httpErrors.ts
index 6bb713a..d856155 100644
--- a/src/photos/util/httpErrors.ts
+++ b/src/photos/util/httpErrors.ts
@@ -1,35 +1,35 @@
 // 抽自 T5 AlbumPickerDialog.vue(:110-120)与 T7 PhotosAlbums.vue 的逐字重复 409 判定——
 // 相册"创建重名"这个语义在多处新建流程里都会遇到(T5 加入相册面板内联新建、T7 相册列表
 // 新建、T8 详情页改名、T10 收藏存为相册),抽成共享 util 避免三处四处各自维护一份。
 //
 // 判断 409(重名):`e?.response?.status === 409` 或 message 含 409——对未知形状的异常安全,
 // 不假设 e 一定带 response/message,避免二次抛错。message 兜底是 T5 修过的既有行为,原样保留
 // (不是新加的宽松化)。
 export function isConflict(e: unknown): boolean {
   if (!e || typeof e !== 'object') return false
   const response = (e as { response?: unknown }).response
   if (response && typeof response === 'object' && (response as { status?: unknown }).status === 409) {
     return true
   }
   const message = (e as { message?: unknown }).message
-  return /409/.test(String(message ?? ''))
+  return /\b409\b/.test(String(message ?? ''))
 }
 
 // Task 14(SP7-P5 人物):404 判定,与 isConflict 同一套形状容忍策略。
 // 唯一用途是「设为关键照片」——后端用 404 专门表达"这张照片里没有这个人的脸",
 // 需要与其它失败区分成两句不同文案(照 Vue2 PhotosPersonDetail.vue:656-660)。
-// 终审 Minor 14:原注释说"与 isConflict 保持同一风格"是**不实的** —— 两者刻意不同:
-//   isConflict 用裸 /409/(无词边界),isNotFound 用 /\b404\b/(有词边界)。
-// 有边界的这条更严:它不会把 4040 / 1404 / "x-404y" 这类含 404 的字串误判成 404。
-// 方向对的是 isNotFound;isConflict 的宽松是既有行为,收紧它会改变 T5/T7/T8 三处已上线的
-// 「相册重名」判定,超出本期范围 —— 记账留后续,这里只把注释改成如实描述,不动 isConflict。
-// 形状容忍策略(不假设 e 一定带 response/message)两者一致,那部分确实同款。
+// P8a-T10:isConflict 已加词边界(`/\b409\b/`),与本函数的 `/\b404\b/` 对齐——两者都不会把
+// 4090/1409/4040/1404 这类含 409/404 的字串误判成冲突/未找到。回源实测 isConflict 的 live
+// 调用点有 5 处(AlbumPickerDialog.vue:143、PhotosFavorites.vue:114、PhotosAlbumDetail.vue:204、
+// PhotosPersonDetail.vue:484、PhotosAlbums.vue:145),均为「message 兜底」分支的收紧,不影响
+// `response.status === 409` 主判定路径。形状容忍策略(不假设 e 一定带 response/message)两者
+// 一致,那部分确实同款。
 export function isNotFound(e: unknown): boolean {
   if (!e || typeof e !== 'object') return false
   const response = (e as { response?: unknown }).response
   if (response && typeof response === 'object' && (response as { status?: unknown }).status === 404) {
     return true
   }
   const message = (e as { message?: unknown }).message
   return /\b404\b/.test(String(message ?? ''))
 }
diff --git a/src/views/Photos.vue b/src/views/Photos.vue
index e0348b5..f1a78d9 100644
--- a/src/views/Photos.vue
+++ b/src/views/Photos.vue
@@ -146,36 +146,45 @@ function messageFor(task: TaskBusPayload): string | null {
   }
   return t('photosTaskCompletedToast', { label: task.label || task.type || '' })
 }
 
 const doneCoalescer = createTaskDoneCoalescer<TaskBusPayload>({
   messageFor,
   // 4000ms, aligned with Vue2's task-done toast duration (NimoOS-UI
   // src/views/Photos/PhotosTimeline.vue:329 `$buefy.toast.open({..., duration: 4000})`).
   emit: (message) => toast.show(message, 4000),
 })
 
 // Ingest-time done-transition detection: capture whether this task was
 // already 'done' before the store merges the new event in, so a task that
 // stays 'done' across repeated events (or re-ingests) is only announced once.
-// 已知边界——fetchIndexStatus 的 idle 对账会移除 index 任务,若其后迟到重复
-// done 事件会二次 toast;P8 任务条落地时与 scheduleTaskRemove 一并收口。
+// P8a-T10 修:原先用 `store.tasks.find(...).status === 'done'` 判断"是否已经宣布过"——
+// fetchIndexStatus 的 idle 对账(timeline.ts:118-120)会把 done 的 index 任务从
+// store.tasks 里摘掉,若之后又收到一条迟到的重复 done 事件,find 返回 undefined,
+// 旧判断误判成"没宣布过"从而二次 toast。改用一个不依赖任务是否还在列表里的 id 集合:
+// 一旦某个 id 被宣布过就记住,直到它以 running 状态"复活"(同 id 复用于新一轮任务)才
+// 允许再宣布一次——与 store 侧 5s 过期计时器的"running 取消计时器"同一条重置信号。
+const announcedTaskIds = new Set<string | number>()
+
 function onTaskProgress(_props: unknown, raw: unknown) {
   const payload = unwrapTaskBusPayload(raw)
   if (!payload || payload.id == null) return
-  const wasDone = store.tasks.find((task) => task.id === payload.id)?.status === 'done'
+  if (payload.status === 'running') {
+    announcedTaskIds.delete(payload.id)
+  }
   store.ingestTaskBus(raw)
-  if (payload.status === 'done' && !wasDone) {
+  if (payload.status === 'done' && !announcedTaskIds.has(payload.id)) {
+    announcedTaskIds.add(payload.id)
     const merged = store.tasks.find((task) => task.id === payload.id) || payload
     doneCoalescer.push(merged)
   }
 }
 
 // Socket.io reconnects (initial connect too) can miss task.progress events
 // while disconnected; re-sync on every 'connect' (Vue2 PhotosTimeline:78-82).
 function onSocketConnect() {
   void store.fetchTasks()
   void store.fetchIndexStatus()
   void store.fetchTimeline()
 }
 
 const unsubs: Array<() => void> = []
diff --git a/src/views/PhotosPeople.vue b/src/views/PhotosPeople.vue
index e8b6b86..9298812 100644
--- a/src/views/PhotosPeople.vue
+++ b/src/views/PhotosPeople.vue
@@ -321,29 +321,31 @@ async function onSubmitName(name: string): Promise<void> {
 
 // T7 偏离登记(brief 明确要求改的 Vue2 bug,见文件头注释第 8 条):Vue2 confirmMergeTo
 // :654-660 不 await mergeClusterInto、且在发起请求后立刻弹"已合并"成功 toast、再无条件关
 // 弹窗——请求真失败时用户看到的是假成功提示,而且返回的 rejected promise 完全没人处理
 // (未捕获拒绝)。这里改成 await + 只在成功路径弹成功 toast;失败弹 photosPersonMergeFailed;
 // 无论成败都在 finally 关弹窗(照 brief:"finally 关弹窗 + 复位",合并这条不像命名那样让
 // 用户留在弹窗里重试——目标人物是从候选列表里点的,不是打字输入,失败重开菜单重新选更清楚)。
 async function onSubmitMerge(targetId: string | number): Promise<void> {
   if (!dialog.value || mergingSubmitting.value) return
   const fromId = dialog.value.person.id
   const targetName = people.personById(targetId)?.name ?? ''
   mergingSubmitting.value = true
   try {
     await people.mergePersonInto(fromId, targetId)
-    toast.show(t('photosPersonMergedToast', { name: targetName }))
+    // P8a-T10:与上方 confirmMergeTo(:266)同一兜底,目标未命名(或 personById 找不到)时不
+    // 渲染成「已合并到「」」。
+    toast.show(t('photosPersonMergedToast', { name: targetName || t('photosPersonMergeAsSame') }))
   } catch {
     toast.show(t('photosPersonMergeFailed'))
   } finally {
     dialog.value = null
     mergingSubmitting.value = false
   }
 }
 
 // 照 Vue2 confirmDelete :661-674,purgePersonWithUndo 同步返回 undo 闭包(不是 Promise,
 // 不 await)。评审必修 2:这条路径**不需要**独立的 in-flight 守卫 ref——函数体全程无
 // await,一次 dispatchEvent 内跑完;`dialog.value = null` 就是这条路径天然的防重入锁,
 // 两次连点在 Vue 把弹窗从 DOM 摘掉之前的那个同步窗口里都命中同一个按钮时,第二次调用会
 // 在函数体最开头被 `!dialog.value` 挡下(第一次调用已经把它置空)。删码验证见 fix 报告:
 // 曾经这里也仿照命名/合并加过一个 `deletingSubmitting` ref,删掉整段(声明/置位/finally
diff --git a/src/views/PhotosPersonDetail.vue b/src/views/PhotosPersonDetail.vue
index 998d4e8..1e15937 100644
--- a/src/views/PhotosPersonDetail.vue
+++ b/src/views/PhotosPersonDetail.vue
@@ -406,29 +406,34 @@ async function saveHero(assetId: string | number | null): Promise<void> {
 function onUseKeyPhoto(): void { void saveHero(null) }
 function onSaveHero(): void {
   if (heroSelectedId.value == null) return
   void saveHero(heroSelectedId.value)
 }
 
 // 6) 合并到他人(Vue2 confirmMerge :715-727)。
 // 守卫判断:弹窗在 finally 才关(await 之后),在途期间确认按钮可点 —— 守卫有防护价值。
 async function confirmMerge(): Promise<void> {
   const target = mergeTarget.value
   if (!target || !detail.person.value || merging.value) return
   merging.value = true
   try {
     await people.mergePersonInto(personId.value, target.id)
-    toast.show(t('photosPersonMergedToast', { name: target.name }))
+    // P8a-T10:与 PhotosPeople.vue 的合并 toast 同一兜底,目标未命名时不渲染成「已合并到「」」。
+    // 注:mergeCandidates(:184-188)只取 people.named,name.trim() 恒非空(偏离登记 J);
+    // target 又是候选点击时捕获的对象引用,confirm 前的任何 store 写(patchPerson/fetchPeople)
+    // 都是整体替换而非原地改,不会回写到这个引用上——按当前接线这条兜底分支不可达,纯防御性
+    // 补齐(与另外两处保持一致,防未来候选池放开到含未命名时悄悄回归空书名号)。
+    toast.show(t('photosPersonMergedToast', { name: target.name || t('photosPersonMergeAsSame') }))
     void router.push('/photos/people')            // Vue2 是 $emit('back')
   } catch {
     toast.show(t('photosPersonMergeFailed'))      // 偏离登记 H:停在当前页(照 Vue2)
   } finally {
     merging.value = false
     closeMerge()                                  // 成功失败都关(照 Vue2 :726)
   }
 }
 
 // 7) 删除人物(Vue2 confirmDeletePerson :959-972)。
 // 守卫判断:**不需要**独立守卫。purgePersonWithUndo 是同步函数(T2 store:217,返回 undo 闭包
 // 而不是 promise),整条路径没有 await —— 关弹窗发生在同一个同步块内,确认按钮在第二次点击
 // 到来之前就已从 DOM 上消失,加 ref 只是装饰。真实防护机制 = 同步关闭弹窗(有测试钉住)。
 function confirmDeletePerson(): void {
diff --git a/src/views/PhotosPlaceAssets.vue b/src/views/PhotosPlaceAssets.vue
index 7ad2b37..597043b 100644
--- a/src/views/PhotosPlaceAssets.vue
+++ b/src/views/PhotosPlaceAssets.vue
@@ -113,28 +113,32 @@ function showWholeCity(): void {
 // 没有这个 spot key，清掉 spot/lat/lon 三个 query，不弹 toast。
 //
 // 踩坑记录:这里**必须**watch `currentDetail`(它在每次 loadDetail 成功后都会指向一个全新
 // 对象引用——`toPlaceDetail` 每次都 `return { ... }` 新建),而不能直接 watch `matchedSpot`。
 // `matchedSpot` 在"详情还没到位"(currentDetail 为 null)与"详情到位但确实没这个 spot"两种
 // 情形下的值**都是 null**——Vue 的 `watch` 对新旧值做 `hasChanged` 比较,null→null 判定为
 // 未变化,回调根本不会跑,降级就成了死代码(有对应的删码验证用例钉住)。watch 一个"确定会换
 // 新引用"的量,再在回调里读 matchedSpot.value,才能保证"详情从无到有"这一刻必然触发一次判断。
 watch(currentDetail, (d) => {
   if (d && spotKey.value && !matchedSpot.value) showWholeCity()
 })
 
 // ── 结构规格 6:网格 + 灯箱 ────────────────────────────────────────────────────
 // P7b-T5:EXIF 筛选态(同 T4 形状)。D19:只留年份/相机两个胶囊——见上方 import 处注释。
+// P8a-T10 挂账登记(只登记不改):`places` 这个 EXIF 维度在本页从未端到端贯通过——
+// PLACE_CHIP_KEYS 不含 'places' 故 UI 从不渲染/不产出这个胶囊,下面 gridMonths 也只投影
+// years/cameras 两个键给 applyExifFilters(:146-150)。exifFilter.places 恒为 []。P7b 只把
+// cameras 维度接通,places 维度的"未贯通"是本页刻意设计(见下方注释),不是遗漏。
 const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
 const PLACE_CHIP_KEYS = ['years', 'cameras'] as const
 
 // 不改 usePlaceAssets 的 months(那是 P6b 的组件,禁无关重构)——本页自己再算一份筛选后
 // 的月份分组,并丢掉空月份(同 T4 的理由:月份刻度尺读的是未按标签页过滤的 months,这里
 // 同理不读 assets.months.value,自己对 assets.photos.value 先筛再分组)。
 //
 // fix round 1 Minor 1(评审):这里的调用顺序是「先筛后分组」——groupPhotosByMonth
 // (util/groupPhotosByMonth.ts:15-23)的桶是遇到照片才创建,永不产出空桶,所以本页这个
 // `.filter(m => m.photos.length > 0)` 在结构上不可能剔掉任何东西,是防御性死代码。仍然
 // 保留它(brief 明文要求),是为了与 T4(views/Photos.vue,那边 months 来自后端预分桶、
 // 筛选发生在桶内、空月份是真实可能出现的)保持同一套调用惯例口径,不是本页此刻需要的
 // 逻辑保护。
 // fix round(终审 M1):显式投影只喂 years/cameras 两个维度,对齐 Vue2
diff --git a/src/views/__tests__/Photos.integration.test.ts b/src/views/__tests__/Photos.integration.test.ts
index 1befea8..8bc5e3c 100644
--- a/src/views/__tests__/Photos.integration.test.ts
+++ b/src/views/__tests__/Photos.integration.test.ts
@@ -352,28 +352,52 @@ describe('Photos.vue integration', () => {
     await mountPhotos()
     const toast = useToast()
     const showSpy = vi.spyOn(toast, 'show')
 
     const progress = handlerFor('nimoos.photos.task.progress')
     progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
     await vi.advanceTimersByTimeAsync(2600)
     expect(showSpy).toHaveBeenCalledTimes(1)
 
     progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
     await vi.advanceTimersByTimeAsync(2600)
     expect(showSpy).toHaveBeenCalledTimes(1) // 仍是 1 次,未再入队
   })
 
+  // P8a-T10(P1 挂账,onTaskProgress 头部注释记的已知边界):fetchIndexStatus 的 idle 对账会把
+  // done 的 index 任务从 store.tasks 里摘掉;若之后又收到一条迟到的重复 done 事件,旧的
+  // `wasDone = store.tasks.find(...).status === 'done'` 判断因为任务已经不在列表里而失效
+  // (find 返回 undefined),会把这条迟到事件误判成"第一次看到",再次 toast。
+  it('P8a-T10:index 任务被 idle 对账摘除后,迟到的重复 done 事件不二次 toast', async () => {
+    vi.useFakeTimers()
+    await mountPhotos()
+    const store = useTimelineStore()
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+
+    const progress = handlerFor('nimoos.photos.task.progress')
+    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
+    await vi.advanceTimersByTimeAsync(2600)
+    expect(showSpy).toHaveBeenCalledTimes(1)
+
+    // 复现 timeline.ts fetchIndexStatus 的 idle 对账效果(:118-120):直接把这条任务从列表摘掉。
+    store.tasks = store.tasks.filter((t) => t.id !== 't1')
+
+    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
+    await vi.advanceTimersByTimeAsync(2600)
+    expect(showSpy).toHaveBeenCalledTimes(1) // 仍是 1 次——不能因为任务已被摘除就二次宣布
+  })
+
   it('unmount 时取消 coalescer 的挂起计时器与 socket 订阅', async () => {
     vi.useFakeTimers()
     const w = await mountPhotos()
     const toast = useToast()
     const showSpy = vi.spyOn(toast, 'show')
 
     const progress = handlerFor('nimoos.photos.task.progress')
     progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
     w.unmount()
     await vi.advanceTimersByTimeAsync(3000)
     expect(showSpy).not.toHaveBeenCalled()
   })
 
   // P1 时是空 handler;P2(Task 9)起真的接了灯箱 —— 细节(翻页集按 tab 过滤/删除/toast)
diff --git a/src/views/__tests__/PhotosPeople.test.ts b/src/views/__tests__/PhotosPeople.test.ts
index 712be45..b889dcd 100644
--- a/src/views/__tests__/PhotosPeople.test.ts
+++ b/src/views/__tests__/PhotosPeople.test.ts
@@ -612,28 +612,47 @@ describe('PhotosPeople.vue — T7 三态弹窗接线:合并', () => {
   it('重入守卫:连点两次同一候选(第二次在第一次未 resolve 前触发)→ mergePersons 只被调一次', async () => {
     let resolveMerge: (() => void) | undefined
     svc.photos.mergePersons.mockImplementation(() => new Promise((resolve) => { resolveMerge = () => resolve(undefined) }))
     const { w } = await mountView()
     await openMenuDialog(w, 'menu-merge')
     const candidate = w.get('[data-test="cad-candidate"]')
     await candidate.trigger('click')
     await candidate.trigger('click') // 第二次点击在第一次未 resolve 前触发(弹窗此刻仍开着)
     await flushPromises()
 
     expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
     resolveMerge?.()
     await flushPromises()
   })
+
+  // P8a-T10:targetName 之前没有兜底,目标未命名(或 personById 在提交那一刻找不到)时会渲染成
+  // 「已合并到「」」。personById 是即时重查(不是候选点击时捕获的对象),所以可以在点击候选前
+  // 用 patchPerson 把目标改名为空,模拟"确认前名字变空"的防御性场景(不是伪造——真实并发改名/
+  // 数据刷新都会走同一条 personById 重查路径)。
+  it('P8a-T10:目标名字为空 → toast 兜底为"同一个人",不渲染成「已合并到「」」', async () => {
+    const { w } = await mountView()
+    const toast = useToast()
+    const people = usePhotosPeople()
+    await openMenuDialog(w, 'menu-merge')
+    const first = w.get('[data-test="cad-candidate"]')
+    expect(first.attributes('data-id')).toBe('42') // Alice,count 最高排第一
+    people.patchPerson(42, { name: '' })
+    await first.trigger('click')
+    await flushPromises()
+
+    expect(toast.toasts[0]!.text).toBe(`已合并到「${zh.photosPersonMergeAsSame}」`)
+    expect(toast.toasts[0]!.text).not.toMatch(/「」/)
+  })
 })
 
 describe('PhotosPeople.vue — T7 三态弹窗接线:删除', () => {
   it('成功:purgePersonWithUndo 被调 → 弹窗关闭 → toast 带 5000ms 与 undo action', async () => {
     const { w } = await mountView()
     const people = usePhotosPeople()
     const toast = useToast()
     const purgeSpy = vi.spyOn(people, 'purgePersonWithUndo')
     const toastSpy = vi.spyOn(toast, 'show')
     await openMenuDialog(w, 'menu-delete')
     await w.get('[data-test="cad-confirm-delete"]').trigger('click')
 
     expect(purgeSpy).toHaveBeenCalledWith('u1')
     expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
```
