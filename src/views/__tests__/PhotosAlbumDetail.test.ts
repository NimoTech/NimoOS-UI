// Task 8 (SP7-P4 相册): PhotosAlbumDetail.vue —— 相册详情视图。逐段对照 Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumDetail.vue(419 行)移植(hero 改名/删除/封面 + edit 多选移除 +
// 添加照片 + 拖拽排序 + 灯箱)。挂 Pinia + i18n + router(带 /photos/albums/:id),mock 共享包 +
// useAlbumDragSort 整个组合式(而非 sortablejs 本身——useAlbumDragSort 自己的 Sortable 集成已在
// useAlbumDragSort.test.ts 里独立验证过;这里只需验证 PhotosAlbumDetail 是否在正确时机调用
// refresh()/destroy()、把 isDragging() 当点击守卫、onOrder 失败时弹正确 toast——用真 mock 更干净)。
//
// 铁律回归测试贯穿全文件:route.params.id 恒为字符串,与后端可能的数字 id/cover id 交叉验证
// 值比较(不是对象引用比较)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listAlbums: vi.fn().mockResolvedValue([]),
    getAlbum: vi.fn().mockResolvedValue({ assets: [] }),
    updateAlbum: vi.fn().mockResolvedValue({}),
    deleteAlbum: vi.fn().mockResolvedValue(undefined),
    reorderAlbumAssets: vi.fn().mockResolvedValue(undefined),
    removeFromAlbum: vi.fn().mockResolvedValue(undefined),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    // Task 5: duplicateAlbum (store) reuses saveAsAlbum, which calls createAlbum -- needed once
    // the more menu grows a Duplicate entry. exportAlbumZipUrl backs the Download-as-ZIP entry.
    createAlbum: vi.fn().mockResolvedValue({ id: 'new1', name: 'copy' }),
    exportAlbumZipUrl: vi.fn((id: string | number) => `mock://export/${id}`),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    // usePhotosFavorites() 是 useLightbox.openAt/isFav 的既有依赖(P2/P3 既定行为,非本任务
    // 新增)——即便本任务不测收藏态,openAt() 内部仍会调用 recordView/listFavoriteIds,缺 mock
    // 会抛未捕获异常污染测试运行(不影响断言结果,但需堵上,同 PhotosFavorites.test.ts 的前例)。
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    // T6: the stats rail's Convert-to-Smart-Album menu entry gates on the same AI-feature
    // config the Albums page already reads (usePhotosSettingsStore().fetchAiFeatures()).
    getConfig: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// Mock the whole T4 composable (not sortablejs) — T8's job is to verify wiring
// (refresh() timing, destroy() on unmount, isDragging() as click guard,
// onOrder callback plumbing), not re-test Sortable itself.
const dragMock = vi.hoisted(() => ({
  isDragging: vi.fn(() => false),
  refresh: vi.fn(),
  destroy: vi.fn(),
}))
interface DragSortOpts { container: unknown; enabled: () => boolean; onOrder: (ids: string[]) => void }
const useAlbumDragSortSpy = vi.hoisted(() => vi.fn((_opts: DragSortOpts) => dragMock))
vi.mock('../../photos/composables/useAlbumDragSort', () => ({
  useAlbumDragSort: (opts: DragSortOpts) => useAlbumDragSortSpy(opts),
}))

// jsdom 无媒体栈(PhotoLightbox 视频起播位续播用得到,同 Photos.lightbox.test.ts 前置)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosAlbumDetail from '../PhotosAlbumDetail.vue'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import PhotosLibraryPicker from '../../photos/components/PhotosLibraryPicker.vue'
import AlbumConvertToSmartDialog from '../../photos/components/AlbumConvertToSmartDialog.vue'
import PhotosTopbar from '../../photos/components/PhotosTopbar.vue'
import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'

const lb = useLightbox()
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// Coordinator review fix (Task 5 Important): captured once, before any test can have replaced
// `window.location` -- the "P2c album more menu" describe block's own afterEach restores this
// exact reference so a stubbed location can never leak into a later test in this file.
const originalWindowLocation = window.location

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/albums', name: 'photos-albums', component: { template: '<div/>' } },
      { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
    ],
  })
}

async function mountView(id: string | number = '7') {
  const router = makeRouter()
  router.push(`/photos/albums/${id}`)
  await router.isReady()
  const w = mount(PhotosAlbumDetail, { global: { plugins: [i18n, router] } })
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

function asset(id: string | number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    takenAt: overrides.takenAt ?? '2026-05-01T00:00:00Z',
    indexedAt: overrides.indexedAt ?? '2026-05-01T00:00:00Z',
    mimeType: overrides.mimeType ?? 'image/jpeg',
    originalName: overrides.originalName ?? `${id}.jpg`,
    ...overrides,
  }
}

/**
 * Task 6: mount with an album + its assets + (optionally) the AI-feature config the stats
 * rail's Convert entry gates on. Deliberately does NOT route the album/assets fixtures through
 * rawAlbum()/asset()'s own field defaults above — several of the tests below rely on an absent
 * dateStart/dateEnd/createdAt/videoCount staying absent (to prove the dash/zero fallbacks), and
 * those helpers backfill exactly those fields.
 */
async function mountDetail(opts: {
  album: Record<string, unknown>
  assets?: Array<Record<string, unknown>>
  aiFeatures?: Record<string, unknown>
}) {
  svc.photos.listAlbums.mockResolvedValue([opts.album])
  svc.photos.getAlbum.mockResolvedValue({ assets: opts.assets ?? [] })
  svc.photos.getConfig.mockResolvedValue(opts.aiFeatures !== undefined ? { aiFeatures: opts.aiFeatures } : {})
  const { w } = await mountView(opts.album.id as string | number)
  return w
}

// Task 7: same setup as mountDetail, but also hands back the router so a test can spy on
// router.push (the navigation-on-success case has no other observable effect -- the source
// album is gone server-side, there is nothing left in this page's own state to assert on).
async function mountDetailWithRouter(opts: {
  album: Record<string, unknown>
  assets?: Array<Record<string, unknown>>
}) {
  svc.photos.listAlbums.mockResolvedValue([opts.album])
  svc.photos.getAlbum.mockResolvedValue({ assets: opts.assets ?? [] })
  return mountView(opts.album.id as string | number)
}

function findSortItem(w: ReturnType<typeof mount>, sortId: string) {
  return w.findAll('[data-test="album-sort-item"]').find((n) => n.attributes('data-sort-id') === sortId)!
}

