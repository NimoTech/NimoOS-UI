// SP7-P7a-T16: views/PhotosSearch.vue —— 搜索容器接线(路由 /photos/search)。
// 逐条对应 task-16-brief.md「必含用例」清单(Step 1)。
//
// 测试策略:usePhotosSearch/usePhotosPeople/usePhotosAlbums/usePhotosSmartViews 全部用
// 真实 store(spyOn 而不 mock,以便 matchesQuery/isSearchMode 等派生状态是真实推导出来
// 的),只 mock 共享包 service。useLightbox 是模块级单例,同 PhotosSmartViewDetail.test.ts
// 的既有手法直接 mock 整个模块。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    smartSearch: vi.fn().mockResolvedValue([]),
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    listAlbums: vi.fn().mockResolvedValue([]),
    getAlbum: vi.fn().mockResolvedValue({ assets: [] }),
    createSmartView: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver: unknown) => `mock://face/${id}/${ver}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const lbMock = vi.hoisted(() => ({ openAt: vi.fn() }))
vi.mock('../../photos/lightbox/useLightbox', () => ({ useLightbox: () => lbMock }))

import PhotosSearch from '../PhotosSearch.vue'
import photosSearchRaw from '../PhotosSearch.vue?raw'
import routerRaw from '../../router/index.ts?raw'
import { usePhotosSearch } from '../../photos/stores/search'
import { usePhotosPeople } from '../../photos/stores/people'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useToast } from '../../stores/toast'
import { router as appRouter } from '../../router'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from '../../photos/components/__tests__/cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })

function makeRouter(initial = '/photos/search') {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: { template: '<div/>' } },
      // SP15-P2b Task 5: onSaved()'s toast action now lands here instead of smart-views.
      { path: '/photos/albums', name: 'photos-albums-stub', component: { template: '<div/>' } },
    ],
  })
  router.push(initial)
  return router
}

function rawAsset(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    takenAt: '2026-01-10T10:00:00Z',
    mimeType: 'image/jpeg',
    originalName: `${id}.jpg`,
    matchScore: 0.9,
    faces: [] as string[],
    hasOcr: false,
    belowCut: false,
    ...overrides,
  }
}

// fix round 1 · M10 连带修正:`attachTo` 缺省是"不挂进真实 document"——vue-test-utils
// 默认把组件挂进一棵游离的 DOM 树,`element.dispatchEvent(new MouseEvent(..., {bubbles:
// true}))` 只在这棵游离树内部冒泡,永远到不了真实 `document` 上的监听器(不管子组件的
// `document.addEventListener('mousedown', ...)` 逻辑对不对)。之前 M10 的 ignoreEl 用例
// 就是因为这个原因"删了 ignoreEl 也不会红"——不是断言错了,是事件压根没送到监听器那里。
// 这里默认挂进 `document.body`。
// fix round 2 · Minor#3(评审并入,先例引用查实是错的,已改正):第一版这里写"先例见
// `Photos.lightbox.test.ts` 一类"——回源 grep 该文件全文没有 `attachTo`/`document.body`
// 字样,引用是错的。真实先例是 `ClusterActionDialog.test.ts:52` / `PersonHero.test.ts:50`
// / `PlacesThemeMenu.test.ts:33`(三者都用 `attachTo: document.body` + 一个模块级数组
// 记录挂载实例、`afterEach`/`beforeEach` 里统一清理的同款手法)。
//
// 挂进真实 `document.body` 后必须显式 `unmount()`(触发各子组件的 `onUnmounted`,摘掉它
// 们各自注册的 `document` 级 keydown/mousedown 监听器),否则跨测试残留的监听器会在
// 后续用例里对已经"作废"的组件实例重复触发、并让 DOM 节点在整个文件运行期间持续堆积。
// 用一个模块级数组记录**每次经由 `mountSearch()` 挂载**的 wrapper + 容器元素,统一在
// `afterEach` 里清理——注意这个数组只覆盖走这个助手函数的挂载;本文件另有一处不经过
// `mountSearch()` 的裸 `mount()`(浮层:Esc 统一治理 / 「隔离子组件兜底」用例),那一处
// 用 `try/finally` 自己保证 `unmount()`(fix round 2 · Minor#2 引入,fix round 3 · #3
// 改成 try/finally 以免断言先失败时漏清理),不进这个数组。
const mountedInstances: Array<{ w: ReturnType<typeof mount>; el: HTMLElement }> = []
async function mountSearch(path = '/photos/search') {
  const router = makeRouter(path)
  await router.isReady()
  const el = document.createElement('div')
  document.body.appendChild(el)
  const w = mount(PhotosSearch, { global: { plugins: [i18n, router] }, attachTo: el })
  mountedInstances.push({ w, el })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.smartSearch.mockReset().mockResolvedValue([])
  svc.photos.listPersons.mockReset().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.listAlbums.mockReset().mockResolvedValue([])
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.createSmartView.mockReset()
  lbMock.openAt.mockClear()
})
afterEach(() => {
  usePhotosSearch().__resetForTest()
  usePhotosPeople().__resetForTest()
  usePhotosAlbums().__resetForTest()
  vi.restoreAllMocks()
  // 见 mountSearch 头部注释:挂进真实 document.body 的实例必须显式 unmount + 移除容器,
  // 否则 document 级监听器与 DOM 节点会跨测试残留、累积到整个文件运行期间。
  for (const { w, el } of mountedInstances) {
    w.unmount()
    el.remove()
  }
  mountedInstances.length = 0
})

// ── 路由 query 驱动(结构规格 7)────────────────────────────────────────────
describe('路由 query 驱动', () => {
  it('挂载时 route.query.q="abc" → smartSearch 被调用一次,参数是 "abc"', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    await mountSearch('/photos/search?q=abc')
    expect(spy).toHaveBeenCalledWith('abc')
  })

  it('q 改成 "def" → 再调一次,且 clearAll 生效(chip 过滤被清)', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    const { w, router } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    // 先真的选中并提交一个过滤(type=OCR),确认它在换词后被清空——只开弹层不 Apply
    // 不构成"过滤生效"的证据(chipActive 判据看的是 filters,不是 openPop)。
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    expect(w.get('[data-test="chip-type"] .fchip').attributes('data-on')).toBe('true')
    await router.push('/photos/search?q=def')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('def')
    expect(w.get('[data-test="chip-type"] .fchip').attributes('data-on')).toBe('false')
  })

  it('q 变空 → store.clear() 被调(store 落回未搜索态)', async () => {
    const { router } = await mountSearch('/photos/search?q=abc')
    const search = usePhotosSearch()
    await flushPromises()
    expect(search.isSearchMode).toBe(true)
    await router.push('/photos/search')
    await flushPromises()
    expect(search.isSearchMode).toBe(false)
  })

  it('smartSearch 不传 filters(第二参未传,恒为 store 默认值)', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    await mountSearch('/photos/search?q=abc')
    expect(spy.mock.calls[0].length).toBe(1)
  })

  // fix round 1 · M15(fix round 2 · Minor#4 补覆盖,评审并入):`router.replace` 到
  // 同一个 route(path 与 query 都不变)时 vue-router 视为无导航,`query` 这个 computed
  // 不会变化,主 watcher 也就不会重新调用 `smartSearch`——"同一个词再提交一次想强制
  // 刷新结果"会静默失效。`submitQuery` 里补了一条捷径:目标词与当前路由 `q` 完全相同时
  // 跳过路由、直接再调一次 `smartSearch`。这里断言:提交两次相同的词,`smartSearch`
  // 被调用两次(不是只调一次,更不是被静默吞掉)。
  it('同一个词再提交一次(M15)→ smartSearch 被再调一次,不会因路由不变而静默失效', async () => {
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'smartSearch')
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(2, 'abc')
  })
})

