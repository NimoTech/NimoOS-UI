import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ClockWidget from './ClockWidget.vue'
import type { LayoutItem } from '../../grid/types'

// vi.hoisted, not a bare const: vi.mock is hoisted above top-level declarations,
// so a plain `const getTimeZone = vi.fn()` would be read before initialization.
// Defaults to a resolved zone so the four pre-existing tests below -- which
// mount the widget but never touch the mock -- don't crash on an unconfigured
// `vi.fn()` resolving to undefined; the 'timezone badge' tests reset and
// reconfigure it explicitly per case.
const { getTimeZone } = vi.hoisted(() => ({ getTimeZone: vi.fn(() => Promise.resolve('Asia/Shanghai')) }))
// Spread the real module so mounting still finds every other top-level export
// (e.g. the ones the global i18n plugin may reach) -- only `service` is replaced.
// Note: `service`'s other domains (users, photos, ...) are getters that call the
// real getHttp() singleton, which throws unless initService() has run; spreading
// `m.service` -- as opposed to `m` -- would trigger every one of them just to
// build this mock, so `service` here holds only the one method under test.
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const m = await importOriginal<typeof import('@nimotech/nimoos-service')>()
  return { ...m, service: { sys: { getTimeZone } } }
})
import { __resetHostTimezoneForTest } from '../../composables/useHostTimezone'

const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'clock', c: 1, r: 1, w, h })
describe('ClockWidget', () => {
  it('renders HH:MM time', () => {
    const w = mount(ClockWidget, { props: { item: item(2, 2) } })
    expect(w.get('[data-clock-time]').text()).toMatch(/^\d{2}:\d{2}$/)
  })
  it('shows the analog dial in non-mini variants', () => {
    const w = mount(ClockWidget, { props: { item: item(2, 2) } })
    expect(w.find('.dial').exists()).toBe(true)
  })
  it('uses the mini variant (time only, no dial) when h<2', () => {
    const w = mount(ClockWidget, { props: { item: item(2, 1) } })
    expect(w.get('.clock').classes()).toContain('v-mini')
    expect(w.find('.dial').exists()).toBe(false)
  })
  it('shows greeting and date in the wide variant', () => {
    const w = mount(ClockWidget, { props: { item: item(4, 2) } })
    expect(w.find('.greet').exists()).toBe(true)
    expect(w.get('.sub').text()).toContain('月')
  })

  describe('timezone badge', () => {
    beforeEach(() => { __resetHostTimezoneForTest(); getTimeZone.mockReset() })

    it('shows the offset next to the weekday in the 2x3 variant', async () => {
      getTimeZone.mockResolvedValue('Asia/Shanghai')
      const w = mount(ClockWidget, { props: { item: item(3, 2) } })
      await vi.waitFor(() => expect(w.get('.wk').text()).toContain('UTC+8'))
      expect(w.get('.wk').text()).toContain('星期')
    })

    it('shows the offset on the date line in the 2x4 variant', async () => {
      getTimeZone.mockResolvedValue('Asia/Shanghai')
      const w = mount(ClockWidget, { props: { item: item(4, 2) } })
      await vi.waitFor(() => expect(w.get('.sub').text()).toContain('UTC+8'))
    })

    // A wrong timezone is worse than no timezone, so an unavailable reading
    // must leave the clock exactly as it was rather than render a placeholder.
    it('renders no badge when the host timezone is unavailable', async () => {
      getTimeZone.mockRejectedValue(new Error('404'))
      // useHostTimezone warns on this path by design; asserted in its own test,
      // stubbed here so the expected failure does not look like a real one.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = mount(ClockWidget, { props: { item: item(3, 2) } })
      await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
      expect(w.text()).not.toContain('UTC')
      expect(w.get('.wk').text()).toContain('星期')
      warn.mockRestore()
    })

    it('leaves the 2x2 and 1x2 variants alone', async () => {
      getTimeZone.mockResolvedValue('Asia/Shanghai')
      const sq = mount(ClockWidget, { props: { item: item(2, 2) } })
      const mini = mount(ClockWidget, { props: { item: item(2, 1) } })
      await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
      expect(sq.text()).not.toContain('UTC')
      expect(mini.text()).not.toContain('UTC')
    })
  })
})
