// SP15-P3-T8: Photos.vue's bucket-mode wiring. Ported test scaffolding (mock
// set, mountPhotos harness) from Photos.integration.test.ts — see that file for
// the full non-bucket integration coverage; this file only covers the three
// things task-8-brief.md's Step 1 calls out:
//  1. an unloaded bucket month must survive `gridMonths` (Photos.vue:75-79's
//     filter used to drop every month with photos.length === 0, which in
//     bucket mode is every month the user has not scrolled to yet — the grid
//     would receive nothing to render and the whole phase would be a no-op);
//  2. once an EXIF filter narrows the view, that same unloaded month is
//     dropped again — a registered limitation (spec §5.1): its membership is
//     genuinely unknown to the frontend, so it is hidden rather than guessed;
//  3. PhotosGrid's `need-bucket` emit reaches `store.fetchBucket`.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    getTimeline: vi.fn().mockResolvedValue([]),
    // The directory endpoints. The default rejection is deliberately NOT a 404: it
    // reproduces what this fixture did before these two mocks existed (calling an
    // undefined member threw), so the probe fails without arming the 10-minute
    // backoff that would then leak into the next test.
    getTimelineBuckets: vi.fn().mockRejectedValue(new Error('no directory in this fixture')),
    getTimelineBucket: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockResolvedValue({}),
    listTasks: vi.fn().mockResolvedValue({ tasks: [] }),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    previewUrl: vi.fn((id: string | number) => `mock://preview/${id}`),
    spriteUrl: vi.fn((id: string | number) => `mock://sprite/${id}`),
    spriteMeta: vi.fn(),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    recordView: vi.fn().mockResolvedValue(undefined),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// useMessageBus opens a real socket.io connection in the browser — mock it
// (same precedent as Photos.integration.test.ts) so mounting Photos.vue never
// touches the network for the task-progress subscription.
const busOn = vi.hoisted(() => vi.fn((_event: string, _cb: (...a: unknown[]) => void) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import Photos from '../Photos.vue'
import PhotosGrid from '../../photos/components/PhotosGrid.vue'
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import PhotosToolbar from '../../photos/components/PhotosToolbar.vue'
import { useTimelineStore, __resetBucketProbeForTest } from '../../photos/stores/timeline'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

async function mountPhotos() {
  const router = makeRouter()
  router.push('/photos')
  await router.isReady()
  const w = mount(Photos, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  __resetBucketProbeForTest()
  busOn.mockClear()
  svc.photos.getTimelineBuckets.mockClear().mockRejectedValue(new Error('no directory in this fixture'))
  svc.photos.getTimelineBucket.mockClear().mockResolvedValue([])
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.getStatus.mockClear().mockResolvedValue({})
  svc.photos.listTasks.mockClear().mockResolvedValue({ tasks: [] })
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
})

// Puts the store directly into bucket mode with one unloaded month, bypassing
// fetchTimeline's real bucket-probe network call (mocked to reject/resolve
// generically above) — this test cares about what Photos.vue does with the
// store's `months`, not how bucketMode gets flipped (that is T2/T5's territory).
function seedUnloadedBucket(store: ReturnType<typeof useTimelineStore>) {
  store.bucketMode = true
  store.buckets = [{ year: 2026, month: 8, count: 10, videoCount: 2, ocrCount: 0 }]
}

describe('Photos.vue bucket-mode wiring (SP15-P3-T8)', () => {
  it('keeps unloaded months in gridMonths so the grid can render skeletons', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedUnloadedBucket(store)
    await flushPromises()
    await w.vm.$nextTick()

    // Sanity: the store really does carry an unloaded month with photos===[].
    const unloaded = store.months.find((m) => m.key === '2026-08')
    expect(unloaded?.loaded).toBe(false)
    expect(unloaded?.photos).toHaveLength(0)

    // Photos.vue:75-79's old `.filter(m => m.photos.length > 0)` would have
    // dropped this month entirely — the grid must still receive it.
    const gridMonths = w.findComponent(PhotosGrid).props('months') as Array<{ key: string; loaded?: boolean }>
    const forwarded = gridMonths.find((m) => m.key === '2026-08')
    expect(forwarded).toBeTruthy()
    expect(forwarded?.loaded).toBe(false)
  })

  it('drops unloaded months once an EXIF filter is active', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedUnloadedBucket(store)
    await flushPromises()
    await w.vm.$nextTick()

    // Confirm it is present before the filter narrows anything.
    expect(
      (w.findComponent(PhotosGrid).props('months') as Array<{ key: string }>)
        .some((m) => m.key === '2026-08'),
    ).toBe(true)

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2020'], places: [], cameras: [] },
    )
    await w.vm.$nextTick()

    // Registered limitation (spec §5.1): the unloaded month's membership under
    // the active filter is unknown, so it is hidden rather than guessed at.
    expect(
      (w.findComponent(PhotosGrid).props('months') as Array<{ key: string }>)
        .some((m) => m.key === '2026-08'),
    ).toBe(false)
  })

  // Before this fix, filteredCount summed only `m.photos` — always [] for an
  // unloaded bucket month — so the topbar undercounted (showed 0) while the
  // directory already knows the honest per-tab estimate from count/videoCount/
  // ocrCount. tabCountOf({count:10, videoCount:2, ocrCount:0}, 'photo') = 8.
  it('estimates the topbar count from directory metadata while a bucket month is still unloaded', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.bucketMode = true
    store.buckets = [{ year: 2026, month: 8, count: 10, videoCount: 2, ocrCount: 0 }]
    await flushPromises()
    await w.vm.$nextTick()

    const unloaded = store.months.find((m) => m.key === '2026-08')
    expect(unloaded?.loaded).toBe(false)

    expect(w.findComponent(PhotosToolbar).props('count')).toBe(8)
  })

  it('forwards need-bucket to the store', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    const fetchBucketSpy = vi.spyOn(store, 'fetchBucket').mockResolvedValue(undefined)
    seedUnloadedBucket(store)
    await flushPromises()
    await w.vm.$nextTick()

    await w.findComponent(PhotosGrid).vm.$emit('need-bucket', '2026-08')

    expect(fetchBucketSpy).toHaveBeenCalledWith('2026-08')
  })
})

