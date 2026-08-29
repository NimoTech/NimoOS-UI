import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const powerCalls: string[] = []
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { power: async (a: string) => { powerCalls.push(a) } } },
}))

import PowerFlow from './PowerFlow.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(PowerFlow, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  powerCalls.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('PowerFlow buttons and confirmation', () => {
  it('renders both the shutdown and restart buttons', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').exists()).toBe(true)
    expect(w.find('.pf-restart').exists()).toBe(true)
  })

  it('both buttons have accessible names (icon-only buttons)', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').attributes('aria-label')).toBe('关机')
    expect(w.find('.pf-restart').attributes('aria-label')).toBe('重启')
  })

  it('clicking shutdown opens the confirmation first — **nothing is sent before confirming** (matches Vue2, where power() only opens the confirm dialog)', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    expect(w.findAllComponents(AlertDialog)[0].props('open')).toBe(true)
    expect(powerCalls).toEqual([])
  })

  it('confirming shutdown sends PUT off and shows the shutting overlay', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['off'])
    expect(w.text()).toContain('正在关机')
  })

  it('canceling shutdown: nothing sent, no overlay', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('update:open', false)
    await flushPromises()
    expect(powerCalls).toEqual([])
    expect(w.text()).not.toContain('正在关机')
  })

  it('confirming restart sends PUT restart', async () => {
    const w = mountIt()
    await w.find('.pf-restart').trigger('click')
    w.findAllComponents(AlertDialog)[1].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['restart'])
    expect(w.text()).toContain('正在重启')
  })

  it('the overlay still shows even if the power API errors out (Vue2 .catch(()=>{}) — shutdown requests often never get a response back in time)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'power').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(w.text()).toContain('正在关机')
  })

  // Review fix round 2 · Minor: in the waiting state behind the overlay, both power
  // buttons remain keyboard-reachable (during the "restart timeout" phase, tabbing over
  // and pressing Enter could really shut the machine down). No focus trap (separate
  // effort) — just disable the buttons: both must be disabled when phase !== 'idle'.
  it('power buttons are disabled outside the idle phase, to prevent keyboard activation behind the overlay (review fix round 2)', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(w.text()).toContain('正在关机')
    expect(w.find('.pf-shutdown').attributes('disabled')).toBeDefined()
    expect(w.find('.pf-restart').attributes('disabled')).toBeDefined()
  })
})

// Assertions for the six overlay states live in PowerOverlay.test.ts (pure presentational
// component that only takes a phase prop) — no need to add test-only production hooks
// like __setPhase on PowerFlow.

describe('PowerFlow cleanup', () => {
  it('stops the phase-machine timer on unmount', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(3000 * 10)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
