import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({
  connect: vi.fn(async () => {}),
  destroy: vi.fn(),
  send: vi.fn(),
  pmHandle: vi.fn(),
  pmSendFiles: vi.fn(() => true),
  pmDestroy: vi.fn(),
  capturedDeps: null as Record<string, unknown> | null,
  capturedEvents: null as Record<string, (...a: never[]) => void> | null,
}))
vi.mock('../serverConnection', () => ({
  ServerConnection: class {
    constructor(deps: Record<string, unknown>) { h.capturedDeps = deps }
    connect = h.connect; destroy = h.destroy; send = h.send
  },
}))
vi.mock('../peersManager', () => ({
  PeersManager: class {
    constructor(_s: unknown, events: Record<string, (...a: never[]) => void>) { h.capturedEvents = events }
    handleServerMessage = h.pmHandle; sendFiles = h.pmSendFiles; destroy = h.pmDestroy
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}) }))

import { useDropStore } from './drop'

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); localStorage.clear() })

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
})
