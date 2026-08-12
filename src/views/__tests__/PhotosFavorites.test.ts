// Task 8 (SP7-P3): PhotosFavorites.vue —— 挂 Pinia + i18n + router stub,mock 共享包
// 收藏方法(参照 favorites.test.ts 的 mock 形状 + Photos.lightbox.test.ts/
// Photos.integration.test.ts 的挂载套路)。覆盖 brief 的 5 条测试要点:空态门控、
// 非空渲染网格+导出按钮启用、点导出→exportZip+toast、grid emit open→灯箱翻页集按 tab
// 过滤、灯箱 delete→时间线 store.deleteAssets + fav.fetchFavorites 刷新。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    listFavorites: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    recordView: vi.fn().mockResolvedValue(undefined),
    exportFavoritesUrl: vi.fn(() => '/v1/photos/favorites/export?token=T1'),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    spriteMeta: vi.fn(),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    // Task 9: 选择工具栏/灯箱「加入相册」→ AlbumPickerDialog 真实挂载。
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 起播位续播用得到,同 Photos.lightbox.test.ts 的前置)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosFavorites from '../PhotosFavorites.vue'
import { usePhotosFavorites } from '../../photos/stores/favorites'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const lb = useLightbox()

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites }],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/favorites')
  await router.isReady()
  const w = mount(PhotosFavorites, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

function photo(id: string, opts: Partial<{ takenAt: string | null; mimeType: string; faces: string[]; placeName: string }> = {}) {
  return {
    id,
    takenAt: opts.takenAt === null ? null : (opts.takenAt || '2026-07-01T00:00:00Z'),
    mimeType: opts.mimeType || 'image/jpeg',
    originalName: `${id}.jpg`,
    faces: opts.faces,
    placeName: opts.placeName,
  }
}

// Task 11 (SP15-P3): a page of raw favorite() rows for pagination tests, shared by the
// "pagination" describe block below and the save-as-album pagination tests.
function pageAssets(n: number, from = 0) {
  return Array.from({ length: n }, (_, i) => photo(`f${from + i}`))
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  svc.photos.listFavorites.mockClear().mockResolvedValue([])
  svc.photos.exportFavoritesUrl.mockClear().mockReturnValue('/v1/photos/favorites/export?token=T1')
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  lb.__resetForTest()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosFavorites.vue', () => {
  it('favoritesLoaded 且列表空 → 渲染空态,不渲染 PhotosGrid', async () => {
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.favoritesLoaded).toBe(true)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('暂无收藏')
    expect(w.find('.content').exists()).toBe(false)
    expect(w.find('.fav-export').attributes('disabled')).toBeDefined()
  })

  // Task 9(P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见 favorites.ts
  // 注释),旧实现下 isEmpty 因此恒假 → 落进 v-else 渲染一个空网格,没有任何失败提示。
  // 新增 loadError 分支必须拦在最前面。
  it('加载失败时渲染失败态而非空网格(P3 遗留)', async () => {
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
    const w = await mountView()
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
    expect(w.text()).toContain('收藏加载失败')
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(false)
  })

  it('失败态的重试按钮重新调 fetchFavorites,成功后失败态消失', async () => {
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.loadError).toBe(true)
    const fetchSpy = vi.spyOn(fav, 'fetchFavorites')

    svc.photos.listFavorites.mockResolvedValueOnce([photo('a')])
    await w.find('[data-test="fav-retry"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalled()
    expect(fav.loadError).toBe(false)
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(true)
  })

  // 评审 Important 1 补的挡门用例(这一条才是真正钉住不变量的那条,不是 store 那条):
  // 重试本身也失败——失败态必须持续可见,不能出现"清空态再重新失败"的闪烁,更不能在
  // in-flight 期间落到网格分支(旧实现的 loadError 上来即清 false 会让这里在重试飞行期
  // 短暂重演 P3 的裸网格症状,见 favorites.ts 同批修正注释)。
  // 用受控 promise 卡住重试的 in-flight 窗口——如果 loadError 在进入重试时就被提前清空
  // (评审纠正前的错误设计),这个窗口里 favoritesLoaded 也还是假,isEmpty 因此为假,会
  // 落进 v-else 渲染裸网格,原样重演 P3 症状。断言必须卡在 flushPromises 之前才能看见
  // 这个窗口;等 promise resolve/reject 之后再断言只能看到"最终态",看不见过程,抓不住
  // 这个缺陷(已在变异验证里踩过一次这个坑,记录见 task-9-report.md 附加修复报告)。
  it('失败态重试仍失败(reject→retry→reject)→ in-flight 期间与结束后失败态都持续可见,不出现网格', async () => {
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('e1'))
    const w = await mountView()
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)

    let rejectRetry: (e: Error) => void = () => {}
    svc.photos.listFavorites.mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
    )
    await w.find('[data-test="fav-retry"]').trigger('click')
    await w.vm.$nextTick()

    // in-flight:重试还没落定,失败态必须继续可见,不能落到网格分支。
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)

    rejectRetry(new Error('e2'))
    await flushPromises()
    await w.vm.$nextTick()

    // 落定后(仍失败):失败态持续可见。
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
  })

  // 关键区分(brief 明确要求的挡门用例):成功但列表为空 —— 必须仍走空态,不能被
  // loadError 分支误吞。
  it('确认为零收藏(成功但列表空)仍走空态,不走失败态', async () => {
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.loadError).toBe(false)
    expect(fav.favoritesLoaded).toBe(true)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
  })

  it('列表非空 → 渲染 PhotosGrid(:months = favoritesMonths),导出按钮启用', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    const w = await mountView()
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(true)
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('.fav-export').attributes('disabled')).toBeUndefined()
  })

  it('点导出按钮 → fav.exportZip 被调 + toast', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()
    const fav = usePhotosFavorites()
    const toast = useToast()
    const exportSpy = vi.spyOn(fav, 'exportZip')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('.fav-export').trigger('click')
    await w.vm.$nextTick()

    expect(exportSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
  })

  it('PhotosGrid emit open → 灯箱打开,翻页集为 tab 过滤后收藏集(默认 tab=all,不过滤)', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b', { mimeType: 'video/mp4' }), photo('c')])
    const w = await mountView()

    const tiles = w.findAll('.tile')
    expect(tiles).toHaveLength(3) // 默认 tab='all',全展示(与时间线默认 'photo' 不同)
    await tiles[0].trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(3)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('PhoteLightbox emit delete(id) → store.deleteAssets(["id"]) + fav.fetchFavorites 刷新', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()
    const store = useTimelineStore()
    const fav = usePhotosFavorites()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(1)
    const fetchFavSpy = vi.spyOn(fav, 'fetchFavorites')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.find('.lb-confirm-ok').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
    expect(fetchFavSpy).toHaveBeenCalled()
    expect(lb.open.value).toBe(false) // PhotoLightbox 自己已在 doDelete 里 close
  })

  // 评审 Finding 1:PhotosGrid 接了 :selected/@toggle-select 但没有配套选择工具栏——勾选
  // 一个框会让整个网格的单击行为切进「继续勾选」分支且无退出入口。补 PhotosSelectionToolbar
  // (照 Photos.vue 批量删除前例)后,这里验证它确实出现、批量删除落到时间线 store + 收藏
  // 列表刷新、clear 能退出选择态。
  it('勾选一个瓦片 → PhotosSelectionToolbar 出现;@delete → 时间线 store.deleteAssets + fav.fetchFavorites + 清空选择', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    const w = await mountView()
    const store = useTimelineStore()
    const fav = usePhotosFavorites()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(1)
    const fetchFavSpy = vi.spyOn(fav, 'fetchFavorites')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    expect(w.find('.selection-toolbar').exists()).toBe(false)

    const checkbox = w.find('.tile-checkbox')
    expect(checkbox.exists()).toBe(true)
    await checkbox.trigger('click')
    await w.vm.$nextTick()

    const bar = w.find('.selection-toolbar')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('1')

    await bar.find('.sel-delete').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
    expect(fetchFavSpy).toHaveBeenCalled()
    expect(w.find('.selection-toolbar').exists()).toBe(false) // selected 清空 -> 工具栏消失
  })

  // Task 9: 选择工具栏「加入相册」→ picker(assetIds=已选中)→ 选相册后清空 selection(收藏
  // 列表本身不变)。
  it('选择工具栏「加入相册」→ picker 打开且 assetIds=已选中;选相册后清空 selection', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    svc.photos.listAlbums.mockResolvedValue([{ id: 5, name: 'Trip', assetCount: 0 }])
    const w = await mountView()

    const checkboxes = w.findAll('.tile-checkbox')
    await checkboxes[0].trigger('click')
    await checkboxes[1].trigger('click')
    await w.vm.$nextTick()

    const addBtn = w.find('.sel-add-album')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-picker-overlay"]').exists()).toBe(true)
    const item = w.find('[data-test="album-picker-item"]')
    await item.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(5, ['a', 'b'])
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  // Task 9: 灯箱「加入相册」→ picker(assetIds=[当前项 id])。
  it('灯箱「加入相册」→ picker 打开且 assetIds=[当前项 id]', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    svc.photos.listAlbums.mockResolvedValue([{ id: 6, name: 'Solo', assetCount: 0 }])
    const w = await mountView()

    await w.find('.tile').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-add-album').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('[data-test="album-picker-overlay"]').exists()).toBe(true)
    expect(lb.open.value).toBe(true) // 灯箱不因加入相册而关闭

    const item = w.find('[data-test="album-picker-item"]')
    await item.trigger('click')
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(6, ['a'])
  })

  it('选择态下点 @clear(sel-clear)→ 清空选择,工具栏消失', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()

    await w.find('.tile-checkbox').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.selection-toolbar').exists()).toBe(true)

    await w.find('.sel-clear').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  // 评审 Finding 2:PhotosToolbar 的 3 个密度按钮此前没绑 :density/@update:density,是
  // 死控件。补线后验证点击真的把 density 传给 PhotosGrid(通过 .grid[data-density] 观察)。
  it('切换密度按钮 → PhotosGrid 的 data-density 跟着变(此前是死控件)', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()

    expect(w.find('.grid').attributes('data-density')).toBe('comfortable')

    const compactBtn = w.findAll('.density button')[0]
    await compactBtn.trigger('click')
    await w.vm.$nextTick()

    expect(w.find('.grid').attributes('data-density')).toBe('compact')
  })

  // Task 10 (SP7-P4 相册,P3 推迟项收口):收藏视图「存为相册」——照 Vue2
  // PhotosFavoritesView.vue :21-23(入口)/:455-478(openSaveAlbum/confirmSaveAlbum)。
  describe('存为相册', () => {
    it('收藏为空 → 「存为相册」按钮 disabled 且点击不触发 openSaveAlbum(模态不出现)', async () => {
      const wEmpty = await mountView()
      expect(wEmpty.find('.fav-save-album').attributes('disabled')).toBeDefined()
      await wEmpty.find('.fav-save-album').trigger('click')
      await wEmpty.vm.$nextTick()
      expect(wEmpty.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)

      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const wFull = await mountView()
      expect(wFull.find('.fav-save-album').attributes('disabled')).toBeUndefined()
    })

    it('点击「存为相册」→ 模态出现,input 预填含当前年份的默认名,副标题/脚注文案渲染', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
      // Task 11 review fix: the subtitle now reads the exact total (favoritesTotal), which
      // comes from favIds once loaded — keep the id list in sync with the loaded page so
      // this fixture still reflects "2 favorites" rather than the default empty id list.
      svc.photos.listFavoriteIds.mockResolvedValue(['a', 'b'])
      const w = await mountView()

      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)
      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()

      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(true)
      const input = w.find('[data-test="fav-savealbum-input"]')
      expect((input.element as HTMLInputElement).value).toContain(String(new Date().getFullYear()))
      // 评审 Important 2:补 Vue2 :267-268 动态副标题(count 反映当前收藏数)与
      // :279-281 静态脚注 —— T3 键清单当初漏列,本轮授权补齐。
      expect(w.find('[data-test="fav-savealbum-sub"]').text()).toContain('2')
      expect(w.find('[data-test="fav-savealbum-note"]').text().length).toBeGreaterThan(0)
    })

    it('提交 → albums.saveAsAlbum(name, [收藏 ids]) 被调 + 成功 toast(精确文案)+ 模态关闭', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
      const w = await mountView()
      const albums = usePhotosAlbums()
      const toast = useToast()
      const saveSpy = vi.spyOn(albums, 'saveAsAlbum').mockResolvedValue({ id: 9, name: 'Trip' })
      const showSpy = vi.spyOn(toast, 'show')

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      const input = w.find('[data-test="fav-savealbum-input"]')
      await input.setValue('Trip')
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(saveSpy).toHaveBeenCalledWith('Trip', ['a', 'b'])
      expect(showSpy).toHaveBeenCalledWith('「Trip」已保存 · 2 张照片')
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)
    })

    // Review fix (Important 1, Task 11 follow-up): before this task favoritesList WAS the
    // whole set. Now it is at most one page, so submitting straight from it would silently
    // save a truncated album — the exact defect this task exists to remove, recreated in
    // this modal. Confirming must page in the rest first.
    it('submitting with more than one page of favorites pages in the rest first, then saves with the exact total', async () => {
      svc.photos.listFavorites.mockReset()
      svc.photos.listFavorites
        .mockResolvedValueOnce(pageAssets(500)) // initial fetchFavorites page
        .mockResolvedValueOnce(pageAssets(300, 500)) // loadMoreFavorites: short page, exhausts
      svc.photos.listFavoriteIds.mockResolvedValueOnce(
        Array.from({ length: 800 }, (_, i) => `f${i}`),
      )
      const w = await mountView()
      const fav = usePhotosFavorites()
      expect(fav.favoritesExhausted).toBe(false)

      const albums = usePhotosAlbums()
      const saveSpy = vi.spyOn(albums, 'saveAsAlbum').mockResolvedValue({ id: 1, name: 'Trip' })

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      // The modal shows the exact total (800), not the one loaded page (500).
      expect(w.find('[data-test="fav-savealbum-sub"]').text()).toContain('800')

      await w.find('[data-test="fav-savealbum-input"]').setValue('Trip')
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(svc.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
      expect(fav.favoritesExhausted).toBe(true)
      expect(saveSpy).toHaveBeenCalledTimes(1)
      expect(saveSpy.mock.calls[0][0]).toBe('Trip')
      expect(saveSpy.mock.calls[0][1]).toHaveLength(800) // all 500 + 300, not just the first page
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)
    })

    // Review fix (Important 1): a page that fails while paging in the rest must not result
    // in a knowingly-partial album — surface the same failure copy this view already uses
    // for saveAsAlbum errors, and leave the modal open so the user can retry.
    it('a pagination failure during submit does not create a partial album, shows the save-failed toast, and leaves the modal open', async () => {
      svc.photos.listFavorites.mockReset()
      svc.photos.listFavorites
        .mockResolvedValueOnce(pageAssets(500))
        .mockRejectedValueOnce(new Error('network'))
      const w = await mountView()
      const fav = usePhotosFavorites()
      expect(fav.favoritesExhausted).toBe(false)

      const albums = usePhotosAlbums()
      const saveSpy = vi.spyOn(albums, 'saveAsAlbum')
      const toast = useToast()
      const showSpy = vi.spyOn(toast, 'show')

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      await w.find('[data-test="fav-savealbum-input"]').setValue('Trip')
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(saveSpy).not.toHaveBeenCalled()
      expect(showSpy).toHaveBeenCalledWith(zh.photosFavSaveFailed)
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(true)
    })

    it('名称 trim 为空时主按钮 disabled 且点击不触发 saveAsAlbum', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()
      const albums = usePhotosAlbums()
      const saveSpy = vi.spyOn(albums, 'saveAsAlbum')

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      const input = w.find('[data-test="fav-savealbum-input"]')
      await input.setValue('   ')

      expect(w.find('[data-test="fav-savealbum-confirm"]').attributes('disabled')).toBeDefined()
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click')
      await flushPromises()
      expect(saveSpy).not.toHaveBeenCalled()
    })

    // 评审 Important 1:补重入守卫回归测试 —— 快速双击确认按钮,第一次 saveAsAlbum 的
    // await 尚未 resolve 时就发出第二次点击,必须只调用一次(照同期 T7 PhotosAlbums.vue
    // 的 `creating` 守卫补的同款回归用例写法)。用可控 Promise 制造「未 resolve」窗口。
    it('确认按钮连点两次(第一次 await 未完成时点第二次)→ saveAsAlbum 只被调用一次', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()
      const albums = usePhotosAlbums()
      let resolveSave: ((v: { id: number; name: string }) => void) | undefined
      const saveSpy = vi.spyOn(albums, 'saveAsAlbum').mockImplementation(
        () => new Promise((resolve) => { resolveSave = resolve }),
      )

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      await w.find('[data-test="fav-savealbum-input"]').setValue('Trip')

      const confirmBtn = w.find('[data-test="fav-savealbum-confirm"]')
      await confirmBtn.trigger('click') // 第一次点击:进入 await,尚未 resolve
      await w.vm.$nextTick()
      // 守卫生效期间,确认按钮应被禁用(与「名称为空」共用 disabled 绑定的同一条件)。
      expect(w.find('[data-test="fav-savealbum-confirm"]').attributes('disabled')).toBeDefined()
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click') // 第二次点击:应被短路
      await w.vm.$nextTick()

      expect(saveSpy).toHaveBeenCalledTimes(1)

      resolveSave?.({ id: 1, name: 'Trip' })
      await flushPromises()
    })

    it('saveAsAlbum 抛 409 → 重名 toast,模态仍在且输入内容保留', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()
      const albums = usePhotosAlbums()
      const toast = useToast()
      vi.spyOn(albums, 'saveAsAlbum').mockRejectedValue({ response: { status: 409 } })
      const showSpy = vi.spyOn(toast, 'show')

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      const input = w.find('[data-test="fav-savealbum-input"]')
      await input.setValue('Dup')
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(showSpy).toHaveBeenCalledWith('已存在同名相册')
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(true)
      expect((w.find('[data-test="fav-savealbum-input"]').element as HTMLInputElement).value).toBe('Dup')
    })

    it('saveAsAlbum 抛其它错误 → 通用失败 toast,模态仍在', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()
      const albums = usePhotosAlbums()
      const toast = useToast()
      vi.spyOn(albums, 'saveAsAlbum').mockRejectedValue(new Error('boom'))
      const showSpy = vi.spyOn(toast, 'show')

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      await w.find('[data-test="fav-savealbum-input"]').setValue('Whatever')
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(showSpy).toHaveBeenCalledWith('保存失败')
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(true)
    })

    it('Esc(document 级)→ 模态关闭', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()

      await w.find('.fav-save-album').trigger('click')
      await w.vm.$nextTick()
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await w.vm.$nextTick()

      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)
    })
  })

  // Task 15A(SP7-P5 两笔记账收口):hero 统计三卡 —— 照 Vue2 PhotosFavoritesView.vue
  // :56-84(模板)+ :369-385(byPersonAll/byPlaceAll/byYearAll)。三卡各自的排序键/切片
  // 数量不同,逐条核。
  describe('hero 统计三卡', () => {
    it('收藏为空 → 三卡不渲染(走空态,与 Vue2 :47-53/:54 的 v-if/v-else 分支一致)', async () => {
      const w = await mountView()
      expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
      expect(w.find('.fav-stats').exists()).toBe(false)
    })

    it('有收藏 → 三卡渲染,Top person 值 = 出现最多的人名,Top place 只取逗号前一段', async () => {
      svc.photos.listFavorites.mockResolvedValue([
        photo('a', { faces: ['Alice', 'Bob'], placeName: 'Paris, France' }),
        photo('b', { faces: ['Alice'], placeName: 'Paris, France' }),
        photo('c', { faces: ['Bob'], placeName: 'Tokyo' }),
      ])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards).toHaveLength(3)

      // Top person: Alice 出现 2 次 > Bob 1 次
      expect(cards[0].find('.value').text()).toBe('Alice')
      expect(cards[0].find('.meta').text()).toContain('2')

      // Top place: "Paris, France" 出现 2 次,主值只取逗号前一段
      expect(cards[1].find('.value').text()).toBe('Paris')
      expect(cards[1].find('.meta').text()).toContain('2')

      // By year: 全部 3 张同年(mock photo() 默认 takenAt 2026-07-01)
      expect(cards[2].find('.value').text()).toContain('3')
    })

    it('无 faces → Top person 值 —,meta 走 photosFavNoFaces 文案', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[0].find('.value').text()).toBe('—')
      expect(cards[0].find('.meta').text()).toBe(zh.photosFavNoFaces)
    })

    it('无地点 → Top place 值 —,meta 为空串', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[1].find('.value').text()).toBe('—')
      expect(cards[1].find('.meta').text()).toBe('')
    })

    it('无照片(By year)→ 主值 0,小字 in —', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a', { takenAt: null })])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[2].find('.value').text()).toContain('0')
      expect(cards[2].find('.value').text()).toContain('—')
    })

    it('Top person 条形 = min(4, 人数),首段 data-hi=true;Top place 条形 = min(3, 地点数)', async () => {
      svc.photos.listFavorites.mockResolvedValue([
        photo('a', { faces: ['A', 'B', 'C', 'D', 'E'] }),
        photo('b', { placeName: 'X' }), photo('c', { placeName: 'Y' }), photo('d', { placeName: 'Z' }), photo('e', { placeName: 'W' }),
      ])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      const personBars = cards[0].findAll('.fav-stat-bar span')
      const placeBars = cards[1].findAll('.fav-stat-bar span')
      expect(personBars).toHaveLength(4) // byPersonAll.slice(0,4),5 个人名裁到 4
      expect(personBars[0].attributes('data-hi')).toBe('true')
      expect(personBars[1].attributes('data-hi')).toBeUndefined()
      expect(placeBars).toHaveLength(3) // byPlaceAll.slice(0,3),4 个地点裁到 3
    })

    it('By year 条形 = 全部年份(不 slice)', async () => {
      svc.photos.listFavorites.mockResolvedValue([
        photo('a', { takenAt: '2020-01-01' }), photo('b', { takenAt: '2021-01-01' }),
        photo('c', { takenAt: '2022-01-01' }), photo('d', { takenAt: '2023-01-01' }),
        photo('e', { takenAt: '2024-01-01' }),
      ])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[2].findAll('.fav-stat-bar span')).toHaveLength(5) // 5 个年份,不裁
    })
  })

  // Task 11 (SP15-P3): NimoOS-Photos#54 turned an absent limit into 500, so this page has
  // to page and say out loud that its derived stats only cover what's loaded so far.
  describe('pagination (Task 11)', () => {
    const page = (n: number, from = 0) =>
      Array.from({ length: n }, (_, i) => photo(`f${from + i}`))

    it('shows the load-more button only while pages remain', async () => {
      // A short first page (< 500) means favoritesExhausted is true right away — no button.
      svc.photos.listFavorites.mockResolvedValueOnce(page(3))
      const wDone = await mountView()
      expect(wDone.find('[data-test="fav-load-more"]').exists()).toBe(false)

      // A full page (500) means more may remain — button shows.
      svc.photos.listFavorites.mockResolvedValueOnce(page(500))
      const wMore = await mountView()
      expect(wMore.find('[data-test="fav-load-more"]').exists()).toBe(true)

      // Clicking it calls loadMoreFavorites, which asks for the next page.
      svc.photos.listFavorites.mockResolvedValueOnce(page(2, 500))
      await wMore.find('[data-test="fav-load-more"]').trigger('click')
      await flushPromises()
      await wMore.vm.$nextTick()
      expect(svc.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
      // The next page was short (2 < 500): now exhausted, button disappears.
      expect(wMore.find('[data-test="fav-load-more"]').exists()).toBe(false)
    })

    it('shows the loaded-subset hint with the loaded count', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce(page(500))
      const w = await mountView()
      const fav = usePhotosFavorites()
      expect(fav.favoritesExhausted).toBe(false)

      const hint = w.find('[data-test="fav-loaded-hint"]')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('500')

      // Once exhausted, the hint disappears — the loaded set is the whole set.
      svc.photos.listFavorites.mockResolvedValueOnce(page(1, 500))
      await w.find('[data-test="fav-load-more"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()
      expect(w.find('[data-test="fav-loaded-hint"]').exists()).toBe(false)
    })

    it('shows the exact total in the All chip, not the loaded length', async () => {
      // First page is a full 500-row page — more remain, so favoritesList.length (500) would
      // under-report against the real total once favIds lands.
      svc.photos.listFavorites.mockResolvedValueOnce(page(500))
      svc.photos.listFavoriteIds.mockResolvedValueOnce(
        Array.from({ length: 1234 }, (_, i) => `f${i}`),
      )
      const w = await mountView()

      expect(w.find('.fav-count').text()).toContain('1234')
      expect(w.find('.fav-count').text()).not.toContain('500')
    })
  })
})
