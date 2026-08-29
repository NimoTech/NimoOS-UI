import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const getSettings = vi.fn()
const putSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      getSettings: () => getSettings(),
      putSettings: (b: unknown) => putSettings(b),
    },
  },
}))

import TerminalSecuritySection from './TerminalSecuritySection.vue'

function httpErr(status?: number, data?: unknown) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data }
  return e
}

beforeEach(() => {
  vi.useFakeTimers()
  getSettings.mockReset().mockResolvedValue({ mode: 'idle', idle_minutes: 15 })
  putSettings.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers() })

async function mountReady() {
  const w = mount(TerminalSecuritySection)
  await flushPromises()
  return w
}

describe('TerminalSecuritySection', () => {
  it('loads the current policy into the form', async () => {
    const w = await mountReady()
    const rows = w.findAll('[data-test="mode-row"]')
    expect(rows).toHaveLength(3)
    expect(w.find('[data-test-mode="idle"] .term-sec-radio').classes()).toContain('on')
    expect((w.find('[data-test="idle-minutes"]').element as HTMLInputElement).value).toBe('15')
  })

  it('falls back to the unavailable empty state when the service does not answer (registered deviation, spec §3.4-2)', async () => {
    getSettings.mockRejectedValue(httpErr())
    const w = await mountReady()
    expect(w.find('[data-test="term-sec-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="mode-row"]').exists()).toBe(false)
  })

  it('saving asks for the password inline, then PUTs policy + password', async () => {
    const w = await mountReady()
    await w.find('[data-test-mode="off"]').trigger('click')
    await w.find('[data-test="sec-save"]').trigger('click')
    expect(putSettings).not.toHaveBeenCalled() // confirm step first
    await w.find('[data-test="sec-pw"]').setValue('hunter2')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(putSettings).toHaveBeenCalledWith({ mode: 'off', idle_minutes: 15, password: 'hunter2' })
    expect(w.find('[data-test="sec-saved"]').exists()).toBe(true)
  })

  it('clamps idle minutes into 1-240 before saving', async () => {
    const w = await mountReady()
    await w.find('[data-test="idle-minutes"]').setValue('999')
    await w.find('[data-test="sec-save"]').trigger('click')
    await w.find('[data-test="sec-pw"]').setValue('pw')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(putSettings).toHaveBeenCalledWith({ mode: 'idle', idle_minutes: 240, password: 'pw' })
  })

  it('shows the wrong-password line on 401 and keeps the confirm open', async () => {
    putSettings.mockRejectedValue(httpErr(401, {}))
    const w = await mountReady()
    await w.find('[data-test="sec-save"]').trigger('click')
    await w.find('[data-test="sec-pw"]').setValue('bad')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sec-pw-error"]').exists()).toBe(true)
    expect(w.find('[data-test="sec-pw"]').exists()).toBe(true)
  })

  it('starts the freeze countdown on 429 and disables confirm until it ends', async () => {
    putSettings.mockRejectedValue(httpErr(429, { retry_after_seconds: 2 }))
    const w = await mountReady()
    await w.find('[data-test="sec-save"]').trigger('click')
    await w.find('[data-test="sec-pw"]').setValue('pw')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sec-frozen"]').text()).toContain('2')
    expect((w.find('[data-test="sec-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect((w.find('[data-test="sec-confirm"]').element as HTMLButtonElement).disabled).toBe(false)
  })
})
