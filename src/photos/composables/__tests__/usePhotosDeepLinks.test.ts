// SP7-P8a-T7/T8: usePhotosDeepLinks —— ?asset / ?photoset / ?q / ?album / ?person 深链。
// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465/
// :491-523;?album 是 PhotosAlbumsView.vue:264 自己 mounted 里读(New-UI 统一收进本组合式)。
//
// 挂载套路照 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts 的既有先例:真实
// useLightbox() 单例、真实 Pinia toast/people store(vi.spyOn)、真实 vue-router(query 走
// router.push,不 mock useRoute)。service.photos.getAsset/listPersons 走
// vi.mock('@nimotech/nimoos-service')。
//
// 断言全部落在 useLightbox() 的真实共享状态(open/list/index/current 等 module 级 ref)
// 上,不 spy openAt 本身——`usePhotosDeepLinks()` 内部另调一次 `useLightbox()` 会拿到一个
// 新的返回对象字面量,vi.spyOn(外层拿到的那个对象, 'openAt') 只替换外层对象自己的属性,
// 不会拦到内部那份引用同一批 module 级函数的调用(踩过一次才发现:第一版这么写,openAt
// 断言全部落空——已改成断言真实状态,顺带更贴合评审要求的"测真实行为,不只测 mock 被调")。
// T8 沿用同一条纪律:?album/?person 的断言落在 router.currentRoute 的真实解析结果上
// (fullPath/name/params/query),不落在 mock 调用参数的字符串形态上——brief 骨架给的
// `router.replace.mock.calls[0][0].path` 断言只适配"手拼字符串路径"的实现;本文件选了
// vue-router 具名路由 + params 的编码机制(见 usePhotosDeepLinks.ts 内注释),该实现下
// replace 的调用参数没有 `.path` 字段,骨架那条断言打不中,改用真实解析后的路由状态断言。
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
// 的既有先例)。T8 追加 listPersons——?person 的存在性校验会真的调用 usePhotosPeople().fetchPeople()。
const svc = vi.hoisted(() => ({
  photos: {
    getAsset: vi.fn(),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    listPersons: vi.fn().mockResolvedValue({ persons: [] }),
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

// T8 目标路由的占位组件——不复用 Host,避免 <router-view> 之外还额外挂一份
// usePhotosDeepLinks()(本文件从不挂 <router-view>,Host 是直接 mount 的,但占位组件仍
// 用最简单的空渲染,减少无关面。real 导航只改 router.currentRoute,不会重新渲染 Host)。
const Blank = defineComponent({ render: () => null })

function makeRouter(): ReturnType<typeof createRouter> {
  const routes: RouteRecordRaw[] = [
    { path: '/photos', name: 'photos', component: Host },
    { path: '/photos/search', name: 'photos-search', component: Blank },
    { path: '/photos/albums/:id', name: 'photos-album-detail', component: Blank },
    { path: '/photos/people/:id', name: 'photos-person-detail', component: Blank },
  ]
  return createRouter({ history: createWebHashHistory('/app/'), routes })
}

// assets: id -> 明细响应(裸 asset 形状,取到即 resolve);不在表里的 id 一律 reject,
// 模拟真实后端 404。opts.getAssetImpl 可整体替换取图实现(T8 的执行顺序用例需要一个可
// 手动 resolve 的 pending promise,套不进"按 id 查表"的默认实现)。
// 返回值追加 router(T7 的既有调用点不解构返回值,不受影响)——T8 的用例要断言真实
// router.replace 调用 / router.currentRoute 解析结果。
async function mountWithQuery(
  query: Record<string, string>,
  assets: Record<string, { id: string }> = {},
  opts?: { getAssetImpl?: (id: string) => Promise<unknown> },
) {
  if (opts?.getAssetImpl) {
    svc.photos.getAsset.mockImplementation(opts.getAssetImpl)
  } else {
    svc.photos.getAsset.mockImplementation(async (id: string) => {
      if (id in assets) return assets[id]
      throw new Error(`not found: ${id}`)
    })
  }
  const router = makeRouter()
  await router.push({ path: '/photos', query })
  await router.isReady()
  // 先完成初始导航,再挂 spy——不然"进入 /photos"这次 push 本身也会被记进 spy,
  // 污染"组合式内部有没有调用 push/replace"的断言。
  vi.spyOn(router, 'replace')
  vi.spyOn(router, 'push')
  const wrapper = mount(Host, { global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.getAsset.mockReset()
  svc.photos.recordView.mockClear()
  svc.photos.listFavoriteIds.mockClear()
  svc.photos.listPersons.mockReset()
  svc.photos.listPersons.mockResolvedValue({ persons: [] })
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
    await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(1)
    expect(lb.list.value[0].id).toBe('a1')
    expect(lb.current.value?.id).toBe('a1')
    // 单张成集意味着 prev/next 都是 no-op。
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(false)
  })

  it('取不到明细:弹 not-found toast,不开灯箱', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await mountWithQuery({ asset: 'ghost' }, {})
    await flushPromises()
    expect(lb.open.value).toBe(false)
    expect(showSpy).toHaveBeenCalledWith('未找到该图片', 3000)
  })
})

describe('usePhotosDeepLinks · ?photoset', () => {
  it('读到 ids 后立刻 removeItem(一次性交接,取明细之前就已消费)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    // 不 flushPromises——removeItem 发生在 consumePhotosetHandoff 内的同步代码段,
    // 在 fetchPhoto 的 await 之前,mount() 一返回就该已经执行过。
    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull()
  })

  it('翻页集是全部 ids 的轻量对象,active 打头显示', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(lb.index.value).toBe(1) // active='b' 打头显示 = list 里下标 1
    expect(lb.current.value?.id).toBe('b')
  })

  it('active 不在 ids 里时取 ids[0](Vue2 :456)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x', 'y'] }))
    await mountWithQuery({ photoset: 'tok', active: 'not-in-list' }, { x: { id: 'x' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.current.value?.id).toBe('x')
    expect(lb.index.value).toBe(0)
    expect(svc.photos.getAsset).toHaveBeenCalledWith('x')
  })

  it('handoff 缺失:降级成 ?asset 行为(用 active,单张成集)', async () => {
    await mountWithQuery({ photoset: 'gone', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(1)
    expect(lb.list.value[0].id).toBe('b')
    expect(lb.hasPrev.value).toBe(false)
    expect(lb.hasNext.value).toBe(false)
  })

  it('handoff 缺失且无 active:什么都不做,不弹 toast', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await mountWithQuery({ photoset: 'gone' }, {})
    await flushPromises()
    expect(lb.open.value).toBe(false)
    expect(showSpy).not.toHaveBeenCalled()
    expect(svc.photos.getAsset).not.toHaveBeenCalled()
  })

  it('localStorage 抛异常时吞掉,不带崩页面,并按"handoff 缺失"降级', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    // 若吞不掉(如变异验证④删掉 try/catch),openPhotoSetFromQuery 会在
    // consumePhotosetHandoff 处直接 reject——mount() 本身不会同步抛(async 函数体内的
    // 抛出会被包成 rejected promise,不会同步冒到这里),但降级路径也就走不到,下面的
    // 灯箱状态断言会落空、变红。
    await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    getItemSpy.mockRestore()
    await flushPromises()
    // 异常被吞掉后 ids=[] → 走"handoff 缺失"降级路径,用 active 打开单张。
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(1)
    expect(lb.list.value[0].id).toBe('b')
  })

  it('photoset 与 asset 同时存在时只走 photoset(Vue2 :370-374 的 if/else if)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
    await mountWithQuery({ photoset: 'tok', asset: 'a1' }, { x: { id: 'x' }, a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
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

// SP7-P8a-T8:?q / ?album / ?person。回源 Vue2 PhotosTimeline.vue:491-494(?q)、
// PhotosAlbumsView.vue:264(?album,该视图自己 mounted 里读)、PhotosTimeline.vue:509-523
// (?person,_applyPersonFromQuery)。
//
// 三式都是"改路由"(与 ?asset/?photoset 的"开灯箱、不改路由"相对),统一走
// router.replace——这是入口归一,不该在浏览器历史里留下 `/photos?q=`/`?album=`/`?person=`
// 这条兼容态记录(用户按后退键应该跳出 /photos,不是回到还没归一之前的同一页)。
describe('usePhotosDeepLinks · ?q', () => {
  it('重定向到 /photos/search?q=,用 replace 不用 push', async () => {
    const { router } = await mountWithQuery({ q: '猫' }, {})
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('原样保留搜索词——含首尾空格与非 ASCII,不 trim 不转码', async () => {
    const term = '  猫 咪  '
    const { router } = await mountWithQuery({ q: term }, {})
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: term } }),
    )
  })
})

describe('usePhotosDeepLinks · ?album', () => {
  it('跳转到相册详情路由', async () => {
    const { router } = await mountWithQuery({ album: 'al1' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-album-detail')
    expect(router.currentRoute.value.params.id).toBe('al1')
    expect(router.push).not.toHaveBeenCalled()
  })

  // Vue2 PhotosAlbumsView.vue:264 的 _applyRouteAlbum 对 id 未做任何 URL 编码就直接赋值
  // 给组件本地状态(它从没走过"拼路径"这一步,同页面切面板不需要编码)。New-UI 把它变成
  // 真实路径跳转后,不编码会让含 `/` 的 id 把路径截断成两段、匹配到完全不同的路由甚至
  // 匹配失败——这是移植纪律要求"不照抄 Vue2 缺陷"的一条:改成正确编码,并在实现文件里
  // 登记这条偏离。用具名路由 + params 让 vue-router 自己编码(encodeParam 对 `/` 也编,
  // 效果等价于 encodeURIComponent),而不是手拼字符串再调 encodeURIComponent。
  it('id 含 / 时做 URL 编码,不截断路径(Vue2 未编码是缺陷,已修)', async () => {
    const { router } = await mountWithQuery({ album: 'a/b' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-album-detail')
    // 具名路由跳转后 vue-router 会把编码后的路径段自动解码回原值,params.id 应该是
    // 原始未编码字符串——证明"跳对了地方",不是"跳到了一个恰好长得像的坏地址"。
    expect(router.currentRoute.value.params.id).toBe('a/b')
    // fullPath 是真实序列化出来的 URL,必须能看到编码后的斜杠(%2F),否则说明路径
    // 是手拼未编码字符串、后端/路由匹配层面其实截断了。
    expect(router.currentRoute.value.fullPath).toContain(encodeURIComponent('a/b'))
  })
})

describe('usePhotosDeepLinks · ?person', () => {
  it('存在:校验通过后跳详情路由', async () => {
    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'p1' }] })
    const { router } = await mountWithQuery({ person: 'p1' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-person-detail')
    expect(router.currentRoute.value.params.id).toBe('p1')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('不存在:静默摘掉 person 键、留在原地,不跳详情、不弹 toast(其余 query 键保留)', async () => {
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 'someone-else' }] })
    const { router } = await mountWithQuery({ person: 'ghost', view: 'people' }, {})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query).toEqual({ view: 'people' })
    expect(showSpy).not.toHaveBeenCalled()
  })

  // 后端 id 有时是数字(同类先例:Place.Key 是 int32)。query 里的 person 值恒为字符串
  // (URL 本身就是文本),用 `===` 直接比较字符串和数字永远不相等,会让存在的人物被误判
  // 成"不存在"而被静默摘键——这是全区铁律,id 比较必须先 String() 归一。
  it('id 比较走 String 归一——后端返数字 id 也认', async () => {
    svc.photos.listPersons.mockResolvedValueOnce({ persons: [{ id: 42 }] })
    const { router } = await mountWithQuery({ person: '42' }, {})
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-person-detail')
    expect(router.currentRoute.value.params.id).toBe('42')
  })

  // usePhotosPeople().fetchPeople() 自身已经把网络失败吞掉(内部 console.error,不
  // reject)——Vue2 :521-523 的 catch 对应到这里,失败路径与"id 不存在"在这个 store
  // 实现下走的是同一条分支(people 列表保持为空 → 校验必不命中)。仍然显式测——万一
  // store 实现变了(fetchPeople 开始 reject),这条要能第一时间失守报警。
  it('fetchPeople 失败(网络错误):静默摘键,不跳详情、不抛异常', async () => {
    svc.photos.listPersons.mockRejectedValueOnce(new Error('network'))
    const { router } = await mountWithQuery({ person: 'x' }, {})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos')
    expect(router.currentRoute.value.query.person).toBeUndefined()
  })
})

