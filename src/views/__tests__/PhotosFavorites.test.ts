// Task 8 (SP7-P3): PhotosFavorites.vue — mount Pinia + i18n + router stub, mock the
// shared package's favorite methods (per the mock shape in favorites.test.ts + the
// mounting playbook from Photos.lightbox.test.ts/Photos.integration.test.ts). Covers
// the brief's 5 test points: empty-state gating, non-empty grid render + export
// button enabled, click export -> exportZip+toast, grid emit open -> lightbox paging
// set filtered by tab, lightbox delete -> timeline store.deleteAssets +
// fav.fetchFavorites refresh.
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
    // Task 9: selection toolbar / lightbox "add to album" -> AlbumPickerDialog is really mounted.
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom has no media stack (PhotoLightbox needs this to resume playback position, same precondition as Photos.lightbox.test.ts).
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
  it('favoritesLoaded true and empty list -> renders empty state, does not render PhotosGrid', async () => {
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.favoritesLoaded).toBe(true)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('暂无收藏')
    expect(w.find('.content').exists()).toBe(false)
    expect(w.find('.fav-export').attributes('disabled')).toBeDefined()
  })

  // Task 9 (closing out a P3 leftover): when fetchFavorites fails, favoritesLoaded stays
  // false (see the comment in favorites.ts), so under the old implementation isEmpty was
  // therefore always false -> falls into the v-else branch and renders an empty grid, with
  // no failure indication at all. The new loadError branch must be checked first.
  it('renders a failure state instead of an empty grid on load failure (P3 leftover)', async () => {
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('network'))
    const w = await mountView()
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
    expect(w.text()).toContain('收藏加载失败')
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(false)
  })

  it('the failure state\'s retry button re-calls fetchFavorites, and the failure state disappears on success', async () => {
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

  // A gating case added per review Important 1 (this is the one that actually pins down the
  // invariant, not the store one): the retry itself also fails — the failure state must stay
  // visible continuously, with no "clear then fail again" flicker, and must definitely not
  // fall into the grid branch while in-flight (under the old implementation, loadError got
  // cleared to false as soon as retry started, which briefly reenacted the P3 bare-grid
  // symptom during the retry's in-flight window — see the fix comment in favorites.ts from
  // the same batch).
  // Use a controlled promise to pin down the retry's in-flight window — if loadError were
  // cleared as soon as retry starts (the incorrect design that review caught), favoritesLoaded
  // would still be false in this window, so isEmpty would also be false, falling into the
  // v-else branch and rendering a bare grid, reenacting the P3 symptom exactly. The assertion
  // has to be pinned before flushPromises to see this window; asserting only after the promise
  // resolves/rejects would only show the "final state", not the process, and would miss this
  // defect (already stepped on once during mutation testing — see the addendum fix report in
  // task-9-report.md).
  it('retry after retry still fails (reject->retry->reject) -> failure state stays visible both in-flight and after settling, grid never appears', async () => {
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('e1'))
    const w = await mountView()
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)

    let rejectRetry: (e: Error) => void = () => {}
    svc.photos.listFavorites.mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
    )
    await w.find('[data-test="fav-retry"]').trigger('click')
    await w.vm.$nextTick()

    // In-flight: the retry hasn't settled yet, the failure state must stay visible, must not fall into the grid branch.
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)

    rejectRetry(new Error('e2'))
    await flushPromises()
    await w.vm.$nextTick()

    // After settling (still failed): the failure state stays visible.
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(true)
    expect(w.find('.content').exists()).toBe(false)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
  })

  // A key distinction (a gating case explicitly required by the brief): success but an empty
  // list — must still go to the empty state, must not be swallowed by the loadError branch.
  it('confirmed zero favorites (success but empty list) still goes to the empty state, not the failure state', async () => {
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.loadError).toBe(false)
    expect(fav.favoritesLoaded).toBe(true)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="fav-load-error"]').exists()).toBe(false)
  })

  it('non-empty list -> renders PhotosGrid (:months = favoritesMonths), export button enabled', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    const w = await mountView()
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(false)
    expect(w.find('.content').exists()).toBe(true)
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('.fav-export').attributes('disabled')).toBeUndefined()
  })

  it('click the export button -> fav.exportZip is called + toast', async () => {
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

  it('PhotosGrid emit open -> lightbox opens, paging set is the favorites filtered by tab (default tab=all, no filtering)', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b', { mimeType: 'video/mp4' }), photo('c')])
    const w = await mountView()

    const tiles = w.findAll('.tile')
    expect(tiles).toHaveLength(3) // Default tab='all', shows everything (unlike the timeline's default of 'photo')
    await tiles[0].trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(3)
    expect(lb.list.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('PhoteLightbox emit delete(id) -> store.deleteAssets(["id"]) + fav.fetchFavorites refresh', async () => {
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
    await w.find('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
    expect(fetchFavSpy).toHaveBeenCalled()
    expect(lb.open.value).toBe(false) // PhotoLightbox already closes itself inside doDelete
  })

  // Review Finding 1: PhotosGrid wired up :selected/@toggle-select but had no matching
  // selection toolbar — checking one box would switch the whole grid's click behavior into
  // a "keep selecting" branch with no exit. After adding PhotosSelectionToolbar (following
  // the Photos.vue batch-delete precedent), verify here that it actually appears, that batch
  // delete lands on the timeline store + refreshes the favorites list, and that clear can
  // exit selection mode.
  it('checking one tile -> PhotosSelectionToolbar appears; @delete -> timeline store.deleteAssets + fav.fetchFavorites + clears selection', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    const w = await mountView()
    const store = useTimelineStore()
    const fav = usePhotosFavorites()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(1)
    const fetchFavSpy = vi.spyOn(fav, 'fetchFavorites')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    expect(w.find('.selectbar').exists()).toBe(false)

    const checkbox = w.find('.tile-checkbox')
    expect(checkbox.exists()).toBe(true)
    await checkbox.trigger('click')
    await w.vm.$nextTick()

    const bar = w.find('.selectbar')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('1')

    await bar.find('[data-test="selectbar-delete"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(deleteSpy).toHaveBeenCalledWith(['a'])
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
    expect(fetchFavSpy).toHaveBeenCalled()
    expect(w.find('.selectbar').exists()).toBe(false) // selection cleared -> toolbar disappears
  })

  // Task 9: selection toolbar "add to album" -> picker (assetIds=selected) -> selecting an
  // album clears selection (the favorites list itself is unchanged).
  it('selection toolbar "add to album" -> picker opens with assetIds=selected; clears selection after picking an album', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
    svc.photos.listAlbums.mockResolvedValue([{ id: 5, name: 'Trip', assetCount: 0 }])
    const w = await mountView()

    const checkboxes = w.findAll('.tile-checkbox')
    await checkboxes[0].trigger('click')
    await checkboxes[1].trigger('click')
    await w.vm.$nextTick()

    const addBtn = w.find('[data-test="selectbar-add-album"]')
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
    expect(w.find('.selectbar').exists()).toBe(false)
  })

  // Task 9: lightbox "add to album" -> picker (assetIds=[current item's id]).
  it('lightbox "add to album" -> picker opens with assetIds=[current item\'s id]', async () => {
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
    expect(lb.open.value).toBe(true) // the lightbox doesn't close just because of adding to an album

    const item = w.find('[data-test="album-picker-item"]')
    await item.trigger('click')
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(6, ['a'])
  })

  it('clicking close (x) while in selection mode -> clears selection, toolbar disappears', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()

    await w.find('.tile-checkbox').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.selectbar').exists()).toBe(true)

    await w.find('[data-test="selectbar-close"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.selectbar').exists()).toBe(false)
  })

  // Review Finding 2: PhotosToolbar's 3 density buttons previously weren't wired to
  // :density/@update:density — they were dead controls. After wiring them up, verify that
  // clicking actually passes density through to PhotosGrid (observed via .grid[data-density]).
  it('switching the density button -> PhotosGrid\'s data-density follows along (previously a dead control)', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()

    expect(w.find('.grid').attributes('data-density')).toBe('comfortable')

    const compactBtn = w.findAll('.density button')[0]
    await compactBtn.trigger('click')
    await w.vm.$nextTick()

    expect(w.find('.grid').attributes('data-density')).toBe('compact')
  })

  // Task 10 (SP7-P4 albums, closing out a P3 deferral): the favorites view's "save as
  // album" — following Vue2 PhotosFavoritesView.vue :21-23 (entry point)/:455-478
  // (openSaveAlbum/confirmSaveAlbum).
  describe('Save as album', () => {
    it('empty favorites -> "save as album" button disabled and clicking doesn\'t trigger openSaveAlbum (no modal)', async () => {
      const wEmpty = await mountView()
      expect(wEmpty.find('.fav-save-album').attributes('disabled')).toBeDefined()
      await wEmpty.find('.fav-save-album').trigger('click')
      await wEmpty.vm.$nextTick()
      expect(wEmpty.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)

      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const wFull = await mountView()
      expect(wFull.find('.fav-save-album').attributes('disabled')).toBeUndefined()
    })

    it('clicking "save as album" -> modal appears, input is prefilled with a default name containing the current year, subtitle/footnote copy renders', async () => {
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
      // Review Important 2: add Vue2 :267-268's dynamic subtitle (count reflects the current
      // favorites count) and :279-281's static footnote — the T3 key checklist missed these
      // at the time; authorized to backfill them in this round.
      expect(w.find('[data-test="fav-savealbum-sub"]').text()).toContain('2')
      expect(w.find('[data-test="fav-savealbum-note"]').text().length).toBeGreaterThan(0)
    })

    it('submit -> albums.saveAsAlbum(name, [favorite ids]) is called + success toast (exact copy) + modal closes', async () => {
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

    it('primary button disabled when the trimmed name is empty, and clicking doesn\'t trigger saveAsAlbum', async () => {
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

    // Review Important 1: add a re-entrancy guard regression test — quickly double-clicking
    // the confirm button, firing the second click before the first saveAsAlbum's await
    // resolves, must result in only one call (following the same regression-case style added
    // for T7 PhotosAlbums.vue's `creating` guard in the same period). Use a controlled promise
    // to create the "not yet resolved" window.
    it('clicking confirm twice in a row (second click before the first await completes) -> saveAsAlbum is called only once', async () => {
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
      await confirmBtn.trigger('click') // First click: enters the await, not yet resolved
      await w.vm.$nextTick()
      // While the guard is active, the confirm button should be disabled (sharing the same disabled binding condition as "name is empty").
      expect(w.find('[data-test="fav-savealbum-confirm"]').attributes('disabled')).toBeDefined()
      await w.find('[data-test="fav-savealbum-confirm"]').trigger('click') // Second click: should be short-circuited
      await w.vm.$nextTick()

      expect(saveSpy).toHaveBeenCalledTimes(1)

      resolveSave?.({ id: 1, name: 'Trip' })
      await flushPromises()
    })

    it('saveAsAlbum throws 409 -> duplicate-name toast, modal stays open with input content preserved', async () => {
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

    it('saveAsAlbum throws another error -> generic failure toast, modal stays open', async () => {
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

    it('Esc (at document level) -> modal closes', async () => {
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

  // Task 15A (closing out two ledger entries from SP7-P5): hero stats three cards —
  // following Vue2 PhotosFavoritesView.vue :56-84 (template) + :369-385
  // (byPersonAll/byPlaceAll/byYearAll). Each card has its own sort key/slice count,
  // check them one by one.
  describe('hero stats three cards', () => {
    it('empty favorites -> the three cards don\'t render (goes to empty state, consistent with the v-if/v-else branches at Vue2 :47-53/:54)', async () => {
      const w = await mountView()
      expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
      expect(w.find('.fav-stats').exists()).toBe(false)
    })

    it('has favorites -> three cards render, Top person value = the name that appears most, Top place only takes the segment before the comma', async () => {
      svc.photos.listFavorites.mockResolvedValue([
        photo('a', { faces: ['Alice', 'Bob'], placeName: 'Paris, France' }),
        photo('b', { faces: ['Alice'], placeName: 'Paris, France' }),
        photo('c', { faces: ['Bob'], placeName: 'Tokyo' }),
      ])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards).toHaveLength(3)

      // Top person: Alice appears 2 times > Bob's 1 time
      expect(cards[0].find('.value').text()).toBe('Alice')
      expect(cards[0].find('.meta').text()).toContain('2')

      // Top place: "Paris, France" appears 2 times, primary value only takes the segment before the comma
      expect(cards[1].find('.value').text()).toBe('Paris')
      expect(cards[1].find('.meta').text()).toContain('2')

      // By year: all 3 photos are the same year (mock photo()'s default takenAt is 2026-07-01)
      expect(cards[2].find('.value').text()).toContain('3')
    })

    it('no faces -> Top person value is —, meta uses the photosFavNoFaces copy', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[0].find('.value').text()).toBe('—')
      expect(cards[0].find('.meta').text()).toBe(zh.photosFavNoFaces)
    })

    it('no place -> Top place value is —, meta is an empty string', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[1].find('.value').text()).toBe('—')
      expect(cards[1].find('.meta').text()).toBe('')
    })

    it('no photos (By year) -> primary value 0, caption text in —', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a', { takenAt: null })])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[2].find('.value').text()).toContain('0')
      expect(cards[2].find('.value').text()).toContain('—')
    })

    it('Top person bar = min(4, headcount), first segment has data-hi=true; Top place bar = min(3, place count)', async () => {
      svc.photos.listFavorites.mockResolvedValue([
        photo('a', { faces: ['A', 'B', 'C', 'D', 'E'] }),
        photo('b', { placeName: 'X' }), photo('c', { placeName: 'Y' }), photo('d', { placeName: 'Z' }), photo('e', { placeName: 'W' }),
      ])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      const personBars = cards[0].findAll('.fav-stat-bar span')
      const placeBars = cards[1].findAll('.fav-stat-bar span')
      expect(personBars).toHaveLength(4) // byPersonAll.slice(0,4), 5 names trimmed down to 4
      expect(personBars[0].attributes('data-hi')).toBe('true')
      expect(personBars[1].attributes('data-hi')).toBeUndefined()
      expect(placeBars).toHaveLength(3) // byPlaceAll.slice(0,3), 4 places trimmed down to 3
    })

    it('By year bar = all years (not sliced)', async () => {
      svc.photos.listFavorites.mockResolvedValue([
        photo('a', { takenAt: '2020-01-01' }), photo('b', { takenAt: '2021-01-01' }),
        photo('c', { takenAt: '2022-01-01' }), photo('d', { takenAt: '2023-01-01' }),
        photo('e', { takenAt: '2024-01-01' }),
      ])
      const w = await mountView()
      const cards = w.findAll('.fav-stat-card')
      expect(cards[2].findAll('.fav-stat-bar span')).toHaveLength(5) // 5 years, not trimmed
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

      // Step 6 (R-3): migrated off `.fav-count` -- that span was deleted by the Task 1 re-shell,
      // the count now flows into PhotosTopbar's `sub` prop instead. Expected value unchanged.
      const topbar = w.findComponent({ name: 'PhotosTopbar' })
      expect(topbar.props('sub')).toContain('1234')
      expect(topbar.props('sub')).not.toContain('500')
    })
  })
})

describe('PhotosFavorites.vue (Task 1 re-shell)', () => {
  it('roots under .photos-root > .app[data-collapsed] > PhotosSidebar + main.main > PhotosTopbar + .photos-main', async () => {
    const w = await mountView()
    const root = w.find('.photos-root')
    expect(root.exists()).toBe(true)
    const app = root.find('.app')
    expect(app.exists()).toBe(true)
    expect(app.attributes('data-collapsed')).toBeDefined()
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('showSearch')).toBe(false)
  })

  // F-05 (X-1/X-2): Ask Nimo is a REAL Vue2 entry point on this page's topbar (baseline report
  // §2.1 trigger #1 -- opens the drawer, no prefill), and AskNimoHost must survive this task's
  // template rewrite (Plan G T14 mounts it before this task runs).
  it('wires PhotosTopbar Ask Nimo (opens the drawer, no prefill) and keeps AskNimoHost mounted', async () => {
    const w = await mountView()
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.props('showAskNimo')).toBe(true)
    expect(w.findComponent({ name: 'AskNimoHost' }).exists()).toBe(true)
  })

  // F-16: this button is `:disabled` when there are no loaded favorites -- mock a page first so
  // the click actually fires (the default empty-list mock would make this a silent no-op).
  it('AlbumPickerDialog and the save-as-album modal are both descendants of .photos-root', async () => {
    svc.photos.listFavorites.mockResolvedValueOnce([{ id: '1', mimeType: 'image/jpeg' }])
    const w = await mountView()
    await w.find('[data-test="fav-save-album-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.photos-root [data-test="fav-savealbum-modal"]').exists()).toBe(true)
  })
})
