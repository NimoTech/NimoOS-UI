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
    getExpiresAt: () => Math.floor(Date.now() / 1000) + 9999, // not expired
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
  it('URL constructed on the fly: contains token and peer, not expired does not call refresh', async () => {
    const deps = makeDeps()
    const c = new ServerConnection(deps)
    await c.connect()
    expect(deps.refresh).not.toHaveBeenCalled()
    expect(FakeWS.instances[0].url).toBe('ws://nas.local/v1/file/ws?token=tok1&peer=p1')
  })
  it('if expired, await refresh first then connect with new token (fixes Vue2 hardcoded token)', async () => {
    let tok = 'old'
    const deps = makeDeps({
      getExpiresAt: () => 0, // already expired
      getToken: () => tok,
      refresh: vi.fn(async () => { tok = 'new' }),
    })
    await new ServerConnection(deps).connect()
    expect(deps.refresh).toHaveBeenCalledOnce()
    expect(FakeWS.instances[0].url).toContain('token=new')
  })
  it('if refresh fails, do not connect (shared package onAuthFail handles it)', async () => {
    const deps = makeDeps({ getExpiresAt: () => 0, refresh: vi.fn(async () => { throw new Error('x') }) })
    await new ServerConnection(deps).connect()
    expect(FakeWS.instances.length).toBe(0)
  })
  it('after close, reconnect after 5s (fixes Vue2 no-op with no args); after destroy, no reconnect', async () => {
    const deps = makeDeps()
    const c = new ServerConnection(deps)
    await c.connect()
    const ws = FakeWS.instances[0]
    ws.open()
    ws.onclose?.()
    expect(deps.onReconnectScheduled).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeWS.instances.length).toBe(2) // new socket
    c.destroy()
    ;(FakeWS.instances[1] as FakeWS).onclose?.()
    await vi.advanceTimersByTimeAsync(10000)
    expect(FakeWS.instances.length).toBe(2) // no longer increases
  })
  it('ping auto-responds with pong; other messages pass through to onMessage', async () => {
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
  it('destroy sends disconnect and closes', async () => {
    const c = new ServerConnection(makeDeps())
    await c.connect()
    const ws = FakeWS.instances[0]
    ws.open()
    c.destroy()
    expect(ws.sent).toContain(JSON.stringify({ type: 'disconnect' }))
    expect(ws.readyState).toBe(3)
  })
  it('suspend() sends disconnect and closes, but does not set destroyed: does not prevent reconnect, manual connect() still works after (spec §5)', async () => {
    const deps = makeDeps()
    const c = new ServerConnection(deps)
    await c.connect()
    const ws = FakeWS.instances[0]
    ws.open()
    c.suspend()
    expect(ws.sent).toContain(JSON.stringify({ type: 'disconnect' }))
    expect(ws.readyState).toBe(3)
    // Unlike handleDisconnect, does not auto-reconnect: onclose removed, advancing timer does not create new instance
    await vi.advanceTimersByTimeAsync(10000)
    expect(FakeWS.instances.length).toBe(1)
    // Manual connect() still works after (not blocked by destroyed)
    await c.connect()
    expect(FakeWS.instances.length).toBe(2)
  })
  it('concurrent connect() calls blocked by guard: second waits for first to complete', async () => {
    let resolve: ((value: void) => void) | null = null
    const deps = makeDeps({
      getExpiresAt: () => 0, // force refresh
      refresh: vi.fn(() => new Promise<void>(r => { resolve = r })), // manual delay resolve
    })
    const c = new ServerConnection(deps)
    // Two connect() calls without await; second blocked by connecting=true guard
    c.connect() // enters await refresh(), connecting=true now
    c.connect() // returns immediately, no socket created
    await Promise.resolve() // flush microtasks
    expect(FakeWS.instances.length).toBe(0) // refresh not yet resolved, ws not created
    // Manually resolve refresh, continue first connect()
    resolve!()
    await Promise.resolve()
    await Promise.resolve() // ensure finally block executes
    expect(deps.refresh).toHaveBeenCalledOnce() // only first connect()'s refresh called
    expect(FakeWS.instances.length).toBe(1) // only one socket created
  })
})
