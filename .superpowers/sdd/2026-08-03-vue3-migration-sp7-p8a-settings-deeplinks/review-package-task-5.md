# Review package — Task 5 (6a4d426..6324470)

## Commits
6324470 feat(photos): 设置页容器 + /photos/settings 路由 + 侧栏入口(P8a-T5)

## Stat
 src/photos/components/PhotosSidebar.vue            |  19 ++
 .../components/__tests__/PhotosSidebar.test.ts     |  21 ++
 src/router/index.ts                                |   4 +
 src/views/PhotosSettings.vue                       | 182 ++++++++++++++
 src/views/__tests__/PhotosSettings.test.ts         | 263 +++++++++++++++++++++
 5 files changed, 489 insertions(+)

## Diff (-U10)
```diff
diff --git a/src/photos/components/PhotosSidebar.vue b/src/photos/components/PhotosSidebar.vue
index 9021f33..43e103a 100644
--- a/src/photos/components/PhotosSidebar.vue
+++ b/src/photos/components/PhotosSidebar.vue
@@ -72,20 +72,31 @@ const usedPercent = computed(() => {
         </li>
       </ul>
     </section>
     <section class="side-section storage-bar">
       <h4 class="side-title">{{ t('photosStorage') }}</h4>
       <div class="storage-bar-track">
         <div class="storage-bar-fill" :style="{ width: usedPercent + '%' }"></div>
       </div>
       <p class="storage-bar-text">{{ usedText }}</p>
     </section>
+
+    <!-- SP7-P8a-T5:侧栏底部设置入口,照 Vue2 PhotosSidebar.vue:34-35 的齿轮按钮(那边
+         @open-settings 是 emit 给挂着 open prop 的全屏 overlay;本仓是真路由,直接
+         router.push)。不改 NAV 数组/既有导航项顺序——T6 要接的"smart-views 条件隐藏"
+         同样改 NAV,两者互不打扰。 -->
+    <section class="side-section side-settings">
+      <button type="button" class="side-settings-btn" data-test="sidebar-settings-link" @click="router.push('/photos/settings')">
+        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
+        <span class="side-name">{{ t('photosSettingsTitle') }}</span>
+      </button>
+    </section>
   </aside>
 </template>
 
 <style scoped>
 /* 与 FilesSidebar/AppsSidebar 同一壳形态(玻璃面板 + 窄屏抽屉)。token 五件套照抄。 */
 .photos-sidebar {
   flex: 0 0 220px; align-self: stretch; box-sizing: border-box;
   display: flex; flex-direction: column; gap: 18px;
   padding: 14px; overflow-y: auto;
   background: var(--panel-bg); border: 1px solid var(--card-border);
@@ -101,20 +112,28 @@ const usedPercent = computed(() => {
 .side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
 .side-item:hover { background: var(--chip-bg-hi); }
 .side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
 .side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
 
 .storage-bar { margin-top: auto; } /* 存储条压到侧栏底部 */
 .storage-bar-track { height: 6px; border-radius: 999px; background: var(--chip-bg-hi); overflow: hidden; }
 .storage-bar-fill { height: 100%; border-radius: 999px; background: var(--accent); }
 .storage-bar-text { margin: 6px 0 0; font-size: 12px; color: var(--fg-muted, #9aa4bf); }
 
+/* 设置入口:紧跟存储条之后,视觉上处于侧栏最底部。 */
+.side-settings-btn {
+  display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px;
+  padding: 6px 8px; border: none; border-radius: 10px; background: transparent;
+  color: var(--fg); font: inherit; cursor: pointer;
+}
+.side-settings-btn:hover { background: var(--chip-bg-hi); }
+
 .side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
 .photos-sidebar.is-drawer {
   position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
   padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
   border: none; border-right: 1px solid var(--card-border);
   border-radius: 0; box-shadow: none;
   transform: translateX(-105%); transition: transform 0.25s var(--ease);
 }
 .photos-sidebar.is-drawer.is-open { transform: none; }
 @media (prefers-reduced-motion: reduce) { .photos-sidebar.is-drawer { transition: none; } }
diff --git a/src/photos/components/__tests__/PhotosSidebar.test.ts b/src/photos/components/__tests__/PhotosSidebar.test.ts
index 5779293..1c5cad5 100644
--- a/src/photos/components/__tests__/PhotosSidebar.test.ts
+++ b/src/photos/components/__tests__/PhotosSidebar.test.ts
@@ -17,20 +17,22 @@ const testRouter = createRouter({
     { path: '/', name: 'home', component: { template: '<div/>' } },
     { path: '/photos', name: 'photos', component: { template: '<div/>' } },
     { path: '/photos/favorites', name: 'photos-favorites', component: { template: '<div/>' } },
     { path: '/photos/trash', name: 'photos-trash', component: { template: '<div/>' } },
     { path: '/photos/albums', name: 'photos-albums', component: { template: '<div/>' } },
     { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
     { path: '/photos/people', name: 'photos-people', component: { template: '<div/>' } },
     { path: '/photos/people/:id', name: 'photos-person-detail', component: { template: '<div/>' } },
     { path: '/photos/places', name: 'photos-places', component: { template: '<div/>' } },
     { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
+    // SP7-P8a-T5:设置入口的落点(见下方"设置入口"describe)。
+    { path: '/photos/settings', name: 'photos-settings', component: { template: '<div/>' } },
   ],
 })
 
 function mountSidebar() {
   return mount(PhotosSidebar, { global: { plugins: [i18n, testRouter] } })
 }
 
 describe('PhotosSidebar', () => {
   beforeEach(async () => {
     setActivePinia(createPinia())
@@ -229,11 +231,30 @@ describe('PhotosSidebar', () => {
     const d = useSidebarDrawer()
     d.isNarrow.value = true
     d.open.value = true
     mountSidebar()
     await nextTick()
     await testRouter.push('/')
     await flushPromises()
     await nextTick()
     expect(d.open.value).toBe(false)
   })
+
+  // SP7-P8a-T5:侧栏底部设置入口,指向 /photos/settings。不用 .side-item 选择器
+  // (那是 NAV 数组渲染出的既有 7 项,本条目是独立的新元素,故意用不同 class,不与
+  // 上面"7 条导航项"的既有断言互相干扰)。
+  describe('设置入口', () => {
+    it('侧栏底部存在设置入口', () => {
+      const w = mountSidebar()
+      expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
+      // 既有 7 项导航不受影响(不是新插进 NAV 数组的第 8 项)。
+      expect(w.findAll('.side-item')).toHaveLength(7)
+    })
+
+    it('点击设置入口 push 到 /photos/settings', async () => {
+      const w = mountSidebar()
+      await w.get('[data-test="sidebar-settings-link"]').trigger('click')
+      await flushPromises()
+      expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
+    })
+  })
 })
diff --git a/src/router/index.ts b/src/router/index.ts
index b51b9a5..f4ec513 100644
--- a/src/router/index.ts
+++ b/src/router/index.ts
@@ -25,20 +25,21 @@ import PhotosFavorites from '../views/PhotosFavorites.vue'
 import PhotosTrash from '../views/PhotosTrash.vue'
 import PhotosAlbums from '../views/PhotosAlbums.vue'
 import PhotosAlbumDetail from '../views/PhotosAlbumDetail.vue'
 import PhotosPeople from '../views/PhotosPeople.vue'
 import PhotosPersonDetail from '../views/PhotosPersonDetail.vue'
 import PhotosPlaces from '../views/PhotosPlaces.vue'
 import PhotosPlaceAssets from '../views/PhotosPlaceAssets.vue'
 import PhotosSmartViews from '../views/PhotosSmartViews.vue'
 import PhotosSmartViewDetail from '../views/PhotosSmartViewDetail.vue'
 import PhotosSearch from '../views/PhotosSearch.vue'
+import PhotosSettings from '../views/PhotosSettings.vue'
 import { authGuard } from './guard'
 
 const routes: RouteRecordRaw[] = [
   { path: '/', name: 'home', component: Home },
   { path: '/files', name: 'files', component: Files },
   { path: '/files/shares', name: 'files-shares', component: SharesPage },
   { path: '/files/drop', name: 'files-drop', component: DropPage },
   { path: '/apps', name: 'apps', component: InstalledAppsPage },
   { path: '/apps/store', name: 'apps-store', component: StorePage },
   { path: '/apps/store/:id', name: 'apps-store-detail', component: StoreAppDetailPage },
@@ -61,20 +62,23 @@ const routes: RouteRecordRaw[] = [
   { path: '/photos/trash', name: 'photos-trash', component: PhotosTrash },
   { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
   { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
   { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
   { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
   { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
   { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
   { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
   { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
   { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
+  // SP7-P8a-T5:只追加,不重排——须排在最后一条既有 /photos/* 之后(router/index.test.ts
+  // 用 node:fs 读源文本行序断言,而非 router.getRoutes(),见该测试文件注释)。
+  { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
   { path: '/login', name: 'login', component: Login, meta: { public: true } },
   { path: '/welcome', name: 'welcome', component: Welcome, meta: { public: true } },
 ]
 
 export const router = createRouter({
   history: createWebHashHistory('/app/'),
   routes,
 })
 
 // 正常登录逻辑(无探针):见 guard.ts。无 token 时查一次 status 分流 login/welcome。
diff --git a/src/views/PhotosSettings.vue b/src/views/PhotosSettings.vue
new file mode 100644
index 0000000..2e2fb31
--- /dev/null
+++ b/src/views/PhotosSettings.vue
@@ -0,0 +1,182 @@
+<!--
+  SP7-P8a-T5: 设置页容器 —— 把 T3(存储卡)、T4(AI 卡)接成一个真路由页面
+  `/photos/settings`,壳照 PhotosAlbums.vue:184-276 的 AreaShell/.photos-layout/
+  .photos-main 结构复制(该文件头注释已说明这层布局刻意逐视图重复、不抽公共,这里
+  同样不抽)。
+
+  回源坐标:Vue2 PhotosSettings.vue:1-36(壳 + hero + 快速导航)、:194-214(页脚 + toast)、
+  :383-386(scrollTo)、:487-491(showToast,2800ms)、:497-526(mounted 取数)、
+  :527-530(卸载清理)。
+
+  ── 架构偏离登记(四条,均按项目铁律"Vue2 的 bug/结构不照抄,改正确逻辑并注释登记") ──
+  1. Vue2 是 `position:fixed;inset:0;z-index:500` 的全屏 overlay,自带一份
+     `<photos-sidebar>` 与自己的 topbar,靠 `open` prop 开合。New-UI 走真路由 +
+     AreaShell:回主页由 AreaShell 顶栏/PhotosSidebar.side-top 提供,本页只按
+     PhotosAlbums.vue 的既定结构挂**一份** PhotosSidebar(与本区每个 /photos/* 视图
+     一致),不是"AreaShell 自动生成侧栏"——AreaShell.vue 本身没有侧栏概念,这层去重
+     是"整页只有一份 PhotosSidebar 副本"而不是"完全不挂"。测试见下方守卫用例。
+  2. 没有 `open` prop、没有 ESC 关闭、没有 `$emit('close')`——路由页靠浏览器返回键,
+     与本区其它视图一致。因此也没有 Vue2 :497-501/:527-528 的全局 keydown 监听。
+  3. Vue2 的 `themeMixin`/`photosThemeClass`(相册私有明暗主题开关)不迁——台账第二笔,
+     整个迁移期都不做。
+  4. 页脚的「Sign out」不迁(D22)——New-UI 已有全局登出
+     (`src/settings/panels/AccountPanel.vue:167` → `useAuth().logout()`),Vue2 那颗
+     自己手清 4 个 localStorage 键 + 跳 `/logout`,与 New-UI 登出通道不一致。
+
+  实现记录(非四条强制登记之列,但同样是与源的可见差异,如实记录):toast 只保留文字,
+  不渲染 Vue2 `photos-icon :name="toast.icon"` 那个图标——本仓相册区没有 PhotosIcon.vue
+  等价物(已 grep 确认零命中),T12 PhotosFilterChip.vue 头注释"偏离登记 1"就是同一结论
+  (没有就不建一份迷你 icon 映射表)。本仓全局 toast(AppToast.vue)也是纯文字胶囊、
+  没有图标,这里的视觉与本仓既有 toast 保持一致而非重建 Vue2 的图标+紫色配色。
+
+  取数分工(接口债务,已与 T3/T4 对齐,详见两卡头注释与 task-5-report.md):
+  fetchStorage() 由 PhotosStorageCard 自己在其 onMounted 里调用,本容器**不重复调用**;
+  本容器 mounted 时只调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures
+  这四个(Vue2 :497-526 的五个取数里去掉 loadStorage,即由子组件承接的那个)。
+
+  `?section=` 深链:接的是 route.query.section,值只认 'storage'/'ai'(包含 Vue2
+  `settings=1`"只是打开、不滚动"语义在内的其它任何值,一律忽略、不滚动)。挂载后滚,
+  T6 的「Settings · AI behavior」链接会指向 `/photos/settings?section=ai`。
+  已知限制(不在本任务范围内修,留给 T6 知悉):由于 vue-router 4 对同一路由组件仅
+  query 变化默认不重新 mount,若用户已停留在本页再点一次指向本页、只是 section 不同
+  的链接,onMounted 不会重触发、不会二次滚动——T6 接线该链接时需注意这点。
+-->
+<script setup lang="ts">
+import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { useRoute } from 'vue-router'
+import AreaShell from '../components/shell/AreaShell.vue'
+import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
+import PhotosStorageCard from '../photos/components/PhotosStorageCard.vue'
+import PhotosAiCard from '../photos/components/PhotosAiCard.vue'
+import { usePhotosSettingsStore } from '../photos/stores/settings'
+
+interface ToastPayload { icon: string; text: string }
+
+const { t, locale } = useI18n()
+const route = useRoute()
+const settings = usePhotosSettingsStore()
+
+const pageRef = ref<HTMLElement | null>(null)
+
+// Vue2 :302 —— about 取数前兜底 'NAS'。
+const deviceName = computed(() => settings.about?.deviceName || 'NAS')
+
+// Vue2 :352-361,偏离登记同 T4 AI 卡头注释「偏离登记 1」——不传 locale 会跟随系统语言
+// 而非应用内选择的语言。这里显式套用 relTime.ts/PlacesRail.vue 等既有写法转 BCP-47。
+// 与 lastBuiltText(T4)不同:Vue2 :359-361 这里的 catch 分支回落到空字符串而不是原始
+// iso(源本身如此,照搬,不是本条的偏离)。
+const librarySinceText = computed(() => {
+  const iso = settings.about?.librarySince
+  if (!iso) return ''
+  try {
+    const tag = locale.value.replace('_', '-')
+    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
+  } catch {
+    return ''
+  }
+})
+
+// Vue2 :383-386 —— 找不到目标元素时是 no-op,不抛错(jsdom 无 scrollIntoView 实现,
+// 测试里 spy 掉即可,不需要真的滚动)。
+function scrollTo(id: string): void {
+  const el = pageRef.value?.querySelector('#' + id)
+  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
+}
+
+const toast = ref<ToastPayload | null>(null)
+let toastTimer: ReturnType<typeof setTimeout> | undefined
+
+// Vue2 :487-491 —— 承接两张卡片 @toast 上来的事件;重复触发必须先 clearTimeout 再
+// 重新排定,否则第一条的定时器会提前把第二条 toast 也一并掐掉(变异验证锁住这条)。
+function showToast(payload: ToastPayload): void {
+  toast.value = payload
+  clearTimeout(toastTimer)
+  toastTimer = setTimeout(() => { toast.value = null }, 2800)
+}
+
+onMounted(() => {
+  void settings.fetchAbout()
+  void settings.fetchRetention()
+  void settings.fetchScanInterval()
+  void settings.fetchAiFeatures()
+
+  void nextTick(() => {
+    const section = route.query.section
+    if (section === 'storage' || section === 'ai') scrollTo(section)
+  })
+})
+
+onUnmounted(() => {
+  clearTimeout(toastTimer)
+})
+</script>
+
+<template>
+  <AreaShell :title="t('photosSettingsTitle')">
+    <div class="photos-layout">
+      <PhotosSidebar />
+      <main class="photos-main">
+        <div ref="pageRef" class="ps-scroll scroll">
+          <div class="ps-hero">
+            <h1>{{ t('photosSettingsTitle') }}</h1>
+            <p>{{ t('photosSettingsHeroDesc') }}</p>
+            <div class="ps-quicknav">
+              <a href="#storage" @click.prevent="scrollTo('storage')">{{ t('photosSettingsNavStorage') }}</a>
+              <a href="#ai" @click.prevent="scrollTo('ai')">{{ t('photosSettingsNavAi') }}</a>
+            </div>
+          </div>
+
+          <PhotosStorageCard @toast="showToast" />
+          <PhotosAiCard @toast="showToast" />
+
+          <footer class="ps-footer">
+            <div class="ps-footer-app">
+              {{ t('photosSettingsFooterApp') }}<template v-if="settings.about?.version"> &middot; v{{ settings.about.version }}</template>
+            </div>
+            <div class="ps-footer-host">
+              {{ t('photosSettingsRunningOn') }} {{ deviceName }}<template v-if="librarySinceText"> &middot; {{ t('photosSettingsLibrarySince') }} {{ librarySinceText }}</template>
+            </div>
+          </footer>
+        </div>
+      </main>
+    </div>
+  </AreaShell>
+
+  <transition name="ps-toast">
+    <div v-if="toast" class="ps-toast" data-test="settings-toast" role="status" aria-live="polite">{{ toast.text }}</div>
+  </transition>
+</template>
+
+<style scoped>
+.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
+.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
+
+.ps-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 4px 4px 24px; }
+
+.ps-hero h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; color: var(--fg); }
+.ps-hero p { font-size: 13px; color: var(--fg-muted); margin: 0 0 12px; max-width: 640px; }
+.ps-quicknav { display: flex; gap: 16px; }
+.ps-quicknav a { color: var(--accent-text); font-size: 13px; font-weight: 500; text-decoration: none; }
+.ps-quicknav a:hover { text-decoration: underline; }
+
+.ps-footer { display: flex; flex-direction: column; gap: 2px; padding: 12px 4px 4px; }
+.ps-footer-app { font-size: 12.5px; font-weight: 600; color: var(--fg); }
+.ps-footer-host { font-size: 12px; color: var(--fg-muted); }
+
+/* 与本仓全局 toast(AppToast.vue)同一视觉语言(见头注释「实现记录」);z-index 同用
+   1100(AppToast.vue 已注释过理由:必须高于全仓所有模态遮罩,1001 是当前已知最高值)。 */
+.ps-toast {
+  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 1100;
+  padding: 10px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
+  background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px;
+  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur); white-space: nowrap;
+  pointer-events: none;
+}
+.ps-toast-enter-active, .ps-toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
+.ps-toast-enter-from, .ps-toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
+
+@media (max-width: 768px) {
+  .photos-layout { gap: 0; }
+}
+</style>
diff --git a/src/views/__tests__/PhotosSettings.test.ts b/src/views/__tests__/PhotosSettings.test.ts
new file mode 100644
index 0000000..f6bbb48
--- /dev/null
+++ b/src/views/__tests__/PhotosSettings.test.ts
@@ -0,0 +1,263 @@
+// SP7-P8a-T5: PhotosSettings.vue —— 设置页容器,接 T3(存储卡)/T4(AI 卡)+ 真路由
+// `/photos/settings` + 侧栏入口。回源坐标见 task-5-brief.md 头部与组件文件头注释。
+//
+// 两张卡各自已有专属单测(PhotosStorageCard.test.ts/PhotosAiCard.test.ts)覆盖卡内部
+// 逻辑,这里用 global.stubs 顶替成两个最小 stub(各自带 #storage/#ai 锚点 + 一个能
+// emit('toast', ...) 的触发器),只验证容器自己的接线,不重复测卡内部行为——照
+// PhotosSearch.test.ts:1056-1060 的既定 stub 写法。
+//
+// 测试基建偏离登记(brief 与本仓实际不符,以本仓实测为准,详见 task-5-report.md):
+// 1. brief Step1 的守卫用例断言"不挂第二份侧栏"写的是
+//    `wrapper.findComponent(PhotosSidebar).exists()` 应为 false——但 AreaShell.vue 本身
+//    没有侧栏概念(已读源码确认,只有 header/slot),侧栏是每个 /photos/* 视图自己在壳内挂
+//    一份(PhotosAlbums.vue:187 的既定先例,本组件同构照抄)。若真按 `false` 断言,等于要求
+//    本页完全不挂侧栏——那是实打实的 UX 回归(用户进设置页看不到导航),且直接违反本任务
+//    dispatch 明确要求的"照 PhotosAlbums.vue 结构复制"。改为断言"恰好一份"
+//    (`findAllComponents(...).length === 1`),这才是"不重复挂"这条不变量真正要守住的东西。
+// 2. brief Step1 的"挂载时拉齐五项数据"与 Interface Debt 段("你的容器必须且只能调用这四个,
+//    fetchStorage 归 StorageCard 自己")矛盾——本文件以后者为准(更具体、更权威),断言四个
+//    显式 action + 一条"fetchStorage 未被容器调用"的反向锁定(防止日后有人加回去造成双取数)。
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { readFileSync } from 'node:fs'
+import { flushPromises, mount } from '@vue/test-utils'
+import { createPinia, setActivePinia } from 'pinia'
+import { createRouter, createWebHashHistory } from 'vue-router'
+
+vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: {} } }))
+
+import PhotosSettings from '../PhotosSettings.vue'
+import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'
+import { usePhotosSettingsStore } from '../../photos/stores/settings'
+
+const StorageStub = {
+  template:
+    '<section id="storage" data-test="storage-card-stub" @click="$emit(\'toast\', { icon: \'trash\', text: \'toast-from-storage\' })"></section>',
+}
+const AiStub = {
+  template:
+    '<section id="ai" data-test="ai-card-stub" @click="$emit(\'toast\', { icon: \'sparkles\', text: \'toast-from-ai\' })"></section>',
+}
+
+function makeRouter(path: string) {
+  const router = createRouter({
+    history: createWebHashHistory('/app/'),
+    routes: [
+      { path: '/', name: 'home', component: { template: '<div/>' } },
+      { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
+    ],
+  })
+  router.push(path)
+  return router
+}
+
+async function mountView(path = '/photos/settings') {
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
+  return w
+}
+
+// jsdom 不实现 scrollIntoView(brief ruling #2)——手动记录调用在哪个元素上,不依赖
+// vitest mock 的 this-context API 版本差异。
+let scrollCalls: Element[]
+// 同时记录每次 querySelector 的参数字符串——"?section= 非法值不滚动"这条不变量,如果只
+// 靠 scrollIntoView 是否被调来判断会失真:页面里唯一存在的两个 id 就是 storage/ai,任何
+// "非法" 取值(如 Vue2 settings=1 场景的 '1')天然查不到元素,scrollIntoView 不会被调,
+// 不管白名单守卫在不在都一样——这条不变量测不出变异。真正要锁住的是"scrollTo 有没有被
+// 调用过",用 querySelector 的调用参数直接证明,不依赖它是否命中真实元素。另外
+// '#1' 是不合法的 CSS id 选择器(数字开头),jsdom 真实 querySelector 会抛 SyntaxError——
+// 这里转发给真实实现但吞掉该错误,不让它变成未处理的 rejection 污染其它用例。
+let queryCalls: string[]
+beforeEach(() => {
+  localStorage.clear()
+  setActivePinia(createPinia())
+  scrollCalls = []
+  queryCalls = []
+  const realQuerySelector = Element.prototype.querySelector
+  Element.prototype.querySelector = function (this: Element, selectors: string) {
+    queryCalls.push(selectors)
+    try {
+      return realQuerySelector.call(this, selectors)
+    } catch {
+      return null
+    }
+  }
+  Element.prototype.scrollIntoView = function (this: Element) { scrollCalls.push(this) }
+})
+afterEach(() => {
+  // 防御性收尾:若某条用例中途抛错,不让 fake timers 状态漏到下一条用例。
+  vi.useRealTimers()
+  vi.restoreAllMocks()
+})
+
+describe('PhotosSettings 容器', () => {
+  it('挂载时调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures 四项,不重复调用 fetchStorage', async () => {
+    const store = usePhotosSettingsStore()
+    const fetchAbout = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
+    const fetchRetention = vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
+    const fetchScanInterval = vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
+    const fetchAiFeatures = vi.spyOn(store, 'fetchAiFeatures').mockResolvedValue(store.aiFeatures)
+    const fetchStorage = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
+
+    await mountView()
+
+    expect(fetchAbout).toHaveBeenCalledTimes(1)
+    expect(fetchRetention).toHaveBeenCalledTimes(1)
+    expect(fetchScanInterval).toHaveBeenCalledTimes(1)
+    expect(fetchAiFeatures).toHaveBeenCalledTimes(1)
+    expect(fetchStorage).not.toHaveBeenCalled()
+  })
+
+  it('承接卡片的 toast 事件并在 2800ms 后消失', async () => {
+    // 先用真实定时器完成挂载(mountView 内部的 flushPromises 靠 setTimeout(0) 落地,
+    // 若先开 fake timers 会卡死——挂载稳定后才切 fake timers,只接管 toast 计时这一段)。
+    const w = await mountView()
+    vi.useFakeTimers()
+
+    await w.get('[data-test="storage-card-stub"]').trigger('click')
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-storage')
+
+    await vi.advanceTimersByTimeAsync(2799)
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+
+    await vi.advanceTimersByTimeAsync(2)
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
+    vi.useRealTimers()
+  })
+
+  it('连续两次 toast:第二次重置计时,不被第一次的定时器提前掐掉', async () => {
+    const w = await mountView()
+    vi.useFakeTimers()
+
+    await w.get('[data-test="storage-card-stub"]').trigger('click') // t=0,text=toast-from-storage
+    await vi.advanceTimersByTimeAsync(2000) // t=2000,仍在第一条的 2800ms 窗口内
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+
+    await w.get('[data-test="ai-card-stub"]').trigger('click') // t=2000,重置为 text=toast-from-ai
+    await vi.advanceTimersByTimeAsync(800) // t=2800(相对第一条的原计时器到点)
+    // 若 clearTimeout 没生效,第一条的旧定时器会在这一刻把 toast 提前清掉——这里必须仍可见,
+    // 且文本是第二条(证明真的重置了,不是凑巧还没到期)。
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
+    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-ai')
+
+    await vi.advanceTimersByTimeAsync(2000) // t=4800,相对第二条(t=2000 起 2800ms)到点
+    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
+    vi.useRealTimers()
+  })
+
+  it('?section=ai 挂载后滚到 AI 卡', async () => {
+    const w = await mountView('/photos/settings?section=ai')
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#ai').element)
+  })
+
+  it('?section=storage 挂载后滚到存储卡', async () => {
+    const w = await mountView('/photos/settings?section=storage')
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#storage').element)
+  })
+
+  it('?section= 缺失时不滚动', async () => {
+    await mountView('/photos/settings')
+    expect(scrollCalls).toHaveLength(0)
+    expect(queryCalls).not.toContain('#storage')
+    expect(queryCalls).not.toContain('#ai')
+  })
+
+  // 不能只靠 scrollCalls 判定:页面里唯一存在的两个 id 就是 storage/ai,任何"非法"取值
+  // (如 Vue2 settings=1 场景的字符串 '1')天然查不到元素、scrollIntoView 天然不会被调——
+  // 不管白名单守卫在不在都一样,这条不变量单靠 scrollCalls 测不出变异(已实测验证,见
+  // task-5-report.md 变异验证记录)。真正要锁住的是"scrollTo(非法值) 有没有被调用过",
+  // 用 querySelector 的调用参数直接证明——若白名单被去掉,scrollTo('1') 会被调,进而触发
+  // 一次 `querySelector('#1')`,即便查不到元素依然会留下这条调用记录。
+  it('?section= 非法值(如 "1",Vue2 里 settings=1 只表示"打开"而非目标 id)时不滚动', async () => {
+    await mountView('/photos/settings?section=1')
+    expect(scrollCalls).toHaveLength(0)
+    expect(queryCalls).not.toContain('#1')
+  })
+
+  it('页脚:version 缺失时不渲染 "· v" 片段', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    })
+    const w = await mountView()
+    expect(w.find('.ps-footer-app').text()).not.toMatch(/·\s*v/)
+  })
+
+  it('页脚:version 存在时渲染 "· v{version}"', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '2.3.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    })
+    const w = await mountView()
+    expect(w.get('.ps-footer-app').text()).toContain('v2.3.0')
+  })
+
+  it('页脚:librarySince 缺失时整段不渲染', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    })
+    const w = await mountView()
+    expect(w.get('.ps-footer-host').text()).not.toContain('建库于')
+  })
+
+  it('页脚:librarySince 存在时渲染 "· 建库于 {date}"', async () => {
+    const store = usePhotosSettingsStore()
+    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
+      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '2026-01-15T00:00:00Z' }
+    })
+    const w = await mountView()
+    expect(w.get('.ps-footer-host').text()).toContain('建库于')
+  })
+
+  it('页脚:运行于 {deviceName},about 缺失时兜底 NAS', async () => {
+    const w = await mountView()
+    expect(w.get('.ps-footer-host').text()).toContain('运行于')
+    expect(w.get('.ps-footer-host').text()).toContain('NAS')
+  })
+
+  // 架构偏离守卫 1/2(见文件头 + 组件头注释四条登记)。
+  it('侧栏只挂一份(不是"AreaShell 自动生成"、也不是重复挂两份)', async () => {
+    const w = await mountView()
+    expect(w.findAllComponents(PhotosSidebar)).toHaveLength(1)
+  })
+
+  it('不渲染登出入口(D22)', async () => {
+    const w = await mountView()
+    expect(w.text()).not.toMatch(/登出|Sign out/)
+  })
+
+  it('快速导航:点击锚点滚动到对应卡片', async () => {
+    const w = await mountView()
+    await w.get('.ps-quicknav a[href="#ai"]').trigger('click')
+    expect(scrollCalls).toHaveLength(1)
+    expect(scrollCalls[0]).toBe(w.get('#ai').element)
+    await w.get('.ps-quicknav a[href="#storage"]').trigger('click')
+    expect(scrollCalls).toHaveLength(2)
+    expect(scrollCalls[1]).toBe(w.get('#storage').element)
+  })
+})
+
+describe('路由:/photos/settings 只追加,不重排', () => {
+  it('/photos/settings 出现在源文本里最后一条既有 /photos/* 路由(/photos/search)之后', () => {
+    // ⚠️ 用 node:fs 读源文本行序断言,不用 router.getRoutes()——vue-router 4 的
+    // getRoutes() 会把动态段路由排到静态之前(P6b 已查实,global-constraints.md 记录)。
+    const src = readFileSync('src/router/index.ts', 'utf8')
+    expect(src.length).toBeGreaterThan(0)
+    const idxSettings = src.indexOf("'/photos/settings'")
+    const idxSearch = src.indexOf("'/photos/search'")
+    expect(idxSettings).toBeGreaterThan(-1)
+    expect(idxSearch).toBeGreaterThan(-1)
+    expect(idxSettings).toBeGreaterThan(idxSearch)
+  })
+})
```
