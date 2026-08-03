// SP7-P8a-T7: usePhotosDeepLinks —— ?asset / ?photoset 深链。
// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377/:431-440/:441-465。
//
// 挂载套路照 Photos.lightbox.test.ts / PhotosPlaceAssets.test.ts 的既有先例:真实
// useLightbox() 单例、真实 Pinia toast store(vi.spyOn)、真实 vue-router(query 走
// router.push,不 mock useRoute)。service.photos.getAsset 走 vi.mock('@nimotech/nimoos-service')。
//
// 断言全部落在 useLightbox() 的真实共享状态(open/list/index/current 等 module 级 ref)
// 上,不 spy openAt 本身——`usePhotosDeepLinks()` 内部另调一次 `useLightbox()` 会拿到一个
// 新的返回对象字面量,vi.spyOn(外层拿到的那个对象, 'openAt') 只替换外层对象自己的属性,
// 不会拦到内部那份引用同一批 module 级函数的调用(踩过一次才发现:第一版这么写,openAt
// 断言全部落空——已改成断言真实状态,顺带更贴合评审要求的"测真实行为,不只测 mock 被调")。
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
// 的既有先例)。
const svc = vi.hoisted(() => ({
  photos: {
    getAsset: vi.fn(),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
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

function makeRouter(): ReturnType<typeof createRouter> {
  const routes: RouteRecordRaw[] = [{ path: '/photos', name: 'photos', component: Host }]
  return createRouter({ history: createWebHashHistory('/app/'), routes })
}

// assets: id -> 明细响应(裸 asset 形状,取到即 resolve);不在表里的 id 一律 reject,
// 模拟真实后端 404。
async function mountWithQuery(query: Record<string, string>, assets: Record<string, { id: string }> = {}) {
  svc.photos.getAsset.mockImplementation(async (id: string) => {
    if (id in assets) return assets[id]
    throw new Error(`not found: ${id}`)
  })
  const router = makeRouter()
  await router.push({ path: '/photos', query })
  await router.isReady()
  const wrapper = mount(Host, { global: { plugins: [router] } })
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.getAsset.mockReset()
  svc.photos.recordView.mockClear()
  svc.photos.listFavoriteIds.mockClear()
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
