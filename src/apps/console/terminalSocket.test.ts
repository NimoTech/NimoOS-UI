import { describe, it, expect, vi } from 'vitest'
import { buildTerminalWsUrl, TerminalSocket, type TerminalSocketDeps } from './terminalSocket'

class FakeWS {
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  close() { this.closed = true; this.onclose?.() }
}
function makeDeps(over: Partial<TerminalSocketDeps> = {}) {
  const ws = new FakeWS()
  const deps: TerminalSocketDeps = {
    // getExpiresAt 默认给远未来值(而非 null)—— null 是 shouldRefreshToken 的"保守刷新"哨兵,
    // 会让 connect() 在建 socket 前多等一次 refresh() 微任务,与下面几个测试同步触发 ws.onopen 的写法冲突。
    // 需要显式测试"快过期先 refresh"路径的用例会自行覆盖 getExpiresAt。
    getToken: () => 'tok', getExpiresAt: () => 9_999_999_999, refresh: vi.fn().mockResolvedValue(undefined),
    now: () => 1000, wsBase: () => 'ws://host', makeSocket: vi.fn(() => ws as unknown as WebSocket),
    onStatus: vi.fn(), ...over,
  }
  return { deps, ws }
}

it('URL 含容器 id、token、cols/rows 且正确编码', () => {
  expect(buildTerminalWsUrl('ws://h', 'abc123', 't+k', 120, 30))
    .toBe('ws://h/v1/container/abc123/terminal?token=t%2Bk&cols=120&rows=30')
})
it('快过期时先 refresh 再连', async () => {
  const { deps, ws } = makeDeps({ getExpiresAt: () => 1, now: () => 10_000_000 })
  const s = new TerminalSocket(deps)
  const p = s.connect('c1', 80, 24)
  await vi.waitFor(() => expect(deps.makeSocket).toHaveBeenCalled())
  expect(deps.refresh).toHaveBeenCalled()
  ws.onopen?.()
  await expect(p).resolves.toBeTruthy()
})
it('refresh 失败 → 不建 socket,resolve null,status=closed', async () => {
  const { deps } = makeDeps({ getExpiresAt: () => 1, now: () => 10_000_000, refresh: vi.fn().mockRejectedValue(new Error('x')) })
  const s = new TerminalSocket(deps)
  await expect(s.connect('c1', 80, 24)).resolves.toBeNull()
  expect(deps.makeSocket).not.toHaveBeenCalled()
  expect(deps.onStatus).toHaveBeenLastCalledWith('closed')
})
it('open 前先 connecting,open 后 status=open;远端断开 → closed(不自动重连)', async () => {
  const { deps, ws } = makeDeps()
  const s = new TerminalSocket(deps)
  const p = s.connect('c1', 80, 24)
  expect(deps.onStatus).toHaveBeenLastCalledWith('connecting')
  ws.onopen?.()
  await p
  expect(deps.onStatus).toHaveBeenLastCalledWith('open')
  ws.onclose?.()
  expect(deps.onStatus).toHaveBeenLastCalledWith('closed')
  expect(deps.makeSocket).toHaveBeenCalledTimes(1) // 无自动重连
})
it('close() 幂等且置 closed', async () => {
  const { deps, ws } = makeDeps()
  const s = new TerminalSocket(deps)
  const p = s.connect('c1', 80, 24); ws.onopen?.(); await p
  s.close(); s.close()
  expect(ws.closed).toBe(true)
  expect(deps.onStatus).toHaveBeenLastCalledWith('closed')
})
it('无 token → resolve null 不建连', async () => {
  const { deps } = makeDeps({ getToken: () => null })
  await expect(new TerminalSocket(deps).connect('c1', 80, 24)).resolves.toBeNull()
  expect(deps.makeSocket).not.toHaveBeenCalled()
})
it('close() 打在 refresh() 挂起期间 → refresh 落定后不建 socket,resolve null,status=closed(代际守卫)', async () => {
  let resolveRefresh: (() => void) | undefined
  const refresh = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve }))
  const { deps } = makeDeps({ getExpiresAt: () => 1, now: () => 10_000_000, refresh })
  const s = new TerminalSocket(deps)
  const p = s.connect('c1', 80, 24)
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  s.close() // 卸载场景:refresh 还没落定,调用方已经 close()
  expect(deps.onStatus).toHaveBeenLastCalledWith('closed')
  resolveRefresh?.()
  await expect(p).resolves.toBeNull()
  expect(deps.makeSocket).not.toHaveBeenCalled()
  expect(deps.onStatus).toHaveBeenLastCalledWith('closed')
})
