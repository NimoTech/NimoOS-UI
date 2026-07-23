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
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

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
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// useMessageBus opens a real socket.io connection (see Home.integration.test.ts's
// precedent) — mock it and capture registered (event, handler) pairs so tests can
// invoke handlers directly to simulate socket traffic.
const busOn = vi.hoisted(() => vi.fn((_event: string, _cb: (...a: unknown[]) => void) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import Photos from '../Photos.vue'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const lb = useLightbox()

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

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
  const w = mount(Photos, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return w
}

function handlerFor(event: string): (props: unknown, raw: unknown) => void {
  const call = [...busOn.mock.calls].reverse().find((c) => c[0] === event)
  if (!call) throw new Error(`no handler registered for ${event}`)
  return call[1] as (props: unknown, raw: unknown) => void
}

function asset(id: string, opts: Partial<{ mimeType: string }> = {}) {
  return { id, mimeType: opts.mimeType || 'image/jpeg', originalName: `${id}.jpg` }
}

beforeEach(() => {
  setActivePinia(createPinia())
  busOn.mockClear()
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.getStatus.mockClear().mockResolvedValue({})
  svc.photos.listTasks.mockClear().mockResolvedValue({ tasks: [] })
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  lb.__resetForTest()
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

  it('批量删除:top PhotosSelectionToolbar delete → store.deleteAssets → notify photosDeletedToast → 清空 selected', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    const toast = useToast()
    const deleteSpy = vi.spyOn(store, 'deleteAssets').mockResolvedValue(2)
    const showSpy = vi.spyOn(toast, 'show')
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a'), asset('b')] }]
    await flushPromises()
    await w.vm.$nextTick()

    // Selection toolbar absent until something is selected.
    expect(w.find('.selection-toolbar').exists()).toBe(false)

    // Select both tiles via their native checkbox (Files-region pattern, P1 restyle).
    const checkboxes = w.findAll('.tile-check-box')
    expect(checkboxes).toHaveLength(2)
    await checkboxes[0].trigger('change')
    await checkboxes[1].trigger('change')
    await w.vm.$nextTick()

    // Bar now lives at the TOP of the content, styled like Files' SelectionToolbar.
    const bar = w.find('.selection-toolbar')
    expect(bar.exists()).toBe(true)
    const deleteBtn = bar.find('.sel-delete')
    expect(deleteBtn.exists()).toBe(true)
    expect(deleteBtn.classes()).toContain('danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith(['a', 'b'])
    // 4000ms duration (Fix 7, aligned with Vue2's delete/task-done toast duration).
    expect(showSpy).toHaveBeenCalledWith(expect.stringContaining('2'), 4000)
    expect(w.find('.selection-toolbar').exists()).toBe(false) // selected cleared -> bar gone
  })

  it('顶部选择栏出现在 PhotosToolbar 之上(DOM 顺序)', async () => {
    const w = await mountPhotos()
    const store = useTimelineStore()
    store.timelineGroups = [{ year: 2026, month: 7, assets: [asset('a')] }]
    await flushPromises()
    await w.vm.$nextTick()

    await w.get('.tile-check-box').trigger('change')
    await w.vm.$nextTick()

    const main = w.find('.photos-main')
    const html = main.html()
    const barIdx = html.indexOf('selection-toolbar')
    const toolbarIdx = html.indexOf('photos-toolbar')
    expect(barIdx).toBeGreaterThan(-1)
    expect(toolbarIdx).toBeGreaterThan(-1)
    expect(barIdx).toBeLessThan(toolbarIdx)

    // Clear button in the top bar cancels the selection.
    await w.get('.sel-clear').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.selection-toolbar').exists()).toBe(false)
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
