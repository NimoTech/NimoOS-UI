// Task 6 (SP7-P4 Album): PhotosLibraryPicker.vue — pick photos from library to add to this
// album (shared by T7 "manual select" / T8 "add photos" buttons).
// Mounts Pinia + i18n (real zh_cn entries); mocks shared package @nimotech/nimoos-service,
// end-to-end verification via real useTimelineStore()/usePhotosAlbums()/useToast() —
// tile source, in-album determination, add action all use real store, not pure whitebox.
// [T9] Superseded in part by Step 0 note below: add action no longer issued by this
// component, so toast store no longer involved here.
//
// Invariant cross-check: album assets use numeric id (via fetchAlbumAssets→assetToPhoto
// real conversion pipeline get Photo.id as number), timeline photos use string id (same
// assetToPhoto path), existingIds must String() normalize to match — this is the task's
// core assertion.
//
// SP15-P1-T9 · Step 0 (generalisation): the component's props moved from the album-specific
// {open, albumId, albumName} to the generic {open, title, existingIds, existingLabel,
// submitLabel, submitting}, and submitting no longer writes to the album store — it emits
// `confirm` and the caller writes. Every case below therefore mounts with the props the album
// pages now pass (albumProps(), which builds the exact same strings from the same zh keys, and
// derives existingIds through the same real store pipeline), so what these cases assert is still
// what the album pages render. The write / success toast / failure toast / post-add refresh that
// left this component are asserted at their new home, in PhotosAlbums.test.ts and
// PhotosAlbumDetail.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getTimeline: vi.fn(),
    getAlbum: vi.fn(),
    batchAddToAlbum: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    // Task 8b: fetchTimeline() probes this before falling back to getTimeline(). Defaulted
    // to a 404 rejection in beforeEach below so every pre-existing test here keeps exercising
    // the legacy path unchanged; only the bucket-mode tests override it.
    getTimelineBuckets: vi.fn(),
    getTimelineBucket: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosLibraryPicker from '../PhotosLibraryPicker.vue'
import { usePhotosAlbums } from '../../stores/albums'
import { useTimelineStore, __resetBucketProbeForTest } from '../../stores/timeline'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Task 8b: models "this backend predates the bucket endpoints" for fetchTimeline()'s probe --
// see timeline.test.ts's own notFound() for the same rationale.
function notFound() {
  return Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } })
}

interface PickerProps {
  open: boolean
  title: string
  existingIds: Set<string>
  existingLabel: string
  submitLabel: string | ((count: number) => string)
  submitting?: boolean
}

/** The props both album pages pass — same i18n keys, same String()-normalised existingIds
 *  expression — so these cases keep asserting what the album pages actually render. */
function albumProps(over: Partial<PickerProps> = {}): PickerProps {
  const albums = usePhotosAlbums()
  return {
    open: true,
    title: zh.photosAlbumPickerTitle.replace('{name}', 'Trip'),
    existingIds: new Set(albums.assetsOf('a1').map((p) => String(p.id))),
    existingLabel: zh.photosAlbumPickerAlready,
    submitLabel: (count: number) => zh.photosAlbumPickerAdd.replace('{count}', String(count)),
    ...over,
  }
}

function mountPicker(props: PickerProps) {
  return mount(PhotosLibraryPicker, { props, global: { plugins: [i18n] } })
}