describe('usePhotosDeepLinks · 执行顺序(灯箱先开、路由后跳)', () => {
  // Vue2 :371-377:photoset/asset(开灯箱)在 _applyUrlDeepLinks(改路由)之前执行。
  // 灯箱路径是异步的(要等 fetchAssetDetail),路由改写路径(?q)本身是同步的——如果不
  // 显式等灯箱那段结束再跑路由改写,同步的 router.replace 反而会抢在异步取图完成之前
  // 执行,顺序在实际时序上就颠倒了。用一个手动可控的 pending promise 卡住取图,证明
  // "取图没完成之前,路由绝不会跳"。
  it('photoset 与 q 同时存在:先开灯箱、后跳路由', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
    let resolveAsset!: (v: unknown) => void
    const pending = new Promise((resolve) => { resolveAsset = resolve })
    const { router } = await mountWithQuery(
      { photoset: 'tok', q: '猫' },
      {},
      { getAssetImpl: () => pending as Promise<unknown> },
    )
    await flushPromises()
    // 取图还没 resolve:灯箱没开、路由也不该跳。若顺序颠倒(路由改写先跑),这里
    // router.replace 已经被同步调用过了,下面这条会先变红。
    expect(lb.open.value).toBe(false)
    expect(router.replace).not.toHaveBeenCalled()

    resolveAsset({ id: 'x' })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })
})

