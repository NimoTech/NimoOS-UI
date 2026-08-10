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
import { useTimelineStore } from '../../photos/stores/timeline'

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
  busOn.mockClear()
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
  store.buckets = [{ year: 2026, month: 8, count: 10, videoCount: 2 }]
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
