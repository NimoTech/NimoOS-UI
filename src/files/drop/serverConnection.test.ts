import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ServerConnection, type ServerConnectionDeps } from './serverConnection'

class FakeWS {
  static instances: FakeWS[] = []
  binaryType = ''
  readyState = 0 // CONNECTING
  OPEN = 1
  CONNECTING = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  constructor(public url: string) { FakeWS.instances.push(this) }
  send(d: string) { this.sent.push(d) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
}

function makeDeps(over: Partial<ServerConnectionDeps> = {}): ServerConnectionDeps {
  return {
    getToken: () => 'tok1',
    getPeerId: () => 'p1',
    getExpiresAt: () => Math.floor(Date.now() / 1000) + 9999, // 未过期
    refresh: vi.fn(async () => {}),
    now: () => Date.now(),
    makeSocket: (u) => new FakeWS(u) as unknown as WebSocket,
    wsBase: () => 'ws://nas.local',
    onMessage: vi.fn(),
    onConnectionChange: vi.fn(),
    onReconnectScheduled: vi.fn(),
    ...over,
  }
}

beforeEach(() => { vi.useFakeTimers(); FakeWS.instances = [] })
afterEach(() => vi.useRealTimers())

describe('ServerConnection', () => {
  it('URL 现构:含 token 与 peer,未过期不调 refresh', async () => {
    const deps = makeDeps()
    const c = new ServerConnection(deps)
    await c.connect()
    expect(deps.refresh).not.toHaveBeenCalled()
    expect(FakeWS.instances[0].url).toBe('ws://nas.local/v1/file/ws?token=tok1&peer=p1')
  })
  it('过期先 await refresh 再用新 token 连(修 Vue2 token 焊死)', async () => {
    let tok = 'old'
    const deps = makeDeps({
      getExpiresAt: () => 0, // 已过期
      getToken: () => tok,
      refresh: vi.fn(async () => { tok = 'new' }),
    })
    await new ServerConnection(deps).connect()
    expect(deps.refresh).toHaveBeenCalledOnce()
    expect(FakeWS.instances[0].url).toContain('token=new')
  })
  it('refresh 失败不连(共享包 onAuthFail 已接管)', async () => {
    const deps = makeDeps({ getExpiresAt: () => 0, refresh: vi.fn(async () => { throw new Error('x') }) })
    await new ServerConnection(deps).connect()
    expect(FakeWS.instances.length).toBe(0)
  })
  it('close 后 5s 自动整条重连(修 Vue2 空参 no-op),destroy 后不再重连', async () => {
    const deps = makeDeps()
    const c = new ServerConnection(deps)
    await c.connect()
    const ws = FakeWS.instances[0]
    ws.open()
    ws.onclose?.()
    expect(deps.onReconnectScheduled).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeWS.instances.length).toBe(2) // 新 socket
    c.destroy()
    ;(FakeWS.instances[1] as FakeWS).onclose?.()
    await vi.advanceTimersByTimeAsync(10000)
    expect(FakeWS.instances.length).toBe(2) // 不再增加
  })
  it('ping 自动回 pong;其余消息透传 onMessage', async () => {
    const deps = makeDeps()
    const c = new ServerConnection(deps)
    await c.connect()
    const ws = FakeWS.instances[0]
    ws.open()
    ws.onmessage?.({ data: JSON.stringify({ type: 'ping' }) })
    expect(ws.sent).toContain(JSON.stringify({ type: 'pong' }))
    ws.onmessage?.({ data: JSON.stringify({ type: 'peer-left', peerId: 'x' }) })
    expect(deps.onMessage).toHaveBeenCalledWith({ type: 'peer-left', peerId: 'x' })
  })
  it('destroy 发 disconnect 并关闭', async () => {
    const c = new ServerConnection(makeDeps())
    await c.connect()
    const ws = FakeWS.instances[0]
    ws.open()
    c.destroy()
    expect(ws.sent).toContain(JSON.stringify({ type: 'disconnect' }))
    expect(ws.readyState).toBe(3)
  })
  it('并发 connect() 调用被守卫堵住:第二个等待第一个完成', async () => {
    let resolve: ((value: void) => void) | null = null
    const deps = makeDeps({
      getExpiresAt: () => 0, // 强制 refresh
      refresh: vi.fn(() => new Promise<void>(r => { resolve = r })), // 手工延迟 resolve
    })
    const c = new ServerConnection(deps)
    // 两次 connect() 不 await,第二次会被 connecting=true 的守卫拦截
    c.connect() // 进入 await refresh(),此刻 connecting=true
    c.connect() // 立即返回,无 socket 创建
    await Promise.resolve() // flush 微任务
    expect(FakeWS.instances.length).toBe(0) // 还没 resolve refresh,没创建 ws
    // 手工 resolve refresh,继续执行第一个 connect()
    resolve!()
    await Promise.resolve()
    await Promise.resolve() // 确保 finally 块执行
    expect(deps.refresh).toHaveBeenCalledOnce() // 仅第一次 connect() 的 refresh 被调用
    expect(FakeWS.instances.length).toBe(1) // 仅一个 socket 被创建
  })
})