// A month container has to be observed for anything to happen, and jsdom has no
// IntersectionObserver — so the whole grid/store loop can only be reproduced with
// one installed. Only elements it is actually observing may be notified.
class FakeIO {
  static instances: FakeIO[] = []
  cb: IntersectionObserverCallback
  targets: Element[] = []
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; FakeIO.instances.push(this) }
  observe(el: Element) { this.targets.push(el) }
  unobserve(el: Element) { this.targets = this.targets.filter((t) => t !== el) }
  disconnect() { this.targets = [] }
  takeRecords(): IntersectionObserverEntry[] { return [] }
  fire(el: Element, isIntersecting: boolean) {
    this.cb(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

// R1: the minor-10 "drop the pages if the directory moved under them" guard
// recreated the permanent-skeleton symptom that the level-triggered request exists
// to remove — and on a HEALTHY backend, in the most ordinary flow there is (looking
// at a month while an upload indexes).
//
// The whole loop has to be in one test, because the defect lives between the two
// halves: the emit the directory change produces is swallowed by the store's
// in-flight dedupe (the doomed run is still registered at that instant), and the
// drop path then touches nothing the grid watches — `bucketLoading` is a dependency
// of neither `months` nor `gridMonths`. So the assertion is not "a second request
// was issued" but "the month is loaded in the end".
describe('Photos.vue: a month whose pages are dropped mid-flight still loads (R1)', () => {
  beforeEach(() => {
    FakeIO.instances = []
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO
  })
  afterEach(() => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
  })

  const asset = (id: string) => ({ id, mimeType: 'image/jpeg' })

  // Photos.vue paints once before onMounted's fetchTimeline flips `store.loading`,
  // so the grid is mounted, unmounted by the `v-if`, and mounted again — two
  // observers exist and only the last one is watching anything. Reaching for
  // instances[0] silently tests a disconnected observer (its targets are empty
  // because onBeforeUnmount disconnected it).
  const liveIO = () => FakeIO.instances[FakeIO.instances.length - 1]

  it('recovers when a directory refresh dooms the pages that were already in flight', async () => {
    // The library: one month, ten photos, nothing loaded yet.
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 10, videoCount: 0 },
    ])
    // Every later request answers with the eleven photos the month has AFTER the
    // upload lands; the first one is held open so the refresh can overtake it.
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => asset(`a${i}`)),
    )
    let releaseFirstPage: (v: unknown) => void = () => {}
    svc.photos.getTimelineBucket.mockImplementationOnce(
      () => new Promise((r) => { releaseFirstPage = r }),
    )

    const w = await mountPhotos()
    const store = useTimelineStore()
    expect(store.bucketMode).toBe(true)

    // August scrolls into the window: the grid asks, the store starts paging.
    const group = w.find('#m-2026-08')
    expect(group.exists()).toBe(true)
    expect(liveIO().targets).toContain(group.element) // it really is being watched
    liveIO().fire(group.element, true)
    await flushPromises()
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(1)

    // The 5s index poll notices progress and refreshes the directory while those
    // pages are still in flight: August is 11 now, so the run in flight is doomed.
    svc.photos.getTimelineBuckets.mockResolvedValueOnce([
      { year: 2026, month: 8, count: 11, videoCount: 0 },
    ])
    await store.refreshBuckets()
    await flushPromises()

    // The doomed pages finally arrive and are thrown away.
    releaseFirstPage(Array.from({ length: 10 }, (_, i) => asset(`old${i}`)))
    await flushPromises()
    await flushPromises()

    // Before the fix this stayed at 1 and the month shimmered indefinitely.
    const aug = store.months.find((m) => m.key === '2026-08')
    expect(aug?.loaded).toBe(true)
    expect(aug?.photos.map((p) => p.id)).toEqual(
      Array.from({ length: 11 }, (_, i) => `a${i}`),
    )
    // And the user is looking at tiles, not a skeleton.
    expect(w.findAll('.tile')).toHaveLength(11)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })
})
