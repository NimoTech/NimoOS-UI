import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPowerFlow, probeAlive,
  PING_INTERVAL_MS, SHUTDOWN_FALLBACK_MS, RESTART_FALLBACK_MS,
  RESTART_PING_DELAY_MS, DONE_RELOAD_DELAY_MS,
  type PowerPhase,
} from './powerFlow'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function harness(probeSeq: boolean[]) {
  const phases: PowerPhase[] = []
  const reload = vi.fn()
  let i = 0
  const probe = vi.fn(async () => probeSeq[Math.min(i++, probeSeq.length - 1)])
  const c = createPowerFlow({ probe, reload, onPhase: (p) => phases.push(p) })
  return { c, phases, reload, probe }
}

describe('probeAlive(移植纪律 #6)', () => {
  it('200 → 活着', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch)).toBe(true)
  })
  it('401 也算活着 —— 服务器能回 401 说明它起来了', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch)).toBe(true)
  })
  it('500 也算活着', async () => {
    expect(await probeAlive(vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch)).toBe(true)
  })
  it('网络错误 → 下线', async () => {
    expect(await probeAlive(vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch)).toBe(false)
  })
})

describe('关机流(对位 Vue2 onShutdownConfirmed L1779-1811)', () => {
  it('立刻进 shutting', () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    expect(phases).toEqual(['shutting'])
  })

  it('连续 2 次探活失败才判定 offline(单次失败可能只是抖动)', async () => {
    const { c, phases } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting'])
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('中间探活成功会把失败计数清零', async () => {
    const { c, phases } = harness([false, true, false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['shutting'])   // 失败-成功-失败 → 从未连续两次
  })

  it('60 秒兜底也进 offline(机器没回应探活的极端情况)', async () => {
    const { c, phases } = harness([true])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(SHUTDOWN_FALLBACK_MS)
    expect(phases).toEqual(['shutting', 'offline'])
  })

  it('判定 offline 后停止探活(不继续打已关机的机器)', async () => {
    const { c, probe } = harness([false])
    c.startShutdown()
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 2)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 5)
    expect(probe.mock.calls.length).toBe(n)
  })
})

describe('重启流(对位 Vue2 onRestartConfirmed L1816-1861)', () => {
  it('立刻进 restarting', () => {
    const { c, phases } = harness([true])
    c.startRestart()
    expect(phases).toEqual(['restarting'])
  })

  it('前 5 秒不探活(给重启命令生效的时间)', async () => {
    const { c, probe } = harness([true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS - 1)
    expect(probe).not.toHaveBeenCalled()
  })

  it('探活失败一次即进 reconnecting(重启不像关机,下线是必经态)', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['restarting', 'reconnecting'])
  })

  it('必须先下线再上线才算重启完成(否则只是命令还没生效)', async () => {
    const { c, phases, reload } = harness([true, true, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 3)
    expect(phases).toEqual(['restarting'])   // 一直在线 → 不判完成
    expect(reload).not.toHaveBeenCalled()
  })

  it('下线再上线 → done,并在 1.5 秒后 reload', async () => {
    const { c, phases, reload } = harness([false, true])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 2)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DONE_RELOAD_DELAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('180 秒仍没回来 → fallback', async () => {
    const { c, phases } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    expect(phases[phases.length - 1]).toBe('fallback')
  })

  it('fallback 后停止探活与兜底表', async () => {
    const { c, probe, reload } = harness([false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS)
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 10)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('done 之后不再有多余的相位变化(不会又滑回 reconnecting)', async () => {
    const { c, phases } = harness([false, true, false, false])
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS * 6)
    expect(phases).toEqual(['restarting', 'reconnecting', 'done'])
  })
})

describe('应用更新流(对位 Vue2 startAppUpdate L1501-1534)', () => {
  it('进 appUpdating,5 秒后直接当作已下线开始等回来', async () => {
    const { c, phases } = harness([true])
    c.startAppUpdating()
    expect(phases).toEqual(['appUpdating'])
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['appUpdating', 'done'])
  })
})

describe('reset', () => {
  it('清掉所有定时器并回 idle', async () => {
    const { c, phases, probe, reload } = harness([false])
    c.startRestart()
    c.reset()
    expect(phases[phases.length - 1]).toBe('idle')
    const n = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(RESTART_FALLBACK_MS * 2)
    expect(probe.mock.calls.length).toBe(n)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reset 后可以重新开一轮', async () => {
    const { c, phases } = harness([false])
    c.startShutdown(); c.reset(); c.startShutdown()
    expect(phases).toEqual(['shutting', 'idle', 'shutting'])
  })
})
