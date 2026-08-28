// Timeline integration — Photos.vue populated data + socket task events + completion toast + batch delete.
// Ports the socket connect-resync / task-done semantics from the Vue 2 page's
// src/views/Photos/PhotosTimeline.vue:78-91 (sockets{connect,'nimoos.photos.task.progress'})
// and :315-335 (mounted: createTaskDoneCoalescer wiring), simplified as a scope cut:
// non-'index' task types render a generic
// `{label} completed` toast (photosTaskCompletedToast) instead of Vue2's
// per-type messages (face/embedding), and there is no 5s pre-removal delay —
// a status:'done' transition observed at ingest time goes straight into the
// coalescer.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
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
    // Task 9: Photos.vue now really mounts <PhotoLightbox> (gated internally by
    // v-if="lb.open.value", normally not rendered), but opening a photo really triggers
    // useLightbox().openAt -> the three calls below.
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    recordView: vi.fn().mockResolvedValue(undefined),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    // Task 9: selection toolbar / lightbox "add to album" -> AlbumPickerDialog is really
    // mounted, going through usePhotosAlbums() internally (listAlbums/batchAddToAlbum), not a stub.
    listAlbums: vi.fn().mockResolvedValue([]),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
    // Task 8: delete-toast Undo restores through the trash store's real
    // restore() action (restoreTrashBatch + fetchTrash + refresh timeline) —
    // not a spy-replaced no-op — so the wiring exercises the same path a
    // browser would.
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    listTrash: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// useMessageBus opens a real socket.io connection (see Home.integration.test.ts's
// precedent) — mock it and capture registered (event, handler) pairs so tests can
// invoke handlers directly to simulate socket traffic.
const busOn = vi.hoisted(() => vi.fn((_event: string, _cb: (...a: unknown[]) => void) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import Photos from '../Photos.vue'
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import PhotosGrid from '../../photos/components/PhotosGrid.vue'
import PhotosToolbar from '../../photos/components/PhotosToolbar.vue'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'
import { usePhotosToast } from '../../photos/composables/usePhotosToast'
import { useLightbox } from '../../photos/lightbox/useLightbox'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../composables/useSidebarDrawer'

const lb = useLightbox()

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

// fix round 1 (P7b-T4 review-mandatory fix 1): don't build a separate createI18n(...)
// instance — vitest.setup.ts already installs the singleton from src/i18n into
// config.global.plugins, which applies to every mount; the separately built createI18n
// here duplicated that install, flooding output with `[Vue warn]` component/directive
// already registered. After removing it, locale falls back through the global singleton's
// initialLocale() to zh_cn (under jsdom, localStorage has no 'lang' key) — the cases below
// asserting on Chinese copy are unaffected.
async function mountPhotos() {
  const router = makeRouter()
  router.push('/photos')
  await router.isReady()
  const w = mount(Photos, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

function handlerFor(event: string): (props: unknown, raw: unknown) => void {
  const call = [...busOn.mock.calls].reverse().find((c) => c[0] === event)
  if (!call) throw new Error(`no handler registered for ${event}`)
  return call[1] as (props: unknown, raw: unknown) => void
}

// fix round 1 (P7b-T4 mandatory fix 2/3): asset() gets EXIF fields added (still all
// optional, so existing calls with no extra args like asset('a') / asset('b', { mimeType:
// 'video/mp4' }) are unaffected) — for use by the fixtures in the P7b-T4 EXIF filtering
// describe block below.
function asset(
  id: string,
  opts: Partial<{ mimeType: string; takenAt: string; placeName: string; make: string; model: string }> = {},
) {
  return {
    id,
    mimeType: opts.mimeType || 'image/jpeg',
    originalName: `${id}.jpg`,
    takenAt: opts.takenAt,
    placeName: opts.placeName,
    make: opts.make,
    model: opts.model,
  }
}

// P7b-T4 fixture: two months spanning two years. 2023-06 has three (all match
// years:['2023']), 2024-01 has two (none match — the whole month gets emptied by the
// filter, verifying that "empty months get dropped").
function seedTimeline(store: ReturnType<typeof useTimelineStore>) {
  store.timelineGroups = [
    {
      year: 2023,
      month: 6,
      assets: [
        asset('a1', { takenAt: '2023-06-01T10:00:00Z', placeName: 'Paris, France', make: 'Canon', model: 'EOS R5' }),
        asset('a2', { takenAt: '2023-06-15T10:00:00Z', placeName: 'Paris, France', make: 'Canon', model: 'EOS R5' }),
        asset('a3', { takenAt: '2023-06-20T10:00:00Z', placeName: 'Paris, France', make: 'Canon', model: 'EOS R5' }),
      ],
    },
    {
      year: 2024,
      month: 1,
      assets: [
        asset('b1', { takenAt: '2024-01-05T10:00:00Z', placeName: 'Tokyo, Japan', make: 'Sony', model: 'A7' }),
        asset('b2', { takenAt: '2024-01-20T10:00:00Z', placeName: 'Tokyo, Japan', make: 'Sony', model: 'A7' }),
      ],
    },
  ]
}

beforeEach(() => {
  setActivePinia(createPinia())
  busOn.mockClear()
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.getStatus.mockClear().mockResolvedValue({})
  svc.photos.listTasks.mockClear().mockResolvedValue({ tasks: [] })
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.listTrash.mockClear().mockResolvedValue([])
  lb.__resetForTest()
  usePhotosToast().__resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('Photos.vue integration', () => {
  it('renders the month-grouped grid computed from store.timelineGroups', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [asset('a'), asset('b')] },
      { year: 2026, month: 6, assets: [asset('c')] },
    ]
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findAll('.month-group')).toHaveLength(2)
    expect(w.text()).toContain('July 2026')
    expect(w.text()).toContain('June 2026')
  })

  it('the header title area shows photosCountSummary (photoCount/videoCount)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [asset('a'), asset('b', { mimeType: 'video/mp4' })] },
    ]
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.text()).toContain('1 张照片')
    expect(w.text()).toContain('1 个视频')
  })

  it('tab switching (toolbar update:tab) takes effect as filtering inside the grid', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [asset('a'), asset('b', { mimeType: 'video/mp4' })] },
    ]
    await flushPromises()
    await w.vm.$nextTick()
    // Default tab is 'photo' (Fix 4, aligned with Vue2 PhotosTimeline default) —
    // only the non-video, non-OCR asset ('a') matches initially.
    expect(w.findAll('.tile')).toHaveLength(1)

    await w.find('.tab[data-active]').exists() // sanity: toolbar rendered
    const videoTab = w.findAll('.tab').find((btn) => btn.text() === '视频')
    expect(videoTab).toBeTruthy()
    await videoTab!.trigger('click')
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)

    const allTab = w.findAll('.tab').find((btn) => btn.text() === '全部')
    expect(allTab).toBeTruthy()
    await allTab!.trigger('click')
    await w.vm.$nextTick()
    expect(w.findAll('.tile')).toHaveLength(2)
  })

  it('batch delete: top PhotosSelectionToolbar delete -> store.deleteAssets -> photosToast(trash+Undo) -> selected cleared', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    const photosToast = usePhotosToast()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(2)
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a'), asset('b')] }]
    await flushPromises()
    await w.vm.$nextTick()

    // Selection toolbar absent until something is selected.
    expect(w.find('.selectbar').exists()).toBe(false)

    // Select both tiles via Vue2's click-to-toggle checkbox div (Task 6 re-skin).
    const checkboxes = w.findAll('.tile-checkbox')
    expect(checkboxes).toHaveLength(2)
    await checkboxes[0].trigger('click')
    await checkboxes[1].trigger('click')
    await w.vm.$nextTick()

    // Task 7 (D19): bar is now the Vue2 floating glass pill (`.selectbar`), anchored
    // absolute over the grid slot instead of Files' rectangular top bar.
    const bar = w.find('.selectbar')
    expect(bar.exists()).toBe(true)
    const deleteBtn = bar.find('[data-test="selectbar-delete"]')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.attributes('data-danger')).toBe('true')
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith(['a', 'b'])
    expect(w.find('.selectbar').exists()).toBe(false) // selected cleared -> bar gone

    // Task 8: delete toast is the Photos-private usePhotosToast (not the global
    // app toast) — icon 'trash', Undo action present. Vue2 parity:
    // PhotosTimeline.vue:704-718.
    expect(photosToast.toasts.value).toHaveLength(1)
    const toastItem = photosToast.toasts.value[0]
    expect(toastItem.icon).toBe('trash')
    expect(toastItem.text).toContain('2')
    expect(toastItem.action?.label).toBeTruthy()

    // Undo → clicking the toast's action button (PhotosToastHost Teleports to
    // the real document.body regardless of this wrapper's own attachment)
    // restores through the trash store's real restore() action, which
    // refetches the timeline so the restored assets come back into view —
    // and it does NOT show a second toast (Vue2 parity: Undo's onClick only
    // dispatches photos/restoreTrash, no follow-up toast).
    const fetchTimelineSpy = vi.spyOn(store, 'fetchTimeline')
    const body = new DOMWrapper(document.body)
    const undoBtn = body.find('[data-role="photos-toast-action"]')
    expect(undoBtn.exists()).toBe(true)
    await undoBtn.trigger('click')
    await flushPromises()

    expect(svc.photos.restoreTrashBatch).toHaveBeenCalledWith(['a', 'b'])
    expect(fetchTimelineSpy).toHaveBeenCalled()
    expect(photosToast.toasts.value).toHaveLength(0)
  })

  // Task 7 (D19): the selectbar's mount point moved from being PhotosToolbar's preceding
  // sibling (P1 layout) to living INSIDE `.photos-grid-slot`, as a sibling of PhotosGrid's
  // `.content` root — Vue2 pixel parity floats `.selectbar` (position:absolute, top:50px)
  // over the grid/scrubber area it belongs to, not over the toolbar row above it.
  it('the selection bar mounts inside .photos-grid-slot (as a sibling of PhotosGrid), no longer a preceding sibling of PhotosToolbar', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()

    await w.get('.tile-checkbox').trigger('click')
    await w.vm.$nextTick()

    const slot = w.find('.photos-grid-slot')
    expect(slot.exists()).toBe(true)
    expect(slot.find('.selectbar').exists()).toBe(true)
    expect(slot.find('.content').exists()).toBe(true) // PhotosGrid's root, still a sibling

    // Not a descendant of PhotosToolbar (`.toolbar`) — it lives in the grid slot instead.
    const toolbar = w.find('.toolbar')
    expect(toolbar.exists()).toBe(true)
    expect(toolbar.find('.selectbar').exists()).toBe(false)

    // Close (x) button in the pill cancels the selection.
    await w.get('[data-test="selectbar-close"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.selectbar').exists()).toBe(false)
  })

  // Task 9: selection toolbar "add to album" -> AlbumPickerDialog (open=true,
  // assetIds=selected) -> picking an album item -> service.batchAddToAlbum(albumId, ids) is
  // really called -> selection cleared (following Vue2 pickAlbum:587-595's ending
  // this.selected = []).
  it('selection toolbar "add to album" -> picker opens with assetIds=selected; clears selection after picking an album', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 1, name: 'Trip', assetCount: 0 }])
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a'), asset('b')] }]
    await flushPromises()
    await w.vm.$nextTick()

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
    expect(item.exists()).toBe(true)
    await item.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(1, ['a', 'b'])
    expect(w.find('.selectbar').exists()).toBe(false) // selected cleared -> toolbar disappears
  })

  it('socket connect -> resync fetchTasks/fetchIndexStatus/fetchTimeline', async () => {
    await mountPhotos()
    const store = useTimelineStore()
    const fetchTasks = vi.spyOn(store, 'fetchTasks').mockResolvedValue(undefined)
    const fetchIndexStatus = vi.spyOn(store, 'fetchIndexStatus').mockResolvedValue(undefined)
    const fetchTimeline = vi.spyOn(store, 'fetchTimeline').mockResolvedValue(undefined)

    handlerFor('connect')(undefined, undefined)

    expect(fetchTasks).toHaveBeenCalledTimes(1)
    expect(fetchIndexStatus).toHaveBeenCalledTimes(1)
    expect(fetchTimeline).toHaveBeenCalledTimes(1)
  })

  it('socket task.progress → store.ingestTaskBus(evt)', async () => {
    await mountPhotos()
    const store = useTimelineStore()
    const ingestSpy = vi.spyOn(store, 'ingestTaskBus')

    const raw = { Properties: { id: 't1', type: 'index', status: 'running', current: '3', total: '10' } }
    handlerFor('nimoos.photos.task.progress')(raw.Properties, raw)

    expect(ingestSpy).toHaveBeenCalledWith(raw)
  })

  it('index task done transition -> coalescer(2600ms) -> notify photosIndexedToast', async () => {
    vi.useFakeTimers()
    const w = await mountPhotos()
    const store = useTimelineStore()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const progress = handlerFor('nimoos.photos.task.progress')
    progress(undefined, { id: 't1', type: 'index', status: 'running', current: 3, total: 10 })
    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 10, total: 10 })

    expect(showSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy.mock.calls[0][0]).toContain('10')
    void w
  })

  it('non-index task type done -> generic "{label} completed" simplified copy', async () => {
    vi.useFakeTimers()
    await mountPhotos()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const progress = handlerFor('nimoos.photos.task.progress')
    progress(undefined, { id: 'f1', type: 'face', label: 'Face scan', status: 'running' })
    progress(undefined, { id: 'f1', type: 'face', label: 'Face scan', status: 'done' })

    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy.mock.calls[0][0]).toContain('Face scan')
  })

  it('receiving done for the same task again does not re-trigger a toast (state hasn\'t flipped again)', async () => {
    vi.useFakeTimers()
    await mountPhotos()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const progress = handlerFor('nimoos.photos.task.progress')
    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1)

    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1) // still 1 call, not re-enqueued
  })

  // P8a-T10 (a P1 ledger item, a known edge case recorded in onTaskProgress's header
  // comment): fetchIndexStatus's idle reconciliation strips done index tasks out of
  // store.tasks; if a late duplicate done event arrives afterward, the old
  // `wasDone = store.tasks.find(...).status === 'done'` check breaks because the task is no
  // longer in the list (find returns undefined), misjudging the late event as "seen for the
  // first time" and toasting again.
  it('P8a-T10: after an index task is stripped by idle reconciliation, a late duplicate done event doesn\'t toast a second time', async () => {
    vi.useFakeTimers()
    await mountPhotos()
    const store = useTimelineStore()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const progress = handlerFor('nimoos.photos.task.progress')
    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1)

    // Reproduce timeline.ts fetchIndexStatus's idle reconciliation effect (:118-120): directly strip this task out of the list.
    store.tasks = store.tasks.filter((t) => t.id !== 't1')

    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1) // still 1 call — the task being stripped shouldn't cause a second announcement
  })

  it('cancels the coalescer\'s pending timer and the socket subscription on unmount', async () => {
    vi.useFakeTimers()
    const w = await mountPhotos()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const progress = handlerFor('nimoos.photos.task.progress')
    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    w.unmount()
    await vi.advanceTimersByTimeAsync(3000)
    expect(showSpy).not.toHaveBeenCalled()
  })

  // Was an empty handler at P1; really wired up the lightbox starting at P2 (Task 9) — see
  // the dedicated Photos.lightbox.test.ts for details (paging set filtered by tab/delete/
  // toast), this is just a smoke test: opening a photo doesn't blow up, lightbox state
  // really flips.
  it('opening a photo -> lightbox opens (wired up at P2)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()
    const tile = w.find('.tile')
    expect(tile.exists()).toBe(true)
    await expect(tile.trigger('click')).resolves.not.toThrow()
    await flushPromises()
    expect(lb.open.value).toBe(true)
  })
})