beforeEach(() => {
  setActivePinia(createPinia())
  lb.__resetForTest()
  // Fix-10: usePhotosToast() is a module-level singleton (not Pinia), so its queue must be
  // reset per test the same way lb.__resetForTest() already resets the lightbox singleton.
  usePhotosToast().__resetForTests()
  svc.photos.listAlbums.mockClear().mockResolvedValue([rawAlbum(7, { name: 'Trip', coverAssetId: 'cover-1' })])
  svc.photos.getAlbum.mockClear().mockResolvedValue({ assets: [] })
  svc.photos.updateAlbum.mockClear().mockResolvedValue({})
  svc.photos.deleteAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.reorderAlbumAssets.mockClear().mockResolvedValue(undefined)
  svc.photos.removeFromAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.createAlbum.mockClear().mockResolvedValue({ id: 'new1', name: 'copy' })
  svc.photos.exportAlbumZipUrl.mockClear()
  dragMock.isDragging.mockReset().mockReturnValue(false)
  dragMock.refresh.mockClear()
  dragMock.destroy.mockClear()
  useAlbumDragSortSpy.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosAlbumDetail.vue', () => {
  it('铁律回归:route.params.id 字符串 "7" 命中后端数字 id 7 的相册,渲染标题/计数/日期区间', async () => {
    const { w } = await mountView('7')
    expect(w.text()).toContain('Trip')
    expect(w.text()).toContain('3')
    expect(w.text()).toContain('May 2026')
    // SP15-P2c Task 3 re-home: the two cover-thumbnail assertions that used to sit here belonged
    // to the deleted hero background. Their subject moved to 'no longer renders the cover hero or
    // the toolbar band' below, which asserts no large cover thumbnail is requested at all now.
    // What stays here is where the three strings above land in the new skeleton.
    expect(w.find('.sv-header h1 .sv-title').text()).toBe('Trip')
    expect(w.find('[data-test="album-header-items"]').text()).toContain('3')
    expect(w.find('.sv-header h1 .sv-cond').text()).toBe('May 2026')
  })

  it('albumsLoaded=false(还没加载完)→ 渲染加载骨架,不是"相册不存在"', async () => {
    svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
    const { w } = await mountView('999')
    expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
    expect(w.find('[data-test="album-not-found"]').exists()).toBe(false)
  })

  // Task 9(P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释),
  // 旧实现下 `!album && !albums.albumsLoaded` 恒真 → 永久停在骨架屏。新增 loadError 分支
  // 必须拦在骨架分支之前。
  it('相册列表加载失败时渲染失败态而非永久骨架(P4 遗留)', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
    const { w } = await mountView('7')
    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
    expect(w.text()).toContain('相册加载失败')
    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
  })

  // 变异验证挡门用例①:失败态分支若被挪到骨架分支之后,本用例应变红
  // (loadError=true 时骨架仍会先命中 v-if,失败态永远出不来)。
  it('失败态优先于骨架态(loadError 真 + albumsLoaded 假 ⇒ 出失败态,不出骨架)', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
    const { w } = await mountView('999')
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(true)
    expect(albums.albumsLoaded).toBe(false)
    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
  })

  // 变异验证挡门用例②的姊妹用例:仍在飞行中(未失败)必须继续走骨架态,不能被
  // loadError 分支误吞——若 loadError 在成功路径也被误置真,这条与上面那条会一起说明
  // 分支被合并/语义被破坏。
  it('正在加载(未失败)仍走骨架态,不出失败态', async () => {
    svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
    const { w } = await mountView('999')
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(false)
    expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
    expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
  })

  // 评审 Important 1 补的挡门用例(这一条才是真正钉住不变量的那条,不是 store 那条):
  // 重试本身也失败——失败态必须持续可见,不能落回骨架分支(旧实现的 loadError 上来即清
  // false 会让骨架分支在 albumsLoaded 仍为假时于重试飞行期短暂命中,见 albums.ts 同批
  // 修正注释)。
  it('相册失败态重试仍失败(reject→retry→reject)→ 失败态持续可见,不出现骨架', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e1'))
    const { w } = await mountView('999')
    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)

    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e2'))
    await w.find('[data-test="album-retry"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-load-error"]').exists()).toBe(true)
    expect(w.find('[data-test="album-loading"]').exists()).toBe(false)
  })

  it('相册失败态的重试按钮重新调 fetchAlbums,成功后失败态消失', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('net'))
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(true)
    const fetchSpy = vi.spyOn(albums, 'fetchAlbums')

    await w.find('[data-test="album-retry"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalled()
    expect(albums.loadError).toBe(false)
    expect(w.find('[data-test="album-load-error"]').exists()).toBe(false)
    expect(w.text()).toContain('Trip')
  })

  it('fetchAlbums 完成后仍找不到该 id → 渲染"相册不存在"+返回按钮,点击返回 /photos/albums', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(1, { name: 'Other' })])
    const { w, router } = await mountView('999')
    expect(w.find('[data-test="album-not-found"]').exists()).toBe(true)
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="album-not-found-back"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })

  it('资产加载中且无数据 → 渲染 6 个骨架瓦片', async () => {
    svc.photos.getAlbum.mockImplementation(() => new Promise(() => {}))
    const { w } = await mountView('7')
    expect(w.findAll('.album-tile-skeleton')).toHaveLength(6)
  })

  it('资产非加载且空 → 渲染空态 photosAlbumEmptyTitle/Hint', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [] })
    const { w } = await mountView('7')
    expect(w.text()).toContain('相册是空的')
    expect(w.text()).toContain('点「添加照片」从图库中挑选。')
  })

  it('铁律回归:瓦片 data-id + img src=thumbnailUrl(id,"small");数字 cover 命中字符串 photo id(值比较,非引用)', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(7, { name: 'Trip', coverAssetId: 42 })])
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('42'), asset('99')] })
    const { w } = await mountView('7')

    const tiles = w.findAll('.tile').filter((t) => !t.classes().includes('album-tile-skeleton'))
    expect(tiles).toHaveLength(2)
    const tile42 = tiles.find((t) => t.attributes('data-id') === '42')!
    expect(tile42.find('img').attributes('src')).toBe('mock://thumb/42/small')
    expect(tile42.attributes('data-cover')).toBe('true')
    const tile99 = tiles.find((t) => t.attributes('data-id') === '99')!
    expect(tile99.attributes('data-cover')).toBe('false')
  })

  it('非 edit 点瓦片 → 灯箱打开,list=当前排序后的相册资产;切 taken 后顺序变', async () => {
    svc.photos.getAlbum.mockResolvedValue({
      assets: [asset('a', { takenAt: '2026-05-01T00:00:00Z' }), asset('b', { takenAt: '2026-06-01T00:00:00Z' })],
    })
    const { w } = await mountView('7')

    let tiles = w.findAll('.tile')
    await tiles[0].trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b']) // manual = feed order

    lb.close()
    await w.find('[data-test="album-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    await findSortItem(w, 'taken').trigger('click')
    await w.vm.$nextTick()

    tiles = w.findAll('.tile')
    await tiles[0].trigger('click')
    await flushPromises()
    expect(lb.list.value.map((p) => p.id)).toEqual(['b', 'a']) // taken desc: June before May
  })

  it('edit 态点瓦片 → 进选中、不开灯箱;移除按钮 disabled→可用;点它 → removeAssetsFromAlbum(id,[选中ids])+toast+清空选择', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a'), asset('b')] })
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    const toast = useToast()
    const removeSpy = vi.spyOn(albums, 'removeAssetsFromAlbum')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-remove-selected"]').attributes('disabled')).toBeDefined()

    const tiles = w.findAll('.tile')
    await tiles[0].trigger('click')
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(false)
    expect(w.find('[data-test="album-remove-selected"]').attributes('disabled')).toBeUndefined()

    await w.find('[data-test="album-remove-selected"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(removeSpy).toHaveBeenCalledWith('7', ['a'])
    expect(showSpy).toHaveBeenCalled()
    expect(w.find('[data-test="album-remove-selected"]').attributes('disabled')).toBeDefined()
  })

  it('拖拽守卫回归:drag.isDragging()===true 时点瓦片 → 既不开灯箱也不选中', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a'), asset('b')] })
    const { w } = await mountView('7')
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    dragMock.isDragging.mockReturnValue(true)
    const tiles = w.findAll('.tile')
    await tiles[0].trigger('click')
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(false)
    expect(w.find('[data-test="album-remove-selected"]').attributes('disabled')).toBeDefined()
  })

  it('点标题 → input 出现;回车改名 → renameAlbum(id,新名) 调用 + toast;input 消失,标题更新', async () => {
    svc.photos.updateAlbum.mockResolvedValueOnce({ name: 'New Name' })
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    const toast = useToast()
    const renameSpy = vi.spyOn(albums, 'renameAlbum')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="album-title"]').trigger('click')
    await w.vm.$nextTick()
    const input = w.find('[data-test="album-title-input"]')
    expect(input.exists()).toBe(true)
    await input.setValue('New Name')
    await input.trigger('keydown.enter')
    await flushPromises()
    await w.vm.$nextTick()

    expect(renameSpy).toHaveBeenCalledWith('7', 'New Name')
    expect(showSpy).toHaveBeenCalled()
    expect(w.find('[data-test="album-title-input"]').exists()).toBe(false)
    expect(w.find('[data-test="album-title"]').text()).toBe('New Name')
  })

  it('改名抛 409 → 显示重名文案,标题还原为原名', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    svc.photos.updateAlbum.mockRejectedValueOnce(err)
    const { w } = await mountView('7')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="album-title"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="album-title-input"]').setValue('Dup Name')
    await w.find('[data-test="album-title-input"]').trigger('keydown.enter')
    await flushPromises()
    await w.vm.$nextTick()

    expect(showSpy).toHaveBeenCalledWith('已存在同名相册')
    expect(w.find('[data-test="album-title"]').text()).toBe('Trip')
  })

  it('点 ⋯ → 菜单出现;点删除 → 确认模态;确认 → deleteAlbum 调用 + router.push(/photos/albums)', async () => {
    const { w, router } = await mountView('7')
    const albums = usePhotosAlbums()
    const deleteSpy = vi.spyOn(albums, 'deleteAlbum')
    const pushSpy = vi.spyOn(router, 'push')

    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-menu"]').exists()).toBe(true)

    await w.find('[data-test="album-menu-delete"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-delete-confirm"]').exists()).toBe(true)

    await w.find('[data-test="album-delete-confirm-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith('7')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })

  it('⋯ 菜单:document 级点外部关闭', async () => {
    const { w } = await mountView('7')
    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-menu"]').exists()).toBe(true)

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-menu"]').exists()).toBe(false)
  })

  it('删除确认模态:document 级 Esc 关闭(不是模板 @keydown.esc)', async () => {
    const { w } = await mountView('7')
    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="album-menu-delete"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-delete-confirm"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-delete-confirm"]').exists()).toBe(false)
  })

  it('点星标 → setAlbumCover(id, p.id) 调用 + toast', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a')] })
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    const toast = useToast()
    const coverSpy = vi.spyOn(albums, 'setAlbumCover')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('.tile-cover-btn').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(coverSpy).toHaveBeenCalledWith('7', 'a')
    expect(showSpy).toHaveBeenCalled()
  })

  it('右键瓦片(contextmenu)等价于点星标 → setAlbumCover 调用', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a')] })
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    const coverSpy = vi.spyOn(albums, 'setAlbumCover')

    await w.find('.tile').trigger('contextmenu')
    await flushPromises()

    expect(coverSpy).toHaveBeenCalledWith('7', 'a')
  })

  // SP15-P1-T9 · Step 0: the picker was generalised and no longer writes to the album itself —
  // it emits `confirm(ids)` and this page performs the write, the toast, the close and the
  // refresh. Those four were previously asserted inside PhotosLibraryPicker.test.ts; they are
  // asserted here now, at their new home, so nothing that moved lost its coverage.
  /** Enters edit mode and opens the library picker from the toolbar. */
  async function openPicker(w: ReturnType<typeof mount>) {
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="album-add-photos"]').trigger('click')
    await w.vm.$nextTick()
    return w.findComponent(PhotosLibraryPicker)
  }

  it("pressing Add photos opens PhotosLibraryPicker; its @confirm runs addAssetsToAlbum, the success toast, closes the panel and refreshes with fetchAlbumAssets", async () => {
    const { w } = await mountView('7') // beforeEach already names album 7 "Trip"
    const albums = usePhotosAlbums()
    const fetchSpy = vi.spyOn(albums, 'fetchAlbumAssets')
    const toast = useToast()

    const picker = await openPicker(w)
    expect(picker.exists()).toBe(true)
    expect(picker.props('open')).toBe(true)

    fetchSpy.mockClear()
    const showSpy = vi.spyOn(toast, 'show')
    picker.vm.$emit('confirm', ['x', 'y'])
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('7', ['x', 'y'])
    expect(fetchSpy).toHaveBeenCalledWith('7')
    // fix round 1 · finding 4: exactly one toast, and it is the success one with the album name
    // and the count — a duplicate, or a stray danger toast alongside it, has to fail here.
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(
      zh.photosAlbumAddedToast.replace('{count}', '2').replace('{name}', 'Trip'),
    )
    expect(picker.props('open')).toBe(false)
  })

  // A failed write: the panel stays up with the user's selection still in it so they can retry,
  // plus the failure toast. Same behaviour, moved out of the component.
  it('@confirm with a failing write → failure toast, the panel stays open, and the busy flag is released so a retry is possible', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    svc.photos.batchAddToAlbum.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()

    const picker = await openPicker(w)
    const showSpy = vi.spyOn(toast, 'show')
    picker.vm.$emit('confirm', ['x'])
    await flushPromises()

    // fix round 1 · finding 4: only the danger toast, nothing else.
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(zh.photosAlbumAddFailed)
    expect(picker.props('open')).toBe(true)

    // fix round 1 · finding 1: the busy flag must come back down in the handler's `finally`, or
    // the user is left staring at a permanently disabled "Adding…" button with no way to retry.
    expect(picker.props('submitting')).toBe(false)
    picker.vm.$emit('confirm', ['x'])
    await flushPromises()
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledTimes(2)

    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  // fix round 1 · finding 2: before Step 0 the picker computed existingIds itself and its own
  // cross-type test proved the String() normalisation. The expression moved to this page, so the
  // proof moves with it: album assets come back from the API with **numeric** ids while timeline
  // photos carry strings, and without String() not one already-in photo would be recognised.
  it('the existingIds handed to the picker are String()-normalised (a numeric album asset id arrives as a string)', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset(5)] })
    const { w } = await mountView('7')
    const picker = await openPicker(w)

    const ids = picker.props('existingIds') as Set<string>
    expect([...ids]).toEqual(['5'])
    expect(ids.has('5')).toBe(true)
  })

  // Coordinator review, fix round 2 · Important: an *already-open* picker used to survive a
  // route-id change untouched -- `:open="pickerOpen"` had no `album` gate of its own, the id
  // watcher never reset `pickerOpen`, and `onPickerConfirm` reads `albumId.value` fresh at call
  // time. Confirming after navigating away therefore wrote into whatever album the route now
  // pointed at, silently, with a success toast. Reproduce the exact scenario: open the picker on
  // album 7, navigate to a *different, real* album 999 (not a missing one -- that is the sibling
  // 'P2c detail sidebar' test below), then fire the same confirm event the picker would fire.
  it('closes the picker instead of writing to whatever album the route now points at when the id changes while it is open', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(7, { name: 'Trip' }), rawAlbum(999, { name: 'Other' })])
    const { w, router } = await mountView('7')
    const picker = await openPicker(w)
    expect(picker.props('open')).toBe(true)

    svc.photos.batchAddToAlbum.mockClear()
    await router.push('/photos/albums/999')
    await flushPromises()
    await w.vm.$nextTick()

    // Closed -- a real user could no longer reach the confirm button (PhotosLibraryPicker.vue
    // gates its whole template on `v-if="open"`).
    expect(picker.props('open')).toBe(false)
    // A confirm event fired directly on the (still-mounted) component instance -- the exact shape
    // the tests above use to exercise this handler without going through the picker's own
    // internal UI -- simulates the one race a real click can't produce (the click and the
    // navigation landing in the same synchronous tick). It must never write to 999: the
    // `pickerAlbumId` snapshot pins the write to the album the picker was actually opened for.
    picker.vm.$emit('confirm', ['x'])
    await flushPromises()
    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalledWith('999', ['x'])
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('7', ['x'])
  })

  // Task 4 re-review, folded into Task 5 (this task edits the same handler for the toast-name
  // carve-out): `onPickerConfirm` snapshots the write target (`pickerAlbumId`) but used to read
  // the success toast's `{name}` live off `album.value?.title` at resolve time. Reusing the exact
  // "confirm survives a navigation to a different real album" scenario above: after the id
  // changes to 999 ("Other"), `album.value.title` is "Other" even though the write still lands on
  // 7 ("Trip") -- the toast must say "Trip" (the album the picker was actually opened for), not
  // whatever the route happens to point at when the confirm resolves.
  it('names the success toast after the album the picker was opened for, not whatever album the route now points at when it resolves', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(7, { name: 'Trip' }), rawAlbum(999, { name: 'Other' })])
    const { w, router } = await mountView('7')
    const picker = await openPicker(w)
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await router.push('/photos/albums/999')
    await flushPromises()
    await w.vm.$nextTick()

    picker.vm.$emit('confirm', ['x'])
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('7', ['x'])
    expect(showSpy).toHaveBeenCalledWith(
      zh.photosAlbumAddedToast.replace('{count}', '1').replace('{name}', 'Trip'),
    )
  })

  // Coordinator review, fix round 2 · Minor: `edit` itself was never reset by the id watcher, so
  // navigating from album 7 mid-edit to a different, perfectly valid album 8 dropped the user
  // into edit mode on 8 without choosing it.
  it('leaves edit mode when the route id changes to a different album', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(7, { name: 'Trip' }), rawAlbum(8, { name: 'Other' })])
    const { w, router } = await mountView('7')
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar').exists()).toBe(true)

    await router.push('/photos/albums/8')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('.sv-select-bar').exists()).toBe(false)
    expect(w.find('[data-test="album-edit-toggle"]').attributes('data-open')).toBe('false')
  })

  it('onMounted 调 drag.refresh();edit/sortBy 切换调 drag.refresh();卸载调 drag.destroy()', async () => {
    const { w } = await mountView('7')
    expect(dragMock.refresh).toHaveBeenCalled()
    const afterMount = dragMock.refresh.mock.calls.length

    await w.find('[data-test="album-edit-toggle"]').trigger('click') // edit: false->true
    await w.vm.$nextTick()
    expect(dragMock.refresh.mock.calls.length).toBeGreaterThan(afterMount)
    const afterEdit = dragMock.refresh.mock.calls.length

    await w.find('[data-test="album-edit-toggle"]').trigger('click') // edit back to false (可见排序下拉)
    await w.vm.$nextTick()
    await w.find('[data-test="album-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    await findSortItem(w, 'taken').trigger('click')
    await w.vm.$nextTick()
    expect(dragMock.refresh.mock.calls.length).toBeGreaterThan(afterEdit)

    w.unmount()
    expect(dragMock.destroy).toHaveBeenCalled()
  })

  it('路由切换(params.id 变化)→ 重新 fetchAlbumAssets + 清空 selected + drag.refresh()', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(7, { name: 'Trip' }),
      rawAlbum(8, { name: 'Other' }),
    ])
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a')] })
    const { w, router } = await mountView('7')
    const albums = usePhotosAlbums()

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.tile').trigger('click') // select it
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-remove-selected"]').attributes('disabled')).toBeUndefined()

    const fetchSpy = vi.spyOn(albums, 'fetchAlbumAssets')
    dragMock.refresh.mockClear()
    await router.push('/photos/albums/8')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalledWith('8')
    expect(dragMock.refresh).toHaveBeenCalled()
  })

  it('Minor 回归:同实例路由切换须清掉未提交的标题编辑草稿(否则相册 7 的草稿名会被提交给相册 8)', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(7, { name: 'Trip' }),
      rawAlbum(8, { name: 'Other' }),
    ])
    const { w, router } = await mountView('7')
    const albums = usePhotosAlbums()
    const renameSpy = vi.spyOn(albums, 'renameAlbum')

    // 给相册 7 改名,但还没提交(不回车/不 blur)——titleEditing/titleDraft 停在编辑态。
    await w.find('[data-test="album-title"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="album-title-input"]').setValue('Draft For 7')
    expect(w.find('[data-test="album-title-input"]').exists()).toBe(true)

    // 同一组件实例切到相册 8(hash 路由不销毁重建)。
    await router.push('/photos/albums/8')
    await flushPromises()
    await w.vm.$nextTick()

    // 编辑态必须已复位——input 消失,标题态回到普通展示态,残留草稿不会在下次 blur/回车时
    // 被误提交给相册 8。
    expect(w.find('[data-test="album-title-input"]').exists()).toBe(false)
    expect(w.find('[data-test="album-title"]').text()).toBe('Other')
    expect(renameSpy).not.toHaveBeenCalled()
  })

  it('onOrder(T4 回调)触发且 store 抛错 → toast photosAlbumOrderFailed', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a'), asset('b')] })
    svc.photos.reorderAlbumAssets.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    expect(useAlbumDragSortSpy).toHaveBeenCalled()
    const opts = useAlbumDragSortSpy.mock.calls[0][0]
    opts.onOrder(['b', 'a'])
    await flushPromises()

    expect(showSpy).toHaveBeenCalledWith('排序保存失败')
    void w
  })

  it('评审 Important 2 回归:空相册 edit 态下添加照片,网格从「不存在」变为「存在」时须重新挂载拖拽(gridRef watch)', async () => {
    // 复现路径:空相册挂载(gridRef 只绑在 v-else 第三分支,骨架/空态两支都拿不到它)→ 进 edit
    // (watch([edit,sortBy]) 触发过一次 refresh,但此刻 gridRef 仍是 null)→ 添加照片 →
    // fetchAlbumAssets 回来资产非空 → 模板切到 v-else 分支、gridRef 才第一次有值 → 除非专门
    // watch(gridRef),否则没有任何现有触发点会在这一刻再调 refresh(),Sortable 永远建不起来。
    const { w } = await mountView('7')
    expect(w.find('[data-test="album-empty"]').exists()).toBe(true)

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    // T9 · Step 0: going through @confirm fetches the assets twice (the store's addAssetsToAlbum
    // fetches once itself, then this page's success branch refreshes) — it was two fetches before
    // the generalisation as well, only the first one happened inside the component. Hence
    // mockResolvedValue rather than …Once, so both fetches see the same assets.
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a'), asset('b')] })
    dragMock.refresh.mockClear()
    const picker = w.findComponent(PhotosLibraryPicker)
    picker.vm.$emit('confirm', ['a', 'b'])
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.findAll('.tile').filter((t) => !t.classes().includes('album-tile-skeleton'))).toHaveLength(2)
    expect(dragMock.refresh).toHaveBeenCalled()
  })

  it('灯箱 delete → timeline.deleteAssets([String(id)]) + toast + albums.fetchAlbumAssets 刷新', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a')] })
    const { w } = await mountView('7')
    const timeline = useTimelineStore()
    const albums = usePhotosAlbums()
    const deleteSpy = vi.spyOn(timeline, 'deleteAssets').mockResolvedValue(1)
    const fetchSpy = vi.spyOn(albums, 'fetchAlbumAssets')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.find('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith('7')
  })

  // Task 9: 灯箱「加入相册」→ 打开 AlbumPickerDialog(assetIds=[当前项 id])。只接灯箱这一处——
  // edit 工具条的「添加照片」(PhotosLibraryPicker)已有自己的语义,不重复放「加入相册」;
  // 加到的是别的相册,不需要刷新本相册的资产列表。
  it('灯箱「加入相册」→ AlbumPickerDialog 打开(不刷新本相册资产)', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a')] })
    svc.photos.batchAddToAlbum.mockClear()
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    const fetchAssetsSpy = vi.spyOn(albums, 'fetchAlbumAssets')

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    fetchAssetsSpy.mockClear() // 只关心「加入相册」之后是否多调了一次

    await w.find('.lb-add-album').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-picker-overlay"]').exists()).toBe(true)
    expect(lb.open.value).toBe(true) // 灯箱不因加入相册而关闭

    const item = w.find('[data-test="album-picker-item"]')
    expect(item.exists()).toBe(true)
    await item.trigger('click')
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(7, ['a'])
    expect(fetchAssetsSpy).not.toHaveBeenCalled() // 加到的是别的相册,不刷新本相册
  })

  // 终审必修 1:灯箱在 window 上挂 keydown(PhotoLightbox.vue:144),AlbumPickerDialog 在
  // document 上挂(:74)。同一次 Esc 冒泡顺序是 document 先于 window——不做任何处理时,
  // document 监听先关掉选择器,冒泡继续到 window 又把灯箱也关了(T9 设计明确「灯箱本身不
  // 关闭」,PhotoLightbox.vue:51-52)。断言:选择器关闭,但灯箱仍 open。
  it('必修1回归:灯箱开着时按 Esc,加入相册选择器随 Esc 关闭,但灯箱不跟着被误关', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a')] })
    const { w } = await mountView('7')

    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-add-album').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="album-picker-overlay"]').exists()).toBe(true)

    // bubbles:true——真实用户按键的原生 keydown 默认冒泡到 window;这里显式带上,
    // 才是复现「document 冒泡先关面板,继续冒泡到 window 又把灯箱关了」的真实路径。
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-picker-overlay"]').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
  })

  // 终审 Minor 6:removeSelected 请求飞行期不 disable,连点会对同一批 id 发两轮并发 DELETE。
  it('Minor 6 回归:连点两次「移除选中」→ removeAssetsFromAlbum 只被调一次(重入守卫)', async () => {
    svc.photos.getAlbum.mockResolvedValue({ assets: [asset('a'), asset('b')] })
    let resolveRemove: (() => void) | undefined
    const removeSpy = vi.spyOn(usePhotosAlbums(), 'removeAssetsFromAlbum').mockImplementation(
      () => new Promise((resolve) => { resolveRemove = () => resolve(undefined) }),
    )
    const { w } = await mountView('7')

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.tile').trigger('click')
    await w.vm.$nextTick()

    const removeBtn = w.find('[data-test="album-remove-selected"]')
    await removeBtn.trigger('click')
    await removeBtn.trigger('click') // 第二次点击在第一次未 resolve 前触发
    await flushPromises()

    expect(removeSpy).toHaveBeenCalledTimes(1)
    resolveRemove?.()
    await flushPromises()
  })

  // Task 6: stats rail + more-menu reshape (SP15-P2b) -- aligns this page with the smart-view
  // detail page's own sidebar/menu idiom.
  //
  // Task 4 re-home: the target trims the stats rail from 4 cells to 2 (Span/Created moved to the
  // new About section as their own rows, see the 'P2c detail sidebar' describe block below) --
  // this test used to assert all 4, updated to assert only what the trimmed rail still carries.
  it('shows a stats rail with photos and videos', async () => {
    const w = await mountDetail({
      album: { id: 'a1', name: 'A', assetCount: 12, dateStart: '2025-06-01', dateEnd: '2025-12-31', videoCount: 3, createdAt: '2026-02-01T00:00:00Z' },
      assets: [{ id: 'p1', takenAt: '2025-06-02' }],
    })
    const cells = w.findAll('[data-test="album-stat-cell"]')
    expect(cells).toHaveLength(2)
    expect(cells[0].text()).toContain('12')
    expect(cells[1].text()).toContain('3')
  })

  it('reports zero videos rather than a dash when the album has none', async () => {
    // videoCount is not omitempty on the wire, so 0 is a real answer, not missing data.
    const w = await mountDetail({ album: { id: 'a1', name: 'A', videoCount: 0 }, assets: [] })
    expect(w.findAll('[data-test="album-stat-cell"]')[1].text()).toContain('0')
  })

  it('buckets members by month and omits the histogram when nothing carries a takenAt', async () => {
    const withDates = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [{ id: 'p1', takenAt: '2025-06-02' }, { id: 'p2', takenAt: '2025-06-09' }, { id: 'p3', takenAt: '2025-07-01' }],
    })
    expect(withDates.findAll('[data-test="album-dist-bar"]')).toHaveLength(2)
    const without = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [{ id: 'p1' }] })
    expect(without.find('[data-test="album-dist"]').exists()).toBe(false)
  })

  it('keeps the rail out of the photo grid\'s scroll container', async () => {
    // Both columns scroll independently; if a shared wrapper scrolled instead, the rail would
    // scroll away with the photos (the exact defect PhotosMomentDetail was fixed for).
    // SP15-P2c Task 3 re-home: the container is .sv-detail-layout now, not .album-detail-body,
    // and it holds the columns apart with `min-height: 0` on a grid whose two cells each own an
    // `overflow-y: auto` -- so the assertion moves onto those two cells. The grid wrapper must
    // NOT have a scroller of its own any more, or the main column gets two nested scrollbars.
    const css = readFileSync('src/views/PhotosAlbumDetail.vue', 'utf8')
    expect(css).toMatch(/\.sv-detail-layout\s*\{[^}]*min-height:\s*0/)
    expect(css).toMatch(/\.sv-detail-main\s*\{[^}]*overflow-y:\s*auto/)
    expect(css).toMatch(/\.sv-detail-side\s*\{[^}]*overflow-y:\s*auto/)
    expect(css).not.toMatch(/\.album-photos-wrap\s*\{[^}]*overflow/)
  })

  it('gives the more menu an icon, a title and a hint per row', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="album-menu-icon"]').length).toBeGreaterThanOrEqual(3)
    expect(w.find('[data-test="album-menu-rename"]').text()).toContain('修改相册名称')
  })

  it('offers Convert to Smart Album above the destructive separator', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-menu-convert"]').exists()).toBe(true)
  })

  it('disables Convert to Smart Album when smart views are off', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [], aiFeatures: { smartview: false } })
    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-menu-convert"]').attributes('disabled')).toBeDefined()
  })

  it('navigates to the new smart view once the conversion lands', async () => {
    const { w, router } = await mountDetailWithRouter({ album: { id: 'a1', name: 'A' }, assets: [] })
    const push = vi.spyOn(router, 'push')
    await w.findComponent(AlbumConvertToSmartDialog).vm.$emit('converted', { id: 'sv-new' })
    await w.vm.$nextTick()
    expect(push).toHaveBeenCalledWith('/photos/smart-views/sv-new')
  })
})