// ── §7e-3:query 是只读 computed,源文本里不应有对它的赋值 ─────────────────
describe('§7e-3:不给 query 赋值', () => {
  it('源文本不含 "query.value =" 这种赋值写法', () => {
    expect(photosSearchRaw).not.toMatch(/query\.value\s*=(?!=)/)
  })
})

// ── 预搜索态 ─────────────────────────────────────────────────────────────
describe('预搜索态', () => {
  it('q 为空 → .search-prestate 在、hero 不在', async () => {
    const { w } = await mountSearch('/photos/search')
    expect(w.find('.search-prestate').exists()).toBe(true)
    expect(w.find('[data-test="search-hero"]').exists()).toBe(false)
  })

  it('history 有 3 条 → 3 个 .prestate-chip;点一个 → router.replace 带那个词', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['c', 'b', 'a']))
    const { w, router } = await mountSearch('/photos/search')
    const chips = w.findAll('[data-test="prestate-chip"]')
    expect(chips).toHaveLength(3)
    const replaceSpy = vi.spyOn(router, 'replace')
    await chips[1].trigger('click')
    expect(replaceSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'b' } })
  })
})

// ── hero ─────────────────────────────────────────────────────────────────
describe('hero', () => {
  it('queryParts 生效:含 .kw 高亮元素', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a')])
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    await flushPromises()
    expect(w.find('.search-query .kw').exists()).toBe(true)
  })

  it('searching 为真时 .search-meta 不在;为假时在,且 seconds 是 (ms/1000).toFixed(2)', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.smartSearch.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountSearch('/photos/search?q=abc')
    // 请求仍在途:searching 为真,search-meta 不应存在。
    expect(w.find('[data-test="search-meta"]').exists()).toBe(false)
    resolveFn!([rawAsset('a')])
    await flushPromises()
    await w.vm.$nextTick()
    const meta = w.get('[data-test="search-meta"]')
    const search = usePhotosSearch()
    const expectedSeconds = (search.ms / 1000).toFixed(2)
    expect(meta.text()).toContain(expectedSeconds)
  })

  it('第 13 条缺陷守卫:query "my videos" → understood 的 <b> 文本是中文"视频",不是 "Videos"', async () => {
    const { w } = await mountSearch('/photos/search?q=my%20videos')
    const vals = w.findAll('[data-test="understood-v"]').map((n) => n.text())
    expect(vals).toContain(zh.photosSearchTypeVideos)
    expect(vals).not.toContain('Videos')
  })
})

// ── 5 个 chip ────────────────────────────────────────────────────────────
describe('chip 栏', () => {
  it('5 个 chip 按 date/people/place/album/type 顺序渲染', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    const wraps = w.findAll('.filterbar > .fchip-wrap')
    expect(wraps).toHaveLength(5)
    expect(w.find('[data-test="chip-date"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-people"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-place"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-album"]').exists()).toBe(true)
    expect(w.find('[data-test="chip-type"]').exists()).toBe(true)
  })

  it('点 chip → 对应弹层出现;再点 → 关', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    expect(w.find('.cal').exists()).toBe(true) // SearchDatePopover 的日历
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    expect(w.find('.cal').exists()).toBe(false)
  })

  it('People chip → SearchPeoplePopover 的人脸网格出现', async () => {
    svc.photos.listPersons.mockResolvedValue({
      persons: [{ id: 1, name: 'Sara', count: 5 }],
      facesIndexedUpTo: null,
    })
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    expect(w.find('.face-pop-grid').exists()).toBe(true)
  })

  it('Places / Albums / File type 三个都是 PhotosFilterPopover(.fpop-list)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'Trip' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a', { placeName: 'Tokyo, Japan' })])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()

    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    expect(w.find('.fpop-list').exists()).toBe(true)
    expect(w.text()).toContain('Tokyo')
    await w.get('[data-test="chip-place"] .fchip').trigger('click')

    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    expect(w.find('.fpop-list').exists()).toBe(true)
    expect(w.text()).toContain('Trip')
    await w.get('[data-test="chip-album"] .fchip').trigger('click')

    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    expect(w.find('.fpop-list').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosSearchTypeOcr)
  })
})

// ── draft 语义 ───────────────────────────────────────────────────────────
describe('draft 语义(Apply/Cancel/点外部)', () => {
  it('开 place 弹层 → 勾一项 → filteredResults 未变(未提交);点 Apply → 变', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(2)

    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // 勾选第一个地点
    expect(w.findAll('.tile')).toHaveLength(2) // 未提交,结果不变
  })

  it('draft 勾选后点 Apply → 结果收窄为 1', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click') // Apply
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.get('[data-test="chip-place"] .fchip').attributes('data-on')).toBe('true')
  })

  it('开弹层勾选后点 Cancel → filters 未变', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.fpop-quick').trigger('click') // Cancel(fpop-quick 的第一个是 Cancel)
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.get('[data-test="chip-place"] .fchip').attributes('data-on')).toBe('false')
  })

  it('点弹层外部 → 同样丢弃(不提交 draft)', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan' }),
      rawAsset('b', { placeName: 'Osaka, Japan' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop-list').exists()).toBe(false) // 弹层已关
    expect(w.findAll('.tile')).toHaveLength(2) // 未提交
  })
})

