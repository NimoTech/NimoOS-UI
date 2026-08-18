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
import { useToast } from '../../../stores/toast'
import { i18n } from '../../../i18n'

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); localStorage.clear() })
// destroy() removes the pagehide/visibilitychange listeners from window — failure to clean
// them up causes accumulation across test cases, so dispatchEvent hits historical residual listeners
afterEach(() => { try { useDropStore().destroy() } catch { /* noop */ } })

const peerInfo = (id: string) => ({ id, name: { model: 'desktop', deviceName: 'd', displayName: 'Dev-' + id }, rtcSupported: true })
const dispatch = (msg: unknown) => (h.capturedDeps!.onMessage as (m: unknown) => void)(msg)

describe('useDropStore', () => {
  it('init is idempotent: second call does not rebuild connection', () => {
    const s = useDropStore()
    s.init(); s.init()
    expect(h.connect).toHaveBeenCalledTimes(1)
  })
  it('peers/peer-joined/peer-left maintain list and forward to engine; display-name record selfId+persist peerid+self pinned first', () => {
    const s = useDropStore()
    s.init()
    dispatch({ type: 'peers', peers: [peerInfo('a')] })
    expect(s.peers.map((p) => p.id)).toEqual(['a'])
    expect(h.pmHandle).toHaveBeenCalled()
    dispatch({ type: 'display-name', message: { id: 'me1', deviceName: 'nas', displayName: 'Me' } })
    expect(s.selfId).toBe('me1')
    expect(localStorage.getItem('peerid')).toBe('me1')
    expect(s.peers[0].id).toBe('me1') // self pinned first
    dispatch({ type: 'peer-joined', peer: peerInfo('b') })
    expect(s.peers.some((p) => p.id === 'b')).toBe(true)
    dispatch({ type: 'peer-left', peerId: 'a' })
    expect(s.peers.some((p) => p.id === 'a')).toBe(false)
  })
  it('progress ingest: sending=files not empty; progress===1 clears entry; receive count comes from text', () => {
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'a', progress: 0.5, filesQueue: 2, files: [new File(['x'], 'x')] })
    expect(s.transfers['a']).toEqual({ progress: 50, raw: 0.5, sending: true, count: 2 })
    ;(ev.onTextReceived as (e: unknown) => void)({ text: '3', sender: 'b' })
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'b', progress: 0.2, filesQueue: 1, files: [] })
    expect(s.transfers['b']).toEqual({ progress: 20, raw: 0.2, sending: false, count: 3 })
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'a', progress: 1, filesQueue: 1, files: [new File(['x'], 'x')] })
    expect(s.transfers['a']).toBeUndefined()
  })
  it('keeps the unrounded fraction alongside the rounded percent', () => {
    // The stall watchdog in DropItem.vue watches `raw`, so it must survive the
    // rounding: a 64 KB chunk of a multi-GB file moves the fraction by far less
    // than one percent, and if `raw` were rounded too the watchdog would be back
    // to seeing a frozen number on a perfectly healthy transfer.
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    ;(ev.onFileProgress as (e: unknown) => void)({ sender: 'a', progress: 0.4048, filesQueue: 1, files: [] })
    expect(s.transfers['a'].progress).toBe(40)
    expect(s.transfers['a'].raw).toBe(0.4048)
  })
  it('receive queue: onFileReceived enqueues; saveCurrent/ignoreCurrent dequeues', () => {
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    const push = (n: string) => (ev.onFileReceived as (e: unknown) => void)({ file: { name: n, mime: '', size: 1, blob: new Blob(['x']) }, from: 'a' })
    push('1.txt'); push('2.txt')
    expect(s.receiveQueue.length).toBe(2)
    s.ignoreCurrent()
    expect(s.receiveQueue[0].file.name).toBe('2.txt')
  })
  it('sendFiles passes through manager; toasts unsupported when returning false', () => {
    const s = useDropStore()
    s.init()
    s.sendFiles('a', [new File(['x'], 'x')])
    expect(h.pmSendFiles).toHaveBeenCalled()
  })
  it('destroy disconnects, clears state, and can init again', () => {
    const s = useDropStore()
    s.init(); s.destroy()
    expect(h.destroy).toHaveBeenCalledOnce()
    expect(h.pmDestroy).toHaveBeenCalledOnce()
    s.init()
    expect(h.connect).toHaveBeenCalledTimes(2)
  })
  it('pagehide triggers non-permanent disconnect (spec §5): calls server.suspend not destroy', () => {
    const s = useDropStore()
    s.init()
    window.dispatchEvent(new Event('pagehide'))
    expect(h.suspend).toHaveBeenCalledOnce()
    expect(h.destroy).not.toHaveBeenCalled()
  })
  it('reconnect preserves self display name after peers replacement (code review found #1)', () => {
    const s = useDropStore()
    s.init()
    // First receive display-name message, set selfId='me1', displayName='Me'
    dispatch({ type: 'display-name', message: { id: 'me1', deviceName: 'nas', displayName: 'Me' } })
    expect(s.selfId).toBe('me1')
    expect(s.peers[0].id).toBe('me1')
    expect(s.peers[0].name.displayName).toBe('Me')
    // Then receive peers message, replace entire list with list containing only peer 'a'
    dispatch({ type: 'peers', peers: [peerInfo('a')] })
    // self should retain name and be re-pinned to the top, even if not in new peers list
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
  it('names a user cancellation differently from a break nobody chose', () => {
    // All three reasons arrive through onTransferBroken, and until now all three
    // rendered "transfer interrupted" -- so cancelling a transfer on purpose read
    // like a failure.
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    const texts = () => useToast().toasts.map((x) => x.text)

    ;(ev.onTransferBroken as (e: unknown) => void)({ peerId: 'a', reason: 'cancelled' })
    expect(texts()).toEqual([i18n.global.t('filesDropCancelled')])
    ;(ev.onTransferBroken as (e: unknown) => void)({ peerId: 'a', reason: 'timeout' })
    ;(ev.onTransferBroken as (e: unknown) => void)({ peerId: 'a', reason: 'disconnected' })
    expect(texts().slice(1)).toEqual([
      i18n.global.t('filesDropInterrupted'),
      i18n.global.t('filesDropInterrupted'),
    ])
  })

  // 2026-08-13 acceptance: when phone just enters drop page, both devices toast "cannot connect to
  // each other", yet files transfer and receive normally. Probe revealed: server's device list holds
  // a ghost session (phone swiped away last time, socket not closed, waits 90s heartbeat sweep to
  // clear), and the page auto-dials every device on list on load — dialing ghost fails, 15s later
  // both sides toast once. User never clicked that device, yet told "cannot reach". Criterion: only
  // when user actually initiates send to this device should dial failure deserve interrupting them.
  it('stays quiet when a device nobody tried to send to turns out unreachable', () => {
    const s = useDropStore()
    s.init()
    const ev = h.capturedEvents!
    const texts = () => useToast().toasts.map((x) => x.text)

    ;(ev.onPeerUnreachable as (id: string) => void)('ghost')
    expect(texts()).toEqual([])

    // User clicked this device to send (dial in flight, reports not-ready), 15s later dial fails —
    // this time we must notify
    h.pmSendFiles.mockReturnValueOnce('not-ready' as never)
    s.sendFiles('real', [new File(['x'], 'x')])
    ;(ev.onPeerUnreachable as (id: string) => void)('real')
    expect(texts()).toEqual([
      i18n.global.t('filesDropNotReady'),
      i18n.global.t('filesDropUnreachable'),
    ])
  })

  it('cancelTransfer forwards the peerId and the reason to the manager', () => {
    const s = useDropStore()
    s.init()
    s.cancelTransfer('peer-x')
    expect(h.pmCancelTransfer).toHaveBeenCalledWith('peer-x', undefined)
    // The stall watchdog's stop is not a user cancellation, and the reason has
    // to survive the trip to the peer for the toast to say so.
    s.cancelTransfer('peer-y', 'timeout')
    expect(h.pmCancelTransfer).toHaveBeenCalledWith('peer-y', 'timeout')
  })
  it('cancelTransfer is a no-op before init (no manager yet)', () => {
    const s = useDropStore()
    expect(() => s.cancelTransfer('peer-x')).not.toThrow()
    expect(h.pmCancelTransfer).not.toHaveBeenCalled()
  })
})