// SP7-P7a-T16: the top search box always shows; submitting a non-empty term -> navigates
// to /photos/search (structural spec 22).
// Task 4 (topbar rewrite): the search box moved out of a standalone `<PhotosSearchBar>` and
// into `.topbar .search` inside `<PhotosTopbar>` (Vue2's native topbar structure); the
// selector was updated to `.topbar .search input` accordingly — the non-empty-term
// submit/route-navigation logic itself (onSearchSubmit) hasn't changed, only the component
// that emits the submit event has.
// fix round 1 (owner ruling ledger-六-2): the behavior for an empty-string Enter changed —
// PhotosTopbar now follows Vue2 submitSearch's empty-string guard, doesn't emit on an empty
// string, so onSearchSubmit never gets called at all, see the last case below.
describe('Photos.vue search box wiring (T16; wiring target since Task 4 is PhotosTopbar)', () => {
  it('the top renders PhotosTopbar\'s search box (.topbar .search input)', async () => {
    const w = await mountPhotos()
    expect(w.find('.topbar .search input').exists()).toBe(true)
  })

  it('submitting a non-empty term -> router.push to /photos/search with q', async () => {
    const w = await mountPhotos()
    const router = w.vm.$router
    const pushSpy = vi.spyOn(router, 'push')
    await w.get('.topbar .search input').setValue('sunset')
    await w.get('.topbar .search input').trigger('keydown.enter')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'sunset' } })
  })

  // fix round 1 · Important (owner ruling ledger-六-2, overriding the first version's choice
  // to "still navigate on empty-string submit"): the timeline topbar's empty-string Enter =
  // no action, no longer navigates — the PhotosTopbar component layer no longer emits
  // search-submit, so onSearchSubmit never gets called, router.push is never called at all.
  it('submitting an empty string -> doesn\'t navigate (ledger-六-2, PhotosTopbar doesn\'t emit on empty string)', async () => {
    const w = await mountPhotos()
    const router = w.vm.$router
    const pushSpy = vi.spyOn(router, 'push')
    await w.get('.topbar .search input').trigger('keydown.enter')
    expect(pushSpy).not.toHaveBeenCalled()
  })
})

