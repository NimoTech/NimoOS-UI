// Task 8: 时间线集成——Photos.vue 填充 + socket 任务事件 + 完成 toast + 批量删除。
// Ports the socket connect-resync / task-done semantics from Vue2 NimoOS-UI
// src/views/Photos/PhotosTimeline.vue:78-91 (sockets{connect,'nimoos.photos.task.progress'})
// and :315-335 (mounted: createTaskDoneCoalescer wiring), simplified per
// task-8-brief.md P1 scope cut: non-'index' task types render a generic
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
    // Task 9: Photos.vue 现在真的挂了 <PhotoLightbox>(v-if="lb.open.value" 内部门控,
    // 平时不渲染),但点开一张图会真的触发 useLightbox().openAt → 下列三件套。
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
    recordView: vi.fn().mockResolvedValue(undefined),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    favorite: vi.fn().mockResolvedValue(undefined),
    unfavorite: vi.fn().mockResolvedValue(undefined),
    // Task 9: 选择工具栏/灯箱「加入相册」→ AlbumPickerDialog 真实挂载,内部走
    // usePhotosAlbums()(listAlbums/batchAddToAlbum),不是 stub。
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

const lb = useLightbox()

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

// fix round 1(P7b-T4 评审必修 1):不另建 createI18n(...) 实例——vitest.setup.ts 已把
// src/i18n 的单例装进 config.global.plugins,对每次 mount 生效;这里之前另建的
// createI18n 与它重复安装,刷出一批 `[Vue warn]` component/directive already
// registered。拆掉后 locale 依赖全局单例的 initialLocale() 回落 zh_cn(jsdom 下
// localStorage 无 'lang' 键),下面断言中文文案的用例不受影响。
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

// fix round 1(P7b-T4 必修 2/3):asset() 补上 EXIF 字段(仍然全部可选,原有零参调用
// 如 asset('a') / asset('b', { mimeType: 'video/mp4' }) 不受影响)——供下方
// P7b-T4 EXIF 筛选描述块的夹具使用。
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