// ── filteredResults 五种过滤 + 组合 ────────────────────────────────────────
describe('filteredResults', () => {
  it('未设置 type 过滤时三种资产都在(基线,先确认 fixture 本身没问题)', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(3)
  })

  // fix round 1 · I6(评审查实的真缺陷,Important):上面这条改名前叫「三分支各筛出预期
  // 条数」,但从未真的设置过 `filters.type`——只断言了"不过滤时 3 张都在"。评审把三个
  // type 分支的谓词全部取反,49/49 仍全绿。这里补三条真正设置 `filters.type` 的用例
  // (通过 type chip 的 PhotosFilterPopover 选中对应项 → Apply),brief Step 1 明确要求
  // "五种过滤各一条"。type chip 的 items 固定顺序是 `['Photos','OCR','Videos']`
  // (`TYPE_ITEMS`),`.fpop-item` 按同一顺序渲染,按下标选择对应项。
  it('type=Photos(下标 0)→ 只剩非视频、非 OCR 的照片', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.findAll('.fpop-item')[0].trigger('click') // Photos
    await w.get('.btn.btn-primary').trigger('click')
    const ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids).toHaveLength(1)
    expect(ids[0]).toContain('/photo1/')
  })

  it('type=OCR(下标 1)→ 只剩 hasOcr 的资产', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.findAll('.fpop-item')[1].trigger('click') // OCR
    await w.get('.btn.btn-primary').trigger('click')
    const ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids).toHaveLength(1)
    expect(ids[0]).toContain('/ocr1/')
  })

  it('type=Videos(下标 2)→ 只剩 isVideo 的资产', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-type"] .fchip').trigger('click')
    await w.findAll('.fpop-item')[2].trigger('click') // Videos
    await w.get('.btn.btn-primary').trigger('click')
    const ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids).toHaveLength(1)
    expect(ids[0]).toContain('/vid1/')
  })

  // fix round 1 · M9(评审并入,E7 排序契约需要断言):之前三处 fixture 都只放 1 个人,
  // 排序反过来也测不出。这里放 2 个不同计数的人,断言 face-cell 的渲染顺序按计数降序。
  it('People 弹层渲染顺序按人脸计数降序(M9)', async () => {
    svc.photos.listPersons.mockResolvedValue({
      persons: [
        { id: 1, name: 'Low', count: 2 },
        { id: 2, name: 'High', count: 9 },
      ],
      facesIndexedUpTo: null,
    })
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    const names = w.findAll('.face-cell-name').map((n) => n.text())
    expect(names).toEqual(['High', 'Low'])
  })

  it('people 过滤:faces 数组含选中人名才保留', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { faces: ['Sara'] }),
      rawAsset('b', { faces: ['Bob'] }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    await w.get('.face-cell').trigger('click')
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('date 过滤:dateInRange 按 takenAt 收窄', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { takenAt: '2026-01-10T10:00:00Z' }),
      rawAsset('b', { takenAt: '2020-01-10T10:00:00Z' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    await w.get('.fpop-quick[data-on]').trigger('click') // 点第一个快捷区间(Today,大概率不含以上两个日期,验证收窄发生)
    await w.get('.btn.btn-primary').trigger('click')
    expect(w.findAll('.tile').length).toBeLessThan(2)
  })

  it('place 过滤 + people 过滤同时生效(组合)', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('a', { placeName: 'Tokyo, Japan', faces: ['Sara'] }),
      rawAsset('b', { placeName: 'Tokyo, Japan', faces: ['Bob'] }),
      rawAsset('c', { placeName: 'Osaka, Japan', faces: ['Sara'] }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-place"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // 选 Tokyo(排第一,频次高)
    await w.get('.btn.btn-primary').trigger('click')
    await w.get('[data-test="chip-people"] .fchip').trigger('click')
    await w.get('.face-cell').trigger('click')
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(1) // 只有 a 同时满足 Tokyo + Sara
  })
})