// SP15-P2c Task 3: the cover hero and the toolbar band are gone; the page now wears the same
// skeleton as the smart-view detail page (detail bar -> two-column layout -> sv-header with the
// action row -> photo grid), and edit mode's two buttons live in a floating bottom bar.
describe('P2c detail skeleton', () => {
  it('renders the detail bar with a back button and the created date', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A', createdAt: '2026-05-01T00:00:00Z' }, assets: [] })
    expect(w.find('.sv-detail-bar').exists()).toBe(true)
    expect(w.find('.sv-detail-bar .back').exists()).toBe(true)
    // The rendered date itself is ICU output for the active locale, so assert the wrapper copy
    // rather than restating the formatter here.
    const prefix = zh.photosDetailCreatedAt.split('{date}')[0]
    expect(w.find('[data-test="album-created"]').text().startsWith(prefix)).toBe(true)
  })

  it('omits the created date entirely when the album has no creation timestamp', async () => {
    // createdLabel falls back to the em-dash placeholder -> the span must not render at all.
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    expect(w.find('.sv-detail-bar').exists()).toBe(true)
    expect(w.find('[data-test="album-created"]').exists()).toBe(false)
  })

  it('goes back to the albums list from the detail bar', async () => {
    const { w, router } = await mountDetailWithRouter({ album: { id: 'a1', name: 'A' }, assets: [] })
    const push = vi.spyOn(router, 'push')
    await w.find('[data-test="album-back"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/albums')
  })

  it('no longer renders the cover hero or the toolbar band', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A', coverAssetId: 'cover-1' }, assets: [] })
    expect(w.find('.album-hero').exists()).toBe(false)
    expect(w.find('.album-toolbar').exists()).toBe(false)
    // The hero was the only consumer of the large cover thumbnail, so the request goes with it.
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('cover-1', 'large')
  })

  it('renders the two-column layout with the main column and the sidebar', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    expect(w.find('.sv-detail-layout .sv-detail-main .sv-header').exists()).toBe(true)
    expect(w.find('.sv-detail-layout > .sv-detail-side').exists()).toBe(true)
    expect(w.find('.sv-detail-main .album-photos-wrap').exists()).toBe(true)
  })

  it('puts the date range pill on the h1 row, not in a separate chips row', async () => {
    const w = await mountDetail({
      album: { id: 'a1', name: 'A', dateStart: '2026-01-01', dateEnd: '2026-03-01' },
      assets: [],
    })
    expect(w.find('.sv-header h1 .sv-cond').text()).toBe('Jan - Mar 2026')
  })

  it('shows the items count and hides the videos count when there are no videos', async () => {
    // One mount per test: the albums store only fetches while `albumsLoaded` is false, so a
    // second mountDetail in the same test would silently keep the first album's fixture.
    const w = await mountDetail({ album: { id: 'a1', name: 'A', assetCount: 12, videoCount: 0 }, assets: [] })
    expect(w.find('[data-test="album-header-items"]').text()).toContain('12')
    expect(w.find('[data-test="album-header-videos"]').exists()).toBe(false)
  })

  it('shows the videos count alongside the items count when the album has videos', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A', assetCount: 12, videoCount: 3 }, assets: [] })
    expect(w.find('[data-test="album-header-items"]').text()).toContain('12')
    expect(w.find('[data-test="album-header-videos"]').text()).toContain('3')
  })

  it('hides sort and density in edit mode but keeps Edit/Done', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    expect(w.find('.order-pill').exists()).toBe(true)
    expect(w.find('.density').exists()).toBe(true)

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.find('.order-pill').exists()).toBe(false)
    expect(w.find('.density').exists()).toBe(false)
    expect(w.find('[data-test="album-edit-toggle"]').exists()).toBe(true)
    // The two separators only exist to part Sort/density from Edit, so they leave with them.
    expect(w.findAll('.album-detail-actions-sep')).toHaveLength(0)
  })

  it('marks the photo grid wrapper with the edit flag so the cover badge and tile outline rules can key off it', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
    expect(w.find('.album-photos-wrap').attributes('data-edit')).toBe('false')
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.album-photos-wrap').attributes('data-edit')).toBe('true')
  })

  it('still opens the lightbox from a tile click outside edit mode', async () => {
    // Regression guard: the grid moved into a new container, the click path must survive.
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a'), asset('b')] })
    await w.find('.tile').trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b'])
  })

  // ── Edit-mode bottom select bar ──
  // Deviation from the brief, registered: the brief said the bar renders only with at least one
  // selection. The target (33b05636:PhotosAlbumDetail.vue:326-327) renders it on `edit` alone and
  // says so in its own comment, and it has to -- the bar carries the "Click to select · Drag to
  // reorder" hint (dead copy if it only appeared after a selection) and the Add photos button
  // (unreachable in an empty album otherwise). The Vue 2 source wins per the branch's 1:1 rule.
  it('shows the select bar in edit mode even before anything is selected', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
    expect(w.find('.sv-select-bar').exists()).toBe(false)

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar').exists()).toBe(true)
    // Whole-branch review, Important 3: the bar's own copy, not the tile tooltip's -- the bar
    // offers no way to set a cover, so it must not advertise "★ to set cover".
    expect(w.find('.sv-select-bar').text()).toContain(zh.photosAlbumHintSelectDrag)
    expect(w.find('.sv-select-bar').text()).not.toContain('★')

    await w.find('.tile').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar').text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
  })

  // Fix-2 item 5 (owner acceptance, 2026-08-13; F1 lesson class): this whole tail section used
  // to be a template-root SIBLING of `.photos-root` rather than its DOM descendant, so none of
  // parity's `.photos-root .sv-select-bar` / `.photos-root .lb-confirm-scrim` descendant
  // selectors (photos-smartview.scss:675 / photos.scss:620) could match -- the exact same root
  // cause as Fix-1 item 3's "New album" modal bug (acceptance-fix-report.md §F1), now found in
  // this page's own edit-mode bar, delete-confirm dialog, library picker, lightbox, album
  // picker, and convert-to-smart dialog. Same fix: nest them back inside `.photos-root`.
  describe('Fix-2 item 5: the edit-mode tail section is a real descendant of .photos-root', () => {
    it('the select bar renders inside .photos-root (so parity .sv-select-bar can match)', async () => {
      const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
      await w.find('[data-test="album-edit-toggle"]').trigger('click')
      await w.vm.$nextTick()
      const bar = w.get('.sv-select-bar').element
      expect(bar.closest('.photos-root')).not.toBeNull()
    })

    it('the delete-confirm dialog renders inside .photos-root', async () => {
      const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
      await w.find('[data-test="album-more-btn"]').trigger('click')
      await w.vm.$nextTick()
      await w.find('[data-test="album-menu-delete"]').trigger('click')
      await w.vm.$nextTick()
      const scrim = w.get('[data-test="album-delete-confirm"]').element
      expect(scrim.closest('.photos-root')).not.toBeNull()
    })

    it('the library picker renders inside .photos-root', async () => {
      // PhotosLibraryPicker's own root is `v-if="open"` -- closed, `.element` is a comment
      // placeholder with no `.closest`, so open it first via the select bar's Add photos button.
      const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
      await w.find('[data-test="album-edit-toggle"]').trigger('click')
      await w.vm.$nextTick()
      await w.find('.sv-select-bar [data-test="album-add-photos"]').trigger('click')
      await w.vm.$nextTick()
      const overlay = w.get('[data-test="lib-picker-overlay"]').element
      expect(overlay.closest('.photos-root')).not.toBeNull()
    })
  })

  // Fix-8 round 4 (owner acceptance, 2026-08-14): unlike every other element in the "Fix-2 item
  // 5" block above, `<PhotoLightbox>` is deliberately NOT nested inside `.photos-root` here.
  // Nesting it (as an earlier fix round on this same file did) activates parity's own
  // `.photos-root .lightbox`/`.lb-*` rule family (vue2-parity/photos.scss:499-1061+), which
  // targets a *future* Plan-F re-skin describing a different DOM/CSS shape (a CSS Grid with
  // named grid-area children) than this component's own current, self-contained flex layout --
  // every colliding selector ties in specificity between the component's own scoped rule and
  // parity's, a genuine cascade tie settled only by bundler-internal CSS order. Confirmed by
  // real-device evidence: `lb.openAt`'s network calls fired (state opened) but the lightbox
  // never became visible. See acceptance-fix-report.md §F8-r4 for the full collision list.
  describe('Fix-8 round 4: the lightbox is deliberately NOT nested inside .photos-root', () => {
    it('the lightbox renders OUTSIDE .photos-root (parity\'s future-re-skin .lightbox/.lb-* rules must not match this component yet)', async () => {
      const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
      await w.find('.tile').trigger('click')
      await flushPromises()
      const lightbox = w.get('.lightbox').element
      expect(lightbox.closest('.photos-root')).toBeNull()
    })
  })

  it('removes the selected photos and keeps the guard against a double click', async () => {
    let resolveRemove: (() => void) | undefined
    const removeSpy = vi.spyOn(usePhotosAlbums(), 'removeAssetsFromAlbum').mockImplementation(
      () => new Promise((resolve) => { resolveRemove = () => resolve(undefined) }),
    )
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a'), asset('b')] })

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.tile').trigger('click')
    await w.vm.$nextTick()

    const btn = w.find('.sv-select-bar [data-test="album-remove-selected"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await btn.trigger('click') // second press lands before the first request resolves
    await flushPromises()

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledWith('a1', ['a'])
    resolveRemove?.()
    await flushPromises()
  })

  it('opens the library picker from the select bar', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.findComponent(PhotosLibraryPicker).props('open')).toBe(false)
    await w.find('.sv-select-bar [data-test="album-add-photos"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.findComponent(PhotosLibraryPicker).props('open')).toBe(true)
  })

  it('hides the select bar again after leaving edit mode', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a')] })
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar').exists()).toBe(true)

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar').exists()).toBe(false)
  })

  it('clears the selection when leaving edit mode so a later edit session starts empty', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('a'), asset('b')] })
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.tile').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar [data-test="album-remove-selected"]').attributes('disabled')).toBeUndefined()

    await w.find('[data-test="album-edit-toggle"]').trigger('click') // leave
    await w.vm.$nextTick()
    await w.find('[data-test="album-edit-toggle"]').trigger('click') // and come back
    await w.vm.$nextTick()

    // A stale selection here would send the previous session's ids on the next Remove press.
    expect(w.find('.sv-select-bar [data-test="album-remove-selected"]').attributes('disabled')).toBeDefined()
    expect(w.find('.sv-select-bar').text()).toContain(zh.photosAlbumHintSelectDrag)
  })

  // Task 3 review finding, folded into Task 4 (this task edits the file, so it inherits the
  // fix): the select bar used to live inside the `v-else-if="album"` branch, so "no album ->
  // no bar" came for free. Once the P2c skeleton pulled it out to a `v-if="edit"` sibling, the
  // route-id watcher clearing `selected`/the title draft (but never `edit`) left the bar floating
  // over the "Album not found" screen with Add photos still reachable. Reproduce exactly that
  // path: enter edit mode on a real album, then navigate to an id that isn't in the store.
  it("navigating to a missing album while mid-edit hides the select bar instead of floating it over 'Album not found'", async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(7, { name: 'Trip' })])
    const { w, router } = await mountView('7')
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.sv-select-bar').exists()).toBe(true)

    await router.push('/photos/albums/999')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-not-found"]').exists()).toBe(true)
    expect(w.find('.sv-select-bar').exists()).toBe(false)
  })
})

