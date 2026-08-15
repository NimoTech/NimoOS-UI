// Task 7 (SP7-P4 albums): PhotosAlbums.vue — the album list view (card grid + sort + three
// fill modes for creating an album + empty state). Mounts Pinia + i18n + a real router (spying
// on push rather than mocking the whole vue-router module — AreaShell/PhotosSidebar both call
// useRouter(), following the existing mounting pattern from PhotosFavorites.test.ts /
// PhotosTrash.test.ts), mocks the shared package's albums/timeline methods. Covers all 8 behavior
// items from the brief's Step 1, plus one for Esc closing the modal (a hard requirement: it's a
// document-level listener, not a template @keydown.esc, so it's worth asserting it actually
// works).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
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
    // Task 8b: fetchTimeline() probes this before falling back to getTimeline(). Defaulted
    // to a 404 rejection in beforeEach below so every pre-existing test in this file keeps
    // exercising the legacy path unchanged; only the bucket-mode tests override it.
    getTimelineBuckets: vi.fn(),
    getTimelineBucket: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    // SP15-P2b Task 3: the page now also fetches the smart-view list and the AI
    // feature flags (for the smart-views-off banner) alongside albums.
    listSmartViews: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({}),
    // The embedded create form arms a 300ms preview debounce. Nothing here closes the
    // panel or unmounts the wrapper, so that timer outlives the test and fires while a
    // later one runs -- without this stub it threw an unhandled TypeError that turned the
    // whole suite's exit code red even though every assertion passed.
    previewSmartView: vi.fn().mockResolvedValue({ count: 0, seeds: [] }),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosAlbums from '../PhotosAlbums.vue'
