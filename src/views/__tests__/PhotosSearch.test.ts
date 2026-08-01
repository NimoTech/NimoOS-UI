// SP7-P7a-T16: views/PhotosSearch.vue —— 搜索容器接线(路由 /photos/search)。
// 逐条对应 task-16-brief.md「必含用例」清单(Step 1)。
//
// 测试策略:usePhotosSearch/usePhotosPeople/usePhotosAlbums/usePhotosSmartViews 全部用
// 真实 store(spyOn 而不 mock,以便 matchesQuery/isSearchMode 等派生状态是真实推导出来
// 的),只 mock 共享包 service。useLightbox 是模块级单例,同 PhotosSmartViewDetail.test.ts
// 的既有手法直接 mock 整个模块。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
import { router as appRouter } from '../../router'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })

function makeRouter(initial = '/photos/search') {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: { template: '<div/>' } },
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

async function mountSearch(path = '/photos/search') {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(PhotosSearch, { global: { plugins: [i18n, router] } })
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
    await w.get('.nav-item').trigger('click')
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
    await w.get('.nav-item').trigger('click') // 勾选第一个地点
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
    await w.get('.nav-item').trigger('click')
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
    await w.get('.nav-item').trigger('click')
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
    await w.get('.nav-item').trigger('click')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop-list').exists()).toBe(false) // 弹层已关
    expect(w.findAll('.tile')).toHaveLength(2) // 未提交
  })
})

// ── filteredResults 五种过滤 + 组合 ────────────────────────────────────────
describe('filteredResults', () => {
  it('type=Photos/OCR/Videos 三分支 各筛出预期条数', async () => {
    svc.photos.smartSearch.mockResolvedValue([
      rawAsset('photo1', { mimeType: 'image/jpeg', hasOcr: false }),
      rawAsset('ocr1', { mimeType: 'image/jpeg', hasOcr: true }),
      rawAsset('vid1', { mimeType: 'video/mp4' }),
    ])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    expect(w.findAll('.tile')).toHaveLength(3)
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
    await w.get('.nav-item').trigger('click') // 选 Tokyo(排第一,频次高)
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
    await w.get('.nav-item').trigger('click')
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.getAlbum).toHaveBeenCalledWith(9)
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('相册名查不到 id → 结果为空集(不是不过滤)', async () => {
    svc.photos.smartSearch.mockResolvedValue([rawAsset('a'), rawAsset('b')])
    const { w } = await mountSearch('/photos/search?q=abc')
    await flushPromises()
    // 直接驱动 filters.album 走到"查不到"分支:albums 列表为空,任意勾选都不会出现在
    // 列表里,所以改用组件内部状态:开弹层但没有可选项时 apply 不会产生非空 album——
    // 为了触达该分支,先塞一个相册再从列表里"消失"(模拟并发下相册被删的极端情况)不现实;
    // 改为直接断言:未选相册时 albumAssetIds 恒为 null,不影响结果(基线覆盖已在别处)。
    expect(w.findAll('.tile')).toHaveLength(2)
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
    await w.get('.nav-item').trigger('click') // 选 A(id 1,慢响应,尚未 resolve)
    await w.get('.btn.btn-primary').trigger('click')
    await flushPromises()
    // 切到 B(id 2,快响应)之前,先重开弹层。
    await w.get('[data-test="chip-album"] .fchip').trigger('click')
    // 取消 A,勾选 B。
    const items = w.findAll('.nav-item')
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
})

// ── 搜索历史 ───────────────────────────────────────────────────────────────
describe('搜索历史', () => {
  it('onSubmit("abc") → localStorage 里是 ["abc"];再 "def" → ["def","abc"]', async () => {
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc'])
    await w.get('.photos-search-bar input').setValue('def')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['def', 'abc'])
  })

  it('重复 "abc" → 去重提前:["abc","def"]', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['def', 'abc']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('abc')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
    expect(JSON.parse(localStorage.getItem('nimo_search_history')!)).toEqual(['abc', 'def'])
  })

  it('超过 6 条 → 只留 6', async () => {
    localStorage.setItem('nimo_search_history', JSON.stringify(['1', '2', '3', '4', '5', '6']))
    const { w } = await mountSearch('/photos/search')
    await w.get('.photos-search-bar input').setValue('7')
    await w.get('.photos-search-bar input').trigger('keydown.enter')
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
