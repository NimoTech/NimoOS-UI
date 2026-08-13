import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { logsMock } = vi.hoisted(() => ({ logsMock: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: { logs: logsMock } } }))
import { useAppLogs } from './useAppLogs'

beforeEach(() => { vi.useFakeTimers(); logsMock.mockReset().mockResolvedValue('line1\nline2') })
afterEach(() => vi.useRealTimers())

describe('useAppLogs', () => {
  it('refresh fetches logs into text', async () => {
    const l = useAppLogs(() => 'app1')
    await l.refresh()
    expect(logsMock).toHaveBeenCalledWith('app1', { lines: 1000 })
    expect(l.text.value).toBe('line1\nline2')
  })

  it('after start fetch again every 5s; stop stops', async () => {
    const l = useAppLogs(() => 'app1')
    l.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(logsMock).toHaveBeenCalledTimes(2) // 1 immediate call from start + 1 at the 5s tick
    l.stop()
    await vi.advanceTimersByTimeAsync(15000)
    expect(logsMock).toHaveBeenCalledTimes(2)
  })

  it('fetch failure goes to error, existing text preserved', async () => {
    const l = useAppLogs(() => 'app1')
    await l.refresh()
    logsMock.mockRejectedValueOnce(new Error('boom'))
    await l.refresh()
    expect(l.error.value).toBeTruthy()
    expect(l.text.value).toBe('line1\nline2')
  })

  it('polling tick hitting in-flight slow request skips, doesn\'t issue second request; manual refresh is exempt', async () => {
    // Keep the request fired immediately by start() pending (never resolve), simulating a slow response spanning the next 5s tick window.
    let resolvePending!: (v: string) => void
    const pending = new Promise<string>((res) => { resolvePending = res })
    logsMock.mockReset().mockImplementationOnce(() => pending)

    const l = useAppLogs(() => 'app1')
    l.start()
    expect(logsMock).toHaveBeenCalledTimes(1)
    expect(l.loading.value).toBe(true) // Previous request still in flight

    logsMock.mockResolvedValue('tick') // If the guard fails, the tick would call this instead of being skipped
    await vi.advanceTimersByTimeAsync(5000) // 5s tick arrives, but loading is still true
    expect(logsMock).toHaveBeenCalledTimes(1) // Guard worked: tick skipped, no second request issued

    void l.refresh() // Manual refresh is exempt from the guard; it fires even while a request is in flight
    expect(logsMock).toHaveBeenCalledTimes(2)

    resolvePending('line1') // Release the first request to avoid a dangling promise
    await Promise.resolve()
    await Promise.resolve()
    l.stop()
  })
})