// SP15-P2c Task 10: the two CSS assertions at the bottom of this file read the style block's
// source text (jsdom does not cascade or paint). `?raw` on a .vue file is the established way
// here -- see the same import in the SmartViewCard test this task replaced.
import photosAlbumsRaw from '../PhotosAlbums.vue?raw'
import PhotosLibraryPicker from '../../photos/components/PhotosLibraryPicker.vue'
import SmartViewCreateDialog from '../../photos/components/SmartViewCreateDialog.vue'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useTimelineStore, __resetBucketProbeForTest } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Task 8b: models "this backend predates the bucket endpoints" for fetchTimeline()'s probe --
// see timeline.test.ts's own notFound() for the same rationale.
function notFound() {
  return Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } })
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
      { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
      // SP15-P2b Task 3: smart-card clicks route here now that the grid is mixed.
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail-stub', component: { template: '<div/>' } },
      // The AI-off banner's settings link resolves to this path (?section=ai query) -- a stub
      // route lets RouterLink resolve a real href instead of vue-router warning "no match"
      // (same fix PhotosSmartViews.test.ts already applies for its own copy of this banner).
      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
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

// SP15-P2b Task 3: shared spy for the mixed-grid test block below, reassigned on every
// mountAlbums() call so each test's assertion reads the router instance it actually mounted
// against (mirrors the existing mountView()/router pattern, just hoisted to module scope so
// the brief's test bodies -- which reference a bare `push` -- can call it without destructuring).
let push: ReturnType<typeof vi.fn>

/**
 * Mount PhotosAlbums with albums + smart views + AI-feature fixtures seeded in one call.
 * `aiFeatures`, when provided, is nested under `getConfig()`'s `aiFeatures` field (the shape
 * `usePhotosSettingsStore().fetchAiFeatures()` actually reads via readAiFeatures() in
 * settings.ts); omitting it (as most tests do) leaves getConfig() resolving `{}`, which
 * readAiFeatures() treats as "all features on" -- the same default the store assumes on any
 * other real page.
 */
async function mountAlbums(opts: {
  albums?: Array<Record<string, unknown>>
  smartViews?: Array<Record<string, unknown>>
  aiFeatures?: Record<string, unknown>
  smartViewsFails?: boolean
} = {}) {
  svc.photos.listAlbums.mockResolvedValue(opts.albums ?? [])
  if (opts.smartViewsFails) {
    svc.photos.listSmartViews.mockRejectedValueOnce(new Error('smart views failed'))
  } else {
    svc.photos.listSmartViews.mockResolvedValue(opts.smartViews ?? [])
  }
  svc.photos.getConfig.mockResolvedValue(opts.aiFeatures !== undefined ? { aiFeatures: opts.aiFeatures } : {})

  const router = makeRouter()
  router.push('/photos/albums')
  await router.isReady()
  push = vi.spyOn(router, 'push')
  const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
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
  // Task 8b: the bucket probe's 404 backoff is a module-level timestamp, not store state --
  // it survives across tests within this file unless explicitly cleared, which would silently
  // skip the probe (and thus never enter bucket mode) for whichever bucket-mode test runs
  // after an earlier 404 has already set the backoff window.
  __resetBucketProbeForTest()
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.createAlbum.mockClear()
  svc.photos.getAlbum.mockClear().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.getTimelineBuckets.mockClear().mockRejectedValue(notFound())
  svc.photos.getTimelineBucket.mockClear()
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.listSmartViews.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PhotosAlbums.vue', () => {
  // fix round 1 (Important 3): the standalone [data-test="albums-empty"] panel this test used
  // to assert on is gone -- the section subtitle carries the empty state now (see
  // PhotosAlbums.vue's comment above the subtitle span). Assert on that instead.
  it('albumsLoaded and the list is empty -> the section subtitle shows the empty-state copy, the "New" placeholder tile is still there', async () => {
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.albumsLoaded).toBe(true)
    expect(w.text()).toContain('还没有相册')
    expect(w.find('[data-test="album-create-tile"]').exists()).toBe(true)
  })

  it('has albums -> renders cards: title/count/cover img src=thumbnailUrl(cover,"large"); a coverless item renders the fallback instead of <img>', async () => {
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

  it('clicking a card -> router.push receives /photos/albums/<id> (a numeric id verifies the URL is built correctly)', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(42, { name: 'NumericId' })])
    const { w, router } = await mountView()
    const pushSpy = vi.spyOn(router, 'push')

    await w.find('[data-test="album-card"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/photos/albums/42')
  })

  it('defaults to created (createdAt descending), then switching to name re-sorts alphabetically', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Zebra', createdAt: '2026-05-03T00:00:00Z' }),
      rawAlbum(2, { name: 'Apple', createdAt: '2026-05-01T00:00:00Z' }),
      rawAlbum(3, { name: 'Mango', createdAt: '2026-05-02T00:00:00Z' }),
    ])
    const { w } = await mountView()

    // Default sort is 'created': newest createdAt first (Zebra 05-03 > Mango 05-02 >
    // Apple 05-01) -- proves the default is no longer the dead 'updated' passthrough.
    let titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['Zebra', 'Mango', 'Apple'])

    await w.find('[data-test="albums-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const nameItem = w.findAll('[data-test="albums-sort-item"]').find((n) => n.attributes('data-sort-id') === 'name')!
    await nameItem.trigger('click')
    await w.vm.$nextTick()

    titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  // Regression for the T2 fix-round finding: the page's `views` computed used to carry a
  // private, byte-for-byte copy of the deleted albumView.sortAlbums, which coerced a
  // missing createdAt to epoch 0 (sorts LAST) -- the opposite of the rule
  // util/mixedAlbums.ts's sortMixed implements (sorts FIRST). `views` now delegates to
  // buildMixedAlbums/sortMixed directly, so this asserts the page a user can actually
  // reach gets the corrected ordering, not just the not-yet-wired module.
  it('ranks an album with a missing createdAt FIRST under the default created sort', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Has Date', createdAt: '2026-05-01T00:00:00Z' }),
      rawAlbum(2, { name: 'No Date', createdAt: null }),
    ])
    const { w } = await mountView()

    const titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['No Date', 'Has Date'])
  })

  it('clicking "New" -> the modal appears; the primary button is disabled while the name is empty; filling in a name + submitting with the empty source -> createAlbum is called + a success toast + the modal closes', async () => {
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

  it("source==='recent' -> after createAlbum, addAssetsToAlbum is called with an id set containing only photos from the last 30 days (fake timers pin now)", async () => {
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

  // Review Important: a boundary item at exactly 30 days ago — Vue2 :321's literal semantics are
  // `t >= cutoff` (a closed interval, boundary included); asserted separately here, don't change
  // it to `>` in the implementation.
  it("source==='recent' boundary: an item at exactly 30 days ago (the cutoff itself) is included under >= semantics", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Boundary' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 6,
        // now - 30*86400000 == the timestamp for 2026-06-27T00:00:00Z, exactly equal to cutoff.
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

  // Review Important (ruled a new defect, not a copy of Vue2): Vue2's album list was never an
  // independent route — it's a sub-block inside PhotosTimeline.vue switched by activeNav, and
  // the timeline data is unconditionally pre-warmed by the parent component's
  // PhotosTimeline.mounted(). New-UI made albums an independent real route /photos/albums, so
  // a user may land here via a direct link/refresh having never visited /photos, in which case
  // the timeline store is brand new (allPhotos===[]). Before the fix: the 'recent' branch would
  // silently compute an empty id set, addAssetsToAlbum would be skipped, but the "created"
  // success toast would still pop — the user ends up with an empty album and a fake success
  // message, zero error signal. Assertion: when the timeline is brand new, submitting with
  // recent selected -> the component backfills a fetchTimeline itself, and addAssetsToAlbum
  // ultimately receives a non-empty id set (rather than being silently skipped).
  it("source==='recent' and the timeline store is brand new (not pre-warmed) -> the component backfills fetchTimeline itself, addAssetsToAlbum receives a non-empty id set", async () => {
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
    // Key point: unlike the other 'recent' test cases, this one deliberately does not call
    // timeline.fetchTimeline() beforehand — simulating a user who has never visited /photos, so
    // the timeline store is still in its initial empty state.
    const { w } = await mountView()
    const timeline = useTimelineStore()
    expect(timeline.allPhotos).toHaveLength(0) // precondition: this really is a cold start
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
    expect(addSpy).toHaveBeenCalledWith('new1', ['warm1']) // a non-empty id set, not silently skipped
  })

  // Task 8b: in bucket mode, `months` arrives (the directory) with no photos in hand yet --
  // the old guard `months.length === 0 → fetchTimeline()` is already satisfied by the
  // directory alone, so without fetchNewestBuckets the album would be created empty. This
  // asserts the fix: the two newest dated buckets get fetched before the album is created,
  // and addAssetsToAlbum only receives ids the fetch actually filled in.
  it("source==='recent' in bucket mode → the two newest buckets are fetched before the album exists, and addAssetsToAlbum only gets photos actually in hand", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'BucketRecent' })
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockImplementation((year: number, month: number) => {
      if (year === 2026 && month === 7) {
        return Promise.resolve([{ id: 'bkt-recent', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' }])
      }
      if (year === 2026 && month === 6) {
        // Older than the 30-day cutoff -- present to prove the fetch happened, filtered out
        // of the ids handed to addAssetsToAlbum.
        return Promise.resolve([{ id: 'bkt-old', takenAt: '2026-05-01T00:00:00Z', mimeType: 'image/jpeg' }])
      }
      return Promise.resolve([])
    })
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('BucketRecent')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 7, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 6, 500, 0)
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('BucketRecent')
    expect(addSpy).toHaveBeenCalledWith('new1', ['bkt-recent'])
  })

  // Task 8b guard: when the newest buckets really do hold zero photos within the 30-day
  // window, no album is created at all and the user sees a failure, not a silent empty
  // "success".
  it("source==='recent' in bucket mode, no photos within 30 days → createAlbum is never called and the toast reports failure, not success", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([
      { id: 'ancient', takenAt: '2020-01-01T00:00:00Z', mimeType: 'image/jpeg' },
    ])
    const { w } = await mountView()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Empty30d')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.createAlbum).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(zh.photosAlbumCreateFailed)
    expect(showSpy).not.toHaveBeenCalledWith(expect.stringContaining('Empty30d'))
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })

  it("source==='select' -> after submitting, PhotosLibraryPicker renders (open===true)", async () => {
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

  // SP15-P1-T9 · Step 0: the picker was generalised and no longer writes to the album store
  // itself — it emits `confirm(ids)` and this page performs the write, the success toast, the
  // close and the fetchAlbums refresh that `@added` used to trigger. All four used to be
  // asserted inside PhotosLibraryPicker.test.ts; they are asserted here now, at their new home.
  /** Runs the create → "select" flow up to the point where the picker is on screen. */
  async function openPickerViaCreate(w: ReturnType<typeof mount>) {
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Picked')
    await w.find('[data-test="source-select"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    return w.findComponent(PhotosLibraryPicker)
  }

  it("source==='select', photos picked → @confirm runs addAssetsToAlbum, the success toast, closes the panel and refreshes with fetchAlbums", async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    const toast = useToast()

    const picker = await openPickerViaCreate(w)
    // The spy goes on after the create step so the "album created" toast is not in the way and
    // the count below really is "how many toasts did the add produce".
    const showSpy = vi.spyOn(toast, 'show')
    const fetchAlbumsSpy = vi.spyOn(albums, 'fetchAlbums')
    picker.vm.$emit('confirm', ['p1', 'p2'])
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('new1', ['p1', 'p2'])
    // fix round 1 · finding 4: exactly one toast, and it is the success one with the album name
    // and the count — a duplicate, or a stray danger toast alongside it, has to fail here.
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(
      zh.photosAlbumAddedToast.replace('{count}', '2').replace('{name}', 'Picked'),
    )
    expect(fetchAlbumsSpy).toHaveBeenCalled()
    expect(w.find('[data-test="lib-picker-overlay"]').exists()).toBe(false)
  })

  // A failed write: the failure toast, and the panel stays up with the user's selection still in
  // it so they can retry. Same behaviour, moved out of the component.
  it("source==='select', a failed write → failure toast, the panel stays open, and the busy flag is released so a retry is possible", async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    svc.photos.batchAddToAlbum.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()

    const picker = await openPickerViaCreate(w)
    const showSpy = vi.spyOn(toast, 'show')
    picker.vm.$emit('confirm', ['p1'])
    await flushPromises()
    await w.vm.$nextTick()

    // fix round 1 · finding 4: only the danger toast, nothing else — a success toast leaking onto
    // the failure path would be caught by the count.
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(zh.photosAlbumAddFailed)
    expect(w.find('[data-test="lib-picker-overlay"]').exists()).toBe(true)

    // fix round 1 · finding 1: the busy flag must come back down in the handler's `finally`.
    // Without it the panel is left with a permanently disabled button reading "Adding…" and the
    // user has no way to retry — which is exactly what the assertions below rule out.
    expect(picker.props('submitting')).toBe(false)
    picker.vm.$emit('confirm', ['p1'])
    await flushPromises()
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledTimes(2)

    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  // fix round 1 · finding 2: before Step 0 the picker computed existingIds itself and its own
  // cross-type test proved the String() normalisation. The expression moved here, so the proof
  // has to move with it: album assets come back from the API with **numeric** ids while timeline
  // photos carry strings, and without String() not one already-in photo would be recognised.
  it('the existingIds handed to the picker are String()-normalised (a numeric album asset id arrives as a string)', async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    svc.photos.getAlbum.mockResolvedValue({
      assets: [{ id: 5, takenAt: '2026-05-01T00:00:00Z', mimeType: 'image/jpeg' }],
    })
    const { w } = await mountView()
    const picker = await openPickerViaCreate(w)

    const ids = picker.props('existingIds') as Set<string>
    expect([...ids]).toEqual(['5'])
    expect(ids.has('5')).toBe(true)
  })

  it('createAlbum throws 409 -> renders the duplicate-name toast, the modal closes (following Vue2\'s finally semantics)', async () => {
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

  // Final-review must-fix 3: Vue2 PhotosAlbumsView.vue:52-58 unconditionally renders a "My Albums
  // / Albums you created" section header above the grid; New-UI dropped straight from the
  // banner to .album-grid, losing that whole section header — the two i18n keys built
  // specifically for it (photosAlbumsMine/photosAlbumsMineHint) had therefore become dead code.
  // The UI must be a strict 1:1 match to Vue2, and this is a pure visual omission that must be
  // filled in.
  it('must-fix-3 regression: renders the "My Albums / Albums you created" section title above the grid (corresponds to Vue2 :52-58, New-UI once missed rendering it)', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(1, { name: 'Tokyo' })])
    const { w } = await mountView()
    expect(w.text()).toContain(zh.photosAlbumsMine)
    expect(w.text()).toContain(zh.photosAlbumsMineHint)
  })

  // Final-review Important 1 (wrapping up across the whole branch): albumsLoaded stays false
  // when fetchAlbums fails (see the albums.ts comment), so under the old implementation isEmpty
  // was therefore always false -> it would fall into the grid branch, rendering the "My Albums"
  // section header plus a bare create tile, with no failure indication at all. The new loadError
  // branch must be checked first — same three gating test cases as PhotosFavorites.test.ts
  // (failure state renders / retry succeeds / retry still fails, staying visible both in-flight
  // and after settling) plus two "still distinguishable" gating test cases (confirming empty vs.
  // still loading).
  it('renders the failure state instead of an empty grid when loading fails (same defect carried over from P4)', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('network'))
    const { w } = await mountView()
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
    expect(w.text()).toContain('相册加载失败')
    // fix round 1 (Important 3): albumsLoaded stays false on a failed fetch (albums.ts), so
    // the subtitle's `albumsLoaded &&` gate must keep it on photosAlbumsMineHint rather than
    // flashing the "none yet" copy alongside the error panel above.
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)
    expect(w.find('[data-test="album-card"]').exists()).toBe(false)
  })

  it('the failure state\'s retry button calls fetchAlbums again, and the failure state goes away on success', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('network'))
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(true)
    const fetchSpy = vi.spyOn(albums, 'fetchAlbums')

    svc.photos.listAlbums.mockResolvedValueOnce([rawAlbum(1, { name: 'Tokyo' })])
    await w.find('[data-test="albums-retry"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalled()
    expect(albums.loadError).toBe(false)
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
    expect(w.find('[data-test="album-card"]').exists()).toBe(true)
  })

  it('failure state, retry still fails (reject -> retry -> reject) -> the failure state stays visible both in-flight and after settling, no grid section header appears', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e1'))
    const { w } = await mountView()
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)

    let rejectRetry: (e: Error) => void = () => {}
    svc.photos.listAlbums.mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
    )
    await w.find('[data-test="albums-retry"]').trigger('click')
    await w.vm.$nextTick()

    // in-flight: the retry hasn't settled yet, the failure state must stay visible, it must not
    // fall into the empty-state branch.
    // fix round 1 (Important 3): asserted on the subtitle now, not a standalone panel --
    // see the same rationale in the "renders the failure state instead of an empty grid when
    // loading fails" test above.
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)

    rejectRetry(new Error('e2'))
    await flushPromises()
    await w.vm.$nextTick()

    // After settling (still failed): the failure state remains visible.
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)
  })

  // Key distinction (gating test case 1): success but the list is empty — must still go through
  // the empty state, must not be swallowed by the loadError branch.
  // fix round 1 (Important 3): asserted on the subtitle now, not a standalone panel.
  it('confirms zero albums (success but the list is empty) still goes through the empty state, not the failure state', async () => {
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(false)
    expect(albums.albumsLoaded).toBe(true)
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsNoneYetHint)
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
  })

  // Key distinction (gating test case 2): the first load is in flight (neither failed nor
  // finished loading) — the failure state should not appear.
  it('first load in flight (not yet settled) -> no failure state appears', async () => {
    let resolveList: ((v: unknown[]) => void) | undefined
    svc.photos.listAlbums.mockImplementationOnce(
      () => new Promise((resolve) => { resolveList = resolve }),
    )
    const router = makeRouter()
    router.push('/photos/albums')
    await router.isReady()
    const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()

    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)

    resolveList?.([])
    await flushPromises()
    await w.vm.$nextTick()
  })

  it('Esc (document-level) closes the create modal', async () => {
    const { w } = await mountView()

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })
})