// Task 4 (Vue2 33b05636:PhotosAlbumDetail.vue:145-300, :591-613). About section + trimmed
// stats + the by-month histogram it keeps unchanged. `fmtDate` mirrors createdLabel/
// timeSpanLabel's own formatter — this file's i18n locale is 'zh_cn' (see the module-level
// createI18n above), so localeTag is 'zh-cn', not the 'en-us' PhotosMomentDetail.test.ts uses.
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-cn', { month: 'short', day: 'numeric', year: 'numeric' })
}

describe('P2c detail sidebar', () => {
  it('renders the About section with type, created, time span and place rows', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    const rows = w.findAll('.sv-side-section .mo-about-row')
    expect(rows).toHaveLength(4)
  })

  // 5 distinct places; frequency counts (C=3, E=2, A=B=D=1) deliberately diverge from
  // first-appearance order (A,B,C,D,E) so a mutant that drops the frequency sort would produce a
  // different string ("A · B · C +2") than the correct one below.
  it('shows the top three places joined by a middle dot and a +N remainder', async () => {
    const w = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [
        asset('p1', { placeName: 'A' }),
        asset('p2', { placeName: 'B' }),
        asset('p3', { placeName: 'C' }),
        asset('p4', { placeName: 'D' }),
        asset('p5', { placeName: 'E' }),
        asset('p6', { placeName: 'C' }),
        asset('p7', { placeName: 'C' }),
        asset('p8', { placeName: 'E' }),
      ],
    })
    expect(w.find('[data-test="album-about-place"] b').text()).toBe('C · E · A +2')
  })

  it('orders places by frequency, not by the order they appear in the asset list', async () => {
    // 'Rome' appears once and first; 'Paris' appears three times, all later -- the frequent one
    // must lead despite arriving after Rome in the asset list.
    const w = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [
        asset('p1', { placeName: 'Rome' }),
        asset('p2', { placeName: 'Paris' }),
        asset('p3', { placeName: 'Paris' }),
        asset('p4', { placeName: 'Paris' }),
      ],
    })
    expect(w.find('[data-test="album-about-place"] b').text()).toBe('Paris · Rome')
  })

  it('puts every place with its count in the title attribute', async () => {
    const w = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [
        asset('p1', { placeName: 'Rome' }),
        asset('p2', { placeName: 'Paris' }),
        asset('p3', { placeName: 'Paris' }),
        asset('p4', { placeName: 'Paris' }),
      ],
    })
    expect(w.find('[data-test="album-about-place"] b').attributes('title')).toBe('Paris (3) · Rome (1)')
  })

  it('falls back to the placeholder when no member has a place', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [asset('p1'), asset('p2')] })
    const place = w.find('[data-test="album-about-place"] b')
    expect(place.text()).toBe('—')
    // Not the placeholder -- there is nothing to hint at, so the title attribute must be empty.
    expect(place.attributes('title')).toBe('')
  })

  it('derives the time span from loaded members when the album carries no dateRange', async () => {
    // No dateStart/dateEnd on the album -> formatAlbumSpan returns '' -> spanLabel falls to DASH,
    // so timeSpanLabel must compute its own min/max from the loaded members' takenAt instead.
    const w = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [asset('p1', { takenAt: '2025-06-02T00:00:00Z' }), asset('p2', { takenAt: '2025-07-10T00:00:00Z' })],
    })
    const expected = `${fmtDate('2025-06-02T00:00:00Z')} – ${fmtDate('2025-07-10T00:00:00Z')}`
    expect(w.find('[data-test="album-about-timespan"] b').text()).toBe(expected)
  })

  it('falls back to the placeholder for Created and Time span when both are unusable', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A', createdAt: 'not-a-date' }, assets: [] })
    expect(w.find('[data-test="album-about-created"] b').text()).toBe('—')
    expect(w.find('[data-test="album-about-timespan"] b').text()).toBe('—')
  })

  it('renders exactly two stat cells, photos and videos', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    const cells = w.findAll('.sv-stat-grid .sv-stat-cell')
    expect(cells).toHaveLength(2)
  })

  it('keeps the monthly histogram section', async () => {
    const w = await mountDetail({
      album: { id: 'a1', name: 'A' },
      assets: [asset('p1', { takenAt: '2025-06-02' }), asset('p2', { takenAt: '2025-07-01' })],
    })
    expect(w.find('[data-test="album-dist"]').exists()).toBe(true)
    expect(w.findAll('[data-test="album-dist-bar"]')).toHaveLength(2)
  })
})

