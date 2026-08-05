# Review package — Task 7 (1da9c2f..ba8d122)

## Commits
ba8d122 feat(photos): ?asset / ?photoset 深链(P8a-T7,spec §6 契约)

## Stat
 .../__tests__/usePhotosDeepLinks.test.ts           | 191 +++++++++++++++++++++
 src/photos/composables/usePhotosDeepLinks.ts       | 111 ++++++++++++
 src/views/Photos.vue                               |   3 +
 3 files changed, 305 insertions(+)

## Diff (-U12)
```diff
diff --git a/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts b/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
new file mode 100644
index 0000000..c0e0218
--- /dev/null
+++ b/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
@@ -0,0 +1,191 @@
+// SP7-P8a-T7: usePhotosDeepLinks —— ?asset / ?photoset 深链。
+// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465。
+//
+// 挂载套路照 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts 的既有先例:真实
+// useLightbox() 单例、真实 Pinia toast store(vi.spyOn)、真实 vue-router(query 走
+// router.push,不 mock useRoute)。service.photos.getAsset 走 vi.mock('@nimotech/nimoos-service')。
+//
+// 断言全部落在 useLightbox() 的真实共享状态(open/list/index/current 等 module 级 ref)
+// 上,不 spy openAt 本身——`usePhotosDeepLinks()` 内部另调一次 `useLightbox()` 会拿到一个
+// 新的返回对象字面量,vi.spyOn(外层拿到的那个对象, 'openAt') 只替换外层对象自己的属性,
+// 不会拦到内部那份引用同一批 module 级函数的调用(踩过一次才发现:第一版这么写,openAt
+// 断言全部落空——已改成断言真实状态,顺带更贴合评审要求的"测真实行为,不只测 mock 被调")。
+//
+// 与 task-7-brief.md 步骤 1 骨架的刻意偏离(已在 task-7-report.md 登记):
+//  1) 翻页集断言用真实 list.value / expect.objectContaining({id}),不是字面 `{ id: 'a' }`——
+//     实现按坐标笔记要求用 assetToPhoto({id}) 补全 Photo 的 25+ 必填字段(不能 `as unknown
+//     as Photo` 强转),产物不是裸 `{id}` 对象,brief 骨架那处字面匹配打不中。
+//  2) 不对 lb.openAt 用 vi.fn()/spy 断言调用参数(理由见上),改断言 open/list/index/
+//     current/hasPrev/hasNext 等真实状态。
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { defineComponent } from 'vue'
+import { mount, flushPromises } from '@vue/test-utils'
+import { setActivePinia, createPinia } from 'pinia'
+import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
+import { usePhotosDeepLinks } from '../usePhotosDeepLinks'
+import { useLightbox } from '../../lightbox/useLightbox'
+import { useToast } from '../../../stores/toast'
+
+// lb.openAt 是真实单例,内部会连带调用 usePhotosFavorites() 的 recordView/reconcileFavIds
+// 与 hydrateDetail 的 getAsset 二次取详情——这几个不是本文件要测的行为,但缺 mock 会在
+// openAt 路径上抛未捕获异常污染测试运行(同 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts
+// 的既有先例)。
+const svc = vi.hoisted(() => ({
+  photos: {
+    getAsset: vi.fn(),
+    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
+    recordView: vi.fn().mockResolvedValue(undefined),
+    listFavoriteIds: vi.fn().mockResolvedValue([]),
+  },
+}))
+vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
+
+const lb = useLightbox()
+
+const Host = defineComponent({
+  setup() {
+    usePhotosDeepLinks()
+    return () => null
+  },
+})
+
+function makeRouter(): ReturnType<typeof createRouter> {
+  const routes: RouteRecordRaw[] = [{ path: '/photos', name: 'photos', component: Host }]
+  return createRouter({ history: createWebHashHistory('/app/'), routes })
+}
+
+// assets: id -> 明细响应(裸 asset 形状,取到即 resolve);不在表里的 id 一律 reject,
+// 模拟真实后端 404。
+async function mountWithQuery(query: Record<string, string>, assets: Record<string, { id: string }> = {}) {
+  svc.photos.getAsset.mockImplementation(async (id: string) => {
+    if (id in assets) return assets[id]
+    throw new Error(`not found: ${id}`)
+  })
+  const router = makeRouter()
+  await router.push({ path: '/photos', query })
+  await router.isReady()
+  const wrapper = mount(Host, { global: { plugins: [router] } })
+  return wrapper
+}
+
+beforeEach(() => {
+  setActivePinia(createPinia())
+  svc.photos.getAsset.mockReset()
+  svc.photos.recordView.mockClear()
+  svc.photos.listFavoriteIds.mockClear()
+  localStorage.clear()
+  lb.__resetForTest()
+  vi.spyOn(console, 'error').mockImplementation(() => {})
+})
+
+afterEach(() => {
+  lb.__resetForTest()
+  vi.restoreAllMocks()
+})
+
+describe('usePhotosDeepLinks · ?asset', () => {
+  it('取到明细:以单张成集打开灯箱(prev/next 成 no-op)', async () => {
+    await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value).toHaveLength(1)
+    expect(lb.list.value[0].id).toBe('a1')
+    expect(lb.current.value?.id).toBe('a1')
+    // 单张成集意味着 prev/next 都是 no-op。
+    expect(lb.hasPrev.value).toBe(false)
+    expect(lb.hasNext.value).toBe(false)
+  })
+
+  it('取不到明细:弹 not-found toast,不开灯箱', async () => {
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+    await mountWithQuery({ asset: 'ghost' }, {})
+    await flushPromises()
+    expect(lb.open.value).toBe(false)
+    expect(showSpy).toHaveBeenCalledWith('未找到该图片', 3000)
+  })
+})
+
+describe('usePhotosDeepLinks · ?photoset', () => {
+  it('读到 ids 后立刻 removeItem(一次性交接,取明细之前就已消费)', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    // 不 flushPromises——removeItem 发生在 consumePhotosetHandoff 内的同步代码段,
+    // 在 fetchPhoto 的 await 之前,mount() 一返回就该已经执行过。
+    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull()
+  })
+
+  it('翻页集是全部 ids 的轻量对象,active 打头显示', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
+    expect(lb.index.value).toBe(1) // active='b' 打头显示 = list 里下标 1
+    expect(lb.current.value?.id).toBe('b')
+  })
+
+  it('active 不在 ids 里时取 ids[0](Vue2 :456)', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x', 'y'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'not-in-list' }, { x: { id: 'x' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.current.value?.id).toBe('x')
+    expect(lb.index.value).toBe(0)
+    expect(svc.photos.getAsset).toHaveBeenCalledWith('x')
+  })
+
+  it('handoff 缺失:降级成 ?asset 行为(用 active,单张成集)', async () => {
+    await mountWithQuery({ photoset: 'gone', active: 'b' }, { b: { id: 'b' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value).toHaveLength(1)
+    expect(lb.list.value[0].id).toBe('b')
+    expect(lb.hasPrev.value).toBe(false)
+    expect(lb.hasNext.value).toBe(false)
+  })
+
+  it('handoff 缺失且无 active:什么都不做,不弹 toast', async () => {
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+    await mountWithQuery({ photoset: 'gone' }, {})
+    await flushPromises()
+    expect(lb.open.value).toBe(false)
+    expect(showSpy).not.toHaveBeenCalled()
+    expect(svc.photos.getAsset).not.toHaveBeenCalled()
+  })
+
+  it('localStorage 抛异常时吞掉,不带崩页面,并按"handoff 缺失"降级', async () => {
+    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
+      throw new Error('denied')
+    })
+    // 若吞不掉(如变异验证④删掉 try/catch),openPhotoSetFromQuery 会在
+    // consumePhotosetHandoff 处直接 reject——mount() 本身不会同步抛(async 函数体内的
+    // 抛出会被包成 rejected promise,不会同步冒到这里),但降级路径也就走不到,下面的
+    // 灯箱状态断言会落空、变红。
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    getItemSpy.mockRestore()
+    await flushPromises()
+    // 异常被吞掉后 ids=[] → 走"handoff 缺失"降级路径,用 active 打开单张。
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value).toHaveLength(1)
+    expect(lb.list.value[0].id).toBe('b')
+  })
+
+  it('photoset 与 asset 同时存在时只走 photoset(Vue2 :370-374 的 if/else if)', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
+    await mountWithQuery({ photoset: 'tok', asset: 'a1' }, { x: { id: 'x' }, a1: { id: 'a1' } })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
+    expect(lb.current.value?.id).toBe('x')
+    expect(svc.photos.getAsset).not.toHaveBeenCalledWith('a1')
+  })
+
+  it('ids 里的假值被过滤(Vue2 :446 的 .filter(Boolean))', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', '', null, 'b'] }))
+    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
+    await flushPromises()
+    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b'])
+  })
+})
diff --git a/src/photos/composables/usePhotosDeepLinks.ts b/src/photos/composables/usePhotosDeepLinks.ts
new file mode 100644
index 0000000..f48afe4
--- /dev/null
+++ b/src/photos/composables/usePhotosDeepLinks.ts
@@ -0,0 +1,111 @@
+// SP7-P8a-T7: 深链 ?asset / ?photoset ——
+// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377(mounted 里的分发)、
+// :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)。
+//
+// 挂载约定:usePhotosDeepLinks() 在 /photos 的 setup 里调一次,内部自行 onMounted——
+// 不装路由 watcher。这是一次性交接(?photoset 的 handoff 读完即 removeItem),不是
+// "同路由改查询参数"的场景;装 watcher 会让已被消费掉的 handoff 在后续 query 变化时
+// 被误判成"缺失"而重复触发降级路径。Task 8 会往本文件追加 ?q/?album/?person 三个键,
+// 保持"一个键一个小函数"的结构以便接续。
+import { onMounted } from 'vue'
+import { useRoute } from 'vue-router'
+import type { LocationQueryValue } from 'vue-router'
+import { useI18n } from 'vue-i18n'
+import { service } from '@nimotech/nimoos-service'
+import { useLightbox } from '../lightbox/useLightbox'
+import { useToast } from '../../stores/toast'
+import { assetToPhoto, type Photo } from '../util/assetToPhoto'
+
+const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'
+// 取不到明细时的 toast 停留时长,照 Vue2 :438 / :463 的 duration: 3000。
+const NOT_FOUND_TOAST_MS = 3000
+
+function firstQueryValue(v: LocationQueryValue | LocationQueryValue[]): string {
+  return (Array.isArray(v) ? v[0] : v) || ''
+}
+
+export function usePhotosDeepLinks(): void {
+  const route = useRoute()
+  const { t } = useI18n()
+  const lb = useLightbox()
+  const toast = useToast()
+
+  // 按 id 取明细。失败(网络错误 / 404 / 响应假值)统一归为"取不到",不区分原因——
+  // 照 Vue2 fetchAssetDetail(NimoOS-UI src/store/modules/photos.js:611-619)的口径:
+  // 它自己 catch 后 console.error + 返回 null,调用方按 falsy 处理。
+  async function fetchPhoto(id: string): Promise<Photo | null> {
+    try {
+      const asset = await service.photos.getAsset(id)
+      return asset ? assetToPhoto(asset as unknown as Record<string, unknown>) : null
+    } catch (e) {
+      console.error('[photos-deeplinks] fetchPhoto', e)
+      return null
+    }
+  }
+
+  function notFoundToast(): void {
+    toast.show(t('photosDeepLinkPhotoNotFound'), NOT_FOUND_TOAST_MS)
+  }
+
+  // Vue2 :431-440 _openAssetFromQuery——单张成集,prev/next 成 no-op(与时间线是否
+  // 包含该图无关)。
+  async function openAssetFromQuery(id: string): Promise<void> {
+    const photo = await fetchPhoto(id)
+    if (photo) lb.openAt(photo, [photo])
+    else notFoundToast()
+  }
+
+  // 读一次性交接载荷:{ ids: string[] },key = 'nimo:photoset:' + token。
+  // 过期清理不在这里——2 分钟 TTL 归生产者侧(src/views/AI/Agent/services/openInApp.js:
+  // 76-85,从 key 名里解析时间戳写入),消费侧只做"读到就 removeItem",不做过期判断;
+  // 读不到(键不存在,包括已经被消费过、或已被生产者侧清理过)一律当作"没有交接"处理。
+  function consumePhotosetHandoff(token: string): string[] {
+    const key = PHOTOSET_KEY_PREFIX + token
+    try {
+      const raw = localStorage.getItem(key)
+      if (!raw) return []
+      const parsed = JSON.parse(raw) as { ids?: unknown[] }
+      // 照 Vue2 :447 的位置——parse 成功即 removeItem,即使后面取明细失败也已经消费掉
+      // (一次性交接语义,不因下游失败而"补发")。
+      localStorage.removeItem(key)
+      return (parsed.ids || []).filter(Boolean) as string[]
+    } catch {
+      // localStorage 读 / JSON.parse 异常必须吞掉——隐私模式 / 配额异常不能带崩整页
+      // (Vue2 :449 的 catch {}）。
+      return []
+    }
+  }
+
+  // Vue2 :441-465 _openPhotoSetFromQuery。
+  async function openPhotoSetFromQuery(token: string, activeId: string): Promise<void> {
+    const ids = consumePhotosetHandoff(token)
+    if (!ids.length) {
+      // handoff 缺失(键不存在 / 已被消费)→ 降级成 ?asset 行为;
+      // 连 activeId 也没有则什么都不做,静默(不弹 toast)。
+      if (activeId) await openAssetFromQuery(activeId)
+      return
+    }
+    const active = activeId && ids.includes(activeId) ? activeId : ids[0]
+    const photo = await fetchPhoto(active)
+    if (photo) {
+      // 翻页集只带 id 的轻量对象——Photo 是 25+ 必填字段的宽接口,用 assetToPhoto({id})
+      // 补齐默认值而非 `as unknown as Photo` 强转;灯箱自己会在导航时按需取每张的明细
+      // (useLightbox.ts:100-124 的 hydrateDetail)。
+      lb.openAt(photo, ids.map((id) => assetToPhoto({ id })))
+    } else {
+      notFoundToast()
+    }
+  }
+
+  onMounted(() => {
+    const photosetToken = firstQueryValue(route.query.photoset)
+    const assetId = firstQueryValue(route.query.asset)
+    // 优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个都在时只走
+    // photoset,不是两个都触发)。
+    if (photosetToken) {
+      void openPhotoSetFromQuery(photosetToken, firstQueryValue(route.query.active))
+    } else if (assetId) {
+      void openAssetFromQuery(assetId)
+    }
+  })
+}
diff --git a/src/views/Photos.vue b/src/views/Photos.vue
index c9470a1..e0348b5 100644
--- a/src/views/Photos.vue
+++ b/src/views/Photos.vue
@@ -23,40 +23,43 @@ import { computed, onMounted, onUnmounted, ref } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
 import AreaShell from '../components/shell/AreaShell.vue'
 import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
 import PhotosSearchBar from '../photos/components/PhotosSearchBar.vue'
 import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
 import PhotosGrid from '../photos/components/PhotosGrid.vue'
 import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
 import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
 import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
 import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
 import { useLightbox } from '../photos/lightbox/useLightbox'
