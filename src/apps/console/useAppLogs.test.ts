import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { logsMock } = vi.hoisted(() => ({ logsMock: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: { logs: logsMock } } }))
import { useAppLogs } from './useAppLogs'

beforeEach(() => { vi.useFakeTimers(); logsMock.mockReset().mockResolvedValue('line1\nline2') })
afterEach(() => vi.useRealTimers())

describe('useAppLogs', () => {
  it('refresh 拉日志入 text', async () => {
    const l = useAppLogs(() => 'app1')
    await l.refresh()
    expect(logsMock).toHaveBeenCalledWith('app1', { lines: 1000 })
    expect(l.text.value).toBe('line1\nline2')
  })

  it('start 后每 5s 再拉;stop 停止', async () => {
    const l = useAppLogs(() => 'app1')
    l.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(logsMock).toHaveBeenCalledTimes(2) // start 立即 1 次 + 5s 1 次
    l.stop()
    await vi.advanceTimersByTimeAsync(15000)
    expect(logsMock).toHaveBeenCalledTimes(2)
  })

  it('拉取失败进 error,已有 text 保留', async () => {
    const l = useAppLogs(() => 'app1')
    await l.refresh()
    logsMock.mockRejectedValueOnce(new Error('boom'))
    await l.refresh()
    expect(l.error.value).toBeTruthy()
    expect(l.text.value).toBe('line1\nline2')
  })
})
