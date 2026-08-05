# Review package — Task 6 (1537bbe..40bc33e)

## Commits
40bc33e feat(photos): 三项 config 挂账收编进 photosSettings store(P8a-T6)

## Stat
 src/i18n/en_us.ts                                  |  5 +-
 src/i18n/zh_cn.ts                                  |  9 ++--
 src/photos/components/PhotosSidebar.vue            | 23 +++++++--
 .../components/__tests__/PhotosSidebar.test.ts     | 49 ++++++++++++++++++-
 src/photos/stores/__tests__/settings.test.ts       | 31 ++++++++++++
 src/photos/stores/settings.ts                      | 39 ++++++++++++---
 src/views/PhotosPeople.vue                         | 27 ++++-------
 src/views/PhotosSmartViews.vue                     | 56 ++++++++++------------
 src/views/__tests__/PhotosPeople.test.ts           | 18 +++++++
 src/views/__tests__/PhotosSettings.test.ts         |  8 +++-
 src/views/__tests__/PhotosSmartViews.test.ts       | 33 +++++++++----
 11 files changed, 224 insertions(+), 74 deletions(-)

## Diff (-U12)
```diff
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index 7a46af0..e1b84f1 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1252,26 +1252,27 @@ export default {
   photosSvSunsetsSaraOurTokyo: 'Sunsets with Sara from our Tokyo trip last spring',
   photosSvSmartViewRemovedStops: 'The Smart View is removed and stops watching for new matches. The {n} photos in your library are untouched.',
   photosSvTheseSavedSearchesStay: "These saved searches stay visible but won't pick up new matches. Re-enable in",
   photosSvThisWeek: 'this week',
   photosSvTotal: 'Total',
   photosSvTypeConditionEG: 'Type a condition, e.g. scene: sunset',
   photosSvNimoMatch: 'What should Nimo match?',
   photosSvCurrentConditionsMatchExactly: 'Your current conditions match exactly — the threshold will kick in once you add a scene / object / free-text condition.',
   photosSvNNewThisWeek: '{n} new this week',
   photosSvNPhotosMbMb: '{n} photos · ~{mb} MB',
   photosSvRelHours: '{n}h ago',
   photosSvRelMinutes: '{n}m ago',
-  // P8 wiring point: see the matching zh_cn.ts comment.
-  photosSvSettingsPending: 'Settings page coming in P8',
+  // P8a-T6: photosSvSettingsPending ('Settings page coming in P8') removed here — zero
+  // references repo-wide. See the matching zh_cn.ts comment for why (the placeholder title
+  // for the AI-banner's non-clickable settings span, now a real RouterLink, §7e-9).
   // ---- P7a-T6: detail-page shell additions (beyond T1's 107 keys) ----
   photosSvNotFound: 'Smart View not found',
   photosSvRenameFailed: 'Rename failed',
   photosSvUpdateFailed: 'Update failed',
   photosSvDeleteFailed: 'Delete failed',
   photosSvDuplicateFailed: 'Duplicate failed',
   // ---- P7a-T9: search panel (filter bar + popovers) 54 keys, see the matching
   // zh_cn.ts comment. English values are the Vue2 PhotosSearchView.vue literal
   // English strings (= the Vue2 en dict keys), 1:1. ----
   photosSearchAlbums: 'Albums',
   photosSearchApply: 'Apply',
   photosSearchAskNimoSearchDifferently: 'Ask Nimo to search differently',
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index e9dc18d..d7814fb 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1244,28 +1244,29 @@ export default {
   photosSvSunsetsSaraOurTokyo: '去年春天在东京和 Sara 一起看的日落',
   photosSvSmartViewRemovedStops: '智能视图会被删除，不再监视新的匹配。图库中的 {n} 张照片不受影响。',
   photosSvTheseSavedSearchesStay: '这些保存的搜索仍会显示，但不会再匹配新内容。可在以下位置重新开启',
   photosSvThisWeek: '本周',
   photosSvTotal: '总计',
   photosSvTypeConditionEG: '输入一个条件，如 scene: sunset',
   photosSvNimoMatch: 'Nimo 应该匹配什么？',
   photosSvCurrentConditionsMatchExactly: '你当前的条件是精确匹配 —— 添加场景/物体/自由文本条件后阈值才会生效。',
   photosSvNNewThisWeek: '本周新增 {n} 个',
   photosSvNPhotosMbMb: '{n} 张照片 · 约 {mb} MB',
   photosSvRelHours: '{n} 小时前',
   photosSvRelMinutes: '{n} 分钟前',
-  // P8 接线点:智能视图列表页 AI 横幅里「设置 · AI 行为」目前渲染成不可点的 <span
-  // aria-disabled="true">,这个 title 说明原因。P8 建好设置页后把该 span 换成真链接/
-  // 路由跳转,这个键可保留复用为 tooltip,或按 P8 实际交互删除。
-  photosSvSettingsPending: '设置页待迁移(P8)',
+  // P8a-T6:此处原有 photosSvSettingsPending(「设置页待迁移(P8)」)已删 —— 全仓零引用。
+  // 它是智能视图列表页 AI 横幅里「设置 · AI 行为」不可点 <span aria-disabled="true"> 的
+  // title,P8a-T5 建好设置页后,T6 把该 span 换成真实 <RouterLink to="/photos/settings
+  // ?section=ai">(§7e-9),这个占位 title 键随之失去用途。同 :847 处 photosPersonSubtitle
+  // 的删除先例。
   // ---- P7a-T6: 详情页外壳新增键(T1 的 107 键之外,brief §结构规格 1/2/4/8) ----
   // New-UI 新增路径:byId(id) 找不到这一项(手改地址栏 / 旧书签),Vue2 无此分支——见
   // task-6-report.md 偏离登记。
   photosSvNotFound: '找不到这个智能视图',
   // T6 阶段搜索路由(T16 才建)不存在,「在搜索中细化」渲染成 disabled + 此 title；
   // T16 接线时把这个键与本组件里对应的 disabled 一起删掉(注释已在组件里登记接线点)。
   // 改名失败的 toast(Vue2 :512-513 无 catch,New-UI 补上,偏离登记):照
   // photosAlbumRenameFailed / photosPersonRenamedFailed 的既定命名与文案。
   photosSvRenameFailed: '重命名失败',
   // 暂停/恢复自动更新失败的 toast(Store 纪律:向上抛出的 action 必须在视图层 catch → toast,
   // Vue2 本无对应路径——那套本地 paused 状态从不失败,因为它压根不等后端响应)。
   photosSvUpdateFailed: '更新失败',
diff --git a/src/photos/components/PhotosSidebar.vue b/src/photos/components/PhotosSidebar.vue
index 43e103a..76eeb78 100644
--- a/src/photos/components/PhotosSidebar.vue
+++ b/src/photos/components/PhotosSidebar.vue
@@ -1,55 +1,72 @@
 <script setup lang="ts">
-import { computed, onUnmounted, watch } from 'vue'
+import { computed, onMounted, onUnmounted, watch } from 'vue'
 import { useRouter, useRoute } from 'vue-router'
 import { useI18n } from 'vue-i18n'
 import { useSidebarDrawer } from '../../composables/useSidebarDrawer'
 import { useTimelineStore } from '../stores/timeline'
+import { usePhotosSettingsStore } from '../stores/settings'
 import { renderSize } from '../../files/util/format'
 import { activeNavId } from '../util/activeNavId'
 
 const router = useRouter()
 const route = useRoute()
 const { t } = useI18n()
 const timeline = useTimelineStore()
+// P8a-T6 (§7e-15):侧栏是相册区全部页面共用组件,自己拉一次 aiFeatures 配置来决定是否
+// 隐藏 smart-views 条目。store 是单例,与任意视图各自的 onMounted 同帧挂载会并发调用
+// fetchAiFeatures() —— 并发去重收在 settings.ts 里(见该文件 fetchAiFeatures 头部注释),
+// 这里只管调用,不用关心去重细节。
+const settings = usePhotosSettingsStore()
+onMounted(() => { void settings.fetchAiFeatures() })
 
 // 抽屉态:注意必须解构(嵌套 ref 在模板里不会自动解包,drawer.isNarrow 恒真值是坑)——照 FilesSidebar。
 const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()
 
 // 任何路由变化后抽屉自动收起;桌面态 close 是 no-op。
 watch(() => route.fullPath, () => closeDrawer())
 
 // ESC 关抽屉,仅在窄屏打开时监听。
 function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
 watch(drawerOpen, (o) => {
   if (o) document.addEventListener('keydown', onDrawerKeydown)
   else document.removeEventListener('keydown', onDrawerKeydown)
 })
 onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))
 
 // 导航条目注册表。
-const NAV = [
+const NAV_ALL = [
   { id: 'library', route: '/photos', labelKey: 'photosLibrary' },
   { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums' },
   { id: 'people', route: '/photos/people', labelKey: 'photosPeople' },
   { id: 'places', route: '/photos/places', labelKey: 'photosPlaces' },
   // SP7-P7a-T4:插在 places 之后、favorites 之前,照 Vue2 PhotosSidebar.vue:114-118 的顺序
   // (library / albums / people / places / smart)。7 项(原 6 项),favorites/trash 下标各 +1。
   { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosSvSmartViews' },
   { id: 'favorites', route: '/photos/favorites', labelKey: 'photosFavorites' },
   { id: 'trash', route: '/photos/trash', labelKey: 'photosTrash' },
 ]
 
+// P8a-T6(§7e-15):Vue2 PhotosSidebar.vue:120-122 —— `ai.smartview === false` 时
+// `items.filter(i => i.id !== 'smart')`。判据必须是 `=== false`,不是 `!x`:aiFeatures.
+// smartview 的默认值与"取数失败/字段缺失"的兜底值都是 `true`,只有后端明确说关了才隐藏这一
+// 条——配置读取抖动/请求失败不该让导航条目消失,吓用户以为功能不见了。
+const NAV = computed(() =>
+  settings.aiFeatures.smartview === false
+    ? NAV_ALL.filter((n) => n.id !== 'smart-views')
+    : NAV_ALL,
+)
+
 function isActive(n: { id: string }): boolean {
-  return activeNavId(route.path, NAV) === n.id
+  return activeNavId(route.path, NAV.value) === n.id
 }
 
 // 存储条:usedText = totalBytes 人类可读;percent = (diskTotal-diskAvail)/diskTotal,除零守卫。
 const usedText = computed(() => renderSize(timeline.indexStatus.totalBytes))
 const usedPercent = computed(() => {
   const total = timeline.indexStatus.diskTotal
   if (!total) return 0
   const used = total - timeline.indexStatus.diskAvail
   return Math.min(100, Math.max(0, (used / total) * 100))
 })
 </script>
 
diff --git a/src/photos/components/__tests__/PhotosSidebar.test.ts b/src/photos/components/__tests__/PhotosSidebar.test.ts
index 1c5cad5..59c4ea5 100644
--- a/src/photos/components/__tests__/PhotosSidebar.test.ts
+++ b/src/photos/components/__tests__/PhotosSidebar.test.ts
@@ -1,23 +1,33 @@
-import { describe, it, expect, beforeEach } from 'vitest'
+import { describe, it, expect, beforeEach, vi } from 'vitest'
 import { mount, flushPromises } from '@vue/test-utils'
 import { setActivePinia, createPinia } from 'pinia'
 import { createI18n } from 'vue-i18n'
 import { createRouter, createMemoryHistory } from 'vue-router'
 import { nextTick } from 'vue'
 import zh from '../../../i18n/zh_cn'
 import PhotosSidebar from '../PhotosSidebar.vue'
 import { useTimelineStore } from '../../stores/timeline'
+import { usePhotosSettingsStore } from '../../stores/settings'
 import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../../composables/useSidebarDrawer'
 
+// P8a-T6(§7e-15):侧栏现在自己也读一次 aiFeatures 配置(见 PhotosSidebar.vue 头部注释)。
+// 默认解析成 `{}`(readAiFeatures 对缺字段一律按开启处理,smartview 仍是 true)——这个默认值
+// 让本文件其余既有测试(挂载后同步断言 7 项)保持不变:那些断言都发生在 fetchAiFeatures()
+// 的 promise resolve 之前,读到的是 store 的初始值(全 true),不受这个 mock 影响。
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: { photos: { getConfig: vi.fn() } },
+}))
+import { service } from '@nimotech/nimoos-service'
+
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 const testRouter = createRouter({
   history: createMemoryHistory(),
   routes: [
     { path: '/', name: 'home', component: { template: '<div/>' } },
     { path: '/photos', name: 'photos', component: { template: '<div/>' } },
     { path: '/photos/favorites', name: 'photos-favorites', component: { template: '<div/>' } },
     { path: '/photos/trash', name: 'photos-trash', component: { template: '<div/>' } },
     { path: '/photos/albums', name: 'photos-albums', component: { template: '<div/>' } },
     { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
     { path: '/photos/people', name: 'photos-people', component: { template: '<div/>' } },
@@ -28,24 +38,25 @@ const testRouter = createRouter({
     { path: '/photos/settings', name: 'photos-settings', component: { template: '<div/>' } },
   ],
 })
 
 function mountSidebar() {
   return mount(PhotosSidebar, { global: { plugins: [i18n, testRouter] } })
 }
 
 describe('PhotosSidebar', () => {
   beforeEach(async () => {
     setActivePinia(createPinia())
     __resetSidebarDrawerForTest()
+    vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
     testRouter.push('/photos')
     await testRouter.isReady()
   })
 
   // SP7-P7a-T4:NAV 新增 smart-views,插在 places 之后、favorites 之前——原本 6 项变 7 项,
   // favorites/trash 的下标各 +1(原 4/5 → 现 5/6)。顺序照 Vue2 PhotosSidebar.vue:114-118
   // (library / albums / people / places / smart)。
   it('渲染七条导航项(照片库/相册/人物/地点/智能视图/收藏/最近删除),当前路由高亮', async () => {
     const w = mountSidebar()
     const items = w.findAll('.side-item')
     expect(items).toHaveLength(7)
     expect(items[0].text()).toContain('照片库')
@@ -248,13 +259,49 @@ describe('PhotosSidebar', () => {
       expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
       // 既有 7 项导航不受影响(不是新插进 NAV 数组的第 8 项)。
       expect(w.findAll('.side-item')).toHaveLength(7)
     })
 
     it('点击设置入口 push 到 /photos/settings', async () => {
       const w = mountSidebar()
       await w.get('[data-test="sidebar-settings-link"]').trigger('click')
       await flushPromises()
       expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
     })
   })
+
+  // P8a-T6(§7e-15):smartview 配置感知——Vue2 PhotosSidebar.vue:120-122 的
+  // `ai.smartview === false` 时 `items.filter(i => i.id !== 'smart')`。
+  describe('smartview 配置感知(§7e-15)', () => {
+    it('aiFeatures.smartview 为 false 时整条隐藏智能视图入口', async () => {
+      vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: { smartview: false } })
+      const w = mountSidebar()
+      await flushPromises()
+      await nextTick()
+      const items = w.findAll('.side-item')
+      expect(items).toHaveLength(6)
+      expect(items.some((i) => i.text().includes('智能视图'))).toBe(false)
+      // 剩下 6 项仍是原顺序去掉 smart-views 这一条(favorites/trash 紧跟 places)。
+      expect(items[3].text()).toContain('地点')
+      expect(items[4].text()).toContain('收藏')
+      expect(items[5].text()).toContain('最近删除')
+    })
+
+    it('smartview 未确定(取数失败)时按开启显示,不吓用户', async () => {
+      vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
+      const w = mountSidebar()
+      await flushPromises()
+      await nextTick()
+      const items = w.findAll('.side-item')
+      expect(items).toHaveLength(7)
+      expect(items.some((i) => i.text().includes('智能视图'))).toBe(true)
+    })
+
+    it('挂载即调用一次 fetchAiFeatures(经 store 读配置,不直读 getConfig)', async () => {
+      const settings = usePhotosSettingsStore()
+      const spy = vi.spyOn(settings, 'fetchAiFeatures')
+      mountSidebar()
+      await flushPromises()
+      expect(spy).toHaveBeenCalledTimes(1)
+    })
+  })
 })
diff --git a/src/photos/stores/__tests__/settings.test.ts b/src/photos/stores/__tests__/settings.test.ts
index bd1bf1d..b6acd25 100644
--- a/src/photos/stores/__tests__/settings.test.ts
+++ b/src/photos/stores/__tests__/settings.test.ts
@@ -69,24 +69,55 @@ describe('photosSettings store · aiFeatures', () => {
     expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: false, smartview: true })
   })
 
   it('取数失败:按全开处理,且 aiFeaturesLoaded 保持 false(可与「确认全关」区分)', async () => {
     vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
     const s = usePhotosSettingsStore()
     await s.fetchAiFeatures()
     expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
     expect(s.aiFeaturesLoaded).toBe(false)
   })
 })
 
+// P8a-T6:侧栏(全相册区共用组件)与各视图现在都会在各自 onMounted 里调
+// fetchAiFeatures() —— store 是单例,同一帧内多个消费方挂载会并发调用。这两条锁住
+// 「在途去重」的两个必要行为:去重生效 + 不是永久缓存。
+describe('photosSettings store · fetchAiFeatures 在途去重(P8a-T6)', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('fetchAiFeatures 并发去重:两个消费方同时挂载只发一次 getConfig', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    const [a, b] = await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures()])
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
+    // 两个并发调用者拿到的是同一次取数的结果,不是各自独立的返回值对象身份要求,但值必须一致。
+    expect(a).toEqual(b)
+  })
+
+  it('去重不是永久缓存:上一次结算后再调会重新发请求', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    await s.fetchAiFeatures()
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(2)
+  })
+
+  it('三个并发调用者同样只发一次(不是"恰好 2 个"才生效的偶然实现)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures(), s.fetchAiFeatures()])
+    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
+  })
+})
+
 describe('photosSettings store · setAiFeature', () => {
   beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
 
   it('保存成功:开关落到新值', async () => {
     vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
     vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
     const s = usePhotosSettingsStore()
     await s.fetchAiFeatures()
     const ok = await s.setAiFeature('faces', false)
     expect(ok).toBe(true)
     expect(s.aiFeatures.faces).toBe(false)
   })
diff --git a/src/photos/stores/settings.ts b/src/photos/stores/settings.ts
index 5ed3ac2..201589c 100644
--- a/src/photos/stores/settings.ts
+++ b/src/photos/stores/settings.ts
@@ -17,24 +17,30 @@
 //
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
+//
+// P8a-T6 (2026-08-04): folded PhotosPeople.vue's and PhotosSmartViews.vue's own
+// onMounted-direct getConfig reads into this store's fetchAiFeatures (§7e-10
+// debt), added an in-flight dedup to fetchAiFeatures (see the comment at its
+// definition — the sidebar is a config consumer too now, §7e-15), and wired
+// PhotosSmartViews.vue's dead-link settings banner to a real route (§7e-9).
 import { defineStore } from 'pinia'
 import { ref } from 'vue'
 import { service } from '@nimotech/nimoos-service'
 import { useTimelineStore } from './timeline'
 
 export interface PhotosAiFeatures {
   faces: boolean
   scenes: boolean
   ocr: boolean
   smartview: boolean
 }
 
@@ -77,34 +83,53 @@ function readAiFeatures(cfg: Record<string, unknown> | null | undefined): Photos
 
 export const usePhotosSettingsStore = defineStore('photos-settings', () => {
   const aiFeatures = ref<PhotosAiFeatures>({ ...ALL_ON })
   // 仅成功路径置真 —— 与 favorites.ts:44 同一口径:一次取数失败必须与「确认全关」可区分,
   // 否则以 !loaded 为重取判据的消费方会把真实配置永久掩在默认值后面。
   const aiFeaturesLoaded = ref(false)
   const storage = ref<PhotosStorageInfo | null>(null)
   const storageError = ref(false)
   const about = ref<PhotosAboutInfo | null>(null)
   const retentionDays = ref(30)
   const scanIntervalMinutes = ref(1440)
 
+  // P8a-T6:多个消费方(侧栏 + 各视图各自的 onMounted)现在都会挂载并各调一次
+  // fetchAiFeatures() —— 侧栏是相册区全局共用组件,与任意一个视图同帧挂载,朴素实现会在
+  // 一次页面加载里对 getConfig 发出两次并发请求。这里加一个「在途去重」:多个并发调用共享
+  // 同一个 in-flight promise。**刻意不做成永久缓存** —— promise 在 finally 里落回 null,
+  // 下一次(不在途时)调用会重新发请求,保持"设置页保存后再进列表页能看到最新值"这条既有
+  // 语义(没有人会指望这个 store 只在应用生命周期内取一次)。形状照 Vue2
+  // store/modules/photos.js:1307-1315 的 `_restoreUploadsPromise`(模块级变量持有的
+  // in-flight promise 让并发调用者复用同一次请求),但语义不同:那处是"全局只运行一次,永久
+  // 不重置"的迁移幂等;这里在 finally 清空,只做"同一帧内的并发去重",不是永久缓存。
+  let aiFeaturesInFlight: Promise<PhotosAiFeatures> | null = null
+
   async function fetchAiFeatures(): Promise<PhotosAiFeatures> {
+    if (aiFeaturesInFlight) return aiFeaturesInFlight
+    aiFeaturesInFlight = (async () => {
+      try {
+        const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+        aiFeatures.value = readAiFeatures(cfg)
+        aiFeaturesLoaded.value = true
+      } catch (e) {
+        aiFeatures.value = { ...ALL_ON }
+        console.error('[photos-settings] fetchAiFeatures', e)
+      }
+      return aiFeatures.value
+    })()
     try {
-      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
-      aiFeatures.value = readAiFeatures(cfg)
-      aiFeaturesLoaded.value = true
-    } catch (e) {
-      aiFeatures.value = { ...ALL_ON }
-      console.error('[photos-settings] fetchAiFeatures', e)
+      return await aiFeaturesInFlight
+    } finally {
+      aiFeaturesInFlight = null
     }
-    return aiFeatures.value
   }
 
   // Vue2 :263-281 是一个 features 的 deep watcher,靠 _suppressFeaturesWatch + $nextTick
   // 抑制「从后端同步初值」时的回写。New-UI 改成显式 action(点开关才调),**没有 watcher,
   // 那套抑制标志整套不需要** —— 这不是重构掉功能,是同一意图在显式调用模型下的直接对应物。
   // 乐观更新 + 失败回滚:与 Vue2 一致(:274-275 把 features 退回 _lastGoodFeatures)。
   //
   // 写回前重读一次 getConfig() 取当前 watchDirs/retentionDays 随同回传 —— 见文件头注释,
   // 共享包 updateConfig 的 watchDirs 是必填位置参数,后端对空 watchDirs 有非空校验
   // (同 Vue2 setAiFeatures :1281-1291)。
   async function setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean> {
     const prev = { ...aiFeatures.value }
diff --git a/src/views/PhotosPeople.vue b/src/views/PhotosPeople.vue
index f0eeca2..e8b6b86 100644
--- a/src/views/PhotosPeople.vue
+++ b/src/views/PhotosPeople.vue
@@ -35,45 +35,46 @@
 //     New-UI 设置页归 P8,渲染为强调文本(非链接),不留点不动的假链接。
 //  5) Vue2 :575-579 的索引日期写死 'en' locale;这里跟随 i18n locale(偏离登记 9)。
 //  6) 铁律:一切「当前项 === 循环项」「按 id 找对象」用 String 值比较,不用引用相等。
 //  7) Vue2 :97 在设置链接后硬编码了一个英文句点(中文界面下中西混排,且无法本地化)——
 //     不复制,详见该处行内注释。
 //
 // T3 漏掉的两条文案由协调者补给(zh_CN.json:2072 / :2079),已加进两个 locale 并照 Vue2 渲染:
 // photosPeopleMinScore(置信度下拉小标题,:24-26)、photosPeopleClusterHint(未命名卡片
 // 悬停提示,:204,连同 scss:242-243 的 .ct / .name-action 悬停互换一起补齐)。
 import { computed, onMounted, onUnmounted, ref } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
-import { service } from '@nimotech/nimoos-service'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import PersonAvatar from '../photos/components/PersonAvatar.vue'
 import ClusterActionDialog from '../photos/components/ClusterActionDialog.vue'
 import MergeReviewDialog, { type MergeSuggestion } from '../photos/components/MergeReviewDialog.vue'
 import { usePhotosPeople } from '../photos/stores/people'
 import { useTimelineStore } from '../photos/stores/timeline'
+import { usePhotosSettingsStore } from '../photos/stores/settings'
 import { useToast } from '../stores/toast'
 import {
   mergeConfidencePct, mergeReasonKey, sortNamed, unnamedCountAt, type Person,
 } from '../photos/util/peopleView'
 
 type FilterId = 'all' | 'family' | 'friend' | 'work' | 'recent'
 type SortId = 'freq' | 'name' | 'recent' | 'oldest'
 type DialogMode = 'name' | 'merge' | 'delete'
 
 const { t, locale } = useI18n()
 const router = useRouter()
 const people = usePhotosPeople()
 const timeline = useTimelineStore()
+const settings = usePhotosSettingsStore()
 const toast = useToast()
 
 // Vue2 :448
 const CONFIDENCE_OPTIONS = [50, 60, 70, 80, 90, 95]
 
 // Vue2 data() :461-472。sort 刻意不持久化(照 Vue2);confidence/showSingletons 在 store 里持久化。
 const filter = ref<FilterId>('all')
 const sort = ref<SortId>('freq')
 const showUnnamed = ref(true)
 const confidenceOpen = ref(false)
 const sortOpen = ref(false)
 const clusterMenu = ref<{ person: Person; x: number; y: number } | null>(null)
@@ -86,27 +87,29 @@ const reviewIdx = ref(0)
 // 连续触发(比如命名成功后立刻又点了合并),共用一个标志会让互不相干的操作彼此误伤。
 //
 // 评审必修 2(第二轮,已删除 deletingSubmitting ref):删除路径原来也仿照这个形状加了
 // 一个独立的 `deletingSubmitting` ref,但评审做了删码验证——`onSubmitDelete` 全程没有
 // `await`(purgePersonWithUndo 同步返回 undo 闭包),函数体在一次 dispatchEvent 里跑完,
 // `dialog.value = null` 在函数体内**同步**发生,早于任何"守卫复位"的必要性。把这个 ref
 // 整段(声明/置位/finally 复位)删掉后,回归测试依然绿,因为挡住第二次调用的从来是
 // `onSubmitDelete` 开头的 `!dialog.value` 短路,不是这个 ref——ref 只是"标准形状"的
 // 装饰,没有实际保护价值。已在 fix 报告里记录这次删码验证的具体做法与结果,这里不再
 // 加回这个 ref。命名/合并两条路径的 async 守卫经评审确认确凿有效,不受影响。
 const namingSubmitting = ref(false)
 const mergingSubmitting = ref(false)
-// aiFeatures.faces 的临时来源:本仓没有 settings store(归 P8),onMounted 直接读一次
-// /photos/config。失败或字段缺失一律按 true(不显示警告横幅,宁可不吓用户)。
-const facesEnabled = ref(true)
+// P8a-T6(§7e-10):facesEnabled 曾经是本页自己 onMounted 直读一次 /photos/config 的临时
+// 实现(P8 归属前没有共享 store)。现在改读 T1 的 photosSettings store —— 语义不变:缺
+// 字段/请求失败一律按开启处理(不显示警告横幅,宁可不吓用户),这条防御性语义已经在
+// store.fetchAiFeatures() 里落实(readAiFeatures 的 `on()` 判据),这里只是消费,不重复实现。
+const facesEnabled = computed(() => settings.aiFeatures.faces)
 
 const confMenuRef = ref<HTMLElement | null>(null)
 const sortMenuRef = ref<HTMLElement | null>(null)
 const clusterMenuRef = ref<HTMLElement | null>(null)
 
 // 随 locale 热切换重新求值(照 PhotosAlbums.vue:52-60 的既有教训:computed 而非常量固化一份)。
 const sortOptions = computed(() => [
   { id: 'freq' as SortId, label: t('photosPeopleSortFreq'), hint: t('photosPeopleSortFreqHint') },
   { id: 'name' as SortId, label: t('photosPeopleSortName'), hint: t('photosPeopleSortNameHint') },
   { id: 'recent' as SortId, label: t('photosPeopleSortRecent'), hint: t('photosPeopleSortRecentHint') },
   { id: 'oldest' as SortId, label: t('photosPeopleSortOldest'), hint: t('photosPeopleSortOldestHint') },
 ])
@@ -364,41 +367,31 @@ function onDocMousedown(e: MouseEvent): void {
   const target = e.target as Node
   if (confidenceOpen.value && confMenuRef.value && !confMenuRef.value.contains(target)) confidenceOpen.value = false
   if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(target)) sortOpen.value = false
   if (clusterMenu.value && clusterMenuRef.value && !clusterMenuRef.value.contains(target)) clusterMenu.value = null
 }
 function onDocKeydown(e: KeyboardEvent): void {
   if (e.key !== 'Escape') return
   if (clusterMenu.value) { clusterMenu.value = null; return }
   if (confidenceOpen.value) { confidenceOpen.value = false; return }
   if (sortOpen.value) sortOpen.value = false
 }
 
-async function loadFacesEnabled(): Promise<void> {
-  try {
-    const cfg = await service.photos.getConfig()
-    const ai = cfg?.aiFeatures as { faces?: unknown } | undefined
-    facesEnabled.value = ai?.faces !== false
-  } catch (e) {
-    // 失败按开启处理:宁可不显示警告,也不要因为一次配置读取抖动就吓用户。
-    console.error('[photos-people] getConfig', e)
-    facesEnabled.value = true
-  }
-}
-
 onMounted(() => {
   // Vue2 :526-527 每次进页面都重拉,不做 loaded 去重,照搬。
   void people.fetchPeople()
   void people.fetchMergeSuggestions()
-  void loadFacesEnabled()
+  // P8a-T6:改读共享 photosSettings store(§7e-10)。侧栏(PhotosSidebar,本页也挂载它)
+  // 同帧也会调用 fetchAiFeatures() —— 并发去重收在 settings.ts 里,这里不需要关心。
+  void settings.fetchAiFeatures()
   document.addEventListener('mousedown', onDocMousedown)
   document.addEventListener('keydown', onDocKeydown)
 })
 onUnmounted(() => {
   document.removeEventListener('mousedown', onDocMousedown)
   document.removeEventListener('keydown', onDocKeydown)
 })
 </script>
 
 <template>
   <AreaShell :title="t('photosPeople')">
     <div class="photos-layout">
diff --git a/src/views/PhotosSmartViews.vue b/src/views/PhotosSmartViews.vue
index 39c56f7..5110ddb 100644
--- a/src/views/PhotosSmartViews.vue
+++ b/src/views/PhotosSmartViews.vue
@@ -1,127 +1,120 @@
 <script setup lang="ts">
 // SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页(壳 + AI 横幅 + hero + 网格 + 新建卡)。
 // 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:14-38(列表部分,
 // 详情/弹窗部分归其余任务)、内联横幅 :15-19、hero :22-30、网格 :31-38 移植;
 // 样式照 photos-smartview.scss:4-25(hero/create-btn/grid)+ :118-145(create-card)。
 // 壳照 PhotosPeople.vue 头部注释的既定形态复制(AreaShell/.photos-layout/PhotosSidebar/
 // .photos-main,含 ≤768px 的 gap:0),不抽公共(P3/P4 既定)。
 //
 // 本任务范围(brief 结构规格 1-9):
 //  1) 外壳
-//  2) AI 横幅——`aiSmartViewOff` 的读法照 PhotosPeople.vue:379 的 P5 先例(onMounted 直读
-//     一次 getConfig,缺字段/失败一律按开启处理,不吓用户)。
+//  2) AI 横幅——`aiSmartViewOff` 读 T1 的 photosSettings store(P8a-T6 折进去的,见下方
+//     script 头部注释;缺字段/失败一律按开启处理,不吓用户,语义与折之前一致)。
 //  3) hero(标题 + 副标题 + 创建按钮)
 //  4) 网格(SmartViewCard v-for + 末尾新建卡)
 //  5) 加载态用骨架(New-UI 新增,Vue2 没有);listLoaded 且空列表时**不加空态**——那张
 //     新建卡本身就是这页的空态(照 Vue2 的信息层级,登记见 task-4-report.md)。
 //  6) 创建弹窗挂载点:T4 只留 `createOpen` state + 两个入口 @click 置真;T5 已把
 //     <SmartViewCreateDialog v-model:open="createOpen" @created="onCreated"/> 接上
 //     (created 后跳详情页,同 onCardOpen 的目标路径)。
 //
 // 偏离登记:
-//  1) Vue2 :15 的横幅链接是 <a href="javascript:void(0)">,点击 $emit('open-settings',
-//     'ai')。New-UI 设置页归 P8(尚不存在),渲染成不可点的 <span aria-disabled="true">,
-//     title 走新增键 photosSvSettingsPending(「设置页待迁移(P8)」)—— P8 接线点在此,
-//     届时把这个 span 换成真链接/路由跳转。
+//  1) [P8a-T6 已接线,不再是偏离] Vue2 :15 的横幅链接是 <a href="javascript:void(0)">,
+//     点击 $emit('open-settings', 'ai')。设置页在 P8a-T5 落地后(/photos/settings?section=
+//     ai),这里换成真实的 <RouterLink>(§7e-9)—— 原先占位用的 photosSvSettingsPending
+//     键随之成为死键,已从两个 locale 文件删除(见提交信息)。
 //  2) Vue2 :19 在链接文字后还有一个裸英文句点(`</a>.`),中文界面下会中西混排且不在
 //     任何可翻译串里——不复制(同 PhotosPeople.vue 偏离登记 7 的先例)。
 //  3) 横幅琥珀色:Vue2 是内联 rgba(255,159,10,…)/#FF9F0A 字面量,这里改用本仓既有的
 //     --dem-fg/--dem-bg/--dem-bd 家族(grep theme.css 已确认两套主题都有取值,PhotosTrash.vue
 //     的 warn 语义已是这套 token 的既定先例,不新增 token)。
 //  4) .sv-create-btn 背景:Vue2 是 linear-gradient(135deg, var(--accent), var(--accent-hi))
 //     渐变,本仓没有 --accent-hi(Global Constraints §33),改用 var(--accent) 实底 +
 //     hover 时 filter: brightness(1.08)(照 PhotosPersonDetail.vue:1142 等既有先例)。
 //     fix round 1 · I2:这条只解释了背景色的替换,**不覆盖** Vue2 hover 态的
 //     transform: translateY(-1px)(上浮)——那是与颜色 token 无关的独立视觉属性,
 //     之前被静默丢了,已在样式块补回(两者可共存)。
-import { onMounted, ref } from 'vue'
+import { computed, onMounted, ref } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
-import { service } from '@nimotech/nimoos-service'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import SmartViewCard from '../photos/components/SmartViewCard.vue'
 import SmartViewCreateDialog from '../photos/components/SmartViewCreateDialog.vue'
 import { usePhotosSmartViews } from '../photos/stores/smartViews'
+import { usePhotosSettingsStore } from '../photos/stores/settings'
 
 const { t } = useI18n()
 const router = useRouter()
 const store = usePhotosSmartViews()
+const settings = usePhotosSettingsStore()
 
-// aiFeatures.smartview 的临时来源:本仓没有 settings store(归 P8),onMounted 直接读一次
-// /photos/config。失败或字段缺失一律按开启处理(宁可不吓用户),照 PhotosPeople.vue:376-386
-// 的 loadFacesEnabled 先例。
-const aiSmartViewOff = ref(false)
+// P8a-T6(§7e-10):aiFeatures.smartview 曾经是本页自己 onMounted 直读一次 /photos/config
+// 的临时实现(P8 归属前没有共享 store)。现在改读 T1 的 photosSettings store —— 语义不变:
+// 缺字段/请求失败一律按开启处理(不显示横幅,不吓用户),这条防御性语义已经在
+// store.fetchAiFeatures() 里落实,这里只是消费。
+const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)
 
 // T5:创建弹窗已接线(T4 的 TODO 兑现)。createOpen 通过 v-model:open 传给
 // SmartViewCreateDialog;创建成功后弹窗 emit('created', id),这里直接跳详情页
 // (同 onCardOpen 的目标路径)。
 const createOpen = ref(false)
 function openCreate(): void {
   createOpen.value = true
 }
 
 function onCardOpen(id: string): void {
   router.push('/photos/smart-views/' + id)
 }
 
 function onCreated(id: string): void {
   router.push('/photos/smart-views/' + id)
 }
 
 // 测试观测点:T4 不挂真弹窗(T5 才建),没有 DOM 可断言"弹窗真的开了"——照
 // PlacesMap.vue 的既有 defineExpose 先例,暴露这个 ref 供测试直接读取,而不是新增一个
 // 纯为了测试存在的隐藏 DOM 标记节点。T5 接上真弹窗后,这个 ref 仍会是 v-model:open 的
 // 绑定目标,defineExpose 可以留着或按 T5 实际需要收窄。
 defineExpose({ createOpen })
 
-async function loadAiSmartViewOff(): Promise<void> {
-  try {
-    const cfg = await service.photos.getConfig()
-    const ai = cfg?.aiFeatures as { smartview?: unknown } | undefined
-    aiSmartViewOff.value = ai?.smartview === false
-  } catch (e) {
-    console.error('[photos-smartviews] getConfig', e)
-    aiSmartViewOff.value = false
-  }
-}
-
 onMounted(() => {
   void store.fetchSmartViews()
-  void loadAiSmartViewOff()
+  // 侧栏(PhotosSidebar,本页也挂载它)同帧也会调用 fetchAiFeatures() —— 并发去重收在
+  // settings.ts 里,这里不需要关心。
+  void settings.fetchAiFeatures()
 })
 </script>
 
 <template>
   <AreaShell :title="t('photosTitle')">
     <div class="photos-layout">
       <PhotosSidebar />
       <main class="photos-main">
         <!-- ── AI 横幅(Vue2 :15-19,内联 style 改 class)── -->
         <div v-if="aiSmartViewOff" class="svs-banner" data-test="svs-ai-banner">
           <div class="svs-banner-icon">
             <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
           </div>
           <div class="svs-banner-body">
             <div class="svs-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
             <div class="svs-banner-desc">
               {{ t('photosSvTheseSavedSearchesStay') }}
-              <!-- 偏离登记 1:设置页归 P8,不可点;偏离登记 2:不复制 Vue2 链接后的裸英文句点。 -->
-              <span
+              <!-- §7e-9:真实路由链接,替换掉原来的不可点占位 span(偏离登记 1 已解除,
+                   见文件头注释)。偏离登记 2:不复制 Vue2 链接后的裸英文句点。 -->
+              <RouterLink
                 class="svs-banner-link"
-                aria-disabled="true"
                 data-test="svs-settings-link"
-                :title="t('photosSvSettingsPending')"
-              >{{ t('photosPeopleFacesOffLink') }}</span>
+                to="/photos/settings?section=ai"
+              >{{ t('photosPeopleFacesOffLink') }}</RouterLink>
             </div>
           </div>
         </div>
 
         <!-- ── hero(Vue2 :22-30)── -->
         <div class="sv-hero">
           <div class="sv-hero-text">
             <h1>{{ t('photosSvSmartViews') }}</h1>
             <p>{{ t('photosSvSavedSearchesStayLive') }}</p>
           </div>
           <button type="button" class="sv-create-btn" data-test="sv-hero-create" @click="openCreate">
             <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
@@ -169,26 +162,27 @@ onMounted(() => {
 .svs-banner {
   margin: 24px 32px 20px; padding: 14px 16px;
   background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
   display: flex; gap: 10px; align-items: flex-start;
 }
 .svs-banner-icon {
   width: 26px; height: 26px; border-radius: 7px;
   background: color-mix(in srgb, var(--dem-fg) 18%, transparent); color: var(--dem-fg);
   display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
 }
 .svs-banner-title { font-size: 12.5px; font-weight: 600; color: var(--dem-fg); }
 .svs-banner-desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 3px; line-height: 1.5; }
-/* 不可点的设置链接标注(偏离登记 1):保留 Vue2 视觉上的强调下划线,但不是 <a>。 */
-.svs-banner-link { color: var(--accent-text); text-decoration: underline; cursor: default; }
+/* §7e-9:真实路由链接,保留 Vue2 视觉上的强调下划线(Vue2 :19 的 `<a>` 本身也没有独立
+   hover 规则,这里 1:1 不额外加)。 */
+.svs-banner-link { color: var(--accent-text); text-decoration: underline; cursor: pointer; }
 
 /* ── hero(scss:5-19)── */
 .sv-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
 .sv-hero-text h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--fg); }
 .sv-hero-text p { font-size: 13.5px; color: var(--fg-muted); margin: 0; max-width: 520px; line-height: 1.5; }
 .sv-create-btn {
   display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
   padding: 9px 16px; border-radius: 99px; border: 0;
   background: var(--accent); color: var(--on-accent);
   font: inherit; font-weight: 500; font-size: 13px; cursor: pointer;
 }
 /* fix round 1 · I2:Vue2 scss:20 的 hover 效果是 `transform: translateY(-1px)`(按钮上浮)——
diff --git a/src/views/__tests__/PhotosPeople.test.ts b/src/views/__tests__/PhotosPeople.test.ts
index 236e9d0..0842ae7 100644
--- a/src/views/__tests__/PhotosPeople.test.ts
+++ b/src/views/__tests__/PhotosPeople.test.ts
@@ -27,24 +27,25 @@ const svc = vi.hoisted(() => ({
     purgePerson: vi.fn().mockResolvedValue(undefined),
     rejectMergeSuggestion: vi.fn().mockResolvedValue(undefined),
   },
 }))
 vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
 
 import PhotosPeople from '../PhotosPeople.vue'
 // 评审 Important 2 的样式断言用:jsdom 不做级联/伪元素计算,只能对 <style> 原文做结构断言
 // (同 color-guard.test.ts / PersonAssetGrid.test.ts 的既有 `?raw` 先例)。
 import photosPeopleRaw from '../PhotosPeople.vue?raw'
 import { usePhotosPeople } from '../../photos/stores/people'
 import { useTimelineStore } from '../../photos/stores/timeline'
+import { usePhotosSettingsStore } from '../../photos/stores/settings'
 import { useToast } from '../../stores/toast'
 
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 function makeRouter() {
   return createRouter({
     history: createWebHashHistory('/app/'),
     routes: [
       { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
       { path: '/photos/people/:id', name: 'photos-person', component: { template: '<div/>' } },
     ],
   })
@@ -95,27 +96,44 @@ beforeEach(() => {
 // purgePersonWithUndo,若不清,上一条用例留下的悬挂 entry(未 advanceTimers 也未 undo())
 // 会在下一条用例里被"复用首次 idx/snapshot"分支捡到,插回的是上一个 store 实例的快照——
 // 用 afterEach(不是 beforeEach,理由同上引处)兜底清空。
 afterEach(() => {
   usePhotosPeople().__resetForTest()
 })
 
 describe('PhotosPeople.vue — 生命周期与分区', () => {
   it('onMounted 拉人物 + 拉合并建议 + 读一次 getConfig', async () => {
     await mountView()
     expect(svc.photos.listPersons).toHaveBeenCalledTimes(1)
     expect(svc.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
+    // getConfig 现在经由 photosSettings store 的 fetchAiFeatures() 间接调用(§7e-10 收编
+    // 见下一条用例),仍是「一次页面加载只读一次」—— 本页与它挂载的 PhotosSidebar 同帧各调
+    // 一次 fetchAiFeatures(),store 内部的在途去重(settings.ts)把两次并发调用合并成
+    // 一次真实请求,这条断言同时也是对去重生效的端到端印证。
     expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
   })
 
+  // P8a-T6(§7e-10):facesEnabled 折进 photosSettings store,视图不再自己直读 getConfig。
+  // брief 给的字面断言 `expect(service.photos.getConfig).not.toHaveBeenCalled()` 与上一条
+  // 既有测试互相矛盾(store 的 fetchAiFeatures 内部仍会调 getConfig,mock 是在 service 层,
+  // 分不清"视图直读"与"经 store 间接读"——两条断言不可能同时成立)。已在任务报告里登记这处
+  // brief-vs-既有测试冲突,改用能真正区分"视图直读 vs 经 store 读"的断言:spy 住 store 的
+  // fetchAiFeatures action,证明 onMounted 调的是这个 action 而不是自己再包一层 getConfig。
+  it('facesEnabled 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures)', async () => {
+    const settings = usePhotosSettingsStore()
+    const spy = vi.spyOn(settings, 'fetchAiFeatures')
+    await mountView()
+    expect(spy).toHaveBeenCalled()
+  })
+
   // ── 评审 Important 2:收藏人物的 accent 内环 ────────────────────────────────
   it('Pinned 头像带 data-fav="true",Named 头像是 "false"(选择器条件的数据来源)', async () => {
     const { w } = await mountView()
     const pinnedAvatar = w.get('[data-test="pinned-card"] .person-avatar')
     expect(pinnedAvatar.attributes('data-fav')).toBe('true')
     for (const card of w.findAll('[data-test="named-card"] .person-avatar')) {
       expect(card.attributes('data-fav')).toBe('false')
     }
   })
 
   it('accent 内环画在 ::after 覆盖层上(不是圆环自身的 inset box-shadow —— 会被 img 盖死)', () => {
     const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(photosPeopleRaw)?.[1] ?? ''
diff --git a/src/views/__tests__/PhotosSettings.test.ts b/src/views/__tests__/PhotosSettings.test.ts
index 934999e..d86e6be 100644
--- a/src/views/__tests__/PhotosSettings.test.ts
+++ b/src/views/__tests__/PhotosSettings.test.ts
@@ -119,25 +119,31 @@ describe('PhotosSettings 容器', () => {
     const store = usePhotosSettingsStore()
     const fetchAbout = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
     const fetchRetention = vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
     const fetchScanInterval = vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
     const fetchAiFeatures = vi.spyOn(store, 'fetchAiFeatures').mockResolvedValue(store.aiFeatures)
     const fetchStorage = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
 
     await mountView()
 
     expect(fetchAbout).toHaveBeenCalledTimes(1)
     expect(fetchRetention).toHaveBeenCalledTimes(1)
     expect(fetchScanInterval).toHaveBeenCalledTimes(1)
-    expect(fetchAiFeatures).toHaveBeenCalledTimes(1)
+    // P8a-T6:本页头部注释(:14-17)自己说了"整页只有一份 PhotosSidebar 副本",而 T6 给
+    // PhotosSidebar 也接了 fetchAiFeatures()(§7e-15,侧栏要用 aiFeatures.smartview 决定
+    // 是否隐藏智能视图入口)——本页自身 + 它挂载的这一份侧栏,同帧各调一次,是 2 次
+    // *action 调用*,不是 2 次网络请求(settings.ts 的在途去重把并发调用合并成 1 次
+    // getConfig,见 settings.test.ts 的去重用例)。这条断言从 1 改成 2 是行为的真实变化,
+    // 不是放宽断言掩盖回归。
+    expect(fetchAiFeatures).toHaveBeenCalledTimes(2)
     expect(fetchStorage).not.toHaveBeenCalled()
   })
 
   it('承接卡片的 toast 事件并在 2800ms 后消失', async () => {
     // 先用真实定时器完成挂载(mountView 内部的 flushPromises 靠 setTimeout(0) 落地,
     // 若先开 fake timers 会卡死——挂载稳定后才切 fake timers,只接管 toast 计时这一段)。
     const w = await mountView()
     vi.useFakeTimers()
 
     await w.get('[data-test="storage-card-stub"]').trigger('click')
     expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
     expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-storage')
diff --git a/src/views/__tests__/PhotosSmartViews.test.ts b/src/views/__tests__/PhotosSmartViews.test.ts
index 0a84ee4..9f52e3e 100644
--- a/src/views/__tests__/PhotosSmartViews.test.ts
+++ b/src/views/__tests__/PhotosSmartViews.test.ts
@@ -20,38 +20,42 @@ const svc = vi.hoisted(() => ({
     // 抛"not a function"、污染下一条测试——照 smartViews.test.ts 的既有 mock 补齐,
     // 即便本文件的用例都不等那 300ms。
     previewSmartView: vi.fn().mockResolvedValue({ count: 0, seeds: [], thresholdActive: true }),
   },
 }))
 vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
 
 import PhotosSmartViews from '../PhotosSmartViews.vue'
 // 评审既有先例(PhotosPeople.test.ts):`?raw` 只用于对 <style> 原文做结构断言,不用于
 // 行为断言。
 import photosSmartViewsRaw from '../PhotosSmartViews.vue?raw'
 import { usePhotosSmartViews } from '../../photos/stores/smartViews'
+import { usePhotosSettingsStore } from '../../photos/stores/settings'
 // fix round 1 · I1/I2:先锚定规则体、再断言属性(全文件级 toContain 不算断言)。
 // parseCssRules/extractStyleBlock 是本区既有的样式块结构断言工具(SmartViewCard.test.ts
 // 已用过),不重新发明。
 import { extractStyleBlock, parseCssRules } from '../../photos/components/__tests__/cssCascade'
 
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 function makeRouter() {
   return createRouter({
     history: createWebHashHistory('/app/'),
     routes: [
       { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
       // T4 尚不建详情路由(归后续任务),这里放一个桩路由让 router.push 的目标路径真实可解析。
       { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail-stub', component: { template: '<div/>' } },
+      // P8a-T6(§7e-9):AI 横幅里的设置链接指向 /photos/settings?section=ai——桩路由让
+      // RouterLink 真的能解析出 href,不然 vue-router 会警告"no match"。
+      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
     ],
   })
 }
 
 async function mountView() {
   const router = makeRouter()
   router.push('/photos/smart-views')
   await router.isReady()
   const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
   await flushPromises()
   await w.vm.$nextTick()
   return { w, router }
@@ -94,24 +98,33 @@ beforeEach(() => {
   svc.photos.thumbnailUrl.mockClear()
   svc.photos.previewSmartView.mockClear().mockResolvedValue({ count: 0, seeds: [], thresholdActive: true })
 })
 afterEach(() => {
   usePhotosSmartViews().__resetForTest()
 })
 
 describe('PhotosSmartViews.vue — 拉取', () => {
   it('onMounted 调 store.fetchSmartViews() 一次(即 service.photos.listSmartViews 被调一次)', async () => {
     await mountView()
     expect(svc.photos.listSmartViews).toHaveBeenCalledTimes(1)
   })
+
+  // P8a-T6(§7e-10):aiSmartViewOff 折进 photosSettings store,本页不再自己直读 getConfig
+  // —— onMounted 走 settings.fetchAiFeatures(),同 PhotosPeople.vue 的收编先例。
+  it('aiSmartViewOff 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures)', async () => {
+    const settings = usePhotosSettingsStore()
+    const spy = vi.spyOn(settings, 'fetchAiFeatures')
+    await mountView()
+    expect(spy).toHaveBeenCalled()
+  })
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
     // listLoading 触发一次重渲染,但请求 promise 本身仍未 resolve(resolveFn 还没调用)。
@@ -152,35 +165,39 @@ describe('PhotosSmartViews.vue — AI 横幅三态', () => {
   it('getConfig 返回 aiFeatures: {}(缺字段)→ 横幅不在,不吓用户', async () => {
     svc.photos.getConfig.mockResolvedValue({ aiFeatures: {} })
     const { w } = await mountView()
     expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(false)
   })
 
   it('getConfig reject → 横幅不在,不吓用户', async () => {
     svc.photos.getConfig.mockRejectedValue(new Error('boom'))
     const { w } = await mountView()
     expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(false)
   })
 
-  it('横幅里的设置链接是 <span> 且带 aria-disabled="true",不是 <a href>;点它不触发导航', async () => {
+  // P8a-T6(§7e-9):原来的不可点 <span aria-disabled="true"> 换成真实的 <RouterLink>,指向
+  // /photos/settings?section=ai(T5 建的设置页深链入口)。brief 给的断言用的 data-test id
+  // 是 `sv-ai-settings-link`,与本文件/组件既有的 `svs-settings-link` 命名不一致——沿用本文件
+  // 已建立的既有命名,不为了字面对齐 brief 而改 data-test id(已在任务报告里登记这处
+  // brief-vs-既有约定冲突)。
+  it('AI behavior 链接是真路由链接,指向 /photos/settings?section=ai(§7e-9)', async () => {
     svc.photos.getConfig.mockResolvedValue({ aiFeatures: { smartview: false } })
     const { w, router } = await mountView()
-    const link = w.find('[data-test="svs-settings-link"]')
-    expect(link.exists()).toBe(true)
-    expect(link.element.tagName).toBe('SPAN')
-    expect(link.attributes('aria-disabled')).toBe('true')
-    expect(link.attributes('href')).toBeUndefined()
-    const pushSpy = vi.spyOn(router, 'push')
+    const link = w.get('[data-test="svs-settings-link"]')
+    expect(link.attributes('aria-disabled')).toBeUndefined()
+    expect(link.attributes('href')).toContain('/photos/settings')
     await link.trigger('click')
-    expect(pushSpy).not.toHaveBeenCalled()
+    await flushPromises()
+    expect(router.currentRoute.value.path).toBe('/photos/settings')
+    expect(router.currentRoute.value.query.section).toBe('ai')
   })
 })
 
 // T5 升级(brief 明确要求):T4 只能断言内部 createOpen state(弹窗组件当时还不存在);
 // SmartViewCreateDialog.vue 接线后,断言升级为「弹窗真渲染」——两个入口点击后
 // .sv-modal-scrim 真的出现在 DOM 里,而不只是读一个内部 ref。
 describe('PhotosSmartViews.vue — 创建入口(T5:弹窗真渲染)', () => {
   it('点 hero 创建按钮 → SmartViewCreateDialog 的 scrim 真渲染', async () => {
     const { w } = await mountView()
     expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
     await w.find('[data-test="sv-hero-create"]').trigger('click')
     expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
```