// SP15-P2b Task 3: Albums page renders manual albums and smart albums in one grid, ranked
// by the single Sort control, plus the AI-off banner ported over from the smart-views page.
describe('PhotosAlbums.vue — mixed grid (SP15-P2b)', () => {
  it('renders smart albums and manual albums in one grid', async () => {
    // 2 manual + 1 smart => 3 cards plus the create tile.
    const w = await mountAlbums({
      albums: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }],
      smartViews: [{ id: 's1', name: 'S', seeds: ['x'], conds: [], count: 4 }],
    })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(2)
    // SP15-P2c Task 10: the smart card is no longer the standalone SmartViewCard component;
    // its selector moved with it (see the Task 10 describe block at the bottom of this file).
    expect(w.findAll('[data-test="album-smart-card"]')).toHaveLength(1)
  })

  it('counts both kinds in the header total', async () => {
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [{ id: 's1', name: 'S' }] })
    // Assert the rendered subtitle, not a bare '2' anywhere on the page -- with this fixture a
    // bare digit matched by luck (card counts, dates), so the assertion had no mutation power.
    expect(w.text()).toContain(zh.photosAlbumsCount.replace('{count}', '2'))
  })

  it('opens the smart view detail route when a smart card is clicked', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [{ id: 's1', name: 'S' }] })
    await w.find('[data-test="album-smart-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/smart-views/s1')
  })

  it('shows the smart-views-off banner only when the backend says it is off', async () => {
    const off = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    expect(off.find('[data-test="albums-ai-banner"]').exists()).toBe(true)
    // Missing field and fetch failure both mean "on" -- never scare the user.
    const unknown = await mountAlbums({ albums: [], aiFeatures: {} })
    expect(unknown.find('[data-test="albums-ai-banner"]').exists()).toBe(false)
  })

  it('swaps the section subtitle for the nothing-yet copy when both kinds are empty', async () => {
    const empty = await mountAlbums({ albums: [], smartViews: [] })
    expect(empty.text()).toContain('还没有相册')
    const some = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [] })
    expect(some.text()).not.toContain('还没有相册')
  })

  // fix round 1 (Important 3): before this task's fix, this exact assertion would already
  // pass by accident -- the standalone [data-test="albums-empty"] panel this replaced had no
  // load gate of its own, but neither did it flash, because mountAlbums() always awaits
  // flushPromises before returning. This test deliberately does NOT await resolution, so it
  // exercises the render that happens *before* the two fetches land -- the case the
  // `albums.albumsLoaded &&` guard on the subtitle exists to cover: mixedItems.length is 0
  // for any library while listAlbums()/listSmartViews() are in flight, full or not.
  it('does not flash the none-yet copy before the fetches resolve', async () => {
    let resolveAlbums: ((v: unknown[]) => void) | undefined
    svc.photos.listAlbums.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAlbums = resolve }),
    )
    const router = makeRouter()
    router.push('/photos/albums')
    await router.isReady()
    const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()

    // Pre-resolution: albumsLoaded is still false, so the subtitle must read the normal
    // "your albums" copy, not the empty one -- even though mixedItems.length is 0 right now.
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)

    resolveAlbums?.([{ id: 'u1', name: 'A' }])
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)
  })

  // SP15-P2b Task 4 (fold-in from Task 3's incomplete flash guard, see progress.md): the
  // subtitle's gate used to read only `albums.albumsLoaded`, so a library with zero manual
  // albums but pending smart views still flashed the "none yet" copy in the window between
  // the two fetches -- mixedItems.length is 0 for that library too, but only because the
  // smart half hasn't landed, not because it is truly empty. The albums fetch resolving
  // first must not be enough; the guard must wait on both.
  it('does not flash the none-yet copy when albums resolve but smart views are still pending', async () => {
    let resolveSmartViews: ((v: unknown[]) => void) | undefined
    svc.photos.listAlbums.mockResolvedValue([])
    svc.photos.listSmartViews.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSmartViews = resolve }),
    )
    const router = makeRouter()
    router.push('/photos/albums')
    await router.isReady()
    const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
    await flushPromises()
    await w.vm.$nextTick()

    // Albums resolved (empty), smart views still in flight: must not flash the empty copy.
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)

    resolveSmartViews?.([])
    await flushPromises()
    await w.vm.$nextTick()
    // Both resolved, both truly empty: now the empty copy is correct.
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsNoneYetHint)
  })

  it('keeps the manual grid alive when the smart view fetch fails', async () => {
    // fetchSmartViews swallows its own errors (store contract); the page must not gate
    // the manual half on it.
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViewsFails: true })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(1)
  })

  // fix round 1 (Minor 1): the mutation check in the original task report showed that
  // dropping the `item.kind + '-'` prefix from :key was caught by NOTHING in the suite --
  // every fixture up to now used ids that could never collide across kinds. This one gives
  // a manual album and a smart view the identical raw id so a future edit that drops the
  // prefix has something to break.
  //
  // SP15-P2c Task 10: this got teeth in this task, though not the teeth the plan expected.
  // While the two kinds were different vnode types (a plain <div> vs the SmartViewCard
  // component) Vue's isSameVNodeType compared (type, key) as a pair, so a raw-id collision
  // could never be conflated whatever the key said. Both kinds are plain <div>s inside the
  // same keyed <template v-for> now, so the prefix is all that separates their fragments.
  //
  // What that costs when the prefix is dropped was measured, not assumed (task-10-report.md):
  // the rendered text stays CORRECT even with duplicate keys, because each v-if branch carries
  // its own compiler-generated key (0/1), so whichever old fragment a new one is patched into,
  // the subtree is rebuilt from the new vnode. The real, and user-visible, consequence is that
  // it IS rebuilt: on every re-sort both cards are torn down and recreated instead of moved,
  // so every cover <img> is a brand-new element the browser has to fetch and decode again.
  // Hence the assertion below is on DOM element identity, not on the text -- an assertion on
  // the text passes with or without the prefix and would have been a test that guards nothing.
  it('moves, rather than rebuilds, a manual album and a smart view that share the same raw id', async () => {
    const w = await mountAlbums({
      albums: [{ id: '1', name: 'Manual One' }],
      smartViews: [{ id: '1', name: 'Smart One' }],
    })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(1)
    expect(w.findAll('[data-test="album-smart-card"]')).toHaveLength(1)
    const smartEl = w.find('[data-test="album-smart-card"]').element
    const manualEl = w.find('[data-test="album-card"]').element

    // Neither fixture carries a usable createdAt, so the default 'created' sort leaves them
    // in build order (smart, then manual); switching to 'name' puts Manual One first. That
    // reorder is what forces the keyed patch.
    await w.find('[data-test="albums-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const nameItem = w.findAll('[data-test="albums-sort-item"]').find((n) => n.attributes('data-sort-id') === 'name')!
    await nameItem.trigger('click')
    await w.vm.$nextTick()

    const titles = w.findAll('.album-card .album-title').map((n) => n.text())
    expect(titles).toEqual(['Manual One', 'Smart One'])
    expect(w.find('[data-test="album-smart-card"]').element, 'the smart card was rebuilt instead of moved').toBe(smartEl)
    expect(w.find('[data-test="album-card"]').element, 'the manual card was rebuilt instead of moved').toBe(manualEl)
  })
})

// SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue:93-146, both sub-commits): the smart
// album card is rendered inline with exactly the manual album card's shape -- one cover from
// seeds[0], a Smart badge and a Live/Paused breathing dot over it, then the title and a meta
// row. The collage, the condition chips and the threshold pill are off the card face.
describe('PhotosAlbums.vue — smart card shape (SP15-P2c Task 10)', () => {
  /**
   * The SFC's style block with block comments stripped. Stripping matters: the rules below
   * are documented with comments that name the very tokens the assertions rule out, and a
   * raw match would then fail on the explanation rather than on the code.
   */
  function styleBlock(): string {
    const m = /<style[^>]*>([\s\S]*)<\/style>/.exec(photosAlbumsRaw)
    expect(m, 'no style block in PhotosAlbums.vue').not.toBeNull()
    return m![1].replace(/\/\*[\s\S]*?\*\//g, '')
  }

  const smartFixture = {
    id: 's1',
    name: 'Sunsets',
    seeds: ['seed-a', 'seed-b', 'seed-c'],
    conds: ['scene: sunset', 'place: Kyoto'],
    threshold: 72,
    count: 1234,
    live: true,
  }

  it('renders a smart album with the same card shape as a manual album', async () => {
    const w = await mountAlbums({
      albums: [{ id: 'u1', name: 'Manual' }],
      smartViews: [smartFixture],
    })
    // One manual + one smart, both plain .album-card boxes now.
    expect(w.findAll('.album-card')).toHaveLength(2)
    expect(w.find('.sv-card').exists()).toBe(false)
    const smart = w.find('[data-test="album-smart-card"]')
    expect(smart.classes()).toContain('album-card')
    expect(smart.find('.album-cover').exists()).toBe(true)
    expect(smart.find('.album-title').text()).toBe('Sunsets')
    expect(smart.find('.album-meta').exists()).toBe(true)
  })

  it('uses the first seed as the smart card cover, and only that one', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [smartFixture] })
    const imgs = w.findAll('[data-test="album-smart-card"] .album-cover img')
    // A single cover, not the old three-image collage.
    expect(imgs).toHaveLength(1)
    expect(imgs[0].attributes('src')).toBe('mock://thumb/seed-a/large')
    expect(imgs[0].attributes('alt')).toBe('Sunsets')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('seed-a', 'large')
    // Re-homed from the deleted SmartViewCard.test.ts: seeds[1]/seeds[2] no longer reach the
    // card face at all, so nothing must be requested for them either.
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('seed-b', 'large')
  })

  it('falls back to the neutral cover when the smart view has no seeds', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [{ ...smartFixture, seeds: [] }] })
    const smart = w.find('[data-test="album-smart-card"]')
    expect(smart.find('.album-cover-fallback').exists()).toBe(true)
    // Never an <img> with an empty src -- the browser treats that as a broken image.
    expect(smart.find('.album-cover img').exists()).toBe(false)
  })

  it('shows the smart badge and the live dot on the cover', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [smartFixture] })
    const cover = w.find('[data-test="album-smart-card"] .album-cover')
    expect(cover.find('.al-smart-badge').text()).toContain(zh.photosSvBadgeSmartView)
    const dot = cover.find('.al-live-dot')
    expect(dot.exists()).toBe(true)
    expect(dot.attributes('data-paused')).toBe('false')
    expect(dot.attributes('title')).toBe(zh.photosSvLive)
    expect(dot.find('.live-dot').exists()).toBe(true)
  })

  it('shows the paused state in both the dot and the meta row', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [{ ...smartFixture, live: false }] })
    const smart = w.find('[data-test="album-smart-card"]')
    expect(smart.find('.al-live-dot').attributes('data-paused')).toBe('true')
    expect(smart.find('.al-live-dot').attributes('title')).toBe(zh.photosSvPaused)
    expect(smart.find('.album-meta').text()).toContain(zh.photosSvPaused)
  })

  it('puts the photo count and the live state in the meta row', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [smartFixture] })
    const meta = w.find('[data-test="album-smart-card"] .album-meta')
    expect(meta.text()).toContain(zh.photosPeoplePhotosCount.replace('{n}', '1234'))
    expect(meta.text()).toContain(zh.photosSvLive)
  })

  it('no longer puts conditions or the threshold on the card face', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [smartFixture] })
    const smart = w.find('[data-test="album-smart-card"]')
    expect(smart.find('.sv-cond').exists()).toBe(false)
    expect(smart.find('.sv-thresh-mini').exists()).toBe(false)
    expect(smart.text()).not.toContain('scene: sunset')
    expect(smart.text()).not.toContain('72')
  })

  it('opens the smart view detail when the card is clicked, with a numeric wire id too', async () => {
    // Re-homed from the deleted SmartViewCard.test.ts, which proved the component's own
    // String() on the id. That normalisation lives in the store now (smartViews.ts's
    // `id: String(r.id)`), so this asserts the behaviour end to end rather than the mechanism.
    const w = await mountAlbums({ albums: [], smartViews: [{ ...smartFixture, id: 7 }] })
    await w.find('[data-test="album-smart-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/smart-views/7')
  })

  it('gives the create tile the same total height as an album card', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [] })
    const tile = w.find('[data-test="album-create-tile"]')
    // The dashed frame narrows to a cover-sized area...
    expect(tile.find('.album-create-cover').exists()).toBe(true)
    // ...and two invisible text lines of the same spec as a card's title/meta pad it out to
    // the same total height. No hardcoded pixel height: it follows the theme's font metrics.
    expect(tile.find('.album-title').attributes('style')).toContain('visibility: hidden')
    expect(tile.find('.album-meta').attributes('style')).toContain('visibility: hidden')
    expect(tile.find('.album-title').attributes('aria-hidden')).toBe('true')
    expect(tile.find('.album-meta').attributes('aria-hidden')).toBe('true')
  })

  // The second sub-commit of Vue2 9f7e941f, which added explicit .al-live-dot dot styles:
  // every pre-existing
  // .live-dot rule was a descendant selector bound to a different ancestor, so inside
  // .al-live-dot the dot rendered as a hollow ring. jsdom neither cascades nor paints, so
  // this is asserted on the style block's source text -- the same technique color-guard.test.ts
  // and photosGlassSurfaces.test.ts use for CSS that no unit test can observe.
  it('styles the breathing dot explicitly inside .al-live-dot (the #116 follow-up fix)', () => {
    const style = styleBlock()
    const rule = /\.al-live-dot\s+\.live-dot\s*\{([^}]*)\}/.exec(style)
    expect(rule, 'no explicit .al-live-dot .live-dot rule -- the dot renders as a hollow ring').not.toBeNull()
    expect(rule![1]).toMatch(/width\s*:/)
    expect(rule![1]).toMatch(/height\s*:/)
    expect(rule![1]).toMatch(/background\s*:/)
    expect(rule![1]).toMatch(/animation\s*:/)
    // The paused variant has to turn the animation off, or a paused view keeps breathing.
    const paused = /\.al-live-dot\[data-paused="true"\]\s+\.live-dot\s*\{([^}]*)\}/.exec(style)
    expect(paused, 'no paused variant for the dot').not.toBeNull()
    expect(paused![1]).toMatch(/animation\s*:\s*none/)
  })

  // Re-homed from the deleted SmartViewCard.test.ts's foreground-compliance block: --on-accent is the
  // readable foreground *on an accent fill*, which in the dark theme is a deep navy -- wrong
  // for a badge that sits on top of a photograph.
  it('does not use --on-accent for the badge sitting on the cover photo', () => {
    const style = styleBlock()
    const badge = /\.al-smart-badge\s*\{([^}]*)\}/.exec(style)
    expect(badge, 'no .al-smart-badge rule').not.toBeNull()
    expect(badge![1]).not.toMatch(/--on-accent/)
  })
})