// ── filters.album ──────────────────────────────────────────────────────
describe('filters.album', () => {
  it('选中相册 → fetchAlbumAssets 被调、结果按相册资产收窄', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    svc.photos.getAlbum.mockResolvedValue({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.getAlbum).toHaveBeenCalledWith(9)
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  // fix round 2 · Important#1(评审查实的新回归,fix round 1 引入):选相册 Apply 的
  // 那一瞬间,`getAlbum` 请求通常还没落地——这是"首次按相册过滤"的常规路径,不是极端
  // 时序。此前的 computed 设计用 `assetsOf(id)` 的返回值判断"该不该过滤",但"缓存槽
  // 还没建立"与"缓存槽已建立、内容恰好是空数组"在 `assetsOf` 的返回值上长得一模一样
  // (都是 `[]`),导致在途窗口里 `albumAssetIds` 被误判成空 Set,`filteredResults`
  // 瞬间归零,`.empty-search`(orb + "无匹配" + 条件 chips)整块闪现,直到请求真正落地
  // 才恢复——这条用例断言"在途窗口不应该发生这件事"(照 Vue2 `:593-602` 的口径:在途
  // 期间不过滤,而不是过滤成空集)。
  it('相册过滤在途窗口(getAlbum 尚未 resolve)不应把结果打成空集 / 闪现空态', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    let resolveGet: ((v: unknown) => void) | undefined
    svc.photos.getAlbum.mockImplementation(() => new Promise((res) => { resolveGet = res }))
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    // 请求仍在途(resolveGet 还没被调用)——不应该归零、也不应该出现空态。
    expect(w.find('[data-test="empty-search"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(2)
    // 请求这时才真正落地,结果应该精确收窄。
    resolveGet!({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  // fix round 3 · #1(评审查实的零覆盖缺口,真实功能缺陷级别的护栏缺失):
  // "缓存槽不存在(in)" vs "缓存槽已落地但内容是空数组(.length===0)"这条判据此前只有
  // 上面那条在途用例(断言"还没落地"这一半),**没有任何用例断言"已经落地、且这个相册
  // 真的没有照片"这一半**——把 computed 里的 `in` 判据换成 `assetsOf(id).length===0`
  // 之后仍返回同一批 72 个用例全绿,因为没有一条用例走到"相册真实存在、请求已经真正
  // 落地、返回的资产列表恰好是空数组"这个具体状态。这里把它补上、并顺带断言 `getAlbum`
  // 确实被调用过(排除"请求压根没发起,凑巧也是空数组"这种假阳性)。
  it('相册确实存在但资产为空(请求已落地)→ 结果为空集 + 空态出现(不是在途误判)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    svc.photos.getAlbum.mockResolvedValue({ assets: [] })
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.getAlbum).toHaveBeenCalledWith(9) // 确实发起过请求,不是压根没调
    expect(w.findAll('.tile')).toHaveLength(0)
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)
  })

  // fix round 1 · I7(评审查实的真缺陷,Important):上一版这条用例名声称覆盖"查不到
  // id"分支,但注释里自陈"改为直接断言未选相册时 albumAssetIds 恒为 null",最终断的是
  // "不过滤"(2 条全在),与 brief 要求的"结果为空集"正好相反。
  //
  // 这里真正触达该分支:先正常选中一个相册、Apply、确认按相册资产收窄生效(1 条);
  // 再模拟"相册在别处被删除"(store 的 `albums.albums` 列表被清空,`filters.album` 这个
  // 名字本身没变)——I2 的重新设计让 `albumAssetIds` 是一个直接读 `albums.albums` 的
  // computed,`albums.albums` 一变,不需要任何额外触发,computed 自动重新求值:这个名字
  // 现在在 `albums.albums` 里查不到 id 了,应该退化成空集,而不是"查不到就不过滤"。
  it('相册名查不到 id → 结果为空集(不是不过滤)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 9, name: 'Trip' }])
    svc.photos.getAlbum.mockResolvedValue({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1) // 正常收窄先验证一次,确认不是恒真
    const albums = usePhotosAlbums()
    albums.albums = [] // 模拟相册在别处被删除:filters.album 这个名字现在查不到 id 了
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(0) // 查不到 id ⇒ 空集,不是退化成"不过滤"
  })

  // fix round 1 · I2(评审查实的真缺陷,Important):完整复现评审给出的失败时序——
  // 选相册 A → Apply(请求 A 在途,不 resolve)→ 重开弹层取消 A → Apply(albumAssetIds
  // 应变 null)→ 再选 A → Apply。旧实现(`fetchAlbumAssets(id).then(...)` 写快照 +
  // `albumSeq` 计数器)在这里会炸:`albums.ts:81` 的 `isLoadingAssets(id)` 短路让第二次
  // 对 A 的调用立即 resolve、不带数据,`.then()` 里 `mine===albumSeq` 成立(它是最新一次
  // 合法调用)但 `assetsOf(A)` 此刻仍是空 ⇒ `albumAssetIds` 被写成空 Set,永久归零,直到
  // 第一次真正的请求最终落地也没人再读它。
  // 重新设计后(`albumAssetIds` 是直接读 `albums.assetsOf(当前选中相册 id)` 的
  // computed):不管中途发生多少次被短路、不带数据的 `fetchAlbumAssets` 调用,只要
  // "第一次真正在途的那个请求"最终把数据写进 `albums.albumAssetsByID`,本 computed 下次
  // 求值就会自动读到——这里让 A 的第一次请求最后才 resolve,断言结果最终正确,不是
  // 永久空集。
  it('同一相册重入竞态(选 A 在途 → 取消 → 再选 A)不会把结果打成永久空集', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'A' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    let resolveFirst: ((v: unknown) => void) | undefined
    const firstCall = new Promise((res) => { resolveFirst = res })
    let callCount = 0
    svc.photos.getAlbum.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return firstCall // 第一次调用:挂起,模拟"请求在途"
      // 之后任何一次调用(包括被 albums.ts 的 isLoadingAssets 短路的那些)都不应该被
      // 依赖——真实实现里第二次显式调用会被 store 自己短路掉,这里给一个"错误答案"
      // (空数组)以确保:如果实现退化回旧的"靠 promise 写快照"手法,测试会读到这个错误
      // 答案而不是最终 resolveFirst 给出的真实数据。
      return Promise.resolve({ assets: [] })
    })
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    // 选 A → Apply(请求在途)。
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // 重开弹层,取消 A → Apply(filters.album = null)。
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // 再点一次 = 取消勾选
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // 再选 A → Apply(第一次请求仍未 resolve,这次调用会被 store 自己短路掉)。
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // 第一次真正的请求这时才姗姗来迟,带着真实数据。
    resolveFirst!({ assets: [{ id: 'a', originalName: 'a.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1) // 不是永久空集
  })

  it('快速切两个相册的 seq 守卫:旧响应(慢)不覆盖新响应(快)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    svc.photos.smartSearch.mockResolvedValue([rawAsset('x'), rawAsset('y')])
    let resolveA: ((v: unknown) => void) | undefined
    const pendingA = new Promise((res) => { resolveA = res })
    svc.photos.getAlbum.mockImplementation((id: number) => {
      if (id === 1) return pendingA
      return Promise.resolve({ assets: [{ id: 'y', originalName: 'y.jpg', mimeType: 'image/jpeg' }] })
    })
    const albums = usePhotosAlbums()
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    await w.get('.fpop-item').trigger('click') // 选 A(id 1,慢响应,尚未 resolve)
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // 切到 B(id 2,快响应)之前,先重开弹层。
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    // 取消 A,勾选 B。
    const items = w.findAll('.fpop-item')
    await items[0].trigger('click') // 取消 A
    await items[1].trigger('click') // 勾选 B
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises() // B(快响应)先落地
    // A 的慢响应现在才姗姗来迟——它不应该覆盖 B 已经落地的结果。
    resolveA!({ assets: [{ id: 'x', originalName: 'x.jpg', mimeType: 'image/jpeg' }] })
    await flushPromises()
    await w.vm.$nextTick()
    expect(albums.assetsOf(2)).toBeDefined()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.get('.tile img').attributes('src')).toContain('/y/')
  })
})

// ── applyUnderstood ──────────────────────────────────────────────────────
describe('applyUnderstood', () => {
  it('query 含已命名人名 → people chip 预选上', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [{ id: 1, name: 'Sara', count: 3 }], facesIndexedUpTo: null })
    const { w } = await mountSearch('/photos/search?q=Sara%20trip')
    await flushPromises()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('true')
  })

  it('含 "last week" 且 date 为空 → date 被预填', async () => {
    const { w } = await mountSearch('/photos/search?q=last%20week')
    await flushPromises()
    expect(w.get('[data-test="chip-date"] .fchip').attributes('data-on')).toBe('true')
  })

  it('date 已有用户选择 → applyUnderstood 不覆盖', async () => {
    // query 含 "last week" ⇒ 挂载时 applyUnderstood 会自动预填 date=last7。
    const { w } = await mountSearch('/photos/search?q=last%20week')
    await flushPromises()
    expect(w.get('[data-test="chip-date"] .fchip').attributes('data-on')).toBe('true')
    // 用户手动把日期改成 "Today"(与自动预填的 last7 不同),覆盖掉自动预填。
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    const quickBtns = w.findAll('.fpop-row .fpop-quick')
    await quickBtns[0].trigger('click') // QUICK_KEYS[0] === 'today'
    await w.get('.btn.btn-primary').trigger('click')
    const labelAfterManualPick = w.get('[data-test="chip-date"] .fchip').text()
    expect(labelAfterManualPick).toBe(zh.photosSearchToday)
    // 触发 applyUnderstood 重跑(peopleLoaded 假→真),"date 已有则不覆盖"这条分支应
    // 挡住 understood 的 last7 预填,保持用户手选的 "Today" 不被打回。
    const people = usePhotosPeople()
    people.peopleLoaded = false
    await w.vm.$nextTick()
    people.peopleLoaded = true
    await w.vm.$nextTick()
    expect(w.get('[data-test="chip-date"] .fchip').text()).toBe(labelAfterManualPick)
  })

  it('peopleLoaded 从假变真 → applyUnderstood 重跑一次', async () => {
    const { w } = await mountSearch('/photos/search?q=Sara')
    await flushPromises()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('false')
    const people = usePhotosPeople()
    // onMounted 里的 fetchPeople()(真实 store 方法)已经在 flushPromises 时把
    // peopleLoaded 从 false 推成 true(即便 listPersons 解析出空列表)——这里先拨回
    // false,才能造出一次真正的"假→真"跳变去触发 watch(peopleLoaded) 那条重跑逻辑,
    // 而不是命中"true→true 不触发 watcher"这种假阳性。
    people.peopleLoaded = false
    people.people = [{
      id: 1, name: 'Sara', confidence: 0.9, count: 3, favorite: false, relation: '',
      coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    }]
    await w.vm.$nextTick()
    people.peopleLoaded = true
    await w.vm.$nextTick()
    expect(w.get('[data-test="chip-people"] .fchip').attributes('data-on')).toBe('true')
  })
})

