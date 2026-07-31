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

// 评审 fix round 1(Critical + Important 1):harness() 里的探活在同一个微任务里就
// resolve,测不出「探活正在途中、这一轮已经翻篇」这类交错场景。这里用手动 resolve
// 的 deferred promise,让探活真的在阶段切换之间悬空,才能把 gen/settled 两道防线
// 分别测出来。
function deferredHarness() {
  const phases: PowerPhase[] = []
  const reload = vi.fn()
  const pending: Array<(v: boolean) => void> = []
  const probe = vi.fn(() => new Promise<boolean>((resolve) => { pending.push(resolve) }))
  const c = createPowerFlow({ probe, reload, onPhase: (p) => phases.push(p) })
  // resolve 第 i 个(从 0 开始)探活调用,并把 `await deps.probe()` 之后的同步延续
  // 跑完 —— 那段延续本身不再 await 任何东西,一次微任务 flush 就够,多留一次保险。
  async function resolveProbe(i: number, value: boolean) {
    pending[i](value)
    await Promise.resolve()
    await Promise.resolve()
  }
  return { c, phases, reload, probe, resolveProbe }
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

// 评审 fix round 1:探活是 await 出去的,真实场景里一次探活可能挂起几十秒
// (正在重启的机器,fetch 直接悬空)。上面的用例全部在同一个微任务里 resolve,
// 从未真正测过"探活还没回来、这一轮已经结束/翻篇"这类交错 —— 评审指出
// 删掉两个回调里的 `if (settled) return` 全套用例照样全绿,就是因为这个盲区。
describe('评审 fix round 1:悬空探活的过期防护(gen + settled 双重门)', () => {
  it('1) 相位已定后,迟到的探活结果不能再推动相位(settled 门)', async () => {
    const { c, phases, resolveProbe } = deferredHarness()
    c.startRestart()
    // 走到重启第一次真正发起探活的那一刻,让它悬空不 resolve
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(phases).toEqual(['restarting'])
    // 180 秒兜底到点,探活仍未回来 → fallback
    await vi.advanceTimersByTimeAsync(
      RESTART_FALLBACK_MS - (RESTART_PING_DELAY_MS + PING_INTERVAL_MS),
    )
    expect(phases).toEqual(['restarting', 'fallback'])
    // 迟到的探活终于回来了(下线)—— 不能再把相位推向 reconnecting
    await resolveProbe(0, false)
    expect(phases).toEqual(['restarting', 'fallback'])
  })

  it('2) reset() 之后,迟到的探活结果不能把 idle 拖回 reconnecting(Critical 回归,gen 门)', async () => {
    const { c, phases, resolveProbe } = deferredHarness()
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(
      RESTART_FALLBACK_MS - (RESTART_PING_DELAY_MS + PING_INTERVAL_MS),
    )
    expect(phases).toEqual(['restarting', 'fallback'])
    // 对位 Critical 描述的步骤 3:用户点关闭 → reset()
    c.reset()
    expect(phases).toEqual(['restarting', 'fallback', 'idle'])
    // 对位步骤 4:悬空探活终于 reject/resolve(false)
    await resolveProbe(0, false)
    expect(phases).toEqual(['restarting', 'fallback', 'idle'])   // 没有多出 reconnecting
  })

  it('3) 上一轮悬空的探活不能污染下一轮的 sawOffline(核心不变式,gen 门)', async () => {
    const { c, phases, reload, probe, resolveProbe } = deferredHarness()
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(1)   // 第一轮的探活已发出,悬空未回
    expect(phases).toEqual(['restarting'])

    // 用户中途取消,又立刻开了新一轮重启(同一个 flow 实例,对应"关了又点")
    c.reset()
    c.startRestart()
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])

    // 上一轮悬空的探活现在才回来,报"下线" —— 必须被当过期结果丢弃,
    // 不能替新一轮把 sawOffline 提前置真
    await resolveProbe(0, false)
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])   // 没有多出 reconnecting

    // 新一轮自己真正发起的第一次探活,报"活着"
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(2)
    await resolveProbe(1, true)
    // 新一轮从未真正见过下线,不能因为一次"活着"就直接 done —— 这正是
    // 这个任务存在的核心原因(必须先下线再上线才算重启完成)
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])
    expect(reload).not.toHaveBeenCalled()
  })

  it('4) 卸载(reset)之后不会新建 reload 定时器,即便过期探活凑出「假下线→假上线」也不会真的 reload(gen 门)', async () => {
    // 与用例 3 同源的交错(上一轮悬空探活 + 新一轮真实探活),但走到底 ——
    // 断言的不是相位,而是真正的副作用:reload() 有没有被调用。这是
    // requirement 8「卸载后不留任何定时器」最终要保护的东西:哪怕相位判断
    // 出了别的岔子,也不能真的把用户的页面刷新掉。
    const { c, phases, reload, probe, resolveProbe } = deferredHarness()
    c.startRestart()
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(1)   // 第一轮探活已发出,悬空未回

    // 对位 Critical 里的"卸载"场景:onBeforeUnmount 调 flow.reset()
    c.reset()
    // 卸载后如果又重新挂载并再次点了重启(同一个 flow 实例可以复用)
    c.startRestart()
    expect(phases).toEqual(['restarting', 'idle', 'restarting'])

    // 上一轮悬空的探活现在才回来,报"下线"—— 过期结果,必须被丢弃
    await resolveProbe(0, false)
    // 新一轮自己真正发起的第一次探活,报"活着"
    await vi.advanceTimersByTimeAsync(RESTART_PING_DELAY_MS + PING_INTERVAL_MS)
    expect(probe).toHaveBeenCalledTimes(2)
    await resolveProbe(1, true)

    // 就算等了比 reload 延迟长得多的时间,新一轮也从未真正见过下线,
    // 绝不能真的 reload
    await vi.advanceTimersByTimeAsync(DONE_RELOAD_DELAY_MS * 10)
    expect(phases).not.toContain('done')
    expect(reload).not.toHaveBeenCalled()
  })
})
