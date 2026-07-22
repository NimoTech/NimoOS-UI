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

  it('轮询 tick 撞上仍在途的慢请求会跳过,不二次发起;手动 refresh 不受此限制', async () => {
    // start() 立即触发的这次请求挂起不 resolve,模拟慢响应跨越下一个 5s tick 的窗口。
    let resolvePending!: (v: string) => void
    const pending = new Promise<string>((res) => { resolvePending = res })
    logsMock.mockReset().mockImplementationOnce(() => pending)

    const l = useAppLogs(() => 'app1')
    l.start()
    expect(logsMock).toHaveBeenCalledTimes(1)
    expect(l.loading.value).toBe(true) // 上一次请求仍在途

    logsMock.mockResolvedValue('tick') // 若守卫失效,tick 会调用到这个而不是被跳过
    await vi.advanceTimersByTimeAsync(5000) // 5s tick 到达,但 loading 仍为 true
    expect(logsMock).toHaveBeenCalledTimes(1) // 守卫生效:tick 被跳过,未发起第二次请求

    void l.refresh() // 手动刷新不受该守卫限制,哪怕上一次仍在途也照常发起
    expect(logsMock).toHaveBeenCalledTimes(2)

    resolvePending('line1') // 放行第一次请求,避免悬空 promise
    await Promise.resolve()
    await Promise.resolve()
    l.stop()
  })
})