// Task 5 (Vue2 33b05636:PhotosAlbumDetail.vue :211-283). The more menu grows from the three
// entries Task 3 parked in the header (Rename/Convert/Delete) to the target's full five
// (Rename/Duplicate/Download as ZIP/Convert/Delete), and its container moves into the sidebar's
// .sv-side-actions (above the About section), fixed-positioned via useFixedMenuPosition (T1) so
// it no longer clips against .sv-detail-side's own overflow-y:auto.
describe('P2c album more menu', () => {
  async function openMenu(w: ReturnType<typeof mount>) {
    await w.find('[data-test="album-more-btn"]').trigger('click')
    await w.vm.$nextTick()
  }

  // Coordinator review fix (Important): restores the real `window.location` after every test in
  // this block, unconditionally (afterEach runs whether the test passed or threw) -- so the
  // "navigates to the zip url" test's stub below can never leak into a later test, in this file
  // or (since vitest tears down per file but shares the jsdom global across the whole run) beyond
  // it. Scoped to this describe rather than the file's own top-level afterEach: this is the only
  // test in the file that touches `window.location`, so the restore belongs next to it.
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalWindowLocation })
  })

  it('renders exactly five entries in the target order', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await openMenu(w)
    const titles = w.findAll('.sv-export-title').map((n) => n.text())
    expect(titles).toEqual(['重命名', '复制', '下载为 ZIP', '转换', '删除'])
  })

  it("lives in the sidebar's .sv-side-actions container, above the About section", async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    const side = w.find('[data-test="album-side"]')
    const actions = side.find('.sv-side-actions')
    expect(actions.exists()).toBe(true)
    expect(actions.find('[data-test="album-more-btn"]').exists()).toBe(true)
    const children = Array.from(side.element.children)
    const actionsIndex = children.indexOf(actions.element)
    const aboutIndex = children.findIndex((c) => c.getAttribute('data-test') === 'album-about')
    expect(actionsIndex).toBeGreaterThanOrEqual(0)
    expect(actionsIndex).toBeLessThan(aboutIndex)
  })

  // Fix-10 (owner acceptance, 2026-08-14): was asserted against the generic `useToast()` --
  // Vue2's real duplicate-success confirmation is `window.PhotosToast.show({ icon: 'sparkles',
  // ... })`, the photos-private bottom-pill toast, not the app-wide generic one. Updated to
  // assert against `usePhotosToast()`'s queue instead, including the icon.
  it('duplicates the album and shows the photos-private toast, closes the menu', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'Trip' }, assets: [] })
    const albums = usePhotosAlbums()
    const dupSpy = vi.spyOn(albums, 'duplicateAlbum')

    await openMenu(w)
    await w.find('[data-test="album-menu-duplicate"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(dupSpy).toHaveBeenCalledWith('a1')
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('Trip copy')
    const toasts = usePhotosToast().toasts.value
    expect(toasts.map((t) => t.text)).toContain(zh.photosSvDuplicatedNameOpenCopy.replace('{name}', 'Trip'))
    expect(toasts.find((t) => t.text === zh.photosSvDuplicatedNameOpenCopy.replace('{name}', 'Trip'))?.icon).toBe('sparkles')
    expect(w.find('[data-test="album-menu"]').exists()).toBe(false)
  })

  it('does not fire a second duplicate while the first is in flight', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'Trip' }, assets: [] })
    let resolveCreate!: (v: unknown) => void
    svc.photos.createAlbum.mockImplementationOnce(() => new Promise((resolve) => { resolveCreate = resolve }))

    await openMenu(w)
    await w.find('[data-test="album-menu-duplicate"]').trigger('click') // first call: store guard now busy
    await openMenu(w) // duplicateAlbum() closes the menu synchronously -- reopen it
    await w.find('[data-test="album-menu-duplicate"]').trigger('click') // second call: guard rejects it
    await flushPromises()

    resolveCreate({ id: 'new1', name: 'Trip copy' })
    await flushPromises()

    expect(svc.photos.createAlbum).toHaveBeenCalledTimes(1)
  })

  // Coordinator review fix (Important): the old version of this test asserted only that
  // `exportAlbumZipUrl` was called -- a mutant that computes the URL and then discards it (never
  // assigning to `location.href`) still passed. Intercepts the assignment itself, following this
  // repo's own established precedent for the same problem (jsdom does not implement real
  // navigation): `src/home/components/widgets/AiWidget.test.ts`, `src/home/components/HomeDock.test.ts`,
  // `src/views/__tests__/PhotosSmartViewDetail.test.ts:577` all stub `window.location` with a
  // capturing `href` setter rather than asserting the (jsdom-unreliable) read-back value. Stubbed
  // *after* mount/menu-open (mounting depends on the router reading the real `window.location`
  // for hash-history setup) and restored by this describe block's own afterEach above.
  it('navigates to the zip url built by the service', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await openMenu(w)

    const hrefs: string[] = []
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { set href(v: string) { hrefs.push(v) }, get href() { return '' } },
    })

    await w.find('[data-test="album-menu-zip"]').trigger('click')
    await w.vm.$nextTick()

    expect(svc.photos.exportAlbumZipUrl).toHaveBeenCalledWith('a1')
    expect(hrefs).toEqual(['mock://export/a1'])
  })

  it('shows the estimated size in the zip entry description', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A', assetCount: 10 }, assets: [] })
    await openMenu(w)
    expect(w.find('[data-test="album-menu-zip"]').text()).toContain('10 张照片 · 约 32 MB')
  })

  it('disables Convert and shows the smart-views-off title when the feature is off', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [], aiFeatures: { smartview: false } })
    await openMenu(w)
    const convert = w.find('[data-test="album-menu-convert"]')
    expect(convert.attributes('disabled')).toBeDefined()
    expect(convert.attributes('title')).toBe(zh.photosSvSmartViewsOffCreateHint)
  })

  it('keeps Convert clickable when the feature is on', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [], aiFeatures: { smartview: true } })
    await openMenu(w)
    expect(w.find('[data-test="album-menu-convert"]').attributes('disabled')).toBeUndefined()
  })

  it('applies the fixed position style to the menu when it opens', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await openMenu(w)
    expect(w.find('.sv-export-menu').attributes('style')).toContain('position: fixed')
  })

  it('closes the menu when clicking outside it', async () => {
    // Regression: morePopRef (click-outside) must still work now that the menu itself is
    // position:fixed -- the composable only computes coordinates, dismissal stays this page's job.
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await openMenu(w)
    expect(w.find('[data-test="album-menu"]').exists()).toBe(true)

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-menu"]').exists()).toBe(false)
  })

  // Whole-branch review, Important 2: the Convert entry's desc is the target's own menu string
  // ("Turn into a Smart Album that keeps updating"), NOT the convert modal's subtitle
  // ("Nimo keeps adding matches automatically"). One key served both for the whole phase, so
  // the menu read the modal's copy. Asserting the rendered desc text is what pins the two apart
  // -- asserting the key name would pass either way.
  it('describes the Convert entry with the menu string, not the convert modal subtitle', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await openMenu(w)
    const desc = w.find('[data-test="album-menu-convert"] .sv-export-desc').text()
    expect(desc).toBe(zh.photosAlbumMenuConvertHint)
    expect(desc).not.toBe(zh.photosAlbumConvertToSmartHint)
  })
})

