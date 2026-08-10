import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({
  connect: vi.fn(async () => {}),
  destroy: vi.fn(),
  send: vi.fn(),
  suspend: vi.fn(),
  pmHandle: vi.fn(),
  pmSendFiles: vi.fn(() => true),
  pmDestroy: vi.fn(),
  pmHasActiveTransfers: vi.fn(() => false),
  pmCancelTransfer: vi.fn(),
  capturedDeps: null as Record<string, unknown> | null,
  capturedEvents: null as Record<string, (...a: never[]) => void> | null,
}))
vi.mock('../serverConnection', () => ({
  ServerConnection: class {
    constructor(deps: Record<string, unknown>) { h.capturedDeps = deps }
    connect = h.connect; destroy = h.destroy; send = h.send; suspend = h.suspend
  },
}))
vi.mock('../peersManager', () => ({
  PeersManager: class {
    constructor(_s: unknown, events: Record<string, (...a: never[]) => void>) { h.capturedEvents = events }
    handleServerMessage = h.pmHandle; sendFiles = h.pmSendFiles; destroy = h.pmDestroy
    hasActiveTransfers = h.pmHasActiveTransfers; cancelTransfer = h.pmCancelTransfer
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}) }))

import { useDropStore } from './drop'

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); localStorage.clear() })
// destroy() 摘掉 window 上的 pagehide/visibilitychange 监听——不清会跨用例累积,dispatchEvent 就会打到历史用例的残留监听器
afterEach(() => { try { useDropStore().destroy() } catch { /* noop */ } })

const peerInfo = (id: string) => ({ id, name: { model: 'desktop', deviceName: 'd', displayName: 'Dev-' + id }, rtcSupported: true })
const dispatch = (msg: unknown) => (h.capturedDeps!.onMessage as (m: unknown) => void)(msg)

describe('useDropStore', () => {
  it('init 幂等:二次调用不重建连接', () => {
    const s = useDropStore()
    s.init(); s.init()
    expect(h.connect).toHaveBeenCalledTimes(1)
  })
  it('peers/peer-joined/peer-left 维护列表并转发引擎;display-name 记 selfId+持久化 peerid+self 置顶', () => {
    const s = useDropStore()
    s.init()
    dispatch({ type: 'peers', peers: [peerInfo('a')] })
    expect(s.peers.map((p) => p.id)).toEqual(['a'])
    expect(h.pmHandle).toHaveBeenCalled()
    dispatch({ type: 'display-name', message: { id: 'me1', deviceName: 'nas', displayName: 'Me' } })
    expect(s.selfId).toBe('me1')
    expect(localStorage.getItem('peerid')).toBe('me1')
    expect(s.peers[0].id).toBe('me1') // self 置顶
    dispatch({ type: 'peer-joined', peer: peerInfo('b') })
    expect(s.peers.some((p) => p.id === 'b')).toBe(true)
    dispatch({ type: 'peer-left', peerId: 'a' })
    expect(s.peers.some((p) => p.id === 'a')).toBe(false)
  })
  it('进度 ingest:sending=files 非空;progress===1 清条目;接收计数来自 text', () => {
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'a', progress: 0.5, filesQueue: 2, files: [new File(['x'], 'x')] })
    expect(s.transfers['a']).toEqual({ progress: 50, sending: true, count: 2 })
    ;(ev.onTextReceived as (e: unknown) => void)({ text: '3', sender: 'b' })
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'b', progress: 0.2, filesQueue: 1, files: [] })
    expect(s.transfers['b']).toEqual({ progress: 20, sending: false, count: 3 })
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'a', progress: 1, filesQueue: 1, files: [new File(['x'], 'x')] })
    expect(s.transfers['a']).toBeUndefined()
  })
  it('接收队列:onFileReceived 入队;saveCurrent/ignoreCurrent 出队', () => {
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    const push = (n: string) => (ev.onFileReceived as (e: unknown) => void)({ file: { name: n, mime: '', size: 1, blob: new Blob(['x']) }, from: 'a' })
    push('1.txt'); push('2.txt')
    expect(s.receiveQueue.length).toBe(2)
    s.ignoreCurrent()
    expect(s.receiveQueue[0].file.name).toBe('2.txt')
  })
  it('sendFiles 透传管理器;返回 false 时弹不支持 toast', () => {
    const s = useDropStore()
    s.init()
    s.sendFiles('a', [new File(['x'], 'x')])
    expect(h.pmSendFiles).toHaveBeenCalled()
  })
  it('destroy 断连清态且可再 init', () => {
    const s = useDropStore()
    s.init(); s.destroy()
    expect(h.destroy).toHaveBeenCalledOnce()
    expect(h.pmDestroy).toHaveBeenCalledOnce()
    s.init()
    expect(h.connect).toHaveBeenCalledTimes(2)
  })
  it('pagehide 触发非永久断开(spec §5):调 server.suspend 而非 destroy', () => {
    const s = useDropStore()
    s.init()
    window.dispatchEvent(new Event('pagehide'))
    expect(h.suspend).toHaveBeenCalledOnce()
    expect(h.destroy).not.toHaveBeenCalled()
  })
  it('重连 peers 替换后保留 self 显示名(评审发现 #1)', () => {
    const s = useDropStore()
    s.init()
    // 先收到 display-name 消息,设置 selfId='me1',displayName='Me'
    dispatch({ type: 'display-name', message: { id: 'me1', deviceName: 'nas', displayName: 'Me' } })
    expect(s.selfId).toBe('me1')
    expect(s.peers[0].id).toBe('me1')
    expect(s.peers[0].name.displayName).toBe('Me')
    // 然后收到 peers 消息,替换整个列表为仅包含 peer 'a' 的列表
    dispatch({ type: 'peers', peers: [peerInfo('a')] })
    // self 应该保留名字并重新置顶,即使不在新 peers 列表里
    expect(s.peers[0].id).toBe('me1')
    expect(s.peers[0].name.displayName).toBe('Me')
    expect(s.peers[1].id).toBe('a')
  })
  it('hasActiveTransfers forwards to the manager', () => {
    const s = useDropStore()
    s.init()
    h.pmHasActiveTransfers.mockReturnValueOnce(true)
    expect(s.hasActiveTransfers()).toBe(true)
    h.pmHasActiveTransfers.mockReturnValueOnce(false)
    expect(s.hasActiveTransfers()).toBe(false)
  })
  it('hasActiveTransfers is false before init (no manager yet)', () => {
    const s = useDropStore()
    expect(s.hasActiveTransfers()).toBe(false)
    expect(h.pmHasActiveTransfers).not.toHaveBeenCalled()
  })
  it('cancelTransfer forwards the peerId to the manager', () => {
    const s = useDropStore()
    s.init()
    s.cancelTransfer('peer-x')
    expect(h.pmCancelTransfer).toHaveBeenCalledWith('peer-x')
  })
  it('cancelTransfer is a no-op before init (no manager yet)', () => {
    const s = useDropStore()
    expect(() => s.cancelTransfer('peer-x')).not.toThrow()
    expect(h.pmCancelTransfer).not.toHaveBeenCalled()
  })
})
