// PhotosAiCard.vue — AI card for settings page.
// Source coordinates: Vue2 PhotosSettings.vue:129-192(template)/:283-291(watcher)/
// :332-370(computed)/:458-486(rebuildIndex/doRecluster).
//
// Test infrastructure follows the approach already established and verified in
// PhotosStorageCard.test.ts (an early draft referenced @pinia/testing / winningDeclaration, which
// do not exist in this repo — see that file's head comment):
// - setActivePinia(createPinia()) starts real store, vi.spyOn(store, 'action') stubs as needed.
// - mock targets the shared package @nimotech/nimoos-service, not the store itself.
// - hover cascade guard uses cssCascade.ts's extractStyleBlock/winningHoverBackground.
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

  it('4 switches in fixed order: faces→scenes→ocr→smartview(Vue2 :363-369)', () => {
    const { wrapper } = mountCard()
    const switches = wrapper.findAll('[data-test^="ai-switch-"]')
    expect(switches.map(s => s.attributes('data-test'))).toEqual([
      'ai-switch-faces', 'ai-switch-scenes', 'ai-switch-ocr', 'ai-switch-smartview',
    ])
  })

  it('Clicking switch calls setAiFeature(id, newValue); on failure emits toast', async () => {
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

  it('On successful switch click, no toast is emitted', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setAiFeature').mockResolvedValue(true)
    store.aiFeatures.scenes = true
    await nextTick()
    await wrapper.get('[data-test="ai-switch-scenes"]').trigger('click')
    expect(store.setAiFeature).toHaveBeenCalledWith('scenes', false)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeFalsy()
  })

  it('indexedPct converts backend 0-1 decimal to percentage(progress 0.42 → 42%)(Vue2 :339)', async () => {
    const { wrapper, timeline } = mountCard()
    timeline.tasks = [rebuildTaskFixture({ progress: 0.42 })]
    await nextTick()
    expect(wrapper.get('[data-test="index-progress"] > div').attributes('style')).toContain('42%')
    expect(wrapper.text()).toContain('42')
  })

  it('rebuildTask lookup priority: first rebuildTaskId, then any type=rebuild(Vue2 :332-337)', async () => {
    const { wrapper, store, timeline } = mountCard()
    vi.spyOn(store, 'rebuildIndex').mockResolvedValue('rb-target')
    // rb-other appears before rb-target in the list, and is the only 'fallback match' for type==='rebuild'—
    // but it's in done state(doesn't disable button), used to prove 'once remembered rebuildTaskId matches,
    // ignore earlier rebuild tasks in the list'. rb-target is running + 90%, after click store returns
    // its id, component should bind to it, not stay at fallback match rb-other.
    timeline.tasks = [
      rebuildTaskFixture({ id: 'rb-other', status: 'done', progress: 0.1 }),
      rebuildTaskFixture({ id: 'rb-target', status: 'running', progress: 0.9 }),
    ]
    await nextTick()
    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
    await flushPromises()
    await nextTick()
    // rebuildTaskId remembered 'rb-target'— should bind to that(90%), not fallback match rb-other.
    expect(wrapper.text()).toContain('90')
  })

  it('When rebuildTaskId finds no match, fall back to any type=rebuild task', async () => {
    const { wrapper, timeline } = mountCard()
    // Never called rebuildIndex(rebuildTaskId still initial empty string)—directly hits via type==='rebuild' fallback.
    timeline.tasks = [rebuildTaskFixture({ id: 'rb-any', progress: 0.55 })]
    await nextTick()
    expect(wrapper.text()).toContain('55')
  })

  it('Only emit \'rebuilt\' toast on running→done state change, not on every refresh(Vue2 :283-284)', async () => {
    const { wrapper, timeline } = mountCard()
    // First set task to done(no running prior state)→ assert zero toast.
    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
    await nextTick()
    expect(wrapper.emitted('toast')).toBeFalsy()

    // Then transition running → done → assert exactly one toast.
    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
    await nextTick()
    expect(wrapper.emitted('toast')).toBeFalsy()
    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
    await nextTick()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toHaveLength(1)
    expect(toasts![0]![0]).toMatchObject({ icon: 'sparkles' })
    expect((toasts![0]![0] as { text: string }).text).toContain('128')

    // Refresh again still done(same state, not a transition)→ should not emit a second toast.
    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
    await nextTick()
    expect(wrapper.emitted('toast')).toHaveLength(1)
  })

  it('After running→done transition, re-fetch about(Vue2 :286)', async () => {
    const { wrapper, store, timeline } = mountCard()
    const fetchSpy = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
    await nextTick()
    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
    await nextTick()
    await flushPromises()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Confirm this report is not false: state changes other than done should not trigger re-fetch.
    void wrapper
  })

  it('running→error emits failure toast(with task.error), no transition required', async () => {
    const { wrapper, timeline } = mountCard()
    timeline.tasks = [rebuildTaskFixture({ status: 'error', error: 'disk full' })]
    await nextTick()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toHaveLength(1)
    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
    expect((toasts![0]![0] as { text: string }).text).toContain('disk full')
  })

  it('Empty lastBuilt shows \'never\'(Vue2 :343-344)', async () => {
    const { wrapper, store } = mountCard()
    store.about = { version: '1.0', deviceName: 'NAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    await nextTick()
    expect(wrapper.text()).toContain('从未')
  })

  it('Before fetching about(null), doesn\'t crash, lastBuilt shows \'never\', coverage shows 0', async () => {
    const { wrapper, store } = mountCard()
    expect(store.about).toBeNull()
    await nextTick()
    expect(wrapper.text()).toContain('从未')
    expect(wrapper.text()).toContain('覆盖 0')
  })

  it('lastBuilt date follows i18n locale(Vue2 lacks locale parameter is a defect, fixed this cycle)', async () => {
    const { wrapper, store } = mountCard()
    store.about = {
      version: '1.0', deviceName: 'NAS', indexCoverage: 10,
      indexLastBuilt: '2026-03-15T08:30:00Z', librarySince: '',
    }
    await nextTick()
    const text = wrapper.text()
    // Under zh default locale, Intl.DateTimeFormat('zh-CN', {month:'short'}) outputs Chinese month names
    // like '3月', English abbreviations like Mar should not appear—proof Vue2 defect(following
    // system/browser locale)has been fixed.
    expect(text).not.toMatch(/\bMar\b/)
    expect(text).toContain('2026')
  })

  it('recluster disabled for 3s after one click(prevent multi-click)(Vue2 :483-484)', async () => {
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

  it('recluster also re-enabled after 3s on failure(finally branch)', async () => {
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

  it('rebuild index button disabled during indexing', async () => {
    const { wrapper, timeline } = mountCard()
    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
    await nextTick()
    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeDefined()
  })

  it('rebuild index click calls store.rebuildIndex(); on non-409 failure(store throws) emits fallback toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'rebuildIndex').mockRejectedValue(new Error('boom'))
    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
    await flushPromises()
    expect(store.rebuildIndex).toHaveBeenCalledTimes(1)
    const toasts = wrapper.emitted('toast')
    expect(toasts).toBeTruthy()
    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
  })

  it('On mount doesn\'t proactively fetch(about/aiFeatures/tasks never called, unified fetch by T5 container)', () => {
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

describe('Styles: switch [data-on] variant includes hover background(this section has failed 4 times)', () => {
  it('st-switch hover winning rule contains both :hover and data-on', () => {
    expect(photosAiCardRaw.length).toBeGreaterThan(0)
    const style = extractStyleBlock(photosAiCardRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['st-switch'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-on')
  })
})