// SP15-P2b Task 4 (Vue2 939a7d3a:PhotosAlbumsView.vue:147-225/:329-336/:519-530/:575-578):
// picking the "Let Nimo draft it" fill option swaps the panel body for the embedded smart
// form instead of opening a second modal.
describe('PhotosAlbums.vue — embedded smart-album creation (SP15-P2b Task 4)', () => {
  it('offers a fourth fill option that drafts a smart album', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    expect(w.find('[data-test="source-nimo"]').exists()).toBe(true)
  })

  it('disables the nimo option and explains why when smart views are off', async () => {
    const w = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    const opt = w.find('[data-test="source-nimo"]')
    expect(opt.attributes('disabled')).toBeDefined()
    // SP15-P2b Task 4 review fix round 1 · Minor 3: reference the imported locale value
    // (as the sibling assertions elsewhere in this file do) rather than a hardcoded literal,
    // so a copy change cannot leave this test asserting stale text.
    expect(opt.attributes('title')).toContain(zh.photosSvSmartViewsOffCreateHint)
    await opt.trigger('click')
    expect(w.find('[data-test="sv-embed-host"]').exists()).toBe(false)
  })

  it('swaps its own footer for the embedded smart form when nimo is picked', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    expect(w.find('[data-test="sv-embed-host"]').exists()).toBe(true)
    // Two submit entry points side by side would be ambiguous, so the host footer goes.
    expect(w.find('[data-test="albums-confirm-create"]').exists()).toBe(false)
  })

  it('never creates an empty manual album when nimo is the picked source', async () => {
    // Vue2 :525-530 short-circuits here; the old behaviour created a throwaway album first.
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').setValue('Trip')
    await w.find('[data-test="source-nimo"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').trigger('keydown.enter')
    expect(svc.photos.createAlbum).not.toHaveBeenCalled()
  })

  it('closes the whole panel once the embedded form reports success', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    w.findComponent(SmartViewCreateDialog).vm.$emit('created', 'sv-new')
    await nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
    // Vue2 :575-578 stays on the list -- the new card is already there because the store
    // unshifted it. No navigation at all -- onSmartAlbumCreated() never calls push, so
    // assert that directly (SP15-P2b Task 4 review fix round 1 · Minor 2: the previous
    // `.not.toHaveBeenCalledWith(...)` only ruled out one specific destination).
    expect(push).not.toHaveBeenCalled()
  })

  it('closes the whole panel when the embedded form emits close (cancel path)', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    w.findComponent(SmartViewCreateDialog).vm.$emit('close')
    await nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })

  it('feeds the current Album name field into the embedded form as initial-name', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').setValue('Tokyo Trip')
    await w.find('[data-test="source-nimo"]').trigger('click')
    expect(w.findComponent(SmartViewCreateDialog).props('initialName')).toBe('Tokyo Trip')
  })
})