// Whole-branch review fixes that do not belong to any single earlier task's block.
describe('P2c whole-branch review fixes', () => {
  // Important 1: the defect PhotosSmartViewDetail.vue already fixed, ported here. Activating
  // Edit from the keyboard (Space/Enter on the focused button) fires a `click` with no
  // `mousedown` -- the only event that dismisses the sort menu. VTU's `.trigger('click')` has
  // the identical shape (no synthetic mousedown), so it reproduces the real path exactly: open
  // the sort menu, flip edit on and back off through the toggle alone, and the popup must not
  // spring back once the capsule remounts.
  it('does not leave the sort menu stuck open after toggling edit mode via the Edit button', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await w.find('[data-test="album-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="album-sort-menu"]').exists()).toBe(true)

    await w.find('[data-test="album-edit-toggle"]').trigger('click') // enter edit mode
    await w.vm.$nextTick()
    await w.find('[data-test="album-edit-toggle"]').trigger('click') // leave edit mode again
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-sort-menu"]').exists()).toBe(false)
  })

  // Minor 7: the check-glyph / empty-spacer pair drifted from the target for the whole phase
  // before Task 11 caught it, with nothing guarding it. The spacer is the half a future edit
  // drops, and dropping it shifts every label between active and inactive rows -- so assert
  // both halves: every option carries exactly one slot, and only the active one holds a glyph.
  it('gives every sort option a check slot and the glyph only to the active one', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    await w.find('[data-test="album-sort-btn"]').trigger('click')
    await w.vm.$nextTick()

    const items = w.findAll('[data-test="album-sort-item"]')
    expect(items.length).toBeGreaterThan(1)
    for (const item of items) {
      expect(item.findAll('.album-sort-check')).toHaveLength(1)
      const hasGlyph = item.find('.album-sort-check').element.tagName.toLowerCase() === 'svg'
      expect(hasGlyph).toBe(item.attributes('data-active') === 'true')
    }
    expect(items.filter((n) => n.attributes('data-active') === 'true')).toHaveLength(1)
  })
})

