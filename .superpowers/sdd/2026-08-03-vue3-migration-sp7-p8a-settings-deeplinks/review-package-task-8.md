# Review package — Task 8 (ba8d122..4b94094)

## Commits
4b94094 feat(photos): ?q / ?album / ?person 深链兼容入口(P8a-T8)

## Stat
 .../__tests__/usePhotosDeepLinks.test.ts           | 191 +++++++++++++++++++--
 src/photos/composables/usePhotosDeepLinks.ts       | 112 ++++++++++--
 2 files changed, 276 insertions(+), 27 deletions(-)

## Diff (-U12)
```diff
diff --git a/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts b/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
index c0e0218..8521583 100644
--- a/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
+++ b/src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
@@ -1,87 +1,122 @@
-// SP7-P8a-T7: usePhotosDeepLinks —— ?asset / ?photoset 深链。
-// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465。
+// SP7-P8a-T7/T8: usePhotosDeepLinks —— ?asset / ?photoset / ?q / ?album / ?person 深链。
+// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465/
+// :491-523;?album 是 PhotosAlbumsView.vue:264 自己 mounted 里读(New-UI 统一收进本组合式)。
 //
 // 挂载套路照 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts 的既有先例:真实
-// useLightbox() 单例、真实 Pinia toast store(vi.spyOn)、真实 vue-router(query 走
-// router.push,不 mock useRoute)。service.photos.getAsset 走 vi.mock('@nimotech/nimoos-service')。
+// useLightbox() 单例、真实 Pinia toast/people store(vi.spyOn)、真实 vue-router(query 走
+// router.push,不 mock useRoute)。service.photos.getAsset/listPersons 走
+// vi.mock('@nimotech/nimoos-service')。
 //
 // 断言全部落在 useLightbox() 的真实共享状态(open/list/index/current 等 module 级 ref)
 // 上,不 spy openAt 本身——`usePhotosDeepLinks()` 内部另调一次 `useLightbox()` 会拿到一个
 // 新的返回对象字面量,vi.spyOn(外层拿到的那个对象, 'openAt') 只替换外层对象自己的属性,
 // 不会拦到内部那份引用同一批 module 级函数的调用(踩过一次才发现:第一版这么写,openAt
 // 断言全部落空——已改成断言真实状态,顺带更贴合评审要求的"测真实行为,不只测 mock 被调")。
+// T8 沿用同一条纪律:?album/?person 的断言落在 router.currentRoute 的真实解析结果上
+// (fullPath/name/params/query),不落在 mock 调用参数的字符串形态上——brief 骨架给的
+// `router.replace.mock.calls[0][0].path` 断言只适配"手拼字符串路径"的实现;本文件选了
+// vue-router 具名路由 + params 的编码机制(见 usePhotosDeepLinks.ts 内注释),该实现下
+// replace 的调用参数没有 `.path` 字段,骨架那条断言打不中,改用真实解析后的路由状态断言。
 //
 // 与 task-7-brief.md 步骤 1 骨架的刻意偏离(已在 task-7-report.md 登记):
 //  1) 翻页集断言用真实 list.value / expect.objectContaining({id}),不是字面 `{ id: 'a' }`——
 //     实现按坐标笔记要求用 assetToPhoto({id}) 补全 Photo 的 25+ 必填字段(不能 `as unknown
 //     as Photo` 强转),产物不是裸 `{id}` 对象,brief 骨架那处字面匹配打不中。
 //  2) 不对 lb.openAt 用 vi.fn()/spy 断言调用参数(理由见上),改断言 open/list/index/
 //     current/hasPrev/hasNext 等真实状态。
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
 import { defineComponent } from 'vue'
 import { mount, flushPromises } from '@vue/test-utils'
 import { setActivePinia, createPinia } from 'pinia'
 import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
 import { usePhotosDeepLinks } from '../usePhotosDeepLinks'
 import { useLightbox } from '../../lightbox/useLightbox'
 import { useToast } from '../../../stores/toast'
 
 // lb.openAt 是真实单例,内部会连带调用 usePhotosFavorites() 的 recordView/reconcileFavIds
 // 与 hydrateDetail 的 getAsset 二次取详情——这几个不是本文件要测的行为,但缺 mock 会在
 // openAt 路径上抛未捕获异常污染测试运行(同 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts
-// 的既有先例)。
+// 的既有先例)。T8 追加 listPersons——?person 的存在性校验会真的调用 usePhotosPeople().fetchPeople()。
 const svc = vi.hoisted(() => ({
   photos: {
     getAsset: vi.fn(),
     getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
     recordView: vi.fn().mockResolvedValue(undefined),
     listFavoriteIds: vi.fn().mockResolvedValue([]),
+    listPersons: vi.fn().mockResolvedValue({ persons: [] }),
   },
 }))
 vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
 
 const lb = useLightbox()
 
 const Host = defineComponent({
   setup() {
     usePhotosDeepLinks()
     return () => null
   },
 })
 
+// T8 目标路由的占位组件——不复用 Host,避免 <router-view> 之外还额外挂一份
+// usePhotosDeepLinks()(本文件从不挂 <router-view>,Host 是直接 mount 的,但占位组件仍
+// 用最简单的空渲染,减少无关面。real 导航只改 router.currentRoute,不会重新渲染 Host)。
+const Blank = defineComponent({ render: () => null })
+
 function makeRouter(): ReturnType<typeof createRouter> {
-  const routes: RouteRecordRaw[] = [{ path: '/photos', name: 'photos', component: Host }]
+  const routes: RouteRecordRaw[] = [
+    { path: '/photos', name: 'photos', component: Host },
+    { path: '/photos/search', name: 'photos-search', component: Blank },
+    { path: '/photos/albums/:id', name: 'photos-album-detail', component: Blank },
+    { path: '/photos/people/:id', name: 'photos-person-detail', component: Blank },
+  ]
   return createRouter({ history: createWebHashHistory('/app/'), routes })
 }
 
 // assets: id -> 明细响应(裸 asset 形状,取到即 resolve);不在表里的 id 一律 reject,