+import { usePhotosDeepLinks } from '../photos/composables/usePhotosDeepLinks'
 import { useTimelineStore } from '../photos/stores/timeline'
 import { usePhotosFavorites } from '../photos/stores/favorites'
 import { useToast } from '../stores/toast'
 import { useMessageBus } from '../composables/useMessageBus'
 import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
 import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
 import { matchesTab } from '../photos/util/tabFilter'
 import { applyExifFilters } from '../photos/util/photosFilterUtils'
 import type { Photo } from '../photos/util/assetToPhoto'
 
 const { t } = useI18n()
 const router = useRouter()
 const store = useTimelineStore()
 const toast = useToast()
 const bus = useMessageBus()
 const lb = useLightbox()
+// Task 7(P8a):深链 ?asset / ?photoset——composable 内部自行 onMounted,这里只挂一次。
+usePhotosDeepLinks()
 
 // Default tab: aligned with Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's
 // `data() { tab: 'photo' }` — 'all' was an unsanctioned drift introduced during
 // the port (SP7-P1 review finding), sanctioned fix.
 const tab = ref('photo')
 const density = ref('comfortable')
 const selected = ref<Array<string | number>>([])
 
 // P7b-T4:EXIF 筛选态。照 Vue2 PhotosTimeline.vue:116 的 activeFilters,但只保留三个
 // facet 键——Vue2 那个对象上还挂着 placeKey/spotKey 两个 spot 跳转用的键,New-UI 的
 // 城市/spot 跳转走独立路由页(D6),那两个键在本仓无对应物。
 const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
```
