import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getMaxTurns: vi.fn(),
  putMaxTurns: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { getMaxTurns: h.getMaxTurns, putMaxTurns: h.putMaxTurns } },
}))

import ExecutionSection from './ExecutionSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(ExecutionSection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

describe('ExecutionSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.getMaxTurns.mockReset()
    h.putMaxTurns.mockReset()
    h.putMaxTurns.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('max_turns: 25 → number input value 25, unlimited switch off, input editable', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('25')
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    expect(input.disabled).toBe(false)
  })

  it('max_turns: 0 → unlimited switch on, number input disabled', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 0 })
    const w = mountSection()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('true')
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('max_turns missing/not a number → falls back to 10', async () => {
    h.getMaxTurns.mockResolvedValue({})
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('10')
  })

  it('getMaxTurns rejects → does not throw, no toast, displays default 10', async () => {
    h.getMaxTurns.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('10')
    expect(show).not.toHaveBeenCalled()
  })

  it('turning on unlimited switch → immediately calls putMaxTurns(0)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(0)
  })

  it('turning off unlimited switch (steps=10 at this time) → putMaxTurns(10)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 0 })
    const w = mountSection()
    await flush()
    // now unlimited, steps default stays 10
    await w.find('.sw').trigger('click')
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(10)
  })

  it('changing number input to 3 triggers change → putMaxTurns(3)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(3)
  })

  // Normalization branches explained: formula is Math.max(1, Math.floor(Number(steps.value) || 10)).
  // This `||10` uses the same fallback as "empty input" (brief itself uses it to explain empty input:
  // Number('')||10=10), so literal input "0" first hits `||10` and becomes 10, then
  // Math.floor/Math.max stay unchanged — same branch as "empty input", not the
  // Math.max(1,…) clamp branch. To truly hit the clamp branch requires a value where Number() is
  // non-zero but floor result <1, using 0.3 here. See deviation statement in report.
  it('normalization: input 0.3 → putMaxTurns(1) and input displays 1 (Math.max(1,…) clamp branch)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(0.3)
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(1)
    expect((input.element as HTMLInputElement).value).toBe('1')
  })

  it('normalization: input 2.7 → putMaxTurns(2) (Math.floor)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(2.7)
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(2)
  })

  it('normalization: empty input → putMaxTurns(10) (Number("")||10)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue('')
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(10)
  })

  it('shows "Saving..." while saving, shows "Saved" after save completes', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    let release: () => void = () => {}
    h.putMaxTurns.mockImplementation(() => new Promise<void>((r) => { release = r }))
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await nextTick()
    expect(w.find('.set-actions .hint').text()).toBe('保存中…')
    release()
    await flush()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
  })

  it('"Saved" automatically disappears after 2 seconds', async () => {
    vi.useFakeTimers()
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
    await vi.advanceTimersByTimeAsync(1999)
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
    await vi.advanceTimersByTimeAsync(1)
    expect(w.find('.set-actions .hint').text()).toBe('')
  })

  it('save failure shows danger toast, and "Saving..." resets', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    h.putMaxTurns.mockRejectedValue({ response: { data: { message: '后端拒绝' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(show).toHaveBeenCalledWith('后端拒绝', 3000, 'danger')
    expect(w.find('.set-actions .hint').text()).toBe('')
  })

  it('save failure with no message → toast fallback text "Save failed"', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    h.putMaxTurns.mockRejectedValue({})
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(show).toHaveBeenCalledWith('保存失败', 3000, 'danger')
  })

  it('timers no longer fire after unmount', async () => {
    vi.useFakeTimers()
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    w.unmount()
    await vi.advanceTimersByTimeAsync(3000)
    expect(show).not.toHaveBeenCalled()
  })
})