// Task 4: the collapse button, left over from T3 as a "no entry point" state (see
// task-3-report.md Concerns#4), is really wired up now — clicking the topbar's collapse
// icon-btn -> flips Photos.vue's `collapsed` ref -> `.app[data-collapsed]` follows along
// (matching Vue2 PhotosTimeline.vue:965's `@toggle="collapsed = !collapsed"`).
describe('Photos.vue collapse button wiring (Task 4)', () => {
  it('clicking the topbar collapse button -> .app[data-collapsed] flips', async () => {
    // The initial value isn't pinned to a specific 'true'/'false' (it depends on the
    // localStorage-persisted state, and other cases in this file don't clear localStorage,
    // so it could be left dirty by a previous case across cases) — only pin "must flip once per click".
    const w = await mountPhotos()
    const app = w.get('.app')
    const before = app.attributes('data-collapsed')
    await w.get('.topbar .icon-btn').trigger('click')
    expect(app.attributes('data-collapsed')).toBe(before === 'true' ? 'false' : 'true')
    await w.get('.topbar .icon-btn').trigger('click')
    expect(app.attributes('data-collapsed')).toBe(before)
  })
})

// final-review fix (item 6): on a ≤768px narrow viewport, PhotosSidebar switches into its
// fixed 'is-drawer' mode (position:fixed, out of the `.app` grid flow) via the module-
// singleton useSidebarDrawer() it shares with this file. Task 3's shell rewrite dropped
// the old AreaShell hamburger that used to open/close that drawer and left the topbar's
// panelLeft button wired only to `collapsed` (Task 4) — a flag the drawer's own isNarrow/
// open state never reads, so on mobile there was no way to open the sidebar at all. Fix:
// route the same button to the drawer's toggle() when isNarrow is true.
describe('Photos.vue collapse button wiring — narrow screens go through the drawer (final-review fix item 6)', () => {
  afterEach(() => { __resetSidebarDrawerForTest() })

  it('narrow screen (isNarrow=true): clicking the topbar button opens the drawer, doesn\'t touch .app[data-collapsed]', async () => {
    const drawer = useSidebarDrawer()
    drawer.isNarrow.value = true
    const w = await mountPhotos()
    const app = w.get('.app')
    const before = app.attributes('data-collapsed')
    expect(drawer.open.value).toBe(false)
    await w.get('.topbar .icon-btn').trigger('click')
    expect(drawer.open.value).toBe(true)
    expect(w.get('aside.sidebar').classes()).toContain('is-open')
    expect(app.attributes('data-collapsed')).toBe(before)
  })

  it('desktop state (isNarrow=false): clicking the topbar button still goes through the collapsed flip, doesn\'t touch the drawer', async () => {
    const drawer = useSidebarDrawer()
    drawer.isNarrow.value = false
    const w = await mountPhotos()
    const app = w.get('.app')
    const before = app.attributes('data-collapsed')
    await w.get('.topbar .icon-btn').trigger('click')
    expect(app.attributes('data-collapsed')).toBe(before === 'true' ? 'false' : 'true')
    expect(drawer.open.value).toBe(false)
  })
})

