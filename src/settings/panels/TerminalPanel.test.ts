import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TerminalPanel from './TerminalPanel.vue'
import { i18n } from '../../i18n'

const getLogs = vi.fn()
const getSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: { getLogs: () => getLogs() },
    terminal: { getSettings: () => getSettings() },
  },
}))

const mountPanel = () => mount(TerminalPanel, { global: { plugins: [i18n] } })

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia()) // TerminalPanel now calls useSessionStore() unconditionally (SP18 admin gate)
    getLogs.mockReset(); getLogs.mockResolvedValue('2026-04-13T15:38:19.417-0400\tinfo\thello\n')
    getSettings.mockReset().mockResolvedValue({ mode: 'idle', idle_minutes: 15 })
    localStorage.removeItem('user')
  })
  afterEach(() => { vi.useRealTimers(); localStorage.removeItem('user') })

  it('fetches logs once on mount and renders them (timestamp prefix already stripped)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
    // M7: the original assertion used toContain — if formatSysLog's .substring(8) were
    // removed, the output would become '2026-04-13T15:38:19.417-0400 …', which would
    // still "contain" that substring, so the assertion would stay green and would never
    // catch the prefix-stripping behavior regressing. Switched to startsWith to make it
    // actually discriminating (sysLog.test.ts already has discriminating coverage of
    // formatSysLog itself; this is just making this component-level assertion live up
    // to its name).
    expect(w.find('[data-test="logs-pre"]').text().startsWith('13T15:38:19.417-0400')).toBe(true)
  })

  it('auto-refreshes every 5 seconds', async () => {
    mountPanel()
    await flushPromises()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(2)
  })

  it('stops the timer on unmount (porting discipline: Vue2 only clears it on tab switch, which misses component destroy)', async () => {
    const w = mountPanel()
    await flushPromises()
    w.unmount()
    vi.advanceTimersByTime(20000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous content when fetching logs fails, instead of clearing it', async () => {
    const w = mountPanel()
    await flushPromises()
    getLogs.mockRejectedValueOnce(new Error('boom'))
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(w.find('[data-test="logs-pre"]').text()).toContain('hello')
  })

  it('admin session with Terminal service unavailable: the security section shows the empty state (former deviation #9 behavior folded into the section)', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }))
    getSettings.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-term-empty').text()).toContain('终端服务暂不可用')
  })

  it('renders the terminal security section for an admin session (SP18)', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-test="mode-row"]').exists()).toBe(true)
    // Logs card stays regardless of the admin gate.
    expect(w.find('[data-test="logs-pre"]').exists()).toBe(true)
  })

  it('does not render the terminal security section for a non-admin session; the logs card still renders', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'user' }))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-test="mode-row"]').exists()).toBe(false)
    expect(w.find('[data-test="term-sec-unavailable"]').exists()).toBe(false)
    expect(w.find('[data-test="logs-pre"]').exists()).toBe(true)
  })

  it('the download-logs link carries a token query parameter', async () => {
    localStorage.setItem('access_token', 'tok123')
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-logs-download').attributes('href')).toBe('/v2/nimoos/health/logs?token=tok123')
    localStorage.removeItem('access_token')
  })

  // Stale-response guard (constraint #2, not listed in the brief, added at reviewer's
  // request with an interleaved test to prove it):
  // the first fetch kicked off on mount is left pending (deferred); while it's pending,
  // the 5-second timer fires a second (newer) fetch and lets it settle first, then the
  // first fetch's stale result is allowed to resolve afterward — the stale result must
  // be discarded and must not overwrite the newer result.
  // If the component were written as "whichever settles last wins" (i.e. no generation
  // guard), this test would go red: the old STALE content would overwrite the newer
  // NEWER content, and the final toContain('NEWER') assertion would fail.
  it('does not overwrite the newer result when a stale request settles after the newer one (stale guard)', async () => {
    let resolveFirst!: (v: string) => void
    const first = new Promise<string>((resolve) => { resolveFirst = resolve })
    getLogs.mockReturnValueOnce(first)

    const w = mountPanel()
    await flushPromises() // The mount's loadLogs runs to the await and hangs there

    // The second (newer) request, fired by the timer, settles first
    getLogs.mockResolvedValueOnce('2026-04-13T15:38:19.417-0400\tinfo\tNEWER\n')
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(w.find('[data-test="logs-pre"]').text()).toContain('NEWER')

    // Only now let the first request's stale result resolve
    resolveFirst('2026-04-13T15:38:19.417-0400\tinfo\tSTALE\n')
    await flushPromises()

    expect(w.find('[data-test="logs-pre"]').text()).toContain('NEWER') // Still the newer result
    expect(w.find('[data-test="logs-pre"]').text()).not.toContain('STALE') // The stale result didn't overwrite it
  })

  // ── Paging (fixes the "page unresponsive" freeze) ────────────────────────
  // GET /v1/sys/logs returns the whole log file (5 MB / 19943 lines on a real device,
  // rotation caps it at 10 MB) and the old implementation put all of it into one <pre>,
  // re-laid out every 5 seconds. Measured in headless Chrome against the real payload:
  // 682-1180 ms of blocked main thread per refresh and +1162 MB of renderer memory.
  // Machines with less headroom cross Chrome's "input event unanswered for 5 s"
  // threshold, so the next click pops the "page unresponsive" dialog.
  // The fix keeps exactly 1000 lines in the DOM: page 1 is the newest one and stays
  // live, page 2 and beyond freeze a snapshot and pause polling -- the log grows at the
  // tail, so unfrozen page boundaries would drift and show duplicated or skipped lines.
  const bigLog = (n: number, tag = 'line') =>
    Array.from({ length: n }, (_, i) => `2026-04-13T15:38:19.417-0400\tinfo\t${tag} ${i}`).join('\n') + '\n'
  const shownLines = (w: ReturnType<typeof mountPanel>) =>
    w.find('[data-test="logs-pre"]').text().split('\n')

  it('with more than one page of log, only the newest 1000 lines reach the DOM', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    const lines = shownLines(w)
    expect(lines.length).toBe(1000)
    expect(lines[0]).toContain('\tline 1500')
    expect(lines[999]).toContain('\tline 2499')
    expect(w.find('[data-test="logs-pre"]').text()).not.toContain('\tline 1499')
  })

  it('no pager for a single-page log (a small log looks exactly as it did before)', async () => {
    const w = mountPanel() // the default fixture is a single line
    await flushPromises()
    expect(w.find('[data-test="logs-pager"]').exists()).toBe(false)
  })

  it('the pager reads page 1 of 3 and is marked live', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-test="logs-pager"]').exists()).toBe(true)
    expect(w.find('[data-test="logs-page"]').text()).toBe('第 1 / 3 页')
    expect(w.find('[data-test="logs-live"]').exists()).toBe(true)
    expect(w.find('[data-test="logs-paused"]').exists()).toBe(false)
  })

  it('Newer is disabled on page 1 and Older is disabled on the last page', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-test="logs-newer"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="logs-older"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="logs-older"]').trigger('click')
    await w.find('[data-test="logs-older"]').trigger('click') // now on page 3, the last one
    expect(w.find('[data-test="logs-page"]').text()).toBe('第 3 / 3 页')
    expect(w.find('[data-test="logs-older"]').attributes('disabled')).toBeDefined()
  })

  it('page 2 shows the slice straight before page 1, with no overlap and no gap', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-test="logs-older"]').trigger('click')
    const lines = shownLines(w)
    expect(lines.length).toBe(1000)
    expect(lines[0]).toContain('\tline 500')
    expect(lines[999]).toContain('\tline 1499')
  })

  it('leaving page 1 pauses the 5-second polling and says so', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
    await w.find('[data-test="logs-older"]').trigger('click')
    expect(w.find('[data-test="logs-paused"]').exists()).toBe(true)
    expect(w.find('[data-test="logs-live"]').exists()).toBe(false)
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1) // not one further fetch
  })

  it('content is frozen while paging: new lines on the backend change neither page number nor content', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-test="logs-older"]').trigger('click')
    // The backend grew by 2000 lines (4500 total): unfrozen, the count would become 5
    // pages and every boundary would shift.
    getLogs.mockResolvedValue(bigLog(4500))
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(w.find('[data-test="logs-page"]').text()).toBe('第 2 / 3 页')
    expect(shownLines(w)[0]).toContain('\tline 500')
  })

  it('returning to page 1 resumes live mode: refetches at once and restarts the timer', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-test="logs-older"]').trigger('click')
    getLogs.mockResolvedValue(bigLog(2500, 'fresh'))
    await w.find('[data-test="logs-newer"]').trigger('click')
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(2) // back on page 1, fetch immediately
    expect(w.find('[data-test="logs-live"]').exists()).toBe(true)
    expect(shownLines(w)[999]).toContain('\tfresh 2499')
    vi.advanceTimersByTime(5000) // and the timer really is running again
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(3)
  })

  it('the unmount-stops-the-timer guarantee still holds after paging', async () => {
    getLogs.mockResolvedValue(bigLog(2500))
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-test="logs-older"]').trigger('click')
    await w.find('[data-test="logs-newer"]').trigger('click')
    await flushPromises()
    const calls = getLogs.mock.calls.length
    w.unmount()
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(calls)
  })
})