// P7b-T4 夹具:两个月份跨两个年份。2023-06 三张(全都命中 years:['2023']),
// 2024-01 两张(全都不命中 —— 筛完整月清空,验证「空月份被丢掉」)。
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
  it('渲染 store.timelineGroups 换算出的月份分组网格', async () => {
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

  it('顶部标题区显示 photosCountSummary(photoCount/videoCount)', async () => {
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

  it('tab 切换(toolbar update:tab)在网格内过滤生效', async () => {
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

  it('批量删除:top PhotosSelectionToolbar delete → store.deleteAssets → photosToast(trash+Undo) → 清空 selected', async () => {
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
  it('选择栏挂载在 .photos-grid-slot 内(与 PhotosGrid 同级),不再是 PhotosToolbar 的上一个兄弟', async () => {
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

  // Task 9: 选择工具栏「加入相册」→ AlbumPickerDialog(open=true, assetIds=已选中)→
  // 选相册项 → service.batchAddToAlbum(albumId, ids) 真被调 → selection 清空(照 Vue2
  // pickAlbum:587-595 结尾 this.selected = [])。
  it('选择工具栏「加入相册」→ picker 打开且 assetIds=已选中;选相册后清空 selection', async () => {
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
    expect(w.find('.selectbar').exists()).toBe(false) // selected 清空 -> 工具栏消失
  })

  it('socket connect → 重同步 fetchTasks/fetchIndexStatus/fetchTimeline', async () => {
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

  it('index 任务 done 转换 → coalescer(2600ms) → notify photosIndexedToast', async () => {
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

  it('非 index 类型任务 done → 通用 "{label} completed" 简版文案', async () => {
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

  it('同一任务重复收到 done 不重复触发 toast(状态未再翻转)', async () => {
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
    expect(showSpy).toHaveBeenCalledTimes(1) // 仍是 1 次,未再入队
  })

  // P8a-T10(P1 挂账,onTaskProgress 头部注释记的已知边界):fetchIndexStatus 的 idle 对账会把
  // done 的 index 任务从 store.tasks 里摘掉;若之后又收到一条迟到的重复 done 事件,旧的
  // `wasDone = store.tasks.find(...).status === 'done'` 判断因为任务已经不在列表里而失效
  // (find 返回 undefined),会把这条迟到事件误判成"第一次看到",再次 toast。
  it('P8a-T10:index 任务被 idle 对账摘除后,迟到的重复 done 事件不二次 toast', async () => {
    vi.useFakeTimers()
    await mountPhotos()
    const store = useTimelineStore()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const progress = handlerFor('nimoos.photos.task.progress')
    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1)

    // 复现 timeline.ts fetchIndexStatus 的 idle 对账效果(:118-120):直接把这条任务从列表摘掉。
    store.tasks = store.tasks.filter((t) => t.id !== 't1')

    progress(undefined, { id: 't1', type: 'index', status: 'done', current: 5, total: 5 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(showSpy).toHaveBeenCalledTimes(1) // 仍是 1 次——不能因为任务已被摘除就二次宣布
  })

  it('unmount 时取消 coalescer 的挂起计时器与 socket 订阅', async () => {
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

  // P1 时是空 handler;P2(Task 9)起真的接了灯箱 —— 细节(翻页集按 tab 过滤/删除/toast)
  // 见专门的 Photos.lightbox.test.ts,这里只做冒烟:点开不炸、灯箱状态确实翻转。
  it('点开一张图 → 灯箱打开(P2 已接线)', async () => {
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

// SP7-P7a-T16: 顶部搜索框恒显示,提交非空词 → 跳转 /photos/search(结构规格 22)。
// Task 4(顶栏重刻):搜索框从独立的 `<PhotosSearchBar>` 挪进了 `<PhotosTopbar>` 内的
// `.topbar .search`(Vue2 topbar 原生结构),选择器同步改为 `.topbar .search input`——
// 非空词提交/路由跳转的逻辑本身(onSearchSubmit)没有变,只是发出提交事件的组件变了。
// fix round 1(owner 裁决 ledger-六-2):空串 Enter 的行为改了——PhotosTopbar 现在照 Vue2
// submitSearch 的空串守卫,空串不 emit,onSearchSubmit 压根不会被调,见下方最后一例。
describe('Photos.vue 搜索框接线(T16;Task 4 起接线对象是 PhotosTopbar)', () => {
  it('顶部渲染 PhotosTopbar 的搜索框(.topbar .search input)', async () => {
    const w = await mountPhotos()
    expect(w.find('.topbar .search input').exists()).toBe(true)
  })

  it('提交非空词 → router.push 到 /photos/search 带 q', async () => {
    const w = await mountPhotos()
    const router = w.vm.$router
    const pushSpy = vi.spyOn(router, 'push')
    await w.get('.topbar .search input').setValue('sunset')
    await w.get('.topbar .search input').trigger('keydown.enter')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'sunset' } })
  })

  // fix round 1 · Important(owner 裁决 ledger-六-2,覆盖第一版"提交空串仍导航"的选择):
  // 时间线顶栏空串 Enter = 无动作,不再跳转——PhotosTopbar 组件层已经不 emit
  // search-submit,onSearchSubmit 根本不会被调用,router.push 完全没被调过。
  it('提交空串 → 不跳转(ledger-六-2,PhotosTopbar 空串不 emit)', async () => {
    const w = await mountPhotos()
    const router = w.vm.$router
    const pushSpy = vi.spyOn(router, 'push')
    await w.get('.topbar .search input').trigger('keydown.enter')
    expect(pushSpy).not.toHaveBeenCalled()
  })
})

// Task 4:折叠按钮从 T3 遗留的"无入口"状态(见 task-3-report.md Concerns#4)真正接上——
// 点击顶栏的折叠 icon-btn → Photos.vue 的 `collapsed` ref 翻转 → `.app[data-collapsed]`
// 跟着变(Vue2 PhotosTimeline.vue:965 `@toggle="collapsed = !collapsed"`同款)。
describe('Photos.vue 折叠按钮接线(Task 4)', () => {
  it('点击顶栏折叠按钮 → .app[data-collapsed] 翻转', async () => {
    // 初始值不锚定具体的 'true'/'false'(取决于 localStorage 持久化态,本文件其它用例
    // 不清 localStorage,跨用例可能被前一个用例写脏)——只锚定"点一次必翻一次"。
    const w = await mountPhotos()
    const app = w.get('.app')
    const before = app.attributes('data-collapsed')
    await w.get('.topbar .icon-btn').trigger('click')
    expect(app.attributes('data-collapsed')).toBe(before === 'true' ? 'false' : 'true')
    await w.get('.topbar .icon-btn').trigger('click')
    expect(app.attributes('data-collapsed')).toBe(before)
  })
})

// SP7-P7b-T4: 时间线页 EXIF 筛选接线——FilterBar 挂进 PhotosToolbar#after-tabs,
// 三处同源逻辑(gridMonths 网格数据源 / filteredCount 顶栏计数 / onOpenTile 灯箱翻页集)
// 全部改用 EXIF 筛后的月份集合;FilterBar 自身的 facet 源 (:photos) 恒取全库
// store.allPhotos,不随 gridMonths 收窄——照 Vue2 PhotosTimeline.vue facet 源是
// displayMonths 而非过滤后的 gridMonths 同一约束。
// fix round 1(评审必修 1):原先并行新建的 Photos.test.ts 已并入本文件,复用本文件
// 现成的 mountPhotos()/svc mock 脚手架,不再另起一套。
describe('P7b-T4: EXIF 筛选接线', () => {
  it('工具栏 after-tabs 槽位里挂着 PhotosFilterBar', async () => {
    const w = await mountPhotos()
    expect(w.findComponent(PhotosFilterBar).exists()).toBe(true)
  })

  it('FilterBar 的 facet 源是全库 allPhotos,不随已生效的筛选收窄', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    seedTimeline(store)
    await flushPromises()
    await w.vm.$nextTick()

    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    expect(before).toBe(5) // 全库:2023-06 三张 + 2024-01 两张

    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()

    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  it('筛选生效后网格只拿到命中的照片,且空月份被丢掉', async () => {
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
    // 2024-01 整月不命中 years:['2023'],月份本身应被丢掉——只剩 2023-06 一个月。
    expect(months).toHaveLength(1)
    expect(months.every((m) => m.photos.length > 0)).toBe(true)
    // 2023-06 三张全命中(它们的 takenAt 都在 2023 年),2024-01 的两张全部消失。
    expect(months.flatMap((m) => m.photos)).toHaveLength(3)
  })

  it('D20:顶栏计数跟着 EXIF 筛选减', async () => {
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

  // fix round 1(评审必修 2):锁住 onOpenTile 翻页集必须用 gridMonths(EXIF 筛后)而
  // 不是 store.months——否则灯箱能翻到被筛掉的照片。变异验证见 task-4-report.md。
  it('筛选生效后点开一张图 → 灯箱翻页集同样只含命中的照片(与网格同源)', async () => {
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

  // fix round 1(评审必修 3):补 cameras 维度的贯通(此前四条都只筛 years)——
  // camera 值形如 "Sony · A7",过滤谓词按 split('·')[0].trim() 匹配。
  it('cameras 维度贯通:按 make·model 拆分匹配,命中月份保留、不命中月份被丢掉', async () => {
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
    // 只有 2024-01(Sony · A7)命中,2023-06(Canon · EOS R5)被丢掉。
    expect(months).toHaveLength(1)
    const ids = months.flatMap((m) => m.photos).map((p) => p.id)
    expect(ids.sort()).toEqual(['b1', 'b2'])
  })
})
