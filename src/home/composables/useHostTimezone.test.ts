import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.hoisted, not a bare const: vi.mock is hoisted above top-level declarations,
// so a plain `const getTimeZone = vi.fn()` would be read before initialization.
const { getTimeZone } = vi.hoisted(() => ({ getTimeZone: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: { getTimeZone } } }))

import { useHostTimezone, __resetHostTimezoneForTest } from './useHostTimezone'

beforeEach(() => {
  __resetHostTimezoneForTest()
  getTimeZone.mockReset()
})

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

  it('treats an empty reading as unavailable', async () => {
    getTimeZone.mockResolvedValue('')
    const { zone } = useHostTimezone()
    await vi.waitFor(() => expect(getTimeZone).toHaveBeenCalled())
    expect(zone.value).toBeNull()
  })
})