// Three timeline photos, takenAt in random order, verify flattened and resorted by takenAt descending
// (not original order, not grouped by month).
function seedTimeline() {
  const timeline = useTimelineStore()
  timeline.timelineGroups = [
    {
      year: 2026, month: 7,
      assets: [
        { id: 't-mid', takenAt: '2026-07-10T00:00:00Z', mimeType: 'image/jpeg' },
        { id: 't-newest', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' },
      ],
    },
    {
      year: 2026, month: 6,
      assets: [
        { id: 't-oldest', takenAt: '2026-06-01T00:00:00Z', mimeType: 'image/jpeg' },
      ],
    },
  ]
  return timeline
}

beforeEach(() => {
  setActivePinia(createPinia())
  // Task 8b: the bucket probe's 404 backoff is a module-level timestamp, not store state --
  // it survives across tests in this file unless explicitly cleared, which would silently
  // skip the probe (and thus never enter bucket mode) for whichever bucket-mode test runs
  // after an earlier 404 has already set the backoff window.
  __resetBucketProbeForTest()
  svc.photos.getTimeline.mockReset()
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.getTimelineBuckets.mockReset().mockRejectedValue(notFound())
  svc.photos.getTimelineBucket.mockReset()
  svc.photos.thumbnailUrl.mockClear()
})

describe('PhotosLibraryPicker.vue', () => {
  it('flatten timeline photos and render tiles by takenAt descending (first is newest t-newest)', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    expect(tiles).toHaveLength(3)
    expect(tiles[0]!.attributes('data-asset-id')).toBe('t-newest')
    expect(tiles[1]!.attributes('data-asset-id')).toBe('t-mid')
    expect(tiles[2]!.attributes('data-asset-id')).toBe('t-oldest')
    // title contains album name + initial selected count 0
    expect(w.text()).toContain('Trip')
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '0'))
  })

  it('items already in album render photosAlbumPickerAlready and clicking does not add to selected; cross-type String normalization (album asset numeric id, timeline photo string id)', async () => {
    const timeline = seedTimeline()
    // Album asset: backend original id is number 5, via fetchAlbumAssets real conversion
    // pipeline get Photo.id === 5 (number). t-newest timeline id is string 't-newest'
    // — no overlap; separately insert string form '5' for number 5 into timeline,
    // creating cross-type match.
    svc.photos.getAlbum.mockResolvedValueOnce({ assets: [{ id: 5, takenAt: null, mimeType: 'image/jpeg' }] })
    timeline.timelineGroups = [
      {
        year: 2026, month: 7,
        assets: [
          { id: '5', takenAt: '2026-07-15T00:00:00Z', mimeType: 'image/jpeg' }, // string '5', matches number 5
          { id: 't-other', takenAt: '2026-07-01T00:00:00Z', mimeType: 'image/jpeg' },
        ],
      },
    ]
    const albums = usePhotosAlbums()
    await albums.fetchAlbumAssets('a1')
    expect(albums.assetsOf('a1').map((p) => p.id)).toEqual([5]) // confirm real conversion gets number

    const w = mountPicker(albumProps())
    await flushPromises()

    const tileFive = w.get('[data-asset-id="5"]')
    expect(tileFive.attributes('data-disabled')).toBe('true')
    expect(tileFive.text()).toContain(zh.photosAlbumPickerAlready)

    const tileOther = w.get('[data-asset-id="t-other"]')
    expect(tileOther.attributes('data-disabled')).toBe('false')

    await tileFive.trigger('click')
    // clicking already-in-album tile does not add to selected — primary button count should still be 0 (disabled)
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '0'))
    const addBtn = w.get<HTMLButtonElement>('[data-test="lib-picker-add"]')
    expect(addBtn.element.disabled).toBe(true)
  })

  // Step 0: the submit button's label still counts up with the selection (the album pages pass a
  // (count) => string label for exactly that), and pressing it hands the raw ids to the caller.
  it('two tiles selected → submit label reads 2; pressing emits confirm([id1, id2]) with ids unconverted', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click') // t-newest
    await tiles[1]!.trigger('click') // t-mid
    await flushPromises()

    expect(w.text()).toContain(zh.photosAlbumPickerAdd.replace('{count}', '2'))
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '2'))

    const addBtn = w.get<HTMLButtonElement>('[data-test="lib-picker-add"]')
    expect(addBtn.element.disabled).toBe(false)
    await addBtn.trigger('click')
    await flushPromises()

    expect(w.emitted('confirm')).toEqual([[['t-newest', 't-mid']]])
  })

  // Step 0 · brief's new case: submitting must not reach album store anymore — write
  // belongs to caller now. Spying on real store instance (not service mock) makes this fail
  // if any half of old album-specific behavior is left behind.
  it('SP15-P1-T9 generalization: submitting only emits confirm — neither writes to store nor closes itself', async () => {
    seedTimeline()
    const albums = usePhotosAlbums()
    const spy = vi.spyOn(albums, 'addAssetsToAlbum')
    const w = mountPicker(albumProps())
    await flushPromises()

    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click') // t-newest
    await w.get('[data-test="lib-picker-add"]').trigger('click')
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalled()
    expect(w.emitted('confirm')?.[0]?.[0]).toEqual(['t-newest'])
    // Closing is the caller's call too — it is the one that knows whether the write succeeded.
    expect(w.emitted('update:open')).toBeUndefined()
  })

  // Step 0 · failure path from component side. Write and its failure toast now live in album
  // pages (asserted there); what component still owes user is caller who leaves panel open
  // finds selection exactly as it was, can resubmit.
  //
  // fix round 1 · finding 1: deliberately replays caller's whole lifecycle — submitting goes
  // true while write in flight, back to false in caller's `finally`. Earlier version never
  // turned submitting on at all, so "button recovered" was true before click too and proved
  // nothing. (That callers really do reset flag asserted in their own tests; here premise.)
  it("caller's write fails, keeps panel open → selection survives, button recovers, second submit sent", async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click')
    await w.get('[data-test="lib-picker-add"]').trigger('click')
    await w.setProps({ submitting: true })   // caller's write is in flight
    await w.setProps({ submitting: false })  // …and it failed; the caller's finally clears it
    await flushPromises()

    // Selection still there (panel still reads "1 selected", not cleared).
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
    // Button usable again, not stuck in submitting state.
    expect(w.get<HTMLButtonElement>('[data-test="lib-picker-add"]').element.disabled).toBe(false)

    await w.get('[data-test="lib-picker-add"]').trigger('click')
    expect(w.emitted('confirm')).toHaveLength(2)
  })

  // Step 0 · submitting comes from caller (Vue 3 emit cannot hand back parent's promise
  // — see deviation a in component header): while write in flight button is disabled and
  // reads "Adding…", clicking again emits nothing.
  it('submitting=true (caller\'s write in flight) → button disabled, reads "Adding…", repeat click emits no second confirm', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()
    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click')

    await w.setProps({ submitting: true })
    expect(w.get<HTMLButtonElement>('[data-test="lib-picker-add"]').element.disabled).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerAdding)

    await w.get('[data-test="lib-picker-add"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  // Step 0 · caller with fixed label (moment page passes photosMoAddSelected, plain string)
  // — button shows it as is, no count appended. Both usages of component must hold.
  it('plain-string submitLabel rendered verbatim, no selected count appended', async () => {
    seedTimeline()
    const w = mountPicker(albumProps({ submitLabel: '添加所选' }))
    await flushPromises()
    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click')

    const addBtn = w.get('[data-test="lib-picker-add"]')
    expect(addBtn.text()).toBe('添加所选')
    expect(addBtn.text()).not.toContain('1')
  })

  it('with selection, click cancel → show confirm bar, confirm again to close; no selection, cancel closes directly', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

    // no selection → close directly
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])

    // reopen, select one then click cancel → show confirm bar, do not close
    await w.setProps({ open: true })
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerDiscard)
    // update:open still only first (false), no new emit
    expect(w.emitted('update:open')).toEqual([[false]])

    // confirm discard → really close
    await w.get('[data-test="lib-picker-discard-confirm"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false], [false]])
  })

  it('click "Back" in confirm bar (cancel discard) → bar closes, panel still open, selection retained', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)

    await w.get('[data-test="lib-picker-discard-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
  })

  // Review gap: Vue2 source (PhotosAlbumLibraryPicker.vue:10-12) header has X close button
  // (@click="onScrimClose"), behavior same as clicking overlay/cancel — "confirm before
  // discarding unsaved selection" hierarchy. Brief structure list omits it, but this period's
  // "UI strictly 1:1 per Vue2" discipline requires adding it.
  it('header X close button: with selection, click → show confirm bar, update:open not emitted; no selection, close directly', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

    // with selection → show confirm bar, do not close directly
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-close"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)
    expect(w.emitted('update:open')).toBeUndefined()

    // after confirming discard, close (simulate host really responding to update:open,
    // flip prop back to false and reopen — else open stays true, false→true watch never
    // fires, selected never cleared)
    await w.get('[data-test="lib-picker-discard-confirm"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    await w.get('[data-test="lib-picker-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false], [false]])
  })

  it('no photos to add (timeline empty) → render photosAlbumPickerEmpty', async () => {
    svc.photos.getTimeline.mockResolvedValue([])
    const w = mountPicker(albumProps())
    await flushPromises()
    expect(w.find('[data-test="lib-picker-empty"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerEmpty)
  })

  it('when open false→true: if months empty, trigger fetchTimeline (case: entering library directly from album detail page, not loaded)', async () => {
    svc.photos.getTimeline.mockResolvedValueOnce([
      { year: 2026, month: 7, assets: [{ id: 'x1', takenAt: '2026-07-01T00:00:00Z', mimeType: 'image/jpeg' }] },
    ])
    const w = mountPicker(albumProps({ open: false }))
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    await w.setProps({ open: true })
    await flushPromises()
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
    expect(w.findAll('[data-test="lib-picker-tile"]')).toHaveLength(1)
  })

  it('when open false→true, clear local selected (previous unsubmitted selection does not carry over to next open)', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '0'))
  })

  it('tile thumbnail generated by shared package thumbnailUrl (not hand-formed /v1/photos/... URL)', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('t-newest', 'small')
    const img = w.get('[data-asset-id="t-newest"] img')
    expect(img.attributes('src')).toBe('mock://thumb/t-newest/small')
  })

  it('Esc hierarchy (document level dispatch): with confirm bar open, collapse it first (panel still open); no selection, Esc closes directly', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)

    // first Esc: only collapse confirm bar, panel still open
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()

    // reopen fresh panel (no selection) verify Esc closes directly
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toContainEqual([false])
  })

  // Task 8b (owner ruling): in bucket mode `months` arriving doesn't mean any photos in
  // hand — this grid is `timeline.allPhotos` flattened, without fetchNewestBuckets picker
  // would render empty even though directory says library has photos.
  it('on open (bucket mode) call fetchNewestBuckets to fetch newest months, not just wait for directory', async () => {
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    const timeline = useTimelineStore()
    const fetchSpy = vi.spyOn(timeline, 'fetchNewestBuckets')
    const w = mountPicker(albumProps({ open: false }))
    await flushPromises()
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()

    await w.setProps({ open: true })
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(3)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 7, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 6, 500, 0)
  })

  // Task 8b (owner ruling, second half): scrolling near bottom pages in next unloaded
  // dated bucket. Two scroll events fired back to back (before first bucket photos
  // landed) must not fire two requests for same month.
  it('scroll near bottom, fetch next unloaded dated bucket; two successive scrolls do not repeat request for same bucket', async () => {
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
      { year: 2026, month: 5, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    const w = mountPicker(albumProps())
    await flushPromises()
    // open watch's immediate fetchNewestBuckets(3) already loaded 08/07/06, leaving
    // 05 the only unloaded dated bucket.
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(3)

    const body = w.get('.picker-body')
    Object.defineProperty(body.element, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(body.element, 'clientHeight', { value: 500, configurable: true })
    body.element.scrollTop = 550 // 1000 - 550 - 500 = -50 < 200 → near the bottom

    await body.trigger('scroll')
    await body.trigger('scroll') // fired again before the first request settles
    await flushPromises()

    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(4)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 5, 500, 0)
  })

  // Whole-branch review fix (minor 12): paging used to be reachable ONLY from
  // `scroll` event, so library whose three newest months fit in panel never fired
  // one — no scrollbar, nothing to drag, every earlier month unreachable. Picker
  // looked like library ended three months ago.
  it('page in more months when newest three do not fill panel', async () => {
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
      { year: 2026, month: 5, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    const w = mountPicker(albumProps({ open: false }))
    await flushPromises()

    // Open it, then stand in for layout where content does NOT overflow — jsdom
    // reports 0 for both, component reads as "not laid out yet" and deliberately
    // refuses to act on.
    await w.setProps({ open: true })
    const body = w.get('.picker-body')
    Object.defineProperty(body.element, 'clientHeight', { value: 500, configurable: true })
    Object.defineProperty(body.element, 'scrollHeight', { value: 100, configurable: true })
    await flushPromises()

    // newest three, plus fourth month nobody could have scrolled to.
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 5, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(4)
  })

  it('leave paging to user once list overflows', async () => {
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
      { year: 2026, month: 5, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    const w = mountPicker(albumProps({ open: false }))
    await flushPromises()

    await w.setProps({ open: true })
    const body = w.get('.picker-body')
    Object.defineProperty(body.element, 'clientHeight', { value: 500, configurable: true })
    Object.defineProperty(body.element, 'scrollHeight', { value: 2000, configurable: true })
    await flushPromises()

    // scrollbar exists: rest is user's to ask for, panel must not walk back through
    // whole library on its own.
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(3)
  })
})
