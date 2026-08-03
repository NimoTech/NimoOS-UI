// SP7-P8a-T4: PhotosAiCard.vue —— 设置页 AI 卡。
// 回源坐标见 task-4-brief.md;Vue2 PhotosSettings.vue:129-192(模板)/:283-291(watcher)/
// :332-370(computed)/:458-486(rebuildIndex/doRecluster)。
//
// 测试基建沿用 T3(PhotosStorageCard.test.ts)已验证过的既定做法(brief 草稿引用的
// @pinia/testing / winningDeclaration 均不存在于本仓,详见该文件头注释):
// - setActivePinia(createPinia()) 起真实 store,vi.spyOn(store, 'action') 按需 stub。
// - mock 的是共享包 @nimotech/nimoos-service,不是 store 本身。
// - hover 级联守卫用 cssCascade.ts 的 extractStyleBlock/winningHoverBackground。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getStorage: vi.fn(),
      getAbout: vi.fn(),
      pruneCache: vi.fn(),
      rebuildIndex: vi.fn(),
      triggerScan: vi.fn(),
      reclusterFaces: vi.fn(),
      getTimeline: vi.fn(),
      getStatus: vi.fn(),
      listTasks: vi.fn(),
    },
  },
}))

import PhotosAiCard from '../PhotosAiCard.vue'
import photosAiCardRaw from '../PhotosAiCard.vue?raw'
import { usePhotosSettingsStore } from '../../stores/settings'
import { useTimelineStore } from '../../stores/timeline'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'
import type { TaskBusPayload } from '../../util/taskBus'

function mountCard() {
  const wrapper = mount(PhotosAiCard)
  const store = usePhotosSettingsStore()
  const timeline = useTimelineStore()
  return { wrapper, store, timeline }
}

function rebuildTaskFixture(overrides: Partial<TaskBusPayload> = {}): TaskBusPayload {
  return { id: 'rb-1', type: 'rebuild', status: 'running', progress: 0, ...overrides }
}

