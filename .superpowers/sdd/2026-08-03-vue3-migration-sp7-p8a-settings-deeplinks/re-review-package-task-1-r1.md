# Re-review package — Task 1 fix round 1 (df9cc07..46a5590)

## Commits
46a5590 fix(photos): rebuildIndex 409 分支改回 Vue2 权威模式(P8a-T1 review fix)

## Stat
 src/photos/stores/__tests__/settings.test.ts | 49 +++++++++++++++++++++++++---
 src/photos/stores/settings.ts                | 24 +++++++++++---
 2 files changed, 64 insertions(+), 9 deletions(-)

## Diff (-U10)
```diff
diff --git a/src/photos/stores/__tests__/settings.test.ts b/src/photos/stores/__tests__/settings.test.ts
index 1166f0b..bd1bf1d 100644
--- a/src/photos/stores/__tests__/settings.test.ts
+++ b/src/photos/stores/__tests__/settings.test.ts
@@ -13,20 +13,30 @@ vi.mock('@nimotech/nimoos-service', () => ({
       getStorage: vi.fn(),
       getAbout: vi.fn(),
       pruneCache: vi.fn(),
       rebuildIndex: vi.fn(),
       triggerScan: vi.fn(),
       reclusterFaces: vi.fn(),
     },
   },
 }))
 import { service } from '@nimotech/nimoos-service'
+// Cross-store mock idiom follows trash.test.ts's precedent (mock the whole
+// `../timeline` module rather than a real Pinia store instance). Unlike
+// trash.test.ts's fire-and-forget `fetchTimeline`, rebuildIndex's 409 branch
+// actually *reads* `tasks` after calling `fetchTasks()` — so the mock's
+// `fetchTasks` populates `tasks` as a side effect (mirroring the real
+// timeline store's fetchTasks() populating its own `tasks` ref), letting a
+// mutation test that deletes the `await timeline.fetchTasks()` call catch it
+// (tasks would stay empty instead of being populated).
+vi.mock('../timeline', () => ({ useTimelineStore: vi.fn() }))
+import { useTimelineStore } from '../timeline'
 
 describe('photosSettings store · aiFeatures', () => {
   beforeEach(() => {
     setActivePinia(createPinia())
     vi.clearAllMocks()
   })
 
   it('缺字段一律按开启(Vue2 `d.xEnabled !== false` 口径)', async () => {
     vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
     const s = usePhotosSettingsStore()
@@ -217,25 +227,43 @@ describe('photosSettings store · retention & scanInterval 回滚', () => {
 
 describe('photosSettings store · rebuildIndex 的 409 分支', () => {
   beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
 
   it('正常路径返回新 taskId', async () => {
     vi.mocked(service.photos.rebuildIndex).mockResolvedValue({ taskId: 't-1' })
     const s = usePhotosSettingsStore()
     await expect(s.rebuildIndex()).resolves.toBe('t-1')
   })
 
-  it('409 = 已有重建在跑:不抛错,返回运行中那条 rebuild 任务的 id(Vue2 :464-468)', async () => {
+  it('409 = 已有重建在跑:不抛错,调用 timeline.fetchTasks() 刷新一次后返回运行中那条 rebuild 任务的 id(Vue2 :458-473)', async () => {
     vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
+    // fetchTasks 的 mock 实现负责把 tasks 填充为「刷新后」的样子 —— 断言的是 rebuildIndex
+    // 真的调用了 fetchTasks() 才拿到这条任务,而不是提前埋好的静态状态(见文件头注释)。
+    const timeline = { tasks: [] as Array<{ id: string; type: string }>, fetchTasks: vi.fn() }
+    timeline.fetchTasks.mockImplementation(async () => {
+      timeline.tasks = [{ id: 't-running', type: 'rebuild' }]
+    })
+    vi.mocked(useTimelineStore).mockReturnValue(timeline as never)
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).resolves.toBe('t-running')
+    expect(timeline.fetchTasks).toHaveBeenCalledTimes(1)
+  })
+
+  it('409 但刷新后的任务列表里没有 rebuild 类型任务:返回空字符串', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
+    const timeline = { tasks: [] as Array<{ id: string; type: string }>, fetchTasks: vi.fn() }
+    timeline.fetchTasks.mockImplementation(async () => {
+      timeline.tasks = [{ id: 'u-1', type: 'upload' }]
+    })
+    vi.mocked(useTimelineStore).mockReturnValue(timeline as never)
     const s = usePhotosSettingsStore()
-    // 运行中的任务由 timeline store 的 tasks 提供;store 接受一个查找回调避免跨 store 硬依赖
-    await expect(s.rebuildIndex(() => 't-running')).resolves.toBe('t-running')
+    await expect(s.rebuildIndex()).resolves.toBe('')
   })
 
   it('非 409 错误照常抛出', async () => {
     vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 500 } })
     const s = usePhotosSettingsStore()
     await expect(s.rebuildIndex()).rejects.toBeTruthy()
   })
 })
 
 describe('photosSettings store · pruneCache / triggerScan / reclusterFaces', () => {
@@ -288,25 +316,38 @@ describe('photosSettings store · reset', () => {
   beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
 
   it('reset 恢复所有字段到文档默认值', async () => {
     vi.mocked(service.photos.getConfig).mockResolvedValue({
       aiFeatures: { faces: false }, retentionDays: 90, scanInterval: 0,
     })
     vi.mocked(service.photos.getStorage).mockResolvedValue({
       diskTotalBytes: 1, diskFreeBytes: 1, prunableBytes: 1,
       photosBytes: 1, videosBytes: 1, rawBytes: 1, cacheBytes: 1, aiBytes: 1,
     })
+    vi.mocked(service.photos.getAbout).mockResolvedValue({
+      version: '1.0.0', deviceName: 'test-nas', indexCoverage: 42,
+      indexLastBuilt: '2026-01-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
+    })
     const s = usePhotosSettingsStore()
     await s.fetchAiFeatures()
     await s.fetchRetention()
     await s.fetchScanInterval()
-    await s.fetchStorage()
+    await s.fetchStorage() // storage 非空、storageError 假
+    await s.fetchAbout()   // about 非空(修 Minor 3:此前从未取过,断言是空判定平凡真)
+    // storage/storageError 在本店里由同一次 fetchStorage 联动置值,取不到「storage 非空
+    // 且 storageError 为真」同时成立的真实路径 —— 直接写 ref 造一个非默认值,只是为了让
+    // reset() 之后的 storageError 断言不再平凡为真(修 Minor 3),不代表真实调用路径。
+    s.storageError = true
+    // reset 前哨兵:证明下面的 reset() 断言不是从默认值开始的空转
+    expect(s.about).not.toBeNull()
+    expect(s.storage).not.toBeNull()
+    expect(s.storageError).toBe(true)
     s.reset()
     expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
     expect(s.aiFeaturesLoaded).toBe(false)
     expect(s.retentionDays).toBe(30)
     expect(s.scanIntervalMinutes).toBe(1440)
     expect(s.storage).toBeNull()
     expect(s.storageError).toBe(false)
     expect(s.about).toBeNull()
   })
 })
diff --git a/src/photos/stores/settings.ts b/src/photos/stores/settings.ts
index a87067e..5ed3ac2 100644
--- a/src/photos/stores/settings.ts
+++ b/src/photos/stores/settings.ts
@@ -3,34 +3,40 @@
 // (five actions + loadStorage/loadAbout), :500-526 (mounted initial fetches)
 // and store/modules/photos.js:1249-1306 (setAiFaces/setAiFeatures/
 // fetchAiFeatures) + :1413-1438 (fetchTrashRetention/setTrashRetention/
 // fetchScanInterval/setScanInterval).
 //
 // This store is the shared config/storage/about cache for the settings page
 // (Tasks 3-6). It also folds in retention/scanInterval — duplicated on
 // purpose against trash.ts's own fetchRetention/setRetention (that copy
 // stays; the trash view is out of scope here, see task report "concerns").
 //
+// rebuildIndex()'s 409 branch reads timeline.ts's existing `tasks` list (via
+// its fetchTasks() action) rather than taking a caller-supplied lookup
+// callback — see the comment at rebuildIndex() below and the task report's
+// fix-up log for why an earlier revision used a callback instead.
+//
 // IMPORTANT (brief-vs-shared-package discrepancy, resolved in favor of the
 // shared package's actual signature — see task report): the shared package's
 // `updateConfig` is NOT `updateConfig(patch: object)`. Its real signature
 // (.sp7/NimoOS-Service/src/photos.ts:48-62) is positional:
 //   updateConfig(watchDirs: string[], retentionDays?, facesEnabled?, extra?)
 // `watchDirs` is unconditionally included in the request body (no way to
 // omit it), and the backend rejects an empty watchDirs list. Vue2 handles
 // this by re-reading getConfig() immediately before every updateConfig call
 // and re-sending the current watchDirs (setAiFaces :1249-1256, setAiFeatures
 // :1281-1291, setTrashRetention :1419-1425, setScanInterval :1432-1438) —
 // every write in this store follows that same read-then-write shape.
 import { defineStore } from 'pinia'
 import { ref } from 'vue'
 import { service } from '@nimotech/nimoos-service'
+import { useTimelineStore } from './timeline'
 
 export interface PhotosAiFeatures {
   faces: boolean
   scenes: boolean
   ocr: boolean
   smartview: boolean
 }
 
 export interface PhotosStorageInfo {
   diskTotalBytes: number
@@ -201,30 +207,38 @@ export const usePhotosSettingsStore = defineStore('photos-settings', () => {
   }
 
   // 取数失败保守默认(0),失败已 console.error 登记;动作类(pruneCache/triggerScan/
   // reclusterFaces/rebuildIndex 非 409 分支)失败**向上抛**,视图层负责弹 toast,
   // 与 Vue2 各动作方法里 showToast 的位置一致(store 只做数据/回滚,不做 UI 提示)。
   async function pruneCache(): Promise<number> {
     const res = (await service.photos.pruneCache()) as { freedBytes?: number } | null
     return res?.freedBytes ?? 0
   }
 
-  // 409 = 后端已有一个重建在跑。Vue2 :464-468 此时拉一次任务列表、绑定到运行中那条
-  // type==='rebuild' 的任务上继续显示进度,**不报错**。这里用回调注入查找逻辑,避免
-  // settings store 硬依赖 timeline store(任务列表的所有权在 timeline,不复制第二份轮询)。
-  async function rebuildIndex(findRunningId?: () => string | undefined): Promise<string> {
+  // 409 = 后端已有一个重建在跑。Vue2 PhotosSettings.vue:458-473 此时 dispatch 一次
+  // 'photos/fetchTasks'(一次性刷新,不是新轮询)、再在本地任务列表里找
+  // type==='rebuild' 的那条绑定显示进度,**不报错**。这里同样调用 timeline store 现成的
+  // fetchTasks() 一次并读它的 tasks —— "不要另建一份任务轮询" 指的是不要在本 store 里再起
+  // 一个 setInterval/poller,消费 timeline 已有的刷新动作和状态不算违反。useTimelineStore()
+  // 必须在 action 内部调用(而非模块顶层),否则在 Pinia 激活前调用会报错。
+  async function rebuildIndex(): Promise<string> {
     try {
       const res = (await service.photos.rebuildIndex()) as { taskId?: string } | null
       return res?.taskId ?? ''
     } catch (e) {
       const status = (e as { response?: { status?: number } })?.response?.status
-      if (status === 409) return findRunningId?.() ?? ''
+      if (status === 409) {
+        const timeline = useTimelineStore()
+        await timeline.fetchTasks()
+        const running = timeline.tasks.find(t => t.type === 'rebuild')
+        return running?.id != null ? String(running.id) : ''
+      }
       throw e
     }
   }
 
   async function triggerScan(): Promise<boolean> {
     await service.photos.triggerScan()
     return true
   }
 
   async function reclusterFaces(): Promise<boolean> {
```
