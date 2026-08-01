import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TerminalPanel from './TerminalPanel.vue'
import { i18n } from '../../i18n'

const getLogs = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getLogs: () => getLogs() } },
}))

const mountPanel = () => mount(TerminalPanel, { global: { plugins: [i18n] } })

describe('TerminalPanel', () => {
  beforeEach(() => { vi.useFakeTimers(); getLogs.mockReset(); getLogs.mockResolvedValue('2026-04-13T15:38:19.417-0400\tinfo\thello\n') })
  afterEach(() => { vi.useRealTimers() })

  it('挂载即拉一次日志并渲染(时间戳前缀已裁掉)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
    expect(w.find('.set-logs').text()).toContain('13T15:38:19.417-0400')
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
    expect(w.find('.set-logs').text()).toContain('hello')
  })

  it('渲染终端服务不可用的空态(后端 /v1/sys/wsssh 与 /v1/terminal/settings 都是 404)', () => {
    const w = mountPanel()
    expect(w.find('.set-term-empty').text()).toContain('终端服务暂不可用')
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
    expect(w.find('.set-logs').text()).toContain('NEWER')

    // 现在才放行第一次的旧结果
    resolveFirst('2026-04-13T15:38:19.417-0400\tinfo\tSTALE\n')
    await flushPromises()

    expect(w.find('.set-logs').text()).toContain('NEWER') // 仍是新结果
    expect(w.find('.set-logs').text()).not.toContain('STALE') // 旧结果没有覆盖它
  })
})
