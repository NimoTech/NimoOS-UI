import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useTimelineStore } from '../../stores/timeline'
import { useAskNimo } from '../../composables/useAskNimo'
import AskNimoFab from './AskNimoFab.vue'
import askNimoFabRaw from './AskNimoFab.vue?raw'

describe('AskNimoFab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    // Preflight F-13: openFab()/restore() route through useAskNimo().openWith()/... which calls
    // ensureNimoAgentInit() -- stub the network-facing quartet so mounting doesn't fire real requests.
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()
  })

  it('renders the full FAB by default, mini hidden', () => {
    const wrapper = mount(AskNimoFab)
    expect(wrapper.find('.nimo-fab').exists()).toBe(true)
    expect(wrapper.find('.nimo-fab-mini').exists()).toBe(false)
  })

  it('clicking the X dismisses to the mini edge-tab, persisted', async () => {
    const wrapper = mount(AskNimoFab)
    await wrapper.find('.nimo-fab-x').trigger('click')
    expect(wrapper.find('.nimo-fab-mini').exists()).toBe(true)
    expect(localStorage.getItem('nimo_fab_dismissed')).toBe('1')
  })

  it('clicking the mini tab restores the full FAB', async () => {
    useAskNimo().dismissFab()
    const wrapper = mount(AskNimoFab)
    await wrapper.find('.nimo-fab-mini').trigger('click')
    expect(wrapper.find('.nimo-fab').exists()).toBe(true)
  })

  it('clicking the FAB body opens the popup with no prefill', async () => {
    const wrapper = mount(AskNimoFab)
    await wrapper.find('.nimo-fab').trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(true)
    expect(useAskNimo().prefill.value).toBe('')
  })

  // Review fix (IMPORTANT #3): restores Vue2 PhotosAskNimo.vue:211-213's toggle() -- clicking
  // the FAB while the popup is already open must close it, not re-open/reset it.
  it('clicking the FAB body while the popup is already open closes it (Vue2 toggle semantics)', async () => {
    const wrapper = mount(AskNimoFab)
    useAskNimo().openWith('hello')
    expect(useAskNimo().popupOpen.value).toBe(true)
    await wrapper.find('.nimo-fab').trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(false)
  })

  it('no ring rendered when there are zero tasks', () => {
    const wrapper = mount(AskNimoFab)
    expect(wrapper.find('.nimo-fab-ring').exists()).toBe(false)
  })

  it('ring rendered when tasks exist, using the normal-state ring token pair', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'index', status: 'running', current: 1, total: 2 }] as any
    const wrapper = mount(AskNimoFab)
    expect(wrapper.find('.nimo-fab-ring').exists()).toBe(true)
    expect(wrapper.find('stop').attributes('style')).toContain('var(--nimo-ring-from)')
  })

  it('ring switches to the error-state ring token pair when any task has .error', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'face', status: 'error', error: 'x' }] as any
    const wrapper = mount(AskNimoFab)
    expect(wrapper.find('stop').attributes('style')).toContain('var(--nimo-ring-err-from)')
  })

  it('each mounted instance gets a unique gradient id (module-level counter, not per-instance)', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'index', status: 'running', current: 1, total: 2 }] as any
    const w1 = mount(AskNimoFab)
    const w2 = mount(AskNimoFab)
    const id1 = w1.find('linearGradient').attributes('id')
    const id2 = w2.find('linearGradient').attributes('id')
    expect(id1).not.toBe(id2)
  })

  it('drag beyond the 5px threshold moves the FAB and persists via setFabPosition', async () => {
    const wrapper = mount(AskNimoFab, { attachTo: document.body })
    const fab = wrapper.find('.nimo-fab')
    await fab.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 90 })) // dy=-10, over threshold
    window.dispatchEvent(new MouseEvent('mouseup'))
    await wrapper.vm.$nextTick()
    // fabBottom increases when the pointer moves up (dy negative), matching Vue2's
    // `fabBottom = origin - dy` clamp formula. Baseline is 14 (corrected default, not the
    // brief's stale 24 -- see useAskNimo.ts's "Review fix (defaults)" comment).
    expect(useAskNimo().fabBottom.value).toBeGreaterThan(14)
    expect(localStorage.getItem('nimo_fab_bottom')).not.toBeNull()
    wrapper.unmount()
  })

  it('a mousedown+mouseup with no movement past threshold is treated as a click, not a drag', async () => {
    const wrapper = mount(AskNimoFab, { attachTo: document.body })
    const fab = wrapper.find('.nimo-fab')
    await fab.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 101, clientY: 100 })) // dx=1, under threshold
    window.dispatchEvent(new MouseEvent('mouseup'))
    await fab.trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(true)
    wrapper.unmount()
  })

  // Re-check N-5 ③: localStorage must be untouched mid-drag, written exactly once at drop.
  it('does not write localStorage on intermediate mousemove frames, only once at mouseup', async () => {
    const wrapper = mount(AskNimoFab, { attachTo: document.body })
    const fab = wrapper.find('.nimo-fab')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    await fab.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 90 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 80 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 70 }))
    expect(setItemSpy).not.toHaveBeenCalled() // three moves in, still nothing persisted
    window.dispatchEvent(new MouseEvent('mouseup'))
    await wrapper.vm.$nextTick()
    expect(setItemSpy.mock.calls.filter(([key]) => key === 'nimo_fab_bottom')).toHaveLength(1)
    setItemSpy.mockRestore()
    wrapper.unmount()
  })

  // Re-check N-5 ②: mousedown on the dismiss "x" must not bubble into the FAB's own drag-start
  // handler (Vue2 PhotosAskNimo.vue:34's own @mousedown.stop, same rationale).
  it('mousedown on the dismiss x does not start a FAB drag', async () => {
    const wrapper = mount(AskNimoFab, { attachTo: document.body })
    const x = wrapper.find('.nimo-fab-x')
    await x.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 50 })) // well past the 5px threshold
    window.dispatchEvent(new MouseEvent('mouseup'))
    await wrapper.vm.$nextTick()
    expect(useAskNimo().fabBottom.value).toBe(14) // untouched -- no drag was ever started (corrected 14 default)
    wrapper.unmount()
  })

  // Review fix (IMPORTANT #1): the full/mini swap must go through Vue's <transition>, not a bare
  // v-if/v-else -- otherwise photos.scss's already-ported .nimo-fab-swap-* rules (and their
  // Vue3 -enter-from shim) never get a chance to apply to anything. Deliberately NOT asserting
  // on enter/leave timing (jsdom has no real animation clock, and @vue/test-utils' findComponent
  // doesn't type-match Vue's built-in <transition> cleanly) -- a raw-source check for the
  // wrapper + its name is the same lightweight pattern SearchSaveSmartView.test.ts already uses
  // for its own `<Transition name="save-pop">`, per the controller's "do not fight jsdom
  // animation timing" guidance.
  it('wraps the full/mini swap in a <transition name="nimo-fab-swap">', () => {
    expect(askNimoFabRaw).toMatch(/<transition\s+name="nimo-fab-swap">/)
  })

  // Review fix (IMPORTANT #2): deliberate deviation from Vue2 (which has no @click.stop on the
  // dismiss "x" -- see the comment at dismiss()'s definition). Guards against a regression this
  // port's architecture is uniquely exposed to: dismiss() never touches popupOpen, so without
  // .stop, the "x" click bubbling to the FAB's own @click would flip popupOpen via openFab()'s
  // toggle semantics (Vue2 PhotosAskNimo.vue:211-213) in the same click that just dismissed the FAB.
  it('clicking the dismiss x with the popup closed does not bubble into opening the popup', async () => {
    const wrapper = mount(AskNimoFab)
    expect(useAskNimo().popupOpen.value).toBe(false)
    await wrapper.find('.nimo-fab-x').trigger('click')
    expect(useAskNimo().fabDismissed.value).toBe(true)
    expect(useAskNimo().popupOpen.value).toBe(false)
  })
})