// ── 排序 ─────────────────────────────────────────────────────────────────
describe('排序', () => {
  it('relevance 下按分数降序;切到 newest/oldest → 顺序变', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('low', { matchScore: 0.2, takenAt: '2020-01-01T00:00:00Z' }),
      rawAsset('high', { matchScore: 0.9, takenAt: '2026-01-01T00:00:00Z' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    let ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids[0]).toContain('/high/')
    await w.get('[data-test="sort-oldest"]').trigger('click')
    ids = w.findAll('.tile img').map((n) => n.attributes('src'))
    expect(ids[0]).toContain('/low/')
  })

  it('relevance 下 belowCut 生效时 more 非空(双档);切到 newest → more 为空', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('best', { matchScore: 0.9, belowCut: false }),
      rawAsset('tail', { matchScore: 0.3, belowCut: true }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.find('.more-results-bar').exists()).toBe(true)
    await w.get('[data-test="sort-newest"]').trigger('click')
    expect(w.find('.more-results-bar').exists()).toBe(false)
  })
})

// ── 结果计数千分位跟 locale(fix 波 F2)────────────────────────────────────
// 终审必修项:`filteredResults.length.toLocaleString()` 是全支唯一的裸调用(其余 5 处调用
// 点全部传了 locale)。本仓 locale 标识是 `zh_cn`/`en_us`(下划线,非合法 BCP-47),裸传给
// toLocaleString 会抛 RangeError(与 `PhotosSearch.vue` localeTag 注释、
// `SmartViewCard.vue:37`/`SearchPeoplePopover.vue:62` 既有先例表述一致——fix wave
// follow-up · N1 订正:此前这里误写成"不会报错",与同一次提交里生产代码的注释自相矛盾,
// 已用 node 实测 `(1234).toLocaleString('zh_cn')` 确认真的抛 `RangeError: Incorrect
// locale information provided`,统一改成一致表述)。这里同时验证:①元素渲染不抛错
// (挂载用的 zh_cn i18n 实例,调用点已改成 `toLocaleString(localeTag)`,`localeTag` 是
// 转成 `zh-cn` 之后的合法值)②源文本是带 localeTag 标识符的调用,不是裸调用。
describe('结果计数千分位跟 locale(F2)', () => {
  it('results-count 渲染千分位数字,不抛 RangeError(zh_cn locale)', async () => {
    svc.photos.smartSearch.mockResolvedValue(
      Array.from({ length: 1234 }, (_, i) => rawAsset(`p${i}`)),
    )
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.get('[data-test="results-count"]').text()).toContain((1234).toLocaleString('zh-cn'))
  })

  // 源文本守卫:照 SearchPeoplePopover.test.ts:135 收紧过的写法——旧正则
  // `/toLocaleString\(\s*\S+/` 连裸调用 `toLocaleString()` 都能匹配(`)` 本身就是 `\S`),
  // 没有区分力;这条要求捕获组必须真的是标识符 `localeTag`。
  it('源文本里 toLocaleString(localeTag) 是带标识符实参的调用,不是裸调用', () => {
    expect(photosSearchRaw).toMatch(/toLocaleString\(\s*localeTag\s*\)/)
  })
})

// ── 空态 ─────────────────────────────────────────────────────────────────
describe('空态', () => {
  it('filteredResults 为空 + searching 假 → .empty-search 在,列出 activeConditions', async () => {
    svc.photos.smartSearch.mockResolvedValue([])
    const { w } = await mountSearch('/photos/search?q=nothing')
    await flushPromises()
    expect(w.find('[data-test="empty-search"]').exists()).toBe(true)
  })

  it('searching 真时 .empty-search 不在', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.smartSearch.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountSearch('/photos/search?q=abc')
    expect(w.find('[data-test="empty-search"]').exists()).toBe(false)
    resolveFn!([])
  })

  it('D1 反向断言:空态里不存在 Ask Nimo 按钮', async () => {
    svc.photos.smartSearch.mockResolvedValue([])
    const { w } = await mountSearch('/photos/search?q=nothing')
    await flushPromises()
    expect(w.text()).not.toContain(zh.photosSearchAskNimoSearchDifferently)
  })
})