-// 模拟真实后端 404。
-async function mountWithQuery(query: Record<string, string>, assets: Record<string, { id: string }> = {}) {
-  svc.photos.getAsset.mockImplementation(async (id: string) => {
-    if (id in assets) return assets[id]
-    throw new Error(`not found: ${id}`)
-  })
+// 模拟真实后端 404。opts.getAssetImpl 可整体替换取图实现(T8 的执行顺序用例需要一个可
+// 手动 resolve 的 pending promise,套不进"按 id 查表"的默认实现)。
+// 返回值追加 router(T7 的既有调用点不解构返回值,不受影响)——T8 的用例要断言真实
+// router.replace 调用 / router.currentRoute 解析结果。
+async function mountWithQuery(
+  query: Record<string, string>,
+  assets: Record<string, { id: string }> = {},
+  opts?: { getAssetImpl?: (id: string) => Promise<unknown> },
+) {
+  if (opts?.getAssetImpl) {
+    svc.photos.getAsset.mockImplementation(opts.getAssetImpl)
+  } else {
+    svc.photos.getAsset.mockImplementation(async (id: string) => {
+      if (id in assets) return assets[id]
+      throw new Error(`not found: ${id}`)
+    })
+  }
   const router = makeRouter()
   await router.push({ path: '/photos', query })
   await router.isReady()
+  // 先完成初始导航,再挂 spy——不然"进入 /photos"这次 push 本身也会被记进 spy,
+  // 污染"组合式内部有没有调用 push/replace"的断言。
+  vi.spyOn(router, 'replace')
+  vi.spyOn(router, 'push')
   const wrapper = mount(Host, { global: { plugins: [router] } })
-  return wrapper
+  return { wrapper, router }
 }
 
 beforeEach(() => {
   setActivePinia(createPinia())
   svc.photos.getAsset.mockReset()
   svc.photos.recordView.mockClear()
   svc.photos.listFavoriteIds.mockClear()
+  svc.photos.listPersons.mockReset()
+  svc.photos.listPersons.mockResolvedValue({ persons: [] })
   localStorage.clear()
   lb.__resetForTest()
   vi.spyOn(console, 'error').mockImplementation(() => {})
 })
 
 afterEach(() => {
   lb.__resetForTest()
   vi.restoreAllMocks()
 })
 
 describe('usePhotosDeepLinks · ?asset', () => {
   it('取到明细:以单张成集打开灯箱(prev/next 成 no-op)', async () => {
@@ -180,12 +215,142 @@ describe('usePhotosDeepLinks · ?photoset', () => {
     expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
     expect(lb.current.value?.id).toBe('x')
     expect(svc.photos.getAsset).not.toHaveBeenCalledWith('a1')
   })
 
   it('ids 里的假值被过滤(Vue2 :446 的 .filter(Boolean))', async () => {
     localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', '', null, 'b'] }))
     await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
     await flushPromises()
     expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b'])
   })
 })
+
+// SP7-P8a-T8:?q / ?album / ?person。回源 Vue2 PhotosTimeline.vue:491-494(?q)、
+// PhotosAlbumsView.vue:264(?album,该视图自己 mounted 里读)、PhotosTimeline.vue:509-523
+// (?person,_applyPersonFromQuery)。
+//
+// 三式都是"改路由"(与 ?asset/?photoset 的"开灯箱、不改路由"相对),统一走
+// router.replace——这是入口归一,不该在浏览器历史里留下 `/photos?q=`/`?album=`/`?person=`
+// 这条兼容态记录(用户按后退键应该跳出 /photos,不是回到还没归一之前的同一页)。
+describe('usePhotosDeepLinks · ?q', () => {
+  it('重定向到 /photos/search?q=,用 replace 不用 push', async () => {
+    const { router } = await mountWithQuery({ q: '猫' }, {})
+    await flushPromises()
+    expect(router.replace).toHaveBeenCalledWith(
+      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
+    )
+    expect(router.push).not.toHaveBeenCalled()
+  })
+
+  it('原样保留搜索词——含首尾空格与非 ASCII,不 trim 不转码', async () => {
+    const term = '  猫 咪  '
+    const { router } = await mountWithQuery({ q: term }, {})
+    await flushPromises()
+    expect(router.replace).toHaveBeenCalledWith(
+      expect.objectContaining({ path: '/photos/search', query: { q: term } }),
+    )
+  })
+})
+
+describe('usePhotosDeepLinks · ?album', () => {
+  it('跳转到相册详情路由', async () => {
+    const { router } = await mountWithQuery({ album: 'al1' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-album-detail')
+    expect(router.currentRoute.value.params.id).toBe('al1')
+    expect(router.push).not.toHaveBeenCalled()
+  })
+
+  // Vue2 PhotosAlbumsView.vue:264 的 _applyRouteAlbum 对 id 未做任何 URL 编码就直接赋值
+  // 给组件本地状态(它从没走过"拼路径"这一步,同页面切面板不需要编码)。New-UI 把它变成
+  // 真实路径跳转后,不编码会让含 `/` 的 id 把路径截断成两段、匹配到完全不同的路由甚至
+  // 匹配失败——这是移植纪律要求"不照抄 Vue2 缺陷"的一条:改成正确编码,并在实现文件里
+  // 登记这条偏离。用具名路由 + params 让 vue-router 自己编码(encodeParam 对 `/` 也编,
+  // 效果等价于 encodeURIComponent),而不是手拼字符串再调 encodeURIComponent。
+  it('id 含 / 时做 URL 编码,不截断路径(Vue2 未编码是缺陷,已修)', async () => {
+    const { router } = await mountWithQuery({ album: 'a/b' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-album-detail')
+    // 具名路由跳转后 vue-router 会把编码后的路径段自动解码回原值,params.id 应该是
+    // 原始未编码字符串——证明"跳对了地方",不是"跳到了一个恰好长得像的坏地址"。
+    expect(router.currentRoute.value.params.id).toBe('a/b')
+    // fullPath 是真实序列化出来的 URL,必须能看到编码后的斜杠(%2F),否则说明路径
+    // 是手拼未编码字符串、后端/路由匹配层面其实截断了。
+    expect(router.currentRoute.value.fullPath).toContain(encodeURIComponent('a/b'))
+  })
+})
+
+describe('usePhotosDeepLinks · ?person', () => {
+  it('存在:校验通过后跳详情路由', async () => {
+    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'p1' }] })
+    const { router } = await mountWithQuery({ person: 'p1' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-person-detail')
+    expect(router.currentRoute.value.params.id).toBe('p1')
+    expect(router.push).not.toHaveBeenCalled()
+  })
+
+  it('不存在:静默摘掉 person 键、留在原地,不跳详情、不弹 toast(其余 query 键保留)', async () => {
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'someone-else' }] })
+    const { router } = await mountWithQuery({ person: 'ghost', view: 'people' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.path).toBe('/photos')
+    expect(router.currentRoute.value.query).toEqual({ view: 'people' })
+    expect(showSpy).not.toHaveBeenCalled()
+  })
+
+  // 后端 id 有时是数字(同类先例:Place.Key 是 int32)。query 里的 person 值恒为字符串
+  // (URL 本身就是文本),用 `===` 直接比较字符串和数字永远不相等,会让存在的人物被误判
+  // 成"不存在"而被静默摘键——这是全区铁律,id 比较必须先 String() 归一。
+  it('id 比较走 String 归一——后端返数字 id 也认', async () => {
+    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 42 }] })
+    const { router } = await mountWithQuery({ person: '42' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.name).toBe('photos-person-detail')
+    expect(router.currentRoute.value.params.id).toBe('42')
+  })
+
+  // usePhotosPeople().fetchPeople() 自身已经把网络失败吞掉(内部 console.error,不
+  // reject)——Vue2 :521-523 的 catch 对应到这里,失败路径与"id 不存在"在这个 store
+  // 实现下走的是同一条分支(people 列表保持为空 → 校验必不命中)。仍然显式测——万一
+  // store 实现变了(fetchPeople 开始 reject),这条要能第一时间失守报警。
+  it('fetchPeople 失败(网络错误):静默摘键,不跳详情、不抛异常', async () => {
+    svc.photos.listPersons.mockRejectedValueOnce(new Error('network'))
+    const { router } = await mountWithQuery({ person: 'x' }, {})
+    await flushPromises()
+    expect(router.currentRoute.value.path).toBe('/photos')
+    expect(router.currentRoute.value.query.person).toBeUndefined()
+  })
+})
+
+describe('usePhotosDeepLinks · 执行顺序(灯箱先开、路由后跳)', () => {
+  // Vue2 :371-377:photoset/asset(开灯箱)在 _applyUrlDeepLinks(改路由)之前执行。
+  // 灯箱路径是异步的(要等 fetchAssetDetail),路由改写路径(?q)本身是同步的——如果不
+  // 显式等灯箱那段结束再跑路由改写,同步的 router.replace 反而会抢在异步取图完成之前
+  // 执行,顺序在实际时序上就颠倒了。用一个手动可控的 pending promise 卡住取图,证明
+  // "取图没完成之前,路由绝不会跳"。
+  it('photoset 与 q 同时存在:先开灯箱、后跳路由', async () => {
+    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
+    let resolveAsset!: (v: unknown) => void
+    const pending = new Promise((resolve) => { resolveAsset = resolve })
+    const { router } = await mountWithQuery(
+      { photoset: 'tok', q: '猫' },
+      {},
+      { getAssetImpl: () => pending as Promise<unknown> },
+    )
+    await flushPromises()
+    // 取图还没 resolve:灯箱没开、路由也不该跳。若顺序颠倒(路由改写先跑),这里
+    // router.replace 已经被同步调用过了,下面这条会先变红。
+    expect(lb.open.value).toBe(false)
+    expect(router.replace).not.toHaveBeenCalled()
+
+    resolveAsset({ id: 'x' })
+    await flushPromises()
+    expect(lb.open.value).toBe(true)
+    expect(router.replace).toHaveBeenCalledWith(
+      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
+    )
+  })
+})
diff --git a/src/photos/composables/usePhotosDeepLinks.ts b/src/photos/composables/usePhotosDeepLinks.ts
index f48afe4..28b896d 100644
--- a/src/photos/composables/usePhotosDeepLinks.ts
+++ b/src/photos/composables/usePhotosDeepLinks.ts
@@ -1,40 +1,50 @@
-// SP7-P8a-T7: 深链 ?asset / ?photoset ——
+// SP7-P8a-T7/T8: 深链 ?asset / ?photoset / ?q / ?album / ?person ——
 // 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377(mounted 里的分发)、
