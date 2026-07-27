// Task 7 (SP7-P4 相册): PhotosAlbums.vue —— 相册列表视图(卡片网格 + 排序 + 新建三种填充
// 方式 + 空态)。挂 Pinia + i18n + 真实 router(spy push,不 mock 整个 vue-router 模块——
// AreaShell/PhotosSidebar 都用 useRouter(),照 PhotosFavorites.test.ts/PhotosTrash.test.ts
// 的既有挂载套路),mock 共享包 albums/timeline 方法。覆盖 brief Step 1 的 8 条行为清单
// + 一条 Esc 关模态(硬约束:document 级监听,不是模板 @keydown.esc,值得单独断言真实生效)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listAlbums: vi.fn().mockResolvedValue([]),
    createAlbum: vi.fn(),
    getAlbum: vi.fn().mockResolvedValue({ assets: [] }),
    deleteAlbum: vi.fn().mockResolvedValue(undefined),
    updateAlbum: vi.fn().mockResolvedValue({}),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
    removeFromAlbum: vi.fn().mockResolvedValue(undefined),
    reorderAlbumAssets: vi.fn().mockResolvedValue(undefined),
    getTimeline: vi.fn().mockResolvedValue([]),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosAlbums from '../PhotosAlbums.vue'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
      { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/albums')
  await router.isReady()
  const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

function rawAlbum(id: string | number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: overrides.name ?? `Album ${id}`,
    coverAssetId: overrides.coverAssetId ?? null,
    assetCount: overrides.assetCount ?? 3,
    dateStart: overrides.dateStart ?? '2026-05-01',
    dateEnd: overrides.dateEnd ?? '2026-05-10',
    createdAt: overrides.createdAt ?? '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.createAlbum.mockClear()
  svc.photos.getAlbum.mockClear().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.thumbnailUrl.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PhotosAlbums.vue', () => {
  it('albumsLoaded 且列表空 → 渲染空态,「新建」占位卡仍在', async () => {
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.albumsLoaded).toBe(true)
    expect(w.find('[data-test="albums-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('还没有相册')
    expect(w.find('[data-test="album-create-tile"]').exists()).toBe(true)
  })

  it('有相册 → 渲染卡片:标题/计数/封面 img src=thumbnailUrl(cover,"large");无封面项渲染 fallback 而非 <img>', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Tokyo', coverAssetId: 'cover-1', assetCount: 5 }),
      rawAlbum(2, { name: 'No Cover', coverAssetId: null, assetCount: 0 }),
    ])
    const { w } = await mountView()

    const cards = w.findAll('[data-test="album-card"]')
    expect(cards).toHaveLength(2)

    const tokyo = cards.find((c) => c.text().includes('Tokyo'))!
    expect(tokyo.text()).toContain('5')
    const img = tokyo.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('mock://thumb/cover-1/large')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('cover-1', 'large')

    const noCover = cards.find((c) => c.text().includes('No Cover'))!
    expect(noCover.find('img').exists()).toBe(false)
    expect(noCover.find('[data-test="album-cover-fallback"]').exists()).toBe(true)
  })

  it('点卡片 → router.push 收到 /photos/albums/<id>(数字 id 验证 URL 拼接正确)', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(42, { name: 'NumericId' })])
    const { w, router } = await mountView()
    const pushSpy = vi.spyOn(router, 'push')

    await w.find('[data-test="album-card"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/photos/albums/42')
  })

  it('切排序为 name → 卡片顺序变为字母序(证明接了 sortAlbums 而非死排)', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Zebra' }),
      rawAlbum(2, { name: 'Apple' }),
      rawAlbum(3, { name: 'Mango' }),
    ])
    const { w } = await mountView()

    // 默认 sort='updated' → 保持后端顺序(sortAlbums 对 'updated' 不重排)
    let titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['Zebra', 'Apple', 'Mango'])

    await w.find('[data-test="albums-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const nameItem = w.findAll('[data-test="albums-sort-item"]').find((n) => n.attributes('data-sort-id') === 'name')!
    await nameItem.trigger('click')
    await w.vm.$nextTick()

    titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('点「新建」→ 模态出现;名称空时主按钮 disabled;填名+empty 提交 → createAlbum 被调 + 成功 toast + 模态关闭', async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Trip' })
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    const toast = useToast()
    const createSpy = vi.spyOn(albums, 'createAlbum')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(true)

    const confirmBtn = w.find('[data-test="albums-confirm-create"]')
    expect(confirmBtn.attributes('disabled')).toBeDefined()

    await w.find('[data-test="albums-name-input"]').setValue('Trip')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-confirm-create"]').attributes('disabled')).toBeUndefined()

    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(createSpy).toHaveBeenCalledWith('Trip')
    expect(showSpy).toHaveBeenCalledWith(expect.stringContaining('Trip'))
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })

  it("source==='recent' → createAlbum 后 addAssetsToAlbum 被调,传入 id 集只含近 30 天照片(fake timers 固定 now)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Recent' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 7,
        assets: [
          { id: 'recent1', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' },
          { id: 'old1', takenAt: '2026-05-01T00:00:00Z', mimeType: 'image/jpeg' },
        ],
      },
    ])
    const { w } = await mountView()
    const timeline = useTimelineStore()
    await timeline.fetchTimeline()
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Recent')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(addSpy).toHaveBeenCalledWith('new1', ['recent1'])
  })

  // 评审 Important:恰好 30 天前的边界项——Vue2 :321 的逐字语义是 `t >= cutoff`(闭区间,
  // 含边界),这里单独断言,不要在实现里改成 `>`。
  it("source==='recent' 边界:恰好 30 天前(cutoff 本身)按 >= 语义被包含", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Boundary' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 6,
        // now - 30*86400000 == 2026-06-27T00:00:00Z 的时间戳,与 cutoff 完全相等。
        assets: [{ id: 'boundary1', takenAt: '2026-06-27T00:00:00Z', mimeType: 'image/jpeg' }],
      },
    ])
    const { w } = await mountView()
    const timeline = useTimelineStore()
    await timeline.fetchTimeline()
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Boundary')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(addSpy).toHaveBeenCalledWith('new1', ['boundary1'])
  })

  // 评审 Important(裁定为新缺陷,非照抄 Vue2):Vue2 的相册列表从来不是独立路由——它是
  // PhotosTimeline.vue 内部按 activeNav 切换的子块,时间线数据由父组件 PhotosTimeline.mounted()
  // 无条件预热。New-UI 把相册做成了独立真路由 /photos/albums,用户可能直链/刷新进来、
  // 从未访问过 /photos,此时 timeline store 是全新的(allPhotos===[])。修复前:'recent' 分支
  // 会静默算出空 id 集,addAssetsToAlbum 被跳过,但仍然弹"已创建"成功 toast——用户拿到一个
  // 空相册和一条假成功提示,零错误信号。断言:timeline 全新时,选 recent 提交 → 组件自己补一次
  // fetchTimeline,addAssetsToAlbum 最终收到非空 id 集(而不是被静默跳过)。
  it("source==='recent' 且 timeline store 全新(未预热)→ 组件自己补 fetchTimeline,addAssetsToAlbum 收到非空 id 集", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'ColdStart' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 7,
        assets: [{ id: 'warm1', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' }],
      },
    ])
    // 关键:与其它 'recent' 用例不同,这里刻意不预先调用 timeline.fetchTimeline() ——
    // 模拟用户从未访问过 /photos、timeline store 仍是初始空状态。
    const { w } = await mountView()
    const timeline = useTimelineStore()
    expect(timeline.allPhotos).toHaveLength(0) // 前置条件:确实是冷启动
    const fetchSpy = vi.spyOn(timeline, 'fetchTimeline')
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('ColdStart')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(addSpy).toHaveBeenCalledWith('new1', ['warm1']) // 非空 id 集,不是被静默跳过
  })

  it("source==='select' → 提交后 AlbumLibraryPicker 渲染(open===true)", async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    const { w } = await mountView()

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Picked')
    await w.find('[data-test="source-select"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getAlbum).toHaveBeenCalledWith('new1')
    expect(w.find('[data-test="lib-picker-overlay"]').exists()).toBe(true)
  })

  it('createAlbum 抛 409 → 渲染重名 toast,模态关闭(照 Vue2 finally 语义)', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    svc.photos.createAlbum.mockRejectedValue(err)
    const { w } = await mountView()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Dup')
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(showSpy).toHaveBeenCalledWith('已存在同名相册')
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })

  it('Esc(document 级)关闭新建模态', async () => {
    const { w } = await mountView()

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })
})
