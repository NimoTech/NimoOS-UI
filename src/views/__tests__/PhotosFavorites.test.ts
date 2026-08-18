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
    topFavorites: vi.fn().mockResolvedValue([]),
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
import { useAskNimo } from '../../photos/composables/useAskNimo'
import { useAgentStore } from '../../ai/stores/agentStore'

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
  svc.photos.topFavorites.mockClear().mockResolvedValue([])
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  lb.__resetForTest()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
  // useAskNimo() is a module-level singleton (not tied to the per-test Pinia instance) -- reset
  // it the same way PhotosSearch.test.ts does, so a drawerOpen=true from one test doesn't leak
  // into the next.
  useAskNimo().__resetForTests()
})

describe('PhotosFavorites.vue', () => {
  it('favoritesLoaded true and empty list -> renders empty state, does not render PhotosGrid', async () => {
    const w = await mountView()
    const fav = usePhotosFavorites()
    expect(fav.favoritesLoaded).toBe(true)
    expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('暂无收藏')
    expect(w.find('.content').exists()).toBe(false)
    // Task 3 (Plan H, F-10): was "export button disabled" -- same structural fact as the
    // dedicated save-as-album exception below: the button now lives inside .lib-hero-actions,
    // which only renders on the v-else (loaded, non-empty) branch, so on the empty branch it
    // doesn't render at all rather than rendering disabled.
    expect(w.find('[data-test="fav-export-btn"]').exists()).toBe(false)
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
    expect(w.find('[data-test="fav-export-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('click the export button -> fav.exportZip is called + toast', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()
    const fav = usePhotosFavorites()
    const toast = useToast()
    const exportSpy = vi.spyOn(fav, 'exportZip')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="fav-export-btn"]').trigger('click')
    await w.vm.$nextTick()

    expect(exportSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(expect.any(String), 4000)
  })

  // Acceptance Fix-1: renamed off "filtered by tab" -- there is no more media-type tab filter
  // on this view (Vue2 Favorites never had one). Default filter='all' still shows every media
  // type (photos + OCR + videos), unlike the timeline view's own default of 'photo'.
  it('PhotosGrid emit open -> lightbox opens, paging set is every favorite (default filter=all, no narrowing)', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b', { mimeType: 'video/mp4' }), photo('c')])
    const w = await mountView()

    const tiles = w.findAll('.tile')
    expect(tiles).toHaveLength(3) // Default filter='all', shows everything (unlike the timeline's default of 'photo')
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

  // Acceptance Fix-1 (owner finding, Plans G+H): the PhotosToolbar-driven density switcher
  // (previously the "Review Finding 2" test right here) has been removed along with the whole
  // media-type tab row -- Vue2 PhotosFavoritesView.vue has neither a density switcher nor tab
  // chips at all (its own bespoke `.lib-grid` markup has no density concept). density stays
  // fixed at 'comfortable' internally (PhotosGrid still needs some density value to size its
  // column-count lookup), just with no UI control left to drive it.
  it('renders the grid at a fixed comfortable density with no density switcher UI', async () => {
    svc.photos.listFavorites.mockResolvedValue([photo('a')])
    const w = await mountView()

    expect(w.find('.grid').attributes('data-density')).toBe('comfortable')
    expect(w.find('.density').exists()).toBe(false)
  })

  // Task 10 (SP7-P4 albums, closing out a P3 deferral): the favorites view's "save as
  // album" — following Vue2 PhotosFavoritesView.vue :21-23 (entry point)/:455-478
  // (openSaveAlbum/confirmSaveAlbum).
  describe('Save as album', () => {
    // Task 3 (Plan H, F-10): was "save-album button disabled on empty favorites" -- that
    // assertion no longer holds structurally, since .lib-hero-actions (and both its buttons)
    // now lives entirely inside the v-else branch; the empty-favorites case takes the isEmpty
    // branch instead, where the actions never render at all.
    it('does not render the hero actions (Export/Save-as-Album) on the empty-favorites branch', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([])
      const w = await mountView()
      expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
      expect(w.find('.lib-hero-actions').exists()).toBe(false)
    })

    it('non-empty favorites -> "save as album" button enabled', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a')])
      const wFull = await mountView()
      expect(wFull.find('[data-test="fav-save-album-btn"]').attributes('disabled')).toBeUndefined()
    })

    it('clicking "save as album" -> modal appears, input is prefilled with a default name containing the current year, subtitle/footnote copy renders', async () => {
      svc.photos.listFavorites.mockResolvedValue([photo('a'), photo('b')])
      // Task 11 review fix: the subtitle now reads the exact total (favoritesTotal), which
      // comes from favIds once loaded — keep the id list in sync with the loaded page so
      // this fixture still reflects "2 favorites" rather than the default empty id list.
      svc.photos.listFavoriteIds.mockResolvedValue(['a', 'b'])
      const w = await mountView()

      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)
      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
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

      await w.find('[data-test="fav-save-album-btn"]').trigger('click')
      await w.vm.$nextTick()
      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await w.vm.$nextTick()

      expect(w.find('[data-test="fav-savealbum-modal"]').exists()).toBe(false)
    })
  })

  // Task 3 (Plan H): the hero stats header (F-17: assert via data-test anchors, not literal
  // copy, since mountView() fixes locale=zh_cn -- asserting the actual rendered zh_cn text
  // would be an accidental double-check of i18n content, not of this task's structure).
  describe('hero header (Task 3)', () => {
    it('renders the hero header (inside the loaded/non-empty branch) with photo/video counts, year span, and the kept-forever badge', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        { id: '1', mimeType: 'image/jpeg', takenAt: '2024-06-01T00:00:00Z' },
        { id: '2', mimeType: 'video/mp4', takenAt: '2026-01-01T00:00:00Z' },
      ])
      const w = await mountView()
      const hero = w.find('[data-test="fav-hero"]')
      expect(hero.exists()).toBe(true)
      expect(hero.find('[data-test="fav-hero-badge"]').exists()).toBe(true)
      // Review fix: real assertions, not just existence -- 1 photo (jpeg) + 1 video (mp4),
      // year span from byYear (string year-prefix, immune to the Date().getFullYear() /
      // local-timezone divergence risk against the By-year stat card fixed in this round).
      expect(hero.text()).toContain('2024–2026')
      const bolds = hero.findAll('b')
      expect(bolds[0].text()).toBe('1') // heroPhotoCount
      expect(bolds[1].text()).toBe('1') // heroVideoCount
      expect(bolds[2].text()).toBe('2024–2026') // heroYearSpan
    })

    it('does not render the hero on the empty-favorites branch', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([])
      const w = await mountView()
      expect(w.find('[data-test="fav-empty"]').exists()).toBe(true)
      expect(w.find('[data-test="fav-hero"]').exists()).toBe(false)
    })
  })

  // Task 4 (Plan H): pinned-highlights strip -- server-ranked top 5 (GET /favorites/top),
  // rendered inside the same v-else (loaded, non-empty) branch as the hero (F-10).
  describe('pinned-highlights strip (Task 4)', () => {
    it('renders the pinned-highlights strip from the server-ranked top favorites, opening the lightbox on click', async () => {
      // R-4: also mock listFavorites (not just topFavorites) so favoritesLoaded && length>0 --
      // otherwise isEmpty is true and the v-else branch containing the pinned strip never renders.
      svc.photos.listFavorites.mockResolvedValueOnce([{ id: 'x', mimeType: 'image/jpeg' }])
      svc.photos.topFavorites.mockResolvedValueOnce([{ id: 'p1', mimeType: 'image/jpeg', takenAt: '2026-01-01T00:00:00Z' }])
      const w = await mountView()
      const strip = w.find('[data-test="fav-pinned-strip"]')
      expect(strip.exists()).toBe(true)
      await w.find('[data-test="fav-pinned-card"]').trigger('click')
      expect(lb.open.value).toBe(true)
    })

    it('does not render the strip while topFavorites is loading/empty', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([{ id: 'x', mimeType: 'image/jpeg' }])
      const w = await mountView()
      expect(w.find('[data-test="fav-pinned-strip"]').exists()).toBe(false)
    })
  })

  // Task 5 (Plan H): the real slideshow -- chained setTimeout timer, Esc/arrow/space keyboard
  // control, follows Vue2 PhotosFavoritesView.vue:469-501 verbatim.
  describe('slideshow (Task 5)', () => {
    it('slideshow: opens on click, auto-advances via a re-armed timer at EACH step (not a one-shot/impostor), changing speed rearms at the new interval, Space toggles pause, Esc closes', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        { id: 'a', mimeType: 'image/jpeg' }, { id: 'b', mimeType: 'image/jpeg' }, { id: 'c', mimeType: 'image/jpeg' },
      ])
      const w = await mountView()
      // F-8: mountView() first (its own flushPromises relies on real setTimeout), only then
      // switch to fake timers -- otherwise flushPromises awaiting a real setTimeout would hang
      // under fake timers.
      vi.useFakeTimers()
      try {
        await w.find('[data-test="fav-slideshow-btn"]').trigger('click')
        expect(w.find('.fav-slideshow').exists()).toBe(true)
        expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 3')

        // Review fix (Minor 5): a 3-photo list + two CONSECUTIVE 4000ms steps, each asserted --
        // a one-shot timer (fires once, never re-arms) or a setInterval impostor that quietly
        // stopped re-arming would pass a single-step assertion but fail the second one.
        await vi.advanceTimersByTimeAsync(4000)
        expect(w.find('[data-test="fav-slide-count"]').text()).toBe('2 / 3')
        await vi.advanceTimersByTimeAsync(4000)
        expect(w.find('[data-test="fav-slide-count"]').text()).toBe('3 / 3')

        // Review fix (Minor 5): setSlideSpeed while playing must re-arm the pending timer at the
        // NEW interval, not just update the ref for the next natural re-arm -- advancing by
        // exactly the new (shorter) 2000ms interval proves the rearm actually happened.
        const fastBtn = w.findAll('.fav-slide-speed').find((b) => b.text() === zh.photosFavSlideFast)
        await fastBtn?.trigger('click')
        await vi.advanceTimersByTimeAsync(2000)
        expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 3') // wraps 3 -> 1

        // Task 5 (Plan H): dispatches on `document`, not `window` -- the implementation follows
        // Vue2 PhotosFavoritesView.vue:473/477's `document.addEventListener('keydown', ...)`
        // (matching this repo's own AlbumPickerDialog.vue precedent), and a `window`-targeted
        // keydown does not bubble down to a `document` listener (window has no parent in the
        // event-propagation path; the reverse -- document bubbling up to window -- is what
        // normally happens for real key presses).
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        await vi.advanceTimersByTimeAsync(4000) // paused: must not advance
        expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 3')

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await w.vm.$nextTick()
        expect(w.find('.fav-slideshow').exists()).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    // Review fix (Important 3, pre-existing): restores Vue2 :439's playlist fallback --
    // `slidePhotos() { return this.sorted.length ? this.sorted : this.favorites }`.
    // Acceptance Fix-1 note: this used to be exercised via the media-type tab filter (switch
    // to "Videos" while every favorite is a photo -> tab-filtered set empties out, slideshow
    // must still fall back to the full set). That tab filter no longer exists on this view
    // (Vue2 Favorites never had one -- see the filter-row rewrite above). Under the new
    // person/place/year filter model this fallback branch is structurally unreachable through
    // the UI: every dropdown's own option list (byPersonAll/byPlaceAll/byYear) is derived from
    // the very same favorites list `filtered` narrows, so any value a user can actually select
    // is guaranteed to match at least one photo -- there is no way to pick a filter that empties
    // the set out from under a non-empty favorites list. The fallback code itself is kept
    // verbatim (it's Vue2's own defensive branch, harmless to keep even if unreachable here),
    // just with no reachable regression test left to pin it down at this layer.

    it('not rendered on the empty-favorites branch (F-10, same gating as the save-album/export buttons); ArrowRight/ArrowLeft navigate, speed presets update the interval', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([])
      const wEmpty = await mountView()
      expect(wEmpty.find('[data-test="fav-empty"]').exists()).toBe(true)
      expect(wEmpty.find('[data-test="fav-slideshow-btn"]').exists()).toBe(false)

      svc.photos.listFavorites.mockResolvedValueOnce([
        { id: 'a', mimeType: 'image/jpeg' }, { id: 'b', mimeType: 'image/jpeg' }, { id: 'c', mimeType: 'image/jpeg' },
      ])
      const w = await mountView()
      await w.find('[data-test="fav-slideshow-btn"]').trigger('click')
      expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 3')

      await w.find('.fav-slide-nav-r').trigger('click')
      expect(w.find('[data-test="fav-slide-count"]').text()).toBe('2 / 3')
      await w.find('.fav-slide-nav-l').trigger('click')
      expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 3')

      const fastBtn = w.findAll('.fav-slide-speed').find((b) => b.text() === zh.photosFavSlideFast)
      expect(fastBtn?.attributes('data-active')).toBe('false')
      await fastBtn?.trigger('click')
      expect(fastBtn?.attributes('data-active')).toBe('true')

      await w.find('.fav-slide-close').trigger('click')
      expect(w.find('.fav-slideshow').exists()).toBe(false)
    })
  })

  // Task 6 (Plan H): place-filter dropdown -- follows Vue2 PhotosFavoritesView.vue's
  // byPlaceAll (:412-416, group the loaded page by exact `place` string, sorted count
  // desc) + filtered (:353-360, exact string match against `l:<place>`). F-18: the
  // filtered set is re-grouped by month before being flattened, so narrowing the place
  // doesn't reorder the grid/lightbox/slideshow -- it only narrows it.
  describe('place filter dropdown (Task 6)', () => {
    it('place filter dropdown narrows the grid, the count chip, and the slideshow to the selected place (order preserved, F-18)', async () => {
      // NOTE: the raw wire field assetToPhoto reads for Photo.place is `placeName`
      // (assetToPhoto.ts:373), not `place` -- using `placeName` here so the two rows
      // actually reach byPlaceAll/filtered with a non-null `place`.
      svc.photos.listFavorites.mockResolvedValueOnce([
        { id: '1', mimeType: 'image/jpeg', placeName: 'Kyoto, Japan', takenAt: '2026-02-01T00:00:00Z' },
        { id: '2', mimeType: 'image/jpeg', placeName: 'Osaka, Japan', takenAt: '2026-01-01T00:00:00Z' },
      ])
      const w = await mountView()
      // Review fix: Vue2 :126/:152 trails the count badge with a small down-chevron -- the
      // filter button carries both the place-count badge (2 distinct places) and a trailing
      // chevD chevron (PhotosIcon's existing branch, `d="m6 9 6 6 6-6"`, reused instead of a
      // one-off inline svg since it's the same chevron-down shape at 2x scale).
      const btn = w.find('[data-test="fav-filter-places-btn"]')
      expect(btn.find('.ct').text()).toBe('2')
      const svgs = btn.findAll('svg')
      expect(svgs[svgs.length - 1].find('path').attributes('d')).toBe('m6 9 6 6 6-6')

      await w.find('[data-test="fav-filter-places-btn"]').trigger('click')
      expect(w.find('.fav-filter-menu').exists()).toBe(true)
      await w.findAll('.fav-filter-item').find((b) => b.text().includes('Kyoto'))!.trigger('click')
      expect(w.find('[data-test="fav-filter-places-btn"]').text()).toContain('Kyoto')

      // Grid narrows to just the Kyoto photo (Acceptance Fix-1: PhotosToolbar's own
      // `.muted-text` count chip is gone along with the rest of the toolbar -- the grid tile
      // count and the per-month `.month-count` head both read off the same filteredMonths,
      // asserted here via the tile count; lightbox paging set + slideshow both follow too).
      expect(w.findAll('.tile')).toHaveLength(1)
      await w.find('[data-test="fav-slideshow-btn"]').trigger('click')
      expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 1')
      await w.find('.fav-slide-close').trigger('click')

      // Clear filter restores both photos.
      await w.find('[data-test="fav-filter-places-btn"]').trigger('click')
      await w.find('.fav-filter-item.is-clear').trigger('click')
      expect(w.find('[data-test="fav-filter-places-btn"]').text()).not.toContain('Kyoto')
      await w.find('[data-test="fav-slideshow-btn"]').trigger('click')
      expect(w.find('[data-test="fav-slide-count"]').text()).toBe('1 / 2')
    })

    it('a global mousedown outside the filter bar closes the open dropdown', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        { id: '1', mimeType: 'image/jpeg', placeName: 'Kyoto, Japan', takenAt: '2026-02-01T00:00:00Z' },
      ])
      const w = await mountView()
      await w.find('[data-test="fav-filter-places-btn"]').trigger('click')
      expect(w.find('.fav-filter-menu').exists()).toBe(true)
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      await w.vm.$nextTick()
      expect(w.find('.fav-filter-menu').exists()).toBe(false)
    })

    it('disabled (no places among the loaded favorites) when every asset has a null place, and the count badge is not rendered (Vue2 :126/:152 guard)', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([{ id: '1', mimeType: 'image/jpeg' }])
      const w = await mountView()
      const btn = w.find('[data-test="fav-filter-places-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()
      expect(btn.find('.ct').exists()).toBe(false)
    })
  })

  // Acceptance Fix-1 (owner finding, Plans G+H): People dropdown -- follows Vue2
  // PhotosFavoritesView.vue's byPersonAll (:407-410, group by `p.faces` entries, count desc) +
  // filtered (:353-360, exact match against `p:<name>` -- `(p.faces || []).includes(n)`).
  describe('people filter dropdown (Acceptance Fix-1)', () => {
    it('people filter dropdown narrows the grid and slideshow to the selected person', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('1', { faces: ['Alice', 'Bob'] }),
        photo('2', { faces: ['Bob'] }),
      ])
      const w = await mountView()
      const btn = w.find('[data-test="fav-filter-people-btn"]')
      expect(btn.find('.ct').text()).toBe('2') // 2 distinct people (Alice, Bob)

      await btn.trigger('click')
      expect(w.find('.fav-filter-menu').exists()).toBe(true)
      await w.findAll('.fav-filter-item').find((b) => b.text().includes('Alice'))!.trigger('click')
      expect(w.find('[data-test="fav-filter-people-btn"]').text()).toContain('Alice')
      expect(w.findAll('.tile')).toHaveLength(1)

      await w.find('[data-test="fav-filter-people-btn"]').trigger('click')
      await w.find('.fav-filter-item.is-clear').trigger('click')
      expect(w.find('[data-test="fav-filter-people-btn"]').text()).not.toContain('Alice')
      expect(w.findAll('.tile')).toHaveLength(2)
    })

    it('disabled (no faces among the loaded favorites), count badge not rendered', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([photo('1')])
      const w = await mountView()
      const btn = w.find('[data-test="fav-filter-people-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()
      expect(btn.find('.ct').exists()).toBe(false)
    })
  })

  // Acceptance Fix-1: Years dropdown -- follows Vue2 byYearAll (:417-424, group by
  // `takenAt.slice(0,4)`, sorted year string desc) + filtered's `y:<year>` branch (`takenAt`
  // string-prefix match).
  describe('years filter dropdown (Acceptance Fix-1)', () => {
    it('years filter dropdown narrows the grid and slideshow to the selected year', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('1', { takenAt: '2024-06-01T00:00:00Z' }),
        photo('2', { takenAt: '2026-01-01T00:00:00Z' }),
      ])
      const w = await mountView()
      const btn = w.find('[data-test="fav-filter-years-btn"]')
      expect(btn.find('.ct').text()).toBe('2') // 2 distinct years

      await btn.trigger('click')
      expect(w.find('.fav-filter-menu').exists()).toBe(true)
      await w.findAll('.fav-filter-item').find((b) => b.text().includes('2024'))!.trigger('click')
      expect(w.find('[data-test="fav-filter-years-btn"]').text()).toContain('2024')
      expect(w.findAll('.tile')).toHaveLength(1)
    })

    it('disabled (no takenAt among the loaded favorites), count badge not rendered', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([photo('1', { takenAt: null })])
      const w = await mountView()
      const btn = w.find('[data-test="fav-filter-years-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()
      expect(btn.find('.ct').exists()).toBe(false)
    })
  })

  // Acceptance Fix-1: the three dropdowns + the "All" chip together are a SINGLE
  // mutually-exclusive filter, following Vue2's single `filter` string (:329) -- selecting a
  // person clears any active place/year selection, not an independent facet stacked on top.
  describe('"All" chip + mutual exclusivity (Acceptance Fix-1)', () => {
    it('the "All" chip shows the exact favoritesTotal and clears whichever facet is active', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('1', { placeName: 'Kyoto, Japan' }), photo('2'),
      ])
      svc.photos.listFavoriteIds.mockResolvedValueOnce(['1', '2'])
      const w = await mountView()
      expect(w.find('[data-test="fav-filter-all-btn"]').find('.ct').text()).toBe('2')
      expect(w.find('[data-test="fav-filter-all-btn"]').attributes('data-active')).toBe('true')

      await w.find('[data-test="fav-filter-places-btn"]').trigger('click')
      await w.findAll('.fav-filter-item').find((b) => b.text().includes('Kyoto'))!.trigger('click')
      expect(w.find('[data-test="fav-filter-all-btn"]').attributes('data-active')).toBe('false')
      expect(w.findAll('.tile')).toHaveLength(1)

      await w.find('[data-test="fav-filter-all-btn"]').trigger('click')
      expect(w.find('[data-test="fav-filter-all-btn"]').attributes('data-active')).toBe('true')
      expect(w.find('[data-test="fav-filter-places-btn"]').attributes('data-active')).toBe('false')
      expect(w.findAll('.tile')).toHaveLength(2)
    })

    it('selecting a person clears an already-active place selection (single shared filter, not stacked facets)', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('1', { placeName: 'Kyoto, Japan', faces: ['Alice'] }),
        photo('2', { placeName: 'Osaka, Japan', faces: ['Bob'] }),
      ])
      const w = await mountView()

      await w.find('[data-test="fav-filter-places-btn"]').trigger('click')
      await w.findAll('.fav-filter-item').find((b) => b.text().includes('Kyoto'))!.trigger('click')
      expect(w.find('[data-test="fav-filter-places-btn"]').attributes('data-active')).toBe('true')

      await w.find('[data-test="fav-filter-people-btn"]').trigger('click')
      await w.findAll('.fav-filter-item').find((b) => b.text().includes('Bob'))!.trigger('click')
      expect(w.find('[data-test="fav-filter-people-btn"]').attributes('data-active')).toBe('true')
      // The place selection is gone -- only one facet can be active at a time.
      expect(w.find('[data-test="fav-filter-places-btn"]').attributes('data-active')).toBe('false')
      expect(w.findAll('.tile')).toHaveLength(1) // Bob's photo (Osaka), not Kyoto's
    })

    it('only one dropdown menu is open at a time (opening People closes an already-open Places menu)', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('1', { placeName: 'Kyoto, Japan', faces: ['Alice'] }),
      ])
      const w = await mountView()
      await w.find('[data-test="fav-filter-places-btn"]').trigger('click')
      expect(w.find('.fav-filter-menu').exists()).toBe(true)
      await w.find('[data-test="fav-filter-people-btn"]').trigger('click')
      expect(w.findAll('.fav-filter-menu')).toHaveLength(1) // the Places menu closed, People's opened
    })
  })

  // Acceptance Fix-1: Sort Recent/Oldest -- follows Vue2 :361-374's sorted computed (items
  // without takenAt sink to the end regardless of direction) + :375-390's grouped computed
  // (group ORDER follows sorted's own order, not a re-sort by month key -- see
  // groupFavoritesByMonthOrdered's header comment).
  describe('sort Recent/Oldest toggle (Acceptance Fix-1)', () => {
    it('defaults to Recent (newest month first); switching to Oldest re-orders the month groups themselves, not just each month\'s tiles', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('old', { takenAt: '2024-01-15T00:00:00Z' }),
        photo('new', { takenAt: '2026-06-15T00:00:00Z' }),
      ])
      const w = await mountView()

      expect(w.find('[data-test="fav-sort-recent"]').attributes('data-active')).toBe('true')
      let titles = w.findAll('.month-title').map((n) => n.text())
      expect(titles[0]).toContain('2026')
      expect(titles[1]).toContain('2024')

      await w.find('[data-test="fav-sort-oldest"]').trigger('click')
      expect(w.find('[data-test="fav-sort-oldest"]').attributes('data-active')).toBe('true')
      expect(w.find('[data-test="fav-sort-recent"]').attributes('data-active')).toBe('false')
      titles = w.findAll('.month-title').map((n) => n.text())
      expect(titles[0]).toContain('2024')
      expect(titles[1]).toContain('2026')
    })

    it('items with no takenAt always sink to the end, regardless of sort direction', async () => {
      svc.photos.listFavorites.mockResolvedValueOnce([
        photo('known', { takenAt: '2025-03-01T00:00:00Z' }),
        photo('unknown', { takenAt: null }),
      ])
      const w = await mountView()
      let titles = w.findAll('.month-title').map((n) => n.text())
      expect(titles[titles.length - 1]).toBe(zh.photosUnknownDate)

      await w.find('[data-test="fav-sort-oldest"]').trigger('click')
      titles = w.findAll('.month-title').map((n) => n.text())
      expect(titles[titles.length - 1]).toBe(zh.photosUnknownDate)
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

    // Opening the drawer triggers NimoModelPicker's own onMounted -> agent.loadAvailableModels()
    // (fire-and-forget, no .catch) -- stub it the same way AskNimoDrawer.test.ts's beforeEach
    // does, so the real, un-mocked service.ai (this file's svc mock has no `ai` key) doesn't
    // throw an unhandled rejection.
    useAgentStore('photos').loadAvailableModels = vi.fn(async () => {})

    // Fire the real click (PhotosTopbar is a real mount here, not stubbed) and prove the
    // handler actually reaches useAskNimo().openDrawer() -- following PhotosSearch.test.ts's
    // own useAskNimo().popupOpen assertion pattern (Plan G Task 18).
    await w.find('[data-test="topbar-ask-nimo"]').trigger('click')
    expect(useAskNimo().drawerOpen.value).toBe(true)
  })

  // F-16: this button is `:disabled` when there are no loaded favorites -- mock a page first so
  // the click actually fires (the default empty-list mock would make this a silent no-op).
  it('AlbumPickerDialog and the save-as-album modal are both descendants of .photos-root', async () => {
    svc.photos.listFavorites.mockResolvedValueOnce([{ id: '1', mimeType: 'image/jpeg' }])
    const w = await mountView()
    expect(w.find('.photos-root').findComponent({ name: 'AlbumPickerDialog' }).exists()).toBe(true)
    await w.find('[data-test="fav-save-album-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.photos-root [data-test="fav-savealbum-modal"]').exists()).toBe(true)
  })
})
