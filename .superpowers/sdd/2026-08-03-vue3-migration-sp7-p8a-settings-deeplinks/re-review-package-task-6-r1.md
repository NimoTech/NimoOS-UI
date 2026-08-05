# Re-review package — Task 6 fix round 1 (40bc33e..1da9c2f)

## Commits
1da9c2f test(photos): P8a-T6 review fix — pin network-level aiFeatures dedup + tighten spies

## Stat
 .../components/__tests__/PhotosSidebar.test.ts     | 24 ++++++++++++++++-
 src/views/__tests__/PhotosPeople.test.ts           | 10 ++++++--
 src/views/__tests__/PhotosSettings.test.ts         | 30 +++++++++++++++++++++-
 src/views/__tests__/PhotosSmartViews.test.ts       | 21 +++++++++++++--
 4 files changed, 79 insertions(+), 6 deletions(-)

## Diff (-U12)
```diff
diff --git a/src/photos/components/__tests__/PhotosSidebar.test.ts b/src/photos/components/__tests__/PhotosSidebar.test.ts
index 59c4ea5..8bd7bd3 100644
--- a/src/photos/components/__tests__/PhotosSidebar.test.ts
+++ b/src/photos/components/__tests__/PhotosSidebar.test.ts
@@ -277,31 +277,53 @@ describe('PhotosSidebar', () => {
       const w = mountSidebar()
       await flushPromises()
       await nextTick()
       const items = w.findAll('.side-item')
       expect(items).toHaveLength(6)
       expect(items.some((i) => i.text().includes('智能视图'))).toBe(false)
       // 剩下 6 项仍是原顺序去掉 smart-views 这一条(favorites/trash 紧跟 places)。
       expect(items[3].text()).toContain('地点')
       expect(items[4].text()).toContain('收藏')
       expect(items[5].text()).toContain('最近删除')
     })
 
-    it('smartview 未确定(取数失败)时按开启显示,不吓用户', async () => {
+    // review fix(take-along):原标题「未确定(取数失败)」的外层「未确定」措辞会让人以为
+    // 这条测的是"尚未取到数"(fetch 还在途、还没 resolve)的那个分支——但下面 await
+    // flushPromises() 会先把 reject 结算掉,这里实际只走到了"取数失败"这个 catch 分支
+    // (恰好与初始值同为全 true,视觉上分不出来,但走的是不同代码路径)。标题去掉「未确定」,
+    // 明确写成"失败"。真正的"尚未取到数"分支由下面新增的同步用例补上。
+    it('smartview 请求失败(store 落入 catch 分支)时按开启显示,不吓用户', async () => {
       vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
       const w = mountSidebar()
       await flushPromises()
       await nextTick()
       const items = w.findAll('.side-item')
       expect(items).toHaveLength(7)
       expect(items.some((i) => i.text().includes('智能视图'))).toBe(true)
     })
 
+    // review fix(take-along):补上真正的"尚未取到数"分支——mount 之后不 flushPromises,
+    // fetchAiFeatures() 的 promise 还在途,store 的 aiFeatures 停在初始值(全 true)。
+    // 与上一条(失败分支落回全 true)在数值上恰好相同,但走的是不同代码路径(这里从没进过
+    // catch,是初始 ref 值),补这条才是名副其实的"加载中按开启显示"证明。
+    it('smartview 请求仍在途(尚未 resolve)时按开启显示,同步渲染 7 项', () => {
+      let resolveFn: ((v: Record<string, unknown>) => void) | undefined
+      vi.mocked(service.photos.getConfig).mockImplementation(
+        () => new Promise<Record<string, unknown>>((res) => { resolveFn = res }),
+      )
+      const w = mountSidebar()
+      const items = w.findAll('.side-item')
+      expect(items).toHaveLength(7)
+      expect(items.some((i) => i.text().includes('智能视图'))).toBe(true)
+      // 收尾:把挂起的 promise 结算掉,不让它泄漏到下一条用例。
+      resolveFn?.({})
+    })
+
     it('挂载即调用一次 fetchAiFeatures(经 store 读配置,不直读 getConfig)', async () => {
       const settings = usePhotosSettingsStore()
       const spy = vi.spyOn(settings, 'fetchAiFeatures')
       mountSidebar()
       await flushPromises()
       expect(spy).toHaveBeenCalledTimes(1)
     })
   })
 })
diff --git a/src/views/__tests__/PhotosPeople.test.ts b/src/views/__tests__/PhotosPeople.test.ts
index 0842ae7..712be45 100644
--- a/src/views/__tests__/PhotosPeople.test.ts
+++ b/src/views/__tests__/PhotosPeople.test.ts
@@ -109,29 +109,35 @@ describe('PhotosPeople.vue — 生命周期与分区', () => {
     // 见下一条用例),仍是「一次页面加载只读一次」—— 本页与它挂载的 PhotosSidebar 同帧各调
     // 一次 fetchAiFeatures(),store 内部的在途去重(settings.ts)把两次并发调用合并成
     // 一次真实请求,这条断言同时也是对去重生效的端到端印证。
     expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
   })
 
   // P8a-T6(§7e-10):facesEnabled 折进 photosSettings store,视图不再自己直读 getConfig。
   // брief 给的字面断言 `expect(service.photos.getConfig).not.toHaveBeenCalled()` 与上一条
   // 既有测试互相矛盾(store 的 fetchAiFeatures 内部仍会调 getConfig,mock 是在 service 层,
   // 分不清"视图直读"与"经 store 间接读"——两条断言不可能同时成立)。已在任务报告里登记这处
   // brief-vs-既有测试冲突,改用能真正区分"视图直读 vs 经 store 读"的断言:spy 住 store 的
   // fetchAiFeatures action,证明 onMounted 调的是这个 action 而不是自己再包一层 getConfig。
-  it('facesEnabled 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures)', async () => {
+  // review fix(take-along,收紧断言):原来是 `toHaveBeenCalled()`。收紧前手动验证了真实
+  // 次数——`mountView()` 挂的是完整 `PhotosPeople`(模板里含 `<PhotosSidebar />`,T6 也给
+  // 侧栏接了 fetchAiFeatures),挂载后 spy 记录的是**两次** action 调用(本页自身 + 它挂的
+  // 那份侧栏各一次),不是 1 次——临时改成 `toHaveBeenCalledTimes(1)` 手动跑过,确认会失败
+  // (got 2 times)才定的这个数字。真正的网络级去重证明是上一条既有测试(:104-113,断言
+  // `getConfig` 恰好 1 次、且不 spy action),这条只锁"调的是 store 而不是自己包一层"。
+  it('facesEnabled 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures,含它挂的侧栏共 2 次 action 调用)', async () => {
     const settings = usePhotosSettingsStore()
     const spy = vi.spyOn(settings, 'fetchAiFeatures')
     await mountView()
-    expect(spy).toHaveBeenCalled()
+    expect(spy).toHaveBeenCalledTimes(2)
   })
 
   // ── 评审 Important 2:收藏人物的 accent 内环 ────────────────────────────────
   it('Pinned 头像带 data-fav="true",Named 头像是 "false"(选择器条件的数据来源)', async () => {
     const { w } = await mountView()
     const pinnedAvatar = w.get('[data-test="pinned-card"] .person-avatar')
     expect(pinnedAvatar.attributes('data-fav')).toBe('true')
     for (const card of w.findAll('[data-test="named-card"] .person-avatar')) {
       expect(card.attributes('data-fav')).toBe('false')
     }
   })
 
diff --git a/src/views/__tests__/PhotosSettings.test.ts b/src/views/__tests__/PhotosSettings.test.ts
index d86e6be..2067190 100644
--- a/src/views/__tests__/PhotosSettings.test.ts
+++ b/src/views/__tests__/PhotosSettings.test.ts
@@ -14,28 +14,34 @@
 //    本页完全不挂侧栏——那是实打实的 UX 回归(用户进设置页看不到导航),且直接违反本任务
 //    dispatch 明确要求的"照 PhotosAlbums.vue 结构复制"。改为断言"恰好一份"
 //    (`findAllComponents(...).length === 1`),这才是"不重复挂"这条不变量真正要守住的东西。
 // 2. brief Step1 的"挂载时拉齐五项数据"与 Interface Debt 段("你的容器必须且只能调用这四个,
 //    fetchStorage 归 StorageCard 自己")矛盾——本文件以后者为准(更具体、更权威),断言四个
 //    显式 action + 一条"fetchStorage 未被容器调用"的反向锁定(防止日后有人加回去造成双取数)。
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import { readFileSync } from 'node:fs'
 import { flushPromises, mount } from '@vue/test-utils'
 import { createPinia, setActivePinia } from 'pinia'
 import { createRouter, createWebHashHistory } from 'vue-router'
 
-vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: {} } }))
+// P8a-T6 review fix (Important 1): getConfig 加进 mock——之前是空对象 `photos: {}`,
+// 意味着任何真实(未 spy)的 fetchAiFeatures 调用都会在调用 `service.photos.getConfig()`
+// 时同步抛 TypeError(不是函数),被 fetchAiFeatures 自己的 try/catch 吞掉,行为上凑巧
+// "看起来"正确但完全没有验证到"只发一次真实网络请求"这条不变量——新增的网络级去重用例
+// (见下方 describe)需要一个真的 vi.fn() 才能数调用次数。
+vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: { getConfig: vi.fn() } } }))
 
 import PhotosSettings from '../PhotosSettings.vue'
 import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'
+import { service } from '@nimotech/nimoos-service'
 import { usePhotosSettingsStore } from '../../photos/stores/settings'
 
 const StorageStub = {
   template:
     '<section id="storage" data-test="storage-card-stub" @click="$emit(\'toast\', { icon: \'trash\', text: \'toast-from-storage\' })"></section>',
 }
 const AiStub = {
   template:
     '<section id="ai" data-test="ai-card-stub" @click="$emit(\'toast\', { icon: \'sparkles\', text: \'toast-from-ai\' })"></section>',
 }
 
 function makeRouter(path: string) {
@@ -86,24 +92,25 @@ async function mountViewWithRouter(path = '/photos/settings') {
 let scrollCalls: Element[]
 // 同时记录每次 querySelector 的参数字符串——"?section= 非法值不滚动"这条不变量,如果只
 // 靠 scrollIntoView 是否被调来判断会失真:页面里唯一存在的两个 id 就是 storage/ai,任何
 // "非法" 取值(如 Vue2 settings=1 场景的 '1')天然查不到元素,scrollIntoView 不会被调,
 // 不管白名单守卫在不在都一样——这条不变量测不出变异。真正要锁住的是"scrollTo 有没有被
 // 调用过",用 querySelector 的调用参数直接证明,不依赖它是否命中真实元素。另外
 // '#1' 是不合法的 CSS id 选择器(数字开头),jsdom 真实 querySelector 会抛 SyntaxError——
 // 这里转发给真实实现但吞掉该错误,不让它变成未处理的 rejection 污染其它用例。
 let queryCalls: string[]
 beforeEach(() => {
   localStorage.clear()
   setActivePinia(createPinia())
+  vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
   scrollCalls = []
   queryCalls = []
   const realQuerySelector = Element.prototype.querySelector
   Element.prototype.querySelector = function (this: Element, selectors: string) {
     queryCalls.push(selectors)
     try {
       return realQuerySelector.call(this, selectors)
     } catch {
       return null
     }
   }
   Element.prototype.scrollIntoView = function (this: Element) { scrollCalls.push(this) }
@@ -129,24 +136,45 @@ describe('PhotosSettings 容器', () => {
     expect(fetchRetention).toHaveBeenCalledTimes(1)
     expect(fetchScanInterval).toHaveBeenCalledTimes(1)
     // P8a-T6:本页头部注释(:14-17)自己说了"整页只有一份 PhotosSidebar 副本",而 T6 给
     // PhotosSidebar 也接了 fetchAiFeatures()(§7e-15,侧栏要用 aiFeatures.smartview 决定
     // 是否隐藏智能视图入口)——本页自身 + 它挂载的这一份侧栏,同帧各调一次,是 2 次
     // *action 调用*,不是 2 次网络请求(settings.ts 的在途去重把并发调用合并成 1 次
     // getConfig,见 settings.test.ts 的去重用例)。这条断言从 1 改成 2 是行为的真实变化,
     // 不是放宽断言掩盖回归。
     expect(fetchAiFeatures).toHaveBeenCalledTimes(2)
     expect(fetchStorage).not.toHaveBeenCalled()
   })
 
+  // P8a-T6 review fix (Important 1):上一条用例把 fetchAiFeatures spy 成
+  // `.mockResolvedValue(...)`,店里真正的去重代码(settings.ts 里 `aiFeaturesInFlight` 那段)
+  // 根本没有跑到——那条断言只证明了"本页 + 它挂的侧栏各调了一次 action",证明不了"两次 action
+  // 调用最终只打了一次真实网络请求"。这里不 spy `fetchAiFeatures`,让真实实现跑起来,直接在
+  // HTTP 层(`service.photos.getConfig`,mock 但未替换实现的 vi.fn())数调用次数——这才是
+  // §7e-15 需要的那条不变量:侧栏与页面自身同帧各触发一次 action,必须只落地一次请求。
+  //
+  // fetchRetention/fetchScanInterval 必须单独 spy 掉(mockResolvedValue,不让真实实现跑):
+  // 这两个 action 各自也会调 service.photos.getConfig()(为了拿当前 watchDirs/retentionDays
+  // 随写回一起回传,settings.ts 头部注释里的"读了再写"模式),与 aiFeatures 的去重是两件不
+  // 相关的事——第一次没 spy 它们时手动跑过,得到 3 次调用(去重后的 1 次 aiFeatures + 1 次
+  // fetchRetention + 1 次 fetchScanInterval),不是去重失效,是测试没有把无关的 getConfig
+  // 来源隔离干净。fetchAbout 不碰 getConfig,不需要 spy。
+  it('§7e-15 网络级去重证明:PhotosSettings 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
+    vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
+    await mountView()
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
+  })
+
   it('承接卡片的 toast 事件并在 2800ms 后消失', async () => {
     // 先用真实定时器完成挂载(mountView 内部的 flushPromises 靠 setTimeout(0) 落地,
     // 若先开 fake timers 会卡死——挂载稳定后才切 fake timers,只接管 toast 计时这一段)。
     const w = await mountView()
     vi.useFakeTimers()
 
     await w.get('[data-test="storage-card-stub"]').trigger('click')
     expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
     expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-storage')
 
     await vi.advanceTimersByTimeAsync(2799)
     expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
diff --git a/src/views/__tests__/PhotosSmartViews.test.ts b/src/views/__tests__/PhotosSmartViews.test.ts
index 9f52e3e..e38925b 100644
--- a/src/views/__tests__/PhotosSmartViews.test.ts
+++ b/src/views/__tests__/PhotosSmartViews.test.ts
@@ -101,29 +101,46 @@ beforeEach(() => {
 afterEach(() => {
   usePhotosSmartViews().__resetForTest()
 })
 
 describe('PhotosSmartViews.vue — 拉取', () => {
   it('onMounted 调 store.fetchSmartViews() 一次(即 service.photos.listSmartViews 被调一次)', async () => {
     await mountView()
     expect(svc.photos.listSmartViews).toHaveBeenCalledTimes(1)
   })
 
   // P8a-T6(§7e-10):aiSmartViewOff 折进 photosSettings store,本页不再自己直读 getConfig
   // —— onMounted 走 settings.fetchAiFeatures(),同 PhotosPeople.vue 的收编先例。
-  it('aiSmartViewOff 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures)', async () => {
+  //
+  // review fix(take-along,收紧断言):原来是 `toHaveBeenCalled()`,改紧到
+  // `toHaveBeenCalledTimes(...)` 之前先手动验证了真实次数——`mountView()` 挂的是完整
+  // `PhotosSmartViews`(模板里含 `<PhotosSidebar />`,T6 也给侧栏接了 fetchAiFeatures),
+  // 挂载后 spy 记录的是**两次** action 调用(本页自身 + 它挂的那份侧栏各一次),不是 1 次
+  // ——同 PhotosPeople.test.ts:104-112、PhotosSettings.test.ts 的既有先例(那两处也是 2,
+  // 理由相同)。曾经临时改成 `toHaveBeenCalledTimes(1)` 手动跑过,确认会失败(got 2 times)
+  // 才定的这个数字,不是照抄评审建议的字面值。
+  it('aiSmartViewOff 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures,含它挂的侧栏共 2 次 action 调用)', async () => {
     const settings = usePhotosSettingsStore()
     const spy = vi.spyOn(settings, 'fetchAiFeatures')
     await mountView()
-    expect(spy).toHaveBeenCalled()
+    expect(spy).toHaveBeenCalledTimes(2)
+  })
+
+  // review fix(Important 1):上一条 spy 的是 store 的 action,不是网络层——这里不 spy
+  // fetchAiFeatures,让真实实现跑起来,直接在 HTTP 层(`svc.photos.getConfig`)数调用次数,
+  // 证明"页面自身 + 它挂的侧栏同帧各调一次 action"最终只落地一次真实请求(§7e-15 需要的
+  // 那条不变量,settings.ts 的 aiFeaturesInFlight 去重)。
+  it('§7e-15 网络级去重证明:PhotosSmartViews 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
+    await mountView()
+    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
   })
 })
 
 describe('PhotosSmartViews.vue — 三态渲染', () => {
   it('listLoading && !listLoaded → 渲染骨架,不渲染网格卡片(首帧断言,绕开 flushPromises)', async () => {
     let resolveFn: ((v: unknown[]) => void) | undefined
     svc.photos.listSmartViews.mockImplementation(() => new Promise((res) => { resolveFn = res }))
     const router = makeRouter()
     router.push('/photos/smart-views')
     await router.isReady()
     const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
     // 只 flush 一次 microtask(不 flushPromises):足够让 onMounted 里同步置真的
```
