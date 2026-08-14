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

  it('挂载即拉一次日志并渲染(时间戳前缀已裁掉)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
    // M7:原断言用 toContain,若 formatSysLog 的 .substring(8) 被删掉,输出会变成
    // '2026-04-13T15:38:19.417-0400 …'——那段仍然「包含」这个子串,断言恒绿、
    // 测不出前缀被裁掉这个行为。改 startsWith 使其真的具判别力(sysLog.test.ts
    // 已经对 formatSysLog 本身有具判别力的覆盖,这里只是让这条组件层断言名副其实)。
    expect(w.find('[data-test="logs-pre"]').text().startsWith('13T15:38:19.417-0400')).toBe(true)
  })

  it('每 5 秒自动刷新一次', async () => {
    mountPanel()
    await flushPromises()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(2)
  })

  it('卸载后停表(移植纪律:Vue2 只在切 tab 时清,组件销毁会漏)', async () => {
    const w = mountPanel()
    await flushPromises()
    w.unmount()
    vi.advanceTimersByTime(20000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
  })

  it('拉日志失败时保留上一次内容,不清空', async () => {
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

  it('下载日志的链接带 token 查询参数', async () => {
    localStorage.setItem('access_token', 'tok123')
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-logs-download').attributes('href')).toBe('/v2/nimoos/health/logs?token=tok123')
    localStorage.removeItem('access_token')
  })

  // 过期守卫(约束 #2,brief 未列,评审要求就地实现 + 交错测试证明):
  // 挂载发起的第一次拉取被挂住(deferred),期间 5 秒定时器触发第二次(更新的)拉取
  // 并让它先落定,随后再放行第一次的旧结果——旧结果必须被丢弃,不能覆盖新结果。
  // 若组件按「谁后落定就用谁」写(即没有代际守卫),这条会翻红:旧的 STALE 内容
  // 会覆盖新的 NEWER 内容,最后一个 toContain('NEWER') 断言会失败。
  it('旧请求晚于新请求落定时不覆盖新结果(过期守卫)', async () => {
    let resolveFirst!: (v: string) => void
    const first = new Promise<string>((resolve) => { resolveFirst = resolve })
    getLogs.mockReturnValueOnce(first)

    const w = mountPanel()
    await flushPromises() // 挂载的 loadLogs 跑到 await 处并挂住

    // 定时器触发的第二次(更新的)请求先落定
    getLogs.mockResolvedValueOnce('2026-04-13T15:38:19.417-0400\tinfo\tNEWER\n')
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(w.find('[data-test="logs-pre"]').text()).toContain('NEWER')

    // 现在才放行第一次的旧结果
    resolveFirst('2026-04-13T15:38:19.417-0400\tinfo\tSTALE\n')
    await flushPromises()

    expect(w.find('[data-test="logs-pre"]').text()).toContain('NEWER') // 仍是新结果
    expect(w.find('[data-test="logs-pre"]').text()).not.toContain('STALE') // 旧结果没有覆盖它
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
