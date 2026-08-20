import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// vi.hoisted, not a bare const: vi.mock is hoisted above top-level declarations,
// so a plain `const getTimeZone = vi.fn()` would be read before initialization.
// `uninitialized` lets one test reproduce the real `service.sys` getter's
// behaviour before initService() has run: it throws synchronously rather than
// rejecting a promise (packages/service/src/index.ts:52 / http.ts:105).
const { getTimeZone, uninitialized } = vi.hoisted(() => ({ getTimeZone: vi.fn(), uninitialized: { value: false } }))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    get sys() {
      if (uninitialized.value) throw new Error('@nimotech/nimoos-service: initService() not called')
      return { getTimeZone }
    },
  },
}))

import { useHostTimezone, __resetHostTimezoneForTest } from './useHostTimezone'

// The failure path warns on purpose (a missing badge is also the correct look at
// the clock's small sizes, so it must be possible to tell the two apart). Spied,
// not silenced, so the tests below can assert it and the run stays quiet.
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  __resetHostTimezoneForTest()
  getTimeZone.mockReset()
  uninitialized.value = false
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { warn.mockRestore() })

describe('useHostTimezone', () => {
  it('exposes the fetched zone', async () => {
    getTimeZone.mockResolvedValue('Asia/Shanghai')
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(zone.value).toBe('Asia/Shanghai'))
  })

  // The clock renders one instance per card, and the host timezone cannot change
  // without a reboot, so several consumers must not mean several requests.
  it('fetches once no matter how many consumers ask', async () => {
    getTimeZone.mockResolvedValue('Asia/Shanghai')
    useHostTimezone(); useHostTimezone(); useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalledTimes(1))
  })

  // An older backend has no /sys/timezone route. The zone must stay null so the
  // badge is hidden; the spec rules out guessing with a browser-side fallback,
  // because a wrong timezone is worse than none.
  it('stays null when the request fails', async () => {
    getTimeZone.mockRejectedValue(new Error('404'))
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
    expect(zone.value).toBeNull()
  })

  // Silent towards the user, not towards whoever is debugging: an absent badge is
  // also the correct rendering at the clock's 2x2 and 1x2 sizes, so a broken route
  // must leave some trace or the two look identical.
  it('warns once when the reading cannot be had', async () => {
    getTimeZone.mockRejectedValue(new Error('404'))
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(zone.value).toBeNull())
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
    expect(String(warn.mock.calls[0][0])).toContain('timezone')
  })

  it('treats an empty reading as unavailable', async () => {
    getTimeZone.mockResolvedValue('')
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
    expect(zone.value).toBeNull()
    expect(warn).not.toHaveBeenCalled() // an empty reading is an answer, not a failure
  })

  // Regression: WidgetCard.test.ts mounts ClockWidget without initService()
  // ever having run, so `service.sys` throws synchronously (not a rejected
  // promise) the instant useHostTimezone() reaches for it. That must be as
  // harmless to the caller as a failed HTTP request -- an absent badge, not a
  // crash that takes the whole widget mount down with it.
  it('does not throw and leaves zone null when the service getter itself throws synchronously', async () => {
    uninitialized.value = true
    let zone
    expect(() => { ({ zone } = useHostTimezone()) }).not.toThrow()
    await vi.waitFor(() => expect(zone!.value).toBeNull())
    expect(getTimeZone).not.toHaveBeenCalled() // the getter threw before getTimeZone() was ever reachable
  })
})