-// :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)。
+// :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)、:491-494(?q,
+// _applyUrlDeepLinks 内)、:509-523(?person,_applyPersonFromQuery)。
+// ?album 的 Vue2 出处不在这个文件——它是 PhotosAlbumsView.vue:264 自己 mounted() 里读的
+// (同页面切面板架构下,只有相册列表视图关心这个键)。New-UI 统一收进本组合式:三个键
+// 都是"/photos?xxx= 兼容入口 → 归一到真实路由"的入口归一,而不是"同页面内切换本地状态"。
 //
 // 挂载约定:usePhotosDeepLinks() 在 /photos 的 setup 里调一次,内部自行 onMounted——
 // 不装路由 watcher。这是一次性交接(?photoset 的 handoff 读完即 removeItem),不是
 // "同路由改查询参数"的场景;装 watcher 会让已被消费掉的 handoff 在后续 query 变化时
-// 被误判成"缺失"而重复触发降级路径。Task 8 会往本文件追加 ?q/?album/?person 三个键,
-// 保持"一个键一个小函数"的结构以便接续。
+// 被误判成"缺失"而重复触发降级路径。保持"一个键一个小函数"的结构。
+//
+// 执行顺序(Vue2 :371-377 的先后手):photoset/asset(开灯箱,不改路由)必须先跑完,
+// q/album/person(改路由)才跑。灯箱那段是异步的(要等 fetchAssetDetail),路由改写
+// 本身是同步的——如果不显式 await 灯箱那段结束,同步的 router.replace 反而会抢在异步
+// 取图完成之前执行,顺序就会在真实时序上颠倒。onMounted 因此包一层 IIFE 顺序 await。
 import { onMounted } from 'vue'