// Fix-1 item 1 (owner acceptance, 2026-08-13): plan-premise correction — Vue2 nests the album
// detail state inside PhotosAlbumsView while activeNav stays 'albums'
// (NimoOS-UI src/views/Photos/PhotosAlbumsView.vue:1016-1022 `v-else-if="activeNav==='albums'"`
// wraps both the list AND the detail-layer <photos-album-detail>, PhotosAlbumsView.vue:12-21).
// PhotosTimeline's topbar therefore never changes while a detail is open under this nav: same
// title ('Albums') and same album-aggregate sub as the list page.
describe('Fix-1 item 1: PhotosTopbar restored (same title/sub as the Albums list, Vue2 truth)', () => {
  it('renders the topbar with title=Albums and the album-aggregate sub, no search box', async () => {
    svc.photos.listAlbums.mockClear().mockResolvedValue([
      rawAlbum(7, { name: 'Trip', photoCount: 40, videoCount: 2 }),
      rawAlbum(8, { name: 'Other', photoCount: 10, videoCount: 0 }),
    ])
    const { w } = await mountView(7)
    expect(w.findComponent(PhotosTopbar).exists()).toBe(true)
    expect(w.get('.topbar-title').text()).toBe(zh.photosAlbumsTitle)
    expect(w.get('.topbar-sub').text()).toBe(
      zh.photosCountSummary.replace('{photos}', '50').replace('{videos}', '2'),
    )
    expect(w.find('.topbar .search').exists()).toBe(false)
  })

  it('passes hide-drawer-trigger to PhotosSidebar', async () => {
    const { w } = await mountView(7)
    expect(w.findComponent(PhotosSidebar).props('hideDrawerTrigger')).toBe(true)
  })
})