// 真机验收反馈修正(2026-08-04):在时间线上直接改地址栏 query(不重新打开标签页),
// 原实现五式全部没反应——vue-router 4 对同一路由组件只 query 变化不重新 mount,
// onMounted 那次够不到这种情形。以下每个键补一条"已经停留在 /photos,之后才出现该
// query"的用例:用同一个 router 实例 `router.push({ path: '/photos', query })`,不
// 重新 mount Host(与 PhotosSettings.test.ts 的 `已停留在本页时 query 才变为
// ?section=ai` 用例是同一手法)。
describe('usePhotosDeepLinks · query-only(已停留在 /photos,之后才出现该 query)', () => {
  it('?q query-only:watch 路径补上重定向', async () => {
    const { router } = await mountWithQuery({}, {})
    await flushPromises()
    expect(router.replace).not.toHaveBeenCalled()
    // 这次 push 是测试在模拟"用户手改地址栏"这个动作本身(vue-router 层面地址栏编辑
    // 就是一次 push/replace 到同路由不同 query),不是断言组合式内部用了 push——组合式
    // 内部有没有用 replace 由下面对 router.replace 的断言单独锁住。
    await router.push({ path: '/photos', query: { q: '猫' } })
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })

  it('?album query-only:watch 路径补上路由跳转', async () => {
    const { router } = await mountWithQuery({}, {})
    await flushPromises()
    await router.push({ path: '/photos', query: { album: 'al1' } })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-album-detail')
    expect(router.currentRoute.value.params.id).toBe('al1')
  })

  it('?person query-only:watch 路径补上校验 + 跳转', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 'p1' }] })
    const { router } = await mountWithQuery({}, {})
    await flushPromises()
    await router.push({ path: '/photos', query: { person: 'p1' } })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('photos-person-detail')
    expect(router.currentRoute.value.params.id).toBe('p1')
  })

  it('?asset query-only:watch 路径补上开灯箱', async () => {
    const { router } = await mountWithQuery({}, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(false)
    await router.push({ path: '/photos', query: { asset: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a1'])
  })

  it('?photoset query-only:watch 路径补上开灯箱(读一次性交接、消费 localStorage)', async () => {
    const { router } = await mountWithQuery({}, { y: { id: 'y' } })
    await flushPromises()
    expect(lb.open.value).toBe(false)
    localStorage.setItem('nimo:photoset:tok2', JSON.stringify({ ids: ['x', 'y'] }))
    await router.push({ path: '/photos', query: { photoset: 'tok2', active: 'y' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['x', 'y'])
    expect(lb.current.value?.id).toBe('y')
    expect(localStorage.getItem('nimo:photoset:tok2')).toBeNull()
  })

  // 🔴 requirement 2 的核心用例:一次性交接消费之后,编辑一个毫不相关的 query 键
  // (?q)绝不能让 photoset 分支被误判成"缺失"而重新走降级路径(把灯箱内容缩成
  // active 单张)。这正是原裁决"禁止 watcher"的理由,现在靠"逐键比较、只处理真的
  // 变了的那个键"来解禁——这条用例就是证明。
  it('consumed handoff 之后编辑不相关的 ?q:不重新触发降级,灯箱内容保持不变', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['a', 'b', 'c'] }))
    const { router } = await mountWithQuery({ photoset: 'tok', active: 'b' }, { b: { id: 'b' } })
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(localStorage.getItem('nimo:photoset:tok')).toBeNull() // 已消费

    const callsBefore = svc.photos.getAsset.mock.calls.length
    await router.push({ path: '/photos', query: { photoset: 'tok', active: 'b', q: '猫' } })
    await flushPromises()

    // 若 watcher 对"任何 query 变化"都整体重跑五式,这里 photoset 分支会因为 handoff
    // 已经被消费(localStorage 里已经没有了)而误判成"缺失",降级成只开 active 单张——
    // 灯箱内容会从三张缩成一张、且会为 'b' 重新发一次 getAsset。用内容 + 调用次数一起
    // 证明它没有被误触发,同时证明真正变化的 ?q 确实被正常处理了。
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(svc.photos.getAsset.mock.calls.length).toBe(callsBefore)
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })

  // requirement 4:从地址栏删除 ?asset(值变成 undefined)必须是 no-op——不弹 toast、
  // 不关灯箱、不重新取图。
  it('?asset 被从地址栏删除(undefined)是 no-op:不弹 toast、不关灯箱', async () => {
    const { router } = await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const callsBefore = svc.photos.getAsset.mock.calls.length

    await router.push({ path: '/photos', query: {} })
    await flushPromises()

    expect(lb.open.value).toBe(true) // 仍是原来那张,没被关掉
    expect(lb.list.value[0]?.id).toBe('a1')
    expect(svc.photos.getAsset.mock.calls.length).toBe(callsBefore)
    expect(showSpy).not.toHaveBeenCalled()
  })

  // requirement 3:?asset/?photoset 不改路由、只开灯箱——组件不会因为它们而卸载,
  // watcher 会一直活着。必须确认"第二次毫不相关的 query 变化"不会把灯箱在同一张
  // asset 上重新打开一次(取图不该被重新调用)。
  it('?asset 值没变、只是另一个键(?q)变了:灯箱不重新打开、getAsset 不重新调用', async () => {
    const { router } = await mountWithQuery({ asset: 'a1' }, { a1: { id: 'a1' } })
    await flushPromises()
    expect(lb.open.value).toBe(true)
    const callsBefore = svc.photos.getAsset.mock.calls.length

    await router.push({ path: '/photos', query: { asset: 'a1', q: '猫' } })
    await flushPromises()

    expect(svc.photos.getAsset.mock.calls.length).toBe(callsBefore)
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
  })
})