describe('PhotosAiCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('4 个开关顺序固定 faces→scenes→ocr→smartview(Vue2 :363-369)', () => {
    const { wrapper } = mountCard()
    const switches = wrapper.findAll('[data-test^="ai-switch-"]')
    expect(switches.map(s => s.attributes('data-test'))).toEqual([
      'ai-switch-faces', 'ai-switch-scenes', 'ai-switch-ocr', 'ai-switch-smartview',
    ])
  })

  it('点开关调 setAiFeature(id, 新值);失败时 emit toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setAiFeature').mockResolvedValue(false)
    store.aiFeatures.faces = true
    await nextTick()
    await wrapper.get('[data-test="ai-switch-faces"]').trigger('click')
    expect(store.setAiFeature).toHaveBeenCalledWith('faces', false)
    await flushPromises()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toBeTruthy()
    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
  })

  it('点开关成功不 emit toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setAiFeature').mockResolvedValue(true)
    store.aiFeatures.scenes = true
    await nextTick()
    await wrapper.get('[data-test="ai-switch-scenes"]').trigger('click')
    expect(store.setAiFeature).toHaveBeenCalledWith('scenes', false)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeFalsy()
  })

  it('indexedPct 把后端 0-1 小数换算成百分数(progress 0.42 → 42%)(Vue2 :339)', async () => {
    const { wrapper, timeline } = mountCard()
    timeline.tasks = [rebuildTaskFixture({ progress: 0.42 })]
    await nextTick()
    expect(wrapper.get('[data-test="index-progress"] > div').attributes('style')).toContain('42%')
    expect(wrapper.text()).toContain('42')
  })

  it('rebuildTask 查找优先级:先 rebuildTaskId,再任意 type=rebuild(Vue2 :332-337)', async () => {
    const { wrapper, store, timeline } = mountCard()
    vi.spyOn(store, 'rebuildIndex').mockResolvedValue('rb-target')
    // rb-other 先于 rb-target 出现在列表里,且是 type==='rebuild' 的唯一"后备命中"——
    // 但它是 done 状态(不禁用按钮),用于证明"记住的 rebuildTaskId 命中后不再理会
    // 列表里排在前面的其它 rebuild 任务"。rb-target 是 running + 90%,点击后 store 返回
    // 它的 id,组件应绑定到它,而不是继续停留在后备命中的 rb-other 上。
    timeline.tasks = [
      rebuildTaskFixture({ id: 'rb-other', status: 'done', progress: 0.1 }),
      rebuildTaskFixture({ id: 'rb-target', status: 'running', progress: 0.9 }),
    ]
    await nextTick()
    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
    await flushPromises()
    await nextTick()
    // rebuildTaskId 记住了 'rb-target' —— 应该绑定到那条(90%),不是后备命中的 rb-other
    expect(wrapper.text()).toContain('90')
  })

  it('rebuildTaskId 找不到匹配项时回退到任意 type=rebuild 的任务', async () => {
    const { wrapper, timeline } = mountCard()
    // 没有调用过 rebuildIndex(rebuildTaskId 仍是初始空串)——直接靠 type==='rebuild' 兜底命中
    timeline.tasks = [rebuildTaskFixture({ id: 'rb-any', progress: 0.55 })]
    await nextTick()
    expect(wrapper.text()).toContain('55')
  })

  it('只在 running→done 的跳变上弹「已重建」toast,不在每次刷新都弹(Vue2 :283-284)', async () => {
    const { wrapper, timeline } = mountCard()
    // 先把任务置成 done(无 running 前态)→ 断言零 toast
    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
    await nextTick()
    expect(wrapper.emitted('toast')).toBeFalsy()

    // 再走 running → done → 断言恰好一条 toast
    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
    await nextTick()
    expect(wrapper.emitted('toast')).toBeFalsy()
    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
    await nextTick()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toHaveLength(1)
    expect(toasts![0]![0]).toMatchObject({ icon: 'sparkles' })
    expect((toasts![0]![0] as { text: string }).text).toContain('128')

    // 再刷新一次仍是 done(同状态,非跳变)→ 不应再弹第二条
    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
    await nextTick()
    expect(wrapper.emitted('toast')).toHaveLength(1)
  })

  it('running→done 跳变后重拉 about(Vue2 :286)', async () => {
    const { wrapper, store, timeline } = mountCard()
    const fetchSpy = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
    await nextTick()
    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
    await nextTick()
    await flushPromises()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // 确认这次报告没有虚报:done 之外的状态变化不应触发重拉
    void wrapper
  })

  it('running→error 弹失败 toast(附 task.error),不要求跳变', async () => {
    const { wrapper, timeline } = mountCard()
    timeline.tasks = [rebuildTaskFixture({ status: 'error', error: 'disk full' })]
    await nextTick()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toHaveLength(1)
    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
    expect((toasts![0]![0] as { text: string }).text).toContain('disk full')
  })

  it('lastBuilt 为空显示 never(Vue2 :343-344)', async () => {
    const { wrapper, store } = mountCard()
    store.about = { version: '1.0', deviceName: 'NAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    await nextTick()
    expect(wrapper.text()).toContain('从未')
  })

  it('about 取数前(null)不崩溃,lastBuilt 显示 never、coverage 显示 0', async () => {
    const { wrapper, store } = mountCard()
    expect(store.about).toBeNull()
    await nextTick()
    expect(wrapper.text()).toContain('从未')
    expect(wrapper.text()).toContain('覆盖 0')
  })

  it('lastBuilt 的日期跟随 i18n locale(Vue2 无 locale 参数是缺陷,本期改正)', async () => {
    const { wrapper, store } = mountCard()
    store.about = {
      version: '1.0', deviceName: 'NAS', indexCoverage: 10,
      indexLastBuilt: '2026-03-15T08:30:00Z', librarySince: '',
    }
    await nextTick()
    const text = wrapper.text()
    // zh 默认 locale 下 Intl.DateTimeFormat('zh-CN', {month:'short'}) 输出"3月"这类中文月份,
    // 不应出现英文月份缩写(如 Mar)——反证 Vue2 缺陷(跟随系统/浏览器 locale)已被修正。
    expect(text).not.toMatch(/\bMar\b/)
    expect(text).toContain('2026')
  })

  it('recluster 点一次后 3 秒内禁用(防连点)(Vue2 :483-484)', async () => {
    vi.useFakeTimers()
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'reclusterFaces').mockResolvedValue(true)
    const btn = wrapper.get('[data-test="recluster"]')
    await btn.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(2999)
    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(2)
    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeUndefined()
  })

  it('recluster 失败也在 3 秒后解禁(finally 分支)', async () => {
    vi.useFakeTimers()
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'reclusterFaces').mockRejectedValue(new Error('boom'))
    const btn = wrapper.get('[data-test="recluster"]')
    await btn.trigger('click')
    await flushPromises()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toBeTruthy()
    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeUndefined()
  })

  it('rebuild index 按钮 indexing 时禁用', async () => {
    const { wrapper, timeline } = mountCard()
    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
    await nextTick()
    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeDefined()
  })

  it('rebuild index 点击调 store.rebuildIndex();非 409 失败(store 抛出)时 emit 兜底 toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'rebuildIndex').mockRejectedValue(new Error('boom'))
    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
    await flushPromises()
    expect(store.rebuildIndex).toHaveBeenCalledTimes(1)
    const toasts = wrapper.emitted('toast')
    expect(toasts).toBeTruthy()
    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
  })

  it('mount 时不主动取数(about/aiFeatures/tasks 一律不调用,由 T5 容器统一取)', () => {
    const settingsStore = usePhotosSettingsStore()
    const fetchAiSpy = vi.spyOn(settingsStore, 'fetchAiFeatures')
    const fetchAboutSpy = vi.spyOn(settingsStore, 'fetchAbout')
    const timelineStore = useTimelineStore()
    const fetchTasksSpy = vi.spyOn(timelineStore, 'fetchTasks')
    mount(PhotosAiCard)
    expect(fetchAiSpy).not.toHaveBeenCalled()
    expect(fetchAboutSpy).not.toHaveBeenCalled()
    expect(fetchTasksSpy).not.toHaveBeenCalled()
  })
})

describe('样式:开关 [data-on] 变体自带 hover 背景(本区已栽四次)', () => {
  it('st-switch 的 hover 胜出规则同时含 :hover 与 data-on', () => {
    expect(photosAiCardRaw.length).toBeGreaterThan(0)
    const style = extractStyleBlock(photosAiCardRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['st-switch'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-on')
  })
})