// ── load-more ────────────────────────────────────────────────────────────
describe('load-more', () => {
  it('@load-more → store.loadMore() 被调', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('best', { matchScore: 0.9, belowCut: false }),
      rawAsset('tail', { matchScore: 0.3, belowCut: true }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const search = usePhotosSearch()
    const spy = vi.spyOn(search, 'loadMore').mockResolvedValue(undefined)
    await w.get('.more-results-bar').trigger('click') // 展开 more
    // sentinel 由 IntersectionObserver 驱动,jsdom 测不到真实滚动——直接调用组件暴露的
    // load-more 事件路径:PhotosSearchGrid 把 IO 命中转发成 emit('load-more'),这里改为
    // 直接找到 PhotosSearchGrid 实例并 emit,验证宿主把它接到 store.loadMore()。
    const grid = w.findComponent({ name: 'PhotosSearchGrid' })
    grid.vm.$emit('load-more')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalled()
  })
})

// ── @open → openAt 第四参是 query(OCR 激活主守卫)───────────────────────
describe('@open → 灯箱 OCR 激活', () => {
  it('openAt 第四参是当前 query,第二参是 sortedResults 映射出的 photo 数组', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=receipt')
    await flushPromises()
    await w.get('.tile').trigger('click')
    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const args = lbMock.openAt.mock.calls[0]
    expect(args[3]).toBe('receipt')
    expect(Array.isArray(args[1])).toBe(true)
    expect((args[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  // fix round 1 · M11(评审并入):上面那条只用 arrayContaining 断成员,不断顺序——
  // 把 openAt 第二参从 sortedResults 悄悄换成 filteredResults(未排序)不会被抓出来,
  // 而 brief 结构规格 15 专门点名"翻页集是 sortedResults 而非 filteredResults"这个区别。
  // 这里用两条分数不同的结果(relevance 排序下顺序应该是 high 在前),精确断言 id 顺序。
  it('第二参严格按 sortedResults 的顺序(relevance 分数降序),不是 filteredResults 的原始顺序', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('low', { matchScore: 0.2 }), // 原始顺序里排第一,但分数低
      rawAsset('high', { matchScore: 0.9 }), // 原始顺序里排第二,但分数高
    ])
    const { w } = await mountSearch('/photos/search?q=receipt')
    await flushPromises()
    // 点第二张 tile(渲染顺序已按分数排过,tiles[0] 是 high)。
    await w.findAll('.tile')[0].trigger('click')
    const args = lbMock.openAt.mock.calls[0]
    expect((args[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['high', 'low'])
  })
})

// ── 搜索历史 ───────────────────────────────────────────────────────────────
describe('搜索历史', () => {
  // fix round 1 · I1(评审查实的真缺陷,Important):`Photos.vue` 顶部搜索框与
  // `PhotosSmartViewDetail.vue`「在搜索中细化」都只 `router.push`,不写历史——之前只有
  // `PhotosSearch.vue` 自己的 `PhotosSearchBar` 提交路径会写。改法:历史写入挪到主 query
  // watcher(到达时记录),天然覆盖任何让路由带着非空 `q` 到达这里的入口,不只是"这个
  // 页面自己的搜索框提交"。这条用例直接挂载到一个已经带 `q` 的地址(模拟从 Photos.vue
  // 或 PhotosSmartViewDetail.vue push 过来、甚至深链/浏览器前进后退到达),断言历史里
  // 确实写入了这个词——这正是评审之前发现的坏掉的路径。
  it('挂载时地址栏已带 q(模拟从 Photos.vue/细化入口 push 过来,或深链到达)→ 历史里有这个词', async () => {
    await mountSearch('/photos/search?q=sunset')
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['sunset'])
  })

  // fix round 1 · I1 连带影响:历史写入挪进 query watcher 后,写入时机跟着
  // `router.replace()` 的（异步）导航完成,不再和 `submitQuery()` 同一个同步调用栈——
  // 触发 Enter 后要多等一次 `flushPromises()` 才能看到写入结果(生产行为不变,只是这里
  // 测试要补上等待)。
  it('onSubmit("abc") → localStorage 里是 ["abc"];再 "def" → ["def","abc"]', async () => {
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc'])
    await w.get('.photos-search-bar input').setValue('def')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['def', 'abc'])
  })

  it('重复 "abc" → 去重提前:["abc","def"]', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['def', 'abc']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc', 'def'])
  })

  it('超过 6 条 → 只留 6', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['1', '2', '3', '4', '5', '6']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('7')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    await flushPromises()
    const stored = JSON.parse(localStorage.getItem('nimo_search_history')!)
    expect(stored).toHaveLength(6)
    expect(stored[0]).toBe('7')
  })

  it('localStorage 抛错(mock setItem throw)→ 不崩', async () => {
    const { w } = await mountSearch('/photos/search')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await expect(
      w.get('.photos-search-bar input').setValue('boom').then(() =>
        w.get('.photos-search-bar input').trigger('keydown.enter')),
    ).resolves.not.toThrow()
    spy.mockRestore()
  })
})

