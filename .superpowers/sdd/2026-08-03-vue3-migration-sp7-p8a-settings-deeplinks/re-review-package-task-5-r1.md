# Re-review package — Task 5 fix round 1 (6324470..1537bbe)

## Commits
1537bbe fix(photos): 补 ?section= 停留在本页时的 query-only 滚动路径(review Important 1)

## Stat
 src/views/PhotosSettings.vue               | 39 +++++++++++++++++++-------
 src/views/__tests__/PhotosSettings.test.ts | 45 ++++++++++++++++++++++++++++++
 2 files changed, 74 insertions(+), 10 deletions(-)

## Diff (-U12)
```diff
diff --git a/src/views/PhotosSettings.vue b/src/views/PhotosSettings.vue
index 2e2fb31..909a3be 100644
--- a/src/views/PhotosSettings.vue
+++ b/src/views/PhotosSettings.vue
@@ -26,32 +26,35 @@
   实现记录(非四条强制登记之列,但同样是与源的可见差异,如实记录):toast 只保留文字,
   不渲染 Vue2 `photos-icon :name="toast.icon"` 那个图标——本仓相册区没有 PhotosIcon.vue
   等价物(已 grep 确认零命中),T12 PhotosFilterChip.vue 头注释"偏离登记 1"就是同一结论
   (没有就不建一份迷你 icon 映射表)。本仓全局 toast(AppToast.vue)也是纯文字胶囊、
   没有图标,这里的视觉与本仓既有 toast 保持一致而非重建 Vue2 的图标+紫色配色。
 
   取数分工(接口债务,已与 T3/T4 对齐,详见两卡头注释与 task-5-report.md):
   fetchStorage() 由 PhotosStorageCard 自己在其 onMounted 里调用,本容器**不重复调用**;
   本容器 mounted 时只调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures
   这四个(Vue2 :497-526 的五个取数里去掉 loadStorage,即由子组件承接的那个)。
 
   `?section=` 深链:接的是 route.query.section,值只认 'storage'/'ai'(包含 Vue2
-  `settings=1`"只是打开、不滚动"语义在内的其它任何值,一律忽略、不滚动)。挂载后滚,
-  T6 的「Settings · AI behavior」链接会指向 `/photos/settings?section=ai`。
-  已知限制(不在本任务范围内修,留给 T6 知悉):由于 vue-router 4 对同一路由组件仅
-  query 变化默认不重新 mount,若用户已停留在本页再点一次指向本页、只是 section 不同
-  的链接,onMounted 不会重触发、不会二次滚动——T6 接线该链接时需注意这点。
+  `settings=1`"只是打开、不滚动"语义在内的其它任何值,一律忽略、不滚动)。T6 的
+  「Settings · AI behavior」链接会指向 `/photos/settings?section=ai`。
+  两条路径都处理(评审 Important 1,2026-08-04 补齐):①挂载时(`onMounted` +
+  `nextTick`)②挂载之后 query 才变化时(不带 `immediate` 的 `watch(() =>
+  route.query.section, ...)`)——后者补的是"用户已经停留在本页,手改地址栏 query 或
+  未来某个页面内链接指向本页只是 section 不同"这种 vue-router 4 不会重新 mount 组件
+  的场景。两条路径共用同一个 `scrollToSection`/`isSectionId` 判据,不允许各自维护
+  一份白名单然后漂开。
 -->
 <script setup lang="ts">
-import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
+import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRoute } from 'vue-router'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import PhotosStorageCard from '../photos/components/PhotosStorageCard.vue'
 import PhotosAiCard from '../photos/components/PhotosAiCard.vue'
 import { usePhotosSettingsStore } from '../photos/stores/settings'
 
 interface ToastPayload { icon: string; text: string }
 
 const { t, locale } = useI18n()
 const route = useRoute()
@@ -75,47 +78,63 @@ const librarySinceText = computed(() => {
   } catch {
     return ''
   }
 })
 
 // Vue2 :383-386 —— 找不到目标元素时是 no-op,不抛错(jsdom 无 scrollIntoView 实现,
 // 测试里 spy 掉即可,不需要真的滚动)。
 function scrollTo(id: string): void {
   const el = pageRef.value?.querySelector('#' + id)
   el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
 }
 
+// 白名单只在这一处判定,mounted 路径与"页面已停留、query 变化"路径共用同一个函数,
+// 不允许各自维护一份判据然后慢慢漂开(评审 Important 1 的裁定原话)。
+type SectionId = 'storage' | 'ai'
+function isSectionId(v: unknown): v is SectionId {
+  return v === 'storage' || v === 'ai'
+}
+function scrollToSection(section: unknown): void {
+  if (isSectionId(section)) scrollTo(section)
+}
+
 const toast = ref<ToastPayload | null>(null)
 let toastTimer: ReturnType<typeof setTimeout> | undefined
 
 // Vue2 :487-491 —— 承接两张卡片 @toast 上来的事件;重复触发必须先 clearTimeout 再
 // 重新排定,否则第一条的定时器会提前把第二条 toast 也一并掐掉(变异验证锁住这条)。
 function showToast(payload: ToastPayload): void {
   toast.value = payload
   clearTimeout(toastTimer)
   toastTimer = setTimeout(() => { toast.value = null }, 2800)
 }
 
 onMounted(() => {
   void settings.fetchAbout()
   void settings.fetchRetention()
   void settings.fetchScanInterval()
   void settings.fetchAiFeatures()
 
-  void nextTick(() => {
-    const section = route.query.section
-    if (section === 'storage' || section === 'ai') scrollTo(section)
-  })
+  void nextTick(() => scrollToSection(route.query.section))
 })
 
+// 评审 Important 1(2026-08-04):vue-router 4 对同一路由组件只 query 变化不重新
+// mount——若用户已经停留在本页(比如手改地址栏 query,或未来某个页面内链接指向本页
+// 只是 section 不同),仅靠 onMounted 那一次滚动够不到这种情形。这里补一个不带
+// immediate 的 watch:mounted 时不重复触发(watch 默认不在装配时跑一次),只在挂载
+// *之后* query 真的变化时才滚——与 mounted 路径共用同一个 scrollToSection/isSectionId
+// 判据,不会各自维护一份白名单然后漂开。目标元素(#storage/#ai)是无条件渲染的静态内容,
+// 不随 section 变化增删,故这里不需要像 mounted 路径那样等 nextTick。
+watch(() => route.query.section, (section) => scrollToSection(section))
+
 onUnmounted(() => {
   clearTimeout(toastTimer)
 })
 </script>
 
 <template>
   <AreaShell :title="t('photosSettingsTitle')">
     <div class="photos-layout">
       <PhotosSidebar />
       <main class="photos-main">
         <div ref="pageRef" class="ps-scroll scroll">
           <div class="ps-hero">
diff --git a/src/views/__tests__/PhotosSettings.test.ts b/src/views/__tests__/PhotosSettings.test.ts
index f6bbb48..934999e 100644
--- a/src/views/__tests__/PhotosSettings.test.ts
+++ b/src/views/__tests__/PhotosSettings.test.ts
@@ -55,24 +55,41 @@ async function mountView(path = '/photos/settings') {
   await router.isReady()
   const w = mount(PhotosSettings, {
     global: {
       plugins: [router],
       stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
     },
   })
   await flushPromises()
   await w.vm.$nextTick()
   return w
 }
 
+// 同 mountView,但把 router 一并交回去——评审 Important 1 的两条用例需要在挂载*之后*
+// 再 router.push 同一路由只改 query,验证"用户已经停留在本页"这条路径(watch,不是
+// mounted 那次)。不改 mountView 本身的返回形状,避免动到上面所有既有用例的解构写法。
+async function mountViewWithRouter(path = '/photos/settings') {
+  const router = makeRouter(path)
+  await router.isReady()
+  const w = mount(PhotosSettings, {
+    global: {
+      plugins: [router],
+      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
+    },
+  })
+  await flushPromises()
+  await w.vm.$nextTick()
+  return { w, router }
+}
+
 // jsdom 不实现 scrollIntoView(brief ruling #2)——手动记录调用在哪个元素上,不依赖
 // vitest mock 的 this-context API 版本差异。
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
@@ -175,24 +192,52 @@ describe('PhotosSettings 容器', () => {
   // 不能只靠 scrollCalls 判定:页面里唯一存在的两个 id 就是 storage/ai,任何"非法"取值
   // (如 Vue2 settings=1 场景的字符串 '1')天然查不到元素、scrollIntoView 天然不会被调——
   // 不管白名单守卫在不在都一样,这条不变量单靠 scrollCalls 测不出变异(已实测验证,见
   // task-5-report.md 变异验证记录)。真正要锁住的是"scrollTo(非法值) 有没有被调用过",
   // 用 querySelector 的调用参数直接证明——若白名单被去掉,scrollTo('1') 会被调,进而触发
   // 一次 `querySelector('#1')`,即便查不到元素依然会留下这条调用记录。
   it('?section= 非法值(如 "1",Vue2 里 settings=1 只表示"打开"而非目标 id)时不滚动', async () => {
     await mountView('/photos/settings?section=1')
     expect(scrollCalls).toHaveLength(0)
     expect(queryCalls).not.toContain('#1')
   })
 
+  // 评审 Important 1(2026-08-04):vue-router 4 对同一路由组件只 query 变化不重新
+  // mount——用户已经停留在 /photos/settings(无 section)时,若 query 变成
+  // ?section=ai(手改地址栏,或未来页面内某个指向本页的链接),onMounted 不会重触发,
+  // 必须靠 watch 补上这条路径。
+  it('已停留在本页时 query 才变为 ?section=ai——watch 路径补上滚动(不靠重新 mount)', async () => {
+    const { w, router } = await mountViewWithRouter('/photos/settings')
+    expect(scrollCalls).toHaveLength(0) // mounted 时没有 section,先确认起点确实没滚
+
+    await router.push('/photos/settings?section=ai') // 只改 query,同一路由组件不重新 mount
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#ai').element)
+  })
+
+  // 同一条路径上白名单依旧生效——不能因为补了 watch 就把非法值放过去。
+  it('已停留在本页时 query 才变为 ?section=1(非法值)——watch 路径同样不滚动', async () => {
+    const { w, router } = await mountViewWithRouter('/photos/settings')
+
+    await router.push('/photos/settings?section=1')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(scrollCalls).toHaveLength(0)
+    expect(queryCalls).not.toContain('#1')
+  })
+
   it('页脚:version 缺失时不渲染 "· v" 片段', async () => {
     const store = usePhotosSettingsStore()
     vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
       store.about = { version: '', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
     })
     const w = await mountView()
     expect(w.find('.ps-footer-app').text()).not.toMatch(/·\s*v/)
   })
 
   it('页脚:version 存在时渲染 "· v{version}"', async () => {
     const store = usePhotosSettingsStore()
     vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
```
