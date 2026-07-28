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
import { useLightbox } from '../../photos/lightbox/useLightbox'
import AlbumLibraryPicker from '../../photos/components/AlbumLibraryPicker.vue'

const lb = useLightbox()
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

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

function findSortItem(w: ReturnType<typeof mount>, sortId: string) {
  return w.findAll('[data-test="album-sort-item"]').find((n) => n.attributes('data-sort-id') === sortId)!
}

beforeEach(() => {
  setActivePinia(createPinia())
  lb.__resetForTest()
  svc.photos.listAlbums.mockClear().mockResolvedValue([rawAlbum(7, { name: 'Trip', coverAssetId: 'cover-1' })])
  svc.photos.getAlbum.mockClear().mockResolvedValue({ assets: [] })
  svc.photos.updateAlbum.mockClear().mockResolvedValue({})
  svc.photos.deleteAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.reorderAlbumAssets.mockClear().mockResolvedValue(undefined)
  svc.photos.removeFromAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.thumbnailUrl.mockClear()
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
    // hero 背景走共享包生成器(带 token),不手拼 URL
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('cover-1', 'large')
    const hero = w.find('.album-hero-bg')
    expect(hero.attributes('style')).toContain('mock://thumb/cover-1/large')
  })

  it('albumsLoaded=false(还没加载完)→ 渲染加载骨架,不是"相册不存在"', async () => {
    svc.photos.listAlbums.mockImplementation(() => new Promise(() => {}))
    const { w } = await mountView('999')
    expect(w.find('[data-test="album-loading"]').exists()).toBe(true)
    expect(w.find('[data-test="album-not-found"]').exists()).toBe(false)
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

  it('点「添加照片」→ AlbumLibraryPicker open===true;其 @added → fetchAlbumAssets 被再调', async () => {
    const { w } = await mountView('7')
    const albums = usePhotosAlbums()
    const fetchSpy = vi.spyOn(albums, 'fetchAlbumAssets')

    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="album-add-photos"]').trigger('click')
    await w.vm.$nextTick()

    const picker = w.findComponent(AlbumLibraryPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props('open')).toBe(true)

    fetchSpy.mockClear()
    picker.vm.$emit('added', 2)
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalledWith('7')
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

    svc.photos.getAlbum.mockResolvedValueOnce({ assets: [asset('a'), asset('b')] })
    dragMock.refresh.mockClear()
    const picker = w.findComponent(AlbumLibraryPicker)
    picker.vm.$emit('added', 2)
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
    await w.find('.lb-confirm-ok').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith('7')
  })

  // Task 9: 灯箱「加入相册」→ 打开 AlbumPickerDialog(assetIds=[当前项 id])。只接灯箱这一处——
  // edit 工具条的「添加照片」(AlbumLibraryPicker)已有自己的语义,不重复放「加入相册」;
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
})