// ── 保存弹层 ─────────────────────────────────────────────────────────────
describe('保存为智能视图', () => {
  it('点「存为智能视图」→ 弹层开;defaultName 短于 40 时是 query 本身', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    expect((w.get('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('sunset')
  })

  // fix round 1 · M10(评审并入):`:ignore-el="saveBtnRef"` 之前无任何断言——删掉它
  // 49/49 仍全绿。这里直接在触发按钮上派发一次裸 mousedown(不经过 @click 的 openSave
  // 逻辑),验证 SearchSaveSmartView 自己的 onDocMousedown 判定"点在 ignoreEl 上"从而
  // 不关闭——如果 ignoreEl 没接对,这次 mousedown 会被判成"外部点击"而误关弹层。
  it('save-smart 触发按钮已作为 ignoreEl 传入:在按钮上 mousedown 不会误关弹层', async () => {
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    w.get('[data-test="save-smart"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
  })

  it('defaultName 长于 40 时按拼接规则(含 sunset 关键词命中)', async () => {
    const longQ = 'a'.repeat(45) + ' sunset'
    const { w } = await mountSearch(`/photos/search?q=${encodeURIComponent(longQ)}`)
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    expect((w.get('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe(zh.photosSearchSunsets)
  })

  it('保存成功 → 按钮变「已保存」+ disabled', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'x', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    const btn = w.get('[data-test="save-smart"]')
    expect(btn.attributes('data-saved')).toBe('true')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain(zh.photosSearchSaved)
  })

  it('第 14 条缺陷守卫:换查询词后「已保存」复位', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'x', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const { w, router } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="save-smart"]').attributes('data-saved')).toBe('true')
    await router.push('/photos/search?q=other')
    await flushPromises()
    expect(w.get('[data-test="save-smart"]').attributes('data-saved')).toBe('false')
  })

  // fix 波 F1(终审必修项):保存成功此前零用户可见反馈——补这条守卫钉住 toast 被调、
  // 文案含插值后的 name、action label 是跳转键、点 action 触发 router.push 到智能视图
  // 列表路由。真值见 Vue2 PhotosSearchView.vue:283-288 的 `.save-toast`(sparkles + 5 秒 +
  // 跳转链接);New-UI 用通用 useToast 的第三参 { label, onClick } 映上,跳转目标是
  // `/photos/smart-views`(相对 Vue2 `#/photos` 的必要偏离,见 onSaved 注释)。
  // SP15-P2b Task 5 (fix round 2): smart albums moved into Albums (Tasks 3/4), so the
  // "open it" link now lands on /photos/albums instead of the (now Moments-only)
  // /photos/smart-views route. Round 1 left the label as photosSearchOpenSmartViews
  // ("在智能视图中打开") on the theory that only the destination needed to change — that
  // was wrong: a label naming a destination the control doesn't go to is the same defect
  // class as the PhotosSmartViewDetail.vue back button in this task, so the key is renamed
  // to photosSearchOpenInAlbums ("在相册中打开") along with the destination.
  it('保存成功 → toast 被调(5s、文案含 name、action label 是跳转键),点 action 跳 /photos/albums', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'my trip', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const toastSpy = vi.spyOn(useToast(), 'show')
    const { w, router } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-name-input"]').setValue('my trip')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(toastSpy).toHaveBeenCalledTimes(1)
    const [text, duration, arg] = toastSpy.mock.calls[0]!
    // SP8-P6-T3 合流:show() 第三参现为判别联合(字符串=tier / 对象=action),按 typeof 收窄回 action。
    const action = typeof arg === 'string' ? undefined : arg
    expect(text).toBe(zh.photosSearchNameSavedSmartView.replace('{name}', 'my trip'))
    expect(duration).toBe(5000)
    expect(action?.label).toBe(zh.photosSearchOpenInAlbums)

    const pushSpy = vi.spyOn(router, 'push')
    action?.onClick()
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })
})

// ── 浮层统一治理 ───────────────────────────────────────────────────────────
describe('浮层:Esc 统一治理', () => {
  it('chip 弹层与保存弹层同开时,一次 Esc 两者都关(集成,允许子组件自身的 Esc 兜底参与)', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    await w.get('[data-test="save-smart"]').trigger('click')
    expect(w.find('.cal').exists()).toBe(true)
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.cal').exists()).toBe(false)
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(false)
  })

  // 上面那条集成用例有个致命盲点(删码验证清单⑧的教训,已实测确认):SearchSaveSmartView
  // 自己也注册了一份独立的 document keydown 监听器(watch(open) 挂载,见该组件文件头),
  // 一次 Escape 会同时命中宿主的 onDocKeydown 与子组件自己的 onDocKeydown——即便宿主的
  // onDocKeydown 在处理完 openPop 分支后 `return` 早退、根本没碰 saveOpen,子组件自己
  // 仍会调 close() → emit('update:open', false) → 宿主 v-model 联动把 saveOpen 也置假。
  // 也就是说"两个浮层的 DOM 都关了"这个结果对"宿主是否违反禁止早退"这条硬约束**不可
  // 证伪**——真删过一次 `{ openPop.value = null; return }` 验证过,上面那条用例仍然全绿
  // (本文件与任务报告都如实登记这条"guard 被 guard 遮蔽"的发现)。
  // 这里用一个不带自身 Esc 兜底的替身组件屏蔽掉子组件的救援路径,让宿主自己的
  // onDocKeydown 单独承压,才是真正验证"两个 if 都不早退"这条硬约束的用例。
  it('（隔离子组件兜底后)宿主自身的 onDocKeydown 两个分支都不早退', async () => {
    const router = makeRouter('/photos/search?q=abc')
    await router.isReady()
    const w = mount(PhotosSearch, {
      global: {
        plugins: [i18n, router],
        stubs: {
          // 无自身 keydown 监听、也不 emit update:open——纯粹按 open prop 显隐,逼着
          // "谁把 saveOpen 置回 false"这件事只能是宿主自己的 onDocKeydown。
          SearchSaveSmartView: { props: ['open'], template: '<div v-if="open" data-test="ssv-root-stub" />' },
        },
      },
    })
    // fix round 2 · Minor#2(评审并入,清理契约漏洞) + fix round 3 · #3(评审并入,
    // 健壮性收尾):这条用例是直接 `mount()`,不经过 `mountSearch()` 助手,不会被
    // `afterEach` 里那个遍历 `mountedInstances` 的清理逻辑覆盖到。fix round 2 曾在用例
    // 末尾补了一行裸 `w.unmount()`,但那行排在断言之后——**如果前面任何一条断言先失败
    // 抛错,`unmount()` 根本不会执行**,组件仍会残留(`ClusterActionDialog.test.ts` 等
    // 先例靠 `mounted[]` + `afterEach` 天然免疫这个问题,这里没有对应的数组)。改成
    // `try/finally`:不管断言是否失败,`finally` 里的 `unmount()` 都会执行。
    try {
      await flushPromises()
      await w.vm.$nextTick()
      await w.get('[data-test="chip-date"] .fchip').trigger('click')
      await w.get('[data-test="save-smart"]').trigger('click')
      expect(w.find('.cal').exists()).toBe(true)
      expect(w.find('[data-test="ssv-root-stub"]').exists()).toBe(true)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await w.vm.$nextTick()
      expect(w.find('.cal').exists()).toBe(false)
      expect(w.find('[data-test="ssv-root-stub"]').exists()).toBe(false)
    } finally {
      w.unmount()
    }
  })

  it('Esc 不触发「退出搜索」(反向断言:router.push/replace 未被调)', async () => {
    const { w, router } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'push')
    const replaceSpy = vi.spyOn(router, 'replace')
    await w.get('[data-test="chip-date"] .fchip').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
  })
})