// SP7-P7b-T4: timeline page EXIF filtering wiring — FilterBar mounts into
// PhotosToolbar#after-tabs; three same-source logic paths (gridMonths grid data source /
// filteredCount header count / onOpenTile lightbox paging set) all switch to the
// EXIF-filtered month set; FilterBar's own facet source (:photos) always takes the
// full-library store.allPhotos, not narrowed by gridMonths — matching the same constraint
// as Vue2 PhotosTimeline.vue, whose facet source is displayMonths rather than the filtered
// gridMonths.
// fix round 1 (review-mandatory fix 1): the Photos.test.ts previously created in parallel
// has been merged into this file, reusing this file's existing mountPhotos()/svc mock
// scaffolding instead of starting a separate one.
describe('P7b-T4: EXIF filtering wiring', () => {
  it('PhotosFilterBar is mounted in the toolbar after-tabs slot', async () => {
    const w = await mountPhotos()
    expect(w.findComponent(PhotosFilterBar).exists()).toBe(true)
  })

  it('FilterBar facet source is the full-library allPhotos, not narrowed by the active filter', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    expect(before).toBe(5) // full library: three in 2023-06 + two in 2024-01

    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()

    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  it('once the filter takes effect the grid only gets matching photos, and empty months are dropped', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] },
    )
    await w.vm.$nextTick()

    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    // The whole 2024-01 month doesn't match years:['2023'], so the month itself should be
    // dropped — leaving only the 2023-06 month.
    expect(months).toHaveLength(1)
    expect(months.every((m) => m.photos.length > 0)).toBe(true)
    // All three in 2023-06 match (their takenAt is all in 2023), and both in 2024-01 disappear.
    expect(months.flatMap((m) => m.photos)).toHaveLength(3)
  })

  it('D20: header count decreases along with the EXIF filter', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    const countBefore = w.findComponent(PhotosToolbar).props('count') as number
    expect(countBefore).toBe(5)

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] },
    )
    await w.vm.$nextTick()

    const countAfter = w.findComponent(PhotosToolbar).props('count') as number
    expect(countAfter).toBeLessThan(countBefore)
    expect(countAfter).toBe(3)
  })

  // fix round 1 (review-mandatory fix 2): pin down that onOpenTile's paging set must use
  // gridMonths (EXIF-filtered), not store.months — otherwise the lightbox can page to
  // photos that were filtered out. See task-4-report.md for the mutation verification.
  it('once the filter takes effect, opening a photo -> the lightbox paging set also only contains matching photos (same source as the grid)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] },
    )
    await w.vm.$nextTick()

    const tile = w.find('.tile')
    expect(tile.exists()).toBe(true)
    await tile.trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(3)
    const ids = lb.list.value.map((p) => p.id)
    expect(ids).not.toContain('b1')
    expect(ids).not.toContain('b2')
  })

  // fix round 1 (review-mandatory fix 3): add end-to-end coverage for the cameras dimension
  // (the previous four cases only filtered on years) — the camera value looks like
  // "Sony · A7", and the filter predicate matches on split('·')[0].trim().
  it('cameras dimension end-to-end: matches by splitting make·model, matching months are kept and non-matching months are dropped', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: [], places: [], cameras: ['Sony'] },
    )
    await w.vm.$nextTick()

    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: Array<{ id: string }> }>
    // Only 2024-01 (Sony · A7) matches; 2023-06 (Canon · EOS R5) is dropped.
    expect(months).toHaveLength(1)
    const ids = months.flatMap((m) => m.photos).map((p) => p.id)
    expect(ids.sort()).toEqual(['b1', 'b2'])
  })
})