-import { useRoute } from 'vue-router'
+import { useRoute, useRouter } from 'vue-router'
 import type { LocationQueryValue } from 'vue-router'
 import { useI18n } from 'vue-i18n'
 import { service } from '@nimotech/nimoos-service'
 import { useLightbox } from '../lightbox/useLightbox'
+import { usePhotosPeople } from '../stores/people'
 import { useToast } from '../../stores/toast'
 import { assetToPhoto, type Photo } from '../util/assetToPhoto'
 
 const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'
 // 取不到明细时的 toast 停留时长,照 Vue2 :438 / :463 的 duration: 3000。
 const NOT_FOUND_TOAST_MS = 3000
 
 function firstQueryValue(v: LocationQueryValue | LocationQueryValue[]): string {
   return (Array.isArray(v) ? v[0] : v) || ''
 }
 
 export function usePhotosDeepLinks(): void {
   const route = useRoute()
+  const router = useRouter()
   const { t } = useI18n()
   const lb = useLightbox()
   const toast = useToast()
 
   // 按 id 取明细。失败(网络错误 / 404 / 响应假值)统一归为"取不到",不区分原因——
   // 照 Vue2 fetchAssetDetail(NimoOS-UI src/store/modules/photos.js:611-619)的口径:
   // 它自己 catch 后 console.error + 返回 null,调用方按 falsy 处理。
   async function fetchPhoto(id: string): Promise<Photo | null> {
     try {
       const asset = await service.photos.getAsset(id)
       return asset ? assetToPhoto(asset as unknown as Record<string, unknown>) : null
     } catch (e) {
@@ -88,24 +98,98 @@ export function usePhotosDeepLinks(): void {
     const active = activeId && ids.includes(activeId) ? activeId : ids[0]
     const photo = await fetchPhoto(active)
     if (photo) {
       // 翻页集只带 id 的轻量对象——Photo 是 25+ 必填字段的宽接口,用 assetToPhoto({id})
       // 补齐默认值而非 `as unknown as Photo` 强转;灯箱自己会在导航时按需取每张的明细
       // (useLightbox.ts:100-124 的 hydrateDetail)。
       lb.openAt(photo, ids.map((id) => assetToPhoto({ id })))
     } else {
       notFoundToast()
     }
   }
 
-  onMounted(() => {
-    const photosetToken = firstQueryValue(route.query.photoset)
-    const assetId = firstQueryValue(route.query.asset)
-    // 优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个都在时只走
-    // photoset,不是两个都触发)。
-    if (photosetToken) {
-      void openPhotoSetFromQuery(photosetToken, firstQueryValue(route.query.active))
-    } else if (assetId) {
-      void openAssetFromQuery(assetId)
+  // Vue2 :491-494(_applyUrlDeepLinks 内):`?q=<词>` 在 Vue2 里是"开搜索面板 + 就地
+  // 检索",New-UI 有独立的搜索路由(P7a 已建),所以归一成整页重定向:替换掉 `/photos`
+  // 这条兼容 URL,不留在浏览器历史里(用户按后退键该跳出 /photos,不是回到归一前的同页)。
+  // 搜索词原样传递——不 trim、不做任何转码(query 对象层面就是原始字符串,序列化成 URL
+  // 是 vue-router 自己的事,不需要也不应该在这里手工编码)。
+  function redirectSearchFromQuery(term: string): void {
+    router.replace({ path: '/photos/search', query: { q: term } })
+  }
+
+  // ?album=<id>:Vue2 是 PhotosAlbumsView.vue:264 让相册**列表**页自己校验 + 打开,不做
+  // 存在性检查(找不到才会静默清键,但这里 Vue2 从不校验存在——它就是直接赋值)。New-UI
+  // 有真实的相册详情路由,直接跳转,同样不加 Vue2 没有的校验(移植纪律:不做无关"改进"、
+  // 不擅自加校验)。
+  //
+  // 偏离登记(按铁律修正,不照抄):Vue2 那边是"同页面内切换本地状态",从没走过"把 id
+  // 拼进 URL 路径"这一步,所以从没编码过。New-UI 把它变成真实路径跳转后,不编码会让
+  // 含 `/`(或其他路径保留字符)的 id 把路径从中截断,匹配到别的路由甚至匹配失败——
+  // 这是要修的缺陷,不是要保真移植的行为。用具名路由 + params 让 vue-router 自己编码
+  // (encodeParam 对 `/` 也编,效果等价于 encodeURIComponent),优于手拼字符串再调
+  // encodeURIComponent——手拼还要操心两边的百分号编码规则是否完全一致,params 机制
+  // 从"构造/解析"两端都用同一套内部函数,不会出现编码和解码不对称的问题。
+  function redirectAlbumFromQuery(id: string): void {
+    router.replace({ name: 'photos-album-detail', params: { id } })
+  }
+
+  // ?person=<id>:Vue2 :509-523 _applyPersonFromQuery——先等 people 列表就绪,校验 id
+  // 存在才切页,不存在(或拉取失败)都静默清掉 query 里的 person 键、留在原地,不报错
+  // 不提示。
+  async function applyPersonFromQuery(id: string): Promise<void> {
+    const peopleStore = usePhotosPeople()
+    try {
+      await peopleStore.fetchPeople()
+      // id 比较走 String() 归一——全区铁律:后端 id 有时是数字(同类先例 Place.Key 是
+      // int32),query 里的 person 值恒为字符串(URL 本身是文本),`===` 直接比较字符串
+      // 和数字永远不相等,会让存在的人物被误判成"不存在"而被静默摘键。
+      const exists = peopleStore.people.some((p) => String(p.id) === String(id))
+      if (exists) {
+        redirectPersonFromQuery(id)
+      } else {
+        stripPersonFromQuery()
+      }
+    } catch (e) {
+      // Vue2 :521-523 的 catch。防御性兜底——usePhotosPeople().fetchPeople() 自身已经
+      // 把网络失败吞掉(内部 console.error,不 reject),这条 catch 目前不会被触发,留着
+      // 是防 store 实现变化时仍安全(不会让未捕获异常冒出去炸整个 onMounted 链)。
+      console.error('[photos-deeplinks] fetchPeople', e)
+      stripPersonFromQuery()
     }
+  }
+
+  function redirectPersonFromQuery(id: string): void {
+    router.replace({ name: 'photos-person-detail', params: { id } })
+  }
+
+  // 静默摘掉 person 键、留在原地——不动其余 query 键,也不清 path(照 Vue2 mergeQuery
+  // 的语义:只动被摘的那一个键)。
+  function stripPersonFromQuery(): void {
+    const { person, ...rest } = route.query
+    void person
+    router.replace({ path: route.path, query: rest })
+  }
+
+  onMounted(() => {
+    void (async () => {
+      const photosetToken = firstQueryValue(route.query.photoset)
+      const assetId = firstQueryValue(route.query.asset)
+      // 优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个都在时只走
+      // photoset,不是两个都触发)。这段必须先 await 完,q/album/person 的路由改写才能
+      // 跑(见文件头执行顺序说明)。
+      if (photosetToken) {
+        await openPhotoSetFromQuery(photosetToken, firstQueryValue(route.query.active))
+      } else if (assetId) {
+        await openAssetFromQuery(assetId)
+      }
+
+      // q/album/person:三个键各自独立、互不干扰(某个键缺失就跳过对应处理),都是
+      // "改路由"而不是"开灯箱"。
+      const q = firstQueryValue(route.query.q)
+      const albumId = firstQueryValue(route.query.album)
+      const personId = firstQueryValue(route.query.person)
+      if (q) redirectSearchFromQuery(q)
+      if (albumId) redirectAlbumFromQuery(albumId)
+      if (personId) await applyPersonFromQuery(personId)
+    })()
   })
 }
```
