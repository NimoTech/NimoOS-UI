// 1:1 ported from Vue2 ContextUsageBar.spec.js:54-81 (rendering section).
// Pure geometry/formatting logic already has its own tests in contextUsage.ts, here only test component rendering.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getMemorySettings: vi.fn(),
  putMemorySettings: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getMemorySettings: h.getMemorySettings,
      putMemorySettings: h.putMemorySettings,
    },
  },
}))

import ContextUsageBar from './ContextUsageBar.vue'
import { RING_C } from '../../util/contextUsage'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('ContextUsageBar(ported from Vue2 ContextUsageBar.spec.js:54-81)', () => {
  it('render ok level, tooltip contains formatted token and percentage', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 48000, window: 200000, pct: 24 }, global: g })
    const arc = w.find('.ctx-ring-arc')
    expect(arc.exists()).toBe(true)
    expect(arc.classes()).toContain('ok')
    expect(arc.attributes('stroke-dasharray')).toBe(`${((24 / 100) * RING_C).toFixed(2)} ${RING_C.toFixed(2)}`)
    const tip = w.find('.ctx-usage-tip').text()
    expect(tip).toContain('48K')
    expect(tip).toContain('200K')
    expect(tip).toContain('24%')
  })
  it('pct 75 → warn level', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 75 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('warn')
  })
  it('pct 95 → danger level', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 95 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('danger')
  })
})

// 2026-08-24 context-window editor popover — mirrors Vue2 ContextUsageBar.spec.js editor cases.
describe('ContextUsageBar window editor popover', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

  async function openPop() {
    const w = mount(ContextUsageBar, {
      props: { tokens: 48000, window: 262144, pct: 18 },
      global: g,
    })
    await w.find('[data-test="ctx-ring-btn"]').trigger('click')
    await flush()
    return w
  }

  it('click opens the popover and loads current settings into the input', async () => {
    h.getMemorySettings.mockResolvedValue({
      enabled: true, compaction_enabled: true, context_window: 65536,
    })
    const w = await openPop()
    expect(w.find('[data-test="ctx-pop"]').exists()).toBe(true)
    expect((w.find('[data-test="ctx-input"]').element as HTMLInputElement).value).toBe('65536')
  })

  it('save PUTs the typed window, preserves enabled/compaction flags, emits saved and closes', async () => {
    h.getMemorySettings.mockResolvedValue({
      enabled: true, compaction_enabled: false, context_window: null,
    })
    h.putMemorySettings.mockResolvedValue({})
    const w = await openPop()
    await w.find('[data-test="ctx-input"]').setValue('131072')
    await w.find('[data-test="ctx-save"]').trigger('click')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith({
      enabled: true, compaction_enabled: false, context_window: 131072,
    })
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.find('[data-test="ctx-pop"]').exists()).toBe(false)
  })

  it('reset sends 0 (clear override) — null would mean "don\'t touch" to the backend', async () => {
    h.getMemorySettings.mockResolvedValue({
      enabled: false, compaction_enabled: true, context_window: 2048,
    })
    h.putMemorySettings.mockResolvedValue({})
    const w = await openPop()
    await w.find('[data-test="ctx-reset"]').trigger('click')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith({
      enabled: false, compaction_enabled: true, context_window: 0,
    })
  })

  it('rejects sub-floor values client-side without calling the API', async () => {
    h.getMemorySettings.mockResolvedValue({
      enabled: false, compaction_enabled: true, context_window: null,
    })
    const w = await openPop()
    await w.find('[data-test="ctx-input"]').setValue('2')
    await w.find('[data-test="ctx-save"]').trigger('click')
    await flush()
    expect(h.putMemorySettings).not.toHaveBeenCalled()
    expect(w.find('[data-test="ctx-error"]').exists()).toBe(true)
  })

  it('empty input + save clears the override (sends 0)', async () => {
    h.getMemorySettings.mockResolvedValue({
      enabled: true, compaction_enabled: true, context_window: 65536,
    })
    h.putMemorySettings.mockResolvedValue({})
    const w = await openPop()
    await w.find('[data-test="ctx-input"]').setValue('')
    await w.find('[data-test="ctx-save"]').trigger('click')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith({
      enabled: true, compaction_enabled: true, context_window: 0,
    })
  })
})