// ── 路由 ─────────────────────────────────────────────────────────────────
describe('路由', () => {
  it('?raw:/photos/search 那一行在 /photos/smart-views/:id 之后', () => {
    const iSv = routerRaw.indexOf(`path: '/photos/smart-views/:id'`)
    const iSearch = routerRaw.indexOf(`path: '/photos/search'`)
    expect(iSv).toBeGreaterThan(-1)
    expect(iSearch).toBeGreaterThan(iSv)
  })

  it('resolve("/photos/search") 的 name 是 photos-search', () => {
    const resolved = appRouter.resolve('/photos/search')
    expect(resolved.name).toBe('photos-search')
  })
})

// ── fix round 1 · I4:8 枚本文件新增内联 svg 的 glyph 精确复刻 ──────────────────
// 本文件另有一枚(search 图标,用在预搜索态 chip)+ PhotosSearchBar.vue 的 search 图标
// 已在各自组件的测试文件里断言。评审同时改坏 clock 与 map 两枚的 d 值 → 上一轮 49/49
// 全绿,本轮给 9 枚(8 枚本文件 + 已在 PhotosSearchBar.test.ts 断言的 1 枚)逐一补断言。
describe('glyph 精确复刻(逐字符抄自 Vue2 PhotosIcon.vue)', () => {
  it('预搜索态 search chip 图标的 path d', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['a']))
    const { w } = await mountSearch('/photos/search')
    const path = w.get('[data-test="prestate-chip"] svg path')
    expect(path.attributes('d')).toBe('m20 20-3.5-3.5')
  })

  it('date chip(clock)图标:circle + path d="M12 7v5l3 2"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-date"] .fchip-icon')
    expect(icon.get('circle').attributes('r')).toBe('9')
    expect(icon.get('path').attributes('d')).toBe('M12 7v5l3 2')
  })

  it('people chip(person)图标:circle + path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-people"] .fchip-icon')
    expect(icon.get('circle').attributes('r')).toBe('4')
    expect(icon.get('path').attributes('d')).toBe('M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6')
  })

  it('place chip(map)图标:两条 path d 逐字符一致', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-place"] .fchip-icon')
    const ds = icon.findAll('path').map((p) => p.attributes('d'))
    expect(ds).toEqual(['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14M15 6v14'])
  })

  it('album chip(album)图标:rect + path d="M3 14l5-4 4 3 3-2 6 5"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-album"] .fchip-icon')
    expect(icon.get('rect').attributes('rx')).toBe('3')
    expect(icon.get('path').attributes('d')).toBe('M3 14l5-4 4 3 3-2 6 5')
  })

  it('type chip(video)图标:rect + path d="m16 10 5-3v10l-5-3z"', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="chip-type"] .fchip-icon')
    expect(icon.get('rect').attributes('rx')).toBe('2')
    expect(icon.get('path').attributes('d')).toBe('m16 10 5-3v10l-5-3z')
  })

  it('save-smart 未保存态(sparkles)图标:path d 与 circle 都在', async () => {
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    const icon = w.get('[data-test="save-smart"]')
    expect(icon.get('circle').attributes('r')).toBe('3')
    expect(icon.get('path').attributes('d')).toBe(
      'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    )
  })

  it('save-smart 已保存态(check)图标:path d="m5 12 5 5L20 7"', async () => {
    svc.photos.createSmartView.mockResolvedValue({
      id: 'sv-1', name: 'x', description: '', conds: [], threshold: 75, live: true, includeVideos: false,
      count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: [], evaluatedAt: '',
    })
    const { w } = await mountSearch('/photos/search?q=sunset')
    await flushPromises()
    await w.get('[data-test="save-smart"]').trigger('click')
    await w.get('[data-test="ssv-confirm-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.get('[data-test="save-smart"] path').attributes('d')).toBe('m5 12 5 5L20 7')
  })
})

// ── fix round 1 · I5(plan 硬约束,评审并入):cssCascade hover 断言 + 非颜色属性锚定 ──
describe('样式:hover 硬约束(cssCascade)', () => {
  it('.sort button[data-active="true"] 的 hover 胜出规则含 :hover 且含 data-active', () => {
    const style = extractStyleBlock(photosSearchRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['sort'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })

  it('.save-smart[data-saved="true"] 的 hover 胜出规则含 :hover 且含 data-saved', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const winner = winningHoverBackground(style, ['save-smart'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-saved')
  })

  // Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward) — same rollback treatment
  // as PhotosFilterChip.vue/PhotosFilterPopover.vue's own 2026-08-13 rollback: `.prestate-chip`
  // is genuine Vue2-sourced CSS (Vue2 photos.scss:2781 has this exact hover rule too, not a
  // New-UI additive enhancement like `.sort button`/`.save-smart` above), and
  // vue2-parity/photos.scss already carries it verbatim — the local scoped duplicate (which used
  // to reach for New-UI's global `--accent-text` instead of the correct local `--accent-hi`) is
  // deleted, not re-pointed at the right token, since parity's own copy is already correct.
  it('本组件 scoped style 不再含 .prestate-chip 颜色规则(已整体移交 parity)', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s.includes('prestate-chip'))).toBe(false)
  })

  it('parity scss:.search-prestate .prestate-chip:hover 规则含 :hover', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const winner = winningHoverBackground(parityScss, ['prestate-chip', 'search-prestate'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('prestate-chip')
  })
})

describe('样式:非颜色视觉属性锚定(先锚定规则体再断言属性)', () => {
  // Fix-3 item 7: `.nimo-orb`(含 `.search-prestate .nimo-orb`/`.empty-search .nimo-orb` 两个
  // 尺寸变体)与 `.empty-search .conditions .fchip` 已随 2026-08-13 回退整体移交
  // vue2-parity/photos.scss——本组件不再自带这几条规则,断言对象改成共享 parity 文件。
  it('本组件 scoped style 不再含 .nimo-orb/.empty-search .conditions .fchip 规则(已整体移交 parity)', () => {
    const style = extractStyleBlock(photosSearchRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s.includes('nimo-orb'))).toBe(false)
    expect(selectors.some((s) => s === '.empty-search .conditions .fchip')).toBe(false)
  })

  it('parity scss:.search-prestate .nimo-orb / .empty-search .nimo-orb 都是 68×68', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rules = parseCssRules(parityScss)
    for (const sel of ['.search-prestate .nimo-orb', '.empty-search .nimo-orb']) {
      const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === sel)
      expect(rule, `未找到规则:${sel}`).toBeDefined()
      expect(rule?.body).toContain('width: 68px')
      expect(rule?.body).toContain('height: 68px')
    }
  })

  it('parity scss:.empty-search .conditions .fchip 紧凑高度是 26px', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.empty-search .conditions .fchip',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('height: 26px')
  })
})
